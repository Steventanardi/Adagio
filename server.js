const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { Server } = require('socket.io');
const { warmupModel } = require('./src/services/ai');

// Function to get local IP
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}


// Load environment variables
if (fs.existsSync(path.join(__dirname, 'secret.env'))) {
    require('dotenv').config({ path: path.join(__dirname, 'secret.env') });
} else {
    require('dotenv').config();
}

if (!process.env.JWT_SECRET) {
    console.error('🚨 FATAL ERROR: JWT_SECRET environment variable is missing.');
    process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

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

app.get('/api/host-ip', (req, res) => {
    res.json({ ip: getLocalIp(), port: PORT });
});


// Socket.io Karaoke Logic
io.on('connection', (socket) => {
    console.log('📱 New connection:', socket.id);

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`🏠 Socket ${socket.id} joined room: ${roomId}`);
    });

    socket.on('sync-lyrics', ({ roomId, data }) => {
        socket.to(roomId).emit('lyrics-update', data);
    });

    socket.on('audio-stream', ({ roomId, audioData }) => {
        // Forward audio data from phone to main app
        socket.to(roomId).emit('remote-audio', audioData);
    });

    socket.on('disconnect', () => {
        console.log('❌ Disconnected:', socket.id);
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Start Server
server.listen(PORT, async () => {
    console.log(`🚀 Adagio running on http://localhost:${PORT}`);
    await warmupModel();
});

module.exports = app;

