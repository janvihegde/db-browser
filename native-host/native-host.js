#!/usr/bin/env node
// Native messaging host for the DB Browser extension. Runs locally, launched
// by Chrome when the extension sends a message. Talks to Chrome over stdin/
// stdout using Chrome's native messaging framing (4-byte little-endian
// length prefix + UTF-8 JSON), and to Postgres using the same queries the
// hosted backend used — just running on the user's own machine now, so
// "localhost" in a connection means the user's own database, correctly.

const { Pool } = require('pg');

// ---------------------------------------------------------------------------
// Chrome native messaging framing
// ---------------------------------------------------------------------------

let inputBuffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  processBuffer();
});

function processBuffer() {
  while (inputBuffer.length >= 4) {
    const messageLength = inputBuffer.readUInt32LE(0);
    if (inputBuffer.length < 4 + messageLength) return; // wait for more data

    const messageBytes = inputBuffer.slice(4, 4 + messageLength);
    inputBuffer = inputBuffer.slice(4 + messageLength);

    let message;
    try {
      message = JSON.parse(messageBytes.toString('utf8'));
    } catch (err) {
      sendMessage({ error: 'Malformed request' });
      continue;
    }
    handleMessage(message);
  }
}

function sendMessage(obj) {
  const json = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(Buffer.concat([header, json]));
}

// ---------------------------------------------------------------------------
// Connection pooling — one pool per unique host+port+user+database, reused
// across requests for the lifetime of this process.
// ---------------------------------------------------------------------------

const pools = new Map();

function getPool(conn, databaseName) {
  const key = `${conn.host}:${conn.port}:${conn.dbUser}:${databaseName}`;
  if (!pools.has(key)) {
    pools.set(key, new Pool({
      host: conn.host,
      port: Number(conn.port) || 5432,
      user: conn.dbUser,
      password: conn.dbPassword,
      database: databaseName,
      ssl: conn.sslRejectUnauthorized === undefined
        ? false
        : { rejectUnauthorized: !!conn.sslRejectUnauthorized },
      connectionTimeoutMillis: 8000
    }));
  }
  return pools.get(key);
}

async function isValidDatabase(conn, dbName) {
  const pool = getPool(conn, conn.databaseName);
  const { rows } = await pool.query(
    'SELECT 1 FROM pg_database WHERE datname = $1 AND datistemplate = false;',
    [dbName]
  );
  return rows.length > 0;
}

async function isValidTable(pool, schema, table) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 LIMIT 1;`,
    [schema, table]
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Request handlers — mirror the hosted backend's databaseRoutes.js /
// connectionRoutes.js logic, adapted to take the connection details
// directly in the request instead of loading them from a saved-connections
// table (there is no server-side "saved connections" store here; the
// frontend is responsible for remembering connection details per device,
// e.g. in localStorage).
// ---------------------------------------------------------------------------

async function handleMessage(message) {
  const { requestId, type, connection, params } = message;

  try {
    let result;
    switch (type) {
      case 'test':
        result = await testConnection(connection);
        break;
      case 'listDatabases':
        result = await listDatabases(connection);
        break;
      case 'listSchemas':
        result = await listSchemas(connection, params.db);
        break;
      case 'listTables':
        result = await listTables(connection, params.db, params.schema);
        break;
      case 'listColumns':
        result = await listColumns(connection, params.db, params.schema, params.table);
        break;
      case 'previewTable':
        result = await previewTable(connection, params.db, params.schema, params.table);
        break;
      case 'runQuery':
        result = await runQuery(connection, params.db, params.sql);
        break;
      default:
        return sendMessage({ requestId, error: `Unknown request type: ${type}` });
    }
    sendMessage({ requestId, result });
  } catch (error) {
    sendMessage({ requestId, error: error.message });
  }
}

async function testConnection(conn) {
  const testPool = new Pool({
    host: conn.host,
    port: Number(conn.port) || 5432,
    user: conn.dbUser,
    password: conn.dbPassword,
    database: conn.databaseName,
    ssl: { rejectUnauthorized: !!conn.sslRejectUnauthorized },
    connectionTimeoutMillis: 5000
  });
  try {
    const client = await testPool.connect();
    await client.query('SELECT 1;');
    client.release();
    return { success: true, message: 'Connection verified successfully!' };
  } finally {
    await testPool.end();
  }
}

async function listDatabases(conn) {
  const pool = getPool(conn, conn.databaseName);
  const { rows } = await pool.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
  return { databases: rows.map(r => r.datname) };
}

async function listSchemas(conn, db) {
  if (!(await isValidDatabase(conn, db))) throw new Error('Database not found');
  const pool = getPool(conn, db);
  const { rows } = await pool.query(`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast');
  `);
  return { schemas: rows.map(r => r.schema_name) };
}

async function listTables(conn, db, schema) {
  if (!(await isValidDatabase(conn, db))) throw new Error('Database not found');
  const pool = getPool(conn, db);
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1;`,
    [schema]
  );
  return { tables: rows.map(r => r.table_name) };
}

async function listColumns(conn, db, schema, table) {
  if (!(await isValidDatabase(conn, db))) throw new Error('Database not found');
  const pool = getPool(conn, db);
  if (!(await isValidTable(pool, schema, table))) throw new Error('Schema or table not found');

  const { rows } = await pool.query(`
    SELECT
      c.column_name, c.data_type, c.is_nullable, c.column_default,
      CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key,
      CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END AS is_foreign_key
    FROM information_schema.columns c
    LEFT JOIN (
      SELECT kcu.column_name FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
    ) pk ON c.column_name = pk.column_name
    LEFT JOIN (
      SELECT kcu.column_name FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'FOREIGN KEY'
    ) fk ON c.column_name = fk.column_name
    WHERE c.table_schema = $1 AND c.table_name = $2
    ORDER BY c.ordinal_position;
  `, [schema, table]);
  return { columns: rows };
}

async function previewTable(conn, db, schema, table) {
  if (!(await isValidDatabase(conn, db))) throw new Error('Database not found');
  const pool = getPool(conn, db);
  if (!(await isValidTable(pool, schema, table))) throw new Error('Schema or table not found');
  const { rows } = await pool.query(`SELECT * FROM "${schema}"."${table}" LIMIT 100;`);
  return { data: rows };
}

// Role enforcement (Viewer/Editor/Admin) happens on the frontend for this
// local-mode path today, same first-word SQL command check used previously
// server-side. Revisit if stronger enforcement is needed once this ships.
async function runQuery(conn, db, sql) {
  if (!(await isValidDatabase(conn, db))) throw new Error('Database not found');
  const pool = getPool(conn, db);
  const { rows } = await pool.query(sql);
  return { data: rows };
}

// Keep the process alive waiting for stdin messages.
process.stdin.resume();