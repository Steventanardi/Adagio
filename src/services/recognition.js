const fs = require('fs');
const AcrCloud = require('acrcloud');
const axios = require('axios');
const path = require('path');
const FormData = require('form-data');
const { fetchLyrics } = require('./lyrics');
const { fetchYouTubeVideoUrl } = require('./youtube');

const acrClient = new AcrCloud({
    host: process.env.ACR_HOST || 'identify-ap-southeast-1.acrcloud.com',
    access_key: process.env.ACR_ACCESS_KEY,
    access_secret: process.env.ACR_ACCESS_SECRET
});

const AUDD_API_KEY = process.env.AUDD_API_KEY;

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

    // 1. AudD (Primary) — skip entirely if API key is not configured
    if (AUDD_API_KEY) {
        try {
            const formData = new FormData();
            formData.append('api_token', AUDD_API_KEY);
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
    } else {
        console.warn('⚠️ AudD: AUDD_API_KEY not set, skipping.');
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

module.exports = { identifySong };
