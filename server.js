const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AcrCloud = require('acrcloud');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg'); // Import ffmpeg for audio processing

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
                            // Try lyrics.ovh
                            const lyricsResponse = await axios.get(`https://api.lyrics.ovh/v1/${artist}/${title}`);
                            lyrics = lyricsResponse.data.lyrics || lyrics;
                        } catch (err) {
                            console.error('Lyrics.ovh API error:', err);
                        }

                        if (lyrics === 'Lyrics not found') {
                            try {
                                // Try Genius API
                                const geniusResponse = await axios.get(`https://api.genius.com/search?q=${encodeURIComponent(artist + ' ' + title)}`, {
                                    headers: {
                                        'Authorization': `Bearer VFSt-kKvWqpETgdv_8S9VJz9wAYOX3OVpRG5MSwFwUXgN3v4kvNvtF9TzUk9SJkl`
                                    }
                                });
                                if (geniusResponse.data.response.hits.length > 0) {
                                    const songPath = geniusResponse.data.response.hits[0].result.url;
                                    lyrics = `Full lyrics available [here](${songPath})`;
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
                            albumArtUrl: metadata.album ? metadata.album.cover_image : '',
                            previewUrl: ''
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

// Live Listening in Device
app.post('/liveDevice', async (req, res) => {
    try {
        console.log('Attempting to capture system audio...');
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: false,
            audio: true
        });

        if (stream) {
            console.log('System audio stream captured successfully.');
            const mediaRecorder = new MediaRecorder(stream);
            let audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const formData = new FormData();
                formData.append('musicFile', audioBlob, 'systemAudio.wav');

                fetch('/upload', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(result => {
                    if (result.success) {
                        res.json({
                            title: result.title,
                            artist: result.artist,
                            album: result.album,
                            lyrics: result.lyrics,
                        });
                    } else {
                        res.json({ error: 'Unable to identify the song' });
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                });
            };

            // Start recording after obtaining the stream
            mediaRecorder.start();
            setTimeout(() => {
                mediaRecorder.stop();
            }, 20000); // Stop recording after 20 seconds

        } else {
            console.error('Failed to obtain audio stream.');
            res.status(500).json({ error: 'Unable to capture system audio. Make sure to allow permissions and select a screen with audio.' });
        }
    } catch (err) {
        console.error('Error capturing system audio:', err);
        res.status(500).json({ error: 'Unable to capture system audio. Make sure to allow permissions and select a screen with audio.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
