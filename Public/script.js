document.addEventListener('DOMContentLoaded', function () {
    // Selectors for different buttons and elements
    const sphereButton = document.querySelector('.sphere-button');
    const startListeningMicButton = document.getElementById('startListeningMic');
    const stopListeningMicButton = document.getElementById('stopListeningMic');
    const identifyButton = document.getElementById('identifyButton');

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
    async function handleSongRecognition(result) {
        if (result.success) {
            const title = result.title;
            const artist = result.artist;
            const album = result.album;
            const lyrics = encodeURIComponent(result.lyrics || 'Lyrics not available');
            const videoUrl = await getMusicVideoUrl(title, artist);
            const previewUrl = encodeURIComponent(result.previewUrl || '');
            const albumArtUrl = encodeURIComponent(result.albumArtUrl || '');

            // Redirect to the result page with query parameters
            const redirectUrl = `result.html?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&lyrics=${lyrics}&videoUrl=${encodeURIComponent(videoUrl)}&albumArtUrl=${albumArtUrl}&previewUrl=${previewUrl}`;
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
                    clearTimeout(micTimeout);
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

    stopListeningMicButton.addEventListener('click', () => {
        if (mediaRecorderMic && mediaRecorderMic.state === "recording") {
            mediaRecorderMic.stop();
        }
        startListeningMicButton.disabled = false;
        stopListeningMicButton.disabled = true;
    });

    // Live Listening in Device
    sphereButton.addEventListener('click', async function (event) {
        event.preventDefault();
    
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
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

                mediaRecorder.start();
                setTimeout(() => {
                    if (mediaRecorder.state === "recording") {
                        mediaRecorder.stop();
                    }
                }, 20000);

                sphereButton.disabled = true;
            }
        } catch (err) {
            console.error('Error capturing system audio:', err);
            alert('Unable to capture system audio. Make sure to allow permissions and select a screen with audio.');
        }
    });
});
