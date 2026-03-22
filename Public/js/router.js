export async function navigate(url, addToHistory = true) {
    const mainContent = document.querySelector('.main-content-wrapper');
    if (mainContent) {
        mainContent.innerHTML = `<div class="result-card" style="text-align: center; padding: 50px;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--accent-primary);"></i></div>`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const text = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        const newMain = doc.querySelector('.main-content-wrapper');
        const newSidebar = doc.querySelector('.sidebar');

        if (newMain) document.querySelector('.main-content-wrapper').replaceWith(newMain);
        if (newSidebar) document.querySelector('.sidebar').replaceWith(newSidebar);

        document.title = doc.title;
        if (addToHistory) history.pushState({ url }, '', url);

        window.dispatchEvent(new CustomEvent('adagio-route-change', { detail: { url } }));
    } catch (e) {
        console.error("Navigation error:", e);
        const mc = document.querySelector('.main-content-wrapper');
        if (mc) mc.innerHTML = `<div class="result-card"><p class="error">Failed to load view.</p></div>`;
    }
}

export function initRouter() {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href) {
            const url = new URL(link.href);
            if (url.origin === location.origin && url.pathname.endsWith('.html')) {
                e.preventDefault();
                navigate(url.pathname);
            }
        }
    });

    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.url) navigate(e.state.url, false);
        else navigate(location.pathname, false);
    });

    // Fire initial route event
    window.dispatchEvent(new CustomEvent('adagio-route-change', { detail: { url: location.pathname } }));
}
