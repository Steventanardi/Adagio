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
        
        // Convert <br> tags to actual newlines before extracting text so it doesn't mash together
        $('br').replaceWith('\n');
        
        let lyrics = '';
        $('[data-lyrics-container]').each((_, el) => {
            lyrics += $(el).text().trim() + '\n\n';
        });
        if (!lyrics.trim()) {
            $('[class^="Lyrics__Container"]').each((_, el) => {
                lyrics += $(el).text().trim() + '\n\n';
            });
        }
        
        // Remove Genius scraping garbage header (e.g., "69 Contributors Translations... Lyrics")
        if (/^\d+\s*Contributors/i.test(lyrics)) {
            // Usually, real lyrics start with a section header like "[Verse 1]"
            const firstBracketIndex = lyrics.indexOf('[');
            if (firstBracketIndex !== -1) {
                // Strip EVERYTHING before the first bracket, completely ignoring the metadata garbage
                lyrics = lyrics.substring(firstBracketIndex);
            } else {
                // If no bracket exists, fall back to stripping everything up to the word "Lyrics"
                lyrics = lyrics.replace(/^[\s\S]*?Lyrics/i, '').trim();
            }
        }

        return lyrics.replace(/(\n\s*){3,}/g, '\n\n').trim() || null;
    } catch (err) {
        console.error("❌ Genius lyrics error:", err.message);
        return null;
    }
}

module.exports = { fetchLyrics };
