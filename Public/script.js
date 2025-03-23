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
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${apiKey}`;

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

    // Function to handle song recognition and redirect to result.html
    // Updated function to handle song recognition and video URL retrieval
    async function handleSongRecognition(result) {
        if (result.success) {
            const redirectUrl = `result.html?title=${encodeURIComponent(result.title)}&artist=${encodeURIComponent(result.artist)}&lyrics=${encodeURIComponent(result.lyrics)}&videoUrl=${encodeURIComponent(result.videoUrl)}&spotifyLink=${encodeURIComponent(result.spotifyLink)}&playlists=${encodeURIComponent(JSON.stringify(result.playlists))}&similarSongs=${encodeURIComponent(JSON.stringify(result.similarSongs))}`;
            window.location.href = redirectUrl;
        } else {
            alert('Unable to recognize the song.');
        }
    }


    async function fetchYouTubeVideo(query) {
        const apiKey = '[GOOGLE_YOUTUBE_LEAKED]'; // Replace with your actual API key
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${apiKey}`;
        
        try {
            const response = await fetch(searchUrl);
            const data = await response.json();
            console.log('YouTube API Response:', data); // Log the response to debug
    
            if (data.items && data.items.length > 0) {
                const videoId = data.items[0].id.videoId;
                return `https://www.youtube.com/embed/${videoId}`;
            } else {
                console.error('No videos found for query:', query);
            }
        } catch (error) {
            console.error('Error fetching YouTube video:', error);
        }
        return ''; // Return an empty string if no video is found
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
                    .filter(song => song); // Filter out empty entries
    
                const videoElements = await Promise.all(
                    songs.map(async song => {
                        const videoUrl = await fetchYouTubeVideo(song);
                        return `
                            <div class="song-item">
                                <p>${song}</p>
                                ${videoUrl ? `<iframe width="560" height="315" src="${videoUrl}" frameborder="0" allowfullscreen></iframe>` : '<p>Video not available</p>'}
                            </div>`;
                    })
                );
    
                resultContainer.innerHTML = `
                    <div>
                        <h3>Search Results</h3>
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
    });
    
    console.log('Query:', query);


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
    apiKey: 'YOUR_API_KEY',
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
                                liveResultMic.innerHTML = `
    <h3>Live Song Recognized</h3>
    <p><strong>Song:</strong> ${result.title}</p>
    <p><strong>Artist:</strong> ${result.artist}</p>

    ${result.videoUrl ? `
        <div class="video-container">
            <iframe src="${convertToEmbedUrl(result.videoUrl)}" frameborder="0" allowfullscreen></iframe>
        </div>` : '<p class="error">No YouTube MV found.</p>'}    

    ${result.lyrics ? `
        <p><strong>Lyrics:</strong> <a href="${result.lyrics}" target="_blank">View Lyrics</a></p>
    ` : '<p class="error">Lyrics not available.</p>'}
`;

                            } else {
                                liveResultMic.innerHTML = `<p class="error">Failed to recognize song.</p>`;
                            }
                        } catch (error) {
                            console.error('Error uploading audio:', error);
                            liveResultMic.innerHTML = `<p class="error">Upload failed.</p>`;
                        }

                        // Change button color briefly to red, then reset
                        startListeningMicButton.classList.remove('listening');
                        startListeningMicButton.classList.add('stopped');
                        micStatus.textContent = 'Stopped. Click to listen again.';
                        setTimeout(() => startListeningMicButton.classList.remove('stopped'), 1000);

                        isListening = false;
                    };

                    mediaRecorder.start();
                    console.log("Recording started...");
                    startListeningMicButton.classList.add('listening');
                    micStatus.textContent = 'Listening... Click again to stop.';
                    isListening = true;

                    // Auto-stop after 10 seconds
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
                // Stop Recording Manually
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                    console.log("Recording manually stopped.");
                }
            }
        });
    }
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
                        const result = await response.json();

                        if (result.success) {
                            recognitionResult.innerHTML = `
                                <h3>Song Recognized</h3>
                                <p><strong>Song:</strong> ${result.title}</p>
                                <p><strong>Artist:</strong> ${result.artist}</p>
                                ${result.videoUrl ? `
                                    <div class="video-container">
                                        <iframe src="${convertToEmbedUrl(result.videoUrl)}" frameborder="0" allowfullscreen></iframe>
                                    </div>
                                ` : ''}
                                                            `;
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

    const videoIdMatch = youtubeUrl.match(/[?&]v=([^&#]+)/);
    if (videoIdMatch && videoIdMatch[1]) {
        return `https://www.youtube.com/embed/${videoIdMatch[1]}`;
    }

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
    
        const videoIdMatch = youtubeUrl.match(/[?&]v=([^&#]+)/);
        if (videoIdMatch && videoIdMatch[1]) {
            return `https://www.youtube.com/embed/${videoIdMatch[1]}`;
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
                console.log("📥 Received Response:", result);
                


                if (result.success) {
                    uploadResult.innerHTML = uploadResult.innerHTML = `
                    <h3>Song Recognized</h3>
                    <p><strong>Song:</strong> ${result.title}</p>
                    <p><strong>Artist:</strong> ${result.artist}</p>
                    ${result.videoUrl ? `
                        <div class="video-container">
                            <iframe src="${convertToEmbedUrl(result.videoUrl)}" frameborder="0" allowfullscreen></iframe>
                        </div>` : '<p class="error">No YouTube MV found.</p>'}
                `;
                
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


