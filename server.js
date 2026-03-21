const express = require('express');
const fs = require('fs');
const path = require('path');
const { warmupModel } = require('./src/services/ai');

// Load environment variables
if (fs.existsSync(path.join(__dirname, 'secret.env'))) {
    require('dotenv').config({ path: path.join(__dirname, 'secret.env') });
} else {
    require('dotenv').config();
}

if (!process.env.JWT_SECRET) {
    console.error('🚨 FATAL ERROR: JWT_SECRET environment variable is missing.');
    console.error('Please define JWT_SECRET in your secret.env file before starting the server.');
    process.exit(1);
}
console.log('🔑 JWT Secret: Loaded securely from environment.');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Import Routes
const authRoutes = require('./src/routes/auth');
const libraryRoutes = require('./src/routes/library');
const musicRoutes = require('./src/routes/music');

// Mount Routes
app.use('/', authRoutes);
app.use('/api/library', libraryRoutes);
app.use('/', musicRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Start Server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    await warmupModel();
});

module.exports = app;
