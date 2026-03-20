const fetch = require('node-fetch');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Helper: score a candidate video — higher = better match
function scoreVideo(vidTitle, vidAuthor, cleanTitle, cleanArtist) {
    if (!vidTitle) return -100;
    
    const t = vidTitle.toLowerCase();
    const a = (vidAuthor || '').toLowerCase();
    const wt = cleanTitle.toLowerCase();
    const wa = cleanArtist.toLowerCase();
    
    // STRICT FILTER: The video title MUST contain the core song title,
    // and either the title or the author MUST contain the artist name.
    // If not, it's immediately disqualified.
    if (!t.includes(wt)) return -100;
    if (!t.includes(wa) && !a.includes(wa)) return -100;

    let score = 0;
    
    // Exact/Strong matches (Baseline points since we passed the strict filter)
    score += 10; // For title match
    if (t.includes(wa)) score += 5;
    if (a.includes(wa)) score += 10; // Author/Channel name matches artist is a strong signal
    
    // Official indicators
    if (t.includes('official')) score += 5;
    if (t.includes('mv') || t.includes('music video')) score += 5;
    if (t.includes('audio')) score += 2; // Official audio is okay if no MV
    
    // Penalize unofficial/irrelevant content
    const penaltyTerms = [
        'cover', 'live', 'lyrics', 'lyric', 'remix', 'karaoke', 
        'reaction', 'short', 'tiktok', 'instrumental', 'bass boosted',
        '8d', 'slowed', 'reverb', 'chipmunk', 'nightcore', 'tutorial',
        'how to play', 'guitar', 'piano', 'chords', 'tabs'
    ];
    
    for (const term of penaltyTerms) {
        // Apply heavy penalty if title contains unwanted terms and the actual song isn't named that
        if (t.includes(term) && !wt.includes(term)) {
            score -= 15;
        }
    }
    
    // Slight penalty for very long titles (often compilations or weird mixes)
    if (t.length > 80) score -= 3;
    
    return score;
}

// Helper: YouTube Search
async function fetchYouTubeVideoUrl(artist, title) {
    const cleanTitle  = title.split('(')[0].split('-')[0].trim();
    const cleanArtist = artist.split('feat')[0].split('ft.')[0].trim();
    const searchQuery = `${cleanArtist} ${cleanTitle} official music video`;

    // 1. Official YouTube Data API v3
    if (YOUTUBE_API_KEY && YOUTUBE_API_KEY !== 'YOUR_YOUTUBE_API_KEY_HERE') {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&key=${YOUTUBE_API_KEY}&type=video&maxResults=10`;
        try {
            const response = await fetch(url, { timeout: 5000 });
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                const best = data.items
                    .map(item => ({ 
                        id: item.id.videoId, 
                        score: scoreVideo(item.snippet.title, item.snippet.channelTitle, cleanTitle, cleanArtist) 
                    }))
                    .sort((a, b) => b.score - a.score)[0];
                    
                if (best && best.score > 0) {
                    console.log(`✅ YouTube API: ${best.id} (score ${best.score})`);
                    return `https://www.youtube.com/watch?v=${best.id}`;
                } else {
                    console.log(`⚠️ YouTube API found videos, but none matched the strict criteria for "${title}".`);
                }
            }
        } catch (error) {
            console.error('❌ YouTube API error:', error.message);
        }
    } else {
        console.log('⚠️ YouTube API key missing, falling back to ytsr headless scraper...');
    }
    
    // 2. Headless Scraping Fallback (ytsr)
    try {
        const ytsr = require('ytsr');
        console.log(`📡 ytsr: searching for "${searchQuery}"`);
        const searchOptions = { limit: 15, gl: 'US', hl: 'en' };
        const ytsrResults = await ytsr(searchQuery, searchOptions);
        
        const best = ytsrResults.items
            .filter(item => item.type === 'video')
            .map(item => ({ 
                id: item.url?.includes('v=') ? item.url.split('v=')[1].split('&')[0] : null, 
                score: scoreVideo(item.title, item.author?.name, cleanTitle, cleanArtist) 
            }))
            .filter(item => item.id !== null)
            .sort((a, b) => b.score - a.score)[0];
            
        if (best && best.score > 0) {
            console.log(`✅ ytsr fallback match: ${best.id} (score ${best.score})`);
            return `https://www.youtube.com/watch?v=${best.id}`;
        }
    } catch (e) {
        console.error('❌ ytsr fallback error:', e.message);
    }

    return null;
}

module.exports = {
    fetchYouTubeVideoUrl
};
