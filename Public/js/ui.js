import { sanitizeHTML, convertToEmbedUrl } from './utils.js';
import { fetchMoodAPI, fetchRecommendationsAPI, toggleFavoriteAPI, translateLyricsAPI, deepLyricsAPI } from './api.js';

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
                <iframe src="${convertToEmbedUrl(data.videoUrl)}" allowfullscreen></iframe>
            </div>` : ''
        }

        ${data.lyrics ? `
            <div class="result-content lyrics-container">
                <div class="header-row">
                    <h4><i class="fas fa-scroll"></i> Lyrics <span class="lyrics-hint">(Click lines for meaning)</span></h4>
                    <button class="translate-btn" data-action="translate" data-song-id="${songId}">AI Translate</button>
                </div>
                <pre id="lyrics-${songId}" class="lyrics-text">${processLyrics(data.lyrics, songId)}</pre>
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
    popup.innerHTML = `<div class="loading-dots"><span>.</span><span>.</span><span>.</span></div> Analyzing meaning...`;
    popup.classList.add('visible');

    const closePopup = (e) => {
        if (!popup.contains(e.target) && e.target !== element) {
            popup.classList.remove('visible');
            document.removeEventListener('click', closePopup);
        }
    };
    setTimeout(() => document.addEventListener('click', closePopup), 100);

    try {
        const result = await deepLyricsAPI(text, artist, title);
        if (result.success) {
            popup.innerHTML = `<p class="explanation">💡 <strong>Adagio Analysis:</strong><br>${sanitizeHTML(result.explanation)}</p>`;
        } else {
            popup.innerHTML = `<p class="error">Couldn't analyze this line.</p>`;
        }
    } catch (e) {
        popup.innerHTML = `<p class="error">Error connecting to AI.</p>`;
    }
}

export async function renderRecommendations(artist, title, container) {
    try {
        const data = await fetchRecommendationsAPI(artist, title);
        if (data.success && data.recommendations.length > 0) {
            const recSection = document.createElement('div');
            recSection.className = 'recommendations-section';
            recSection.innerHTML = `<h4><i class="fas fa-wand-magic-sparkles"></i> You might also like...</h4>
            <div class="recommendations-grid"></div>`;

            const grid = recSection.querySelector('.recommendations-grid');
            data.recommendations.forEach(rec => {
                const card = document.createElement('div');
                card.className = 'rec-card btn-searchable';
                card.dataset.query = `${rec.title} by ${rec.artist}`;
                card.innerHTML = `
                <h4>${sanitizeHTML(rec.title)}</h4>
                <p>${sanitizeHTML(rec.artist)}</p>
            `;
                grid.appendChild(card);
            });
            const resultCard = container.querySelector('.result-card');
            if (resultCard) resultCard.appendChild(recSection);
        }
    } catch (e) { console.error("Recommendations failed", e); }
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
