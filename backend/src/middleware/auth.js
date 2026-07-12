const jwt = require('jsonwebtoken');

// Fail fast in production if a real secret isn't configured — silently
// falling back to a hardcoded value would let anyone forge valid tokens.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production. Generate one with: openssl rand -base64 32');
}

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_dev_key';

// Middleware 1: Verify JWT
const requireAuth = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, email, role }
        next();
    } catch (err) {
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

// Middleware 2: Role-based SQL Enforcer
const enforceSqlRoles = (req, res, next) => {
    if (req.user.role === 'Admin') return next(); // Admin can run anything

    const sql = req.body.sql || req.query.sql;
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