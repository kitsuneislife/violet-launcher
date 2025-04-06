const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('api', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),

  loadIndex: () => ipcRenderer.send('load-index'),
  loadSettings: () => ipcRenderer.send('load-settings'),
  loadMods: () => ipcRenderer.send('load-mods'),

  launchGame: () => ipcRenderer.send('launch-minecraft'),
  onGameExit: (callback) => ipcRenderer.on('game-exit', callback),

  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (data) => ipcRenderer.send('save-settings', data),

  getMods: () => ipcRenderer.invoke('get-mods'),

  loginEly: (username, password) => ipcRenderer.invoke('login-ely', username, password),
  signOut: () => ipcRenderer.send('sign-out'),

  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url)
});
