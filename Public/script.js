document.addEventListener('DOMContentLoaded', function () {
    // Selectors for different buttons and elements
    const audioPlayer = document.getElementById('audioPlayer');
    const sphereButton = document.querySelector('.sphere-button');
    const stopListeningDeviceButton = document.getElementById('stopListeningDevice');
    const startListeningMicButton = document.getElementById('startListeningMic');
    const stopListeningMicButton = document.getElementById('stopListeningMic');
    const identifyButton = document.getElementById('identifyButton');
    
    let mediaRecorder;
    let mediaRecorderMic;
    let micTimeout;

    // Function to search for the music video using YouTube API
    async function getMusicVideoUrl(title, artist) {
        const apiKey = '[GOOGLE_YOUTUBE_LEAKED]'; // Your YouTube API key
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

        // Return an empty string if no video is found
        return '';
    }

    // Function to handle song recognition and redirect to result.html
    async function handleSongRecognition(result) {
        if (result.success) {
            const title = result.title;
            const artist = result.artist;
            const album = result.album;
            const lyrics = encodeURIComponent(result.lyrics || 'Lyrics not available');

            // Fetch the music video URL
            const videoUrl = await getMusicVideoUrl(title, artist);

            // Redirect to the result page with query parameters
            const redirectUrl = `result.html?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&lyrics=${lyrics}&videoUrl=${encodeURIComponent(videoUrl)}`;
            window.location.href = redirectUrl;
        } else {
            alert('Unable to recognize the song.');
        }
    }

    // Handle file upload recognition
    identifyButton.addEventListener('click', function () {
        const fileInput = document.getElementById('musicInput');
        const file = fileInput.files[0];

        if (file) {
            const formData = new FormData();
            formData.append('musicFile', file);

            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(result => {
                handleSongRecognition(result);
            })
            .catch(error => {
                console.error('Upload error:', error);
            });
        } else {
            alert('Please select a music file before identifying.');
        }
    });

    // Live Listening through Microphone
    startListeningMicButton.addEventListener('click', async function () {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            if (stream) {
                mediaRecorderMic = new MediaRecorder(stream);
                let audioChunks = [];

                mediaRecorderMic.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };

                mediaRecorderMic.onstop = async () => {
                    clearTimeout(micTimeout); // Clear the timeout if it didn't expire
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    const formData = new FormData();
                    formData.append('musicFile', audioBlob, 'micAudio.wav');

                    fetch('/upload', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => response.json())
                    .then(result => {
                        handleSongRecognition(result);
                    })
                    .catch(error => {
                        console.error('Microphone upload error:', error);
                    });
                };

                // Start recording for a maximum duration of 20 seconds
                mediaRecorderMic.start();
                micTimeout = setTimeout(() => {
                    if (mediaRecorderMic.state === "recording") {
                        mediaRecorderMic.stop();
                    }
                }, 20000);

                startListeningMicButton.disabled = true;
                stopListeningMicButton.disabled = false;
            }
        } catch (err) {
            console.error('Error capturing microphone audio:', err);
            alert('Unable to capture microphone audio. Make sure to allow permissions.');
        }
    });

    // Stop microphone listening manually
    stopListeningMicButton.addEventListener('click', () => {
        if (mediaRecorderMic && mediaRecorderMic.state === "recording") {
            mediaRecorderMic.stop();
        }
        startListeningMicButton.disabled = false;
        stopListeningMicButton.disabled = true;
    });

    // Live Listening in Device
    sphereButton.addEventListener('click', async function (event) {
        event.preventDefault(); // Prevent default anchor behavior
    
        try {
            // Simplify the constraints to allow broader compatibility
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,  // Request video to enable broader access
                audio: true   // Simplify the audio request to "true" without specifics
            });
    
            if (stream) {
                mediaRecorder = new MediaRecorder(stream);
                let audioChunks = [];
    
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };
    
                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    const formData = new FormData();
                    formData.append('musicFile', audioBlob, 'systemAudio.wav');
    
                    fetch('/upload', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => response.json())
                    .then(result => {
                        handleSongRecognition(result);
                    })
                    .catch(error => {
                        console.error('Error during upload:', error);
                    });
                };
    
                // Start recording and stop after 20 seconds
                mediaRecorder.start();
                setTimeout(() => {
                    if (mediaRecorder.state === "recording") {
                        mediaRecorder.stop();
                    }
                }, 20000); // Stop recording after 20 seconds
    
                sphereButton.disabled = true;
                stopListeningDeviceButton.disabled = false;
            }
        } catch (err) {
            console.error('Error capturing system audio:', err);
            alert('Unable to capture system audio. Make sure to allow permissions and select a screen with audio.');
        }
    });

    // Stop listening in the device manually
    stopListeningDeviceButton.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
        sphereButton.disabled = false;
        stopListeningDeviceButton.disabled = true;
    });
});

document.addEventListener('DOMContentLoaded', function () {
    // Function to handle song recognition and redirect to result.html
    async function handleSongRecognition(result) {
        if (result.success) {
            const title = result.title;
            const artist = result.artist;
            const album = result.album;
            const lyrics = encodeURIComponent(result.lyrics || 'Lyrics not available');
            const previewUrl = result.previewUrl; // Use the preview URL for the audio player
            const albumArtUrl = encodeURIComponent(result.albumArtUrl || '');

            // Fetch the music video URL
            const videoUrl = await getMusicVideoUrl(title, artist);

            // Redirect to the result page with query parameters
            const redirectUrl = `result.html?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&lyrics=${lyrics}&videoUrl=${encodeURIComponent(videoUrl)}&albumArtUrl=${albumArtUrl}&previewUrl=${encodeURIComponent(previewUrl)}`;
            window.location.href = redirectUrl;
        } else {
            alert('Unable to recognize the song.');
        }
    }

    // Function to format time in mm:ss
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Initialize audio player elements
    const audioPlayer = document.getElementById('audioPlayer');
    const playPauseButton = document.getElementById('playPauseButton');
    const progressBar = document.getElementById('progressBar');
    const currentTimeElement = document.getElementById('currentTime');
    const totalTimeElement = document.getElementById('totalTime');
    const volumeSlider = document.getElementById('volumeSlider');

    // Load song information from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const previewUrl = urlParams.get('previewUrl');

    if (previewUrl) {
        audioPlayer.src = decodeURIComponent(previewUrl);

        // Setup event listeners for playback controls
        playPauseButton.addEventListener('click', () => {
            if (audioPlayer.paused) {
                audioPlayer.play();
                playPauseButton.innerHTML = '&#10074;&#10074;'; // Pause icon
            } else {
                audioPlayer.pause();
                playPauseButton.innerHTML = '&#9654;'; // Play icon
            }
        });

        // Update progress bar as song plays
        audioPlayer.addEventListener('timeupdate', () => {
            const currentTime = audioPlayer.currentTime;
            const duration = audioPlayer.duration;
            progressBar.value = (currentTime / duration) * 100;
            currentTimeElement.textContent = formatTime(currentTime);
            totalTimeElement.textContent = formatTime(duration);
        });

        // Seek to a specific point in the song
        progressBar.addEventListener('input', () => {
            const duration = audioPlayer.duration;
            audioPlayer.currentTime = (progressBar.value / 100) * duration;
        });

        // Volume control
        volumeSlider.addEventListener('input', () => {
            audioPlayer.volume = volumeSlider.value / 100;
        });
    } else {
        // Disable player if no preview is available
        playPauseButton.disabled = true;
        progressBar.disabled = true;
        volumeSlider.disabled = true;
    }
});