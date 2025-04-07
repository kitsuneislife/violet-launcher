const { contextBridge, ipcRenderer } = require('electron');

// Expor APIs seguras para o renderer
contextBridge.exposeInMainWorld('api', {
  // Controles de janela
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  
  // Autenticação
  loginEly: (username, password) => ipcRenderer.invoke('login-ely', username, password),
  signOut: () => ipcRenderer.send('sign-out'),
  
  // Configurações
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (data) => ipcRenderer.send('save-settings', data),
  
  // Jogo
  launchGame: () => ipcRenderer.send('launch-minecraft'),
  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),
  
  // Navegação
  loadIndex: () => ipcRenderer.send('load-index'),
  loadSettings: () => ipcRenderer.send('load-settings'),
  loadMods: () => ipcRenderer.send('load-mods'),
  
  // Mods
  getMods: () => ipcRenderer.invoke('get-mods'),
  
  // Recursos
  retryDownload: () => ipcRenderer.send('retry-download'),
  
  // Atualizações
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (progressCallback) => ipcRenderer.invoke('download-update', progressCallback),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  
  // Eventos
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('download-progress');
  },
  onDownloadError: (callback) => {
    ipcRenderer.on('download-error', (_, error) => callback(error));
    return () => ipcRenderer.removeAllListeners('download-error');
  },
  onGameExit: (callback) => {
    ipcRenderer.on('game-exit', () => callback());
    return () => ipcRenderer.removeAllListeners('game-exit');
  },
  onGameError: (callback) => {
    ipcRenderer.on('game-error', (_, error) => callback(error));
    return () => ipcRenderer.removeAllListeners('game-error');
  },
  
  // Eventos de atualização
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-available');
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('update-not-available', () => callback());
    return () => ipcRenderer.removeAllListeners('update-not-available');
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-error');
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-progress');
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-downloaded');
  }
}); 