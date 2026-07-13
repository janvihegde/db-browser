const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/auth/me — identifies (and auto-creates) the user from the
// X-Device-Id header. No password, no session cookie: the device ID itself
// is the identity. requireAuth does the lookup/creation and sets req.user.
router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;