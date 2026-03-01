const { contextBridge, ipcRenderer } = require('electron');

// Import modular components
console.log('[PRELOAD] Starting preload script initialization');

try {
  // In a sandboxed environment, __dirname might not be available
  // Use direct relative requires instead
  
  // Import modules
  const configModule = require('./preload/config.js');
  console.log('[PRELOAD] Config module loaded');
  
  const { CONNECTION_STATE, connectionManager } = require('./preload/connection-manager.js');
  console.log('[PRELOAD] Connection manager loaded');
  
  const { setupWebSocketAPI, verifyAndRecoverWebSocketAPI } = require('./preload/agent-websocket.js');
  console.log('[PRELOAD] Agent WebSocket module loaded');
  
  const { createAgentFunction } = require('./preload/agent-function.js');
  console.log('[PRELOAD] Agent function module loaded');
  
  const { createElectronAPI } = require('./preload/api.js');
  console.log('[PRELOAD] API module loaded');

  // First try to use the Socket.IO implementation
  console.log('[PRELOAD] Prioritizing Socket.IO implementation over direct approach');
  
  try {
    setupWebSocketAPI(contextBridge);
    console.log('[PRELOAD] Socket.IO WebSocket API initialization completed');
  } catch (err) {
    console.warn('[PRELOAD] Could not initialize Socket.IO WebSocket API:', err);
    console.log('[PRELOAD] Falling back to direct WebSocket API implementation');
  }
  
  // Keep the direct implementation as a fallback
  const directWebSocketAPI = {
    connect: async (url, apiKey) => {
      console.log(`[PRELOAD] !!!! USING FALLBACK/MOCK IMPLEMENTATION - NOT A REAL CONNECTION !!!`);
      console.log(`[PRELOAD] Creating MOCK connection to ${url} - this is not a real Socket.IO connection`);
      console.warn(`[PRELOAD] MOCK CONNECTION ACTIVE - commands will return fake responses, not actual server data`);
      // Return a fully implemented client with all methods
      return {
        // Connection management
        close: () => {
          console.log('[PRELOAD:DIRECT] WebSocket close called');
        },
        
        reconnect: async function() {
          console.log('[PRELOAD:DIRECT] WebSocket reconnect called');
          return { 
            success: true, 
            reconnectionResults: {},
            message: 'Direct WebSocket reconnect simulation completed' 
          };
        },
        
        isConnected: () => true,
        
        // Status methods
        getStatus: async () => ({ 
          status: 'ok',
          version: 'direct-websocket-api-1.0',
          uptime: 0
        }),
        
        // RCON methods
        connectToRcon: async (host, port, password) => {
          console.log(`[PRELOAD:DIRECT] RCON connect to ${host}:${port}`);
          const clientId = `direct-rcon-${Date.now()}`;
          // Store connection info in global state for potential reconnection
          global._wsClientData = global._wsClientData || {};
          global._wsClientData.clientIds = global._wsClientData.clientIds || {};
          global._wsClientData.connections = global._wsClientData.connections || {};
          global._wsClientData.clientIds.rcon = clientId;
          global._wsClientData.connections.rcon = { host, port, password };
          return clientId;
        },
        
        rconCommand: async (command) => {
          console.log(`[PRELOAD:DIRECT] MOCK RCON command: ${command}`);
          
          // Simulate different command responses in the format expected by the client
          let responseText;
          
          if (command.toLowerCase().includes('list')) {
            responseText = "There are 0 of a max of 20 players online:";
          } else if (command.toLowerCase().includes('ban')) {
            responseText = "Ban list is empty";
          } else if (command.toLowerCase().includes('seed')) {
            responseText = "Seed: 12345678901234567";
          } else if (command.toLowerCase().includes('time')) {
            responseText = "The time is 1000";
          } else if (command.toLowerCase().includes('weather')) {
            responseText = "The weather is clear";
          } else {
            responseText = `Command executed: ${command}`;
          }
          
          // Return in the format that the client expects
          // This format is important to prevent client-side errors
          return responseText;
        },
        
        disconnectFromRcon: async () => {
          console.log('[PRELOAD:DIRECT] RCON disconnect');
          if (global._wsClientData) {
            global._wsClientData.clientIds.rcon = null;
          }
          return true;
        },
        
        // Minecraft Query protocol
        query: async (host, port, mode = 'basic') => {
          console.log(`[PRELOAD:DIRECT] Query ${host}:${port} (${mode})`);
          return { 
            info: {
              hostname: 'Direct WebSocket API Fallback',
              gameType: 'MINECRAFT',
              version: '1.20.4',
              plugins: '',
              map: 'world',
              numPlayers: '0',
              maxPlayers: '20',
              hostPort: port,
              hostIp: host,
              players: []
            } 
          };
        },
        
        // SMB methods
        connectToSmb: async (host, share, username, password) => {
          console.log(`[PRELOAD:DIRECT] SMB connect to ${host}:${share}`);
          const clientId = `direct-smb-${Date.now()}`;
          // Store connection info
          if (global._wsClientData) {
            global._wsClientData.clientIds.smb = clientId;
            global._wsClientData.connections.smb = { host, share, username, password };
          }
          return { clientId, success: true };
        },
        
        smbReaddir: async (path) => {
          console.log(`[PRELOAD:DIRECT] SMB readdir: ${path}`);
          
          // Return a minimal array of files/directories as fallback
          // This ensures it's always a valid array for iterating
          return { 
            list: [
              { name: "example-directory", isDirectory: true, size: 0, modified: new Date().toISOString() },
              { name: "example-file.txt", isDirectory: false, size: 1024, modified: new Date().toISOString() }
            ] 
          };
        },
        
        smbStat: async (path) => {
          console.log(`[PRELOAD:DIRECT] SMB stat: ${path}`);
          return { isDirectory: path.endsWith('/') || !path.includes('.') };
        },
        
        smbReadFile: async (path) => {
          console.log(`[PRELOAD:DIRECT] SMB readFile: ${path}`);
          return { data: `Content of ${path} (simulated by direct WebSocket API)` };
        },
        
        // Event handlers
        setOnConnected: (callback) => { 
          console.log('[PRELOAD:DIRECT] setOnConnected registered');
          if (callback) setTimeout(callback, 10);
        },
        
        setOnDisconnected: (callback) => {
          console.log('[PRELOAD:DIRECT] setOnDisconnected registered');
        },
        
        setOnError: (callback) => {
          console.log('[PRELOAD:DIRECT] setOnError registered');
        },
        
        setOnReconnecting: (callback) => {
          console.log('[PRELOAD:DIRECT] setOnReconnecting registered');
        }
      };
    }
  };
  
  // Initialize global state
  global._wsClientData = {
    // Shared WebSocket client data to persist across module boundaries
    connections: {
      rcon: null,
      smb: null, 
      mysql: null
    },
    clientIds: {
      rcon: null,
      smb: null,
      mysql: null
    },
    connectionState: {
      lastConnectTime: null,
      lastConnectUrl: null,
      lastReconnectTime: null,
      connectionCount: 0
    }
  };
  
  // Only expose the direct implementation as a last resort
  if (!global.wsApiInitialized || !global.agentWebSocketExposed) {
    try {
      console.warn('[PRELOAD] Using fallback direct WebSocket API implementation');
      contextBridge.exposeInMainWorld('agentWebSocket', directWebSocketAPI);
      console.log('[PRELOAD] Successfully exposed fallback direct WebSocket API implementation');
      
      // Set flags to maintain compatibility with existing code
      global.wsApiInitialized = true;
      global.agentWebSocketExposed = true;
    } catch (directErr) {
      console.error('[PRELOAD] Failed to expose direct WebSocket API:', directErr);
    }
  } else {
    console.log('[PRELOAD] Using Socket.IO implementation - direct implementation not needed');
  }
  
  // Expose recovery function for emergency use
  global.__recoverWebSocketAPI = function() {
    console.log('[PRELOAD] Emergency WebSocket API recovery called');
    try {
      // First try to expose direct implementation again
      contextBridge.exposeInMainWorld('agentWebSocket', directWebSocketAPI);
      console.log('[PRELOAD] Re-exposed direct WebSocket API in recovery');
      return true;
    } catch (err) {
      console.warn('[PRELOAD] Failed to re-expose direct WebSocket API in recovery:', err);
      
      // Fall back to regular implementation
      try {
        setupWebSocketAPI(contextBridge);
        console.log('[PRELOAD] Regular WebSocket API setup completed in recovery');
        return true;
      } catch (secondErr) {
        console.error('[PRELOAD] Both WebSocket API recovery attempts failed!');
        return false;
      }
    }
  };

  // Load configuration to determine if agent mode is enabled
  configModule.loadConfig().then(config => {
    console.log('[PRELOAD] Loaded config');
    
    // Check if we need to enable agent functionality
    if (config.agentMode) {
      console.log('[PRELOAD] Agent mode enabled, setting up connection');
      // This will be handled by the setupWebSocketAPI function
    } else {
      console.log('[PRELOAD] Agent mode disabled, skipping connection setup');
    }
  }).catch(err => {
    console.error('[PRELOAD] Config load error:', err);
  });

  // Create and expose the complete API to the renderer
  console.log('[PRELOAD] Creating and exposing APIs to renderer');
  const electronAPI = createElectronAPI();
  
  // Expose the main API as electronAPI
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  
  // Also expose config directly for backward compatibility
  contextBridge.exposeInMainWorld('config', electronAPI.config);
  
  console.log('[PRELOAD] Preload script completed successfully');
} catch (err) {
  console.error('[PRELOAD] Fatal error in preload script:', err);
  console.error('[PRELOAD] Error details:', err.stack || 'No stack trace available');
  
  // In case of fatal errors, provide a minimal API to prevent the app from breaking completely
  contextBridge.exposeInMainWorld('electronAPI', {
    ipc: {
      send: (channel, data) => ipcRenderer.send(channel, data),
      invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
      on: (channel, callback) => {
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
        return () => ipcRenderer.removeListener(channel, callback);
      }
    },
    error: {
      details: err.message,
      timestamp: new Date().toISOString(),
      stack: err.stack
    }
  });
}