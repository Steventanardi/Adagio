import { getSavedTheme, setAdagioTheme, sanitizeHTML } from './utils.js';
import { fetchLibraryAPI, toggleFavoriteAPI, translateLyricsAPI, fetchRecommendationsStreamAPI } from './api.js';
import { updateAuthUI, explainLyricsUI, initFloatingPlayer } from './ui.js';
import { initRouter } from './router.js';
import { initAuth } from './modules/auth.js';
import { initLibrary } from './modules/library.js';
import { initSearch } from './modules/search.js';
import { initAudioCapture } from './modules/audioCapture.js';
import { initUpload } from './modules/upload.js';

document.addEventListener('DOMContentLoaded', async function () {
    console.log("Adagio Modules Loaded. Starting SPA router...");

    const themeToggle = document.getElementById('themeToggle');
    setAdagioTheme(getSavedTheme(), themeToggle);
    themeToggle?.addEventListener('click', () => setAdagioTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark', themeToggle));

    // Dynamic background effect based on route
    setInterval(() => {
        if (window.scrollY > 300) {
            document.body.classList.remove('premium-bg');
        } else if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
            document.body.classList.add('premium-bg');
        } else {
            document.body.classList.remove('premium-bg');
        }
    }, 500);

    window.userLibrary = {};
    const initAppLibrary = async () => {
        const res = await fetchLibraryAPI();
        if (res.success) {
            window.userLibrary = res.library;
            updateAuthUI(true);
        } else {
            if(res.error || res.notLoggedIn) updateAuthUI(false);
            if (res.error && res.error.message && res.error.message.includes('expired')) localStorage.removeItem('adagio_token');
        }
    };
    initAppLibrary();
    initFloatingPlayer();

    initRouter();

    document.addEventListener('keydown', async (e) => {
        const { navigate } = await import('./router.js');
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch (e.key.toLowerCase()) {
            case 's': e.preventDefault(); document.getElementById('searchInput')?.focus(); break;
            case 'm': e.preventDefault(); document.getElementById('startListeningMic')?.click(); break;
            case 'u': e.preventDefault(); navigate('upload.html'); break;
            case 'h': e.preventDefault(); navigate('index.html'); break;
        }
    });

    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        
        if (target.matches('.mood-chip')) {
            const searchInput = document.getElementById('searchInput');
            const intelligentSearchButton = document.getElementById('intelligentSearchButton');
            if(searchInput && intelligentSearchButton) {
                const mood = target.textContent.trim();
                const prompts = [
                    `Find me some ${mood} music`,
                    `Suggest some ${mood} tracks`,
                    `What are some good ${mood} songs?`,
                    `I'm in the mood for ${mood} music`,
                    `Give me unique and unexpected ${mood} songs`,
                    `I need a highly diverse playlist for ${mood}`
                ];
                searchInput.value = prompts[Math.floor(Math.random() * prompts.length)];
                intelligentSearchButton.click();
            }
        }
        
        if (target.matches('.select-file-btn')) {
            document.getElementById('musicInput')?.click();
        }

        if (target.matches('.history-item')) {
            const searchInput = document.getElementById('searchInput');
            if(searchInput) searchInput.value = target.textContent;
            document.getElementById('intelligentSearchButton')?.click();
            document.getElementById('historyWrapper')?.classList.add('collapsed');
            document.getElementById('toggleHistory')?.classList.remove('active');
        }

        const recCard = target.closest('.btn-searchable');
        if (recCard) {
            const searchInput = document.getElementById('searchInput');
            if(searchInput) searchInput.value = recCard.dataset.query;
            document.getElementById('intelligentSearchButton')?.click();
        }

        if (target.matches('.lyric-line')) {
            explainLyricsUI(target, target.dataset.songId);
        }

        const btn = target.closest('button[data-action]');
        if (btn) {
            const action = btn.dataset.action;
            const songId = btn.dataset.songId;
            const artist = btn.dataset.artist;
            const title = btn.dataset.title;
            
            if (action === 'favorite') {
                const token = localStorage.getItem('adagio_token');
                if(!token) { 
                    alert("Please sign in"); 
                    const { navigate } = await import('./router.js');
                    navigate('signin.html'); 
                    return; 
                }
                const isAdding = !btn.classList.contains('active');
                btn.classList.toggle('active');
                btn.querySelector('i').className = isAdding ? 'fas fa-heart' : 'far fa-heart';
                try {
                    const songData = isAdding ? JSON.parse(document.querySelector(`[data-song-id="${songId}"]`)?.dataset.fullJson || '{}') : null;
                    const res = await toggleFavoriteAPI(songId, songData, isAdding, token);
                    if(!res.success) throw new Error("Failed");
                    if(isAdding) window.userLibrary[songId] = songData; else delete window.userLibrary[songId];
                } catch(err) {
                    btn.classList.toggle('active');
                    btn.querySelector('i').className = !isAdding ? 'fas fa-heart' : 'far fa-heart';
                }
            }
            if(action === 'translate') {
                btn.textContent = 'Translating...'; btn.disabled = true;
                const txt = document.getElementById(`raw-lyrics-${songId}`)?.textContent || document.getElementById(`lyrics-${songId}`)?.textContent;
                const res = await translateLyricsAPI(txt);
                if(res.success) {
                    document.getElementById(`lyrics-${songId}`).innerHTML = `<em style="color:var(--accent-primary);display:block;margin-bottom:15px;">Translated:</em>${sanitizeHTML(res.translatedText)}`;
                    btn.textContent = 'Translated';
                } else btn.textContent = 'Failed';
            }
            if (action === 'mix') {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...'; btn.disabled = true;
                const mixId = `mix-container-${btoa(`${encodeURIComponent(title)}-${encodeURIComponent(artist)}`).substring(0, 16)}`;
                const mixContainer = document.getElementById(mixId);
                if (mixContainer) {
                    mixContainer.innerHTML = `
                        <h4 style="margin: 20px 0 15px; color: var(--accent-primary);">🎧 Your AI Mix</h4>
                        <div id="mixStreamText-${mixId}" class="streaming-text" style="font-size: 0.95rem; line-height: 1.5; white-space: pre-wrap; color: var(--text-secondary);"></div>
                    `;
                    const streamText = document.getElementById(`mixStreamText-${mixId}`);

                    let accText = '';
                    await fetchRecommendationsStreamAPI(
                        artist, 
                        title,
                        (chunk) => { 
                            accText += chunk;
                            let display = accText;
                            const codeBlockIdx = display.indexOf('```');
                            if (codeBlockIdx !== -1) display = display.substring(0, codeBlockIdx);
                            else if (display.trim().startsWith('[')) display = "Mixing your customized tracklist...";
                            if(streamText) streamText.innerHTML = sanitizeHTML(display).replace(/\n/g, '<br>'); 
                        },
                        (msg) => { if(streamText) streamText.innerHTML += `<br><em style="color:var(--accent-secondary);"><i class="fas fa-spinner fa-spin"></i> ${sanitizeHTML(msg)}</em>`; },
                        (recommendations) => {
                            if (recommendations && recommendations.length > 0) {
                                mixContainer.innerHTML = `
                                    <h4 style="margin: 20px 0 15px; color: var(--accent-primary);">🎧 Your AI Mix</h4>
                                    <div class="recommendations-grid">
                                    ${recommendations.map(r=>`<div class="rec-card btn-searchable" data-query="${sanitizeHTML(r.title)} by ${sanitizeHTML(r.artist)}"><h4>${sanitizeHTML(r.title)}</h4><p>${sanitizeHTML(r.artist)}</p></div>`).join('')}
                                    </div>`;
                                btn.innerHTML = '<i class="fas fa-check"></i> Mix Created';
                            } else {
                                mixContainer.innerHTML = '<p class="error">No mix found.</p>';
                                btn.innerHTML = 'Error';
                            }
                        },
                        (err) => {
                            mixContainer.innerHTML = '<p class="error">Error generating mix.</p>';
                            btn.innerHTML = 'Error';
                        }
                    );
                }
            }
            if(action === 'share') {
                navigator.clipboard.writeText(btn.dataset.link).then(() => {
                    const o = btn.innerHTML; btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => btn.innerHTML = o, 2000);
                });
            }
        }

        if (target.closest('.logout-btn')) {
            e.preventDefault();
            localStorage.removeItem('adagio_token');
            window.userLibrary = {};
            alert("Signed out.");
            const { navigate } = await import('./router.js'); 
            navigate('signup.html');
        }
    });
});

window.addEventListener('adagio-route-change', (e) => {
    const url = e.detail.url;
    
    // Always call these; they have internal guards
    initSearch();
    initAudioCapture();
    initUpload();

    // Call conditionally
    if (url.includes('signin.html') || url.includes('signup.html')) {
        initAuth();
    } else if (url.includes('library.html')) {
        initLibrary();
    }
    
    // Update active nav link
    document.querySelectorAll('.sidebar a').forEach(a => {
        a.classList.remove('active');
        if (a.getAttribute('href') && url.endsWith(a.getAttribute('href'))) {
            a.classList.add('active');
        } else if (url === '/' && a.getAttribute('href') === 'index.html') {
            a.classList.add('active');
        }
    });
});
