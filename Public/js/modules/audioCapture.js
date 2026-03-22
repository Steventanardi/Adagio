import { sanitizeHTML } from '../utils.js';
import { uploadMicAudioAPI, uploadInDeviceAudioAPI, fetchYouTubeVideoAPI } from '../api.js';
import { startVisualizer } from '../audio.js';
import { renderSongResult, showTimeoutFeedback, clearTimeoutFeedback } from '../ui.js';

export function initAudioCapture() {
    const startListeningMicButton = document.getElementById('startListeningMic');
    const micStatus = document.getElementById('micStatus');
    const liveResultMic = document.getElementById('liveResultMic');

    const startRecognitionButton = document.getElementById('startRecognition');
    const stopRecognitionButton = document.getElementById('stopRecognition');
    const recognitionResult = document.getElementById('recognitionResult');
    const recognitionStatus = document.getElementById('recognitionStatus');

    let mediaRecorder;
    let audioChunks = [];
    let isListening = false;
    let displayStream;
    let currentAnim;

    const stopMicUI = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
        if (currentAnim && currentAnim.animationId) cancelAnimationFrame(currentAnim.animationId);
        if (currentAnim && currentAnim.audioContext) currentAnim.audioContext.close();
        if (currentAnim && currentAnim.cleanup) currentAnim.cleanup();
        isListening = false;
        
        const core = document.querySelector('.mic-ui-core');
        startListeningMicButton?.classList.remove('listening', 'pulsing');
        core?.classList.remove('active', 'listening');
        
        const btnText = startListeningMicButton?.querySelector('span');
        if (btnText) btnText.textContent = 'Start Listening';
        if (micStatus) micStatus.textContent = 'Tap to start over';
    };

    if (startListeningMicButton) {
        startListeningMicButton.addEventListener('click', async () => {
            if (!isListening) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    currentAnim = startVisualizer(stream);
                    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
                    mediaRecorder = new MediaRecorder(stream, { mimeType });
                    audioChunks = [];
                    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
                    mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        if (audioBlob.size < 50000) {
                            liveResultMic.innerHTML = `<div class="result-card"><p class="error">Recording was too quiet.</p></div>`;
                            stopMicUI(); return;
                        }
                        const formData = new FormData(); formData.append('musicFile', audioBlob, 'micAudio.webm');
                        showTimeoutFeedback(liveResultMic, 'Analyzing sound waves...');
                        try {
                            const controller = new AbortController();
                            const id = setTimeout(() => controller.abort(), 45000);
                            const result = await uploadMicAudioAPI(formData, controller);
                            clearTimeout(id); clearTimeoutFeedback();
                            if (result.success) {
                                const song = result.metadata || result;
                                fetchYouTubeVideoAPI(song.title, song.artist).then(videoData => {
                                    renderSongResult({ ...song, videoUrl: videoData.success ? videoData.videoUrl : null, autoPlayTrack: true }, liveResultMic);
                                }).catch(() => renderSongResult({ ...song, autoPlayTrack: true }, liveResultMic));
                            } else liveResultMic.innerHTML = `<div class="result-card"><p class="error">${sanitizeHTML(result.message)}</p></div>`;
                        } catch (e) { clearTimeoutFeedback(); liveResultMic.innerHTML = `<div class="result-card"><p class="error">Upload failed.</p></div>`; }
                        stopMicUI();
                    };
                    mediaRecorder.start(1000);
                    startListeningMicButton.classList.add('listening', 'pulsing');
                    const core = document.querySelector('.mic-ui-core');
                    core?.classList.add('active', 'listening');
                    if (micStatus) micStatus.textContent = 'Adagio is listening...';
                    isListening = true;
                    setTimeout(() => stopMicUI(), 15000);
                } catch (err) { if(micStatus) micStatus.textContent = '❌ Microphone blocked.'; }
            } else stopMicUI();
        });
    }

    const resetInDeviceUI = () => {
        if(recognitionStatus) recognitionStatus.textContent = 'Ready to capture';
        const core = document.querySelector('.mic-ui-core');
        core?.classList.remove('active', 'capturing');
        
        if(startRecognitionButton) {
            startRecognitionButton.disabled = false;
            startRecognitionButton.style.display = 'flex';
        }
        if(stopRecognitionButton) {
            stopRecognitionButton.disabled = true;
            stopRecognitionButton.style.display = 'none';
        }
        if (displayStream) displayStream.getTracks().forEach(track => track.stop());
    };

    if (startRecognitionButton) {
        startRecognitionButton.addEventListener('click', async () => {
            try {
                displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                const audioTrack = displayStream.getAudioTracks()[0];
                if (!audioTrack) throw new Error("No system audio track.");
                mediaRecorder = new MediaRecorder(new MediaStream([audioTrack]), { mimeType: 'audio/webm' });
                audioChunks = [];
                mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
                mediaRecorder.onstop = async () => {
                    if (audioChunks.length === 0) { resetInDeviceUI(); return; }
                    const formData = new FormData(); formData.append('musicFile', new Blob(audioChunks, { type: 'audio/webm' }), 'indeviceAudio.webm');
                    showTimeoutFeedback(recognitionResult, 'Processing internal audio...');
                    try {
                        const controller = new AbortController(); const id = setTimeout(() => controller.abort(), 45000);
                        const result = await uploadInDeviceAudioAPI(formData, controller);
                        clearTimeout(id); clearTimeoutFeedback();
                        if (result.success) {
                            const song = result.metadata || result;
                            fetchYouTubeVideoAPI(song.title, song.artist).then(videoData => {
                                renderSongResult({ ...song, videoUrl: videoData.success ? videoData.videoUrl : null, autoPlayTrack: true }, recognitionResult);
                            }).catch(() => renderSongResult({ ...song, autoPlayTrack: true }, recognitionResult));
                        } else recognitionResult.innerHTML = `<div class="result-card"><p class="error">Failed.</p></div>`;
                    } catch(e) { clearTimeoutFeedback(); recognitionResult.innerHTML = `<div class="result-card"><p class="error">Error.</p></div>`; }
                    resetInDeviceUI();
                };
                mediaRecorder.start();
                if(recognitionStatus) recognitionStatus.textContent = 'Capturing... Play some music now!';
                
                const core = document.querySelector('.mic-ui-core');
                core?.classList.add('active', 'capturing');
                
                startRecognitionButton.style.display = 'none';
                if(stopRecognitionButton) {
                    stopRecognitionButton.disabled = false;
                    stopRecognitionButton.style.display = 'flex';
                }
                setTimeout(() => { if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop(); }, 10000);
            } catch (err) { alert('Screen capture permission is required.'); }
        });
    }

    if (stopRecognitionButton) {
        stopRecognitionButton.addEventListener('click', () => { if (mediaRecorder) mediaRecorder.stop(); resetInDeviceUI(); });
    }
}
