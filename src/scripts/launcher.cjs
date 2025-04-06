const { app } = require('electron');
const { Client  } = require('minecraft-launcher-core');
const path = require('path');
const fs = require('fs');

const launcher = new Client();
const configPath = path.join(app.getPath('userData'), 'profile.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const opts = {
  authorization: {
    access_token: config.authorization.accessToken,
    client_token: config.authorization.clientToken,
    uuid: config.authorization.user.id,
    name: config.authorization.user.username,
    meta: {
      type: 'msa',
    },
  },
  root: path.join(__dirname, '../../minecraft'),
  version: {
    number: "1.16.5",
    type: 'release',
  },
  forge: path.join(__dirname, '../../minecraft/forge-1.16.5-36.2.34-installer.jar'),
  javaPath: path.join(__dirname, '../../jre-legacy/bin/java.exe'),
  customArgs: [
    `-javaagent:${path.join(__dirname, '../../minecraft/authlib-injector-1.2.5.jar')}=ely.by`,
    ...config.jvmArgs
  ],
};

launcher.launch(opts);

launcher.on('debug', (e) => console.log('[DEBUG]', e));
launcher.on('data', (e) => console.log('[DATA]', e));
launcher.on('close', () => console.log('[INFO] Jogo finalizado.'));
