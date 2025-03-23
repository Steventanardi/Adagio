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
const fetch = require('node-fetch');

require('dotenv').config();
global.fetch = require('node-fetch');


const app = express();
const PORT = 3000;
const JWT_SECRET = 'your_jwt_secret_key';

// Set up AcrCloud config
const acrClient = new AcrCloud({
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
//const db = mysql.createConnection({
//    host: 'localhost',
//    user: 'root',
//    password: '',
//    database: 'adagio'
//});

//db.connect((err) => {
//    if (err) throw err;
//    console.log('Connected to MySQL Database');
//});

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


async function recognizeMusic(filePath) {
    console.log("🎵 Sending to AudD for recognition...");

    let formData = new FormData();
    formData.append('api_token', '[AUDD_LEAKED]');
    formData.append('file', fs.createReadStream(filePath));
    formData.append('return', 'spotify,youtube');

    try {
        let response = await fetch('https://api.audd.io/', { method: 'POST', body: formData });
        let result = await response.json();

        if (result.status === 'success' && result.result) {
            console.log("✅ Recognized by AudD:", result.result.title, "by", result.result.artist);
            const videoUrl = result.result.youtube ? result.result.youtube.url : await fetchYouTubeVideoUrl(result.result.artist, result.result.title);
            const lyrics = result.result.lyrics || await fetchLyrics(result.result.artist, result.result.title);

            return {
                success: true,
                title: result.result.title,
                artist: result.result.artist,
                videoUrl,
                lyrics
            };
        }
    } catch (error) {
        console.error("❌ AudD API Error:", error);
    }

    // ❌ AudD failed, try AcrCloud
    console.log("❌ AudD failed, trying AcrCloud...");

    try {
        const acrResult = await acrClient.identify(fs.readFileSync(filePath));

        console.log("🔍 AcrCloud Full Response:", JSON.stringify(acrResult, null, 2));

        if (!acrResult || !acrResult.metadata || !acrResult.metadata.music) {
            console.error("❌ AcrCloud response is missing metadata.");
            return { success: false, message: "AcrCloud returned no valid data." };
        }

        if (acrResult.metadata.music.length === 0) {
            console.error("❌ AcrCloud found no matching songs.");
            return { success: false, message: "No match found in AcrCloud." };
        }

        const song = acrResult.metadata.music[0];
        console.log("✅ Recognized by AcrCloud:", song.title, "by", song.artists[0].name);

        const videoUrl = await fetchYouTubeVideoUrl(song.artists[0].name, song.title);
        const lyrics = await fetchLyrics(song.artists[0].name, song.title);

        return {
            success: true,
            title: song.title,
            artist: song.artists[0].name,
            videoUrl,
            lyrics
        };
    } catch (err) {
        console.error("❌ AcrCloud error:", err);
    }

    // ❌ If both fail
    console.log("❌ Both AudD and AcrCloud failed to recognize the song.");
    return { success: false, message: 'Unable to recognize the song.' };
}



// Express Route
app.post('/upload-mic-audio', upload.single('musicFile'), async (req, res) => {
    if (!req.file) {
        console.error("❌ No file uploaded.");
        return res.status(400).json({ success: false, message: 'No audio detected.' });
    }

    console.log("✅ Live audio received:", req.file.path);
    const filePath = req.file.path;
    
    const result = await recognizeMusic(filePath);
    res.json(result);
});

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
    console.log(`🔎 Searching YouTube for: ${artist} - ${title}`);

    const apiKey = '[GOOGLE_YOUTUBE_LEAKED]'; // Replace with your actual YouTube API key
    const searchQuery = encodeURIComponent(`${artist} ${title} official music video`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&key=${apiKey}&type=video&maxResults=1`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            const videoId = data.items[0].id.videoId;
            console.log("🎥 YouTube MV Found:", `https://www.youtube.com/watch?v=${videoId}`);
            return `https://www.youtube.com/watch?v=${videoId}`;
        }
    } catch (error) {
        console.error("❌ Error fetching YouTube video:", error);
    }

    return null; // No video found
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
app.post('/upload-mic-audio', upload.single('musicFile'), async (req, res) => {
    if (!req.file) {
        console.error("❌ No file uploaded.");
        return res.status(400).json({ success: false, message: 'No audio detected.' });
    }

    console.log("✅ Live audio received:", req.file.path);
    const filePath = req.file.path;
    const trimmedPath = `uploads/trimmed-${Date.now()}.mp3`;

    ffmpeg(filePath)
        .audioFilters("highpass=f=200, lowpass=f=3000") // Enhancing voice clarity
        .output(trimmedPath)
        .on('end', async () => {
            console.log('✅ Audio cleaned and processed.');
            const result = await identifySong(trimmedPath);

            if (result.success) {
                res.json({
                    success: true,
                    title: result.metadata.title,
                    artist: result.metadata.artist,
                    videoUrl: await fetchYouTubeVideoUrl(result.metadata.artist, result.metadata.title)
                });
            } else {
                res.json({ success: false, message: 'Unable to recognize the song. Try singing clearly.' });
            }
        })
        .on('error', (err) => {
            console.error('❌ Error processing live singing:', err);
            res.status(500).json({ success: false, message: 'Error processing live singing.' });
        })
        .run();
});


app.post('/upload', upload.single('musicFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const filePath = req.file.path;
    const trimmedPath = `uploads/trimmed-${Date.now()}.mp3`;

    ffmpeg(filePath)
        .output(trimmedPath)
        .on('end', async () => {
            console.log('Audio trimmed successfully.');
            const result = await identifySong(trimmedPath);

            if (result.success) {
                const metadata = result.metadata;
                const title = metadata.title;
                const artist = metadata.artist;
                const lyrics = await fetchLyrics(artist, title);
                const videoUrl = await fetchYouTubeVideoUrl(artist, title);

                res.json({
                    success: true,
                    title,
                    artist,
                    lyrics,
                    videoUrl
                });
            } else {
                res.json({ success: false, message: 'Unable to recognize the song.' });
            }

            fs.unlink(trimmedPath, () => {}); // Cleanup
        })
        .on('error', (err) => {
            console.error('Error processing audio:', err);
            res.status(500).json({ success: false, message: 'Error processing the audio file.' });
        })
        .run();
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
        console.error("❌ No file uploaded.");
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    console.log("✅ Audio file received:", req.file.path);
    const filePath = req.file.path;
    const trimmedPath = `uploads/trimmed-${Date.now()}.mp3`;

    ffmpeg(filePath)
        .output(trimmedPath)
        .on('end', async () => {
            console.log('✅ Audio trimmed successfully.');
            const result = await identifySong(trimmedPath);

            if (result.success) {
                res.json({
                    success: true,
                    title: result.metadata.title,
                    artist: result.metadata.artist,
                    videoUrl: await fetchYouTubeVideoUrl(result.metadata.artist, result.metadata.title)
                });
            } else {
                res.json({ success: false, message: 'Unable to recognize the song.' });
            }
        })
        .on('error', (err) => {
            console.error('❌ Error processing audio:', err);
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
    console.log(`🎼 Searching lyrics for: ${artist} - ${title}`);

    const apiKey = 'gJSMSZpK06fIm8g-pjIoDieHcWL85vzqcGf6P2EAiEdDjDBrSGuwaHkJf0t20aDK'; // Replace with your Genius API Key
    const searchQuery = encodeURIComponent(`${artist} ${title}`);
    const url = `https://api.genius.com/search?q=${searchQuery}`;

    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` }
        });

        const data = await response.json();

        if (data.response.hits.length > 0) {
            const lyricsUrl = data.response.hits[0].result.url;
            console.log("🎼 Lyrics Found:", lyricsUrl);
            return lyricsUrl;
        }
    } catch (error) {
        console.error("❌ Error fetching lyrics:", error);
    }

    return null; // No lyrics found
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

app.post('/recognize-indevice-audio', upload.single('musicFile'), async (req, res) => {
    if (!req.file) {
        console.error("❌ No file uploaded.");
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    console.log("✅ Audio file received:", req.file.path);
    const filePath = req.file.path;
    const trimmedPath = `uploads/trimmed-${Date.now()}.mp3`;

    ffmpeg(filePath)
        .output(trimmedPath)
        .on('end', async () => {
            console.log('✅ Audio converted successfully.');
            const result = await identifySong(trimmedPath);

            if (result.success) {
                console.log("✅ Song recognized:", result.metadata.title, "by", result.metadata.artist);
                res.json({
                    success: true,
                    title: result.metadata.title,
                    artist: result.metadata.artist,
                    videoUrl: await fetchYouTubeVideoUrl(result.metadata.artist, result.metadata.title),
                });
            } else {
                console.error("❌ Failed to recognize song.");
                res.json({ success: false, message: 'Unable to recognize the song.' });
            }
        })
        .on('error', (err) => {
            console.error('❌ Error processing in-device audio:', err.message);
            res.status(500).json({ success: false, message: 'Error processing the audio file.' });
        })
        .run();
});




app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
