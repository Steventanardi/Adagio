export function startVisualizer(stream) {
    const canvas = document.getElementById('visualizer');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');

    const size = 420;
    canvas.width = size * window.devicePixelRatio;
    canvas.height = size * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const centerX = size / 2;
    const centerY = size / 2;
    const innerRadius = 95;

    let animationId;
    function draw() {
        animationId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, size, size);

        for (let i = 0; i < bufferLength; i++) {
            const value = dataArray[i];
            const percent = value / 255;
            const height = percent * 60;
            const angle = (i / bufferLength) * Math.PI * 2;

            const xStart = centerX + Math.cos(angle) * innerRadius;
            const yStart = centerY + Math.sin(angle) * innerRadius;
            const xEnd = centerX + Math.cos(angle) * (innerRadius + height);
            const yEnd = centerY + Math.sin(angle) * (innerRadius + height);

            const gradient = ctx.createLinearGradient(xStart, yStart, xEnd, yEnd);
            gradient.addColorStop(0, 'rgba(0, 242, 255, 0.8)');
            gradient.addColorStop(1, 'rgba(112, 0, 255, 0.2)');

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(xStart, yStart);
            ctx.lineTo(xEnd, yEnd);
            ctx.stroke();

            if (value > 150) {
                ctx.save();
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00f2ff';
                ctx.stroke();
                ctx.restore();
            }
        }
    }
    draw();
    return { animationId, audioContext };
}
