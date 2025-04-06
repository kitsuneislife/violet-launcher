import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { fork } from 'child_process';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import axios from 'axios';
import ejse from 'ejs-electron';
import isDev from 'electron-is-dev';
import autoUpdater from 'electron-updater';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const profilePath = path.join(app.getPath('userData'), 'profile.json');
const modsPath = path.join(__dirname, 'minecraft/mods');

const initializeProfile = () => {
  if (!fs.existsSync(profilePath)) {
    fs.writeFileSync(profilePath, JSON.stringify({
      jvmArgs: ["-Xmx4G", "-Xms3G"],
      authorization: {}
    }));
  }
};
initializeProfile();

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 1280 * 0.8,
    height: 720 * 0.8,
    resizable: false,
    autoHideMenuBar: true,
    frame: false,
    transparent: true,
    icon: path.join(__dirname, 'build/icon.ico'),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'src/scripts/preload.js'),
    },
  });

  try {
    const profileData = fs.existsSync(profilePath) ? JSON.parse(fs.readFileSync(profilePath, 'utf-8')) : {};
    const { accessToken, clientToken } = profileData.authorization ?? {};

    if (accessToken && clientToken) {
      const { status } = await axios.post('https://authserver.ely.by/auth/validate', { accessToken });
      
      if (status === 200) {
        const refreshRes = await axios.post('https://authserver.ely.by/auth/refresh', { accessToken, clientToken });
        
        if (refreshRes.data.accessToken !== accessToken) {
          profileData.authorization.accessToken = refreshRes.data.accessToken;
          fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2), 'utf-8');
        }

        ejse.data('username', profileData.authorization.user.username);
        return win.loadFile('src/index.ejs');
      }
    }
  } catch (err) {
    console.error('Erro ao validar credenciais:', err.message);
  }
  
  return win.loadFile('src/login.ejs');
};

const setupUpdater = () => {
  if (isDev) return;

  autoUpdater.checkForUpdates();

  autoUpdater
    .on('update-available', () => console.log('Atualização disponível.'))
    .on('update-downloaded', () => {
      console.log('Atualização baixada. Aplicando...');
      autoUpdater.quitAndInstall();
    })
    .on('error', (err) => console.error('Erro ao verificar/baixar atualização:', err));
};

app.whenReady().then(() => {
  createWindow();
  setupUpdater();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('window-minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.on('window-close', () => BrowserWindow.getFocusedWindow()?.close());

let gameProcess = null;

ipcMain.on('launch-minecraft', (event) => {
  if (gameProcess) return console.log('O jogo já está em execução.');

  const launcherPath = path.join(__dirname, 'src/scripts/launcher.cjs');
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
    try {
      const profile = fs.existsSync(profilePath) ? JSON.parse(fs.readFileSync(profilePath, 'utf-8')) : null;
      const username = profile?.authorization?.user?.username || 'Desconhecido';
      ejse.data('username', username);
    } catch (err) {
      console.error('Erro ao carregar o index:', err);
      ejse.data('username', 'Erro');
    }
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

ipcMain.handle('login-ely', async (event, username, password) => {
  const {loginEly} = await import('./src/scripts/auth.cjs');
  try {
    return { success: true, data: await loginEly(username, password) };
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
