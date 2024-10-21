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
        .then(response => response.text())
        .then(result => {
            document.getElementById('result').innerText = result;
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('result').innerText = 'Error recognizing the song. Please try again.';
        });
    } else {
        alert('Please select a music file first.');
    }
});

// Live listening for music recognition
let mediaRecorder;
let audioChunks = [];

const startListeningButton = document.getElementById('startListening');
const stopListeningButton = document.getElementById('stopListening');

startListeningButton.addEventListener('click', () => {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();

            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener('stop', () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                audioChunks = [];

                const formData = new FormData();
                formData.append('musicFile', audioBlob, 'liveAudio.wav');

                fetch('/upload', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.text())
                .then(result => {
                    document.getElementById('liveResult').innerText = result;
                })
                .catch(error => {
                    console.error('Error:', error);
                    document.getElementById('liveResult').innerText = 'Error recognizing the song. Please try again.';
                });
            });

            startListeningButton.disabled = true;
            stopListeningButton.disabled = false;
        })
        .catch(error => {
            console.error('Error accessing microphone:', error);
        });
});

stopListeningButton.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    startListeningButton.disabled = false;
    stopListeningButton.disabled = true;
});
