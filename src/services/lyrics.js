const fetch = require('node-fetch');
const cheerio = require('cheerio');

const GENIUS_API_KEY = process.env.GENIUS_API_KEY;

// Helper: Genius Lyrics
async function fetchLyrics(artist, title) {
    if (!GENIUS_API_KEY) return null;
    const cleanArtist = artist.split('feat')[0].split('ft.')[0].trim();
    const cleanTitle = title.split('(')[0].split('-')[0].trim();
    const searchQuery = encodeURIComponent(`${cleanArtist} ${cleanTitle}`);
    const url = `https://api.genius.com/search?q=${searchQuery}`;
    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${GENIUS_API_KEY}` },
            timeout: 5000
        });
        const data = await response.json();
        if (!data.response?.hits?.length) return null;

        const targetArtist = cleanArtist.toLowerCase().replace(/[^a-z0-9]/g, "");
        const targetTitle = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, "");

        let bestMatch = null;
        for (const hit of data.response.hits) {
            const hitArtist = hit.result.primary_artist.name.toLowerCase().replace(/[^a-z0-9]/g, "");
            const hitTitle = hit.result.title.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (hitArtist.includes(targetArtist) || targetArtist.includes(targetArtist)) {
                if (hitTitle.includes(targetTitle) || targetTitle.includes(targetTitle)) {
                    bestMatch = hit.result;
                    break;
                }
            }
        }
        if (!bestMatch) return null;

        const html = await fetch(bestMatch.url, { timeout: 8000 }).then(res => res.text());
        const $ = cheerio.load(html);
        let lyrics = '';
        $('[data-lyrics-container]').each((_, el) => {
            lyrics += $(el).text().trim() + '\n\n';
        });
        if (!lyrics.trim()) {
            $('[class^="Lyrics__Container"]').each((_, el) => {
                lyrics += $(el).text().trim() + '\n\n';
            });
        }
        return lyrics.replace(/(\n\s*){3,}/g, '\n\n').trim() || null;
    } catch (err) {
        console.error("❌ Genius lyrics error:", err.message);
        return null;
    }
}

module.exports = { fetchLyrics };
