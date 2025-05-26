document.addEventListener('DOMContentLoaded', function () {
    // Selectors for different buttons and elements
    const sphereButton = document.querySelector('.sphere-button');
    const startListeningMicButton = document.getElementById('startListeningMic');
    const stopListeningMicButton = document.getElementById('stopListeningMic');
    const identifyButton = document.getElementById('identifyButton');
    const floatingSpheres = document.querySelectorAll('.floating-sphere');
    const soundWave = document.querySelector('.sound-wave');

    let mediaRecorder;
    let mediaRecorderMic;
    let micTimeout;

    // Function to search for the music video using YouTube API
    async function getMusicVideoUrl(title, artist) {
        const apiKey = '[GOOGLE_YOUTUBE_LEAKED]';
        const query = `${title} ${artist} official music video`;
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`;


        try {
            const response = await fetch(searchUrl);
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                const videoId = data.items[0].id.videoId;
                return `https://www.youtube.com/embed/${videoId}`;
            }            
        } catch (error) {
            console.error('Error fetching YouTube video:', error);
        }

        return '';
    }

    // Function to handle song recognition 
    async function handleSongRecognition(result) {
        if (result.success) {
            const redirectUrl = `result.html?title=${encodeURIComponent(result.title)}&artist=${encodeURIComponent(result.artist)}&lyrics=${encodeURIComponent(result.lyrics)}&videoUrl=${encodeURIComponent(result.videoUrl)}&spotifyLink=${encodeURIComponent(result.spotifyLink)}&playlists=${encodeURIComponent(JSON.stringify(result.playlists))}&similarSongs=${encodeURIComponent(JSON.stringify(result.similarSongs))}`;
            window.location.href = redirectUrl;
        } else {
            alert('Unable to recognize the song.');
        }
    }


    async function fetchYouTubeVideo(query) {
        const apiKey = '[GOOGLE_YOUTUBE_LEAKED]'; // Your YouTube API key
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&maxResults=1&key=${apiKey}`;
    
        try {
            const response = await fetch(searchUrl);
            const data = await response.json();
            console.log('📺 YouTube API Response:', data); // Debug
    
            if (data.items && data.items.length > 0) {
                const videoId = data.items[0].id.videoId;
                return `https://www.youtube.com/embed/${videoId}`; // ✅ RETURN EMBED URL
            } else {
                console.warn('❌ No video found for query:', query);
            }
        } catch (error) {
            console.error('❌ Error fetching YouTube video:', error);
        }
    
        return ''; // fallback if nothing is found
    }
    
    
    
    
    document.getElementById('intelligentSearchButton').addEventListener('click', async () => {
        const query = document.getElementById('searchInput').value.trim();
        const resultContainer = document.getElementById('resultContainer');
    
        if (!query) {
            alert('Please enter a query!');
            return;
        }
    
        resultContainer.innerHTML = '<p>Loading...</p>';
    
        try {
            const response = await fetch('/intelligent-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });
    
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
    
            const result = await response.json();
    
            if (result.success && result.chatText) {
                const songs = result.chatText
                    .split(/(?=\d+\.)/g)
                    .map(song => song.replace(/^\d+\.\s*/, '').trim())
                    .filter(song => song); 
    
                    const videoElements = await Promise.all(
                        songs.map(async (songText) => {
                            let title = songText;
                            let artist = ''
                            console.log(`🎥 Fetching video for: ${songText}`);

                    if (songText.includes(' - ')) {
                        [title, artist] = songText.split(' - ');
                    }

            const searchQuery = `${title} ${artist} official music video`.trim();
            const videoUrl = await fetchYouTubeVideo(searchQuery);
                         
                      
            return `
            <div class="song-item">
              ${videoUrl ? `
                <div class="video-container">
                  <iframe src="${videoUrl}" frameborder="0" allowfullscreen></iframe>
                  <p style="margin-top: 5px;">
                    <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(songText)}" target="_blank">
                      🔍 Search more on YouTube
                    </a>
                  </p>
                </div>` : `
                <p class="error">
                  ❌ YouTube video not available.<br>
                  <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(songText)}" target="_blank">
                    <i class="fab fa-youtube"></i> Search on YouTube
                  </a>
                </p>`}
              
              <p>"${songText}"</p>
              <div style="font-size: 1.5rem; margin-top: 10px;">
                <a href="https://open.spotify.com/search/${encodeURIComponent(songText)}" target="_blank"><i class="fab fa-spotify platform-icon"></i></a>
                <a href="https://music.apple.com/us/search?term=${encodeURIComponent(songText)}" target="_blank"><i class="fab fa-apple platform-icon"></i></a>
                <a href="https://music.youtube.com/search?q=${encodeURIComponent(songText)}" target="_blank"><i class="fab fa-youtube platform-icon"></i></a>
              </div>
            </div>
          `;
          
                    })
                );
    
                resultContainer.innerHTML = `
                    <div>
                        <h3>🔍 Search Results</h3>
                        ${videoElements.join('')}
                    </div>
                `;
            } else {
                resultContainer.innerHTML = `<p class="error">${result.message || 'No results found.'}</p>`;
            }
        } catch (error) {
            console.error('Error fetching search results:', error);
            resultContainer.innerHTML = '<p class="error">An error occurred. Please try again later.</p>';
        }
    
        const historyList = document.getElementById('searchHistory');
        const li = document.createElement('li');
        li.textContent = query;
        li.onclick = () => {
            document.getElementById('searchInput').value = li.textContent;
        };
        historyList.prepend(li);
    });
    
    


    async function intelligentMusicSearch() {
        const userQuery = prompt("Enter your music query: (e.g., Recommend a jazz song, find a similar track, etc.)");
    
        if (userQuery) {
            try {
                const response = await fetch('/intelligent-search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: userQuery })
                });
    
                const result = await response.json();
                if (result.success) {
                    alert(` ${result.response}`);
                } else {
                    alert('Failed to fetch recommendations. Try again!');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error fetching intelligent search results.');
            }
        }
    }

    
    document.getElementById('searchButton').addEventListener('click', async () => {
        const userQuery = document.getElementById('searchInput').value.trim();
        if (!userQuery) return alert('Please enter a query.');
    
        try {
            const response = await fetch('/intelligent-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userQuery }),
            });
    
            const result = await response.json();
            if (result.success) {
                alert(`Result: ${result.response}`);
            } else {
                alert('No results found.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Search failed.');
        }
    });
    
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: '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',
});

async function testModel() {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini-2024-07-18',
            messages: [{ role: 'user', content: 'Hello, can you confirm this works?' }],
            max_tokens: 50,
        });
        console.log(response.choices[0].message.content);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testModel();
    
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const title = urlParams.get('title');
    const artist = urlParams.get('artist');
    const album = urlParams.get('album');
    const lyrics = urlParams.get('lyrics');
    const videoUrl = urlParams.get('videoUrl');

    document.getElementById('songTitle').textContent = title;
    document.getElementById('songArtist').textContent = artist;
    document.getElementById('songAlbum').textContent = album;
    document.getElementById('songLyrics').textContent = decodeURIComponent(lyrics);

    if (videoUrl && videoUrl !== '') {
        const videoPlayer = document.getElementById('videoPlayer');
        videoPlayer.innerHTML = `<iframe width="560" height="315" src="${videoUrl}" frameborder="0" allowfullscreen></iframe>`;
    } else {
        const videoPlayer = document.getElementById('videoPlayer');
        videoPlayer.innerHTML = '<p>Music video not available.</p>';
    }
});
})

document.addEventListener('DOMContentLoaded', function () {
    console.log("JavaScript Loaded: All event listeners initialized");

    const startListeningMicButton = document.getElementById('startListeningMic');
    const liveResultMic = document.getElementById('liveResultMic');
    const micStatus = document.getElementById('micStatus');

    let mediaRecorder;
    let audioChunks = [];
    let isListening = false;

    if (startListeningMicButton) {
        startListeningMicButton.addEventListener('click', async function () {
            if (!isListening) {
                try {
                    console.log("Requesting microphone access...");
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                    audioChunks = [];

                    mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            audioChunks.push(event.data);
                        }
                    };

                    mediaRecorder.onstop = async () => {
                        console.log("Recording stopped, preparing audio for upload...");
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

                        const formData = new FormData();
                        formData.append('musicFile', audioBlob, 'micAudio.webm');

                        liveResultMic.innerHTML = `<p>Processing audio...</p>`;

                        try {
                            const response = await fetch('/upload-mic-audio', { method: 'POST', body: formData });
                            const result = await response.json();

                            if (result.success) {
                                const data = result.metadata || result;
                            
                                renderSongResult(data, liveResultMic);
;
                            } else {
                                liveResultMic.innerHTML = `<p class="error">Failed to recognize song.</p>`;
                            }
                        } catch (error) {
                            console.error('Error uploading audio:', error);
                            liveResultMic.innerHTML = `<p class="error">Upload failed.</p>`;
                        }

                        startListeningMicButton.classList.remove('listening');
                        startListeningMicButton.classList.remove('listening', 'pulsing', 'stopped');
                        micStatus.textContent = 'Stopped. Click to listen again.';
                        setTimeout(() => startListeningMicButton.classList.remove('stopped'), 1000);

                        isListening = false;
                    };

                    mediaRecorder.start();
                    console.log("Recording started...");
                    startListeningMicButton.classList.add('listening', 'pulsing');
                    micStatus.textContent = 'Listening... Click again to stop.';
                    isListening = true;

                    setTimeout(() => {
                        if (mediaRecorder.state === 'recording') {
                            mediaRecorder.stop();
                        }
                    }, 10000);
                } catch (err) {
                    console.error('Microphone access error:', err);
                    alert('Microphone permission denied. Please check browser settings.');
                    micStatus.textContent = '❌ Microphone blocked. Allow access in settings.';
                }
            } else {
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                    console.log("Recording manually stopped.");
                }
                
            }
        });
    }
});

// --- Lyrics Interaction Helpers ---

function toggleLyrics() {
    const el = document.getElementById("lyricsContent");
    if (!el) return;

    el.classList.toggle('open');
    if (el.classList.contains('open')) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }
}


function downloadLyrics(filename = "lyrics") {
    const text = document.getElementById("lyricsText")?.innerText;
    if (text) {
        const blob = new Blob([text], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}.txt`;
        link.click();
    }
}

const voiceBtn = document.getElementById("voiceSearchBtn");

if ('webkitSpeechRecognition' in window) {
  const recognition = new webkitSpeechRecognition();
  recognition.lang = 'en-US'; // you can also try 'zh-TW' for Chinese

  voiceBtn.addEventListener('click', () => {
    recognition.start();
    voiceBtn.textContent = "🎤 Listening...";
  });

  recognition.onresult = function (event) {
    const transcript = event.results[0][0].transcript;
    document.getElementById("searchInput").value = transcript;
    voiceBtn.textContent = "🎙️";
  };

  recognition.onend = () => {
    voiceBtn.textContent = "🎙️";
  };
} else {
  voiceBtn.disabled = true;
  voiceBtn.title = "Speech recognition not supported in this browser.";
}


function copyLyrics() {
    const lyrics = document.getElementById("lyricsText")?.innerText;
    if (lyrics) {
        navigator.clipboard.writeText(lyrics)
            .then(() => alert("✅ Lyrics copied to clipboard!"))
            .catch(err => alert("❌ Failed to copy lyrics"));
    }
}

function downloadLyrics(filename = "lyrics") {
    const lyrics = document.getElementById("lyricsText")?.innerText;
    if (lyrics) {
        const blob = new Blob([lyrics], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}.txt`;
        link.click();
    }
}


document.getElementById('darkModeToggle')?.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
});


document.addEventListener('DOMContentLoaded', async function () {
    console.log("JavaScript Loaded: In-Device Music Recognition Ready");

    const startRecognitionButton = document.getElementById('startRecognition');
    const stopRecognitionButton = document.getElementById('stopRecognition');
    const recognitionResult = document.getElementById('recognitionResult');
    const recognitionStatus = document.getElementById('recognitionStatus');

    let mediaRecorder;
    let audioChunks = [];
    let systemAudioStream;
    let displayStream;

    if (startRecognitionButton) {
        startRecognitionButton.addEventListener('click', async function () {
            try {
                console.log("Requesting system audio access...");
                
                // Request system audio (forces user to allow screen capture)
                displayStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,  // Necessary to trigger the capture request
                    audio: true   // Capture system audio
                });

                // Filter audio track (ignore video)
                const audioTrack = displayStream.getAudioTracks()[0];
                if (!audioTrack) throw new Error("No system audio track found.");

                systemAudioStream = new MediaStream([audioTrack]);

                // Create MediaRecorder to capture system sound
                mediaRecorder = new MediaRecorder(systemAudioStream, { mimeType: 'audio/webm' });
                audioChunks = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    console.log("🎧 System audio recording stopped.");
                    
                    if (audioChunks.length === 0) {
                        console.error("❌ No audio recorded.");
                        recognitionResult.innerHTML = `<p class="error">No system audio detected. Try again.</p>`;
                        resetUI();
                        return;
                    }

                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const formData = new FormData();
                    formData.append('musicFile', audioBlob, 'indeviceAudio.webm');

                    recognitionResult.innerHTML = `<p>Processing audio...</p>`;

                    try {
                        const response = await fetch('/recognize-indevice-audio', { method: 'POST', body: formData });
                    
                        if (!response.ok) {
                            throw new Error(`Server returned ${response.status}`);
                        }
                    
                        const result = await response.json();
                        const data = result.metadata || result;
                    
                        if (result.success) {
                            renderSongResult(data, recognitionResult);
                        } else {
                            recognitionResult.innerHTML = `<p class="error">Failed to recognize song.</p>`;
                        }
                    } catch (error) {
                        console.error('❌ Error uploading audio:', error);
                        recognitionResult.innerHTML = `<p class="error">Upload failed.</p>`;
                    }
                    

                    // Stop everything after getting result
                    resetUI();
                };

                // Start recording system audio
                mediaRecorder.start();
                console.log("🎧 Recording system audio started...");
                startRecognitionButton.classList.add('listening');
                recognitionStatus.textContent = 'Capturing system audio... Processing will auto-stop.';
                startRecognitionButton.disabled = true;
                stopRecognitionButton.disabled = false;

                // Auto-stop after 10 seconds if no result is returned before
                setTimeout(() => {
                    if (mediaRecorder.state === "recording") {
                        mediaRecorder.stop();
                    }
                }, 10000);
            } catch (err) {
                console.error('❌ Error accessing system audio:', err);
                alert('System audio access requires screen recording permission. Please allow it.');
                recognitionStatus.textContent = '❌ System audio not accessible. Allow screen recording.';
            }
        });

        stopRecognitionButton.addEventListener('click', () => {
            if (mediaRecorder && mediaRecorder.state === "recording") {
                mediaRecorder.stop();
                console.log("⏹️ System audio recording stopped manually.");
            }
            resetUI();
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        const musicInput = document.getElementById('musicInput');
        const fileNameDisplay = document.getElementById('fileName');
    
        if (musicInput) {
            musicInput.addEventListener('change', function () {
                if (musicInput.files.length > 0) {
                    fileNameDisplay.textContent = musicInput.files[0].name;
                } else {
                    fileNameDisplay.textContent = "No file chosen";
                }
            });
        }
    });
    
    // Function to reset buttons & stop system audio
    function resetUI() {
        startRecognitionButton.classList.remove('listening');
        recognitionStatus.textContent = 'Click to start capturing system audio.';
        startRecognitionButton.disabled = false;
        stopRecognitionButton.disabled = true;

        // Stop screen capture
        if (displayStream) {
            displayStream.getTracks().forEach(track => track.stop());
        }
    }
});

function convertToEmbedUrl(youtubeUrl) {
    if (!youtubeUrl) return null;

    // If already an embed URL, return it
    if (youtubeUrl.includes("youtube.com/embed/")) return youtubeUrl;

    // Match YouTube ID from watch or shortened URL
    const idMatch = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
    if (idMatch && idMatch[1]) {
        return `https://www.youtube.com/embed/${idMatch[1]}`;
    }

    // Fallback to replace watch?v=
    return youtubeUrl.replace("watch?v=", "embed/");
}





document.addEventListener('DOMContentLoaded', function () {
    const musicInput = document.getElementById('musicInput');
    const fileNameDisplay = document.getElementById('fileName');
    const uploadButton = document.getElementById('uploadButton');
    const uploadResult = document.getElementById('uploadResult');

    if (musicInput) {
        musicInput.addEventListener('change', function () {
            if (musicInput.files.length > 0) {
                fileNameDisplay.textContent = musicInput.files[0].name;
            } else {
                fileNameDisplay.textContent = "No file chosen";
            }
        });
    }

    function convertToEmbedUrl(youtubeUrl) {
        if (!youtubeUrl) return null;
    
        // Check if it's already an embed URL
        if (youtubeUrl.includes("youtube.com/embed/")) {
            return youtubeUrl;
        }
    
        // Extract video ID from typical watch URL or short link
        const match = youtubeUrl.match(/[?&]v=([^&#]+)/) || youtubeUrl.match(/youtu\.be\/([^&#]+)/);
        if (match && match[1]) {
            return `https://www.youtube.com/embed/${match[1]}`;
        }
    
        return youtubeUrl.replace("watch?v=", "embed/");
    }
    
    
    if (uploadButton) {
        uploadButton.addEventListener('click', async function () {
            const file = musicInput.files[0];

            if (!file) {
                alert("Please select an audio file first.");
                return;
            }

            const formData = new FormData();
            formData.append('musicFile', file);

            // Show loading message
            uploadResult.classList.remove('hidden');
            uploadResult.innerHTML = `<p>Uploading file... Please wait.</p>`;

            try {
                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    console.error("❌ Server Error:", response.status, response.statusText);
                    liveResultMic.innerHTML = `<p class="error">Upload failed. Server responded with error.</p>`;
                    return;
                }
                
                const result = await response.json();
                const data = result.metadata || result;
if (result.success) {
    renderSongResult(data, uploadResult);
} else {
    uploadResult.innerHTML = `<p class="error">Failed to recognize song. Try again.</p>`;
}

            } catch (error) {
                console.error("❌ Error uploading file:", error);
                uploadResult.innerHTML = `<p class="error">Upload failed. Please check the server.</p>`;
            }
        });
    }
});

function renderSongResult(data, targetElement) {
    if (!data || !targetElement) return;

    const title = data.title || '';
    const artist = data.artist || '';
    const query = encodeURIComponent(`${artist} ${title}`);

    const links = {
        spotify: `https://open.spotify.com/search/${query}`,
        appleMusic: `https://music.apple.com/us/search?term=${query}`,
        youtubeMusic: `https://music.youtube.com/search?q=${query}`
    };

    targetElement.innerHTML = `
        <h3>🎵 Song Recognized</h3>
        <p><strong>Title:</strong> ${title}</p>
        <p><strong>Artist:</strong> ${artist}</p>
        ${data.album ? `<p><strong>Album:</strong> ${data.album}</p>` : ''}
        ${data.release_date ? `<p><strong>Release Date:</strong> ${data.release_date}</p>` : ''}
        ${data.label ? `<p><strong>Label:</strong> ${data.label}</p>` : ''}

        <div class="platform-links">
            <h4>🎧 Listen on:</h4>
            <div class="icon-links">
                <a href="${links.spotify}" target="_blank">
                    <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/spotify.svg" alt="Spotify" class="platform-icon">
                </a>
                <a href="${links.appleMusic}" target="_blank">
                    <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/applemusic.svg" alt="Apple Music" class="platform-icon">
                </a>
                <a href="${links.youtubeMusic}" target="_blank">
                    <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/youtubemusic.svg" alt="YouTube Music" class="platform-icon">
                </a>
            </div>
        </div>

        ${data.videoUrl ? `
            <div class="video-container">
              <iframe src="${convertToEmbedUrl(data.videoUrl)}" frameborder="0" allowfullscreen></iframe>
              <p style="margin-top: 5px;">
                <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${data.title} ${data.artist}`)}" target="_blank">
                  🔎 Search more on YouTube
                </a>
              </p>
            </div>` : `
            <p class="error">
              🎥 YouTube video not available.<br>
              <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${data.title} ${data.artist}`)}" target="_blank">
                <i class="fab fa-youtube"></i> Search on YouTube
              </a>
            </p>`}
                   

        ${data.lyrics ? `
            <div class="lyrics-section">
                <h4 style="cursor:pointer;" onclick="toggleLyrics()">📜 Lyrics (Click to Expand/Collapse)</h4>
                <div id="lyricsContent" class="">
                    <pre class="song-lyrics" id="lyricsText">${data.lyrics}</pre>
                    <button onclick="copyLyrics()">📋 Copy</button>
                    <button onclick="downloadLyrics('${title.replace(/'/g, '')}')">💾 Save as .txt</button>
                </div>
            </div>` : '<p class="error">Lyrics not available.</p>'}
    `;
}




