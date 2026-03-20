const fetch = require('node-fetch');
const YouTube = require('youtube-sr').default;

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Helper: score a candidate video — higher = better match
function scoreVideo(vidTitle, vidAuthor, cleanTitle, cleanArtist) {
    if (!vidTitle) return -100;
    
    const t = vidTitle.toLowerCase();
    const a = (vidAuthor || '').toLowerCase();
    const targetTitle = cleanTitle.toLowerCase();
    const targetArtist = cleanArtist.toLowerCase();

    let score = 0;

    // Check for exact title match (best)
    if (t === targetTitle) score += 30;
    else if (t.includes(targetTitle)) score += 15;

    // Check for artist match
    if (a.includes(targetArtist) || targetArtist.includes(a)) score += 15;
    
    // Boost official videos
    if (t.includes('official') || t.includes('mv')) score += 5;
    
    // Penalize low-quality keywords
    if (t.includes('cover') || t.includes('remix') || t.includes('karaoke') || t.includes('instrumental')) score -= 20;

    return score;
}

/**
 * Searches for a YouTube video URL for a given song.
 * Uses official API first, falls back to youtube-sr scraper if key is missing or quota met.
 */
async function fetchYouTubeVideoUrl(artist, title) {
    const cleanArtist = artist.split('feat')[0].split('ft.')[0].trim();
    const cleanTitle = title.split('(')[0].split('-')[0].trim();
    const searchQuery = `${cleanArtist} ${cleanTitle}`;

    // 1. Official API Attempt (Best)
    if (YOUTUBE_API_KEY && YOUTUBE_API_KEY !== 'YOUR_YOUTUBE_API_KEY_HERE') {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&maxResults=5&type=video&key=${YOUTUBE_API_KEY}`;
        try {
            const response = await fetch(url, { timeout: 5000 });
            const data = await response.json();

            // Check for API-level errors (like 403 Forbidden / Quota Exceeded)
            if (data.error) {
                console.error(`❌ YouTube API Error [${data.error.code}]: ${data.error.message}`);
                if (data.error.errors?.[0]?.reason === 'quotaExceeded') {
                    console.error('⚠️ YouTube API Daily Quota Limit Reached! Falling back to youtube-sr...');
                }
            } else if (data.items && data.items.length > 0) {
                const best = data.items
                    .filter(item => item.id && item.id.videoId)
                    .map(item => ({ 
                        id: item.id.videoId, 
                        score: scoreVideo(item.snippet.title, item.snippet.channelTitle, cleanTitle, cleanArtist) 
                    }))
                    .sort((a, b) => b.score - a.score)[0];
                    
                if (best) {
                    console.log(`✅ YouTube API: ${best.id} (score ${best.score})`);
                    return `https://www.youtube.com/watch?v=${best.id}`;
                } else {
                    console.log(`ℹ️ YouTube API found items but none were high-quality matches. Falling back...`);
                }
            } else {
                console.log(`ℹ️ YouTube API returned 0 results for "${searchQuery}". Falling back...`);
            }
        } catch (error) {
            console.error('❌ YouTube API Connection error:', error.message);
        }
    } else {
        console.log('⚠️ YouTube API key missing, falling back to youtube-sr...');
    }
    
    // 2. Headless Scraping Fallback (youtube-sr) - Sturdier than ytsr
    try {
        console.log(`📡 youtube-sr: searching for "${searchQuery}"`);
        // youtube-sr doesn't spam console with GitHub issue prompts
        const searchResults = await YouTube.search(searchQuery, { limit: 10, type: 'video' });
        
        if (!searchResults || searchResults.length === 0) {
             console.log(`ℹ️ youtube-sr returned 0 results for "${searchQuery}".`);
             return null;
        }

        const videos = searchResults.map(item => ({
            id: item.id,
            score: scoreVideo(item.title, item.channel?.name, cleanTitle, cleanArtist)
        }));
            
        const best = videos.sort((a, b) => b.score - a.score)[0];
            
        if (best) {
            console.log(`✅ youtube-sr fallback match: ${best.id} (score ${best.score})`);
            return `https://www.youtube.com/watch?v=${best.id}`;
        }
    } catch (e) {
        console.error('❌ youtube-sr fallback critical error:', e.message);
    }

    return null;
}

module.exports = { fetchYouTubeVideoUrl };
