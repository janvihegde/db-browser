const express = require('express');
const router = express.Router();
const { getAppPool, getUserPool } = require('../config/db');
const { encrypt } = require('../utils/crypto');
const { requireAuth } = require('../middleware/auth');
const { Pool } = require('pg'); // Required for standalone test connections

router.use(requireAuth);

// GET /api/connections — list the current user's saved connections
router.get('/', async (req, res) => {
  try {
    const { rows } = await getAppPool().query(
      `SELECT id, label, host, port, db_user, database_name, ssl_reject_unauthorized, created_at
       FROM user_connections
       WHERE user_id = $1
       ORDER BY created_at DESC;`,
      [req.user.id]
    );
    res.json({ connections: rows });
  } catch (error) {
    console.error('Failed to list connections:', error.message);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// POST /api/connections/test — Test credentials before saving
router.post('/test', async (req, res) => {
  const { host, port, dbUser, dbPassword, databaseName, sslRejectUnauthorized } = req.body;

  if (!host || !dbUser || !dbPassword || !databaseName) {
    return res.status(400).json({ error: 'Host, Username, Password, and Database Name are required to test connection.' });
  }

  // Create a temporary single-use pool to test parameters
  const testPool = new Pool({
    user: dbUser,
    host: host,
    database: databaseName,
    password: dbPassword,
    port: Number(port) || 5432,
    ssl: { rejectUnauthorized: !!sslRejectUnauthorized },
    connectionTimeoutMillis: 5000 // Short timeout for live testing
  });

  try {
    const client = await testPool.connect();
    await client.query('SELECT 1;');
    client.release();
    res.json({ success: true, message: 'Connection verified successfully!' });
  } catch (error) {
    console.error('Connection test failed:', error.message);
    res.status(400).json({ error: `Connection failed: ${error.message}` });
  } finally {
    await testPool.end();
  }
});

// POST /api/connections — save a new connection
router.post('/', async (req, res) => {
  const { label, host, port, dbUser, dbPassword, databaseName, sslRejectUnauthorized } = req.body;

  if (!label || !host || !dbUser || !dbPassword || !databaseName) {
    return res.status(400).json({ error: 'label, host, dbUser, dbPassword, and databaseName are required' });
  }

  try {
    const encryptedPassword = encrypt(dbPassword);
    const { rows } = await getAppPool().query(
      `INSERT INTO user_connections
        (user_id, label, host, port, db_user, db_password_encrypted, database_name, ssl_reject_unauthorized)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, label, host, port, db_user, database_name, ssl_reject_unauthorized, created_at;`,
      [
        req.user.id,
        label,
        host,
        Number(port) || 5432,
        dbUser,
        encryptedPassword,
        databaseName,
        !!sslRejectUnauthorized
      ]
    );
    res.status(201).json({ connection: rows[0] });
  } catch (error) {
    console.error('Failed to save connection:', error.message);
    res.status(500).json({ error: 'Failed to save connection' });
  }
});

// PUT /api/connections/:id — Update an existing connection
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { label, host, port, dbUser, dbPassword, databaseName, sslRejectUnauthorized } = req.body;

  if (!label || !host || !dbUser || !databaseName) {
    return res.status(400).json({ error: 'label, host, dbUser, and databaseName are required' });
  }

  try {
    let queryText;
    let queryParams;

    if (dbPassword && dbPassword.trim() !== '') {
      // If a new password is provided, encrypt it and update the password field
      const encryptedPassword = encrypt(dbPassword);
      queryText = `
        UPDATE user_connections
        SET label = $1, host = $2, port = $3, db_user = $4, db_password_encrypted = $5, database_name = $6, ssl_reject_unauthorized = $7
        WHERE id = $8 AND user_id = $9
        RETURNING id, label, host, port, db_user, database_name, ssl_reject_unauthorized, created_at;
      `;
      queryParams = [label, host, Number(port) || 5432, dbUser, encryptedPassword, databaseName, !!sslRejectUnauthorized, id, req.user.id];
    } else {
      // Keep the existing encrypted password if a new one wasn't passed down
      queryText = `
        UPDATE user_connections
        SET label = $1, host = $2, port = $3, db_user = $4, database_name = $5, ssl_reject_unauthorized = $6
        WHERE id = $7 AND user_id = $8
        RETURNING id, label, host, port, db_user, database_name, ssl_reject_unauthorized, created_at;
      `;
      queryParams = [label, host, Number(port) || 5432, dbUser, databaseName, !!sslRejectUnauthorized, id, req.user.id];
    }

    const { rows, rowCount } = await getAppPool().query(queryText, queryParams);
    if (rowCount === 0) return res.status(404).json({ error: 'Connection not found' });

    res.json({ connection: rows[0] });
  } catch (error) {
    console.error('Failed to update connection:', error.message);
    res.status(500).json({ error: 'Failed to update connection' });
  }
});

// DELETE /api/connections/:id — remove a saved connection
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await getAppPool().query(
      `DELETE FROM user_connections WHERE id = $1 AND user_id = $2;`,
      [id, req.user.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    res.json({ message: 'Connection deleted' });
  } catch (error) {
    console.error('Failed to delete connection:', error.message);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

module.exports = router;