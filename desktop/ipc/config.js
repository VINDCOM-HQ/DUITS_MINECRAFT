/**
 * Config IPC handlers
 * Configuration management and agent settings
 */
const { BrowserWindow } = require('electron');
const configModule = require('../lib/config');

function register(ipcMain, getState) {
  ipcMain.handle('config-loadRawConfigMode', () => configModule.loadRawConfigMode());
  ipcMain.handle('config-loadConfig', () => configModule.loadConfig());
  ipcMain.handle('config-saveConfig', (_e, cfg) => { configModule.saveConfig(cfg); return true; });
  ipcMain.handle('config-setEncryptionMode', (_e, mode) => { configModule.setEncryptionMode(mode); return true; });
  ipcMain.handle('config-setCustomPassword', (_e, pw) => { configModule.setCustomPassword(pw); return true; });
  ipcMain.handle('config-getEncryptionMode', () => configModule.getEncryptionMode());
  ipcMain.handle('config-getAgentSettings', () => configModule.getAgentSettings());

  ipcMain.handle('config-setAgentSettings', (_e, agentCfg) => {
    // Get previous settings to compare
    const previousSettings = configModule.getAgentSettings();

    // Save the new settings first
    configModule.setAgentSettings(agentCfg);

    // Check if agent mode was toggled (either way)
    if (previousSettings.enabled !== agentCfg.enabled) {
      console.log(`[AGENT] Agent relay ${agentCfg.enabled ? 'enabled' : 'disabled'}, checking active connections...`);

      // Always check for active connections and disconnect them if found
      const disconnectionReason = agentCfg.enabled ? 'Agent relay enabled' : 'Agent relay disabled';

      // Check RCON connection status
      let rconClient = getState().rconClient;
      let rconConnected = false;
      if (rconClient) {
        try {
          rconConnected = rconClient.isConnected && rconClient.isConnected();
        } catch (err) {
          rconConnected = false;
        }
        if (typeof rconConnected !== 'boolean') {
          rconConnected = !!rconClient.connected;
        }
      }

      console.log(`[AGENT] RCON connection status: ${rconConnected ? 'Connected' : 'Disconnected'}`);

      if (rconConnected) {
        try {
          console.log(`[AGENT] Disconnecting RCON due to ${disconnectionReason}`);
          rconClient.disconnect();

          BrowserWindow.getAllWindows().forEach(win => {
            try {
              win.webContents.send('rcon-disconnected', { reason: disconnectionReason });
              win.webContents.send('connection-state-changed', {
                type: 'rcon',
                state: 'disconnected',
                reason: disconnectionReason
              });
              win.webContents.send('refresh-server-tab', { reason: disconnectionReason });
            } catch (err) {
              console.error('[AGENT] Error sending RCON disconnect events:', err.message);
            }
          });
        } catch (err) {
          console.error('[AGENT] Error disconnecting RCON:', err.message);
        }
        getState().setRconClient(null);
      }

      // Check SMB connection status
      let smbClientMain = getState().smbClientMain;
      let smbConnected = false;
      if (smbClientMain) {
        try {
          smbConnected = smbClientMain.connected === true;
        } catch (err) {
          smbConnected = false;
        }
      }

      console.log(`[AGENT] SMB connection status: ${smbConnected ? 'Connected' : 'Disconnected'}`);

      if (smbConnected) {
        try {
          console.log(`[AGENT] Disconnecting SMB due to ${disconnectionReason}`);
          smbClientMain.close();

          BrowserWindow.getAllWindows().forEach(win => {
            try {
              win.webContents.send('smb-disconnected', { reason: disconnectionReason });
              win.webContents.send('connection-state-changed', {
                type: 'smb',
                state: 'disconnected',
                reason: disconnectionReason
              });
              win.webContents.send('refresh-smb-tab', { reason: disconnectionReason });
            } catch (err) {
              console.error('[AGENT] Error sending SMB disconnect events:', err.message);
            }
          });
        } catch (err) {
          console.error('[AGENT] Error disconnecting SMB:', err.message);
        }
        getState().setSmbClientMain(null);
      }

      // Check MySQL connection status
      const mysqlClients = getState().mysqlClients;
      const mysqlConnectionCount = mysqlClients.size;
      console.log(`[AGENT] MySQL connections count: ${mysqlConnectionCount}`);

      if (mysqlConnectionCount > 0) {
        try {
          console.log(`[AGENT] Disconnecting ${mysqlConnectionCount} MySQL connections due to ${disconnectionReason}`);
          for (const [id, client] of mysqlClients.entries()) {
            try {
              client.close();
              console.log(`[AGENT] MySQL connection ${id} closed successfully`);
            } catch (err) {
              console.error(`[AGENT] Error closing MySQL connection ${id}: ${err.message}`);
            }
          }
          mysqlClients.clear();

          BrowserWindow.getAllWindows().forEach(win => {
            try {
              win.webContents.send('mysql-disconnected', { reason: disconnectionReason });
              win.webContents.send('connection-state-changed', {
                type: 'mysql',
                state: 'disconnected',
                reason: disconnectionReason
              });
              win.webContents.send('refresh-mysql-tab', { reason: disconnectionReason });
              win.webContents.send('refresh-all-tabs', { reason: disconnectionReason });
            } catch (err) {
              console.error('[AGENT] Error sending MySQL disconnect events:', err.message);
            }
          });
        } catch (err) {
          console.error(`[AGENT] Error managing MySQL connections: ${err.message}`);
        }
      }

      // Always send a final "connections-changed" event
      BrowserWindow.getAllWindows().forEach(win => {
        try {
          win.webContents.send('connections-changed', {
            reason: disconnectionReason,
            rcon: false,
            smb: false,
            mysql: false
          });
        } catch (err) {
          console.error('[AGENT] Error sending connections-changed event:', err.message);
        }
      });
    }

    return true;
  });
}

module.exports = { register };
