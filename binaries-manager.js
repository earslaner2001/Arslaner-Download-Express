const fs = require('fs');
const path = require('path');
const https = require('https');
const { app } = require('electron');
const { exec, execFile } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const H264_ENCODER_LABELS = {
  nvenc: 'NVIDIA NVENC',
  amf: 'AMD AMF',
  qsv: 'Intel Quick Sync',
  libx264: 'CPU (libx264 veryfast)'
};
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

class BinariesManager {
  constructor() {
    this.binariesDir = app.isPackaged
      ? path.join(app.getPath('userData'), 'binaries')
      : path.join(__dirname, 'binaries');

    this.updateStatePath = path.join(app.getPath('userData'), 'ytdlp-update.json');
    this.ytdlpPath = path.join(this.binariesDir, 'yt-dlp.exe');
    this.ffmpegPath = path.join(this.binariesDir, 'ffmpeg.exe');
    this.denoPath = path.join(this.binariesDir, 'deno.exe');
    this._selfUpdatePromise = null;
    this._h264EncoderPromise = null;

    this.YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
    this.FFMPEG_URL = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
    this.YTDLP_RELEASE_API = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest';
    this.DENO_URL = 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip';

    this.migrateBinariesIfNeeded();
  }

  migrateBinariesIfNeeded() {
    if (!app.isPackaged) return;

    const legacyDirs = [
      path.join(process.resourcesPath, 'binaries')
    ];

    if (!fs.existsSync(this.binariesDir)) {
      fs.mkdirSync(this.binariesDir, { recursive: true });
    }

    for (const legacyDir of legacyDirs) {
      if (!fs.existsSync(legacyDir) || legacyDir === this.binariesDir) continue;
      for (const name of ['yt-dlp.exe', 'ffmpeg.exe']) {
        const from = path.join(legacyDir, name);
        const to = path.join(this.binariesDir, name);
        if (fs.existsSync(from) && !fs.existsSync(to)) {
          try { fs.copyFileSync(from, to); } catch { /* ignore */ }
        }
      }
    }
  }

  readUpdateState() {
    try {
      return JSON.parse(fs.readFileSync(this.updateStatePath, 'utf8'));
    } catch {
      return {};
    }
  }

  writeUpdateState(state) {
    fs.mkdirSync(path.dirname(this.updateStatePath), { recursive: true });
    fs.writeFileSync(this.updateStatePath, JSON.stringify(state, null, 2), 'utf8');
  }

  normalizeVersion(version) {
    return String(version || '').trim().replace(/^v/i, '');
  }

  isNewerVersion(remote, local) {
    const r = this.normalizeVersion(remote).split('.').map((n) => parseInt(n, 10) || 0);
    const l = this.normalizeVersion(local).split('.').map((n) => parseInt(n, 10) || 0);
    const len = Math.max(r.length, l.length);
    for (let i = 0; i < len; i++) {
      const rv = r[i] || 0;
      const lv = l[i] || 0;
      if (rv > lv) return true;
      if (rv < lv) return false;
    }
    return false;
  }

  fetchJson(url) {
    return new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'MediaPull' } }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          return this.fetchJson(response.headers.location).then(resolve).catch(reject);
        }
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try { resolve(JSON.parse(data)); } catch (err) { reject(err); }
        });
      }).on('error', reject);
    });
  }

  async getLocalYtDlpVersion() {
    const { stdout } = await execAsync(`"${this.ytdlpPath}" --version`);
    return this.normalizeVersion(stdout.split('\n')[0]);
  }

  async getRemoteYtDlpVersion() {
    const release = await this.fetchJson(this.YTDLP_RELEASE_API);
    return this.normalizeVersion(release.tag_name);
  }

  async ensureBinariesExist() {
    if (!fs.existsSync(this.binariesDir)) {
      fs.mkdirSync(this.binariesDir, { recursive: true });
    }

    const ytdlpExists = fs.existsSync(this.ytdlpPath);
    const ffmpegExists = fs.existsSync(this.ffmpegPath);

    return {
      needsDownload: !ytdlpExists || !ffmpegExists,
      ytdlpExists,
      ffmpegExists
    };
  }

  async checkYtDlpUpdateAvailable(force = false) {
    if (!fs.existsSync(this.ytdlpPath)) {
      return { needsUpdate: false, reason: 'missing' };
    }

    const state = this.readUpdateState();
    const now = Date.now();
    if (!force && state.lastCheck && (now - state.lastCheck) < UPDATE_CHECK_INTERVAL_MS) {
      return { needsUpdate: false, reason: 'recently-checked', local: state.localVersion, remote: state.remoteVersion };
    }

    try {
      const [local, remote] = await Promise.all([
        this.getLocalYtDlpVersion(),
        this.getRemoteYtDlpVersion()
      ]);

      const needsUpdate = this.isNewerVersion(remote, local);
      this.writeUpdateState({
        lastCheck: now,
        localVersion: local,
        remoteVersion: remote,
        needsUpdate
      });

      return { needsUpdate, local, remote, reason: needsUpdate ? 'outdated' : 'up-to-date' };
    } catch (error) {
      console.error('yt-dlp guncelleme kontrolu basarisiz:', error.message);
      this.writeUpdateState({ ...state, lastCheck: now });
      return { needsUpdate: false, reason: 'check-failed', error: error.message };
    }
  }

  async downloadFile(url, outputPath, onProgress) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);

      https.get(url, { headers: { 'User-Agent': 'MediaPull' } }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          file.close();
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          return this.downloadFile(response.headers.location, outputPath, onProgress)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (onProgress && totalSize) {
            onProgress(Math.floor((downloadedSize / totalSize) * 100));
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        reject(err);
      });
    });
  }

  async downloadYtDlp(onProgress) {
    const tmpPath = `${this.ytdlpPath}.download`;
    try {
      await this.downloadFile(this.YTDLP_URL, tmpPath, onProgress);
      if (fs.existsSync(this.ytdlpPath)) fs.unlinkSync(this.ytdlpPath);
      fs.renameSync(tmpPath, this.ytdlpPath);

      const local = await this.getLocalYtDlpVersion();
      const state = this.readUpdateState();
      this.writeUpdateState({
        ...state,
        lastCheck: Date.now(),
        localVersion: local,
        remoteVersion: local,
        needsUpdate: false,
        lastUpdated: Date.now()
      });

      return true;
    } catch (error) {
      console.error('yt-dlp indirme hatasi:', error);
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      return false;
    }
  }

  async downloadFfmpeg(onProgress) {
    try {
      const zipPath = path.join(this.binariesDir, 'ffmpeg.zip');
      await this.downloadFile(this.FFMPEG_URL, zipPath, onProgress);

      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipPath);

      for (const entry of zip.getEntries()) {
        if (entry.entryName.endsWith('bin/ffmpeg.exe')) {
          zip.extractEntryTo(entry, this.binariesDir, false, true);
          const extracted = path.join(this.binariesDir, 'ffmpeg.exe');
          if (extracted !== this.ffmpegPath && fs.existsSync(extracted)) {
            fs.renameSync(extracted, this.ffmpegPath);
          }
          break;
        }
      }

      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      return true;
    } catch (error) {
      console.error('FFmpeg indirme hatasi:', error);
      return false;
    }
  }

  async runYtDlpUpgrade() {
    if (!fs.existsSync(this.ytdlpPath)) return false;
    try {
      await execAsync(`"${this.ytdlpPath}" -U`, {
        timeout: 120000,
        windowsHide: true
      });
      return true;
    } catch (err) {
      console.warn('yt-dlp -U basarisiz:', err.message);
      return false;
    }
  }

  async selfUpdateYtDlp({ forceDownload = false } = {}) {
    if (this._selfUpdatePromise) return this._selfUpdatePromise;
    this._selfUpdatePromise = (async () => {
      const upgraded = await this.runYtDlpUpgrade();
      if (upgraded) return true;
      if (forceDownload) return this.downloadYtDlp();
      return false;
    })().finally(() => {
      this._selfUpdatePromise = null;
    });
    return this._selfUpdatePromise;
  }

  async downloadDeno(onProgress) {
    try {
      const zipPath = path.join(this.binariesDir, 'deno.zip');
      await this.downloadFile(this.DENO_URL, zipPath, onProgress);
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipPath);
      for (const entry of zip.getEntries()) {
        if (entry.entryName === 'deno.exe' || entry.entryName.endsWith('/deno.exe')) {
          zip.extractEntryTo(entry, this.binariesDir, false, true);
          break;
        }
      }
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      return fs.existsSync(this.denoPath);
    } catch (error) {
      console.warn('Deno indirme hatasi:', error.message);
      return false;
    }
  }

  async ensureDeno() {
    if (fs.existsSync(this.denoPath)) return true;
    return this.downloadDeno();
  }

  getDenoPath() {
    return this.denoPath;
  }

  getYtDlpPath() {
    return this.ytdlpPath;
  }

  getFfmpegPath() {
    return this.ffmpegPath;
  }

  async testFfmpegEncoder(encoderArgs) {
    try {
      await execFileAsync(this.ffmpegPath, [
        '-hide_banner',
        '-loglevel', 'error',
        '-f', 'lavfi',
        '-i', 'color=c=black:s=256x256:d=0.2',
        '-pix_fmt', 'yuv420p',
        ...encoderArgs,
        '-frames:v', '2',
        '-f', 'null',
        '-'
      ], { timeout: 15000, windowsHide: true });
      return true;
    } catch {
      return false;
    }
  }

  async _detectH264Encoder() {
    const candidates = [
      {
        id: 'nvenc',
        nvencFamily: 'p',
        args: ['-c:v', 'h264_nvenc', '-preset', 'p4', '-tune', 'hq', '-rc', 'vbr', '-cq', '19', '-b:v', '0']
      },
      {
        id: 'nvenc',
        nvencFamily: 'legacy',
        args: ['-c:v', 'h264_nvenc', '-preset', 'fast', '-rc', 'vbr', '-cq', '19', '-b:v', '0']
      },
      {
        id: 'amf',
        args: ['-c:v', 'h264_amf', '-quality', 'speed', '-rc', 'cqp', '-qp_i', '18', '-qp_p', '20']
      },
      {
        id: 'qsv',
        args: ['-c:v', 'h264_qsv', '-preset', 'veryfast', '-global_quality', '21']
      }
    ];

    for (const candidate of candidates) {
      if (await this.testFfmpegEncoder(candidate.args)) {
        const encoder = {
          id: candidate.id,
          nvencFamily: candidate.nvencFamily || null,
          label: H264_ENCODER_LABELS[candidate.id]
        };
        console.log('H.264 encoder:', encoder.label);
        return encoder;
      }
    }

    const fallback = { id: 'libx264', nvencFamily: null, label: H264_ENCODER_LABELS.libx264 };
    console.log('H.264 encoder:', fallback.label);
    return fallback;
  }

  detectH264Encoder() {
    if (!this._h264EncoderPromise) {
      this._h264EncoderPromise = this._detectH264Encoder().catch((err) => {
        console.warn('H.264 encoder tespiti basarisiz:', err.message);
        return { id: 'libx264', nvencFamily: null, label: H264_ENCODER_LABELS.libx264 };
      });
    }
    return this._h264EncoderPromise;
  }

  async verifyBinaries() {
    try {
      await execAsync(`"${this.ytdlpPath}" --version`);
      await execAsync(`"${this.ffmpegPath}" -version`);
      return true;
    } catch (error) {
      console.error('Binary dogrulama hatasi:', error);
      return false;
    }
  }
}

module.exports = BinariesManager;
