const express = require('express');
const fs = require('fs');
const path = require('path');
const { warmupModel } = require('./src/services/ai');

// Load environment variables
if (fs.existsSync('secret.env')) {
    require('dotenv').config({ path: 'secret.env' });
} else {
    require('dotenv').config();
}

console.log(`🔑 JWT Secret: ${process.env.JWT_SECRET ? 'Loaded from secret.env' : 'Using default fallback (Warning!)'}`);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('Public'));

// Import Routes
const authRoutes = require('./src/routes/auth');
const libraryRoutes = require('./src/routes/library');
const musicRoutes = require('./src/routes/music');

// Mount Routes
app.use('/', authRoutes);
app.use('/api/library', libraryRoutes);
app.use('/', musicRoutes);

// Start Server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    await warmupModel();
});

module.exports = app;
