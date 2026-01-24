// main.js
const { app: electronApp, BrowserWindow } = require('electron');
const path = require('path');
const server = require('./server');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

// point fluent-ffmpeg at the bundled binary
ffmpeg.setFfmpegPath(ffmpegPath);

const PORT = process.env.PORT || 3000;

// start your Express server
server.listen(PORT, () => {
  console.log(`Express listening on http://localhost:${PORT}`);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      contextIsolation: true,
      // disable nodeIntegration in renderer for security
      nodeIntegration: false,
    }
  });
  win.loadURL(`http://localhost:${PORT}`);
}

electronApp.whenReady().then(createWindow);

electronApp.on('window-all-closed', () => {
  if (process.platform !== 'darwin') electronApp.quit();
});
