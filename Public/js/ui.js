import { sanitizeHTML, convertToEmbedUrl } from './utils.js';
import { fetchMoodAPI, fetchRecommendationsStreamAPI, toggleFavoriteAPI, translateLyricsAPI, deepLyricsStreamAPI, fetchYouTubeVideoAPI, fetchLyricsAPI } from './api.js';

let floatingPlayer = null;
export function initFloatingPlayer() {
    if (floatingPlayer || typeof document === 'undefined') return;
    floatingPlayer = document.createElement('div');
    floatingPlayer.id = 'floatingPlayer';
    floatingPlayer.className = 'floating-player';
    floatingPlayer.innerHTML = `
        <div class="fp-info">
            <div class="fp-thumb"></div>
            <div class="fp-text">
                <div class="fp-title">Select a song</div>
                <div class="fp-artist">Adagio Premium</div>
            </div>
        </div>
        <div class="fp-controls">
            <button class="fp-btn" title="Previous"><i class="fas fa-backward-step"></i></button>
            <button class="fp-btn fp-play-btn" title="Play/Pause"><i class="fas fa-play"></i></button>
            <button class="fp-btn" title="Next"><i class="fas fa-forward-step"></i></button>
        </div>
        <button class="fp-btn fp-close" title="Close Player"><i class="fas fa-times"></i></button>
    `;
    document.body.appendChild(floatingPlayer);
    
    floatingPlayer.querySelector('.fp-close').onclick = () => floatingPlayer.classList.remove('active');
    
    // Play/Pause Logic
    const playBtn = floatingPlayer.querySelector('.fp-play-btn');
    playBtn.onclick = () => {
        const isPlaying = floatingPlayer.classList.toggle('playing');
        playBtn.querySelector('i').className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
        
        // Try to control the YouTube iframe
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            const command = isPlaying ? 'playVideo' : 'pauseVideo';
            iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: command, args: [] }), '*');
        }
    };

    console.log("✅ Floating Player initialized in DOM");
}

function updateFloatingPlayer(title, artist) {
    if (!floatingPlayer) initFloatingPlayer();
    // Use innerHTML for title/artist to handle entities, OR ensure raw strings are passed.
    // Given they come sanitized, we unescape briefly for display.
    const temp = document.createElement('div');
    temp.innerHTML = title;
    floatingPlayer.querySelector('.fp-title').innerText = temp.innerText;
    temp.innerHTML = artist;
    floatingPlayer.querySelector('.fp-artist').innerText = temp.innerText;
    
    floatingPlayer.classList.add('active', 'playing');
    floatingPlayer.querySelector('.fp-play-btn i').className = 'fas fa-pause';
}

export function updateAuthUI(isLoggedIn) {
    const accountLink = document.querySelector('.sidebar a[href*="signup"]');
    if (accountLink) {
        if (isLoggedIn) {
            accountLink.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
            accountLink.title = 'Sign Out';
            accountLink.href = '#';
            accountLink.classList.add('logout-btn');
        } else {
            accountLink.innerHTML = '<i class="fas fa-user-circle"></i>';
            accountLink.title = 'Sign In / Sign Up';
            accountLink.href = 'signup.html';
            accountLink.classList.remove('logout-btn');
        }
    }
}

export function updateFileName(fileNameDisplay, file) {
    if (!fileNameDisplay) return;
    fileNameDisplay.innerText = file ? `Selected: ${file.name}` : "Select or Drop Audio File";
    const subtext = fileNameDisplay.nextElementSibling;
    if (subtext && subtext.tagName === 'SPAN') {
        subtext.innerText = file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "Supports MP3, WAV, M4A, etc.";
    }
}

export function processLyrics(text, songId) {
    if (!text) return '';
    return text.split('\n').map(line => {
        if (line.trim()) {
            return `<span class="lyric-line" data-song-id="${songId}" title="Click for AI analysis">${sanitizeHTML(line)}</span>`;
        }
        return '';
    }).join('\n');
}

export function renderSongResult(data, targetElement) {
    if (!data || !targetElement) return;

    const title = sanitizeHTML(data.title || 'Unknown Title');
    const artist = sanitizeHTML(data.artist || 'Unknown Artist');
    const query = encodeURIComponent(`${artist} ${title}`);
    const songId = btoa(`${encodeURIComponent(title)}-${encodeURIComponent(artist)}`).substring(0, 16);

    const isFavorited = (window.userLibrary && window.userLibrary[songId]) ? true : false;
    const links = {
        spotify: `https://open.spotify.com/search/${query}`,
        appleMusic: `https://music.apple.com/us/search?term=${query}`,
        youtubeMusic: `https://music.youtube.com/search?q=${query}`
    };

    targetElement.innerHTML = `
    <div class="result-card" data-song-id="${songId}">
        <div class="header-row">
            <div>
                <h3 class="song-title">🎵 ${title}</h3>
                <div class="artist-row">
                    <p class="song-artist">by ${artist}</p>
                    <span class="mood-pill-container"></span>
                </div>
            </div>
            <button class="heart-btn ${isFavorited ? 'active' : ''}" data-action="favorite" data-song-id="${songId}">
                <i class="fa${isFavorited ? 's' : 'r'} fa-heart"></i>
            </button>
        </div>
        
        <div class="album-info-grid">
            ${data.album ? `<p><strong>Album:</strong><br>${sanitizeHTML(data.album)}</p>` : ''}
            ${data.release_date ? `<p><strong>Released:</strong><br>${sanitizeHTML(data.release_date)}</p>` : ''}
            ${data.label ? `<p><strong>Label:</strong><br>${sanitizeHTML(data.label)}</p>` : ''}
        </div>

        <div class="platform-links">
            <a href="${links.spotify}" target="_blank" class="platform-spotify"><i class="fab fa-spotify"></i> Spotify</a>
            <a href="${links.appleMusic}" target="_blank" class="platform-apple"><i class="fab fa-apple"></i> Apple Music</a>
            <a href="${links.youtubeMusic}" target="_blank" class="platform-youtube"><i class="fab fa-youtube"></i> YouTube Music</a>
        </div>

        ${data.videoUrl ? `
            <div class="video-container">
                <iframe src="${convertToEmbedUrl(data.videoUrl)}?enablejsapi=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>
            </div>` : ''
        }

        ${data.lyrics ? `
            <div class="result-content lyrics-container">
                <div class="header-row">
                    <h4><i class="fas fa-scroll"></i> Lyrics <span class="lyrics-hint">(Click lines for meaning)</span></h4>
                    <button class="translate-btn" data-action="translate" data-song-id="${songId}">AI Translate</button>
                </div>
                <div class="lyrics-wrapper" id="lyrics-wrapper-${songId}">
                    <pre id="lyrics-${songId}" class="lyrics-text">${processLyrics(data.lyrics, songId)}</pre>
                </div>
                <button class="show-more-lyrics" data-action="toggle-lyrics" data-target="lyrics-wrapper-${songId}">Show Full Lyrics</button>
                <div id="raw-lyrics-${songId}" style="display:none;">${sanitizeHTML(data.lyrics)}</div>
            </div>` : ''
        }

        <div class="result-actions">
            <button class="mix-btn" data-action="mix" data-artist="${artist}" data-title="${title}">
                <i class="fas fa-wand-magic-sparkles"></i> Create AI Mix
            </button>
            <button class="mix-btn share-btn" data-action="share" data-artist="${artist}" data-title="${title}" data-link="${links.spotify}">
                <i class="fas fa-share-alt"></i> Share
            </button>
        </div>
        
        <div id="mix-container-${songId}" class="mix-container"></div>
    </div>
    `;

    targetElement.lastElementChild.dataset.fullJson = JSON.stringify(data);

    if (data.title && data.artist && !targetElement.dataset.proLoaded) {
        targetElement.dataset.proLoaded = "true";
        updateMoodUI(data.artist, data.title, data.lyrics, targetElement);
        renderRecommendations(data.artist, data.title, targetElement);
        
        const card = targetElement.querySelector('.result-card');
        
        // Only update floating player if explicitly requested (e.g. for the top result)
        // or if it was the ONLY result.
        if (data.autoPlayTrack) {
            updateFloatingPlayer(title, artist);
            
            // Wait for one more tick and find the iframe to ensure playing state
            setTimeout(() => {
                const iframe = targetElement.querySelector('iframe');
                if (iframe) {
                   const src = iframe.src;
                   // Add autoplay=1 if not present
                   if (!src.includes('autoplay=1')) {
                       iframe.src = src + (src.includes('?') ? '&' : '?') + 'autoplay=1';
                   }
                }
            }, 100);
        }

        // If search results didn't already have a video, fetch one now
        if (!data.videoUrl && card) {
            fetchYouTubeVideoAPI(data.title, data.artist).then(res => {
                if (res.success && res.videoUrl) {
                    const platformLinks = card.querySelector('.platform-links');
                    const videoContainer = document.createElement('div');
                    videoContainer.className = 'video-container';
                    videoContainer.innerHTML = `<iframe src="${convertToEmbedUrl(res.videoUrl)}?enablejsapi=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
                    platformLinks.after(videoContainer);
                }
            }).catch(e => console.error("Auto YouTube fetch failed", e));
        }

        // If search results didn't already have lyrics, fetch them now
        if (!data.lyrics && card) {
            fetchLyricsAPI(data.title, data.artist).then(res => {
                if (res.success && res.lyrics) {
                    const actions = card.querySelector('.result-actions');
                    const lyricsDiv = document.createElement('div');
                    lyricsDiv.className = 'result-content lyrics-container';
                    lyricsDiv.innerHTML = `
                        <div class="header-row">
                            <h4><i class="fas fa-scroll"></i> Lyrics <span class="lyrics-hint">(Click lines for meaning)</span></h4>
                            <button class="translate-btn" data-action="translate" data-song-id="${songId}">AI Translate</button>
                        </div>
                        <div class="lyrics-wrapper" id="lyrics-wrapper-${songId}">
                            <pre id="lyrics-${songId}" class="lyrics-text">${processLyrics(res.lyrics, songId)}</pre>
                        </div>
                        <button class="show-more-lyrics" data-action="toggle-lyrics" data-target="lyrics-wrapper-${songId}">Show Full Lyrics</button>
                        <div id="raw-lyrics-${songId}" style="display:none;">${sanitizeHTML(res.lyrics)}</div>
                    `;
                    actions.before(lyricsDiv);
                    
                    // Also trigger a mood update now that we have lyrics
                    updateMoodUI(data.artist, data.title, res.lyrics, targetElement);
                }
            }).catch(e => console.error("Auto Lyrics fetch failed", e));
        }
    }
}

export async function updateMoodUI(artist, title, lyrics, cardElement) {
    try {
        const moodData = await fetchMoodAPI(artist, title, lyrics);
        if (moodData.success) {
            document.body.classList.add('mood-change');
            document.body.style.setProperty('--mood-color-1', moodData.color1);
            document.body.style.setProperty('--mood-color-2', moodData.color2);

            const moodContainer = cardElement.querySelector('.mood-pill-container');
            if (moodContainer) {
                const moodText = moodData.mood.charAt(0).toUpperCase() + moodData.mood.slice(1);
                moodContainer.innerHTML = `
                    <div class="mood-pill dynamic-mood">
                        <i class="fas fa-sparkles"></i> ${sanitizeHTML(moodText)}
                    </div>
                `;
            }
        }
    } catch (e) { console.error("Mood update failed", e); }
}

export async function explainLyricsUI(element, songId) {
    const text = element.innerText;
    const songCard = document.querySelector(`[data-song-id="${songId}"]`);
    if (!songCard) return;
    const artist = songCard.querySelector('.song-artist').innerText.replace('by ', '');
    const title = songCard.querySelector('.song-title').innerText.replace('🎵 ', '');

    let popup = document.getElementById('lyricsPopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'lyricsPopup';
        popup.className = 'lyrics-popup';
        document.body.appendChild(popup);
    }

    const rect = element.getBoundingClientRect();
    popup.style.top = `${rect.bottom + window.scrollY + 10}px`;
    popup.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
    popup.innerHTML = `<p class="explanation" style="margin:0;">💡 <strong>Adagio Analysis:</strong><br><span id="lyricStreamText"></span> <i class="fas fa-pen fa-pulse" style="font-size:0.8rem;opacity:0.6;"></i></p>`;
    popup.classList.add('visible');

    const closePopup = (e) => {
        if (!popup.contains(e.target) && e.target !== element) {
            popup.classList.remove('visible');
            document.removeEventListener('click', closePopup);
        }
    };
    setTimeout(() => document.addEventListener('click', closePopup), 100);

    const streamSpan = document.getElementById('lyricStreamText');

    await deepLyricsStreamAPI(
        text, artist, title,
        (chunk) => { streamSpan.innerHTML += sanitizeHTML(chunk); },
        () => { 
            const spinner = popup.querySelector('.fa-pen');
            if(spinner) spinner.remove();
        },
        (err) => { popup.innerHTML = `<p class="error">Error connecting to AI.</p>`; }
    );
}

export async function renderRecommendations(artist, title, container) {
    const resultCard = container.querySelector('.result-card');
    if (!resultCard) return;

    const recSection = document.createElement('div');
    recSection.className = 'recommendations-section';
    recSection.innerHTML = `<h4><i class="fas fa-wand-magic-sparkles"></i> You might also like...</h4>
        <div class="stream-text" style="font-size: 0.9rem; color: var(--text-secondary);"></div>
        <div class="recommendations-grid" style="display:none;"></div>`;
    resultCard.appendChild(recSection);

    const streamText = recSection.querySelector('.stream-text');
    const grid = recSection.querySelector('.recommendations-grid');

    let accText = '';
    await fetchRecommendationsStreamAPI(
        artist, title,
        (chunk) => { 
            accText += chunk;
            let display = accText;
            const codeBlockIdx = display.indexOf('```');
            if (codeBlockIdx !== -1) display = display.substring(0, codeBlockIdx);
            else if (display.trim().startsWith('[')) display = "Curating complementary tracks...";
            streamText.innerHTML = sanitizeHTML(display).replace(/\n/g, '<br>'); 
        },
        (status) => { streamText.innerHTML += `<br><em style="color:var(--accent-secondary);"><i class="fas fa-spinner fa-spin"></i> Loading tracks...</em>`; },
        (recommendations) => {
            streamText.style.display = 'none';
            if (recommendations && recommendations.length > 0) {
                grid.style.display = 'grid';
                recommendations.forEach(rec => {
                    const card = document.createElement('div');
                    card.className = 'rec-card btn-searchable';
                    card.dataset.query = `${rec.title} by ${rec.artist}`;
                    card.innerHTML = `
                    <h4>${sanitizeHTML(rec.title)}</h4>
                    <p>${sanitizeHTML(rec.artist)}</p>
                `;
                    grid.appendChild(card);
                });
            } else {
                recSection.remove();
            }
        },
        (err) => { recSection.remove(); }
    );
}

let timeoutInterval;
export function showTimeoutFeedback(element, baseMessage) {
    if (!element) return;
    const messages = [
        baseMessage,
        "Still working on it...",
        "Deep analyzing audio features...",
        "Cross-referencing databases...",
        "Almost there..."
    ];
    let step = 0;
    element.innerHTML = `<div class="result-card"><p>✨ ${sanitizeHTML(messages[step])}</p></div>`;
    
    clearInterval(timeoutInterval);
    timeoutInterval = setInterval(() => {
        step = Math.min(step + 1, messages.length - 1);
        const cardP = element.querySelector('.result-card p');
        if (cardP) cardP.innerHTML = `✨ ${sanitizeHTML(messages[step])}`;
    }, 10000);
}

export function clearTimeoutFeedback() {
    clearInterval(timeoutInterval);
}

// Global event listener for lyrics toggle (event delegation)
document.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('[data-action="toggle-lyrics"]');
    if (toggleBtn) {
        const targetId = toggleBtn.getAttribute('data-target');
        const wrapper = document.getElementById(targetId);
        if (wrapper) {
            const isExpanded = wrapper.classList.toggle('expanded');
            toggleBtn.innerText = isExpanded ? 'Show Less' : 'Show Full Lyrics';
        }
    }
});
