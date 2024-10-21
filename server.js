const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const AcrCloud = require('acrcloud');
const cors = require('cors');

const app = express();
const PORT = 3000;
app.use(cors());

// Set up AcrCloud config
const acr = new AcrCloud({
    host: 'identify-ap-southeast-1.acrcloud.com', // Use the endpoint from AcrCloud dashboard
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
app.post('/upload', upload.single('musicFile'), (req, res) => {
    if (req.file) {
        const inputFilePath = req.file.path;
        const outputFilePath = `./uploads/trimmed-${Date.now()}.mp3`;

        // Trim the audio file to 20 seconds using FFmpeg
        ffmpeg(inputFilePath)
            .setStartTime(0)
            .setDuration(20)
            .output(outputFilePath)
            .on('end', () => {
                // After trimming, use the trimmed file for music recognition
                acr.identify(fs.readFileSync(outputFilePath)).then((data) => {
                    console.log('AcrCloud Response:', data);
                    if (data.status && data.status.msg === 'Success') {
                        const metadata = data.metadata.music[0];
                        res.send(`Song: ${metadata.title}, Artist: ${metadata.artists[0].name}`);
                    } else {
                        res.send('Unable to recognize the song');
                    }
                }).catch((err) => {
                    console.error('Error recognizing song:', err);
                    res.status(500).send('Error recognizing the song');
                });
            })
            .on('error', (err) => {
                console.error('Error trimming the audio file:', err);
                res.status(500).send('Error processing the audio file');
            })
            .run();
    } else {
        res.status(400).send('No file uploaded');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
