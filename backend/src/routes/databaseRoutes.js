const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { Parser } = require('json2csv');
const { requireAuth } = require('../middleware/auth');

// Every route below requires a valid session/token
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Read-only metadata & data browsing
// ---------------------------------------------------------------------------

// GET /api/database/list
router.get('/list', async (req, res) => {
  try {
    const query = 'SELECT datname FROM pg_database WHERE datistemplate = false;';
    const { rows } = await pool.query(query);
    res.json({ databases: rows.map(row => row.datname) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch databases' });
  }
});

// GET /api/database/:db/schemas
router.get('/:db/schemas', async (req, res) => {
  try {
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
  const { schema } = req.params;
  try {
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

// GET /api/database/table/:table/columns
router.get('/table/:table/columns', async (req, res) => {
  const { table } = req.params;
  try {
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
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.column_name = pk.column_name
      LEFT JOIN (
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
      ) fk ON c.column_name = fk.column_name
      WHERE c.table_name = $1
      ORDER BY c.ordinal_position;
    `;
    const { rows } = await pool.query(query, [table]);
    res.json({ columns: rows });
  } catch (error) {
    console.error('Error fetching columns:', error.message);
    res.status(500).json({ error: 'Failed to fetch column details' });
  }
});

// GET /api/database/:schema/:table/preview
router.get('/:schema/:table/preview', async (req, res) => {
  const { schema, table } = req.params;
  try {
    const query = `SELECT * FROM "${schema}"."${table}" LIMIT 100;`;
    const { rows } = await pool.query(query);
    res.json({ data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/database/table/:table/count
// Uses an extremely fast estimate from pg_class instead of a slow COUNT(*)
router.get('/table/:table/count', async (req, res) => {
  const { table } = req.params;
  try {
    const query = `SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = $1;`;
    const { rows } = await pool.query(query, [table]);
    const count = rows.length > 0 ? rows[0].estimate : 0;
    
    res.json({ rowCount: count });
  } catch (error) {
    console.error('Count Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch row count' });
  }
});


// ---------------------------------------------------------------------------
// Query execution & export — RESTORED TIMEOUTS & ERROR MAPPING
// ---------------------------------------------------------------------------

// POST /api/database/query
router.post('/query', async (req, res) => {
  const { sql } = req.body;
  if (!sql) return res.status(400).json({ error: 'SQL query is required' });

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

// GET /api/database/query/export?sql=...
router.get('/query/export', async (req, res) => {
  const { sql } = req.query;
  if (!sql) return res.status(400).json({ error: 'SQL query is required for export' });

  try {
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