import { Client } from 'minecraft-launcher-core';
import path from 'path';
import { app } from 'electron';
import { configManager } from './config-manager.js';
import { BrowserWindow } from 'electron';

const BASE_PATH = path.join(app.getPath('userData'), 'resources');
const MINECRAFT_PATH = path.join(BASE_PATH, 'minecraft');
const JRE_PATH = path.join(BASE_PATH, 'jre-legacy', 'bin', 'java.exe');

const launcher = new Client();

export const launchGame = async () => {
  try {
    const config = configManager.getConfig();
    const { authorization } = configManager.getProfile();
    
    if (!authorization?.accessToken) {
      throw new Error('Usuário não autenticado');
    }

    const opts = {
      authorization: {
        access_token: authorization.accessToken,
        client_token: authorization.clientToken,
        uuid: authorization.user.id,
        name: authorization.user.username,
        meta: {
          type: 'msa',
        },
      },
      root: MINECRAFT_PATH,
      version: {
        number: "1.16.5",
        type: 'release',
      },
      forge: path.join(MINECRAFT_PATH, 'forge-1.16.5-36.2.34-installer.jar'),
      javaPath: JRE_PATH,
      customArgs: [
        `-javaagent:${path.join(MINECRAFT_PATH, 'authlib-injector-1.2.5.jar')}=ely.by`,
        ...config.jvmArgs
      ],
    };

    launcher.on('debug', (e) => console.log('[DEBUG]', e));
    launcher.on('data', (e) => console.log('[DATA]', e));
    launcher.on('close', () => {
      console.log('[INFO] Jogo finalizado.');
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('game-exit');
      });
    });

    await launcher.launch(opts);
    return launcher;
  } catch (error) {
    console.error('Erro ao iniciar o jogo:', error);
    throw error;
  }
}; 