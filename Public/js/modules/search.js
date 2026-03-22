import { saveToHistory, getHistory, sanitizeHTML } from '../utils.js';
import { searchIntelligentStreamAPI, fetchYouTubeVideoAPI } from '../api.js';
import { renderSongResult, clearTimeoutFeedback } from '../ui.js';

let isHumMode = false;

export function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const intelligentSearchButton = document.getElementById('intelligentSearchButton');
    const resultContainer = document.getElementById('resultContainer');
    const historyList = document.getElementById('searchHistory');
    const historySection = document.getElementById('historySection');
    const toggleHistoryBtn = document.getElementById('toggleHistory');
    const historyWrapper = document.getElementById('historyWrapper');
    const humToggle = document.getElementById('humToggle');
    const voiceSearchButton = document.getElementById('voiceSearchButton');

    if (!searchInput || !intelligentSearchButton) return;

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

    humToggle?.addEventListener('click', () => {
        isHumMode = !isHumMode;
        humToggle.classList.toggle('active', isHumMode);
        searchInput.placeholder = isHumMode ? "Hum or describe the lyrics here..." : "Search for artists, songs, or lyrics...";
    });

    const triggerSearch = async (queryOverride) => {
        let originalQuery = queryOverride || searchInput.value.trim() || '';
        if (!originalQuery) { alert('What would you like to find?'); return; }

        let apiQuery = isHumMode && !queryOverride ? `[HUMMING/SINGING MODE] The user is humming or describing phonetically: ${originalQuery}. Find the closest matching songs.` : originalQuery;

        clearTimeoutFeedback();
        resultContainer.innerHTML = `
            <div class="result-card streaming-card">
                <h3 style="margin-bottom: 15px; color: var(--accent-primary);"><i class="fas fa-magic"></i> Adagio is thinking...</h3>
                <div id="streamingText" class="streaming-text" style="font-size: 1.1rem; line-height: 1.6; white-space: pre-wrap; color: var(--text-secondary);"></div>
            </div>`;
        const streamingText = document.getElementById('streamingText');

        let accText = '';
        await searchIntelligentStreamAPI(
            apiQuery,
            (chunk) => {
                accText += chunk;
                let display = accText;
                const codeBlockIdx = display.indexOf('```');
                if (codeBlockIdx !== -1) {
                    display = display.substring(0, codeBlockIdx);
                } else if (display.trim().startsWith('[')) {
                    display = "Curating your optimal tracks...";
                }
                if (streamingText) streamingText.innerHTML = sanitizeHTML(display).replace(/\n/g, '<br>');
            },
            (message) => {
                if (streamingText) streamingText.innerHTML += `<br><br><em style="color:var(--accent-secondary);"><i class="fas fa-spinner fa-spin"></i> ${sanitizeHTML(message)}</em>`;
            },
            (songs) => {
                if (songs && songs.length > 0) {
                    resultContainer.innerHTML = `<h3 class="recommendations-title">🔍 Recommendations</h3>`;
                    songs.forEach((song, index) => {
                        const songCard = document.createElement('div');
                        songCard.className = 'song-card-wrapper';
                        resultContainer.appendChild(songCard);
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
                    resultContainer.innerHTML = `<div class="result-card"><p class="error">${sanitizeHTML('No results found.')}</p></div>`;
                }
                if (!queryOverride) {
                    saveToHistory(originalQuery);
                    renderHistoryUI();
                }
            },
            (error) => {
                resultContainer.innerHTML = '<div class="result-card"><p class="error">Something went wrong. Please try again.</p></div>';
            }
        );
    };

    intelligentSearchButton.addEventListener('click', () => triggerSearch());

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
}
