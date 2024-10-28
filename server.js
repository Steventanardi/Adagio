const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AcrCloud = require('acrcloud');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = 3000;

// Set up AcrCloud config
const acr = new AcrCloud({
    host: 'identify-ap-southeast-1.acrcloud.com', 
    access_key: '[ACR_KEY_LEAKED]',
    access_secret: '[ACR_SECRET_LEAKED]'
});

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Function to fetch lyrics based on the song's language
async function fetchLyrics(artist, title, language) {
    let lyrics = 'Lyrics not found';

    if (language === 'zh') {
        lyrics = await fetchChineseLyrics(artist, title);
    } else {
        try {
            const lyricsResponse = await axios.get(`https://api.lyrics.ovh/v1/${artist}/${title}`);
            lyrics = lyricsResponse.data.lyrics || lyrics;
        } catch (err) {
            console.error('Lyrics.ovh API error:', err);
        }
    }

    return lyrics;
}

// Serve static files
app.use(express.static('public'));

// Handle file upload
app.post('/upload', upload.single('musicFile'), async (req, res) => {
    if (req.file) {
        const filePath = req.file.path;
        const trimmedPath = `uploads/trimmed-${Date.now()}.mp3`;

        // Use ffmpeg to trim audio to 20 seconds
        ffmpeg(filePath)
            .setStartTime(0)
            .setDuration(20)
            .output(trimmedPath)
            .on('end', async () => {
                try {
                    const data = await acr.identify(fs.readFileSync(trimmedPath));
                    if (data.status && data.status.msg === 'Success') {
                        const metadata = data.metadata.music[0];
                        const title = metadata.title;
                        const artist = metadata.artists[0].name;
                        const album = metadata.album ? metadata.album.name : 'Unknown';
                        const genre = metadata.genres && metadata.genres.length > 0 ? metadata.genres[0].name : 'Unknown'; // Extract genre
                        const language = metadata.language || 'en'; // Use 'zh' if it's Chinese
                        
                        // Fetch lyrics based on the song's language
                        const lyrics = await fetchLyrics(artist, title, language);

                        // Respond with metadata, including genre
                        res.json({
                            success: true,
                            title: title,
                            artist: artist,
                            album: album,
                            genre: genre, // Include genre in the response
                            lyrics: lyrics,
                            albumArtUrl: metadata.album ? metadata.album.cover_image : '',
                            previewUrl: metadata.preview_url || ''
                        });
                    } else {
                        res.json({ success: false, title: data.metadata.music[0]?.title || null, artist: data.metadata.music[0]?.artists[0]?.name || null });
                    }
                } catch (err) {
                    console.error('Error recognizing song:', err);
                    res.status(500).json({ success: false, error: 'Error recognizing the song' });
                } finally {
                    fs.unlink(trimmedPath, (err) => {
                        if (err) console.error('Error removing trimmed file:', err);
                    });
                }
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

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
