const express = require('express');
const cors = require('cors');
require('dotenv').config();

// 1. Import Routes & Middleware
const databaseRoutes = require('./routes/databaseRoutes');
const authRoutes = require('./routes/authRoutes');
const connectionRoutes = require('./routes/connectionRoutes');
const { requireAuth } = require('./middleware/auth');

// 2. Initialize 'app'
const app = express();
const PORT = process.env.PORT || 5000;

// 3. Setup Global Middleware
// CORS_ORIGIN must be set in production (e.g. your Vercel URL). Falling back
// to localhost keeps local dev working without code changes.
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());

// 4. Register Routes
// Health check for Render's readiness/liveness probes — no auth required.
app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/database', requireAuth, databaseRoutes);
app.use('/api/connections', connectionRoutes);

// 5. Start the Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 

