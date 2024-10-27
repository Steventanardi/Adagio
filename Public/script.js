// Helper function to handle response from music recognition API
function handleRecognitionResult(result, outputElementId) {
    const outputElement = document.getElementById(outputElementId);
    if (result.success) {
        outputElement.innerHTML = `
            <h3>Song Information</h3>
            <p><strong>Title:</strong> ${result.title}</p>
            <p><strong>Artist:</strong> ${result.artist}</p>
            <p><strong>Album:</strong> ${result.album}</p>
            <h3>Lyrics</h3>
            <p>${result.lyrics}</p>
        `;
        
        // Update the music player with the identified song information
        updateMusicPlayer(result);
    } else {
        outputElement.innerHTML = `
            <h3>Song Information</h3>
            <p><strong>Title:</strong> ${result.title || 'Unknown'}</p>
            <p><strong>Artist:</strong> ${result.artist || 'Unknown'}</p>
            <p><strong>Album:</strong> ${result.album || 'Unknown'}</p>
            <h3>Lyrics</h3>
            <p>Lyrics not available</p>
        `;
    }
}

// Function to update the music player UI
function updateMusicPlayer(result) {
    document.getElementById('songTitle').innerText = result.title || 'Unknown Title';
    document.getElementById('songArtist').innerText = result.artist || 'Unknown Artist';
    document.getElementById('albumArt').src = result.albumArtUrl || 'default_album_art.jpg';
    document.getElementById('audioSource').src = result.previewUrl || '';
    document.getElementById('audioPlayer').load();
    document.getElementById('musicPlayer').classList.remove('hidden');
}

// Helper function to upload audio for recognition
function uploadAudio(audioBlob, outputElementId) {
    const formData = new FormData();
    formData.append('musicFile', audioBlob);

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(result => handleRecognitionResult(result, outputElementId))
        .catch(error => {
            console.error('Error:', error);
        });
}

// File upload for music recognition
document.getElementById('identifyButton').addEventListener('click', () => {
    const musicInput = document.getElementById('musicInput').files[0];
    if (musicInput) {
        uploadAudio(musicInput, 'result');
    } else {
        alert('Please select a music file first.');
    }
});

// Live listening helper function
function startLiveListening(outputElementId, streamType) {
    const mediaFunction = streamType === 'getDisplayMedia' ? navigator.mediaDevices.getDisplayMedia : navigator.mediaDevices.getUserMedia;

    mediaFunction({ video: false, audio: true })
        .then(stream => {
            const mediaRecorder = new MediaRecorder(stream);
            let audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                uploadAudio(audioBlob, outputElementId);
            };

            mediaRecorder.start();
            setTimeout(() => mediaRecorder.stop(), 20000); // Stop recording after 20 seconds

            // Enable/Disable buttons
            document.getElementById(`stopListening${streamType}`).disabled = false;
            document.getElementById(`startListening${streamType}`).disabled = true;
        })
        .catch(err => {
            if (err.name === 'NotAllowedError') {
                alert(`Permission denied. Please allow permissions to access ${streamType === 'getDisplayMedia' ? 'screen' : 'microphone'} audio.`);
            } else if (err.name === 'NotFoundError') {
                alert(`No audio input found. Please check your device's audio settings.`);
            } else {
                console.error(`Error accessing ${streamType}:`, err);
                alert(`Unable to access the ${streamType}. Make sure to allow permissions.`);
            }
        });
}

// Live Listening for Device
document.getElementById('startListeningDevice').addEventListener('click', () => {
    startLiveListening('liveResultDevice', 'getDisplayMedia');
});

document.getElementById('stopListeningDevice').addEventListener('click', () => {
    document.getElementById('stopListeningDevice').disabled = true;
    document.getElementById('startListeningDevice').disabled = false;
});

// Live Listening for Microphone
document.getElementById('startListeningMic').addEventListener('click', async () => {
    try {
        // Request microphone access
        const constraints = {
            audio: {
                deviceId: 'default', // You can set specific device ID or keep it default
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

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
                formData.append('musicFile', audioBlob, 'microphoneAudio.wav');

                fetch('/upload', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(result => {
                    if (result.success) {
                        document.getElementById('liveResultMic').innerHTML = `
                            <h3>Song Information</h3>
                            <p><strong>Title:</strong> ${result.title}</p>
                            <p><strong>Artist:</strong> ${result.artist}</p>
                            <p><strong>Album:</strong> ${result.album}</p>
                            <h3>Lyrics</h3>
                            <p>${result.lyrics}</p>
                        `;
                    } else {
                        document.getElementById('liveResultMic').innerHTML = `
                            <h3>Song Information</h3>
                            <p><strong>Title:</strong> ${result.title || 'Unknown'}</p>
                            <p><strong>Artist:</strong> ${result.artist || 'Unknown'}</p>
                            <p><strong>Album:</strong> ${result.album || 'Unknown'}</p>
                            <h3>Lyrics</h3>
                            <p>Lyrics not available</p>
                        `;
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                });
            };

            // Start recording after obtaining the stream
            mediaRecorder.start();
            setTimeout(() => {
                mediaRecorder.stop();
            }, 20000); // Stop recording after 20 seconds

            document.getElementById('stopListeningMic').disabled = false;
            document.getElementById('startListeningMic').disabled = true;
        }
    } catch (err) {
        console.error('Error accessing microphone:', err);
        if (err.name === 'NotAllowedError') {
            alert('Permission denied. Please allow microphone access in your browser settings.');
        } else if (err.name === 'NotFoundError') {
            alert('No microphone found. Please check your device.');
        } else {
            alert('Unable to access the microphone. Make sure to allow permissions.');
        }
    }
});

document.getElementById('stopListeningMic').addEventListener('click', () => {
    document.getElementById('stopListeningMic').disabled = true;
    document.getElementById('startListeningMic').disabled = false;
});


document.getElementById('stopListeningMic').addEventListener('click', () => {
    document.getElementById('stopListeningMic').disabled = true;
    document.getElementById('startListeningMic').disabled = false;
});

// Audio Player Script for Syncing Time and Controls
const audioPlayer = document.getElementById('audioPlayer');
const playPauseButton = document.getElementById('playPauseButton');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const seekBar = document.getElementById('seek-bar');
const currentTimeElement = document.getElementById('currentTime');
const durationElement = document.getElementById('duration');
const muteButton = document.getElementById('muteButton');
const volumeBar = document.getElementById('volume-bar');

// Update seek bar and duration
audioPlayer.addEventListener('loadedmetadata', () => {
    seekBar.max = Math.floor(audioPlayer.duration);
    durationElement.textContent = formatTime(audioPlayer.duration);
});

audioPlayer.addEventListener('timeupdate', () => {
    seekBar.value = Math.floor(audioPlayer.currentTime);
    currentTimeElement.textContent = formatTime(audioPlayer.currentTime);
});

playPauseButton.addEventListener('click', () => {
    if (audioPlayer.paused) {
        audioPlayer.play();
        playPauseButton.textContent = '⏸️';
    } else {
        audioPlayer.pause();
        playPauseButton.textContent = '⏯️';
    }
});

prevButton.addEventListener('click', () => {
    // Handle previous button functionality (currently restarts the track)
    audioPlayer.currentTime = 0;
});

nextButton.addEventListener('click', () => {
    // Handle next button functionality (currently skips to end of the track)
    audioPlayer.currentTime = audioPlayer.duration;
});

seekBar.addEventListener('input', () => {
    audioPlayer.currentTime = seekBar.value;
});

muteButton.addEventListener('click', () => {
    audioPlayer.muted = !audioPlayer.muted;
    muteButton.textContent = audioPlayer.muted ? '🔈' : '🔇';
});

volumeBar.addEventListener('input', () => {
    audioPlayer.volume = volumeBar.value;
});

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}
