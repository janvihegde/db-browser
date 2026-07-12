const express = require('express');
const router = express.Router();
const { getPool, defaultPool } = require('../config/db');
const { Parser } = require('json2csv');
const { requireAuth, enforceSqlRoles } = require('../middleware/auth');

// Every route below requires a valid session/token
router.use(requireAuth);

// Enforce Viewer/Editor/Admin permissions on any route carrying SQL
// (req.body.sql or req.query.sql)
router.use(enforceSqlRoles);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Confirm `db` is a real, existing database on this Postgres instance before
// creating a pool or running anything against it. This isn't a SQL injection
// guard (the db name goes into the pool's `database` connection param, not
// concatenated SQL) — it's about not creating pools for typo'd/garbage names
// and giving a clean 404 instead of a confusing connection error.
async function isValidDatabase(dbName) {
  const { rows } = await defaultPool().query(
    'SELECT 1 FROM pg_database WHERE datname = $1 AND datistemplate = false;',
    [dbName]
  );
  return rows.length > 0;
}

// Confirm schema/table actually exist before using them as interpolated
// identifiers in a query — this IS the SQL injection guard, since Postgres
// doesn't support parameterizing identifiers (table/schema names) the way
// it does values.
async function isValidTable(pool, schema, table) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 LIMIT 1;`,
    [schema, table]
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Read-only metadata & data browsing
// ---------------------------------------------------------------------------

// GET /api/database/list
router.get('/list', async (req, res) => {
  try {
    const { rows } = await defaultPool().query(
      'SELECT datname FROM pg_database WHERE datistemplate = false;'
    );
    res.json({ databases: rows.map(row => row.datname) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch databases' });
  }
});

// GET /api/database/:db/schemas
router.get('/:db/schemas', async (req, res) => {
  const { db } = req.params;
  try {
    if (!(await isValidDatabase(db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getPool(db);
    const query = `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast');
    `;
    const { rows } = await pool.query(query);
    res.json({ schemas: rows.map(row => row.schema_name) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schemas' });
  }
});

// GET /api/database/:db/schemas/:schema/tables
router.get('/:db/schemas/:schema/tables', async (req, res) => {
  const { db, schema } = req.params;
  try {
    if (!(await isValidDatabase(db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getPool(db);
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1;
    `;
    const { rows } = await pool.query(query, [schema]);
    res.json({ tables: rows.map(row => row.table_name) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// GET /api/database/:db/schemas/:schema/tables/:table/columns
router.get('/:db/schemas/:schema/tables/:table/columns', async (req, res) => {
  const { db, schema, table } = req.params;
  try {
    if (!(await isValidDatabase(db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getPool(db);
    if (!(await isValidTable(pool, schema, table))) {
      return res.status(404).json({ error: 'Schema or table not found' });
    }

    // NOTE: the original version of this query filtered PK/FK subqueries by
    // table_name only, not schema — two schemas with a same-named table
    // would cross-contaminate PK/FK flags. Fixed by filtering on
    // table_schema everywhere below.
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

// GET /api/database/:db/schemas/:schema/tables/:table/preview
router.get('/:db/schemas/:schema/tables/:table/preview', async (req, res) => {
  const { db, schema, table } = req.params;
  try {
    if (!(await isValidDatabase(db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getPool(db);
    if (!(await isValidTable(pool, schema, table))) {
      return res.status(404).json({ error: 'Schema or table not found' });
    }

    // Safe now: schema/table are confirmed real, existing identifiers.
    const query = `SELECT * FROM "${schema}"."${table}" LIMIT 100;`;
    const { rows } = await pool.query(query);
    res.json({ data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/database/:db/schemas/:schema/tables/:table/count
// Uses an extremely fast estimate from pg_class instead of a slow COUNT(*)
router.get('/:db/schemas/:schema/tables/:table/count', async (req, res) => {
  const { db, schema, table } = req.params;
  try {
    if (!(await isValidDatabase(db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getPool(db);
    // Fixed: original query matched by relname only, so a table name that
    // existed in two schemas would return whichever pg_class happened to
    // list first. Joining pg_namespace scopes it to the right schema.
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

// GET /api/database/:db/schemas/:schema/tables/:table/relationships
// Returns this table's foreign keys (outgoing) and any tables that
// reference this one (incoming) — powers the "View relationships" tab.
// NOTE: assumes single-column foreign keys, which covers the vast majority
// of real-world schemas. Composite (multi-column) FKs will show each
// column as a separate row rather than grouped correctly.
router.get('/:db/schemas/:schema/tables/:table/relationships', async (req, res) => {
  const { db, schema, table } = req.params;
  try {
    if (!(await isValidDatabase(db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getPool(db);
    if (!(await isValidTable(pool, schema, table))) {
      return res.status(404).json({ error: 'Schema or table not found' });
    }

    const outgoingQuery = `
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_schema AS referenced_schema,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1 AND tc.table_name = $2;
    `;

    const incomingQuery = `
      SELECT
        tc.constraint_name,
        tc.table_schema AS referencing_schema,
        tc.table_name AS referencing_table,
        kcu.column_name AS referencing_column,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_schema = $1 AND ccu.table_name = $2;
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

// GET /api/database/:db/search?q=...
// Searches table names and column names across all user schemas in the
// given database — powers the sidebar search box.
router.get('/:db/search', async (req, res) => {
  const { db } = req.params;
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    if (!(await isValidDatabase(db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getPool(db);
    const likeTerm = `%${q.trim()}%`;

    const tablesQuery = `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        AND table_name ILIKE $1
      ORDER BY table_schema, table_name
      LIMIT 50;
    `;
    const columnsQuery = `
      SELECT table_schema, table_name, column_name
      FROM information_schema.columns
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        AND column_name ILIKE $1
      ORDER BY table_schema, table_name, column_name
      LIMIT 50;
    `;

    const [tables, columns] = await Promise.all([
      pool.query(tablesQuery, [likeTerm]),
      pool.query(columnsQuery, [likeTerm])
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

// POST /api/database/:db/query
router.post('/:db/query', async (req, res) => {
  const { db } = req.params;
  const { sql } = req.body;
  if (!sql) return res.status(400).json({ error: 'SQL query is required' });

  let pool;
  try {
    if (!(await isValidDatabase(db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    pool = getPool(db);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to validate database' });
  }

  const client = await pool.connect();

  try {
    // Safety Net: 60-second timeout
    await client.query('SET statement_timeout = 60000');

    // Execute the user-provided SQL
    const result = await client.query(sql);

    res.json({ rows: result.rows, fields: result.fields });
  } catch (err) {
    console.error("Database query error:", err);

    // Friendly Error Mapping
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

// GET /api/database/:db/query/export?sql=...
router.get('/:db/query/export', async (req, res) => {
  const { db } = req.params;
  const { sql } = req.query;
  if (!sql) return res.status(400).json({ error: 'SQL query is required for export' });

  try {
    if (!(await isValidDatabase(db))) {
      return res.status(404).json({ error: 'Database not found' });
    }
    const pool = getPool(db);
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
