const { getAppPool } = require('../config/db');

// Middleware 1: Identify the user by device ID (no password, no session cookie).
// The frontend generates a random UUID once and sends it as X-Device-Id on
// every request. First time we see a device ID, we create a user row for it;
// every time after that, we just look it up. New devices default to 'Editor'.
const requireAuth = async (req, res, next) => {
    const deviceId = req.headers['x-device-id'];
    if (!deviceId) return res.status(401).json({ error: 'Unauthorized: No device ID provided' });

    try {
        const existing = await getAppPool().query(
            'SELECT id, device_id, role FROM app_users WHERE device_id = $1',
            [deviceId]
        );

        let user;
        if (existing.rows.length > 0) {
            user = existing.rows[0];
        } else {
            const inserted = await getAppPool().query(
                `INSERT INTO app_users (device_id, role) VALUES ($1, 'Editor') RETURNING id, device_id, role;`,
                [deviceId]
            );
            user = inserted.rows[0];
        }

        req.user = user; // { id, device_id, role }
        next();
    } catch (err) {
        console.error('Auth lookup failed:', err.message);
        res.status(500).json({ error: 'Unauthorized: Could not verify device' });
    }
};

// Middleware 2: Role-based SQL Enforcer
const enforceSqlRoles = (req, res, next) => {
    if (req.user.role === 'Admin') return next(); // Admin can run anything

    const sql = req.body?.sql || req.query.sql;
    if (!sql) return next();

    // Extract the first word of the query (e.g., SELECT, INSERT, WITH, EXPLAIN)
    const match = sql.trim().match(/^[a-z]+/i);
    if (!match) return res.status(400).json({ error: 'Invalid SQL structure' });

    const command = match[0].toUpperCase();

    // Viewer permissions
    const viewerAllowed = ['SELECT', 'EXPLAIN', 'WITH', 'SHOW'];
    if (req.user.role === 'Viewer' && !viewerAllowed.includes(command)) {
        return res.status(403).json({ error: 'Permission Denied: Viewers can only execute SELECT queries.' });
    }

    // Editor permissions
    const editorAllowed = [...viewerAllowed, 'INSERT', 'UPDATE', 'DELETE'];
    if (req.user.role === 'Editor' && !editorAllowed.includes(command)) {
        return res.status(403).json({ error: 'Permission Denied: Editors cannot execute DDL/Admin commands.' });
    }

    next();
};

module.exports = { requireAuth, enforceSqlRoles };
