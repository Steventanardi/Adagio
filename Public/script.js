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

    /// Function to show the sound wave animation and hide floating spheres
    function activateSoundWave() {
        // Show the sound wave
        soundWave.style.display = 'flex';

        // Hide all floating spheres
        floatingSpheres.forEach(sphere => {
            sphere.style.display = 'none';
        });
    }

    document.querySelector('#intelligentSearchButton').addEventListener('click', async function () {
        const queryInput = document.querySelector('#intelligentSearchInput');
        const userQuery = queryInput.value.trim();
    
        if (!userQuery) {
            alert('Please enter a query before searching.');
            return;
        }
    
        try {
            const response = await fetch('/intelligent-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userQuery }),
            });
    
            const result = await response.json();
            const resultContainer = document.querySelector('#result');
    
            if (result.success) {
                resultContainer.innerHTML = `
                    <div class="result-content">
                        <h3>Search Result</h3>
                        <p>${result.response}</p>
                    </div>`;
            } else {
                resultContainer.innerHTML = `<p class="error">No results found. Please try again!</p>`;
            }
        } catch (error) {
            console.error('Error fetching search results:', error);
            alert('Error fetching intelligent search results.');
        }
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
                    alert(`ChatGPT Response: ${result.response}`);
                } else {
                    alert('Failed to fetch recommendations. Try again!');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error fetching intelligent search results.');
            }
        }
    }
    
    function updateMusicPlayer(title, artist, audioUrl) {
        const audioPlayer = document.getElementById('audioPlayer');
        const audioSource = document.getElementById('audioSource');
        const trackTitle = document.getElementById('trackTitle');
        const trackArtist = document.getElementById('trackArtist');
    
        if (audioUrl) {
            audioSource.src = audioUrl;
            audioPlayer.load(); // Reload player
            audioPlayer.play(); // Start playing the song
        } else {
            alert('Audio URL not available for this song.');
        }
    
        trackTitle.textContent = `Title: ${title}`;
        trackArtist.textContent = `Artist: ${artist}`;
    }
    
    document.getElementById('intelligentSearchButton').addEventListener('click', async () => {
        const userQuery = document.getElementById('intelligentSearchInput').value.trim();
        if (!userQuery) return alert('Please enter a query.');
    
        try {
            const response = await fetch('/intelligent-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userQuery }),
            });
    
            const result = await response.json();
            const resultContainer = document.getElementById('result');
    
            if (result.success) {
                resultContainer.innerHTML = `
                    <div class="result-content">
                        <h3>Search Result</h3>
                        <p>${result.response}</p>
                    </div>`;
                
                updateMusicPlayer(result.title, result.artist, result.audioUrl);
            } else {
                resultContainer.innerHTML = `<p class="error">No results found.</p>`;
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error fetching song details.');
        }
    });
    
    
    // Example usage when a song is chosen
    document.querySelector('#intelligentSearchButton').addEventListener('click', async function () {
        const userQuery = document.querySelector('#intelligentSearchInput').value.trim();
    
        if (!userQuery) {
            alert('Please enter a query.');
            return;
        }
    
        try {
            const response = await fetch('/intelligent-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userQuery }),
            });
    
            const result = await response.json();
            const resultContainer = document.querySelector('#result');
    
            if (result.success) {
                // Format the response into a clean HTML structure
                const formattedResponse = result.response
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
                    .replace(/\n/g, '<br>'); // Line breaks
    
                resultContainer.innerHTML = `
                    <div class="result-content">
                        <h3>Search Result</h3>
                        <p>${formattedResponse}</p>
                    </div>`;
                
                // Update the music player with a sample audio URL
                const audioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
                updateMusicPlayer('Selected Track', 'Unknown Artist', audioUrl);
            } else {
                resultContainer.innerHTML = `<p class="error">No results found. Please try again!</p>`;
            }
        } catch (error) {
            console.error('Error fetching search results:', error);
            alert('An error occurred while processing your request.');
        }
    });
    
    
    function createSongList(songs) {
        const resultContainer = document.getElementById('result');
        resultContainer.innerHTML = ''; // Clear existing content
    
        songs.forEach(song => {
            const songItem = document.createElement('div');
            songItem.classList.add('song-item');
            songItem.textContent = `${song.title} by ${song.artist}`;
            songItem.addEventListener('click', () => {
                updateMusicPlayer(song.title, song.artist, song.audioUrl);
            });
            resultContainer.appendChild(songItem);
        });
    }
    
    function updateMusicPlayer(title, artist, audioUrl) {
        const audioPlayer = document.getElementById('audioPlayer');
        const audioSource = document.getElementById('audioSource');
        const trackTitle = document.getElementById('trackTitle');
        const trackArtist = document.getElementById('trackArtist');
    
        if (audioUrl) {
            audioSource.src = audioUrl;
            audioPlayer.load(); // Reload player with new source
            audioPlayer.play(); // Auto-play the song
        }
    
        trackTitle.textContent = `Title: ${title || 'Not Playing'}`;
        trackArtist.textContent = `Artist: ${artist || 'Unknown'}`;
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
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            const audioChunks = [];
    
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
    
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('musicFile', audioBlob, 'micAudio.webm');
    
                fetch('/upload', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(result => {
                    handleSongRecognition(result);
                })
                .catch(error => console.error('Error uploading microphone audio:', error));
            };
    
            mediaRecorder.start();
            setTimeout(() => {
                if (mediaRecorder.state === "recording") {
                    mediaRecorder.stop();
                }
            }, 10000); // Record for 10 seconds
    
            startListeningMicButton.disabled = true;
        } catch (err) {
            console.error('Microphone access error:', err);
            alert('Please allow microphone permissions.');
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

