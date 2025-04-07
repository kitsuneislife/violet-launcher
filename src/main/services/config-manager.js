import fs from 'fs-extra';
import path from 'path';
import { app } from 'electron';

const USER_DATA_PATH = app.getPath('userData');
const CONFIG_PATH = path.join(USER_DATA_PATH, 'config.json');
const PROFILE_PATH = path.join(USER_DATA_PATH, 'profile.json');

const DEFAULT_CONFIG = {
  jvmArgs: ["-Xmx4G", "-Xms3G"],
  gameVersion: "1.16.5",
  gameDirectory: path.join(app.getPath('userData'), 'resources', 'minecraft'),
  javaPath: path.join(app.getPath('userData'), 'resources', 'jre-legacy', 'bin', 'java.exe'),
  autoUpdate: true,
  language: 'pt-BR',
  theme: 'default'
};

class ConfigManager {
  constructor() {
    this.config = null;
    this.profile = null;
    this.loadConfig();
    this.loadProfile();
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      } else {
        this.config = DEFAULT_CONFIG;
        this.saveConfig();
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      this.config = DEFAULT_CONFIG;
    }
  }

  loadProfile() {
    try {
      if (fs.existsSync(PROFILE_PATH)) {
        this.profile = JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf-8'));
      } else {
        this.profile = { authorization: {} };
        this.saveProfile();
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      this.profile = { authorization: {} };
    }
  }

  saveConfig() {
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
    }
  }

  saveProfile() {
    try {
      fs.writeFileSync(PROFILE_PATH, JSON.stringify(this.profile, null, 2), 'utf-8');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
    }
  }

  getConfig() {
    return this.config;
  }

  getProfile() {
    return this.profile;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  updateProfile(newProfile) {
    this.profile = { ...this.profile, ...newProfile };
    this.saveProfile();
  }

  getJvmArgs() {
    return this.config.jvmArgs;
  }

  updateJvmArgs(jvmArgs) {
    this.config.jvmArgs = jvmArgs;
    this.saveConfig();
  }

  getAuthorization() {
    return this.profile.authorization;
  }

  updateAuthorization(authorization) {
    this.profile.authorization = authorization;
    this.saveProfile();
  }

  clearAuthorization() {
    this.profile.authorization = {};
    this.saveProfile();
  }
}

export const configManager = new ConfigManager(); 