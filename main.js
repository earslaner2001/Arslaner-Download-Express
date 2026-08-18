const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const BinariesManager = require('./binaries-manager');

if (process.env.MEDIAPULL_DEV === '1') {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    awaitWriteFinish: true,
    ignored: /node_modules|dist|binaries|\.git/
  });
}

let mainWindow;
let activeDownload = null;
const binariesManager = new BinariesManager();

const LICENSE_API = 'http://194.105.5.6:3000';
const LICENSE_STORE_URL = 'https://earslaner2001.gumroad.com/l/mediapull-pro';
const PRO_FORMATS = new Set(['yt-4k-avc1', 'yt-prores', 'yt-wav']);
let isProUser = false;
let licenseMasked = '';
let licenseToken = '';
let machineId = '';

function licenseFilePath() {
  return path.join(app.getPath('userData'), 'license.json');
}

function createMachineId() {
  const seed = [
    os.hostname(),
    os.userInfo().username,
    os.arch(),
    os.platform()
  ].join('|');
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 32);
}

function loadLicenseState() {
  try {
    const raw = JSON.parse(fs.readFileSync(licenseFilePath(), 'utf8'));
    machineId = typeof raw.machineId === 'string' && raw.machineId
      ? raw.machineId
      : createMachineId();
    licenseToken = typeof raw.token === 'string' ? raw.token : '';
    licenseMasked = typeof raw.masked === 'string' ? raw.masked : '';
    isProUser = !!licenseToken;
  } catch {
    machineId = createMachineId();
    licenseToken = '';
    licenseMasked = '';
    isProUser = false;
  }
  if (!fs.existsSync(licenseFilePath())) saveLicenseState();
}

function saveLicenseState() {
  fs.writeFileSync(licenseFilePath(), JSON.stringify({
    isPro: isProUser,
    token: licenseToken,
    machineId,
    masked: licenseMasked,
    activatedAt: new Date().toISOString()
  }, null, 2), 'utf8');
}

function maskLicenseKey(key) {
  const k = String(key || '').replace(/\s+/g, '');
  if (k.length < 8) return '••••';
  return `${k.slice(0, 4)}••••${k.slice(-4)}`;
}

async function activateLicenseOnServer(licenseKey) {
  const res = await fetch(`${LICENSE_API}/api/v1/license/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      licenseKey,
      machineId,
      product: 'mediapull'
    })
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Lisans sunucusu geçersiz yanıt verdi.');
  }
  if (!data.success) throw new Error(data.message || 'Lisans etkinleştirilemedi.');
  if (!data.token) throw new Error('Sunucu token döndürmedi.');
  return data.token;
}

async function deactivateLicenseOnServer() {
  if (!licenseToken) return;
  const res = await fetch(`${LICENSE_API}/api/v1/license/deactivate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: licenseToken,
      machineId,
      product: 'mediapull'
    })
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Lisans sunucusu geçersiz yanıt verdi.');
  }
  if (!data.success) throw new Error(data.message || 'Sunucudan çıkış yapılamadı.');
}

function clearLocalLicense() {
  licenseToken = '';
  licenseMasked = '';
  isProUser = false;
  saveLicenseState();
}

function getLicenseSnapshot() {
  return {
    isPro: isProUser,
    masked: licenseMasked,
    storeUrl: LICENSE_STORE_URL
  };
}

function resolveAppIcon() {
  const candidates = process.platform === 'win32'
    ? ['icon.ico', 'icon.png']
    : ['icon.png', 'icon.ico'];
  for (const name of candidates) {
    const iconPath = path.join(__dirname, name);
    if (!fs.existsSync(iconPath)) continue;
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) return image;
  }
  return null;
}

const APP_ICON = resolveAppIcon();

function killProcessTree(proc) {
  if (!proc || proc.killed) return;
  if (process.platform === 'win32') {
    exec(`taskkill /PID ${proc.pid} /T /F`, { windowsHide: true });
  } else {
    proc.kill('SIGTERM');
  }
}

function cleanupPartFiles(logText) {
  for (const m of logText.matchAll(/\[download\]\s+Destination:\s*(.+)/g)) {
    const partPath = `${m[1].trim()}.part`;
    try {
      if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
    } catch { /* ignore */ }
  }
}
const APP_SIZE = { width: 540, height: 910, minWidth: 480, minHeight: 800 };

function isTwitterOrXUrl(url) {
  try {
    const h = new URL(url.trim()).hostname.toLowerCase();
    return h === 'twitter.com' || h === 'www.twitter.com' || h === 'mobile.twitter.com' ||
      h === 'x.com' || h === 'www.x.com';
  } catch {
    return false;
  }
}

const TW_NLE_FORMAT =
  'best[protocol=https][ext=mp4]/best[ext=mp4]/bestvideo+bestaudio/best';

const FMT_1080 =
  'bv*[height<=1080]+ba/b[height<=1080]/bv*+ba/b';
const FMT_4K =
  'bestvideo[height=2160]+bestaudio/bestvideo[height<=2160]+bestaudio/bestvideo+bestaudio/best';
const FMT_PRORES =
  'bestvideo+bestaudio/best';

const PPA_1080 =
  'VideoConvertor:-c:v libx264 -pix_fmt yuv420p -profile:v high -c:a aac -b:a 192k';
const PPA_4K =
  'VideoConvertor:-c:v libx264 -pix_fmt yuv420p -profile:v high -c:a aac -b:a 320k';
const PPA_PRORES =
  'VideoConvertor:-c:v prores_ks -profile:v 3 -vendor apl0 -bits_per_mb 8000 -pix_fmt yuv422p10le -c:a pcm_s16le';
const PPA_MP3 = 'ExtractAudio:-b:a 256k';
const PPA_WAV = 'ExtractAudio:-c:a pcm_s16le';

function appendVideoPostprocessorArgs(args, videoConvertorPpa) {
  args.push('--postprocessor-args', videoConvertorPpa);
}

function normalizeFormatKey(format) {
  if (
    format === 'bestaudio' ||
    format === 'yt-wav' ||
    format === 'yt-prores' ||
    format === 'yt-4k-avc1' ||
    format === 'yt-1080-avc1'
  ) {
    return format;
  }
  return 'yt-1080-avc1';
}

function applyFormatArgs(args, format, { isTwitter = false } = {}) {
  switch (normalizeFormatKey(format)) {
    case 'bestaudio':
      args.push('-f', 'bestaudio/best');
      args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
      args.push('--postprocessor-args', PPA_MP3);
      break;
    case 'yt-wav':
      args.push('-f', 'bestaudio/best');
      args.push('-x', '--audio-format', 'wav');
      args.push('--postprocessor-args', PPA_WAV);
      break;
    case 'yt-prores':
      args.push('-f', FMT_PRORES);
      args.push('--merge-output-format', 'mov');
      appendVideoPostprocessorArgs(args, PPA_PRORES);
      break;
    case 'yt-4k-avc1':
      args.push('-f', FMT_4K);
      args.push('-S', 'res:2160,fps');
      args.push('--merge-output-format', 'mp4');
      appendVideoPostprocessorArgs(args, PPA_4K);
      break;
    case 'yt-1080-avc1':
    default:
      args.push('-f', isTwitter ? TW_NLE_FORMAT : FMT_1080);
      if (!isTwitter) args.push('-S', 'res:1080,fps');
      args.push('--merge-output-format', 'mp4');
      appendVideoPostprocessorArgs(args, PPA_1080);
      break;
  }
}

function resolveDenoPath() {
  const localDeno = binariesManager.getDenoPath();
  if (localDeno && fs.existsSync(localDeno)) return localDeno;

  const denoName = process.platform === 'win32' ? 'deno.exe' : 'deno';
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    const candidate = path.join(dir, denoName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function buildYtDlpArgs(ffmpegPath, outputTemplate, {
  youtube = false,
  twitter = false
} = {}) {
  const args = [
    '--ffmpeg-location', ffmpegPath
  ];

  if (youtube) {
    const denoPath = resolveDenoPath();
    if (denoPath) {
      args.push('--js-runtimes', `deno:${denoPath}`);
    }
    args.push('--remote-components', 'ejs:github');
  }

  args.push(
    '--force-ipv4',
    '--no-check-certificates',
    '--rm-cache-dir',
    '--no-cache-dir',
    '--windows-filenames',
    '--continue',
    '--retries', '10',
    '--fragment-retries', '10',
    '--encoding', 'utf-8',
    '--extractor-args', 'youtube:player_client=web_creator,web_embedded,android_vr',
    '-o', outputTemplate
  );

  if (twitter) {
    args.push('--extractor-args', 'twitter:api=syndication');
  }

  return args;
}

function extractErrorMessage(log) {
  const errors = log.split('\n').filter((line) => /^\s*ERROR:/i.test(line));
  if (errors.length) {
    return errors
      .map((line) => line.replace(/^\s*ERROR:\s*/i, '').replace(/\[info\]\s*/gi, '').trim())
      .filter(Boolean)
      .join(' ');
  }
  return log
    .trim()
    .split('\n')
    .map((line) => line.replace(/\[info\]\s*/gi, '').trim())
    .filter((line) => line && !/^\[(debug|youtube|twitter|x|generic)\]/i.test(line))
    .slice(-3)
    .join(' ');
}

function isYoutubeForbidden(log) {
  return /unable to download video data:\s*HTTP Error 403|HTTP Error 403:\s*Forbidden|ERROR:.*\b403\b/i.test(log);
}

function cleanLogLine(line) {
  return String(line || '')
    .replace(/^\s*ERROR:\s*/i, '')
    .replace(/\[info\]\s*/gi, '')
    .trim();
}

function shouldSendLogLine(line) {
  if (!line) return false;
  if (isYoutubeForbidden(line)) return false;
  if (/^\[(info|debug)\]/i.test(line)) return false;
  if (/^\[(youtube|twitter|x|generic)\]/i.test(line) && !/^ERROR:/i.test(line)) return false;
  if (/Deleting original file/i.test(line)) return false;
  if (/^ERROR:/i.test(line)) return true;
  if (/^WARNING:/i.test(line) && /unable|nsig|signature/i.test(line)) return true;
  if (/\[download\]\s+Destination:/.test(line)) return true;
  if (/\[Merger\]/.test(line) || /\[ExtractAudio\]/.test(line)) return true;
  if (/\[ffmpeg\] Destination:/.test(line)) return true;
  return false;
}

function userFacingError(log) {
  if (isYoutubeForbidden(log)) {
    return 'YouTube video akışı reddedildi (403). Bağlantıyı tekrar dene; motor güncel değilse arka planda yenilenir.';
  }
  return extractErrorMessage(log);
}

function extractSavedLabel(log) {
  const merger = log.match(/\[Merger\] Merging formats into "(.+?)"/);
  if (merger) return path.basename(merger[1]);
  const destLines = [...log.matchAll(/\[download\] Destination:\s*(.+)/g)];
  if (destLines.length) return path.basename(destLines[destLines.length - 1][1].trim());
  return null;
}

function buildDownloadCommand(url, format) {
  const downloadsDir = path.join(os.homedir(), 'Downloads', 'MediaPullDownloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const outputTemplate = path.join(downloadsDir, '%(title)s.%(ext)s');
  const ytDlpPath = binariesManager.getYtDlpPath();
  const ffmpegPath = binariesManager.getFfmpegPath();
  const urlTrimmed = url.trim();
  const isTwitter = isTwitterOrXUrl(urlTrimmed);
  const isYoutube = !isTwitter;
  const args = buildYtDlpArgs(ffmpegPath, outputTemplate, {
    youtube: isYoutube,
    twitter: isTwitter
  });

  applyFormatArgs(args, format, { isTwitter });
  args.push(urlTrimmed);

  return { ytDlpPath, args };
}

const RE_PROGRESS = /(\d{1,3}\.\d+)%\s+of\s+~?\s*([\d.]+\s*\S+)\s+at\s+([\d.]+\s*\S+)(?:\s+ETA\s+(\d{2}:\d{2}))?/;
const RE_PROGRESS_DONE = /100%\s+of\s+~?\s*([\d.]+\s*\S+)/;

function spawnDownload(sender, url, format, { retriedAfterUpdate = false } = {}) {
  const { ytDlpPath, args } = buildDownloadCommand(url, format);
  console.log('YT-DLP:', ytDlpPath, args.join(' '));

  const proc = spawn(ytDlpPath, args, {
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  });

  const session = {
    proc,
    sender,
    url,
    format,
    paused: false,
    pausing: false,
    cancelled: false,
    retriedAfterUpdate,
    logAcc: '',
    lastLogLine: '',
    lastPercent: -1,
    streamIndex: 0
  };
  activeDownload = session;

  function parseAndSend(chunk) {
    session.logAcc += chunk;
    const lines = chunk.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const m = trimmed.match(RE_PROGRESS);
      if (m) {
        const pct = parseFloat(m[1]);
        if (pct < session.lastPercent - 2) {
          session.streamIndex++;
          sender.send('download-stream', session.streamIndex);
        }
        session.lastPercent = pct;
        sender.send('download-progress', {
          percent: pct,
          size: m[2].trim(),
          speed: m[3].trim(),
          eta: m[4] ? m[4].trim() : null,
          stream: session.streamIndex
        });
        continue;
      }
      if (RE_PROGRESS_DONE.test(trimmed)) {
        session.lastPercent = 100;
        sender.send('download-progress', { percent: 100, size: null, speed: null, eta: null, stream: session.streamIndex });
        continue;
      }
      if (/\[Merger\]/.test(trimmed)) {
        sender.send('download-phase', 'merging');
      } else if (/\[ffmpeg\]/.test(trimmed)) {
        sender.send('download-phase', 'converting');
      } else if (/\[download\]\s+Destination:/.test(trimmed)) {
        sender.send('download-phase', 'downloading');
      } else if (/\[youtube\]|\[twitter\]|\[x\]|\[info\]|\[generic\]/i.test(trimmed)) {
        sender.send('download-phase', 'analyzing');
      }

      if (
        !RE_PROGRESS.test(trimmed) &&
        !RE_PROGRESS_DONE.test(trimmed) &&
        trimmed !== session.lastLogLine &&
        shouldSendLogLine(trimmed)
      ) {
        const display = cleanLogLine(trimmed);
        if (!display) continue;
        session.lastLogLine = trimmed;
        sender.send('download-log', display);
      }
    }
  }

  sender.send('download-phase', 'analyzing');

  proc.stdout.on('data', (data) => { parseAndSend(data.toString('utf-8')); });

  proc.stderr.on('data', (data) => {
    const text = data.toString('utf-8');
    console.error('yt-dlp stderr:', text);
    parseAndSend(text);
  });

  proc.on('error', (err) => {
    if (activeDownload !== session) return;
    if (session.pausing || session.cancelled) return;
    activeDownload = null;
    sender.send('download-error', err.message);
  });

  proc.on('close', (code) => {
    if (activeDownload !== session) return;

    if (session.pausing) {
      session.pausing = false;
      session.paused = true;
      session.proc = null;
      sender.send('download-paused');
      return;
    }

    if (session.cancelled) {
      activeDownload = null;
      cleanupPartFiles(session.logAcc);
      sender.send('download-cancelled');
      return;
    }

    if (code === 0) {
      activeDownload = null;
      const label = extractSavedLabel(session.logAcc) || 'Dosya';
      sender.send('download-complete', label);
    } else if (
      isYoutubeForbidden(session.logAcc) &&
      !session.retriedAfterUpdate
    ) {
      session.proc = null;
      sender.send('download-log', 'YouTube kısıtlaması algılandı. İndirme motoru güncellenip yeniden denenecek.');
      sender.send('download-phase', 'analyzing');
      binariesManager.selfUpdateYtDlp({ forceDownload: true })
        .catch(() => false)
        .then(() => {
          if (session.cancelled) {
            if (activeDownload === session) activeDownload = null;
            cleanupPartFiles(session.logAcc);
            sender.send('download-cancelled');
            return;
          }
          if (activeDownload !== session) return;
          spawnDownload(sender, url, format, { retriedAfterUpdate: true });
        });
    } else {
      activeDownload = null;
      sender.send('download-error', userFacingError(session.logAcc) || `yt-dlp çıkış kodu: ${code}`);
    }
  });

  return session;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: APP_SIZE.width,
    height: APP_SIZE.height,
    minWidth: APP_SIZE.minWidth,
    minHeight: APP_SIZE.minHeight,
    frame: false,
    backgroundColor: '#0c0c0e',
    autoHideMenuBar: true,
    icon: APP_ICON || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'index.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized', false);
  });

  mainWindow.loadFile('index.html');
}

function createLoadingWindow() {
  const loadingWin = new BrowserWindow({
    width: 400,
    height: 250,
    frame: false,
    transparent: true,
    icon: APP_ICON || undefined,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  loadingWin.loadFile('loading.html');
  return loadingWin;
}

async function checkAndDownloadBinaries() {
  const status = await binariesManager.ensureBinariesExist();
  const updateInfo = status.needsDownload
    ? null
    : await binariesManager.checkYtDlpUpdateAvailable();

  const needsUpdate = updateInfo?.needsUpdate;
  if (!status.needsDownload && !needsUpdate) return;

  const loadingWin = createLoadingWindow();

  try {
    if (!status.ytdlpExists) {
      loadingWin.webContents.send('download-status', 'yt-dlp indiriliyor...');
      const ok = await binariesManager.downloadYtDlp((progress) => {
        loadingWin.webContents.send('download-progress', { tool: 'yt-dlp', progress });
      });
      if (!ok) throw new Error('yt-dlp indirilemedi');
    }

    if (!status.ffmpegExists) {
      loadingWin.webContents.send('download-status', 'FFmpeg indiriliyor...');
      const ok = await binariesManager.downloadFfmpeg((progress) => {
        loadingWin.webContents.send('download-progress', { tool: 'ffmpeg', progress });
      });
      if (!ok) throw new Error('FFmpeg indirilemedi');
    }

    if (needsUpdate) {
      loadingWin.webContents.send(
        'download-status',
        `yt-dlp guncelleniyor (${updateInfo.local} -> ${updateInfo.remote})...`
      );
      const ok = await binariesManager.downloadYtDlp((progress) => {
        loadingWin.webContents.send('download-progress', { tool: 'yt-dlp', progress });
      });
      if (!ok) {
        console.warn('yt-dlp guncellemesi basarisiz, mevcut surumle devam ediliyor.');
        loadingWin.webContents.send('download-status', 'Guncelleme basarisiz, mevcut surum kullaniliyor...');
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    const verified = await binariesManager.verifyBinaries();
    if (!verified) throw new Error('Binary dogrulama basarisiz');

    loadingWin.webContents.send('download-status', 'Hazir.');
    setTimeout(() => loadingWin.close(), 1000);
  } catch (error) {
    loadingWin.close();
    dialog.showErrorBox('Hata', 'Gerekli araclar hazirlanamadi: ' + error.message);
    app.quit();
  }
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.mediapull.app');
  }
  if (APP_ICON && process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(APP_ICON);
  }
  loadLicenseState();
  await checkAndDownloadBinaries();
  createWindow();
  binariesManager.selfUpdateYtDlp().catch((err) => {
    console.warn('yt-dlp arka plan guncellemesi:', err.message);
  });
  binariesManager.ensureDeno().catch((err) => {
    console.warn('Deno arka plan indirmesi:', err.message);
  });

  ipcMain.handle('license:check', () => getLicenseSnapshot());

  ipcMain.handle('license:activate', async (_event, key) => {
    const licenseKey = String(key || '').trim();
    if (!licenseKey) {
      return { ok: false, error: 'Lisans anahtarı gir.' };
    }
    try {
      const token = await activateLicenseOnServer(licenseKey);
      licenseToken = token;
      isProUser = true;
      licenseMasked = maskLicenseKey(licenseKey);
      saveLicenseState();
      mainWindow?.webContents.send('license:updated', getLicenseSnapshot());
      return { ok: true, ...getLicenseSnapshot() };
    } catch (err) {
      return { ok: false, error: err.message || 'Lisans sunucusuna ulaşılamadı.' };
    }
  });

  ipcMain.handle('license:logout', async () => {
    try {
      await deactivateLicenseOnServer();
    } catch (err) {
      clearLocalLicense();
      mainWindow?.webContents.send('license:updated', getLicenseSnapshot());
      return {
        ok: true,
        warning: err.message || 'Sunucu çıkışı tamamlanamadı; bu cihazdan Pro kaldırıldı.',
        ...getLicenseSnapshot()
      };
    }
    clearLocalLicense();
    mainWindow?.webContents.send('license:updated', getLicenseSnapshot());
    return { ok: true, ...getLicenseSnapshot() };
  });

  ipcMain.on('pause-ytdlp', () => {
    if (!activeDownload?.proc || activeDownload.paused || activeDownload.pausing) return;
    activeDownload.pausing = true;
    killProcessTree(activeDownload.proc);
  });

  ipcMain.on('resume-ytdlp', () => {
    if (!activeDownload?.paused) return;
    const { sender, url, format } = activeDownload;
    activeDownload.paused = false;
    sender.send('download-resumed');
    spawnDownload(sender, url, format);
  });

  ipcMain.on('stop-ytdlp', () => {
    if (!activeDownload) return;
    const { sender, logAcc, proc } = activeDownload;
    activeDownload.cancelled = true;
    if (proc) {
      killProcessTree(proc);
      return;
    }
    cleanupPartFiles(logAcc);
    activeDownload = null;
    sender.send('download-cancelled');
  });

  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });

  ipcMain.on('window-close', () => {
    mainWindow?.close();
  });

  ipcMain.on('start-ytdlp', (event, url, format) => {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      event.sender.send('download-error', 'Geçerli bir video bağlantısı girilmedi.');
      return;
    }

    if (PRO_FORMATS.has(format) && !isProUser) {
      event.sender.send('download-error', 'Bu format Pro plana özel. Lütfen lisansını etkinleştir.');
      event.sender.send('license:required');
      return;
    }

    if (activeDownload) {
      activeDownload.cancelled = true;
      if (activeDownload.proc) killProcessTree(activeDownload.proc);
    }
    activeDownload = null;

    spawnDownload(event.sender, url, format);
  });
});