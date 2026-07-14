// handlers.js
//
// Each handler takes (connection, params) and returns the plain object that
// becomes the `result` field of the reply — these shapes are dictated by
// db-browser-frontend/src/services/dbClient.js, which unwraps them (e.g.
// `res.databases`, `res.columns`). Keep both in sync if you change one.
//
// Query logic below is adapted directly from backend/src/routes/
// databaseRoutes.js — same SQL, same identifier-existence checks before
// interpolating schema/table names, same pg error-code mapping. What's
// removed is everything that assumed a multi-tenant hosted app: no
// requireAuth/enforceSqlRoles (this process only ever serves the one person
// running it), no loadOwnedConnection (the connection arrives directly in
// the request, already decrypted-because-never-encrypted — see the
// dbClient.js comment on that tradeoff), no json2csv export yet.

const { Pool } = require('pg');
const { getPool } = require('./db');

async function isValidDatabase(connection, dbName) {
  const pool = getPool(connection, connection.databaseName);
  const { rows } = await pool.query(
    'SELECT 1 FROM pg_database WHERE datname = $1 AND datistemplate = false;',
    [dbName]
  );
  return rows.length > 0;
}

async function isValidTable(pool, schema, table) {
  const { rows } = await pool.query(
    'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 LIMIT 1;',
    [schema, table]
  );
  return rows.length > 0;
}

function mapPgError(err) {
  if (err.code === '57014') return new Error('Query Timed Out: Execution exceeded 60 seconds.');
  if (err.code === '42601') return new Error(`Syntax Error at position ${err.position || 'unknown'}: Please check your SQL.`);
  if (err.code === '28000' || err.code === '28P01') return new Error('Permission Denied: Database rejected the connection.');
  if (['08000', '08003', '08006'].includes(err.code)) return new Error('Connection Lost: Unable to reach the database.');
  return err;
}

// ---------------------------------------------------------------------------
// Handlers, keyed by the `type` string sent from extensionBridge.js
// ---------------------------------------------------------------------------

async function test(connection) {
  // Mirrors connectionRoutes.js POST /test — a short-lived, single-use pool
  // just to confirm the credentials work, not the shared pool cache.
  const testPool = new Pool({
    user: connection.dbUser,
    host: connection.host,
    database: connection.databaseName,
    password: connection.dbPassword,
    port: Number(connection.port) || 5432,
    ssl: { rejectUnauthorized: !!connection.sslRejectUnauthorized },
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await testPool.connect();
    await client.query('SELECT 1;');
    client.release();
    return { message: 'Connection verified successfully!' };
  } finally {
    await testPool.end();
  }
}

async function listDatabases(connection) {
  const pool = getPool(connection, connection.databaseName);
  const { rows } = await pool.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
  return { databases: rows.map((r) => r.datname) };
}

async function listSchemas(connection, { db }) {
  if (!(await isValidDatabase(connection, db))) throw new Error('Database not found');
  const pool = getPool(connection, db);
  const { rows } = await pool.query(`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast');
  `);
  return { schemas: rows.map((r) => r.schema_name) };
}

async function listTables(connection, { db, schema }) {
  if (!(await isValidDatabase(connection, db))) throw new Error('Database not found');
  const pool = getPool(connection, db);
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1;`,
    [schema]
  );
  return { tables: rows.map((r) => r.table_name) };
}

async function listColumns(connection, { db, schema, table }) {
  if (!(await isValidDatabase(connection, db))) throw new Error('Database not found');
  const pool = getPool(connection, db);
  if (!(await isValidTable(pool, schema, table))) throw new Error('Schema or table not found');

  const query = `
    SELECT
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default,
      CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key,
      CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END AS is_foreign_key
    FROM information_schema.columns c
    LEFT JOIN (
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
    ) pk ON c.column_name = pk.column_name
    LEFT JOIN (
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'FOREIGN KEY'
    ) fk ON c.column_name = fk.column_name
    WHERE c.table_schema = $1 AND c.table_name = $2
    ORDER BY c.ordinal_position;
  `;
  const { rows } = await pool.query(query, [schema, table]);
  return { columns: rows };
}

async function previewTable(connection, { db, schema, table }) {
  if (!(await isValidDatabase(connection, db))) throw new Error('Database not found');
  const pool = getPool(connection, db);
  if (!(await isValidTable(pool, schema, table))) throw new Error('Schema or table not found');

  const { rows } = await pool.query(`SELECT * FROM "${schema}"."${table}" LIMIT 100;`);
  return { data: rows };
}

async function runQuery(connection, { db, sql }) {
  if (!sql) throw new Error('SQL query is required');
  if (!(await isValidDatabase(connection, db))) throw new Error('Database not found');

  const pool = getPool(connection, db);
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 60000');
    const result = await client.query(sql);
    return { data: result.rows, fields: result.fields };
  } catch (err) {
    throw mapPgError(err);
  } finally {
    try { await client.query('SET statement_timeout = 0'); } catch (_) {}
    client.release();
  }
}

module.exports = {
  test,
  listDatabases,
  listSchemas,
  listTables,
  listColumns,
  previewTable,
  runQuery,
};
