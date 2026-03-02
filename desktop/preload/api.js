// API definitions for preload
const { ipcRenderer } = require('electron');

// Import modules with relative paths
const configModule = require('./config.js');
const { createAgentFunction, reconnectToAgent } = require('./agent-function.js');

// Build and expose safe APIs to renderer via contextBridge
function createElectronAPI() {
  try {
    return {
      // Config API
      config: {
        loadRawConfigMode: configModule.loadRawConfigMode,
        loadConfig: configModule.loadConfig,
        saveConfig: configModule.saveConfig,
        setEncryptionMode: configModule.setEncryptionMode,
        setCustomPassword: configModule.setCustomPassword,
        getEncryptionMode: configModule.getEncryptionMode
      },
      
      // RCON via IPC or Agent
      rconConnect: createAgentFunction('POST', '/rcon/connect', 
        (host, port, password) => ({ host, port, password }), // Explicitly transform arguments to an object
        null, 
        'rcon-connect'),
      rconCommand: createAgentFunction('POST', '/rcon/command', 
        (command) => ({ command }), 
        null, 
        'rcon-command'),
      rconDisconnect: createAgentFunction('POST', '/rcon/disconnect', 
        () => ({}), 
        null, 
        'rcon-disconnect'),
      
      // Query via IPC or Agent
      queryStatus: createAgentFunction('GET', '/query', 
        (host, port, mode) => {
          console.log('[PRELOAD] Query parameters:', { host, port, mode });
          return { host, port, mode: mode || 'basic' };
        },
        (data) => {
          console.log('[PRELOAD] Query response:', data);
          return data.info;
        },
        'query-status' // Explicitly specify the correct IPC method name
      ),
      
      // Log tail (only via IPC - not available through agent)
      startLogTail: (logPath) => ipcRenderer.invoke('start-log-tail', logPath),
      onLogLine: (callback) => ipcRenderer.on('log-line', (_event, data) => callback(data)),
      
      // Directory/file pickers (only via IPC)
      openLogDialog: () => ipcRenderer.invoke('open-log-dialog'),
      selectLogFile: () => ipcRenderer.invoke('select-log-file'),
      openCaFileDialog: () => ipcRenderer.invoke('open-ca-file-dialog'),
      openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
      saveFileDialog: (defaultFilename) => ipcRenderer.invoke('save-file-dialog', defaultFilename),
      
      // File operations (only via IPC)
      appendToLog: (filePath, data) => ipcRenderer.invoke('append-log', filePath, data),
      readFile: (filePath) => ipcRenderer.invoke('fs-read-file', filePath),
      writeFile: (filePath, data) => ipcRenderer.invoke('fs-write-file', filePath, data),
      
      // SMB storage via IPC or Agent
      smbConnect: createAgentFunction('POST', '/smb/connect', null, null, 'smb-connect'),
      smbDisconnect: createAgentFunction('POST', '/smb/disconnect', null, null, 'smb-disconnect'),
      smbReaddir: createAgentFunction('GET', '/smb/readdir', 
        (dirPath) => ({ path: dirPath, dirPath: dirPath }),  // Support both path and dirPath parameters
        (data) => data.list,
        'smb-readdir'
      ),
      smbStat: createAgentFunction('GET', '/smb/stat', 
        (filePath) => ({ path: filePath, filePath: filePath }),  // Support both path and filePath parameters
        (data) => {
          // Handle different response formats (direct isDirectory or nested in stats)
          if (data.isDirectory !== undefined) {
            return { isDirectory: data.isDirectory };
          } else if (data.stats && data.stats.isDirectory !== undefined) {
            return { isDirectory: data.stats.isDirectory };
          } else {
            console.warn('[SMB] Unexpected stat response format:', data);
            return { isDirectory: false }; // Safe default
          }
        },
        'smb-stat'
      ),
      smbReadFile: createAgentFunction('GET', '/smb/readFile', 
        (filePath) => ({ path: filePath, filePath: filePath }),  // Support both path and filePath parameters
        (data) => data.data,
        'smb-read-file'
      ),
      
      // Enhanced SMB write function with comprehensive recovery logic
      smbWriteFile: async (filePath, data, encoding) => {
        // Support both path and filePath parameters for consistency
        return ipcRenderer.invoke('smb-write-file', { 
          filePath, 
          path: filePath, 
          data,
          encoding
        });
      },
      
      // Enhanced helper for reconnecting WebSocket in SMB operations
      ensureSmbConnection: async () => {
        // Implement proper SMB connection verification
        console.log('[AGENT] Starting SMB connection verification sequence');
        
        try {
          // Try multiple sources to find a valid client ID
          let clientId = null;
          
          // First check connection manager
          try {
            const { connectionManager } = require('./connection-manager.js');
            clientId = connectionManager.getClientId('smb');
            if (clientId) {
              console.log(`[AGENT] Found SMB client ID in connectionManager: ${clientId}`);
            }
          } catch (cmErr) {
            console.warn('[AGENT] Failed to check connection manager:', cmErr.message);
          }
          
          // If no client ID in connection manager, check global wsClient
          if (!clientId && global.wsClient && global.wsClient.clientIds) {
            clientId = global.wsClient.clientIds.smb;
            if (clientId) {
              console.log(`[AGENT] Found SMB client ID in global.wsClient: ${clientId}`);
              // Update connection manager
              try {
                const { connectionManager } = require('./connection-manager.js');
                connectionManager.setClientId('smb', clientId);
              } catch (cmErr) {
                console.warn('[AGENT] Failed to update connection manager:', cmErr.message);
              }
            }
          }
          
          // If still not found, check global._wsClientData
          if (!clientId && global._wsClientData && global._wsClientData.clientIds) {
            clientId = global._wsClientData.clientIds.smb;
            if (clientId) {
              console.log(`[AGENT] Found SMB client ID in global._wsClientData: ${clientId}`);
              // Update global.wsClient if available
              if (global.wsClient) {
                global.wsClient.clientIds = global.wsClient.clientIds || {};
                global.wsClient.clientIds.smb = clientId;
              }
              
              // Update connection manager
              try {
                const { connectionManager } = require('./connection-manager.js');
                connectionManager.setClientId('smb', clientId);
              } catch (cmErr) {
                console.warn('[AGENT] Failed to update connection manager:', cmErr.message);
              }
            }
          }
          
          // Check window storage as last resort
          if (!clientId && typeof window !== 'undefined' && window._smbConnectionData) {
            clientId = window._smbConnectionData.clientId;
            if (clientId) {
              console.log(`[AGENT] Found SMB client ID in window._smbConnectionData: ${clientId}`);
              // Update global.wsClient if available
              if (global.wsClient) {
                global.wsClient.clientIds = global.wsClient.clientIds || {};
                global.wsClient.clientIds.smb = clientId;
              }
              
              // Update connection manager
              try {
                const { connectionManager } = require('./connection-manager.js');
                connectionManager.setClientId('smb', clientId);
              } catch (cmErr) {
                console.warn('[AGENT] Failed to update connection manager:', cmErr.message);
              }
            }
          }
          
          // If we have a client ID, verify it's still valid by checking it in wsClient
          if (clientId) {
            // Update all locations with this client ID for maximum resilience
            if (global.wsClient) {
              global.wsClient.clientIds = global.wsClient.clientIds || {};
              global.wsClient.clientIds.smb = clientId;
            }
            
            if (global._wsClientData) {
              global._wsClientData.clientIds = global._wsClientData.clientIds || {};
              global._wsClientData.clientIds.smb = clientId;
            }
            
            if (typeof window !== 'undefined') {
              if (!window._smbConnectionData) window._smbConnectionData = {};
              window._smbConnectionData.clientId = clientId;
              window._smbConnectionData.connected = true;
              window._smbConnectionData.timestamp = Date.now();
            }
            
            return { 
              success: true, 
              clientId: clientId, 
              usingAgent: true 
            };
          }
          
          console.error('[AGENT] No active SMB connection found in any storage location');
          throw new Error('No active SMB connection found');
        } catch (err) {
          console.error('[AGENT] SMB connection verification failed:', err);
          throw err;
        }
      },
      
      smbUnlink: createAgentFunction('POST', '/smb/unlink', 
        (filePath) => ({ path: filePath }),  // agent expects path, main.js expects filePath
        null,
        'smb-unlink'
      ),
      
      // MySQL via IPC or Agent
      mysqlConnect: createAgentFunction('POST', '/mysql/connect', null, null, 'mysql-connect'),
      mysqlDisconnect: createAgentFunction('POST', '/mysql/disconnect', null, null, 'mysql-disconnect'),
      mysqlQuery: createAgentFunction('POST', '/mysql/query', 
        (sql) => ({ sql }),
        (data) => data.result,
        'mysql-query'
      ),
      
      // Agent settings via IPC
      getAgentSettings: () => ipcRenderer.invoke('config-getAgentSettings'),
      setAgentSettings: (agentCfg) => ipcRenderer.invoke('config-setAgentSettings', agentCfg),
      
      // Agent status and connection
      checkAgentConnection: async () => {
        // Properly check agent connection
        try {
          // Get agent settings
          const agentCfg = await ipcRenderer.invoke('config-getAgentSettings');
          
          if (!agentCfg.enabled) {
            return { connected: false, status: "Agent disabled" };
          }
          
          // Try to make a real connection test
          // Ensure we're using WebSocket URL format (ws:// or wss://)
          let healthUrl = agentCfg.url.replace(/\/$/, '');
          
          // Convert to WebSocket URL if it's not already
          if (!healthUrl.startsWith('ws://') && !healthUrl.startsWith('wss://')) {
            if (healthUrl.startsWith('http://')) {
              healthUrl = healthUrl.replace('http://', 'ws://');
            } else if (healthUrl.startsWith('https://')) {
              healthUrl = healthUrl.replace('https://', 'wss://');
            } else {
              // Add ws:// if no protocol specified
              healthUrl = 'ws://' + healthUrl;
            }
          }
          
          const response = await ipcRenderer.invoke('agent-proxy-request', {
            method: 'GET',
            url: `${healthUrl}/health`,
            data: null,
            apiKey: agentCfg.apiKey,
            // Don't pass useSSL - the protocol (ws:// or wss://) indicates SSL usage
            caFile: agentCfg.caFile
          });
          
          if (response && response.status === 'ok') {
            return { connected: true, status: "OK" };
          } else {
            return { connected: false, status: "Agent returned unexpected response" };
          }
        } catch (err) {
          return { connected: false, status: err.message };
        }
      },
      
      // YAML validation via IPC
      validateYaml: (content) => ipcRenderer.invoke('validate-yaml', content),
      
      // Explicit agent reconnect function
      agentReconnect: async () => {
        try {
          // First check if agent is enabled before attempting reconnection
          const agentCfg = await ipcRenderer.invoke('config-getAgentSettings');
          
          if (!agentCfg.enabled) {
            console.log('[AGENT] Agent is disabled, no reconnection needed');
            return { success: false, message: 'Agent is disabled, no reconnection needed', agentDisabled: true };
          }
          
          // First, try to reconnect WebSocket if it exists
          if (global.wsClient) {
            try {
              console.log('[AGENT] Explicitly reconnecting WebSocket...');
              await global.wsClient.reconnect();
              console.log('[AGENT] WebSocket reconnected successfully');
            } catch (wsErr) {
              console.error('[AGENT] WebSocket reconnect failed:', wsErr);
              
              // Try to recreate the WebSocket client
              try {
                // Ensure we're using WebSocket URL format (ws:// or wss://)
                let wsUrl = agentCfg.url;
                
                // Convert to WebSocket URL if it's not already
                if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
                  if (wsUrl.startsWith('http://')) {
                    wsUrl = wsUrl.replace('http://', 'ws://');
                    console.log('[AGENT] Converting HTTP to WS URL:', wsUrl);
                  } else if (wsUrl.startsWith('https://')) {
                    wsUrl = wsUrl.replace('https://', 'wss://');
                    console.log('[AGENT] Converting HTTPS to WSS URL:', wsUrl);
                  } else {
                    // Add ws:// if no protocol specified
                    wsUrl = 'ws://' + wsUrl;
                    console.log('[AGENT] Adding WS protocol to URL:', wsUrl);
                  }
                }
                
                console.log('[AGENT] Creating new WebSocket client...');
                // Create and use a direct AgentSocketIOClient from lib
                const AgentSocketIOClient = require('../lib/agentWebSocket');
                if (!AgentSocketIOClient) {
                  throw new Error('[AGENT] Failed to load AgentSocketIOClient module');
                }
                
                console.log('[AGENT] Successfully loaded AgentSocketIOClient from lib');
                
                // Create the client with direct instantiation rather than through window API
                global.wsClient = new AgentSocketIOClient(wsUrl, agentCfg.apiKey);
                console.log('[AGENT] Successfully created AgentSocketIOClient instance');
                
                // Connect to the agent
                await global.wsClient.connect();
                console.log('[AGENT] Created new WebSocket client successfully');
              } catch (createErr) {
                console.error('[AGENT] Failed to create new WebSocket client:', createErr);
                throw new Error(`Failed to recreate WebSocket client: ${createErr.message}`);
              }
            }
          }
          
          // Now try to reconnect all clients
          const result = await reconnectToAgent();
          
          // If reconnectToAgent returns agentDisabled: true, we need to return
          // a slightly different format to maintain compatibility with existing code
          if (result && result.agentDisabled) {
            console.log('[AGENT] Agent is disabled, returning compatible response format');
            return { 
              success: false, 
              message: 'Agent is disabled, no reconnection needed', 
              agentDisabled: true,
              // Include these fields for compatibility with code expecting them
              clientId: null,
              connected: false
            };
          }
          
          return result;
        } catch (err) {
          if (err.message && err.message.includes('Agent is disabled')) {
            console.log('[AGENT] Agent is disabled exception caught, returning compatible response format');
            return { 
              success: false, 
              message: 'Agent is disabled, no reconnection needed', 
              agentDisabled: true,
              // Include these fields for compatibility with code expecting them
              clientId: null,
              connected: false
            };
          }
          console.error('[AGENT] Explicit reconnect failed:', err);
          throw err;
        }
      }
    };
  } catch (err) {
    console.error('Preload API build failed:', err);
    return {};
  }
}

module.exports = { createElectronAPI };