import { sanitizeHTML } from '../utils.js';
import { uploadFileAPI, fetchYouTubeVideoAPI } from '../api.js';
import { renderSongResult, showTimeoutFeedback, clearTimeoutFeedback, updateFileName } from '../ui.js';

export function initUpload() {
    const musicInput = document.getElementById('musicInput');
    const uploadResult = document.getElementById('uploadResult');
    const uploadButton = document.getElementById('uploadButton');
    const dropZone = document.getElementById('dropZone');
    const fileNameDisplay = document.getElementById('fileNameDisplay');

    if (musicInput && fileNameDisplay) {
        musicInput.addEventListener('change', (e) => updateFileName(fileNameDisplay, e.target.files[0]));
    }

    if (dropZone && musicInput) {
        dropZone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') musicInput.click();
        });
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); }));
        ['dragenter', 'dragover'].forEach(evt => dropZone.addEventListener(evt, () => dropZone.classList.add('dragover')));
        ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, () => dropZone.classList.remove('dragover')));
        dropZone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files.length > 0) {
                musicInput.files = e.dataTransfer.files;
                updateFileName(fileNameDisplay, e.dataTransfer.files[0]);
            }
        });
    }

    if (uploadButton) {
        uploadButton.addEventListener('click', async () => {
            const file = musicInput?.files[0];
            if (!file) { alert("Please select a file first."); return; }
            const formData = new FormData(); formData.append('musicFile', file);
            showTimeoutFeedback(uploadResult, 'Finalizing identification...');
            try {
                const controller = new AbortController(); const id = setTimeout(() => controller.abort(), 60000);
                const result = await uploadFileAPI(formData, controller);
                clearTimeout(id); clearTimeoutFeedback();
                if (result.success) {
                    const song = result.metadata || result;
                    fetchYouTubeVideoAPI(song.title, song.artist).then(videoData => {
                        renderSongResult({ ...song, videoUrl: videoData.success ? videoData.videoUrl : null, autoPlayTrack: true }, uploadResult);
                    }).catch(() => renderSongResult({ ...song, autoPlayTrack: true }, uploadResult));
                } else uploadResult.innerHTML = `<div class="result-card"><p class="error">${sanitizeHTML(result.message)}</p></div>`;
            } catch(e) { clearTimeoutFeedback(); uploadResult.innerHTML = `<div class="result-card"><p class="error">Upload timed out or failed.</p></div>`; }
        });
    }
}
