const fs = require('fs');
const axios = require('axios');
const https = require('https');
const { BrowserWindow } = require('electron');
const RconClient = require('../lib/rcon');
const configModule = require('../lib/config');

function register(ipcMain, getState) {
  // getState() returns { rconClient, setRconClient }

  ipcMain.handle('rcon-connect', async (_e, host, port, password) => {
    // If agent relay is enabled, proxy via HTTP API
    try {
      const agent = configModule.getAgentSettings();
      if (agent.enabled) {
        const base = agent.url.replace(/\/$/, '');
        const agentUrl = `${base}/rcon/connect`;
        const options = { headers: { 'x-api-key': agent.apiKey } };
        if (agent.caFile) {
          const ca = fs.readFileSync(agent.caFile);
          options.httpsAgent = new https.Agent({ ca });
        }
        const resp = await axios.post(agentUrl, { host, port, password }, options);
        if (resp.data && resp.data.success) return true;
        throw new Error(resp.data.error || 'Agent RCON connect failed');
      }
    } catch (err) {
      throw new Error(`Agent RCON connect failed: ${err.message}`);
    }
    // Normalize arguments: support both (host,port,password) and ({host,port,password})
    let _host, _port, _password;
    if (arguments.length === 2 && typeof arguments[1] === 'object' && arguments[1] !== null) {
      // Payload object
      ({ host: _host, port: _port, password: _password } = arguments[1]);
    } else {
      // Positional args: _e, host, port, password
      _host = host;
      _port = port;
      _password = password;
    }
    // Validate inputs for RCON connection
    if (!_host || typeof _host !== 'string' || _host.trim() === '') {
      throw new Error('Host is required for RCON');
    }
    const portNum = parseInt(_port, 10);
    if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
      throw new Error(`Invalid RCON port: ${_port}`);
    }
    if (typeof _password !== 'string' || _password === '') {
      throw new Error('Password is required for RCON');
    }
    // Clean up any existing client
    if (getState().rconClient) {
      try { getState().rconClient.disconnect(); } catch (_) {}
      getState().setRconClient(null);
    }
    // Create and connect new client
    const newClient = new RconClient(host.trim(), portNum, password);
    getState().setRconClient(newClient);
    await newClient.connect();
    return true;
  });

  ipcMain.handle('rcon-command', async (_e, command) => {
    // If agent relay is enabled, proxy via HTTP API
    try {
      const agent = configModule.getAgentSettings();
      if (agent.enabled) {
        const base = agent.url.replace(/\/$/, '');
        const agentUrl = `${base}/rcon/command`;
        const options = { headers: { 'x-api-key': agent.apiKey } };
        if (agent.caFile) {
          const ca = fs.readFileSync(agent.caFile);
          options.httpsAgent = new https.Agent({ ca });
        }
        const resp = await axios.post(agentUrl, { command }, options);
        if (resp.data && resp.data.success) return resp.data.response;
        throw new Error(resp.data.error || 'Agent RCON command failed');
      }
    } catch (err) {
      throw new Error(`Agent RCON command failed: ${err.message}`);
    }

    // Ensure command is a non-empty string before proceeding
    if (!command || typeof command !== 'string' || command.trim() === '') {
      throw new Error('Command must be a non-empty string');
    }

    // If we don't have an RCON client, attempt to reconnect if we have saved params
    if (!getState().rconClient) {
      throw new Error('Not connected to RCON server');
    }

    try {
      // The RconClient class will now handle auto-reconnect if needed
      return await getState().rconClient.command(command);
    } catch (err) {
      // If the command fails, log the error
      console.error(`RCON command error:`, err.message);
      throw err;
    }
  });

  ipcMain.handle('rcon-disconnect', async (_e, options = {}) => {
    const disconnectReason = options?.reason || 'User disconnected';

    // If agent relay is enabled, proxy via HTTP API
    try {
      const agent = configModule.getAgentSettings();
      if (agent.enabled) {
        const base = agent.url.replace(/\/$/, '');
        const agentUrl = `${base}/rcon/disconnect`;
        const agentOptions = { headers: { 'x-api-key': agent.apiKey } };
        if (agent.caFile) {
          const ca = fs.readFileSync(agent.caFile);
          agentOptions.httpsAgent = new https.Agent({ ca });
        }
        await axios.post(agentUrl, {}, agentOptions);

        // Notify UI about the disconnection
        BrowserWindow.getAllWindows().forEach(win => {
          try {
            win.webContents.send('rcon-disconnected', { reason: disconnectReason });
            win.webContents.send('refresh-server-tab', { reason: disconnectReason });
          } catch (err) {
            console.error('[AGENT] Error sending disconnect events:', err.message);
          }
        });

        return true;
      }
    } catch (err) {
      throw new Error(`Agent RCON disconnect failed: ${err.message}`);
    }

    if (getState().rconClient) {
      // Check if the connection is still valid first
      if (getState().rconClient.isConnected && getState().rconClient.isConnected()) {
        console.log(`Disconnecting active RCON connection due to: ${disconnectReason}`);
      } else {
        console.log(`RCON connection already disconnected, cleaning up`);
      }

      try { getState().rconClient.disconnect(); } catch (_) {}
      getState().setRconClient(null);

      // Notify UI about the disconnection
      BrowserWindow.getAllWindows().forEach(win => {
        try {
          // Send multiple events to ensure UI updates
          win.webContents.send('rcon-disconnected', { reason: disconnectReason });
          win.webContents.send('connection-state-changed', {
            type: 'rcon',
            state: 'disconnected',
            reason: disconnectReason
          });
          win.webContents.send('refresh-server-tab', { reason: disconnectReason });
          win.webContents.send('refresh-all-tabs', { reason: disconnectReason });
        } catch (err) {
          console.error('[RCON] Error sending disconnect events:', err.message);
        }
      });
    } else {
      console.log(`No active RCON client to disconnect`);
    }

    return true;
  });
}

module.exports = { register };
