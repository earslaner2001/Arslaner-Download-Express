const { ipcRenderer, shell } = require('electron');

const mediaPullAPI = {
  licenseCheck: () => ipcRenderer.invoke('license:check'),
  licenseActivate: (key) => ipcRenderer.invoke('license:activate', key),
  licenseLogout: () => ipcRenderer.invoke('license:logout'),
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
