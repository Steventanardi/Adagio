export function getSavedTheme() {
    return localStorage.getItem('adagio_theme') || 'dark';
}

export function setAdagioTheme(theme, themeToggle) {
    document.body.dataset.theme = theme;
    localStorage.setItem('adagio_theme', theme);
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

export function safeBtoa(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
        }));
}

export function convertToEmbedUrl(youtubeUrl) {
    if (!youtubeUrl) return null;
    if (youtubeUrl.includes("youtube.com/embed/")) {
        return youtubeUrl.split('?')[0];
    }
    const idMatch = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
    if (idMatch && idMatch[1]) return `https://www.youtube.com/embed/${idMatch[1]}`;
    return youtubeUrl.replace("watch?v=", "embed/");
}

export function sanitizeHTML(str) {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

export function saveToHistory(query) {
    if (query.includes('[HUMMING/SINGING MODE]')) return;
    const history = JSON.parse(localStorage.getItem('adagio_history') || '[]');
    if (!history.includes(query)) {
        history.unshift(query);
        localStorage.setItem('adagio_history', JSON.stringify(history.slice(0, 10)));
    }
}

export function getHistory() {
    let history = JSON.parse(localStorage.getItem('adagio_history') || '[]');
    const originalLength = history.length;
    history = history.filter(item => !item.includes('[HUMMING/SINGING MODE]'));
    if (history.length !== originalLength) {
        localStorage.setItem('adagio_history', JSON.stringify(history));
    }
    return history;
}
