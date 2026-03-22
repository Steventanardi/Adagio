export async function initLibrary() {
    const container = document.getElementById('libraryContainer');
    if (!container) return;
    
    const token = localStorage.getItem('adagio_token');
    if (!token) {
        container.innerHTML = '<div class="result-card"><p>Please <a href="signin.html">sign in</a> to view your library.</p></div>';
        return;
    }

    container.innerHTML = '<div class="result-card"><p>✨ Loading your collection...</p></div>';

    try {
        const response = await fetch('/api/library', { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await response.json();

        if (result.success) {
            const library = result.library;
            const ids = Object.keys(library);

            if (ids.length === 0) {
                container.innerHTML = '<div class="result-card"><p>Your library is empty. Start hearting songs!</p></div>';
            } else {
                container.innerHTML = '';
                const { renderSongResult } = await import('../ui.js');
                ids.forEach(id => {
                    const song = library[id];
                    const cardWrapper = document.createElement('div');
                    cardWrapper.className = 'song-card-wrapper';
                    cardWrapper.style.marginBottom = '20px';
                    renderSongResult(song, cardWrapper);
                    container.appendChild(cardWrapper);
                });
            }
        } else {
            container.innerHTML = `<div class="result-card"><p class="error">${result.message}</p></div>`;
        }
    } catch (e) {
        console.error("Library fetch failed", e);
        container.innerHTML = '<div class="result-card"><p class="error">Failed to load library. Check your connection.</p></div>';
    }
}
