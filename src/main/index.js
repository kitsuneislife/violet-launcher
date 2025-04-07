import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { fork } from 'child_process';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import axios from 'axios';
import ejse from 'ejs-electron';
//import isDev from 'electron-is-dev';
//import autoUpdater from 'electron-updater';
import { downloadResources, checkResources } from './services/resource-manager.js';
import { configManager } from './services/config-manager.js';
import { launchGame } from './services/launcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RENDERER_PATH = path.join(__dirname, '..', 'renderer');
const MODS_PATH = path.join(app.getPath('userData'), 'resources', 'minecraft', 'mods');

let win = null;

async function loadLoadingScreen() {
    if (win) {
        await win.loadFile(path.join(RENDERER_PATH, 'loading.ejs'));
    }
}

async function checkAndDownloadResources() {
    try {
        const resourcesExist = await checkResources();
        if (!resourcesExist) {
            await loadLoadingScreen();
            await downloadResources((data) => {
                win.webContents.send('download-progress', data);
            });
        }
        return true;
    } catch (error) {
        win.webContents.send('download-error', error.message);
        return false;
    }
}

async function loadMainInterface() {
    try {
        const { authorization } = configManager.getProfile();
        const { accessToken, clientToken } = authorization ?? {};

        if (accessToken && clientToken) {
            const { status } = await axios.post('https://authserver.ely.by/auth/validate', { accessToken });
            
            if (status === 200) {
                const refreshRes = await axios.post('https://authserver.ely.by/auth/refresh', { accessToken, clientToken });
                
                if (refreshRes.data.accessToken !== accessToken) {
                    configManager.updateAuthorization({
                        ...authorization,
                        accessToken: refreshRes.data.accessToken
                    });
                }

                ejse.data('username', authorization.user.username);
                return win.loadFile(path.join(RENDERER_PATH, 'index.ejs'));
            }
        }
    } catch (err) {
        console.error('Erro ao validar credenciais:', err.message);
    }
    
    return win.loadFile(path.join(RENDERER_PATH, 'login.ejs'));
}

async function createWindow() {
    win = new BrowserWindow({
        width: 1280 * 0.8,
        height: 720 * 0.8,
        frame: false,
        resizable: false,
        autoHideMenuBar: true,
        transparent: true,
        icon: path.join(__dirname, '..', 'assets', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '..', 'renderer', 'preload.cjs')
        }
    });

    const resourcesExist = await checkResources();
    if (resourcesExist) {
        await loadMainInterface();
    } else {
        await loadLoadingScreen();
        await downloadResources((data) => {
            win.webContents.send('download-progress', data);
        });
        await loadMainInterface();
    }
}

ipcMain.on('retry-download', async () => {
    const success = await checkAndDownloadResources();
    if (success) {
        await loadMainInterface();
    }
});

app.whenReady().then(() => {
    createWindow();
    //setupUpdater();
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

ipcMain.on('launch-minecraft', async (event) => {
    if (gameProcess) return console.log('O jogo já está em execução.');

    try {
        gameProcess = await launchGame();
        console.log('Jogo iniciado.');
    } catch (error) {
        console.error('Erro ao iniciar o jogo:', error);
        event.sender.send('game-error', error.message);
    }
});

ipcMain.handle('open-external-link', async (event, url) => {
    await shell.openExternal(url);
});

ipcMain.on('load-index', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
        try {
            const { authorization } = configManager.getProfile();
            const username = authorization?.user?.username || 'Desconhecido';
            ejse.data('username', username);
        } catch (err) {
            console.error('Erro ao carregar o index:', err);
            ejse.data('username', 'Erro');
        }
        win.loadFile(path.join(RENDERER_PATH, 'index.ejs'));
    }
});

ipcMain.on('load-settings', () => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.loadFile(path.join(RENDERER_PATH, 'settings.ejs'));
});

ipcMain.on('load-mods', () => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.loadFile(path.join(RENDERER_PATH, 'mods.ejs'));
});

ipcMain.handle('get-settings', async () => {
    try {
        const totalMemGB = os.totalmem() / (1024 ** 3);
        const maxMemory = Math.floor(totalMemGB * 0.6);
        const config = configManager.getConfig();
        const memory = parseInt((config.jvmArgs.find(arg => arg.startsWith('-Xmx')) || '-Xmx4G').replace('-Xmx', '').replace('G', ''));
        return { memory, launcherPath: path.dirname(__dirname), maxMemory: Math.max(3, maxMemory) };
    } catch (e) {
        console.error(e);
        return { memory: 4, launcherPath: path.dirname(__dirname), maxMemory: 4 };
    }
});

ipcMain.on('save-settings', (event, data) => {
    configManager.updateJvmArgs(data.jvmArgs);
});

ipcMain.handle('get-mods', async () => {
    try {
        const mods = fs.readdirSync(MODS_PATH)
            .filter(file => file.endsWith('.jar'));
        return mods;
    } catch (err) {
        console.error('Erro ao obter mods:', err);
        return [];
    }
});

ipcMain.handle('login-ely', async (event, username, password) => {
    const {loginEly} = await import('./services/auth.js');
    try {
        const authData = await loginEly(username, password);
        configManager.updateAuthorization(authData);
        return { success: true, data: authData };
    } catch (err) {
        return { success: false, message: err.message };
    }
});

ipcMain.on('sign-out', () => {
    configManager.clearAuthorization();
});

// const setupUpdater = () => {
//   if (isDev) return;

//   autoUpdater.checkForUpdates();

//   autoUpdater
//     .on('update-available', () => console.log('Atualização disponível.'))
//     .on('update-downloaded', () => {
//       console.log('Atualização baixada. Aplicando...');
//       autoUpdater.quitAndInstall();
//     })
//     .on('error', (err) => console.error('Erro ao verificar/baixar atualização:', err));
// }; 