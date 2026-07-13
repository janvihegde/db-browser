const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getAppPool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_dev_key';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shared between login and signup — both end in "set a session cookie".
function setSessionCookie(res, user) {
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
}

// POST /api/auth/signup — new users default to the 'Editor' role.
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await getAppPool().query('SELECT id FROM app_users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await getAppPool().query(
      `INSERT INTO app_users (email, password_hash, role) VALUES ($1, $2, 'Editor') RETURNING id, email, role;`,
      [email, passwordHash]
    );
    const user = result.rows[0];

    setSessionCookie(res, user);
    res.status(201).json({ message: 'Account created successfully', user });
  } catch (err) {
    console.error('Signup failed:', err.message);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await getAppPool().query('SELECT * FROM app_users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        setSessionCookie(res, user);
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
