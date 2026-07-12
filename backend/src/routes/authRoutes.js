const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { defaultPool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_dev_key';

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await defaultPool().query('SELECT * FROM app_users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });

        // Frontend (Vercel) and backend (Render) live on different domains,
        // so the cookie must be sameSite: 'none' to be sent cross-site — and
        // 'none' requires secure: true (Render gives you HTTPS by default).
        // In local dev (NODE_ENV !== 'production') we fall back to 'lax' since
        // 'none' without HTTPS gets rejected by browsers on http://localhost.
        const isProd = process.env.NODE_ENV === 'production';
        res.cookie('token', token, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax',
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });

        res.json({ message: 'Logged in successfully', user: { id: user.id, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/auth/me (Check active session)
router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
});

module.exports = router;