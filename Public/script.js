document.addEventListener('DOMContentLoaded', async function () {
    console.log("JavaScript Loaded: Adagio Music Recognition Ready");

    const searchInput = document.getElementById('searchInput');
    const intelligentSearchButton = document.getElementById('intelligentSearchButton');
    const resultContainer = document.getElementById('resultContainer');
    const historyList = document.getElementById('searchHistory');
    const historySection = document.getElementById('historySection');
    const toggleHistoryBtn = document.getElementById('toggleHistory');
    const historyWrapper = document.getElementById('historyWrapper');

    // Microphone
    const startListeningMicButton = document.getElementById('startListeningMic');
    const micStatus = document.getElementById('micStatus');
    const liveResultMic = document.getElementById('liveResultMic');

    // In-Device
    const startRecognitionButton = document.getElementById('startRecognition');
    const stopRecognitionButton = document.getElementById('stopRecognition');
    const recognitionResult = document.getElementById('recognitionResult');
    const recognitionStatus = document.getElementById('recognitionStatus');
    const recognitionCard = document.getElementById('recognitionCard');

    // Upload
    const musicInput = document.getElementById('musicInput');
    const uploadResult = document.getElementById('uploadResult');
    const uploadButton = document.getElementById('uploadButton');
    const dropZone = document.getElementById('dropZone');
    const fileNameDisplay = document.getElementById('fileNameDisplay');

    // Mix/Hum
    const humToggle = document.getElementById('humToggle');
    const voiceSearchButton = document.getElementById('voiceSearchButton');

    let mediaRecorder;
    let audioChunks = [];
    let isListening = false;
    let displayStream;
    let audioContext;
    let analyser;
    let dataArray;
    let animationId;

    // --- Theme Initialization ---
    const themeToggle = document.getElementById('themeToggle');
    const getSavedTheme = () => localStorage.getItem('adagio_theme') || 'dark';

    // Global Library cache initialization
    window.userLibrary = {};
    const fetchLibrary = async () => {
        const token = localStorage.getItem('adagio_token');
        if (!token) {
            updateAuthUI(false);
            return;
        }
        try {
            const res = await fetch('/api/library', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                window.userLibrary = data.library;
                updateAuthUI(true);
            } else if (data.message && (data.message.includes('expired') || data.message.includes('signature') || data.message.includes('token'))) {
                console.warn("Session invalid, clearing token");
                localStorage.removeItem('adagio_token');
                updateAuthUI(false);
            }
        } catch (e) {
            console.error("Initial library fetch failed", e);
            updateAuthUI(false);
        }
    };
    fetchLibrary();
    const setAdagioTheme = (theme) => {
        document.body.dataset.theme = theme;
        localStorage.setItem('adagio_theme', theme);
        const icon = themeToggle?.querySelector('i');
        if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    };

    setAdagioTheme(getSavedTheme());

    themeToggle?.addEventListener('click', () => {
        setAdagioTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark');
    });



    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key.toLowerCase()) {
            case 's':
                e.preventDefault();
                searchInput?.focus();
                break;
            case 'm':
                e.preventDefault();
                startListeningMicButton?.click();
                break;
            case 'u':
                window.location.href = 'upload.html';
                break;
            case 'h':
                window.location.href = 'index.html';
                break;
        }
    });

    const updateFileName = (file) => {
        if (!fileNameDisplay) return;
        fileNameDisplay.innerText = file ? `Selected: ${file.name}` : "Select or Drop Audio File";
        const subtext = fileNameDisplay.nextElementSibling;
        if (subtext && subtext.tagName === 'SPAN') {
            subtext.innerText = file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "Supports MP3, WAV, M4A, etc.";
        }
    };

    musicInput?.addEventListener('change', (e) => updateFileName(e.target.files[0]));

    if (dropZone && musicInput) {
        dropZone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
                musicInput.click();
            }
        });

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); });
        });

        ['dragenter', 'dragover'].forEach(evt => {
            dropZone.addEventListener(evt, () => dropZone.classList.add('dragover'));
        });

        ['dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, () => dropZone.classList.remove('dragover'));
        });

        dropZone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files.length > 0) {
                musicInput.files = e.dataTransfer.files;
                updateFileName(e.dataTransfer.files[0]);
            }
        });
    }


    // --- Intelligent Search ---
    window.setMood = function (mood) {
        if (!searchInput) return;
        const prompts = [
            `Find me some ${mood} music`,
            `Suggest some ${mood} tracks`,
            `What are some good ${mood} songs?`,
            `I'm in the mood for ${mood} music`
        ];
        const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
        searchInput.value = randomPrompt;
        intelligentSearchButton.click();
    };

    if (intelligentSearchButton) {
        let isHumMode = false;

        if (humToggle) {
            humToggle.addEventListener('click', () => {
                isHumMode = !isHumMode;
                humToggle.classList.toggle('active', isHumMode);
                searchInput.placeholder = isHumMode ? "Hum or describe the lyrics here..." : "Search for artists, songs, or lyrics...";
            });
        }

        intelligentSearchButton.addEventListener('click', async () => {
            let originalQuery = searchInput.value.trim();
            if (!originalQuery) {
                alert('What would you like to find?');
                return;
            }

            let apiQuery = originalQuery;
            if (isHumMode) {
                apiQuery = `[HUMMING/SINGING MODE] The user is humming or describing phonetically: ${originalQuery}. Find the closest matching songs.`;
            }

            resultContainer.innerHTML = '<div class="result-card"><p>✨ Adagio is thinking...</p></div>';

            try {
                const response = await fetch('/intelligent-search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: apiQuery }),
                });

                if (!response.ok) throw new Error(`Server error: ${response.status}`);
                const result = await response.json();

                if (result.success && result.songs) {
                    resultContainer.innerHTML = `<h3 style="margin-bottom: 20px; color: var(--accent-primary);">🔍 Recommendations</h3>`;

                    result.songs.forEach(song => {
                        const songCard = document.createElement('div');
                        songCard.className = 'song-card-wrapper';
                        songCard.style.marginBottom = '20px';
                        resultContainer.appendChild(songCard);

                        // Fetch MV asynchronously and then render full card
                        fetch(`/api/youtube-video?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`)
                            .then(res => res.json())
                            .then(videoData => {
                                const fullData = { ...song, videoUrl: videoData.success ? videoData.videoUrl : null };
                                renderSongResult(fullData, songCard);
                            })
                            .catch(() => {
                                renderSongResult(song, songCard);
                            });
                    });
                } else {
                    resultContainer.innerHTML = `<div class="result-card"><p class="error">${result.message || 'No results found.'}</p></div>`;
                }
            } catch (error) {
                console.error('Error fetching search results:', error);
                resultContainer.innerHTML = '<div class="result-card"><p class="error">Something went wrong. Please try again.</p></div>';
            }

            // Update history
            if (historyList) {
                saveToHistory(originalQuery);
                renderHistory();
            }
        });

        if (toggleHistoryBtn && historyWrapper) {
            toggleHistoryBtn.addEventListener('click', () => {
                const isCollapsed = historyWrapper.classList.toggle('collapsed');
                toggleHistoryBtn.classList.toggle('active', !isCollapsed);
            });
        }
    }

    function saveToHistory(query) {
        // Don't save system-tagged queries to history if they somehow get here
        if (query.includes('[HUMMING/SINGING MODE]')) return;

        const history = JSON.parse(localStorage.getItem('adagio_history') || '[]');
        if (!history.includes(query)) {
            history.unshift(query);
            localStorage.setItem('adagio_history', JSON.stringify(history.slice(0, 10)));
        }
    }

    function renderHistory() {
        if (!historyList || !historySection) return;
        let history = JSON.parse(localStorage.getItem('adagio_history') || '[]');

        // Cleanup existing system-tagged items
        const originalLength = history.length;
        history = history.filter(item => !item.includes('[HUMMING/SINGING MODE]'));
        if (history.length !== originalLength) {
            localStorage.setItem('adagio_history', JSON.stringify(history));
        }

        if (history.length > 0) {
            historySection.classList.remove('hidden');
            historyList.innerHTML = '';
            history.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                li.onclick = () => {
                    searchInput.value = item;
                    intelligentSearchButton.click();
                    if (historyWrapper) historyWrapper.classList.add('collapsed');
                    if (toggleHistoryBtn) toggleHistoryBtn.classList.remove('active');
                };
                historyList.appendChild(li);
            });
        } else {
            historySection.classList.add('hidden');
        }
    }

    renderHistory();

    // --- Voice Search ---
    if (voiceSearchButton && searchInput) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.lang = 'en-US';
            recognition.interimResults = false;

            voiceSearchButton.addEventListener('click', () => {
                if (voiceSearchButton.classList.contains('listening')) {
                    recognition.stop();
                } else {
                    recognition.start();
                    voiceSearchButton.classList.add('listening');
                }
            });

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                searchInput.value = transcript;
                voiceSearchButton.classList.remove('listening');
                intelligentSearchButton.click();
            };

            recognition.onerror = () => {
                voiceSearchButton.classList.remove('listening');
            };

            recognition.onend = () => {
                voiceSearchButton.classList.remove('listening');
            };
        } else {
            voiceSearchButton.style.display = 'none';
        }
    }

    // --- Microphone Recognition ---
    if (startListeningMicButton) {
        startListeningMicButton.addEventListener('click', async function () {
            if (!isListening) {
                try {
                    console.log("🎤 Requesting microphone access...");
                    // Using basic constraints first for maximum compatibility
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    startVisualizer(stream);

                    // Detect best supported mime type
                    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                        ? 'audio/webm;codecs=opus'
                        : 'audio/webm';

                    console.log(`🎤 Recording with mimeType: ${mimeType}`);
                    mediaRecorder = new MediaRecorder(stream, { mimeType });
                    audioChunks = [];

                    mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunks.push(event.data); };
                    mediaRecorder.onstop = async () => {
                        console.log(`🎤 Recording stopped. Collected ${audioChunks.length} chunks.`);
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        console.log(`📦 Final blob size: ${audioBlob.size} bytes`);

                        if (audioBlob.size < 50000) {
                            liveResultMic.innerHTML = `<div class="result-card"><p class="error">Recording was too quiet or interrupted. Please try again.</p></div>`;
                            stopMicRecognition();
                            return;
                        }

                        const formData = new FormData();
                        formData.append('musicFile', audioBlob, 'micAudio.webm');

                        liveResultMic.innerHTML = `<div class="result-card"><p>✨ Analyzing sound waves...</p></div>`;

                        try {
                            const controller = new AbortController();
                            const id = setTimeout(() => controller.abort(), 45000); // 45s timeout

                            const response = await fetch('/upload-mic-audio', {
                                method: 'POST',
                                body: formData,
                                signal: controller.signal
                            });

                            clearTimeout(id);
                            const result = await response.json();
                            if (result.success) {
                                renderSongResult(result.metadata || result, liveResultMic);
                            } else {
                                liveResultMic.innerHTML = `<div class="result-card"><p class="error">${result.message || "Adagio couldn't quite catch that one. Try moving closer!"}</p></div>`;
                            }
                        } catch (error) {
                            console.error('Error uploading audio:', error);
                            const message = error.name === 'AbortError' ? 'Request timed out. Please try again.' : 'Upload failed. Check your connection.';
                            liveResultMic.innerHTML = `<div class="result-card"><p class="error">${message}</p></div>`;
                        }

                        startListeningMicButton.classList.remove('pulsing');
                        micStatus.textContent = 'Tap to start again';
                        isListening = false;
                    };

                    mediaRecorder.onerror = (e) => console.error("🎤 MediaRecorder Error:", e.error);

                    mediaRecorder.start(1000); // Collect data every 1 second
                    startListeningMicButton.classList.add('listening');
                    startListeningMicButton.classList.add('pulsing');
                    const micCore = document.querySelector('.mic-ui-core');
                    if (micCore) micCore.classList.add('active');
                    const btnText = startListeningMicButton.querySelector('span');
                    if (btnText) btnText.textContent = 'Listening...';
                    micStatus.textContent = 'Adagio is listening...';
                    isListening = true;

                    // Stop automatically after 15 seconds
                    setTimeout(() => {
                        if (isListening && mediaRecorder && mediaRecorder.state === 'recording') {
                            console.log("⏰ Auto-stopping recording after 15s");
                            stopMicRecognition();
                        }
                    }, 15000);
                } catch (err) {
                    console.error('Microphone access error:', err);
                    alert('Please allow microphone access to use this feature.');
                    micStatus.textContent = '❌ Microphone blocked.';
                }
            } else {
                stopMicRecognition();
            }
        });
    }

    async function startVisualizer(stream) {
        const canvas = document.getElementById('visualizer');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Set higher resolution internal size
        const size = 420;
        canvas.width = size * window.devicePixelRatio;
        canvas.height = size * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256; // 128 bins
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        const centerX = size / 2;
        const centerY = size / 2;
        const innerRadius = 95; // Just outside the 180px button (90px radius)

        function draw() {
            animationId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, size, size);

            for (let i = 0; i < bufferLength; i++) {
                const value = dataArray[i];
                const percent = value / 255;
                const height = percent * 60; // Max amplitude length
                const angle = (i / bufferLength) * Math.PI * 2;

                const xStart = centerX + Math.cos(angle) * innerRadius;
                const yStart = centerY + Math.sin(angle) * innerRadius;
                const xEnd = centerX + Math.cos(angle) * (innerRadius + height);
                const yEnd = centerY + Math.sin(angle) * (innerRadius + height);

                // Gradient based on distance from center
                const gradient = ctx.createLinearGradient(xStart, yStart, xEnd, yEnd);
                gradient.addColorStop(0, 'rgba(0, 242, 255, 0.8)');
                gradient.addColorStop(1, 'rgba(112, 0, 255, 0.2)');

                ctx.strokeStyle = gradient;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';

                ctx.beginPath();
                ctx.moveTo(xStart, yStart);
                ctx.lineTo(xEnd, yEnd);
                ctx.stroke();

                // Add a subtle glow at the tip
                if (value > 150) {
                    ctx.save();
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#00f2ff';
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }
        draw();
    }

    function stopMicRecognition() {
        if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
        if (animationId) cancelAnimationFrame(animationId);
        if (audioContext) audioContext.close();
        isListening = false;
        startListeningMicButton.classList.remove('listening');
        startListeningMicButton.classList.remove('pulsing');
        const micCore = document.querySelector('.mic-ui-core');
        if (micCore) micCore.classList.remove('active');
        const btnText = startListeningMicButton.querySelector('span');
        if (btnText) btnText.textContent = 'Start Listening';
        micStatus.textContent = 'Tap to start over';
    }

    // --- In-Device Recognition ---
    if (startRecognitionButton) {
        startRecognitionButton.addEventListener('click', async function () {
            try {
                displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                const audioTrack = displayStream.getAudioTracks()[0];
                if (!audioTrack) throw new Error("No system audio track found.");

                const systemAudioStream = new MediaStream([audioTrack]);
                mediaRecorder = new MediaRecorder(systemAudioStream, { mimeType: 'audio/webm' });
                audioChunks = [];

                mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunks.push(event.data); };
                mediaRecorder.onstop = async () => {
                    if (audioChunks.length === 0) {
                        recognitionResult.innerHTML = `<div class="result-card"><p class="error">No audio detected.</p></div>`;
                        resetInDeviceUI();
                        return;
                    }

                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const formData = new FormData();
                    formData.append('musicFile', audioBlob, 'indeviceAudio.webm');

                    recognitionResult.innerHTML = `<div class="result-card"><p>✨ Processing internal audio...</p></div>`;

                    try {
                        const controller = new AbortController();
                        const id = setTimeout(() => controller.abort(), 45000);

                        const response = await fetch('/recognize-indevice-audio', {
                            method: 'POST',
                            body: formData,
                            signal: controller.signal
                        });

                        clearTimeout(id);
                        const result = await response.json();
                        if (result.success) {
                            renderSongResult(result.metadata || result, recognitionResult);
                        } else {
                            recognitionResult.innerHTML = `<div class="result-card"><p class="error">${result.message || "Recognition failed."}</p></div>`;
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        const message = error.name === 'AbortError' ? 'Request timed out. Please try again.' : 'Processing failed.';
                        recognitionResult.innerHTML = `<div class="result-card"><p class="error">${message}</p></div>`;
                    }
                    resetInDeviceUI();
                };

                mediaRecorder.start();
                recognitionStatus.textContent = 'Capturing... Play some music now!';
                if (recognitionCard) recognitionCard.classList.add('active');
                startRecognitionButton.disabled = true;
                stopRecognitionButton.disabled = false;

                setTimeout(() => { if (mediaRecorder.state === "recording") mediaRecorder.stop(); }, 10000);
            } catch (err) {
                console.error('System audio error:', err);
                alert('Screen capture permission is required for system audio recognition.');
            }
        });

        stopRecognitionButton.addEventListener('click', () => {
            if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
            resetInDeviceUI();
        });
    }

    function resetInDeviceUI() {
        recognitionStatus.textContent = 'Ready to capture';
        if (recognitionCard) recognitionCard.classList.remove('active');
        startRecognitionButton.disabled = false;
        stopRecognitionButton.disabled = true;
        if (displayStream) displayStream.getTracks().forEach(track => track.stop());
    }

    // --- UI Cleanup (Redundant Upload Listeners Removed) ---

    if (uploadButton) {
        uploadButton.addEventListener('click', async () => {
            const file = musicInput.files[0];
            if (!file) {
                alert("Please select a file first.");
                return;
            }

            const formData = new FormData();
            formData.append('musicFile', file);
            uploadResult.innerHTML = `<div class="result-card"><p>✨ Finalizing identification...</p></div>`;

            try {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), 60000); // 1 minute for uploads

                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData,
                    signal: controller.signal
                });

                clearTimeout(id);
                const result = await response.json();
                if (result.success) {
                    renderSongResult(result.metadata || result, uploadResult);
                } else {
                    uploadResult.innerHTML = `<div class="result-card"><p class="error">${result.message || "Adagio couldn't identify this file."}</p></div>`;
                }
            } catch (error) {
                console.error("Upload error:", error);
                const message = error.name === 'AbortError' ? 'Upload timed out. File might be too large or server is slow.' : 'Upload failed. Check your file size or connection.';
                uploadResult.innerHTML = `<div class="result-card"><p class="error">${message}</p></div>`;
            }
        });
    }


    // --- Global Helpers ---

    function safeBtoa(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            function toSolidBytes(match, p1) {
                return String.fromCharCode('0x' + p1);
            }));
    }

    function convertToEmbedUrl(youtubeUrl) {
        if (!youtubeUrl) return null;
        if (youtubeUrl.includes("youtube.com/embed/")) return youtubeUrl;
        const idMatch = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
        if (idMatch && idMatch[1]) return `https://www.youtube.com/embed/${idMatch[1]}?autoplay=0`;
        return youtubeUrl.replace("watch?v=", "embed/");
    }

    function processLyrics(text, songId) {
        if (!text) return '';
        return text.split('\n').map(line => {
            if (line.trim()) {
                return `<span class="lyric-line" onclick="explainLyrics(this, '${songId}')" title="Click for AI analysis">${line}</span>`;
            }
            return '';
        }).join('\n');
    }

    window.explainLyrics = async function (element, songId) {
        const text = element.innerText;
        const songCard = document.querySelector(`[data-song-id="${songId}"]`);
        const artist = songCard.querySelector('p').innerText.replace('by ', '');
        const title = songCard.querySelector('h3').innerText.replace('🎵 ', '');

        // Create or find popup
        let popup = document.getElementById('lyricsPopup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'lyricsPopup';
            popup.className = 'lyrics-popup';
            document.body.appendChild(popup);
        }

        // Position popup near element
        const rect = element.getBoundingClientRect();
        popup.style.top = `${rect.bottom + window.scrollY + 10}px`;
        popup.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
        popup.innerHTML = `<div class="loading-dots"><span>.</span><span>.</span><span>.</span></div> Analyzing meaning...`;
        popup.classList.add('visible');

        // Close on click outside
        const closePopup = (e) => {
            if (!popup.contains(e.target) && e.target !== element) {
                popup.classList.remove('visible');
                document.removeEventListener('click', closePopup);
            }
        };
        setTimeout(() => document.addEventListener('click', closePopup), 100);

        try {
            const response = await fetch('/api/deep-lyrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, artist, title })
            });
            const result = await response.json();

            if (result.success) {
                popup.innerHTML = `<p class="explanation">💡 <strong>Adagio Analysis:</strong><br>${result.explanation}</p>`;
            } else {
                popup.innerHTML = `<p class="error">Couldn't analyze this line.</p>`;
            }
        } catch (e) {
            popup.innerHTML = `<p class="error">Error connecting to AI.</p>`;
        }
    }

    // --- Global Helpers ---

    window.renderSongResult = function (data, targetElement) {
        if (!data || !targetElement) return;

        const title = data.title || 'Unknown Title';
        const artist = data.artist || 'Unknown Artist';
        const query = encodeURIComponent(`${artist} ${title}`);
        const songId = safeBtoa(`${title}-${artist}`).substring(0, 16);

        // Check if favorited (using Global Library cache if available, fallback to local checked earlier)
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
                    <h3 style="color: var(--accent-primary); font-size: 1.8rem;">🎵 ${title}</h3>
                    <div class="artist-row">
                        <p style="font-size: 1.2rem; color: var(--text-primary);">by ${artist}</p>
                        <span class="mood-pill-container"></span>
                    </div>
                </div>
                <button class="heart-btn ${isFavorited ? 'active' : ''}" onclick="toggleFavorite('${songId}', this)">
                    <i class="fa${isFavorited ? 's' : 'r'} fa-heart"></i>
                </button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 30px; text-align: left; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 12px;">
                ${data.album ? `<p><strong>Album:</strong><br>${data.album}</p>` : ''}
                ${data.release_date ? `<p><strong>Released:</strong><br>${data.release_date}</p>` : ''}
                ${data.label ? `<p><strong>Label:</strong><br>${data.label}</p>` : ''}
            </div>

            <div class="platform-links">
                <a href="${links.spotify}" target="_blank"><i class="fab fa-spotify"></i> Spotify</a>
                <a href="${links.appleMusic}" target="_blank"><i class="fab fa-apple"></i> Apple Music</a>
                <a href="${links.youtubeMusic}" target="_blank"><i class="fab fa-youtube"></i> YouTube Music</a>
            </div>

            ${data.videoUrl ? `
                <div class="video-container" style="margin-top: 30px;">
                    <iframe src="${convertToEmbedUrl(data.videoUrl)}" allowfullscreen></iframe>
                </div>` : ''
            }

            ${data.lyrics ? `
                <div class="result-content" style="margin-top: 30px; background: rgba(0,0,0,0.3);">
                    <div class="header-row">
                        <h4 style="color: var(--accent-primary); margin-bottom: 15px;"><i class="fas fa-scroll"></i> Lyrics <span style="font-size: 0.8rem; opacity: 0.7; font-weight: normal; margin-left: 10px;">(Click lines for meaning)</span></h4>
                        <button class="translate-btn" onclick="translateLyrics('${songId}')">AI Translate</button>
                    </div>
                    <pre id="lyrics-${songId}" style="white-space: pre-wrap; font-family: inherit; color: var(--text-secondary); max-height: 400px; overflow-y: auto; padding-right: 10px;">${processLyrics(data.lyrics, songId)}</pre>
                    <!-- Hidden raw lyrics for translation -->
                    <div id="raw-lyrics-${songId}" style="display:none;">${data.lyrics}</div>
                </div>` : ''
            }

            <div class="result-actions" style="margin-top: 30px; display: flex; gap: 15px; flex-wrap: wrap;">
                <button class="mix-btn" onclick="createMix('${artist.replace(/'/g, "\\'")}', '${title.replace(/'/g, "\\'")}', this)">
                    <i class="fas fa-wand-magic-sparkles"></i> Create AI Mix
                </button>
                <button class="mix-btn share-btn" style="background: rgba(255,255,255,0.1); color: var(--text-primary);" onclick="shareSong('${artist.replace(/'/g, "\\'")}', '${title.replace(/'/g, "\\'")}', '${links.spotify}')">
                    <i class="fas fa-share-alt"></i> Share
                </button>
            </div>
            
            <div id="mix-container-${songId}" class="mix-container"></div>
        </div>
    `;

        // Store song data on the element for retrieval (since we pass 'this' now)
        targetElement.lastElementChild.dataset.fullJson = JSON.stringify(data);

        // Pro: Fetch Mood & Recommendations
        if (data.title && data.artist && !targetElement.dataset.proLoaded) {
            targetElement.dataset.proLoaded = "true";
            updateMoodUI(data.artist, data.title, data.lyrics, targetElement);
            renderRecommendations(data.artist, data.title, targetElement);
        }
    }

    async function updateMoodUI(artist, title, lyrics, cardElement) {
        try {
            const res = await fetch('/api/mood', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artist, title, lyrics })
            });
            const moodData = await res.json();
            if (moodData.success) {
                document.body.classList.add('mood-change');
                document.body.style.setProperty('--mood-color-1', moodData.color1);
                document.body.style.setProperty('--mood-color-2', moodData.color2);

                const moodContainer = cardElement.querySelector('.mood-pill-container');
                if (moodContainer) {
                    const moodText = moodData.mood.charAt(0).toUpperCase() + moodData.mood.slice(1);
                    moodContainer.innerHTML = `
                        <div class="mood-pill dynamic-mood">
                            <i class="fas fa-sparkles"></i> ${moodText}
                        </div>
                    `;
                }
            }
        } catch (e) { console.error("Mood update failed", e); }
    }

    async function renderRecommendations(artist, title, container) {
        try {
            const res = await fetch('/api/recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artist, title })
            });
            const data = await res.json();
            if (data.success && data.recommendations.length > 0) {
                const recSection = document.createElement('div');
                recSection.style.marginTop = '40px';
                recSection.innerHTML = `<h4 style="margin-bottom: 15px; color: var(--accent-primary);"><i class="fas fa-wand-magic-sparkles"></i> You might also like...</h4>
                <div class="recommendations-grid"></div>`;

                const grid = recSection.querySelector('.recommendations-grid');
                data.recommendations.forEach(rec => {
                    const card = document.createElement('div');
                    card.className = 'rec-card';
                    card.innerHTML = `
                    <h4>${rec.title}</h4>
                    <p>${rec.artist}</p>
                `;
                    card.onclick = () => {
                        document.getElementById('searchInput').value = `${rec.title} by ${rec.artist}`;
                        document.getElementById('intelligentSearchButton').click();
                    };
                    grid.appendChild(card);
                });
                const resultCard = container.querySelector('.result-card');
                if (resultCard) resultCard.appendChild(recSection);
            }
        } catch (e) { console.error("Recommendations failed", e); }
    }

    window.createMix = async function (artist, title, btn) {
        const songId = btoa(`${title}-${artist}`).substring(0, 16);
        const container = document.getElementById(`mix-container-${songId}`);

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Mix...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artist, title })
            });
            const data = await res.json();

            if (data.success && data.recommendations.length > 0) {
                container.innerHTML = `
                <h4 style="margin: 20px 0 15px; color: var(--accent-primary);">🎧 Your AI-Generated Mix</h4>
                <div class="recommendations-grid">
                    ${data.recommendations.map(rec => `
                        <div class="rec-card" onclick="document.getElementById('searchInput').value='${rec.title} by ${rec.artist}'; document.getElementById('intelligentSearchButton').click();">
                            <h4>${rec.title}</h4>
                            <p>${rec.artist}</p>
                            <a href="${rec.spotifyUrl}" target="_blank" onclick="event.stopPropagation()" style="font-size: 0.7rem; color: #1DB954; margin-top: 8px; display: block;">
                                <i class="fab fa-spotify"></i> Open in Spotify
                            </a>
                        </div>
                    `).join('')}
                </div>
            `;
                btn.innerHTML = '<i class="fas fa-check"></i> Mix Created';
            } else {
                btn.innerHTML = '<i class="fas fa-times"></i> Could not generate mix';
            }
        } catch (e) {
            btn.innerHTML = 'Error';
            console.error(e);
        }
    }

    window.shareSong = function (artist, title, link) {
        const shareUrl = link || `https://open.spotify.com/search/${encodeURIComponent(title + ' ' + artist)}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            const btn = event.currentTarget; // Safer access to clicked element
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
        });
    }

    window.toggleFavorite = async function (id, btn) {
        const token = localStorage.getItem('adagio_token');
        if (!token) {
            alert("Please sign in to save songs to your library!");
            window.location.href = 'signin.html';
            return;
        }

        const icon = btn.querySelector('i');
        const isAdding = !btn.classList.contains('active');

        // Optimistic UI Update
        btn.classList.toggle('active');
        icon.className = isAdding ? 'fas fa-heart' : 'far fa-heart';

        try {
            const cardElement = document.querySelector(`[data-song-id="${id}"]`);
            const songData = isAdding ? JSON.parse(cardElement?.dataset.fullJson || '{}') : null;

            const response = await fetch(isAdding ? '/api/library/add' : '/api/library/remove', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ songId: id, songData })
            });

            const res = await response.json();
            if (!res.success) {
                if (res.message && (res.message.includes('expired') || res.message.includes('signature') || res.message.includes('token'))) {
                    localStorage.removeItem('adagio_token');
                    alert("Your session has expired. Please sign in again.");
                    window.location.href = 'signin.html';
                    return;
                }
                throw new Error(res.message);
            }

            // Update local memory
            if (!window.userLibrary) window.userLibrary = {};
            if (isAdding) window.userLibrary[id] = songData;
            else delete window.userLibrary[id];

        } catch (e) {
            console.error("Library error:", e);
            // Revert
            btn.classList.toggle('active');
            icon.className = !isAdding ? 'fas fa-heart' : 'far fa-heart';
            alert(e.message || "Failed to update library.");
        }
    }

    window.translateLyrics = async function (id) {
        const rawDiv = document.getElementById(`raw-lyrics-${id}`); // Use hidden raw text
        const originalText = rawDiv ? rawDiv.textContent : document.getElementById(`lyrics-${id}`).textContent;
        const btn = document.querySelector(`[data-song-id="${id}"] .translate-btn`);

        btn.textContent = 'Translating...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: originalText })
            });
            const result = await response.json();
            if (result.success) {
                const pre = document.getElementById(`lyrics-${id}`);
                pre.innerHTML = `<em style="color: var(--accent-primary); display: block; margin-bottom: 15px;">Translated to English:</em>${result.translatedText}`;
                btn.textContent = 'Translated';
            } else {
                btn.textContent = 'Failed';
            }
        } catch (e) {
            btn.textContent = 'Error';
        }
    }

    function updateAuthUI(isLoggedIn) {
        const accountLink = document.querySelector('.sidebar a[href*="signup"]');
        if (accountLink) {
            if (isLoggedIn) {
                accountLink.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
                accountLink.title = 'Sign Out';
                accountLink.href = '#';
                accountLink.onclick = (e) => {
                    e.preventDefault();
                    window.logout();
                };
            } else {
                accountLink.innerHTML = '<i class="fas fa-user-circle"></i>';
                accountLink.title = 'Sign In / Sign Up';
                accountLink.href = 'signin.html';
                accountLink.onclick = null;
            }
        }
    }

    window.logout = function () {
        localStorage.removeItem('adagio_token');
        window.userLibrary = {};
        alert("Your session has been cleared. Please sign in again.");
        window.location.href = 'signin.html';
    };
});
