const express = require('express');
const jwt = require('jsonwebtoken');
const { readDatabase, writeDatabase } = require('../utils/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

router.post('/add', (req, res) => {
    const authHeader = req.headers.authorization;
    const song = req.body;
    if (!authHeader) return res.status(401).json({ success: false, message: 'No authorization header' });
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = readDatabase();
        if (!db.library[decoded.id]) {
            db.library[decoded.id] = [];
        }
        
        // Check if the song exists by comparing unique properties
        const exists = db.library[decoded.id].some(savedSong => savedSong.title === song.title && savedSong.artist === song.artist);
        if (exists) {
            return res.status(400).json({ success: false, message: 'Song already in library' });
        }
        
        song.id = Date.now().toString();
        db.library[decoded.id].push(song);
        writeDatabase(db);
        res.json({ success: true, message: 'Added to library' });
    } catch (e) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

router.post('/remove', (req, res) => {
    const authHeader = req.headers.authorization;
    const { songId } = req.body;
    if (!authHeader) return res.status(401).json({ success: false, message: 'No authorization header' });
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = readDatabase();
        if (db.library[decoded.id]) {
            db.library[decoded.id] = db.library[decoded.id].filter(song => song.id !== songId);
            writeDatabase(db);
        }
        res.json({ success: true, message: 'Removed from library' });
    } catch (e) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

router.get('/', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: 'No authorization header' });
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = readDatabase();
        const userLibrary = db.library[decoded.id] || [];
        res.json({ success: true, library: userLibrary });
    } catch (e) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

module.exports = router;
