const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

// We will import our routes here shortly
const databaseRoutes = require('./routes/databaseRoutes');
app.use('/api/database', databaseRoutes);

// Start 
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});