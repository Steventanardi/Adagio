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

export async function searchIntelligentStreamAPI(apiQuery, onChunk, onStatus, onDone, onError) {
    try {
        const response = await fetch('/intelligent-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: apiQuery }),
        });
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            
            const lines = buffer.split('\n\n');
            buffer = lines.pop(); 
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '');
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.type === 'chunk') onChunk(data.text);
                        else if (data.type === 'status') onStatus(data.message);
                        else if (data.type === 'done') onDone(data.songs);
                        else if (data.type === 'error') if (onError) onError(new Error(data.error));
                    } catch (e) { console.error('Error parsing SSE data:', e, dataStr); }
                }
            }
        }
    } catch (e) {
        if (onError) onError(e);
    }
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

export async function deepLyricsStreamAPI(text, artist, title, onChunk, onDone, onError) {
    try {
        const response = await fetch('/api/deep-lyrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, artist, title })
        });
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            
            const lines = buffer.split('\n\n');
            buffer = lines.pop(); 
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '');
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.type === 'chunk') onChunk(data.text);
                        else if (data.type === 'done') onDone();
                        else if (data.type === 'error') if (onError) onError(new Error(data.error));
                    } catch (e) { console.error('Error parsing SSE data:', e, dataStr); }
                }
            }
        }
    } catch (e) {
        if (onError) onError(e);
    }
}

export async function fetchMoodAPI(artist, title, lyrics) {
    const res = await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title, lyrics })
    });
    return await res.json();
}

export async function fetchRecommendationsStreamAPI(artist, title, onChunk, onStatus, onDone, onError) {
    try {
        const response = await fetch('/api/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artist, title })
        });
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            
            const lines = buffer.split('\n\n');
            buffer = lines.pop(); 
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '');
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.type === 'chunk') onChunk(data.text);
                        else if (data.type === 'status') onStatus(data.message);
                        else if (data.type === 'done') onDone(data.recommendations);
                        else if (data.type === 'error') if (onError) onError(new Error(data.error));
                    } catch (e) { console.error('Error parsing SSE data:', e, dataStr); }
                }
            }
        }
    } catch (e) {
        if (onError) onError(e);
    }
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
