const express = require('express');
const router = express.Router();
const { getAppPool, getUserPool } = require('../config/db');
const { encrypt } = require('../utils/crypto');
const { requireAuth } = require('../middleware/auth');
const { Pool } = require('pg'); // Required for standalone test connections
const { adHocTunnelStreamFactory } = require('../config/sshTunnel');

router.use(requireAuth);

// GET /api/connections — list the current user's saved connections
router.get('/', async (req, res) => {
  try {
    const { rows } = await getAppPool().query(
      `SELECT id, label, host, port, db_user, database_name, ssl_reject_unauthorized,
              bastion_host, bastion_port, bastion_user, created_at
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
  const {
    host, port, dbUser, dbPassword, databaseName, sslRejectUnauthorized,
    bastionHost, bastionPort, bastionUser, bastionPassword
  } = req.body;

  if (!host || !dbUser || !dbPassword || !databaseName) {
    return res.status(400).json({ error: 'Host, Username, Password, and Database Name are required to test connection.' });
  }

  const usesTunnel = !!bastionHost;
  if (usesTunnel && (!bastionUser || !bastionPassword)) {
    return res.status(400).json({ error: 'Bastion Host, Username, and Password are required when connecting through a bastion.' });
  }

  const poolConfig = {
    user: dbUser,
    host: host,
    database: databaseName,
    password: dbPassword,
    port: Number(port) || 5432,
    ssl: { rejectUnauthorized: !!sslRejectUnauthorized },
    connectionTimeoutMillis: 8000 // a bit more headroom than direct-only, since SSH negotiation adds latency
  };

  let tunnel = null;
  if (usesTunnel) {
    tunnel = adHocTunnelStreamFactory(
      { bastionHost, bastionPort: Number(bastionPort) || 22, bastionUser, bastionPassword },
      host,
      Number(port) || 5432
    );
    poolConfig.stream = tunnel.streamFactory;
  }

  // Create a temporary single-use pool to test parameters
  const testPool = new Pool(poolConfig);

  try {
    const client = await testPool.connect();
    await client.query('SELECT 1;');
    client.release();
    res.json({ success: true, message: usesTunnel ? 'SSH tunnel and database connection verified successfully!' : 'Connection verified successfully!' });
  } catch (error) {
    console.error('Connection test failed:', error.message);
    // If the SSH tunnel itself couldn't be established, surface that distinctly
    // from a database-level failure (wrong password, DB down, etc.).
    const message = /SSH (connection|tunnel)/i.test(error.message)
      ? error.message
      : `Connection failed: ${error.message}`;
    res.status(400).json({ error: message });
  } finally {
    await testPool.end().catch(() => {});
    if (tunnel) tunnel.cleanup();
  }
});

// POST /api/connections — save a new connection
router.post('/', async (req, res) => {
  const {
    label, host, port, dbUser, dbPassword, databaseName, sslRejectUnauthorized,
    bastionHost, bastionPort, bastionUser, bastionPassword
  } = req.body;

  if (!label || !host || !dbUser || !dbPassword || !databaseName) {
    return res.status(400).json({ error: 'label, host, dbUser, dbPassword, and databaseName are required' });
  }
  if (bastionHost && (!bastionUser || !bastionPassword)) {
    return res.status(400).json({ error: 'bastionUser and bastionPassword are required when bastionHost is set' });
  }

  try {
    const encryptedPassword = encrypt(dbPassword);
    const encryptedBastionPassword = bastionPassword ? encrypt(bastionPassword) : null;
    const { rows } = await getAppPool().query(
      `INSERT INTO user_connections
        (user_id, label, host, port, db_user, db_password_encrypted, database_name, ssl_reject_unauthorized,
         bastion_host, bastion_port, bastion_user, bastion_password_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, label, host, port, db_user, database_name, ssl_reject_unauthorized,
                 bastion_host, bastion_port, bastion_user, created_at;`,
      [
        req.user.id,
        label,
        host,
        Number(port) || 5432,
        dbUser,
        encryptedPassword,
        databaseName,
        !!sslRejectUnauthorized,
        bastionHost || null,
        bastionHost ? (Number(bastionPort) || 22) : null,
        bastionUser || null,
        encryptedBastionPassword
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
  const {
    label, host, port, dbUser, dbPassword, databaseName, sslRejectUnauthorized,
    bastionHost, bastionPort, bastionUser, bastionPassword
  } = req.body;

  if (!label || !host || !dbUser || !databaseName) {
    return res.status(400).json({ error: 'label, host, dbUser, and databaseName are required' });
  }

  const setDbPassword = !!(dbPassword && dbPassword.trim() !== '');
  const setBastionPassword = !!(bastionPassword && bastionPassword.trim() !== '');

  // host/port/user fields always update directly; passwords only update if a
  // non-blank value was supplied, so leaving a password field blank keeps
  // whatever's already encrypted and stored (same rule as the DB password
  // already followed before bastion support was added).
  const fields = [
    'label = $1', 'host = $2', 'port = $3', 'db_user = $4', 'database_name = $5',
    'ssl_reject_unauthorized = $6', 'bastion_host = $7', 'bastion_port = $8', 'bastion_user = $9'
  ];
  const params = [
    label,
    host,
    Number(port) || 5432,
    dbUser,
    databaseName,
    !!sslRejectUnauthorized,
    bastionHost || null,
    bastionHost ? (Number(bastionPort) || 22) : null,
    bastionUser || null
  ];

  if (setDbPassword) {
    fields.push(`db_password_encrypted = $${params.length + 1}`);
    params.push(encrypt(dbPassword));
  }

  if (setBastionPassword) {
    fields.push(`bastion_password_encrypted = $${params.length + 1}`);
    params.push(encrypt(bastionPassword));
  } else if (!bastionHost) {
    // Bastion was removed entirely on this edit — clear any stored password
    // for it too, rather than leaving an orphaned encrypted value behind.
    fields.push(`bastion_password_encrypted = $${params.length + 1}`);
    params.push(null);
  }

  params.push(id, req.user.id);
  const idParamIndex = params.length - 1;
  const userIdParamIndex = params.length;

  const queryText = `
    UPDATE user_connections
    SET ${fields.join(', ')}
    WHERE id = $${idParamIndex} AND user_id = $${userIdParamIndex}
    RETURNING id, label, host, port, db_user, database_name, ssl_reject_unauthorized,
              bastion_host, bastion_port, bastion_user, created_at;
  `;

  try {
    const { rows, rowCount } = await getAppPool().query(queryText, params);
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