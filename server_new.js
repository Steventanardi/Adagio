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
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const DB_PATH = path.join(__dirname, 'data', 'users.json');
const DEFAULT_MODEL = 'gpt-4o';

// Initialize OpenAI API
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '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'
});

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
app.use(express.static('public'));

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

// Helper: YouTube Search
async function fetchYouTubeVideoUrl(artist, title) {
    if (!YOUTUBE_API_KEY) return null;
    const searchQuery = encodeURIComponent(`${artist} ${title} official music video`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&key=${YOUTUBE_API_KEY}&type=video&maxResults=1`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            return `https://www.youtube.com/watch?v=${data.items[0].id.videoId}`;
        }
    } catch (error) {
        console.error("❌ YouTube fetch error:", error);
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
        const response = await fetch(url, { headers: { Authorization: `Bearer ${GENIUS_API_KEY}` } });
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

        const html = await fetch(bestMatch.url).then(res => res.text());
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
    // 1. AudD
    try {
        const formData = new FormData();
        formData.append('api_token', AUDD_API_KEY || '[AUDD_LEAKED]');
        formData.append('file', fs.createReadStream(filePath));
        const auddResponse = await axios.post('https://api.audd.io/', formData, { headers: formData.getHeaders() });
        const result = auddResponse.data.result;
        if (result) {
            return {
                success: true,
                metadata: {
                    title: result.title,
                    artist: result.artist,
                    album: result.album || '',
                    release_date: result.release_date || '',
                    label: result.label || '',
                    song_link: result.song_link || '',
                    lyrics: await fetchLyrics(result.artist, result.title),
                    videoUrl: await fetchYouTubeVideoUrl(result.artist, result.title)
                }
            };
        }
    } catch (e) {
        console.error('AudD error:', e.message);
    }

    // 2. ACRCloud Fallback
    try {
        const audioBuffer = fs.readFileSync(filePath);
        const acrResult = await new Promise((resolve, reject) => {
            acrClient.identify(audioBuffer, (err, result) => {
                if (err) return reject(err);
                resolve(typeof result === 'string' ? JSON.parse(result) : result);
            });
        });
        if (acrResult?.metadata?.music?.length > 0) {
            const song = acrResult.metadata.music[0];
            const title = song.title;
            const artist = song.artists[0].name;
            return {
                success: true,
                metadata: {
                    title,
                    artist,
                    album: song.album?.name || '',
                    release_date: song.release_date || '',
                    label: song.label || '',
                    song_link: '',
                    lyrics: await fetchLyrics(artist, title),
                    videoUrl: await fetchYouTubeVideoUrl(artist, title)
                }
            };
        }
    } catch (e) {
        console.error('ACRCloud error:', e.message);
    }
    return { success: false, message: 'Unable to identify the song.' };
}

// Routes
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
    if (!authHeader) return res.status(401).json({ success: false });
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
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

const handleAudioRecognition = async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const filePath = req.file.path;
    const trimmedPath = path.join('uploads', `trimmed-${Date.now()}.mp3`);
    ffmpeg(filePath)
        .toFormat('mp3')
        .audioBitrate(128)
        .audioFilters("volume=2.0")
        .output(trimmedPath)
        .on('end', async () => {
            try {
                const result = await identifySong(trimmedPath);
                fs.unlinkSync(filePath);
                if (fs.existsSync(trimmedPath)) fs.unlinkSync(trimmedPath);
                res.json(result);
            } catch (err) {
                console.error("Recognition error:", err);
                res.status(500).json({ success: false });
            }
        })
        .on('error', (err) => {
            console.error('FFmpeg Error:', err);
            res.status(500).json({ success: false });
        })
        .run();
};

app.post('/upload', upload.single('musicFile'), handleAudioRecognition);
app.post('/upload-mic-audio', upload.single('musicFile'), handleAudioRecognition);
app.post('/recognize-indevice-audio', upload.single('musicFile'), handleAudioRecognition);

app.post('/api/deep-lyrics', async (req, res) => {
    const { text, artist, title } = req.body;
    if (!text) return res.status(400).json({ success: false });
    try {
        const chatResponse = await openai.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: [
                { role: 'system', content: 'You are a savvy music critic. Explain the deeper meaning of these lyrics concisely (under 50 words).' },
                { role: 'user', content: `Explain these lyrics from "${title}" by "${artist}": "${text}"` }
            ],
            temperature: 0.8
        });
        res.json({ success: true, explanation: chatResponse.choices[0].message.content.trim() });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/intelligent-search', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ success: false });
    try {
        const chatResponse = await openai.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: [
                { role: 'system', content: 'Respond ONLY with a JSON array of up to 5 song objects with "title" and "artist".' },
                { role: 'user', content: query }
            ],
            temperature: 0.9
        });
        const songs = parseAIResponse(chatResponse.choices[0].message.content) || [];
        res.json({ success: true, songs });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/recommendations', async (req, res) => {
    const { artist, title } = req.body;
    if (!artist || !title) return res.status(400).json({ success: false });
    try {
        const chatResponse = await openai.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: [
                { role: 'system', content: 'Respond ONLY with a JSON array of 5 similar songs (title and artist).' },
                { role: 'user', content: `Similar to "${title}" by "${artist}"` }
            ]
        });
        const suggested = parseAIResponse(chatResponse.choices[0].message.content) || [];
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

app.post('/api/analyze-mood', async (req, res) => {
    const { artist, title, lyrics } = req.body;
    try {
        const response = await openai.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: [
                { role: 'system', content: 'Respond ONLY with a JSON object: {"mood": string, "color1": hex, "color2": hex}. Use dark colors.' },
                { role: 'user', content: lyrics ? `Analyze mood: ${lyrics.substring(0, 500)}` : `Analyze mood of "${title}" by "${artist}"` }
            ]
        });
        const mood = parseAIResponse(response.choices[0].message.content) || { mood: 'Neutral', color1: '#1e1e2f', color2: '#2a2a40' };
        res.json({ success: true, ...mood });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});
