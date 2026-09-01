const { ipcRenderer, shell, clipboard } = require('electron');

function on(channel, handler) {
  const wrapped = (_event, ...args) => handler(...args);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

const mediaPullAPI = {
  licenseCheck: () => ipcRenderer.invoke('license:check'),
  licenseActivate: (key) => ipcRenderer.invoke('license:activate', key),
  licenseLogout: () => ipcRenderer.invoke('license:logout'),
  onLicenseUpdated: (handler) => on('license:updated', handler),
  onLicenseRequired: (handler) => on('license:required', handler),

  startDownload: (url, format) => ipcRenderer.send('start-ytdlp', url, format),
  pauseDownload: () => ipcRenderer.send('pause-ytdlp'),
  resumeDownload: () => ipcRenderer.send('resume-ytdlp'),
  stopDownload: () => ipcRenderer.send('stop-ytdlp'),
  onDownloadProgress: (handler) => on('download-progress', handler),
  onDownloadLog: (handler) => on('download-log', handler),
  onDownloadPhase: (handler) => on('download-phase', handler),
  onDownloadStream: (handler) => on('download-stream', handler),
  onDownloadPaused: (handler) => on('download-paused', handler),
  onDownloadResumed: (handler) => on('download-resumed', handler),
  onDownloadCancelled: (handler) => on('download-cancelled', handler),
  onDownloadComplete: (handler) => on('download-complete', handler),
  onDownloadError: (handler) => on('download-error', handler),

  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  onWindowMaximized: (handler) => on('window-maximized', handler),

  readClipboard: () => clipboard.readText(),
  notify: (payload) => ipcRenderer.send('app-notify', payload),
  openExternal: (url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      return shell.openExternal(url);
    }
    return Promise.resolve(false);
  }
};

try {
  const { contextBridge } = require('electron');
  contextBridge.exposeInMainWorld('mediaPullAPI', mediaPullAPI);
} catch {
  window.mediaPullAPI = mediaPullAPI;
}

window.mediaPullAPI = window.mediaPullAPI || mediaPullAPI;
