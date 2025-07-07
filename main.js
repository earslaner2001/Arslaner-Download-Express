const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const { downloadFile } = require('./index');

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.on('start-download', async (event, url, filename) => {
    const downloadsDir = path.join(os.homedir(), 'Downloads', 'ArslanerDownloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const outputPath = path.join(downloadsDir, filename);
    const writer = fs.createWriteStream(outputPath);

    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream'
    });

    const totalLength = parseInt(response.headers['content-length']);
    let downloaded = 0;

    response.data.on('data', (chunk) => {
      downloaded += chunk.length;
      const percent = Math.floor((downloaded / totalLength) * 100);
      event.sender.send('download-progress', percent);
    });

    response.data.pipe(writer);

    writer.on('finish', () => {
      event.sender.send('download-complete', filename);
    });

    writer.on('error', (err) => {
      event.sender.send('download-error', err.message);
    });
  });

  ipcMain.on('start-ytdlp', (event, url, filename, format) => {
    if (!url || typeof url !== "string" || url.trim() === "") {
      event.sender.send('download-error', 'Geçerli bir video bağlantısı girilmedi.');
      return;
    }

    const downloadsDir = path.join(os.homedir(), 'Downloads', 'ArslanerDownloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const outputPath = path.join(downloadsDir, filename);
    const ytDlpPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'yt-dlp.exe');
    const ffmpegPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'ffmpeg.exe');

    const command = `"${ytDlpPath}" --ffmpeg-location "${ffmpegPath}" -f "bv*[ext=mp4][height=1080]+ba[ext=m4a]/b[ext=mp4]" -o "${outputPath}" "${url}"`;

    console.log("YT-DLP Komutu:", command);

    const proc = exec(command);

    proc.stdout.on('data', (data) => {
      if (data.includes('%')) {
        const match = data.match(/(\d{1,3}\.\d)%/);
        if (match) {
          const percent = parseFloat(match[1]);
          event.sender.send('download-progress', percent);
        }
      }
    });

    proc.stderr.on('data', (data) => {
      console.error('yt-dlp stderr:', data.toString());
      event.sender.send('download-error', data.toString());
    });

    proc.on('close', (code) => {
      if (code === 0) {
        event.sender.send('download-complete', filename);
      } else {
        event.sender.send('download-error', `yt-dlp çıkış kodu: ${code}`);
      }
    });
  });
});