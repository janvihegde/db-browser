const express = require('express');
const router = express.Router();
const { getAppPool, getUserPool } = require('../config/db');
const { decrypt } = require('../utils/crypto');
const { Parser } = require('json2csv');
const { requireAuth, enforceSqlRoles } = require('../middleware/auth');

// Every route below requires a valid session/token
router.use(requireAuth);

// Enforce Viewer/Editor/Admin permissions on any route carrying SQL
router.use(enforceSqlRoles);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Loads a saved connection, but ONLY if it belongs to the requesting user —
// this is the ownership check that stops User A from browsing User B's
// database just by guessing a connection id in the URL.
async function loadOwnedConnection(connectionId, userId) {
  const { rows } = await getAppPool().query(
    `SELECT * FROM user_connections WHERE id = $1 AND user_id = $2;`,
    [connectionId, userId]
  );
  if (rows.length === 0) return null;

  const conn = rows[0];
  conn.db_password = decrypt(conn.db_password_encrypted); // decrypt in memory only
  return conn;
}

// Confirm `db` is a real, existing database on this connection's Postgres
// instance before creating a pool for it or running anything against it.
async function isValidDatabase(conn, dbName) {
  const pool = getUserPool(conn, conn.database_name);
  const { rows } = await pool.query(
    'SELECT 1 FROM pg_database WHERE datname = $1 AND datistemplate = false;',
    [dbName]
  );
  return rows.length > 0;
}

// Confirm schema/table actually exist before using them as interpolated
// identifiers in a query (SQL injection guard — Postgres can't parameterize
// identifiers the way it does values).
async function isValidTable(pool, schema, table) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 LIMIT 1;`,
    [schema, table]
  );
  return rows.length > 0;
}

// Middleware: resolves :connectionId into req.dbConnection (an owned,
// decrypted connection record) for every route below. 404s if the
// connection doesn't exist or doesn't belong to the requesting user.
async function resolveConnection(req, res, next) {
  try {
    const conn = await loadOwnedConnection(req.params.connectionId, req.user.id);
    if (!conn) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    req.dbConnection = conn;
    next();
  } catch (error) {
    console.error('Failed to resolve connection:', error.message);
    res.status(500).json({ error: 'Failed to resolve database connection' });
  }
}

router.use('/:connectionId', resolveConnection);

// ---------------------------------------------------------------------------
// Read-only metadata & data browsing
// ---------------------------------------------------------------------------

// GET /api/database/:connectionId/list — databases visible on this connection
// GET /api/database/:connectionId/list
router.get('/:connectionId/list', async (req, res) => {
  try {
    const pool = getUserPool(req.dbConnection, req.dbConnection.database_name);
    const { rows } = await pool.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
    res.json({ databases: rows.map(row => row.datname) });
  } catch (error) {
    console.error('Failed to list databases:', error.message);
    
    res.status(500).json({ error: `Connection Failed: ${error.message}` }); 
  }
});

// GET /api/database/:connectionId/:db/schemas
router.get('/:connectionId/:db/schemas', async (req, res) => {
  const { db } = req.params;
  try {
    if (!(await isValidDatabase(req.dbConnection, db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getUserPool(req.dbConnection, db);
    const { rows } = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast');
    `);
    res.json({ schemas: rows.map(row => row.schema_name) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schemas' });
  }
});

// GET /api/database/:connectionId/:db/schemas/:schema/tables
router.get('/:connectionId/:db/schemas/:schema/tables', async (req, res) => {
  const { db, schema } = req.params;
  try {
    if (!(await isValidDatabase(req.dbConnection, db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getUserPool(req.dbConnection, db);
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1;`,
      [schema]
    );
    res.json({ tables: rows.map(row => row.table_name) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// GET /api/database/:connectionId/:db/schemas/:schema/tables/:table/columns
router.get('/:connectionId/:db/schemas/:schema/tables/:table/columns', async (req, res) => {
  const { db, schema, table } = req.params;
  try {
    if (!(await isValidDatabase(req.dbConnection, db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getUserPool(req.dbConnection, db);
    if (!(await isValidTable(pool, schema, table))) {
      return res.status(404).json({ error: 'Schema or table not found' });
    }

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
    res.json({ columns: rows });
  } catch (error) {
    console.error('Error fetching columns:', error.message);
    res.status(500).json({ error: 'Failed to fetch column details' });
  }
});

// GET /api/database/:connectionId/:db/schemas/:schema/tables/:table/preview
router.get('/:connectionId/:db/schemas/:schema/tables/:table/preview', async (req, res) => {
  const { db, schema, table } = req.params;
  try {
    if (!(await isValidDatabase(req.dbConnection, db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getUserPool(req.dbConnection, db);
    if (!(await isValidTable(pool, schema, table))) {
      return res.status(404).json({ error: 'Schema or table not found' });
    }

    const query = `SELECT * FROM "${schema}"."${table}" LIMIT 100;`;
    const { rows } = await pool.query(query);
    res.json({ data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/database/:connectionId/:db/schemas/:schema/tables/:table/count
router.get('/:connectionId/:db/schemas/:schema/tables/:table/count', async (req, res) => {
  const { db, schema, table } = req.params;
  try {
    if (!(await isValidDatabase(req.dbConnection, db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getUserPool(req.dbConnection, db);
    const query = `
      SELECT c.reltuples::bigint AS estimate
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2;
    `;
    const { rows } = await pool.query(query, [schema, table]);
    const count = rows.length > 0 ? rows[0].estimate : 0;
    res.json({ rowCount: count });
  } catch (error) {
    console.error('Count Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch row count' });
  }
});

// GET /api/database/:connectionId/:db/schemas/:schema/tables/:table/relationships
router.get('/:connectionId/:db/schemas/:schema/tables/:table/relationships', async (req, res) => {
  const { db, schema, table } = req.params;
  try {
    if (!(await isValidDatabase(req.dbConnection, db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getUserPool(req.dbConnection, db);
    if (!(await isValidTable(pool, schema, table))) {
      return res.status(404).json({ error: 'Schema or table not found' });
    }

    const outgoingQuery = `
      SELECT tc.constraint_name, kcu.column_name,
        ccu.table_schema AS referenced_schema, ccu.table_name AS referenced_table, ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1 AND tc.table_name = $2;
    `;
    const incomingQuery = `
      SELECT tc.constraint_name, tc.table_schema AS referencing_schema, tc.table_name AS referencing_table,
        kcu.column_name AS referencing_column, ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_schema = $1 AND ccu.table_name = $2;
    `;

    const [outgoing, incoming] = await Promise.all([
      pool.query(outgoingQuery, [schema, table]),
      pool.query(incomingQuery, [schema, table])
    ]);

    res.json({ outgoing: outgoing.rows, incoming: incoming.rows });
  } catch (error) {
    console.error('Relationships Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch table relationships' });
  }
});

// GET /api/database/:connectionId/:db/search?q=...
router.get('/:connectionId/:db/search', async (req, res) => {
  const { db } = req.params;
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    if (!(await isValidDatabase(req.dbConnection, db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getUserPool(req.dbConnection, db);
    const likeTerm = `%${q.trim()}%`;

    const [tables, columns] = await Promise.all([
      pool.query(
        `SELECT table_schema, table_name FROM information_schema.tables
         WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast') AND table_name ILIKE $1
         ORDER BY table_schema, table_name LIMIT 50;`,
        [likeTerm]
      ),
      pool.query(
        `SELECT table_schema, table_name, column_name FROM information_schema.columns
         WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast') AND column_name ILIKE $1
         ORDER BY table_schema, table_name, column_name LIMIT 50;`,
        [likeTerm]
      )
    ]);

    res.json({ tables: tables.rows, columns: columns.rows });
  } catch (error) {
    console.error('Search Error:', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ---------------------------------------------------------------------------
// Query execution & export
// ---------------------------------------------------------------------------

// POST /api/database/:connectionId/:db/query
router.post('/:connectionId/:db/query', async (req, res) => {
  const { db } = req.params;
  const { sql } = req.body;
  if (!sql) return res.status(400).json({ error: 'SQL query is required' });

  let pool;
  try {
    if (!(await isValidDatabase(req.dbConnection, db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    pool = getUserPool(req.dbConnection, db);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to validate database' });
  }

  const client = await pool.connect();

  try {
    await client.query('SET statement_timeout = 60000');
    const result = await client.query(sql);
    res.json({ rows: result.rows, fields: result.fields });
  } catch (err) {
    console.error("Database query error:", err);

    if (err.code === '57014') {
        return res.status(408).json({ error: 'Query Timed Out: Execution exceeded 60 seconds.' });
    } else if (err.code === '42601') {
        return res.status(400).json({ error: `Syntax Error at position ${err.position || 'unknown'}: Please check your SQL.` });
    } else if (err.code === '28000' || err.code === '28P01') {
        return res.status(403).json({ error: 'Permission Denied: Database rejected the connection.' });
    } else if (['08000', '08003', '08006'].includes(err.code)) {
        return res.status(503).json({ error: 'Connection Lost: Unable to reach the database.' });
    }

    res.status(500).json({ error: err.message || 'An unexpected database error occurred.' });
  } finally {
    try { await client.query('SET statement_timeout = 0'); } catch(e) {}
    client.release();
  }
});

// GET /api/database/:connectionId/:db/query/export?sql=...
router.get('/:connectionId/:db/query/export', async (req, res) => {
  const { db } = req.params;
  const { sql } = req.query;
  if (!sql) return res.status(400).json({ error: 'SQL query is required for export' });

  try {
    if (!(await isValidDatabase(req.dbConnection, db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getUserPool(req.dbConnection, db);
    const { rows } = await pool.query(sql);
    if (rows.length === 0) return res.status(404).json({ error: 'No data to export' });

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(rows);

    res.header('Content-Type', 'text/csv');
    res.attachment('query_results.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;
