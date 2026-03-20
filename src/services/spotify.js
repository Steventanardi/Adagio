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
        // Try 1: Strict search (most accurate)
        let query = encodeURIComponent(`track:${title} artist:${artist}`);
        let url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;
        let response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, timeout: 4000 });
        let data = await response.json();
        
        let track = data.tracks?.items?.[0];

        // Try 2: Fuzzy/General search (if strict fails)
        if (!track) {
            query = encodeURIComponent(`${title} ${artist}`);
            url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;
            response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, timeout: 4000 });
            data = await response.json();
            track = data.tracks?.items?.[0];

            // Only accept fuzzy match if it actually contains some part of the title/artist
            if (track) {
                const t = track.name.toLowerCase();
                const a = track.artists[0].name.toLowerCase();
                const wt = title.toLowerCase();
                const wa = artist.toLowerCase();
                const isMatch = (t.includes(wt) || wt.includes(t)) && (a.includes(wa) || wa.includes(a));
                if (!isMatch) track = null; // Still a hallucination
            }
        }

        if (track) {
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
