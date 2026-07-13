const express = require('express');
const router = express.Router();
const { getAppPool } = require('../config/db');
const { encrypt } = require('../utils/crypto');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/connections — list the current user's saved connections.
// Never returns the password (encrypted or otherwise).
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

// POST /api/connections — save a new connection for the current user.
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

// DELETE /api/connections/:id — remove a saved connection. Only the owner
// can delete their own connection (WHERE user_id = ... enforces this).
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
