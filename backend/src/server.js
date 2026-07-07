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

// 3. Setup Global Middleware
app.use(cors({
    origin: 'http://localhost:5173', 
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// 4. Register Routes
// Fixed: Removed extra spaces in the path
app.use('/api/auth', authRoutes);

// Fixed: Uncommented this line so the backend actually handles your DB requests
app.use('/api/database', requireAuth, databaseRoutes);

// 5. Start the Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 

