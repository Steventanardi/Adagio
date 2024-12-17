const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AcrCloud = require('acrcloud');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const mysql = require('mysql');
const FormData = require('form-data');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your_jwt_secret_key';

// Set up AcrCloud config
const acr = new AcrCloud({
    host: 'identify-ap-southeast-1.acrcloud.com', 
    access_key: '[ACR_KEY_LEAKED]',
    access_secret: '[ACR_SECRET_LEAKED]'
});

// Set up AudD 
const AUDD_API_KEY = process.env.AUDD_API_KEY;

// Spotify API credentials
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Genius API setup
const GENIUS_API_KEY = 'gJSMSZpK06fIm8g-pjIoDieHcWL85vzqcGf6P2EAiEdDjDBrSGuwaHkJf0t20aDK';

// YouTube API Key
const YOUTUBE_API_KEY = '[GOOGLE_YOUTUBE_LEAKED]';

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Function to get Spotify access token
async function getSpotifyAccessToken() {
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
    return response.data.access_token;
}

// Function to search for a song on YouTube and get a video URL
async function fetchYouTubeVideoUrl(artist, title) {
    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'snippet',
                q: `${artist} ${title}`,
                type: 'video',
                maxResults: 1,
                key: YOUTUBE_API_KEY,
            },
        });

        if (response.data.items.length > 0) {
            const videoId = response.data.items[0].id.videoId;
            return `https://www.youtube.com/embed/${videoId}`; // Embed URL
        }
    } catch (error) {
        console.error('YouTube API error:', error);
    }
    return null; // Return null if no video is found
}

// Lyrics Retrieval Function with Scraping
async function fetchLyrics(artist, title) {
    try {
        const lyricsOvhResponse = await axios.get(`https://api.lyrics.ovh/v1/${artist}/${title}`);
        if (lyricsOvhResponse.data.lyrics) {
            return lyricsOvhResponse.data.lyrics.replace(/\n{2,}/g, '\n\n');
        } else {
            console.error('No lyrics found:', lyricsOvhResponse.data);
            return 'Lyrics not available';
        }
    } catch (err) {
        console.error('lyrics.ovh API error:', err.response ? err.response.data : err.message);
    }

    // If lyrics.ovh fails, fall back to Genius
    try {
        const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(artist + ' ' + title)}`;
        const geniusResponse = await axios.get(searchUrl, {
            headers: { Authorization: `Bearer ${GENIUS_API_KEY}` }
        });

        if (geniusResponse.data.response.hits.length > 0) {
            const songPath = geniusResponse.data.response.hits[0].result.path;
            const songUrl = `https://genius.com${songPath}`;

            // Scrape the lyrics from the song page
            const pageResponse = await axios.get(songUrl);
            const $ = cheerio.load(pageResponse.data);
            let lyrics = $('.lyrics').text().trim() || $('[data-lyrics-container]').text().trim();

            if (lyrics) {
                lyrics = lyrics.replace(/\n{2,}/g, '\n\n');
                return lyrics;
            }
        }
    } catch (err) {
        console.error('Genius API or scraping error:', err);
    }

    return 'Lyrics not found';
}


// Serve static files
app.use(express.static('public'));

// Attempt to recognize a song with AudD first, then fall back to AcrCloud if needed
async function identifySong(filePath) {
    try {
        const formData = new FormData();
        formData.append('api_token', AUDD_API_KEY);
        formData.append('file', fs.createReadStream(filePath));

        const auddResponse = await axios.post('https://api.audd.io/', formData, {
            headers: formData.getHeaders(),
        });

        if (auddResponse.data && auddResponse.data.result) {
            return {
                success: true,
                service: 'AudD',
                metadata: auddResponse.data.result,
            };
        }
    } catch (error) {
        console.error('AudD error:', error);
    }
    return { success: false, message: 'AudD API error' };
}



// File upload and song recognition
app.post('/upload', upload.single('musicFile'), async (req, res) => {
    if (req.file) {
        const filePath = req.file.path;

        // Trim audio to 20 seconds
        const trimmedPath = `uploads/trimmed-${Date.now()}.mp3`;
        ffmpeg(filePath)
            .setStartTime(0)
            .setDuration(20)
            .output(trimmedPath)
            .on('end', async () => {
                const result = await identifySong(trimmedPath);

                if (result.success) {
                    const metadata = result.metadata;
                    const title = metadata.title;
                    const artist = metadata.artists ? metadata.artists[0].name : metadata.artist;
                    const album = metadata.album || 'Unknown';
                    const genre = metadata.genres ? metadata.genres[0].name : 'Unknown';

// Fetch lyrics and YouTube video URL
const lyrics = await fetchLyrics(artist, title);
const videoUrl = await fetchYouTubeVideoUrl(artist, title);
const similarSongs = await fetchRecommendedSongs(artist, title);

console.log("YouTube Video URL:", videoUrl); // Log the video URL for debugging

res.json({
    success: true,
    title,
    artist,
    album,
    genre,
    lyrics,
    videoUrl, // Add YouTube video URL to response
    similarSongs,
});

                } else {
                    res.json({ success: false, message: 'Song could not be identified.' });
                }

                fs.unlink(trimmedPath, (err) => {
                    if (err) console.error('Error removing trimmed file:', err);
                });
            })
            .on('error', (err) => {
                console.error('Error trimming audio:', err);
                res.status(500).json({ success: false, error: 'Error processing the audio file' });
            })
            .run();
    } else {
        res.status(400).json({ success: false, error: 'No file uploaded' });
    }
});

// Function to fetch recommended songs from Spotify
async function fetchRecommendedSongs(artist, title) {
    try {
        const token = await getSpotifyAccessToken();
        
        // Search for the track on Spotify
        const searchResponse = await axios.get(`https://api.spotify.com/v1/search`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { q: `track:${title} artist:${artist}`, type: 'track', limit: 1 },
        });

        if (searchResponse.data.tracks.items.length > 0) {
            const trackId = searchResponse.data.tracks.items[0].id;
            console.log("Track ID:", trackId); // Log the track ID for debugging

            // Get recommendations based on the track ID
            const recommendationResponse = await axios.get(`https://api.spotify.com/v1/recommendations`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { seed_tracks: trackId, limit: 5 },
            });

            const similarSongs = recommendationResponse.data.tracks.map(track => ({
                title: track.name,
                artist: track.artists[0].name,
                previewUrl: track.preview_url, // 30-second preview, if available
            }));
            console.log("Similar Songs:", similarSongs); // Log similar songs for debugging

            return similarSongs;
        } else {
            console.log("No track found for:", title, artist);
        }
    } catch (error) {
        console.error('Spotify API error:', error);
    }
    return [];
}


// Update song identification route to include similar songs
app.post('/upload', upload.single('musicFile'), async (req, res) => {
    if (req.file) {
        const filePath = req.file.path;

        ffmpeg(filePath)
            .setStartTime(0)
            .setDuration(20)
            .output(`uploads/trimmed-${Date.now()}.mp3`)
            .on('end', async () => {
                const result = await identifySong(trimmedPath);

                if (result.success) {
                    const metadata = result.metadata;
                    const title = metadata.title;
                    const artist = metadata.artists ? metadata.artists[0].name : metadata.artist;

                    // Fetch similar songs
                    const similarSongs = await fetchRecommendedSongs(artist, title);

                    res.json({
                        success: true,
                        title,
                        artist,
                        similarSongs, // Add similar songs to response
                    });
                } else {
                    res.json({ success: false, message: 'Song could not be identified.' });
                }
            })
            .run();
    } else {
        res.status(400).json({ success: false, error: 'No file uploaded' });
    }
});

// MySQL Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'adagio'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL Database');
});

// Middleware
app.use(express.json());

// Registration Endpoint
app.post('/signup', async (req, res) => {
    const { email, password, full_name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query('INSERT INTO users (email, password, full_name) VALUES (?, ?, ?)', [email, hashedPassword, full_name], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'User already exists' });
            return res.status(500).json({ message: 'Server error' });
        }
        res.status(201).json({ message: 'User registered successfully' });
    });
});

// Login Endpoint
app.post('/signin', (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err || results.length === 0) return res.status(400).json({ message: 'Invalid credentials' });

        const user = results[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) return res.status(400).json({ message: 'Invalid credentials' });

        // Generate JWT Token
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login successful', token });
    });
});

// Protected Route Example (optional)
app.get('/protected', (req, res) => {
    const token = req.headers.authorization.split(' ')[1];

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Access denied' });
        res.json({ message: 'Protected content accessed', user });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
