// Configuration API via IPC
const { ipcRenderer } = require('electron');

// Configuration module for preload with enhanced logging
const configModule = {
  loadRawConfigMode: async () => {
    console.log('[CONFIG] Invoking config-loadRawConfigMode');
    try {
      const result = await ipcRenderer.invoke('config-loadRawConfigMode');
      console.log('[CONFIG] loadRawConfigMode result:', result);
      return result;
    } catch (err) {
      console.error('[CONFIG] loadRawConfigMode error:', err);
      throw err;
    }
  },
  
  loadConfig: async () => {
    console.log('[CONFIG] Invoking config-loadConfig');
    try {
      const result = await ipcRenderer.invoke('config-loadConfig');
      console.log('[CONFIG] loadConfig success, keys:', Object.keys(result || {}));
      return result;
    } catch (err) {
      console.error('[CONFIG] loadConfig error:', err);
      throw err;
    }
  },
  
  saveConfig: async (cfg) => {
    console.log('[CONFIG] Invoking config-saveConfig');
    try {
      const result = await ipcRenderer.invoke('config-saveConfig', cfg);
      console.log('[CONFIG] saveConfig result:', result);
      return result;
    } catch (err) {
      console.error('[CONFIG] saveConfig error:', err);
      throw err;
    }
  },
  
  setEncryptionMode: async (mode) => {
    console.log('[CONFIG] Invoking config-setEncryptionMode:', mode);
    try {
      const result = await ipcRenderer.invoke('config-setEncryptionMode', mode);
      console.log('[CONFIG] setEncryptionMode result:', result);
      return result;
    } catch (err) {
      console.error('[CONFIG] setEncryptionMode error:', err);
      throw err;
    }
  },
  
  setCustomPassword: async (pw) => {
    console.log('[CONFIG] Invoking config-setCustomPassword (password redacted)');
    try {
      const result = await ipcRenderer.invoke('config-setCustomPassword', pw);
      console.log('[CONFIG] setCustomPassword result:', result);
      return result;
    } catch (err) {
      console.error('[CONFIG] setCustomPassword error:', err);
      throw err;
    }
  },
  
  getEncryptionMode: async () => {
    console.log('[CONFIG] Invoking config-getEncryptionMode');
    try {
      const result = await ipcRenderer.invoke('config-getEncryptionMode');
      console.log('[CONFIG] getEncryptionMode result:', result);
      return result;
    } catch (err) {
      console.error('[CONFIG] getEncryptionMode error:', err);
      throw err;
    }
  }
};

module.exports = configModule;