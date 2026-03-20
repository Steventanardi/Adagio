const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// Setup FFmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

const { fetchYouTubeVideoUrl } = require('../services/youtube');
const { callAI, parseAIResponse } = require('../services/ai');
const { verifySongWithSpotify } = require('../services/spotify');
const { identifySong } = require('../services/recognition');

const router = express.Router();

// Setup Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const handleAudioRecognition = async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    const filePath = req.file.path;
    const trimmedPath = path.join(__dirname, '../../uploads', `trimmed-${Date.now()}.mp3`);

    console.log(`🎧 Received: ${req.file.originalname} (${req.file.size} bytes)`);

    ffmpeg(filePath)
        .inputOptions(['-fflags', '+genpts']) // Generate missing presentation timestamps
        .toFormat('mp3')
        .audioBitrate(192)
        .audioChannels(1)
        .output(trimmedPath)
        .on('start', (cmd) => console.log(`🎬 FFmpeg: ${cmd}`))
        .on('end', async () => {
            // Check duration with ffprobe
            ffmpeg.ffprobe(trimmedPath, async (err, metadata) => {
                const duration = metadata?.format?.duration || 0;
                console.log(`✅ Conversion complete. Duration: ${duration}s`);

                if (duration < 2) {
                    console.error("❌ Audio too short for recognition.");
                    res.json({ success: false, message: "Recording was too short. Please try again!" });
                    return;
                }

                try {
                    const result = await identifySong(trimmedPath);
                    res.json(result);
                } catch (err) {
                    console.error("❌ Recognition error:", err);
                    res.status(500).json({ success: false, message: "Internal recognition error" });
                } finally {
                    if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (e) { }
                    // Store last audio for debug before deleting
                    fs.copyFileSync(trimmedPath, path.join(__dirname, '../../uploads', 'last-debug.mp3'));
                    if (fs.existsSync(trimmedPath)) try { fs.unlinkSync(trimmedPath); } catch (e) { }
                }
            });
        })
        .on('error', (err) => {
            console.error('❌ FFmpeg Processing Error:', err.message);
            res.status(500).json({ success: false, message: "Audio processing failed" });
            if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (e) { }
        })
        .run();
};

router.post('/upload', upload.single('musicFile'), handleAudioRecognition);
router.post('/upload-mic-audio', upload.single('musicFile'), handleAudioRecognition);
router.post('/recognize-indevice-audio', upload.single('musicFile'), handleAudioRecognition);

// Debug endpoint to hear what the server heard
router.get('/api/debug/last-audio', (req, res) => {
    const debugPath = path.join(__dirname, '../../uploads', 'last-debug.mp3');
    if (fs.existsSync(debugPath)) {
        res.download(debugPath);
    } else {
        res.status(404).send("No debug audio available.");
    }
});

// YouTube Video Helper Endpoint
router.get('/api/youtube-video', async (req, res) => {
    const { title, artist } = req.query;
    if (!title || !artist) return res.status(400).json({ success: false, message: 'Missing title or artist' });
    try {
        const videoUrl = await fetchYouTubeVideoUrl(artist, title);
        res.json({ success: !!videoUrl, videoUrl });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/api/deep-lyrics', async (req, res) => {
    const { text, artist, title } = req.body;
    if (!text) return res.status(400).json({ success: false });
    try {
        const systemPrompt = 'Music critic. Explain deeper meaning in under 40 words. Be direct, no preamble.';
        const truncatedText = text.substring(0, 300); // only send a snippet
        const userPrompt = `"${title}" by "${artist}": "${truncatedText}"`;
        const aiText = await callAI(systemPrompt, userPrompt, 0.7, 120, 'Deep Lyrics');
        res.json({ success: true, explanation: aiText });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/intelligent-search', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ success: false });
    try {
        const systemPrompt = 'Reply ONLY with a JSON array of 8 objects. Example: [{"title":"Blinding Lights","artist":"The Weeknd"}]. CRITICAL RULES: 1. Provide ACTUAL real-world artists. 2. NEVER include the artist name inside the title field (e.g., wrong: "The Weeknd - Starboy"). 3. Suggest only massive global hits. No explanations.';
        const aiText = await callAI(systemPrompt, query.substring(0, 200), 0.7, 200, 'Intelligent Search');
        
        const rawSongs = parseAIResponse(aiText) || [];
        const verifiedSongs = [];
        
        // Run AI output through Spotify to guarantee they refer to real songs
        for (const s of rawSongs) {
            if (s.title && s.artist) {
                const verified = await verifySongWithSpotify(s.artist, s.title);
                if (verified) verifiedSongs.push(verified);
            }
        }
        
        res.json({ success: true, songs: verifiedSongs.length > 0 ? verifiedSongs : rawSongs });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/api/recommendations', async (req, res) => {
    const { artist, title } = req.body;
    if (!artist || !title) return res.status(400).json({ success: false });
    try {
        const systemPrompt = 'Reply ONLY with a JSON array of 8 objects. Example: [{"title":"Blinding Lights","artist":"The Weeknd"}]. CRITICAL RULES: 1. Provide ACTUAL real-world artists. 2. NEVER include the artist name inside the title field (e.g., wrong: "The Weeknd - Starboy"). 3. Suggest only massive global hits. No explanations.';
        const userPrompt = `Songs similar to "${title}" by "${artist}"`;
        const aiText = await callAI(systemPrompt, userPrompt, 0.7, 200, 'Recommendations');
        const rawSongs = parseAIResponse(aiText) || [];
        
        const verifiedSongs = [];
        // Run AI output through Spotify to guarantee they refer to real songs
        for (const s of rawSongs) {
            if (s.title && s.artist) {
                const verified = await verifySongWithSpotify(s.artist, s.title);
                if (verified) verifiedSongs.push(verified);
            }
        }
        
        res.json({ success: true, recommendations: verifiedSongs.length > 0 ? verifiedSongs : rawSongs });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/api/mood', async (req, res) => {
    const { artist, title, lyrics } = req.body;
    try {
        const systemPrompt = 'Reply ONLY with JSON: {"mood":"word","color1":"#hex","color2":"#hex"}. Dark colors only.';
        const userPrompt = lyrics
            ? `Mood of: ${lyrics.substring(0, 200)}`
            : `Mood of "${title}" by "${artist}"`;
        const aiText = await callAI(systemPrompt, userPrompt, 0.5, 80, 'Mood Analysis');
        const mood = parseAIResponse(aiText) || { mood: 'Neutral', color1: '#1e1e2f', color2: '#2a2a40' };
        res.json({ success: true, ...mood });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
