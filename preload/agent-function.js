// Agent Function Creation Module
const { ipcRenderer } = require('electron');

/**
 * Normalize a path value to a string, handling objects with .path property,
 * toString() results, and other edge cases.
 * @param {*} path - The path to normalize
 * @returns {string} The normalized path string
 */
function normalizePath(path) {
  if (typeof path === 'string') return path;
  if (path && typeof path === 'object' && path.path && typeof path.path === 'string') {
    return path.path;
  }
  if (path && typeof path === 'object' && path.toString) {
    const str = path.toString();
    if (str !== '[object Object]') return str;
  }
  const fallback = String(path || '');
  return fallback === '[object Object]' ? '' : fallback;
}

/**
 * Resolve a client ID for the given connection type by checking multiple sources.
 * @param {Object} context - The wsClient object (this)
 * @param {string} type - Connection type: 'smb', 'rcon', 'mysql'
 * @returns {string|null} The resolved client ID, or null if not found
 */
function resolveClientId(context, type) {
  // Check in the context object's clientIds
  if (context.clientIds && context.clientIds[type]) {
    return context.clientIds[type];
  }

  // Check connection manager
  try {
    const { connectionManager } = require('./connection-manager.js');
    const id = connectionManager.getClientId(type);
    if (id) {
      context.clientIds = context.clientIds || {};
      context.clientIds[type] = id;
      return id;
    }
  } catch (_) {}

  // Check global data
  if (global._wsClientData && global._wsClientData.clientIds) {
    const id = global._wsClientData.clientIds[type];
    if (id) {
      context.clientIds = context.clientIds || {};
      context.clientIds[type] = id;
      try {
        const { connectionManager } = require('./connection-manager.js');
        connectionManager.setClientId(type, id);
      } catch (_) {}
      return id;
    }
  }

  // Check window storage
  const storageKey = `_${type}ConnectionData`;
  if (typeof window !== 'undefined' && window[storageKey]) {
    const id = window[storageKey].clientId;
    if (id) {
      context.clientIds = context.clientIds || {};
      context.clientIds[type] = id;
      return id;
    }
  }

  return null;
}

// Create an agent relay wrapper for a function that calls the agent API
function createAgentFunction(method, endpoint, transformRequest, transformResponse, explicitIpcMethod) {
  return async (...args) => {
    // Get current agent settings
    const agentCfg = await ipcRenderer.invoke('config-getAgentSettings');
    
    if (!agentCfg.enabled) {
      // Agent relay is disabled or configuration is invalid
      // Map the API endpoint to an IPC method (with less verbose logging)
      const ipcMethod = explicitIpcMethod || endpoint.replace(/\//g, '-').replace(/^-/, '');
      
      // Only log for less common operations, not the frequent polling ones
      const isFrequentOp = endpoint.includes('/rcon/command') || 
                          endpoint.includes('/query') ||
                          endpoint.includes('/smb/readdir');
      
      if (!isFrequentOp) {
        console.log(`[AGENT] Using direct IPC for ${endpoint} (agent disabled)`);
        console.log(`[AGENT] Mapped to IPC method: ${ipcMethod}`);
      }
      
      // Special handling for smb-write-file to ensure consistent parameter format
      if (ipcMethod === 'smb-write-file' && args.length === 2) {
        const [filePath, data] = args;
        
        // Ensure that data is either a string or a Buffer
        if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
          console.error('[AGENT] smb-write-file: data is not a string or Buffer:', typeof data);
          throw new Error('Data must be a string or Buffer');
        }
        
        return ipcRenderer.invoke(ipcMethod, { filePath, data });
      }
      
      // Direct IPC invoke for non-agent mode
      return ipcRenderer.invoke(ipcMethod, ...args);
    }

    try {
      // Determine the connection type from the endpoint path
      const connectionType = endpoint.includes('/rcon') ? 'rcon' : 
                             endpoint.includes('/smb') ? 'smb' : 
                             endpoint.includes('/mysql') ? 'mysql' : null;
      
      // Import connection manager with relative path to avoid circular dependencies
      const { connectionManager } = require('./connection-manager.js');
      
      // Create WebSocket client if not already created or if it's missing required methods
      if (!global.wsClient || !global.wsClient.smbStat || !global.wsClient.rconCommand) {
        console.log('[AGENT] Creating new WebSocket client for agent connection');
        try {
          // Log more details about the agent configuration for troubleshooting
          console.log(`[AGENT] Connecting to agent at: ${agentCfg.url}`);
          console.log(`[AGENT] Using protocol: ${agentCfg.url.startsWith('ws') ? 'WebSocket' : 'HTTP'}`);
          
          // Create and use a direct AgentSocketIOClient from lib
          const AgentSocketIOClient = require('../lib/agentWebSocket');
          if (!AgentSocketIOClient) {
            throw new Error('[AGENT] Failed to load AgentSocketIOClient module');
          }
          
          console.log('[AGENT] Successfully loaded AgentSocketIOClient from lib');
          
          // Preserve original URL format for HTTP requests
          let httpUrl = agentCfg.url;
          // Ensure we have HTTP/HTTPS protocol for regular requests
          if (!httpUrl.startsWith('http://') && !httpUrl.startsWith('https://')) {
            if (httpUrl.startsWith('ws://')) {
              httpUrl = httpUrl.replace('ws://', 'http://');
            } else if (httpUrl.startsWith('wss://')) {
              httpUrl = httpUrl.replace('wss://', 'https://');
            } else {
              // Add http:// if no protocol specified
              httpUrl = 'http://' + httpUrl;
            }
          }
          
          // For WebSocket connections, we need WebSocket URLs
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
          
          // Check if we already have a client in window.agentWebSocket that we can use
          if (typeof window !== 'undefined' && 
              window.agentWebSocket && 
              typeof window.agentWebSocket.connect === 'function') {
              
            console.log('[AGENT] Using existing window.agentWebSocket.connect method');
            try {
              // Try to use the contextBridge-exposed method first
              global.wsClient = await window.agentWebSocket.connect(wsUrl, agentCfg.apiKey);
              console.log('[AGENT] Successfully created WebSocket client via window.agentWebSocket');
            } catch (wserr) {
              console.warn('[AGENT] Failed to create WebSocket via window.agentWebSocket:', wserr.message);
              console.log('[AGENT] Falling back to direct AgentSocketIOClient instantiation');
              
              // Create the client with direct instantiation as fallback
              global.wsClient = new AgentSocketIOClient(wsUrl, agentCfg.apiKey);
              console.log('[AGENT] Successfully created AgentSocketIOClient instance directly');
              
              // Connect to the agent
              await global.wsClient.connect();
            }
          } else {
            // Create the client with direct instantiation
            console.log('[AGENT] window.agentWebSocket not available, using direct AgentSocketIOClient');
            global.wsClient = new AgentSocketIOClient(wsUrl, agentCfg.apiKey);
            console.log('[AGENT] Successfully created AgentSocketIOClient instance');
            
            // Connect to the agent
            await global.wsClient.connect();
          }
          
          console.log('[AGENT] WebSocket client created and connected successfully');
          
          // Ensure global.wsClient has all required methods from renderer.js
          // Add missing SMB methods for compatibility
          if (typeof global.wsClient.sendRequest === 'function') {
            console.log('[AGENT] Verifying and adding required SMB methods to client');
            
            // Add disconnectFromSmb if missing
            if (!global.wsClient.disconnectFromSmb) {
              console.log('[AGENT] Adding missing disconnectFromSmb method to client');
              global.wsClient.disconnectFromSmb = async function() {
                // Ensure we have a client ID
                if (!this.clientIds.smb) {
                  return; // Already disconnected
                }
                
                try {
                  await this.sendRequest('disconnect', 'smb', {
                    clientId: this.clientIds.smb
                  });
                  
                  // Clear the client ID
                  this.clientIds.smb = null;
                } catch (err) {
                  console.error('[Socket.IO] SMB disconnect error:', err);
                  throw err;
                }
              };
            }
            
            // Add connectToSmb if missing
            if (!global.wsClient.connectToSmb) {
              console.log('[AGENT] Adding missing connectToSmb method to client');
              global.wsClient.connectToSmb = async function(host, share, username, password) {
                try {
                  console.log(`[AGENT:SMB] Connecting to SMB share: ${host}\\${share}`);
                  const result = await this.sendRequest('connect', 'smb', { 
                    host, share, username, password 
                  });
                  
                  if (!result || !result.clientId) {
                    console.error('[AGENT:SMB] Connection failed: No clientId returned');
                    throw new Error('SMB connection failed: No clientId returned');
                  }
                  
                  console.log(`[AGENT:SMB] Successfully connected to SMB with clientId: ${result.clientId}`);
                  
                  // Store the client ID in all relevant places
                  this.clientIds.smb = result.clientId;
                  
                  // Update connection manager if available
                  try {
                    const { connectionManager } = require('./connection-manager.js');
                    connectionManager.setClientId('smb', result.clientId);
                    connectionManager.saveConnection('smb', { host, share, username, password });
                    console.log('[AGENT:SMB] Updated connection manager with SMB client ID');
                  } catch (cmErr) {
                    console.warn('[AGENT:SMB] Failed to update connection manager:', cmErr.message);
                  }
                  
                  // Update global state
                  if (global._wsClientData) {
                    global._wsClientData.clientIds = global._wsClientData.clientIds || {};
                    global._wsClientData.clientIds.smb = result.clientId;
                    
                    global._wsClientData.connections = global._wsClientData.connections || {};
                    global._wsClientData.connections.smb = { host, share, username, password };
                    console.log('[AGENT:SMB] Updated global._wsClientData with SMB client ID');
                  }
                  
                  // Additionally store in window for cross-context access if needed
                  if (typeof window !== 'undefined') {
                    if (!window._smbConnectionData) window._smbConnectionData = {};
                    window._smbConnectionData.clientId = result.clientId;
                    window._smbConnectionData.connected = true;
                    window._smbConnectionData.timestamp = Date.now();
                    console.log('[AGENT:SMB] Stored SMB connection data in window object');
                  }
                  
                  // Return a standardized result format
                  return { 
                    success: true, 
                    clientId: result.clientId,
                    result: result
                  };
                } catch (err) {
                  console.error('[AGENT:SMB] SMB connect error:', err);
                  throw err;
                }
              };
            }
            
            // Add smbReaddir if missing
            if (!global.wsClient.smbReaddir) {
              console.log('[AGENT] Adding missing smbReaddir method to client');
              global.wsClient.smbReaddir = async function(path) {
                path = normalizePath(path);
                
                console.log(`[AGENT:SMB] Reading directory: ${path || '/'}`);
                
                const clientId = resolveClientId(this, 'smb');
                if (!clientId) {
                  throw new Error('Not connected to SMB share - please connect first');
                }
                
                // We have a client ID, proceed with the readdir operation
                try {
                  console.log(`[AGENT:SMB] Sending readdir request with client ID: ${clientId}`);
                  const result = await this.sendRequest('command', 'smb', {
                    clientId: clientId,
                    operation: 'readdir',
                    path
                  });
                  
                  console.log(`[AGENT:SMB] Successfully read directory, found ${result.list ? result.list.length : 0} items`);
                  
                  // Handle various result formats
                  if (result.list && Array.isArray(result.list)) {
                    return result.list;
                  } else if (Array.isArray(result)) {
                    return result;
                  } else {
                    console.warn('[AGENT:SMB] Unexpected readdir result format:', result);
                    return [];
                  }
                } catch (err) {
                  console.error('[AGENT:SMB] SMB readdir error:', err);
                  
                  // If we get "client not found" or similar error, clear client ID
                  if (err.message && (
                      err.message.includes('Client not found') ||
                      err.message.includes('invalid clientId') ||
                      err.message.includes('Not connected'))) {
                    console.log('[AGENT:SMB] Clearing invalid client ID');
                    this.clientIds.smb = null;
                    
                    // Also clear in connection manager
                    try {
                      const { connectionManager } = require('./connection-manager.js');
                      connectionManager.clearConnection('smb');
                    } catch (cmErr) {
                      console.warn('[AGENT:SMB] Failed to clear connection manager:', cmErr.message);
                    }
                    
                    // Clear in global state
                    if (global._wsClientData && global._wsClientData.clientIds) {
                      global._wsClientData.clientIds.smb = null;
                    }
                  }
                  
                  // Throw with more detailed error
                  throw new Error(`Failed to list directory: ${err.message}`);
                }
              };
            }
            
            // Add smbStat if missing
            if (!global.wsClient.smbStat) {
              console.log('[AGENT] Adding missing smbStat method to client');
              global.wsClient.smbStat = async function(path) {
                path = normalizePath(path);
                
                console.log(`[AGENT:SMB] Getting stat for: ${path}`);
                
                const clientId = resolveClientId(this, 'smb');
                if (!clientId) {
                  throw new Error('Not connected to SMB share - please connect first');
                }
                
                try {
                  console.log(`[AGENT:SMB] Sending stat request with client ID: ${clientId}`);
                  const result = await this.sendRequest('command', 'smb', {
                    clientId: clientId,
                    operation: 'stat',
                    path
                  });
                  
                  console.log('[AGENT:SMB] Successfully got file stat');
                  
                  // Normalize result format
                  if (result.isDirectory !== undefined) {
                    return { isDirectory: result.isDirectory };
                  } else if (result.stats && result.stats.isDirectory !== undefined) {
                    return { isDirectory: result.stats.isDirectory };
                  } else {
                    console.warn('[AGENT:SMB] Unexpected stat response format:', result);
                    return { isDirectory: false }; // Safe default
                  }
                } catch (err) {
                  console.error('[AGENT:SMB] SMB stat error:', err);
                  
                  // If we get "client not found" or similar error, clear client ID
                  if (err.message && (
                      err.message.includes('Client not found') ||
                      err.message.includes('invalid clientId') ||
                      err.message.includes('Not connected'))) {
                    console.log('[AGENT:SMB] Clearing invalid client ID');
                    this.clientIds.smb = null;
                    
                    // Also clear in connection manager
                    try {
                      const { connectionManager } = require('./connection-manager.js');
                      connectionManager.clearConnection('smb');
                    } catch (cmErr) {
                      console.warn('[AGENT:SMB] Failed to clear connection manager:', cmErr.message);
                    }
                    
                    // Clear in global state
                    if (global._wsClientData && global._wsClientData.clientIds) {
                      global._wsClientData.clientIds.smb = null;
                    }
                  }
                  
                  throw new Error(`Failed to get file info: ${err.message}`);
                }
              };
            }
          }
          
          // Store the client globally in window as well for cross-module access
          if (typeof window !== 'undefined') {
            window._agentWebSocketClient = global.wsClient;
            console.log('[AGENT] WebSocket client also stored in window._agentWebSocketClient');
          }
          
          // Set up enhanced client event handlers with better diagnostics
          // Check if client has setOn* methods before trying to use them
          if (typeof global.wsClient.setOnDisconnected === 'function') {
            global.wsClient.setOnDisconnected(() => {
              console.log('[AGENT] WebSocket disconnected from agent');
              // Emit event to renderer to show disconnection status if needed
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('agent-ws-disconnected'));
              }
            });
          } else {
            console.warn('[AGENT] Client missing setOnDisconnected method');
            // Try direct property assignment as fallback
            global.wsClient.onDisconnected = () => {
              console.log('[AGENT] WebSocket disconnected from agent');
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('agent-ws-disconnected'));
              }
            };
          }
          
          if (typeof global.wsClient.setOnError === 'function') {
            global.wsClient.setOnError((err) => {
              console.error('[AGENT] WebSocket error:', err);
              
              // Add detailed error information
              const errorDetails = {
                message: err.message,
                time: new Date().toISOString(),
                url: agentCfg.url,
                diagnostics: err.diagnostics || {}
              };
              
              console.error('[AGENT] WebSocket error details:', JSON.stringify(errorDetails, null, 2));
              
              // Emit event to renderer to show error status if needed
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('agent-ws-error', { 
                  detail: { error: errorDetails }
                }));
              }
            });
          } else {
            console.warn('[AGENT] Client missing setOnError method');
            // Try direct property assignment as fallback
            global.wsClient.onError = (err) => {
              console.error('[AGENT] WebSocket error:', err);
              
              const errorDetails = {
                message: err.message,
                time: new Date().toISOString(),
                url: agentCfg.url,
                diagnostics: err.diagnostics || {}
              };
              
              console.error('[AGENT] WebSocket error details:', JSON.stringify(errorDetails, null, 2));
              
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('agent-ws-error', { 
                  detail: { error: errorDetails }
                }));
              }
            };
          }
          
          if (typeof global.wsClient.setOnReconnecting === 'function') {
            global.wsClient.setOnReconnecting((attempt) => {
              console.log(`[AGENT] WebSocket reconnecting, attempt ${attempt}`);
              // Emit event to renderer to show reconnecting status if needed
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('agent-ws-reconnecting', {
                  detail: { attempt }
                }));
              }
            });
          } else {
            console.warn('[AGENT] Client missing setOnReconnecting method');
            // Try direct property assignment as fallback
            global.wsClient.onReconnecting = (attempt) => {
              console.log(`[AGENT] WebSocket reconnecting, attempt ${attempt}`);
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('agent-ws-reconnecting', {
                  detail: { attempt }
                }));
              }
            };
          }
        } catch (err) {
          // Create a more detailed error message with troubleshooting guidance
          console.error('[AGENT] Failed to create WebSocket client:', err);
          
          // Format a more detailed error message
          let errorMessage = `Failed to establish WebSocket connection to agent: ${err.message}`;
          
          // Add detailed troubleshooting guidance based on the error
          if (err.message.includes('Content Security Policy')) {
            errorMessage += '\n\nCSP Error: Your Content Security Policy is blocking WebSocket connections. ' +
              'Verify that your CSP includes "connect-src \'self\' ws: wss: ws://localhost:* wss://localhost:*"';
          } else if (err.message.includes('ECONNREFUSED')) {
            errorMessage += '\n\nConnection Refused: The agent server is not running or not accessible at the specified URL.';
          } else if (err.message.includes('SSL')) {
            errorMessage += '\n\nSSL Error: There is an issue with the SSL/TLS configuration. ' +
              'Check if you need to configure a custom CA certificate.';
          } else if (err.message.includes('undefined')) {
            errorMessage += '\n\nAPI Error: The WebSocket API may not be properly initialized. ' +
              'This could indicate an issue with the electron preload script or contextBridge setup.';
          }
          
          throw new Error(errorMessage);
        }
      }

      // Handle WebSocket operation based on endpoint
      if (endpoint.startsWith('/rcon/connect')) {
        // Extract parameters
        let host, port, password;
        if (transformRequest && typeof transformRequest === 'function') {
          const params = transformRequest(...args);
          host = params.host;
          port = params.port;
          password = params.password;
        } else {
          [host, port, password] = args;
        }
        
        console.log(`[AGENT] Connecting to RCON server at ${host}:${port} via WebSocket`);
        
        try {
          // Save connection parameters for potential reconnect
          connectionManager.saveConnection('rcon', { host, port, password });
          
          // Connect via WebSocket client
          const clientId = await global.wsClient.connectToRcon(host, port, password);
          
          // Register the client ID with connection manager
          connectionManager.setClientId('rcon', clientId);
          
          return { clientId, success: true };
        } catch (err) {
          console.error('[AGENT] RCON connect error:', err);
          throw err;
        }
      }
      else if (endpoint.startsWith('/rcon/command')) {
        // Extract command
        let command;
        if (transformRequest && typeof transformRequest === 'function') {
          const params = transformRequest(...args);
          command = params.command;
        } else {
          [command] = args;
        }
        
        try {
          // Get active client ID from connection manager
          const clientId = connectionManager.getClientId('rcon');
          
          if (!clientId) {
            throw new Error('Not connected to RCON server - please connect first');
          }
          
          console.log(`[AGENT] Executing RCON command via WebSocket (client ${clientId}): ${command}`);
          
          // Execute command via WebSocket client with extra error handling
          let result;
          try {
            result = await global.wsClient.rconCommand(command);
            console.log(`[AGENT] RCON command successful, result type: ${typeof result}`);
            
            // Handle edge case where result is undefined or null
            if (result === undefined || result === null) {
              console.warn('[AGENT] RCON command returned undefined/null result, using empty string');
              result = { response: '' };
            }
          } catch (cmdErr) {
            console.error('[AGENT] Error executing RCON command via WebSocket:', cmdErr);
            throw cmdErr;
          }
          
          // Update activity timestamp
          connectionManager.lastActivity = Date.now();
          
          // Normalize the response format - extremely cautious approach
          let response;
          
          try {
            if (typeof result === 'string') {
              response = result;
            } else if (result && typeof result.response === 'string') {
              response = result.response;
            } else if (result && result.response) {
              // Try to convert to string if it's not already one
              try {
                response = String(result.response);
              } catch (err) {
                console.warn('[AGENT] Could not convert RCON response to string, using placeholder');
                response = `Command executed: ${command}`;
              }
            } else {
              console.warn('[AGENT] Unexpected RCON response format', result);
              response = `Command executed: ${command}`;
            }
          } catch (err) {
            console.error('[AGENT] Error normalizing RCON response:', err);
            response = `Command executed: ${command}`;
          }
          
          // Final safety check to ensure response is ALWAYS a string
          if (typeof response !== 'string') {
            console.warn('[AGENT] Response is still not a string after normalization, forcing string conversion');
            try {
              response = String(response);
            } catch (err) {
              response = `Command executed: ${command}`;
            }
          }
          
          return { response, success: true };
        } catch (err) {
          console.error('[AGENT] RCON command error:', err);
          throw err;
        }
      }
      else if (endpoint.startsWith('/rcon/disconnect')) {
        try {
          // Get active client ID from connection manager
          const clientId = connectionManager.getClientId('rcon');
          
          if (!clientId) {
            console.log('[AGENT] Already disconnected from RCON server');
            return { success: true };
          }
          
          console.log(`[AGENT] Disconnecting from RCON server (client ${clientId})`);
          
          // Disconnect via WebSocket client
          await global.wsClient.disconnectFromRcon();
          
          // Clear client ID in connection manager
          connectionManager.clearConnection('rcon');
          
          return { success: true };
        } catch (err) {
          console.error('[AGENT] RCON disconnect error:', err);
          throw err;
        }
      }
      // Handle SMB operations
      else if (endpoint.startsWith('/smb/connect')) {
        // Extract parameters
        let host, share, username, password;
        if (transformRequest && typeof transformRequest === 'function') {
          const params = transformRequest(...args);
          host = params.host;
          share = params.share;
          username = params.username;
          password = params.password;
        } else {
          [host, share, username, password] = args;
        }
        
        try {
          console.log(`[AGENT] Connecting to SMB share ${host}:${share} via WebSocket`);
          
          // First make sure we have a WebSocket client
          if (!global.wsClient) {
            console.warn('[AGENT] WebSocket client missing, creating new one');
            // Load the client directly from lib
            const AgentSocketIOClient = require('../lib/agentWebSocket');
            
            if (!AgentSocketIOClient) {
              throw new Error('[AGENT] Failed to load AgentSocketIOClient module');
            }
            
            // Create a client directly rather than using window API
            global.wsClient = new AgentSocketIOClient(agentCfg.url, agentCfg.apiKey);
            
            // Connect to the agent
            await global.wsClient.connect();
          }
          
          // Check if connectToSmb is available
          if (!global.wsClient.connectToSmb) {
            console.error('[AGENT] connectToSmb method is missing, attempting to access directly');
            // Try direct reconnect if method is missing
            if (typeof global.wsClient.sendRequest === 'function') {
              console.log('[AGENT] Using sendRequest directly for SMB connection');
              
              // Send connect request directly
              const result = await global.wsClient.sendRequest('connect', 'smb', {
                host, share, username, password
              });
              
              // Store the client ID
              if (result.clientId) {
                global.wsClient.clientIds.smb = result.clientId;
                
                // Also update connection manager
                connectionManager.setClientId('smb', result.clientId);
                connectionManager.saveConnection('smb', { host, share, username, password });
              }
              
              return result;
            } else {
              throw new Error('SMB connection functionality is not available - websocket methods missing');
            }
          }
          
          // Connect via WebSocket client
          const result = await global.wsClient.connectToSmb(host, share, username, password);
          
          // Register the client ID with connection manager
          if (result && result.clientId) {
            connectionManager.setClientId('smb', result.clientId);
            connectionManager.saveConnection('smb', { host, share, username, password });
          }
          
          return result;
        } catch (err) {
          console.error('[AGENT] SMB connect error:', err);
          throw err;
        }
      }
      else if (endpoint.startsWith('/smb/stat')) {
        // Extract parameters
        let path;
        if (transformRequest && typeof transformRequest === 'function') {
          const params = transformRequest(...args);
          path = params.path;
        } else {
          [path] = args;
        }
        
        path = normalizePath(path);
        
        try {
          console.log(`[AGENT] Getting SMB stat for ${path} via WebSocket`);
          
          // First ensure we have a valid WebSocket client
          if (!global.wsClient) {
            console.warn('[AGENT] WebSocket client missing for stat, creating new one');
            // Load the client directly from lib
            const AgentSocketIOClient = require('../lib/agentWebSocket');
            
            if (!AgentSocketIOClient) {
              throw new Error('[AGENT] Failed to load AgentSocketIOClient module');
            }
            
            // Create a client directly rather than using window API
            global.wsClient = new AgentSocketIOClient(agentCfg.url, agentCfg.apiKey);
            
            // Connect to the agent
            await global.wsClient.connect();
          }
          
          // Ensure we have a valid SMB client ID
          const clientId = connectionManager.getClientId('smb');
          if (!clientId) {
            console.error('[AGENT] No active SMB client ID found');
            throw new Error('Not connected to SMB share - please connect first');
          }
          
          // Check if we can use the direct sendRequest method (more reliable)
          if (typeof global.wsClient.sendRequest === 'function') {
            console.log(`[AGENT] Using sendRequest directly for SMB stat (clientId: ${clientId})`);
            
            // Send stat request directly
            const result = await global.wsClient.sendRequest('command', 'smb', {
              clientId,
              operation: 'stat',
              path
            });
            
            if (result && result.stats) {
              return { isDirectory: result.stats.isDirectory };
            } else {
              console.warn('[AGENT] Unexpected response format from SMB stat:', result);
              return { isDirectory: false };
            }
          }
          
          // Fallback to regular smbStat if available
          if (!global.wsClient.smbStat) {
            console.error('[AGENT] smbStat method is missing and sendRequest fallback failed');
            throw new Error('SMB stat functionality is not available');
          }
          
          // Get stat via WebSocket client
          const result = await global.wsClient.smbStat(path);
          return result;
        } catch (err) {
          console.error('[AGENT] SMB stat error:', err);
          throw err;
        }
      }
      else if (endpoint.startsWith('/smb/readdir')) {
        // Extract parameters
        let path;
        if (transformRequest && typeof transformRequest === 'function') {
          const params = transformRequest(...args);
          path = params.path;
        } else {
          [path] = args;
        }
        
        path = normalizePath(path);
        
        try {
          console.log(`[AGENT] Reading SMB directory ${path} via WebSocket`);
          
          // First ensure we have a valid WebSocket client
          if (!global.wsClient) {
            console.warn('[AGENT] WebSocket client missing for readdir, creating new one');
            // Load the client directly from lib
            const AgentSocketIOClient = require('../lib/agentWebSocket');
            
            if (!AgentSocketIOClient) {
              throw new Error('[AGENT] Failed to load AgentSocketIOClient module');
            }
            
            // Create a client directly rather than using window API
            global.wsClient = new AgentSocketIOClient(agentCfg.url, agentCfg.apiKey);
            
            // Connect to the agent
            await global.wsClient.connect();
          }
          
          // Ensure we have a valid SMB client ID
          const clientId = connectionManager.getClientId('smb');
          if (!clientId) {
            console.error('[AGENT] No active SMB client ID found');
            throw new Error('Not connected to SMB share - please connect first');
          }
          
          // Check if we can use the direct sendRequest method (more reliable)
          if (typeof global.wsClient.sendRequest === 'function') {
            console.log(`[AGENT] Using sendRequest directly for SMB readdir (clientId: ${clientId})`);
            
            // Send readdir request directly
            const result = await global.wsClient.sendRequest('command', 'smb', {
              clientId,
              operation: 'readdir',
              path
            });
            
            if (result && result.list) {
              return { list: result.list };
            } else {
              console.warn('[AGENT] Unexpected response format from SMB readdir:', result);
              return { list: [] };
            }
          }
          
          // Fallback to regular smbReaddir if available
          if (!global.wsClient.smbReaddir) {
            console.error('[AGENT] smbReaddir method is missing and sendRequest fallback failed');
            throw new Error('SMB readdir functionality is not available');
          }
          
          // Read directory via WebSocket client
          const result = await global.wsClient.smbReaddir(path);
          
          // Ensure the result has the expected structure
          if (result && result.list) {
            return result;
          } else if (Array.isArray(result)) {
            // Handle case where API returns array directly instead of {list: []}
            return { list: result };
          } else {
            console.warn('[AGENT] Unexpected smbReaddir result format:', result);
            return { list: [] };
          }
        } catch (err) {
          console.error('[AGENT] SMB readdir error:', err);
          throw err;
        }
      }
      else if (endpoint.startsWith('/smb/readFile')) {
        // Extract parameters
        let path;
        if (transformRequest && typeof transformRequest === 'function') {
          const params = transformRequest(...args);
          path = params.path;
        } else {
          [path] = args;
        }
        
        path = normalizePath(path);
        
        try {
          console.log(`[AGENT] Reading SMB file ${path} via WebSocket`);
          
          // First ensure we have a valid WebSocket client
          if (!global.wsClient) {
            console.warn('[AGENT] WebSocket client missing for readFile, creating new one');
            // Load the client directly from lib
            const AgentSocketIOClient = require('../lib/agentWebSocket');
            
            if (!AgentSocketIOClient) {
              throw new Error('[AGENT] Failed to load AgentSocketIOClient module');
            }
            
            // Create a client directly rather than using window API
            global.wsClient = new AgentSocketIOClient(agentCfg.url, agentCfg.apiKey);
            
            // Connect to the agent
            await global.wsClient.connect();
          }
          
          // Ensure we have a valid SMB client ID
          const clientId = connectionManager.getClientId('smb');
          if (!clientId) {
            console.error('[AGENT] No active SMB client ID found');
            throw new Error('Not connected to SMB share - please connect first');
          }
          
          // Check if we can use the direct sendRequest method (more reliable)
          if (typeof global.wsClient.sendRequest === 'function') {
            console.log(`[AGENT] Using sendRequest directly for SMB readFile (clientId: ${clientId})`);
            
            // Send readFile request directly
            const result = await global.wsClient.sendRequest('command', 'smb', {
              clientId,
              operation: 'readFile',
              path
            });
            
            if (result && result.data) {
              return { data: result.data };
            } else {
              console.warn('[AGENT] Unexpected response format from SMB readFile:', result);
              return { data: '' };
            }
          }
          
          // Fallback to regular smbReadFile if available
          if (!global.wsClient.smbReadFile) {
            console.error('[AGENT] smbReadFile method is missing and sendRequest fallback failed');
            throw new Error('SMB readFile functionality is not available');
          }
          
          // Read file via WebSocket client
          const result = await global.wsClient.smbReadFile(path);
          return result;
        } catch (err) {
          console.error('[AGENT] SMB readFile error:', err);
          throw err;
        }
      }
      
      // Handle MySQL operations
      else if (endpoint.startsWith('/mysql/connect')) {
        // Extract parameters
        let host, port, user, password, database, ssl;
        if (transformRequest && typeof transformRequest === 'function') {
          const params = transformRequest(...args);
          host = params.host;
          port = params.port;
          user = params.user;
          password = params.password;
          database = params.database;
          ssl = params.ssl || false;
        } else {
          [host, port, user, password, database, ssl] = args;
          ssl = ssl || false;
        }
        
        try {
          console.log(`[AGENT] Connecting to MySQL database at ${host}:${port}/${database} via WebSocket`);
          
          // First make sure we have a WebSocket client
          if (!global.wsClient) {
            console.warn('[AGENT] WebSocket client missing, creating new one');
            // Load the client directly from lib
            const AgentSocketIOClient = require('../lib/agentWebSocket');
            
            if (!AgentSocketIOClient) {
              throw new Error('[AGENT] Failed to load AgentSocketIOClient module');
            }
            
            // Create a client directly rather than using window API
            global.wsClient = new AgentSocketIOClient(agentCfg.url, agentCfg.apiKey);
            
            // Connect to the agent
            await global.wsClient.connect();
          }
          
          // Check if connectToMysql is available
          if (!global.wsClient.connectToMysql) {
            console.error('[AGENT] connectToMysql method is missing, attempting to access directly');
            // Try direct connect if method is missing
            if (typeof global.wsClient.sendRequest === 'function') {
              console.log('[AGENT] Using sendRequest directly for MySQL connection');
              
              // Send connect request directly
              const result = await global.wsClient.sendRequest('connect', 'mysql', {
                host, 
                port: parseInt(port, 10), 
                user, 
                password, 
                database,
                ssl
              });
              
              // Store the client ID
              if (result.clientId) {
                global.wsClient.clientIds = global.wsClient.clientIds || {};
                global.wsClient.clientIds.mysql = result.clientId;
                
                // Also update connection manager
                connectionManager.setClientId('mysql', result.clientId);
                connectionManager.saveConnection('mysql', { host, port, user, password, database, ssl });
              }
              
              return result;
            } else {
              throw new Error('MySQL connection functionality is not available - websocket methods missing');
            }
          }
          
          // Connect via WebSocket client
          const result = await global.wsClient.connectToMysql(host, port, user, password, database, ssl);
          
          // Register the client ID with connection manager
          if (result && result.clientId) {
            connectionManager.setClientId('mysql', result.clientId);
            connectionManager.saveConnection('mysql', { host, port, user, password, database, ssl });
          }
          
          return result;
        } catch (err) {
          console.error('[AGENT] MySQL connect error:', err);
          throw err;
        }
      }
      else if (endpoint.startsWith('/mysql/query')) {
        // Extract query
        let query;
        if (transformRequest && typeof transformRequest === 'function') {
          const params = transformRequest(...args);
          query = params.query;
        } else {
          [query] = args;
        }
        
        try {
          console.log(`[AGENT] Executing MySQL query via WebSocket: ${query.substring(0, 50)}${query.length > 50 ? '...' : ''}`);
          
          // First ensure we have a valid WebSocket client
          if (!global.wsClient) {
            console.warn('[AGENT] WebSocket client missing for MySQL query, creating new one');
            // Load the client directly from lib
            const AgentSocketIOClient = require('../lib/agentWebSocket');
            
            if (!AgentSocketIOClient) {
              throw new Error('[AGENT] Failed to load AgentSocketIOClient module');
            }
            
            // Create a client directly rather than using window API
            global.wsClient = new AgentSocketIOClient(agentCfg.url, agentCfg.apiKey);
            
            // Connect to the agent
            await global.wsClient.connect();
          }
          
          // Ensure we have a valid MySQL client ID
          const clientId = connectionManager.getClientId('mysql');
          if (!clientId) {
            console.error('[AGENT] No active MySQL client ID found');
            throw new Error('Not connected to MySQL database - please connect first');
          }
          
          // Check if we can use the direct sendRequest method (more reliable)
          if (typeof global.wsClient.sendRequest === 'function') {
            console.log(`[AGENT] Using sendRequest directly for MySQL query (clientId: ${clientId})`);
            
            // Send query request directly
            const result = await global.wsClient.sendRequest('command', 'mysql', {
              clientId,
              sql: query  // The agent expects 'sql' parameter, not 'query'
            });
            
            return result;
          }
          
          // Fallback to regular mysqlQuery if available
          if (!global.wsClient.mysqlQuery) {
            console.error('[AGENT] mysqlQuery method is missing and sendRequest fallback failed');
            throw new Error('MySQL query functionality is not available');
          }
          
          // Execute query via WebSocket client
          const result = await global.wsClient.mysqlQuery(query);
          return result;
        } catch (err) {
          console.error('[AGENT] MySQL query error:', err);
          throw err;
        }
      }
      else if (endpoint.startsWith('/mysql/disconnect')) {
        try {
          console.log('[AGENT] Disconnecting from MySQL database via WebSocket');
          
          // First ensure we have a valid WebSocket client
          if (!global.wsClient) {
            console.warn('[AGENT] WebSocket client missing for MySQL disconnect, creating new one');
            // Load the client directly from lib
            const AgentSocketIOClient = require('../lib/agentWebSocket');
            
            if (!AgentSocketIOClient) {
              throw new Error('[AGENT] Failed to load AgentSocketIOClient module');
            }
            
            // Create a client directly rather than using window API
            global.wsClient = new AgentSocketIOClient(agentCfg.url, agentCfg.apiKey);
            
            // Connect to the agent
            await global.wsClient.connect();
          }
          
          // Ensure we have a valid MySQL client ID
          const clientId = connectionManager.getClientId('mysql');
          if (!clientId) {
            console.log('[AGENT] No active MySQL client ID found - already disconnected');
            return { success: true };
          }
          
          // Check if we can use the direct sendRequest method (more reliable)
          if (typeof global.wsClient.sendRequest === 'function') {
            console.log(`[AGENT] Using sendRequest directly for MySQL disconnect (clientId: ${clientId})`);
            
            // Send disconnect request directly
            await global.wsClient.sendRequest('disconnect', 'mysql', {
              clientId
            });
            
            // Clear the client ID
            global.wsClient.clientIds = global.wsClient.clientIds || {};
            global.wsClient.clientIds.mysql = null;
            
            // Also clear in connection manager
            connectionManager.clearConnection('mysql');
            
            return { success: true };
          }
          
          // Fallback to regular disconnectFromMysql if available
          if (!global.wsClient.disconnectFromMysql) {
            console.error('[AGENT] disconnectFromMysql method is missing and sendRequest fallback failed');
            throw new Error('MySQL disconnect functionality is not available');
          }
          
          // Disconnect via WebSocket client
          await global.wsClient.disconnectFromMysql();
          
          // Clear client ID in connection manager
          connectionManager.clearConnection('mysql');
          
          return { success: true };
        } catch (err) {
          console.error('[AGENT] MySQL disconnect error:', err);
          throw err;
        }
      }
      
      // Default case - endpoint not recognized 
      console.error(`[AGENT] Unimplemented agent endpoint: ${endpoint}`);
      throw new Error(`Unimplemented agent endpoint: ${endpoint}`);
    } catch (err) {
      console.error(`Agent relay error (${endpoint}):`, err);
      throw err;
    }
  };
}

// Add explicit reconnect function
const reconnectToAgent = async () => {
  console.log('[CONNECTION] Explicitly reconnecting to agent...');
  
  try {
    // First check if agent is enabled before attempting reconnection
    const agentCfg = await ipcRenderer.invoke('config-getAgentSettings');
    
    if (!agentCfg.enabled) {
      console.log('[CONNECTION] Agent is disabled, no reconnection needed');
      return { success: false, message: 'Agent is disabled, no reconnection needed', agentDisabled: true };
    }
    
    // Import connection manager with relative path
    const { connectionManager } = require('./connection-manager.js');
    
    // Check if we have any active connections
    const hasConnections = Object.values(connectionManager.connections).some(conn => conn !== null);
    
    if (!hasConnections) {
      console.warn('[CONNECTION] No stored connection parameters available');
      throw new Error('No stored connection parameters available');
    }
    
    // Try to reconnect all stored connections
    const result = await connectionManager.reconnectAll();
    
    if (result) {
      console.log('[CONNECTION] Successfully reconnected to agent');
      return { success: true, message: 'Successfully reconnected to agent' };
    } else {
      console.error('[CONNECTION] Failed to reconnect to agent');
      throw new Error('Failed to reconnect to agent');
    }
  } catch (err) {
    if (err.message === 'No stored connection parameters available') {
      throw err; // Re-throw specific error
    } else {
      console.error('[CONNECTION] Error during reconnection attempt:', err);
      throw new Error(`Failed to reconnect: ${err.message}`);
    }
  }
};

module.exports = {
  createAgentFunction,
  reconnectToAgent
};