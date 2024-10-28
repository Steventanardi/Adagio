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
        const title = result.title;
        const artist = result.artist;
        const album = result.album;
        const genre = result.genre;
        const lyrics = encodeURIComponent(result.lyrics || 'Lyrics not available');

        // Retrieve the music video URL
        const videoUrl = await getMusicVideoUrl(title, artist);

        // Redirect to result.html with metadata and video URL
        const redirectUrl = `result.html?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&genre=${encodeURIComponent(genre)}&lyrics=${lyrics}&videoUrl=${encodeURIComponent(videoUrl)}`;
        window.location.href = redirectUrl;
    } else {
        alert('Unable to recognize the song.');
    }
}


    /// Function to show the sound wave animation and hide floating spheres
    function activateSoundWave() {
        // Show the sound wave
        soundWave.style.display = 'flex';

        // Hide all floating spheres
        floatingSpheres.forEach(sphere => {
            sphere.style.display = 'none';
        });
    }

    // Event Listener for Identify Button
    identifyButton.addEventListener('click', function () {
        activateSoundWave();

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
                handleSongRecognition(result); // Process song recognition
            })
            .catch(error => {
                console.error('Upload error:', error);
            });
        } else {
            alert('Please select a music file before identifying.');
        }
    });

    async function getSpotifyAccessToken() {
        const authString = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
        
        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            new URLSearchParams({ grant_type: 'client_credentials' }),
            {
                headers: {
                    Authorization: `Basic ${authString}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );
        
        return response.data.access_token;
    }
    

    // Event Listener for Start Listening through Microphone Button
    startListeningMicButton.addEventListener('click', async function () {
        activateSoundWave();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            if (stream) {
                const mediaRecorder = new MediaRecorder(stream);
                let audioChunks = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    const formData = new FormData();
                    formData.append('musicFile', audioBlob, 'micAudio.wav');

                    fetch('/upload', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => response.json())
                    .then(result => {
                        handleSongRecognition(result); // Process song recognition
                    })
                    .catch(error => {
                        console.error('Microphone upload error:', error);
                    });
                };

                mediaRecorder.start();
                setTimeout(() => {
                    if (mediaRecorder.state === "recording") {
                        mediaRecorder.stop();
                    }
                }, 20000);

                startListeningMicButton.disabled = true;
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

document.addEventListener('DOMContentLoaded', function () {
    const sphereButton = document.querySelector('.sphere-button');
    const soundWave = document.querySelector('.sound-wave');

    // Keep existing functionality of the sphere button here
    sphereButton.addEventListener('click', function () {
        // Execute original functionality (add your logic here)

        // Toggle visibility of the sound-wave animation
        if (soundWave.style.display === 'none' || !soundWave.style.display) {
            soundWave.style.display = 'flex'; // Show the sound wave
        } else {
            soundWave.style.display = 'none'; // Hide the sound wave
        }
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const sphereButton = document.querySelector('.sphere-button');
    const floatingSphere = document.querySelector('.floating-sphere');
    const overlayText = document.querySelector('.overlay');
    const soundWave = document.querySelector('.sound-wave');

    // Add event listener to the sphere button
    sphereButton.addEventListener('click', function () {
        // Hide the sphere and overlay text
        floatingSphere.style.display = 'none';
        overlayText.style.display = 'none';

        // Show the sound wave animation
        soundWave.style.display = 'flex';
    });
});

