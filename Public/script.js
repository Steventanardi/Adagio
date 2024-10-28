document.addEventListener('DOMContentLoaded', function() {
    const sphereButton = document.querySelector('.sphere-button');
    const microphoneWave = document.querySelector('.microphone-wave');
    const floatingSphere = document.querySelector('.floating-sphere');
    const soundWave = document.querySelector('.sound-wave');
    const overlayText = document.querySelector('.overlay');
    const stopListeningButton = document.getElementById('stopListeningDevice');
    const musicPlayer = document.getElementById('musicPlayer');

    // Replace the "Start Listening in Device" functionality with the sphere button
    sphereButton.addEventListener('click', async function(event) {
        event.preventDefault(); // Prevent default anchor behavior

        // Show animation effects
        microphoneWave.style.display = 'block';
        microphoneWave.classList.toggle('active-wave');

        setTimeout(() => {
            floatingSphere.style.display = 'none';
            microphoneWave.style.display = 'none';
            overlayText.style.display = 'none';
            soundWave.style.display = 'flex';
        }, 400);

        // Start listening in the device (previous functionality)
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: false,
                audio: true
            });

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
                    formData.append('musicFile', audioBlob, 'systemAudio.wav');

                    fetch('/upload', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => response.json())
                    .then(result => {
                        if (result.success) {
                            document.getElementById('liveResultDevice').innerHTML = `
                                <h3>Song Information</h3>
                                <p><strong>Title:</strong> ${result.title}</p>
                                <p><strong>Artist:</strong> ${result.artist}</p>
                                <p><strong>Album:</strong> ${result.album}</p>
                                <h3>Lyrics</h3>
                                <p>${result.lyrics}</p>
                            `;
                            // Show the music player after identifying the song
                            musicPlayer.classList.remove('hidden');
                        } else {
                            document.getElementById('liveResultDevice').innerHTML = `
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

                stopListeningButton.disabled = false;
            }
        } catch (err) {
            console.error('Error capturing system audio:', err);
            alert('Unable to capture system audio. Make sure to allow permissions and select a screen with audio.');
        }
    });
});

// Keep the stop button functionality the same
document.getElementById('stopListeningDevice').addEventListener('click', () => {
    document.getElementById('stopListeningDevice').disabled = true;
    // Enable the sphere button if needed
    const sphereButton = document.querySelector('.sphere-button');
    if (sphereButton) {
        sphereButton.disabled = false;
    }
});

// File upload for music recognition
document.getElementById('identifyButton').addEventListener('click', () => {
    const musicInput = document.getElementById('musicInput').files[0];
    if (musicInput) {
        const formData = new FormData();
        formData.append('musicFile', musicInput);

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                document.getElementById('result').innerHTML = `
                    <h3>Song Information</h3>
                    <p><strong>Title:</strong> ${result.title}</p>
                    <p><strong>Artist:</strong> ${result.artist}</p>
                    <p><strong>Album:</strong> ${result.album}</p>
                    <h3>Lyrics</h3>
                    <p>${result.lyrics}</p>
                `;
            } else {
                document.getElementById('result').innerText = 'Unable to recognize the song';
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    } else {
        alert('Please select a music file first.');
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const startListeningMicButton = document.getElementById('startListeningMic');
    const stopListeningMicButton = document.getElementById('stopListeningMic');
    let mediaRecorderMic;
    let micTimeout;

    // Start listening through the microphone
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
                            document.getElementById('liveResultMic').innerText = 'Unable to recognize the song';
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                    });
                };

                // Start recording for a maximum duration of 20 seconds
                mediaRecorderMic.start();
                micTimeout = setTimeout(() => {
                    mediaRecorderMic.stop();
                }, 20000);

                // Stop recording if song is recognized
                mediaRecorderMic.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }

                    // After capturing data, stop recording if enough data was collected
                    if (audioChunks.length > 0 && mediaRecorderMic.state === "recording") {
                        mediaRecorderMic.stop();
                    }
                };

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
});
