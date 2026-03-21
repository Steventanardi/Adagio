import { getSavedTheme, setAdagioTheme, saveToHistory, getHistory, sanitizeHTML } from './utils.js';
import { fetchLibraryAPI, searchIntelligentAPI, fetchYouTubeVideoAPI, uploadMicAudioAPI, uploadInDeviceAudioAPI, uploadFileAPI, toggleFavoriteAPI, translateLyricsAPI, fetchRecommendationsAPI } from './api.js';
import { startVisualizer } from './audio.js';
import { updateAuthUI, updateFileName, renderSongResult, explainLyricsUI, showTimeoutFeedback, clearTimeoutFeedback, initFloatingPlayer } from './ui.js';

document.addEventListener('DOMContentLoaded', async function () {
    console.log("Adagio Modules Loaded");

    const searchInput = document.getElementById('searchInput');
    const intelligentSearchButton = document.getElementById('intelligentSearchButton');
    const resultContainer = document.getElementById('resultContainer');
    const historyList = document.getElementById('searchHistory');
    const historySection = document.getElementById('historySection');
    const toggleHistoryBtn = document.getElementById('toggleHistory');
    const historyWrapper = document.getElementById('historyWrapper');

    const startListeningMicButton = document.getElementById('startListeningMic');
    const micStatus = document.getElementById('micStatus');
    const liveResultMic = document.getElementById('liveResultMic');

    const startRecognitionButton = document.getElementById('startRecognition');
    const stopRecognitionButton = document.getElementById('stopRecognition');
    const recognitionResult = document.getElementById('recognitionResult');
    const recognitionStatus = document.getElementById('recognitionStatus');
    const recognitionCard = document.getElementById('recognitionCard');

    const musicInput = document.getElementById('musicInput');
    const uploadResult = document.getElementById('uploadResult');
    const uploadButton = document.getElementById('uploadButton');
    const dropZone = document.getElementById('dropZone');
    const fileNameDisplay = document.getElementById('fileNameDisplay');

    const humToggle = document.getElementById('humToggle');
    const voiceSearchButton = document.getElementById('voiceSearchButton');

    let mediaRecorder;
    let audioChunks = [];
    let isListening = false;
    let displayStream;
    let currentAnim;

    const themeToggle = document.getElementById('themeToggle');
    setAdagioTheme(getSavedTheme(), themeToggle);

    window.userLibrary = {};
    const initLibrary = async () => {
        const res = await fetchLibraryAPI();
        if (res.success) {
            window.userLibrary = res.library;
            updateAuthUI(true);
        } else {
            if(res.error || res.notLoggedIn) updateAuthUI(false);
            if (res.error && res.error.message && res.error.message.includes('expired')) {
                localStorage.removeItem('adagio_token');
            }
        }
    };
    initLibrary();
    initFloatingPlayer();

    themeToggle?.addEventListener('click', () => {
        setAdagioTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark', themeToggle);
    });

    // Dynamically stop/start background blobs based on scroll position (not on AI section)
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            document.body.classList.remove('premium-bg');
        } else if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
            document.body.classList.add('premium-bg');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch (e.key.toLowerCase()) {
            case 's': e.preventDefault(); searchInput?.focus(); break;
            case 'm': e.preventDefault(); startListeningMicButton?.click(); break;
            case 'u': window.location.href = 'upload.html'; break;
            case 'h': window.location.href = 'index.html'; break;
        }
    });

    musicInput?.addEventListener('change', (e) => updateFileName(fileNameDisplay, e.target.files[0]));

    if (dropZone && musicInput) {
        dropZone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') musicInput.click();
        });
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); }));
        ['dragenter', 'dragover'].forEach(evt => dropZone.addEventListener(evt, () => dropZone.classList.add('dragover')));
        ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, () => dropZone.classList.remove('dragover')));
        dropZone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files.length > 0) {
                musicInput.files = e.dataTransfer.files;
                updateFileName(fileNameDisplay, e.dataTransfer.files[0]);
            }
        });
    }

    const renderHistoryUI = () => {
        if (!historyList || !historySection) return;
        const history = getHistory();
        if (history.length > 0) {
            historySection.classList.remove('hidden');
            historyList.innerHTML = '';
            history.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                li.className = 'history-item';
                historyList.appendChild(li);
            });
        } else {
            historySection.classList.add('hidden');
        }
    };
    renderHistoryUI();

    let isHumMode = false;
    humToggle?.addEventListener('click', () => {
        isHumMode = !isHumMode;
        humToggle.classList.toggle('active', isHumMode);
        searchInput.placeholder = isHumMode ? "Hum or describe the lyrics here..." : "Search for artists, songs, or lyrics...";
    });

    const triggerSearch = async (queryOverride) => {
        let originalQuery = queryOverride || searchInput?.value.trim() || '';
        if (!originalQuery) { alert('What would you like to find?'); return; }

        let apiQuery = isHumMode && !queryOverride ? `[HUMMING/SINGING MODE] The user is humming or describing phonetically: ${originalQuery}. Find the closest matching songs.` : originalQuery;

        showTimeoutFeedback(resultContainer, 'Adagio is thinking...');
        
        try {
            const result = await searchIntelligentAPI(apiQuery);
            clearTimeoutFeedback();
            if (result.success && result.songs) {
                resultContainer.innerHTML = `<h3 class="recommendations-title">🔍 Recommendations</h3>`;
                result.songs.forEach((song, index) => {
                    const songCard = document.createElement('div');
                    songCard.className = 'song-card-wrapper';
                    resultContainer.appendChild(songCard);
                    
                    // Only auto-update the floating player for the very first (top) result
                    const shouldAutoPlay = (index === 0);
                    
                    fetchYouTubeVideoAPI(song.title, song.artist).then(videoData => {
                        renderSongResult({ 
                            ...song, 
                            videoUrl: videoData.success ? videoData.videoUrl : null,
                            autoPlayTrack: shouldAutoPlay 
                        }, songCard);
                    }).catch(() => renderSongResult({ ...song, autoPlayTrack: shouldAutoPlay }, songCard));
                });
            } else {
                resultContainer.innerHTML = `<div class="result-card"><p class="error">${sanitizeHTML(result.message || 'No results found.')}</p></div>`;
            }
            if (!queryOverride) {
                saveToHistory(originalQuery);
                renderHistoryUI();
            }
        } catch (error) {
            clearTimeoutFeedback();
            resultContainer.innerHTML = '<div class="result-card"><p class="error">Something went wrong. Please try again.</p></div>';
        }
    };

    intelligentSearchButton?.addEventListener('click', () => triggerSearch());

    toggleHistoryBtn?.addEventListener('click', () => {
        const isCollapsed = historyWrapper.classList.toggle('collapsed');
        toggleHistoryBtn.classList.toggle('active', !isCollapsed);
    });

    if (voiceSearchButton && searchInput) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false; recognition.lang = 'en-US'; recognition.interimResults = false;
            voiceSearchButton.addEventListener('click', () => {
                if (voiceSearchButton.classList.contains('listening')) recognition.stop();
                else { recognition.start(); voiceSearchButton.classList.add('listening'); }
            });
            recognition.onresult = (e) => {
                searchInput.value = e.results[0][0].transcript;
                voiceSearchButton.classList.remove('listening');
                intelligentSearchButton.click();
            };
            recognition.onerror = () => voiceSearchButton.classList.remove('listening');
            recognition.onend = () => voiceSearchButton.classList.remove('listening');
        } else voiceSearchButton.style.display = 'none';
    }

    const stopMicUI = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
        if (currentAnim && currentAnim.animationId) cancelAnimationFrame(currentAnim.animationId);
        if (currentAnim && currentAnim.audioContext) currentAnim.audioContext.close();
        if (currentAnim && currentAnim.cleanup) currentAnim.cleanup();
        isListening = false;
        
        const core = document.querySelector('.mic-ui-core');
        startListeningMicButton?.classList.remove('listening', 'pulsing');
        core?.classList.remove('active', 'listening');
        
        const btnText = startListeningMicButton?.querySelector('span');
        if (btnText) btnText.textContent = 'Start Listening';
        if (micStatus) micStatus.textContent = 'Tap to start over';
    };

    startListeningMicButton?.addEventListener('click', async () => {
        if (!isListening) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                currentAnim = startVisualizer(stream);
                const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
                mediaRecorder = new MediaRecorder(stream, { mimeType });
                audioChunks = [];
                mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    if (audioBlob.size < 50000) {
                        liveResultMic.innerHTML = `<div class="result-card"><p class="error">Recording was too quiet.</p></div>`;
                        stopMicUI(); return;
                    }
                    const formData = new FormData(); formData.append('musicFile', audioBlob, 'micAudio.webm');
                    showTimeoutFeedback(liveResultMic, 'Analyzing sound waves...');
                    try {
                        const controller = new AbortController();
                        const id = setTimeout(() => controller.abort(), 45000);
                        const result = await uploadMicAudioAPI(formData, controller);
                        clearTimeout(id); clearTimeoutFeedback();
                        if (result.success) {
                            const song = result.metadata || result;
                            fetchYouTubeVideoAPI(song.title, song.artist).then(videoData => {
                                renderSongResult({
                                    ...song,
                                    videoUrl: videoData.success ? videoData.videoUrl : null,
                                    autoPlayTrack: true
                                }, liveResultMic);
                            }).catch(() => renderSongResult({ ...song, autoPlayTrack: true }, liveResultMic));
                        } else {
                            liveResultMic.innerHTML = `<div class="result-card"><p class="error">${sanitizeHTML(result.message)}</p></div>`;
                        }
                    } catch (e) { clearTimeoutFeedback(); liveResultMic.innerHTML = `<div class="result-card"><p class="error">Upload failed.</p></div>`; }
                    stopMicUI();
                };
                mediaRecorder.start(1000);
                startListeningMicButton.classList.add('listening', 'pulsing');
                const core = document.querySelector('.mic-ui-core');
                core?.classList.add('active', 'listening');
                if (micStatus) micStatus.textContent = 'Adagio is listening...';
                isListening = true;
                setTimeout(() => stopMicUI(), 15000);
            } catch (err) { if(micStatus) micStatus.textContent = '❌ Microphone blocked.'; }
        } else stopMicUI();
    });

    const resetInDeviceUI = () => {
        if(recognitionStatus) recognitionStatus.textContent = 'Ready to capture';
        
        const core = document.querySelector('.mic-ui-core');
        core?.classList.remove('active', 'capturing');
        
        if(startRecognitionButton) {
            startRecognitionButton.disabled = false;
            startRecognitionButton.style.display = 'flex';
        }
        if(stopRecognitionButton) {
            stopRecognitionButton.disabled = true;
            stopRecognitionButton.style.display = 'none';
        }
        if (displayStream) displayStream.getTracks().forEach(track => track.stop());
    };

    startRecognitionButton?.addEventListener('click', async () => {
        try {
            displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            const audioTrack = displayStream.getAudioTracks()[0];
            if (!audioTrack) throw new Error("No system audio track.");
            mediaRecorder = new MediaRecorder(new MediaStream([audioTrack]), { mimeType: 'audio/webm' });
            audioChunks = [];
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = async () => {
                if (audioChunks.length === 0) { resetInDeviceUI(); return; }
                const formData = new FormData(); formData.append('musicFile', new Blob(audioChunks, { type: 'audio/webm' }), 'indeviceAudio.webm');
                showTimeoutFeedback(recognitionResult, 'Processing internal audio...');
                try {
                    const controller = new AbortController(); const id = setTimeout(() => controller.abort(), 45000);
                    const result = await uploadInDeviceAudioAPI(formData, controller);
                    clearTimeout(id); clearTimeoutFeedback();
                    if (result.success) {
                        const song = result.metadata || result;
                        fetchYouTubeVideoAPI(song.title, song.artist).then(videoData => {
                            renderSongResult({
                                ...song,
                                videoUrl: videoData.success ? videoData.videoUrl : null,
                                autoPlayTrack: true
                            }, recognitionResult);
                        }).catch(() => renderSongResult({ ...song, autoPlayTrack: true }, recognitionResult));
                    } else recognitionResult.innerHTML = `<div class="result-card"><p class="error">Failed.</p></div>`;
                } catch(e) { clearTimeoutFeedback(); recognitionResult.innerHTML = `<div class="result-card"><p class="error">Error.</p></div>`; }
                resetInDeviceUI();
            };
            mediaRecorder.start();
            if(recognitionStatus) recognitionStatus.textContent = 'Capturing... Play some music now!';
            
            const core = document.querySelector('.mic-ui-core');
            core?.classList.add('active', 'capturing');
            
            if(startRecognitionButton) startRecognitionButton.style.display = 'none';
            if(stopRecognitionButton) {
                stopRecognitionButton.disabled = false;
                stopRecognitionButton.style.display = 'flex';
            }
            setTimeout(() => { if (mediaRecorder.state === "recording") mediaRecorder.stop(); }, 10000);
        } catch (err) { alert('Screen capture permission is required.'); }
    });
    stopRecognitionButton?.addEventListener('click', () => { if (mediaRecorder) mediaRecorder.stop(); resetInDeviceUI(); });

    uploadButton?.addEventListener('click', async () => {
        const file = musicInput?.files[0];
        if (!file) { alert("Please select a file first."); return; }
        const formData = new FormData(); formData.append('musicFile', file);
        showTimeoutFeedback(uploadResult, 'Finalizing identification...');
        try {
            const controller = new AbortController(); const id = setTimeout(() => controller.abort(), 60000);
            const result = await uploadFileAPI(formData, controller);
            clearTimeout(id); clearTimeoutFeedback();
            if (result.success) {
                const song = result.metadata || result;
                fetchYouTubeVideoAPI(song.title, song.artist).then(videoData => {
                    renderSongResult({
                        ...song,
                        videoUrl: videoData.success ? videoData.videoUrl : null,
                        autoPlayTrack: true
                    }, uploadResult);
                }).catch(() => renderSongResult({ ...song, autoPlayTrack: true }, uploadResult));
            } else uploadResult.innerHTML = `<div class="result-card"><p class="error">${sanitizeHTML(result.message)}</p></div>`;
        } catch(e) { clearTimeoutFeedback(); uploadResult.innerHTML = `<div class="result-card"><p class="error">Upload timed out or failed.</p></div>`; }
    });

    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        
        if (target.matches('.mood-chip')) {
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
            musicInput?.click();
        }

        if (target.matches('.history-item')) {
            if(searchInput) searchInput.value = target.textContent;
            intelligentSearchButton?.click();
            historyWrapper?.classList.add('collapsed');
            toggleHistoryBtn?.classList.remove('active');
        }

        const recCard = target.closest('.btn-searchable');
        if (recCard) {
            if(searchInput) searchInput.value = recCard.dataset.query;
            intelligentSearchButton?.click();
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
                if(!token) { alert("Please sign in"); window.location.href = 'signin.html'; return; }
                const isAdding = !btn.classList.contains('active');
                btn.classList.toggle('active');
                btn.querySelector('i').className = isAdding ? 'fas fa-heart' : 'far fa-heart';
                try {
                    const songData = isAdding ? JSON.parse(document.querySelector(`[data-song-id="${songId}"]`)?.dataset.fullJson || '{}') : null;
                    const res = await toggleFavoriteAPI(songId, songData, isAdding, token);
                    if(!res.success) throw new Error("Failed");
                    if(isAdding) window.userLibrary[songId] = songData; else delete window.userLibrary[songId];
                } catch(e) {
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
            if(action === 'mix') {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...'; btn.disabled = true;
                const res = await fetchRecommendationsAPI(artist, title);
                if(res.success && res.recommendations.length > 0) {
                    document.getElementById(`mix-container-${btoa(encodeURIComponent(title)+'-'+encodeURIComponent(artist)).substring(0,16)}`).innerHTML = `
                        <h4 style="margin: 20px 0 15px; color: var(--accent-primary);">🎧 Your AI Mix</h4>
                        <div class="recommendations-grid">
                        ${res.recommendations.map(r=>`<div class="rec-card btn-searchable" data-query="${sanitizeHTML(r.title)} by ${sanitizeHTML(r.artist)}"><h4>${sanitizeHTML(r.title)}</h4><p>${sanitizeHTML(r.artist)}</p></div>`).join('')}
                        </div>`;
                    btn.innerHTML = '<i class="fas fa-check"></i> Mix Created';
                } else btn.innerHTML = 'Error';
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
            window.location.href = 'signup.html';
        }
    });
});
