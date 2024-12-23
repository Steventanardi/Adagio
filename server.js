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
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
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

// Set up AudD API Key
const AUDD_API_KEY = '[AUDD_LEAKED]';

// Spotify API credentials
const SPOTIFY_CLIENT_ID = '[SPOTIFY_ID_LEAKED]';
const SPOTIFY_CLIENT_SECRET = '[SPOTIFY_SECRET_LEAKED]';

// Genius API setup
const GENIUS_API_KEY = 'gJSMSZpK06fIm8g-pjIoDieHcWL85vzqcGf6P2EAiEdDjDBrSGuwaHkJf0t20aDK';

// YouTube API Key
const YOUTUBE_API_KEY = '[GOOGLE_YOUTUBE_LEAKED]';

// Middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize OpenAI API
const openai = new OpenAI({
    apiKey: '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', 
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
        console.log('Spotify Access Token:', response.data.access_token);
        return response.data.access_token;
    } catch (error) {
        console.error('Spotify Token Error:', error.response?.data || error.message);
        throw new Error('Failed to retrieve Spotify token');
    }
}


app.post('/fetch-spotify-link', async (req, res) => {
    const query = req.body.query;

    if (!query) {
        return res.status(400).json({ success: false, message: 'Query cannot be empty.' });
    }

    // Extract title and artist from the query
    const [title, artist] = query.split(' by ');

    if (!title || !artist) {
        return res.status(400).json({ success: false, message: 'Invalid query format.' });
    }

    try {
        const spotifyUrl = await fetchSpotifyTrack(artist.trim(), title.trim());
        if (spotifyUrl) {
            res.json({ success: true, spotifyUrl });
        } else {
            res.json({ success: false, message: 'No Spotify link found.' });
        }
    } catch (error) {
        console.error('Error in /fetch-spotify-link:', error.message);
        res.status(500).json({ success: false, message: error.message });

    }
});



// Function to fetch YouTube Video URL
async function fetchYouTubeVideoUrl(artist, title) {
    try {
        const query = `${artist} ${title} official music video`;
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'snippet',
                q: query,
                type: 'video',
                videoEmbeddable: true,
                maxResults: 1,
                key: YOUTUBE_API_KEY,
            },
        });

        if (response.data.items.length > 0) {
            const videoId = response.data.items[0].id.videoId;
            return `https://www.youtube.com/embed/${videoId}`;
        }
    } catch (error) {
        console.error('YouTube API error:', error.message);
    }
    return ''; // Return an empty string if no video is found
}


// Function to identify song via AudD
async function identifySong(filePath) {
    try {
        const formData = new FormData();
        formData.append('api_token', AUDD_API_KEY);
        formData.append('file', fs.createReadStream(filePath));

        const auddResponse = await axios.post('https://api.audd.io/', formData, {
            headers: formData.getHeaders(),
        });

        console.log("AudD Response:", auddResponse.data); // Log API response
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
    return { success: false, message: 'Unable to identify the song.' };
}


// File upload and song recognition
app.post('/upload', upload.single('musicFile'), async (req, res) => {
    if (req.file) {
        const filePath = req.file.path;
        const normalizedPath = filePath.replace(/\\/g, '/'); // Normalize Windows path
        const trimmedPath = `uploads/trimmed-${Date.now()}.mp3`;

        ffmpeg(normalizedPath) // Use normalizedPath here
            .setStartTime(0)
            .setDuration(5)
            .output(trimmedPath)
            .on('end', async () => {
                console.log('Audio trimmed successfully.');
                const result = await identifySong(trimmedPath);

                if (result.success) {
                    const metadata = result.metadata;
                    const title = metadata.title;
                    const artist = metadata.artist || 'Unknown Artist';
                    const lyrics = await fetchLyrics(artist, title);
                    const videoUrl = await fetchYouTubeVideoUrl(artist, title);

                    res.json({
                        success: true,
                        title,
                        artist,
                        lyrics,
                        videoUrl,
                    });
                } else {
                    res.json({ success: false, message: 'Unable to recognize the song.' });
                }

                fs.unlink(trimmedPath, () => {}); // Cleanup temporary files
            })
            .on('error', (err) => {
                console.error('Error trimming audio:', err.message);
                res.status(500).json({ success: false, error: 'Error processing the audio file' });
            })
            .run();
    } else {
        res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
});

// Intelligent Search Endpoint
app.post('/intelligent-search', async (req, res) => {
    const query = req.body.query; // Extract query from POST body

    if (!query) {
        return res.status(400).json({ success: false, message: 'Query cannot be empty.' });
    }

    console.log('Received query:', query); // Log after query is defined

    try {
        const chatResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'You are a music expert.' },
                { role: 'user', content: query },
            ],
            max_tokens: 300,
        });

        const chatText = chatResponse.choices?.[0]?.message?.content || 'No response from ChatGPT';

        console.log('ChatGPT Response:', chatText);
        res.json({ success: true, chatText });
    } catch (error) {
        console.error('Error processing query:', error.message);
        res.status(500).json({ success: false, message: 'Failed to process query.' });
    }
});



async function fetchSpotifyTrack(artist, title) {
    const token = await getSpotifyAccessToken(); // Function already exists
    const searchUrl = 'https://api.spotify.com/v1/search';

    try {
        const response = await axios.get(searchUrl, {
            headers: { Authorization: `Bearer ${token}` },
            params: { q: `track:${title} artist:${artist}`, type: 'track', limit: 1 },
        });

        if (response.data.tracks.items.length > 0) {
            const track = response.data.tracks.items[0];
            return track.preview_url; // Returns a 30-second audio preview
        }
    } catch (error) {
        console.error('Spotify track fetch error:', error.message);
    }
    return null;
}


// Function to fetch streaming links and suggested playlists
async function fetchSpotifyDetails(artist, title) {
    const token = await getSpotifyAccessToken();

    // Search for the track on Spotify
    const searchUrl = 'https://api.spotify.com/v1/search';
    const playlistUrl = 'https://api.spotify.com/v1/browse/featured-playlists';

    try {
        // Get track details
        const searchResponse = await axios.get(searchUrl, {
            headers: { Authorization: `Bearer ${token}` },
            params: { q: `track:${title} artist:${artist}`, type: 'track', limit: 1 },
        });

        let spotifyLink = '';
        if (searchResponse.data.tracks.items.length > 0) {
            const track = searchResponse.data.tracks.items[0];
            spotifyLink = track.external_urls.spotify;
        }

        // Get suggested playlists
        const playlistResponse = await axios.get(playlistUrl, {
            headers: { Authorization: `Bearer ${token}` },
            params: { country: 'US', limit: 5 },
        });

        const playlists = playlistResponse.data.playlists.items.map(p => ({
            name: p.name,
            url: p.external_urls.spotify,
        }));

        return { spotifyLink, playlists };
    } catch (error) {
        console.error('Error fetching Spotify details:', error);
        return { spotifyLink: '', playlists: [] };
    }
}

// Modified upload route to include Spotify details and recommendations
app.post('/upload', upload.single('musicFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const filePath = req.file.path;
    const trimmedPath = `uploads/trimmed-${Date.now()}.mp3`;

    ffmpeg(filePath)
        .setStartTime(0)
        .setDuration(5)
        .output(trimmedPath)
        .on('end', async () => {
            const result = await identifySong(trimmedPath);

            if (result.success) {
                const metadata = result.metadata;
                const title = metadata.title;
                const artist = metadata.artist;

                // Fetch additional data
                const lyrics = await fetchLyrics(artist, title);
                const videoUrl = await fetchYouTubeVideoUrl(artist, title);
                const spotifyDetails = await fetchSpotifyDetails(artist, title);
                const similarSongs = await fetchRecommendedSongs(artist, title);

                res.json({
                    success: true,
                    title,
                    artist,
                    lyrics: lyrics || 'Lyrics not available',
                    videoUrl: videoUrl || '',
                    spotifyLink: spotifyDetails.spotifyLink || '',
                    playlists: spotifyDetails.playlists || [],
                    similarSongs: similarSongs || [],
                });
            } else {
                res.json({ success: false, message: 'Unable to recognize the song.' });
            }

            fs.unlink(trimmedPath, () => {});
        })
        .on('error', (err) => {
            console.error('Error processing audio:', err);
            res.status(500).json({ success: false, message: 'Error processing the audio file.' });
        })
        .run();
});
// Registration Endpoint
app.post('/signup', async (req, res) => {
    const { email, password, full_name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
        'INSERT INTO users (email, password, full_name) VALUES (?, ?, ?)',
        [email, hashedPassword, full_name],
        (err) => {
            if (err) return res.status(500).json({ message: 'User already exists or server error.' });
            res.status(201).json({ message: 'User registered successfully.' });
        }
    );
});

// Lyrics Retrieval Function
async function fetchLyrics(artist, title) {
    try {
        const lyricsOvhResponse = await axios.get(`https://api.lyrics.ovh/v1/${artist}/${title}`);
        if (lyricsOvhResponse.data.lyrics) {
            return lyricsOvhResponse.data.lyrics.replace(/\n{2,}/g, '\n\n');
        }
    } catch (err) {
        console.error('Lyrics.ovh API error:', err.message);
    }

    // Fallback to Genius API
    try {
        const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(artist + ' ' + title)}`;
        const geniusResponse = await axios.get(searchUrl, {
            headers: { Authorization: `Bearer ${GENIUS_API_KEY}` }
        });

        if (geniusResponse.data.response.hits.length > 0) {
            const songPath = geniusResponse.data.response.hits[0].result.path;
            const songUrl = `https://genius.com${songPath}`;

            const pageResponse = await axios.get(songUrl);
            const $ = cheerio.load(pageResponse.data);
            let lyrics = $('.lyrics').text().trim() || $('[data-lyrics-container]').text().trim();

            return lyrics || 'Lyrics not found';
        }
    } catch (err) {
        console.error('Genius API or scraping error:', err.message);
    }

    return 'Lyrics not found';
}


// Login Endpoint
app.post('/signin', (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err || results.length === 0) return res.status(400).json({ message: 'Invalid credentials.' });

        const user = results[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) return res.status(400).json({ message: 'Invalid credentials.' });

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login successful', token });
    });
});

// File upload and processing logic
app.post('/upload', async (req, res) => {
    // Route logic calling fetchLyrics here
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
