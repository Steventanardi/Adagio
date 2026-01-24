const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AcrCloud = require('acrcloud');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const FormData = require('form-data');
const cheerio = require('cheerio');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Load environment variables
if (fs.existsSync('secret.env')) {
    require('dotenv').config({ path: 'secret.env' });
} else {
    require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
console.log(`🔑 JWT Secret: ${process.env.JWT_SECRET ? 'Loaded from secret.env' : 'Using default fallback (Warning!)'}`);
const DB_PATH = path.join(__dirname, 'data', 'users.json');
const DEFAULT_MODEL = 'gpt-4o';

// Initialize OpenAI API (No hardcoded fallback as per user request)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
}) : null;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Set up AcrCloud config
const acrClient = new AcrCloud({
    host: process.env.ACR_HOST || 'identify-ap-southeast-1.acrcloud.com',
    access_key: process.env.ACR_ACCESS_KEY,
    access_secret: process.env.ACR_ACCESS_SECRET
});

const AUDD_API_KEY = process.env.AUDD_API_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const GENIUS_API_KEY = process.env.GENIUS_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Middleware
app.use(express.json());
app.use(express.static('Public'));

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Database Helpers
function readDatabase() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            const initialDB = { users: [], library: {} };
            fs.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2));
            return initialDB;
        }
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Error reading database:', e);
        return { users: [], library: {} };
    }
}

function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error writing database:', e);
    }
}

// Spotify Access Token Cache
let spotifyToken = null;
let spotifyTokenExpiry = 0;

async function getSpotifyAccessToken() {
    if (spotifyToken && Date.now() < spotifyTokenExpiry) {
        return spotifyToken;
    }
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        console.warn('⚠️ Spotify credentials missing.');
        return null;
    }
    try {
        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            new URLSearchParams({ grant_type: 'client_credentials' }),
            {
                headers: {
                    Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );
        spotifyToken = response.data.access_token;
        spotifyTokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
        console.log('✅ Spotify Access Token retrieved');
        return spotifyToken;
    } catch (error) {
        console.error('❌ Spotify Token Error:', error.response?.data || error.message);
        return null;
    }
}

// Helper: AI Response Parsing
function parseAIResponse(text) {
    try {
        const jsonStartIndex = text.indexOf('{');
        const arrayStartIndex = text.indexOf('[');
        let startIndex = -1;
        if (jsonStartIndex !== -1 && (arrayStartIndex === -1 || jsonStartIndex < arrayStartIndex)) {
            startIndex = jsonStartIndex;
        } else {
            startIndex = arrayStartIndex;
        }
        if (startIndex !== -1) {
            const lastChar = text.charAt(startIndex) === '{' ? '}' : ']';
            const endIndex = text.lastIndexOf(lastChar);
            if (endIndex !== -1) {
                const jsonStr = text.substring(startIndex, endIndex + 1);
                return JSON.parse(jsonStr);
            }
        }
    } catch (e) {
        console.error('Failed to parse AI response:', e);
    }
    return null;
}

// Helper: Universal AI Caller (Gemini -> OpenAI -> Local Fallback)
async function callAI(systemPrompt, userPrompt, temperature = 0.7) {
    console.log(`🤖 AI Call Requesting: ${userPrompt.substring(0, 50)}...`);

    // 1. Try Gemini
    if (process.env.GEMINI_API_KEY) {
        try {
            console.log("💎 Attempting Gemini...");
            const result = await geminiModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Request: ${userPrompt}` }] }],
                generationConfig: { temperature, maxOutputTokens: 1000 }
            });
            const response = await result.response;
            const text = response.text();
            if (text) return text;
        } catch (e) {
            console.warn("⚠️ Gemini failed:", e.message);
        }
    }

    // 2. Try OpenAI
    if (openai) {
        try {
            console.log("📡 Attempting OpenAI...");
            const chatResponse = await openai.chat.completions.create({
                model: DEFAULT_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: temperature
            });
            return chatResponse.choices[0].message.content.trim();
        } catch (e) {
            console.warn("⚠️ OpenAI failed:", e.message);
        }
    }

    // 4. Try Local LLM (LM Studio - Default Port 1234)
    try {
        console.log("🏠 Attempting LM Studio (1234)...");
        // Using fetch directly for LM Studio to avoid dependency on global 'openai' instance
        const response = await fetch('http://localhost:1234/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'loaded-model',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: temperature
            }),
            timeout: 10000
        });
        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (e) {
        console.warn("⚠️ LM Studio failed:", e.message);
    }

    throw new Error("All AI providers failed. Please check your API keys or ensure your local LLM (Ollama/LM Studio) is running.");
}

// Helper: YouTube Search
async function fetchYouTubeVideoUrl(artist, title) {
    if (!YOUTUBE_API_KEY) return null;
    const searchQuery = encodeURIComponent(`${artist} ${title} official music video`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&key=${YOUTUBE_API_KEY}&type=video&maxResults=1`;
    try {
        const response = await fetch(url, { timeout: 5000 });
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            return `https://www.youtube.com/watch?v=${data.items[0].id.videoId}`;
        }
    } catch (error) {
        console.error("❌ YouTube fetch error:", error.message);
    }
    return null;
}

// Helper: Genius Lyrics
async function fetchLyrics(artist, title) {
    if (!GENIUS_API_KEY) return null;
    const cleanArtist = artist.split('feat')[0].split('ft.')[0].trim();
    const cleanTitle = title.split('(')[0].split('-')[0].trim();
    const searchQuery = encodeURIComponent(`${cleanArtist} ${cleanTitle}`);
    const url = `https://api.genius.com/search?q=${searchQuery}`;
    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${GENIUS_API_KEY}` },
            timeout: 5000
        });
        const data = await response.json();
        if (!data.response?.hits?.length) return null;

        let bestMatch = null;
        const targetArtist = cleanArtist.toLowerCase().replace(/[^a-z0-9]/g, "");
        const targetTitle = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, "");

        for (const hit of data.response.hits) {
            const hitArtist = hit.result.primary_artist.name.toLowerCase().replace(/[^a-z0-9]/g, "");
            const hitTitle = hit.result.title.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (hitArtist.includes(targetArtist) || targetArtist.includes(hitArtist)) {
                if (hitTitle.includes(targetTitle) || targetTitle.includes(hitTitle)) {
                    bestMatch = hit.result;
                    break;
                }
            }
        }
        if (!bestMatch) return null;

        const html = await fetch(bestMatch.url, { timeout: 8000 }).then(res => res.text());
        const $ = cheerio.load(html);
        let lyrics = '';
        $('[data-lyrics-container]').each((_, el) => {
            lyrics += $(el).text().trim() + '\n\n';
        });
        if (!lyrics.trim()) {
            $('[class^="Lyrics__Container"]').each((_, el) => {
                lyrics += $(el).text().trim() + '\n\n';
            });
        }
        return lyrics.replace(/(\n\s*){3,}/g, '\n\n').trim() || null;
    } catch (err) {
        console.error("❌ Genius lyrics error:", err.message);
        return null;
    }
}

// Helper: Music Identification
async function identifySong(filePath) {
    console.log(`🔍 Identifying: ${path.basename(filePath)}`);

    // Check file exists and size
    if (!fs.existsSync(filePath)) {
        console.error("❌ Identification failed: File not found.");
        return { success: false, message: 'Audio file missing.' };
    }
    const stats = fs.statSync(filePath);
    console.log(`📊 File size: ${stats.size} bytes`);
    if (stats.size < 5000) {
        console.warn("⚠️ Audio file might be too small for recognition.");
    }

    const results = { audd: null, acr: null };

    // 1. AudD (Primary)
    try {
        const formData = new FormData();
        formData.append('api_token', AUDD_API_KEY || '[AUDD_LEAKED]');
        formData.append('file', fs.createReadStream(filePath));

        console.log("📡 AudD: Sending request...");
        const response = await axios.post('https://api.audd.io/', formData, {
            headers: formData.getHeaders(),
            timeout: 12000
        });

        console.log(`📥 AudD Status: ${response.data.status}`);
        if (response.data.result) {
            results.audd = response.data.result;
            console.log(`✅ AudD Match: ${results.audd.title} by ${results.audd.artist}`);
        } else if (response.data.error) {
            console.warn(`❌ AudD API Error: [${response.data.error.error_code}] ${response.data.error.error_message}`);
        } else {
            console.log("ℹ️ AudD: No match found.");
        }
    } catch (e) {
        console.warn(`⚠️ AudD request failed: ${e.message}`);
    }

    // 2. ACRCloud (Fallback)
    if (!results.audd) {
        try {
            console.log("📡 ACRCloud: Sending request...");
            const audioBuffer = fs.readFileSync(filePath);
            results.acr = await new Promise((resolve, reject) => {
                // Increased timeout to 15s
                const t = setTimeout(() => reject(new Error("ACRCloud timeout")), 15000);
                acrClient.identify(audioBuffer, (err, res) => {
                    clearTimeout(t);
                    if (err) return reject(err);
                    const parsed = typeof res === 'string' ? JSON.parse(res) : res;
                    console.log(`📥 ACRCloud Status: ${parsed?.status?.msg || 'OK'}`);
                    resolve(parsed?.metadata?.music?.[0] || null);
                });
            });
            if (results.acr) {
                console.log(`✅ ACRCloud Match: ${results.acr.title}`);
            } else {
                console.log("ℹ️ ACRCloud: No match found.");
            }
        } catch (e) {
            console.warn(`⚠️ ACRCloud identification failed: ${e.message}`);
        }
    }

    const match = results.audd || results.acr;
    if (match) {
        const title = match.title;
        const artist = results.audd ? match.artist : (match.artists?.[0]?.name || 'Unknown Artist');

        console.log(`✨ Final Match: ${artist} - ${title}. Fetching metadata...`);

        const [lyrics, videoUrl] = await Promise.allSettled([
            fetchLyrics(artist, title),
            fetchYouTubeVideoUrl(artist, title)
        ]);

        return {
            success: true,
            metadata: {
                title,
                artist,
                album: results.audd ? match.album : (match.album?.name || ''),
                release_date: match.release_date || '',
                label: match.label || '',
                song_link: results.audd ? (match.song_link || '') : '',
                lyrics: lyrics.status === 'fulfilled' ? lyrics.value : null,
                videoUrl: videoUrl.status === 'fulfilled' ? videoUrl.value : null
            }
        };
    }

    console.log("❌ Result: No matches found across all providers.");
    return { success: false, message: 'Unable to identify the song. Try a clearer or longer recording!' };
}

// Routes
app.post('/signup', async (req, res) => {
    const { full_name, email, password } = req.body;
    const db = readDatabase();
    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ message: 'User already exists.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = Date.now().toString();
    db.users.push({ id, full_name, email, password: hashedPassword });
    writeDatabase(db);
    res.json({ message: 'User registered successfully.' });
});

app.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    const db = readDatabase();
    const user = db.users.find(u => u.email === email);
    if (!user) return res.status(400).json({ message: 'Invalid credentials.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login successful', token });
});

app.post('/api/library/remove', (req, res) => {
    const authHeader = req.headers.authorization;
    const { songId } = req.body;
    if (!authHeader) return res.status(401).json({ success: false, message: 'No authorization header' });
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = readDatabase();
        if (db.library[decoded.id]) {
            delete db.library[decoded.id][songId];
            writeDatabase(db);
        }
        res.json({ success: true, message: 'Removed from library' });
    } catch (e) {
        console.error("❌ Library Remove Error:", e.message);
        res.status(401).json({ success: false, message: 'Session expired. Please sign in again.' });
    }
});

const handleAudioRecognition = async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    const filePath = req.file.path;
    const trimmedPath = path.join('uploads', `trimmed-${Date.now()}.mp3`);

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
                    fs.copyFileSync(trimmedPath, path.join('uploads', 'last-debug.mp3'));
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

app.post('/upload', upload.single('musicFile'), handleAudioRecognition);
app.post('/upload-mic-audio', upload.single('musicFile'), handleAudioRecognition);
app.post('/recognize-indevice-audio', upload.single('musicFile'), handleAudioRecognition);

// Debug endpoint to hear what the server heard
app.get('/api/debug/last-audio', (req, res) => {
    const debugPath = path.join(__dirname, 'uploads', 'last-debug.mp3');
    if (fs.existsSync(debugPath)) {
        res.download(debugPath);
    } else {
        res.status(404).send("No debug audio available.");
    }
});

// YouTube Video Helper Endpoint
app.get('/api/youtube-video', async (req, res) => {
    const { title, artist } = req.query;
    if (!title || !artist) return res.status(400).json({ success: false, message: 'Missing title or artist' });
    try {
        const videoUrl = await fetchYouTubeVideoUrl(artist, title);
        res.json({ success: !!videoUrl, videoUrl });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/deep-lyrics', async (req, res) => {
    const { text, artist, title } = req.body;
    if (!text) return res.status(400).json({ success: false });
    try {
        const systemPrompt = 'You are a savvy music critic. Explain the deeper meaning of these lyrics concisely (under 50 words).';
        const userPrompt = `Explain these lyrics from "${title}" by "${artist}": "${text}"`;
        const aiText = await callAI(systemPrompt, userPrompt, 0.8);
        res.json({ success: true, explanation: aiText });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/intelligent-search', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ success: false });
    try {
        const systemPrompt = 'Respond ONLY with a JSON array of up to 5 song objects with "title" and "artist".';
        const aiText = await callAI(systemPrompt, query, 0.9);
        const songs = parseAIResponse(aiText) || [];
        res.json({ success: true, songs });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/recommendations', async (req, res) => {
    const { artist, title } = req.body;
    if (!artist || !title) return res.status(400).json({ success: false });
    try {
        const systemPrompt = 'Respond ONLY with a JSON array of 5 similar songs (title and artist).';
        const userPrompt = `Similar to "${title}" by "${artist}"`;
        const aiText = await callAI(systemPrompt, userPrompt);
        const suggested = parseAIResponse(aiText) || [];
        const token = await getSpotifyAccessToken();
        const recommendations = await Promise.all(suggested.map(async s => {
            let spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(s.title + ' ' + s.artist)}`;
            if (token) {
                try {
                    const sres = await axios.get('https://api.spotify.com/v1/search', {
                        headers: { Authorization: `Bearer ${token}` },
                        params: { q: `track:"${s.title}" artist:"${s.artist}"`, type: 'track', limit: 1 }
                    });
                    if (sres.data.tracks.items[0]) spotifyUrl = sres.data.tracks.items[0].external_urls.spotify;
                } catch (e) { }
            }
            return { ...s, spotifyUrl };
        }));
        res.json({ success: true, recommendations });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/mood', async (req, res) => {
    const { artist, title, lyrics } = req.body;
    try {
        const systemPrompt = 'Respond ONLY with a JSON object: {"mood": string, "color1": hex, "color2": hex}. Use dark colors.';
        const userPrompt = lyrics ? `Analyze mood: ${lyrics.substring(0, 500)}` : `Analyze mood of "${title}" by "${artist}"`;
        const aiText = await callAI(systemPrompt, userPrompt);
        const mood = parseAIResponse(aiText) || { mood: 'Neutral', color1: '#1e1e2f', color2: '#2a2a40' };
        res.json({ success: true, ...mood });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/translate', async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false });
    try {
        const systemPrompt = 'Translate the following lyrics to English. Respond ONLY with the translated text.';
        const translatedText = await callAI(systemPrompt, text, 0.3);
        res.json({ success: true, translatedText });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/library', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: 'No authorization header' });
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = readDatabase();
        res.json({ success: true, library: db.library[decoded.id] || {} });
    } catch (e) {
        console.error("❌ Library Fetch Error:", e.message);
        res.status(401).json({ success: false, message: 'Session expired' });
    }
});

app.post('/api/library/add', (req, res) => {
    const authHeader = req.headers.authorization;
    const { songId, songData } = req.body;
    if (!authHeader || !songId || !songData) {
        return res.status(400).json({ success: false, message: 'Missing required data' });
    }
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = readDatabase();
        if (!db.library[decoded.id]) db.library[decoded.id] = {};
        db.library[decoded.id][songId] = songData;
        writeDatabase(db);
        res.json({ success: true, message: 'Added to library' });
    } catch (e) {
        console.error("❌ Library Add Error:", e.message);
        res.status(401).json({ success: false, message: 'Session expired' });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});
