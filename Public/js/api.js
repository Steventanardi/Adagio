export async function fetchLibraryAPI() {
    const token = localStorage.getItem('adagio_token');
    if (!token) return { success: false, notLoggedIn: true };
    try {
        const res = await fetch('/api/library', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await res.json();
    } catch (e) {
        return { success: false, error: e };
    }
}

export async function searchIntelligentAPI(apiQuery) {
    const response = await fetch('/intelligent-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: apiQuery }),
    });
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    return await response.json();
}

export async function fetchYouTubeVideoAPI(title, artist) {
    const res = await fetch(`/api/youtube-video?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
    return await res.json();
}

export async function fetchLyricsAPI(title, artist) {
    const res = await fetch(`/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
    return await res.json();
}

export async function uploadMicAudioAPI(formData, controller) {
    const response = await fetch('/upload-mic-audio', {
        method: 'POST',
        body: formData,
        signal: controller.signal
    });
    return await response.json();
}

export async function uploadInDeviceAudioAPI(formData, controller) {
    const response = await fetch('/recognize-indevice-audio', {
        method: 'POST',
        body: formData,
        signal: controller.signal
    });
    return await response.json();
}

export async function uploadFileAPI(formData, controller) {
    const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal
    });
    return await response.json();
}

export async function deepLyricsAPI(text, artist, title) {
    const response = await fetch('/api/deep-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, artist, title })
    });
    return await response.json();
}

export async function fetchMoodAPI(artist, title, lyrics) {
    const res = await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title, lyrics })
    });
    return await res.json();
}

export async function fetchRecommendationsAPI(artist, title) {
    const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
    });
    return await res.json();
}

export async function toggleFavoriteAPI(id, songData, isAdding, token) {
    const response = await fetch(isAdding ? '/api/library/add' : '/api/library/remove', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ songId: id, songData })
    });
    return await response.json();
}

export async function translateLyricsAPI(originalText) {
    const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: originalText })
    });
    return await response.json();
}
