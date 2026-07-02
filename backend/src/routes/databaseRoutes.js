const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/database/list
router.get('/list', async (req, res) => {
  try {
   
    const query = 'SELECT datname FROM pg_database WHERE datistemplate = false;';
    const { rows } = await pool.query(query);
    
    
    const databases = rows.map(row => row.datname);
    
    res.json({ databases });
  } catch (error) {
    console.error('Error fetching databases:', error.message);
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
    
  
    const schemas = rows.map(row => row.schema_name);
    
    res.json({ schemas });
  } catch (error) {
    console.error('Error fetching schemas:', error.message);
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
    
    const tables = rows.map(row => row.table_name);
    res.json({ tables });
  } catch (error) {
    console.error('Error fetching tables:', error.message);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// GET /api/table/:table/columns
router.get('/table/:table/columns', async (req, res) => {
  const { table } = req.params;
  try {
    // Query to fetch column details
    const query = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY ordinal_position;
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
    // We use double quotes for the schema and table to handle case sensitivity
    const query = `SELECT * FROM "${schema}"."${table}" LIMIT 100;`;
    const { rows } = await pool.query(query);
    
    res.json({ data: rows });
  } catch (error) {
    console.error('Database Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/database/query/history
router.get('/query/history', async (req, res) => {
  try {
    const query = 'SELECT * FROM query_history ORDER BY executed_at DESC LIMIT 50;';
    const { rows } = await pool.query(query);
    res.json({ history: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch query history' });
  }
});

// POST /api/database/query
router.post('/query', async (req, res) => {
  const { sql } = req.body;

  if (!sql) {
    return res.status(400).json({ error: 'SQL query is required' });
  }

  try {
    // Execute the user-provided SQL
    const { rows } = await pool.query(sql);
    
    res.json({ data: rows });
  } catch (error) {
    console.error('SQL Execution Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/query', async (req, res) => {
  const { sql } = req.body;
  const startTime = Date.now();

  try {
    const { rows } = await pool.query(sql);
    const executionTime = Date.now() - startTime;

    // Log the successful query to history
    await pool.query(
      'INSERT INTO query_history (sql_text, execution_time_ms) VALUES ($1, $2)',
      [sql, executionTime]
    );
    
    res.json({ data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


const { Parser } = require('json2csv');

// GET /api/database/query/export?sql=...
router.get('/query/export', async (req, res) => {
  const { sql } = req.query; // Expecting the SQL as a query parameter

  if (!sql) {
    return res.status(400).json({ error: 'SQL query is required for export' });
  }

  try {
    const { rows } = await pool.query(sql);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No data to export' });
    }

    // Convert JSON to CSV
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(rows);

    // Set headers to trigger file download
    res.header('Content-Type', 'text/csv');
    res.attachment('query_results.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export Error:', error.message);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// GET /api/database/search?query=term
router.get('/search', async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    // Search both table names and column names
    const sql = `
      SELECT 'table' as type, table_name as name, table_schema 
      FROM information_schema.tables 
      WHERE table_name ILIKE $1 AND table_schema NOT IN ('information_schema', 'pg_catalog')
      UNION
      SELECT 'column' as type, column_name as name, table_name 
      FROM information_schema.columns 
      WHERE column_name ILIKE $1 AND table_schema NOT IN ('information_schema', 'pg_catalog');
    `;
    
    const { rows } = await pool.query(sql, [`%${query}%`]);
    res.json({ results: rows });
  } catch (error) {
    console.error('Search Error:', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});
// GET /api/table/:table/relationships
router.get('/table/:table/relationships', async (req, res) => {
  const { table } = req.params;
  try {
    const query = `
      SELECT 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name, 
        ccu.column_name AS foreign_column_name 
      FROM information_schema.key_column_usage AS kcu
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = kcu.constraint_name
      WHERE kcu.table_name = $1;
    `;
    const { rows } = await pool.query(query, [table]);
    
    res.json({ relationships: rows });
  } catch (error) {
    console.error('Error fetching relationships:', error.message);
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
});
module.exports = router;