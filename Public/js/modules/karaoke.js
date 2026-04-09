let socket;
let roomId;
let audioContext;
let nextStartTime = 0;

export function initKaraoke() {
    const karaokeBtn = document.getElementById('karaokeModeBtn');
    const modal = document.getElementById('karaokeModal');
    const closeModal = modal.querySelector('.close-modal');
    const qrContainer = document.getElementById('karaokeQrCode');
    const linkDisplay = document.getElementById('karaokeLink');
    const statusDisplay = document.getElementById('remoteConnectionStatus');

    if (!karaokeBtn) return;

    karaokeBtn.onclick = async (e) => {
        e.preventDefault();
        
        if (!socket) setupSocket();
        
        if (!roomId) {
            roomId = 'room-' + Math.random().toString(36).substring(2, 9);
            socket.emit('join-room', roomId);
        }

        // Fetch local IP for remote access
        let host = window.location.hostname;
        try {
            const res = await fetch('/api/host-ip');
            const data = await res.json();
            if (data.ip && data.ip !== 'localhost') {
                host = data.ip;
            }
        } catch (err) { console.warn("Failed to fetch host IP", err); }

        const remoteUrl = `http://${host}:${window.location.port || 3000}/karaoke_remote.html?room=${roomId}`;
        qrContainer.innerHTML = '';

        new QRCode(qrContainer, {
            text: remoteUrl,
            width: 200,
            height: 200,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
        linkDisplay.innerText = remoteUrl;
        
        modal.style.display = 'block';
    };

    closeModal.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

    function setupSocket() {
        socket = io();
        
        socket.on('connect', () => {
            if (roomId) socket.emit('join-room', roomId);
        });

        socket.on('lyrics-update', (data) => {
            // If the phone sends something back (not used yet, but for future)
        });

        socket.on('remote-audio', async (blob) => {
            statusDisplay.innerText = '🟢 Remote Mic Active';
            statusDisplay.style.color = 'var(--accent-primary)';
            
            if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            
            // Basic scheduling to reduce jitter
            const currentTime = audioContext.currentTime;
            if (nextStartTime < currentTime) nextStartTime = currentTime;
            source.start(nextStartTime);
            nextStartTime += audioBuffer.duration;
        });

        socket.on('disconnect', () => {
            statusDisplay.innerText = '🔴 Disconnected';
        });
    }

    // Hook into the player to sync lyrics
    setInterval(() => {
        if (!socket || !roomId) return;
        
        const lyricsContainer = document.querySelector('.lyrics-container');
        if (!lyricsContainer) return;

        const songCard = lyricsContainer.closest('.result-card');
        const title = songCard.querySelector('.song-title').innerText.replace('🎵 ', '');
        const artist = songCard.querySelector('.song-artist').innerText.replace('by ', '');
        
        // Metadata Sync
        if (window.lastSyncedSong !== title) {
            socket.emit('sync-lyrics', {
                roomId,
                data: { type: 'metadata', title, artist }
            });
            window.lastSyncedSong = title;
        }

        // Lyrics Sync
        // For simplicity in this demo, we'll just send all lines.
        // In a real app, we'd find the active line based on audio time.
        const lines = Array.from(lyricsContainer.querySelectorAll('.lyric-line')).map(el => el.innerText);
        // Let's assume the first line is current for now, or use a pseudo-scroller
        // Improvement: If Adagio had a timestamped lyric system, we'd use that.
        socket.emit('sync-lyrics', {
            roomId,
            data: { type: 'lyrics', lines, currentIndex: 0 } // index is hardcoded to 0 for now as Adagio doesn't have a seekable player with timestamps yet
        });
    }, 2000);
}
