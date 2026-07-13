const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// 1. Import Routes & Middleware
const databaseRoutes = require('./routes/databaseRoutes');
const authRoutes = require('./routes/authRoutes');
const connectionRoutes = require('./routes/connectionRoutes');
const { requireAuth } = require('./middleware/auth');



// 2. Initialize 'app'
const app = express(); 
const PORT = process.env.PORT || 5000;



// 2. Configure CORS
const corsOptions = {
  origin: 'https://db-browser-ous7jqsmz-janvi-s-projects7.vercel.app/', // <-- REPLACE THIS with your actual Vercel URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
};

app.use(cors(corsOptions)); // 3. Use the middleware
app.use(express.json());

// 4. Register Routes
// Health check for Render's readiness/liveness probes — no auth required.
app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));

// Fixed: Removed extra spaces in the path
app.use('/api/auth', authRoutes);

// Fixed: Uncommented this line so the backend actually handles your DB requests
app.use('/api/database', requireAuth, databaseRoutes);

// User-managed AWS RDS connection storage (each user's own DB credentials)
app.use('/api/connections', connectionRoutes);

// 5. Start the Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 

