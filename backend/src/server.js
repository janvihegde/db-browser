const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// 1. Import Routes & Middleware
const databaseRoutes = require('./routes/databaseRoutes');
const authRoutes = require('./routes/authRoutes');
const { requireAuth } = require('./middleware/auth');

// 2. Initialize 'app'
const app = express(); 
const PORT = process.env.PORT || 5000;

// 3. Setup Global Middleware (Must be BEFORE routes)
// IMPORTANT: CORS must be configured to allow credentials (cookies)
app.use(cors({
    origin: 'http://localhost:5173', // Your Vite frontend URL
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// 4. Register Routes
// Mount Auth routes (Unprotected - so users can actually log in)
app.use('/api/auth', authRoutes);

// Protect all database routes (Users MUST have a valid token to access anything here)
app.use('/api/database', requireAuth, databaseRoutes);

// 5. Start the Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});