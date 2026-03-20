const axios = require('axios');
const fetch = require('node-fetch');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

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

// Helper: Verify AI songs against Spotify to eliminate hallucinated fake tracks
async function verifySongWithSpotify(artist, title) {
    const token = await getSpotifyAccessToken();
    if (!token) return { artist, title }; // Pass through if Spotify is not configured

    try {
        const query = encodeURIComponent(`track:${title} artist:${artist}`);
        const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, timeout: 4000 });
        const data = await response.json();
        
        if (data.tracks && data.tracks.items && data.tracks.items.length > 0) {
            const track = data.tracks.items[0];
            return {
                title: track.name, // The official Spotify title
                artist: track.artists[0].name, // The official primary artist
                spotifyUrl: track.external_urls?.spotify // URL for the frontend
            };
        }
        console.warn(`⚠️ Spotify rejected hallucinated song: "${title}" by "${artist}"`);
        return null; // AI hallucinated this song
    } catch (e) {
        console.warn('⚠️ Spotify verification failed:', e.message);
        return { artist, title }; // Fallback
    }
}

module.exports = {
    getSpotifyAccessToken,
    verifySongWithSpotify
};
