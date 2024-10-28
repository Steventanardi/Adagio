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
    host: 'identify-ap-southeast-1.acrcloud.com', // Your AcrCloud host
    access_key: '[ACR_KEY_LEAKED]', // Replace with your actual access key
    access_secret: '[ACR_SECRET_LEAKED]' // Replace with your actual access secret
});

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

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
                    console.log('AcrCloud Response:', data); // Log the response to check its structure
                    if (data.status && data.status.msg === 'Success') {
                        const metadata = data.metadata.music[0];
                        const title = metadata.title;
                        const artist = metadata.artists[0].name;
                        const album = metadata.album ? metadata.album.name : 'Unknown';

                        // Use multiple lyrics APIs
let lyrics = 'Lyrics not found';
try {
    // Try lyrics.ovh for full lyrics
    const lyricsResponse = await axios.get(`https://api.lyrics.ovh/v1/${artist}/${title}`);
    lyrics = lyricsResponse.data.lyrics || lyrics;
} catch (err) {
    console.error('Lyrics.ovh API error:', err);
}

if (lyrics === 'Lyrics not found') {
    try {
        const geniusResponse = await axios.get(`https://api.genius.com/search?q=${encodeURIComponent(artist + ' ' + title)}`, {
            headers: {
                'Authorization': `Bearer wyr2T27kCQ_I2VX9FW-JJiiesWvjohV1fZtZSykbX-rpHHsoYZ3cmtnHi_WBYWtB`
            }
        });

        if (geniusResponse.data.response.hits.length > 0) {
            // Instead of providing a link, fetch the lyrics directly if possible
            const songId = geniusResponse.data.response.hits[0].result.id;
            const songResponse = await axios.get(`https://api.genius.com/songs/${songId}`, {
                headers: {
                    'Authorization': `Bearer wyr2T27kCQ_I2VX9FW-JJiiesWvjohV1fZtZSykbX-rpHHsoYZ3cmtnHi_WBYWtB`
                }
            });

        }
    } catch (err) {
        console.error('Genius API error:', err);
    }
}
res.json({
    success: true,
    title: title,
    artist: artist,
    album: album,
    lyrics: lyrics,
    albumArtUrl: metadata.album ? metadata.album.cover_image : '', // Album Art URL
    previewUrl: metadata.preview_url || '' // Preview URL for the music player
});


                    } else {
                        res.json({ success: false, title: data.metadata.music[0]?.title || null, artist: data.metadata.music[0]?.artists[0]?.name || null });
                    }
                } catch (err) {
                    console.error('Error recognizing song:', err);
                    res.status(500).json({ success: false, error: 'Error recognizing the song' });
                } finally {
                    // Remove temporary trimmed file
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
