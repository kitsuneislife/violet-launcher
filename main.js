const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { fork } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ejse = require('ejs-electron');
const { isDev } = require('electron-is-dev');
const { autoUpdater } = require('electron-updater');

const profilePath = path.join(__dirname, 'src/config/profile.json');
const modsPath = path.join(__dirname, 'minecraft/mods');

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280 * 0.8,
    height: 720 * 0.8,
    resizable: false,
    autoHideMenuBar: true,
    frame: false,
    transparent: true,
    icon: path.join(__dirname, 'src/assets/violet1x1.png'),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'src/scripts/preload.js'),
    },
  });

  try {
    const profileData = fs.existsSync(profilePath) ? JSON.parse(fs.readFileSync(profilePath, 'utf-8')) : {};
    const { authorization } = profileData;
    const { accessToken, clientToken } = authorization || {};

    if (accessToken && clientToken) {
      const res = await axios.post('https://authserver.ely.by/auth/validate', { accessToken });

      if (res.status === 200) {
        const refreshRes = await axios.post('https://authserver.ely.by/auth/refresh', { accessToken, clientToken });
        
        if (refreshRes.status === 200 && refreshRes.data.accessToken !== accessToken) {
          profileData.authorization.accessToken = refreshRes.data.accessToken;
          fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2), 'utf-8');
        }

        ejse.data('username', authorization.user.username);
        return win.loadFile('src/index.ejs');
      }
    }
    return win.loadFile('src/login.ejs');
  } catch (err) {
    console.error('Erro ao validar credenciais:', err.message);
    return win.loadFile('src/login.ejs');
  }
}

if (!isDev) {
  const server = 'https://update.electronjs.org';
  const feed = `${server}/kitsuneislife/violet-launcher/${process.platform}-${process.arch}/${app.getVersion()}`;

  autoUpdater.setFeedURL({ url: feed });

  autoUpdater.on('update-available', () => {
    console.log('Atualização disponível.');
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('Atualização baixada. Aplicando...');
    autoUpdater.quitAndInstall();
  });

  autoUpdater.on('error', (err) => {
    console.error('Erro ao verificar/baixar atualização:', err);
  });
}

app.whenReady().then(() => {
  createWindow();
  if (!require('electron-is-dev')) autoUpdater.checkForUpdates();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('window-minimize', () => {
  const win = BrowserWindow.getFocusedWindow();
  win?.minimize();
});

ipcMain.on('window-close', () => {
  const win = BrowserWindow.getFocusedWindow();
  win?.close();
});

let gameProcess = null;

ipcMain.on('launch-minecraft', (event) => {
  if (gameProcess) return console.log('O jogo já está em execução.');

  const launcherPath = path.join(__dirname, 'src/scripts/launcher.js');
  gameProcess = fork(launcherPath);

  gameProcess.on('exit', (code) => {
    console.log(`Jogo finalizado com código: ${code}`);
    gameProcess = null;
    event.sender.send('game-exit');
  });

  console.log('Jogo iniciado.');
});

ipcMain.handle('open-external-link', async (event, url) => {
  await shell.openExternal(url);
});

ipcMain.on('load-index', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    ejse.data('username', require(profilePath).authorization.user.username);
    win.loadFile('src/index.ejs');
  }
});

ipcMain.on('load-settings', () => {
  const win = BrowserWindow.getAllWindows()[0];
  win?.loadFile('src/settings.ejs');
});

ipcMain.on('load-mods', () => {
  const win = BrowserWindow.getAllWindows()[0];
  win?.loadFile('src/mods.ejs');
});

ipcMain.handle('get-settings', async () => {
  try {
    const totalMemGB = os.totalmem() / (1024 ** 3);
    const maxMemory = Math.floor(totalMemGB * 0.6);
    const data = fs.existsSync(profilePath)
      ? JSON.parse(fs.readFileSync(profilePath, 'utf-8'))
      : { jvmArgs: ["-Xmx4G", "-Xms3G"] };

    const memory = parseInt((data.jvmArgs.find(arg => arg.startsWith('-Xmx')) || '-Xmx4G').replace('-Xmx', '').replace('G', ''));
    return { memory, launcherPath: path.dirname(__dirname), maxMemory: Math.max(3, maxMemory) };
  } catch (e) {
    console.error(e);
    return { memory: 4, launcherPath: path.dirname(profilePath), maxMemory: 4 };
  }
});

ipcMain.on('save-settings', (event, data) => {
  const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
  profileData.jvmArgs = data.jvmArgs;
  fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2), 'utf-8');
});

ipcMain.handle('get-mods', async () => {
  try {
    const mods = fs.readdirSync(modsPath)
      .filter(file => file.endsWith('.jar'));
    return mods;
  } catch (err) {
    console.error('Erro ao obter mods:', err);
    return [];
  }
});

const { loginEly } = require('./src/scripts/auth');
ipcMain.handle('login-ely', async (event, username, password) => {
  try {
    const data = await loginEly(username, password);
    return { success: true, data };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.on('sign-out', () => {
  try {
    if (fs.existsSync(profilePath)) {
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
      delete profile.authorization;
      fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
    }
  } catch (err) {
    console.error('Erro ao fazer logout:', err);
  }
});
