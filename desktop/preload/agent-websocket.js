/**
 * Agent Socket.IO Implementation - Orchestrator
 * Exposes the agentWebSocket API to the renderer via contextBridge.
 * Domain-specific methods are delegated to ws-rcon, ws-query, ws-smb, ws-mysql modules.
 */
const { io } = require('socket.io-client');
const { createRconMethods } = require('./ws-rcon');
const { createQueryMethods } = require('./ws-query');
const { createSmbMethods } = require('./ws-smb');
const { createMysqlMethods } = require('./ws-mysql');

// Fallback when Socket.IO is unavailable
class DummySocketIO {
  constructor(url) {
    this.url = url;
    this.connected = false;
    setTimeout(() => {
      const h = this._onconnect_error;
      if (typeof h === 'function') h(new Error('DummySocketIO cannot establish real connections'));
    }, 100);
  }
  on(event, cb) { this[`_on${event}`] = cb; return this; }
  emit() { return this; }
  connect() { return this; }
  disconnect() { return this; }
  close() { return this; }
}

// Initialization tracking
let agentWebSocketExposed = false;
let wsApiInitialized = false;
const wsApiVersion = '3.1';

/**
 * Log the current WebSocket API state for diagnostics.
 */
const logWebSocketAPIState = () => {
  const windowApiExists = typeof window !== 'undefined' &&
    typeof window.agentWebSocket === 'object' &&
    window.agentWebSocket !== null;
  const apiHasMethods = windowApiExists &&
    typeof window.agentWebSocket.connect === 'function';

  if (windowApiExists && apiHasMethods && !agentWebSocketExposed) {
    agentWebSocketExposed = true;
    wsApiInitialized = true;
  }
};

/**
 * Verify the WebSocket API is available and attempt recovery if not.
 */
const verifyAndRecoverWebSocketAPI = (contextBridge, initFn) => {
  if (typeof window === 'undefined') return false;
  if (agentWebSocketExposed && wsApiInitialized) return true;

  const windowApiExists = typeof window.agentWebSocket === 'object' &&
    window.agentWebSocket !== null;
  const apiHasMethods = windowApiExists &&
    typeof window.agentWebSocket.connect === 'function';

  if (windowApiExists && apiHasMethods) return true;

  // Attempt recovery
  agentWebSocketExposed = false;
  wsApiInitialized = false;

  try {
    initFn(contextBridge);
    if (window.agentWebSocket || agentWebSocketExposed) {
      agentWebSocketExposed = true;
      wsApiInitialized = true;
      return true;
    }

    // Create minimal emergency placeholder only if nothing else worked
    if (window.agentWebSocket === undefined) {
      window.agentWebSocket = {
        _emergency: true,
        connect: async () => ({}),
        isConnected: () => false
      };
    }
    return false;
  } catch (err) {
    console.error('[PRELOAD] API recovery failed:', err);
    return false;
  }
};

/**
 * Normalize a WebSocket URL for Socket.IO connection.
 * Converts http/https to ws/wss and validates the protocol.
 * @param {string} url - Raw URL input
 * @returns {string} Normalized ws:// or wss:// URL
 */
function normalizeSocketUrl(url) {
  let socketUrl = url;
  if (!socketUrl.includes('://')) socketUrl = 'ws://' + socketUrl;
  if (socketUrl.startsWith('http://')) socketUrl = socketUrl.replace('http://', 'ws://');
  else if (socketUrl.startsWith('https://')) socketUrl = socketUrl.replace('https://', 'wss://');

  if (!socketUrl.startsWith('ws://') && !socketUrl.startsWith('wss://')) {
    throw new Error(`Invalid Socket.IO URL: ${socketUrl}`);
  }

  return socketUrl.replace(/\/$/, '');
}

/**
 * Initialize the agentWebSocket API and expose it via contextBridge.
 */
const initializeWebSocketAPI = (contextBridge) => {
  if (typeof WebSocket === 'undefined') {
    global.WebSocket = DummySocketIO;
  }

  if (!global._wsClientData) {
    global._wsClientData = {
      connections: { rcon: null, smb: null, mysql: null },
      clientIds: { rcon: null, smb: null, mysql: null },
      connectionState: {
        lastConnectTime: null,
        lastConnectUrl: null,
        lastReconnectTime: null,
        connectionCount: 0
      }
    };
  }

  if (wsApiInitialized && agentWebSocketExposed) {
    if (typeof window !== 'undefined' && window.agentWebSocket) return true;
  }

  if (typeof contextBridge === 'undefined') {
    console.error('[PRELOAD] contextBridge is undefined');
    return;
  }

  try {
    contextBridge.exposeInMainWorld('agentWebSocket', {

      /**
       * Connect to the agent server via Socket.IO and return a client API
       * with methods for RCON, SMB, MySQL, and Query operations.
       * @param {string} url - Agent server URL
       * @param {string} apiKey - API key for authentication
       * @returns {Promise<object>} Client API object
       */
      connect: async function(url, apiKey) {
        // Validate URL
        if (!url || typeof url !== 'string') {
          throw new Error('Invalid WebSocket URL provided. Must be a non-empty string.');
        }
        try {
          const urlObj = new URL(url.includes('://') ? url : `http://${url}`);
          if (![undefined, 'ws:', 'wss:', 'http:', 'https:'].includes(urlObj.protocol)) {
            throw new Error(`Unsupported URL protocol: ${urlObj.protocol}`);
          }
        } catch (err) {
          throw new Error(`Invalid WebSocket URL: ${err.message}`);
        }

        // Client state
        const client = {
          url,
          apiKey,
          ws: null,
          connected: false,
          pendingRequests: new Map(),
          messageId: 0,
          clientIds: { rcon: null, smb: null, mysql: null },
          connections: { rcon: null, smb: null, mysql: null },
          reconnectAttempts: 0,
          maxReconnectAttempts: 5,
          reconnectTimer: null,
          reconnectDelay: 1000,
          onConnected: null,
          onDisconnected: null,
          onError: null,
          onReconnecting: null
        };

        agentWebSocketExposed = true;

        const generateMessageId = () => client.messageId++;
        const getReconnectDelay = () =>
          Math.min(client.reconnectDelay * Math.pow(1.5, client.reconnectAttempts), 30000);

        /**
         * Send a request over Socket.IO and wait for the corresponding response.
         * Validates inputs and handles timeouts.
         */
        const sendRequest = (action, type, params = {}) => {
          return new Promise((resolve, reject) => {
            if (!client.ws || !client.ws.connected) {
              reject(new Error('Socket.IO is not connected'));
              return;
            }
            if (!action || typeof action !== 'string') {
              reject(new Error('Invalid action: must be a non-empty string'));
              return;
            }
            if (type !== null && type !== undefined && typeof type !== 'string') {
              reject(new Error('Invalid type: must be string, null, or undefined'));
              return;
            }
            if (params !== null && (typeof params !== 'object' || Array.isArray(params))) {
              reject(new Error('Invalid params: must be an object'));
              return;
            }

            const id = generateMessageId();
            client.pendingRequests.set(id, { resolve, reject, timestamp: Date.now() });

            try {
              client.ws.emit('request', {
                id,
                action: action.trim(),
                type: type?.trim() || null,
                params: params || {}
              });
            } catch (err) {
              client.pendingRequests.delete(id);
              reject(new Error(`Failed to send Socket.IO message: ${err.message}`));
            }

            setTimeout(() => {
              if (client.pendingRequests.has(id)) {
                client.pendingRequests.delete(id);
                reject(new Error('Request timed out'));
              }
            }, 30000);
          });
        };

        /**
         * Establish a Socket.IO connection to the agent server.
         * Sets up event handlers for connect, disconnect, errors, and responses.
         */
        const connectWebSocket = () => {
          return new Promise((resolve, reject) => {
            try {
              const socketUrl = normalizeSocketUrl(url);

              client.ws = io(socketUrl, {
                autoConnect: true,
                reconnection: false,
                transports: ['websocket'],
                query: apiKey ? { apiKey } : undefined,
                rejectUnauthorized: socketUrl.startsWith('wss://')
              });

              client.ws.on('connect', () => {
                client.connected = true;
                client.reconnectAttempts = 0;
                if (client.onConnected) client.onConnected();
                resolve();
              });

              client.ws.on('disconnect', (reason) => {
                client.connected = false;

                // Reject all pending requests
                for (const [id, { reject: rej }] of client.pendingRequests.entries()) {
                  rej(new Error('Socket.IO disconnected'));
                  client.pendingRequests.delete(id);
                }

                if (client.onDisconnected) client.onDisconnected();

                // Auto-reconnect with exponential backoff
                if (client.reconnectAttempts < client.maxReconnectAttempts) {
                  const delay = getReconnectDelay();
                  if (client.onReconnecting) client.onReconnecting(client.reconnectAttempts + 1);
                  if (client.reconnectTimer) clearTimeout(client.reconnectTimer);
                  client.reconnectTimer = setTimeout(() => {
                    client.reconnectAttempts++;
                    connectWebSocket().catch(() => {});
                  }, delay);
                }
              });

              client.ws.on('connect_error', (error) => {
                const msg = error.message || '';
                let errorMsg = 'Connection failed';
                if (msg.includes('ECONNREFUSED') || msg.includes('Failed to fetch') || msg.includes('timeout')) {
                  errorMsg = 'Agent server not reachable';
                } else if (msg.includes('certificate') || msg.includes('SSL') || msg.includes('TLS')) {
                  errorMsg = 'SSL certificate error';
                } else if (msg.includes('Authentication') || msg.includes('Unauthorized') || msg.includes('401')) {
                  errorMsg = 'API key invalid';
                }

                const enhancedError = new Error(errorMsg);
                enhancedError.originalError = error;
                enhancedError.url = socketUrl;

                global._wsClientData = global._wsClientData || {};
                global._wsClientData.lastConnectionError = {
                  message: errorMsg,
                  time: new Date().toISOString(),
                  count: (global._wsClientData.lastConnectionError?.count || 0) + 1
                };

                if (client.onError) client.onError(enhancedError);
                reject(enhancedError);
              });

              // Handle Socket.IO response events (request/response pattern)
              client.ws.on('response', (data) => {
                if (!data || typeof data !== 'object' || Array.isArray(data)) return;

                const { id, success, error, ...result } = data;
                if (id === undefined || id === null) return;

                // Skip server-initiated messages with ID 0
                if (id === 0 && !client.pendingRequests.has(id)) return;

                if (client.pendingRequests.has(id)) {
                  const { resolve: res, reject: rej } = client.pendingRequests.get(id);
                  if (success === true) {
                    res(result);
                  } else {
                    rej(new Error(error || 'Unknown error in Socket.IO response'));
                  }
                  client.pendingRequests.delete(id);
                }
              });
            } catch (err) {
              reject(err);
            }
          });
        };

        // Establish initial connection
        try {
          await connectWebSocket();
        } catch (err) {
          const enhancedError = new Error(`WebSocket connection to ${url} failed: ${err.message}`);
          enhancedError.originalError = err;
          throw enhancedError;
        }

        // Create domain-specific methods via factories
        const rconMethods = createRconMethods(client, sendRequest, connectWebSocket);
        const queryMethods = createQueryMethods(client, sendRequest, connectWebSocket);
        const smbMethods = createSmbMethods(client, sendRequest);
        const mysqlMethods = createMysqlMethods(client, sendRequest);

        // Return the assembled client API
        return {
          // Connection lifecycle
          close: () => {
            if (client.reconnectTimer) {
              clearTimeout(client.reconnectTimer);
              client.reconnectTimer = null;
            }
            if (client.ws) {
              try { client.ws.close(1000, 'Client closed connection'); } catch (_) {}
              client.ws = null;
              client.connected = false;
            }
          },

          reconnect: async function() {
            // Save connection state for restoration after reconnection
            let savedConnections = {};

            if (global._wsClientData && global._wsClientData.connections) {
              savedConnections = { ...global._wsClientData.connections };
            }
            if (client.connections) {
              savedConnections = { ...savedConnections, ...client.connections };
            }

            // Last resort: check connection manager
            const hasActiveConnections = Object.keys(savedConnections)
              .some(k => savedConnections[k]);
            if (!hasActiveConnections) {
              try {
                const { connectionManager } = require('./connection-manager.js');
                if (connectionManager && connectionManager.connections) {
                  savedConnections = { ...connectionManager.connections };
                }
              } catch (_) {}
            }

            if (global._wsClientData) {
              global._wsClientData.lastReconnectTime = Date.now();
            }

            // Close existing connection
            if (client.ws) {
              try { client.ws.close(1000, 'Explicit reconnect requested'); } catch (_) {}
              client.ws = null;
              client.connected = false;
              await new Promise(resolve => setTimeout(resolve, 500));
            }

            client.reconnectAttempts = 0;
            await connectWebSocket();

            // Re-establish domain sessions
            const results = {};
            for (const type of Object.keys(savedConnections)) {
              if (!savedConnections[type]) continue;
              try {
                const params = savedConnections[type];
                if (type === 'rcon' && params.host && params.port && params.password) {
                  const newId = await rconMethods.connectToRcon(
                    params.host, params.port, params.password
                  );
                  results[type] = { success: true, clientId: newId };
                } else if (type === 'smb' && params.host && params.share) {
                  const smbResult = await smbMethods.connectToSmb(
                    params.host, params.share, params.username, params.password
                  );
                  results[type] = { success: true, ...smbResult };
                } else if (type === 'mysql' && params.host) {
                  results[type] = { success: false, message: 'MySQL reconnection not implemented' };
                }
              } catch (err) {
                results[type] = { success: false, error: err.message };
              }
            }

            return {
              success: true,
              reconnectionResults: results,
              message: 'WebSocket reconnected successfully'
            };
          },

          isConnected: () => client.connected,
          getStatus: async () => sendRequest('status', null),

          // Domain methods (RCON, Query, SMB, MySQL)
          ...rconMethods,
          ...queryMethods,
          ...smbMethods,
          ...mysqlMethods,

          // Event handlers
          setOnConnected: (cb) => { client.onConnected = cb; },
          setOnDisconnected: (cb) => { client.onDisconnected = cb; },
          setOnError: (cb) => { client.onError = cb; },
          setOnReconnecting: (cb) => { client.onReconnecting = cb; }
        };
      }
    });
  } catch (err) {
    if (err.message && err.message.includes('Cannot bind an API on top of an existing property')) {
      agentWebSocketExposed = true;
      wsApiInitialized = true;
    } else {
      console.error('[PRELOAD] Error initializing WebSocket API:', err);
      agentWebSocketExposed = false;
      wsApiInitialized = false;
      setTimeout(() => initializeWebSocketAPI(contextBridge), 1000);
    }
  }

  if (!wsApiInitialized) wsApiInitialized = true;
  logWebSocketAPIState();
};

/**
 * Setup and initialize the WebSocket API with recovery mechanisms.
 * Registers DOMContentLoaded and load event listeners for verification.
 */
const setupWebSocketAPI = (contextBridge) => {
  initializeWebSocketAPI(contextBridge);

  // Safety timeout verification
  setTimeout(() => {
    logWebSocketAPIState();
    if (!wsApiInitialized || !agentWebSocketExposed) {
      initializeWebSocketAPI(contextBridge);
    }
  }, 1000);

  if (typeof window !== 'undefined') {
    // Expose recovery function for renderer
    window.__recoverWebSocketAPI = function() {
      return verifyAndRecoverWebSocketAPI(contextBridge, initializeWebSocketAPI);
    };

    window.addEventListener('DOMContentLoaded', () => {
      if (wsApiInitialized && agentWebSocketExposed) {
        setTimeout(() => verifyAndRecoverWebSocketAPI(contextBridge, initializeWebSocketAPI), 500);
        return;
      }
      initializeWebSocketAPI(contextBridge);
      setTimeout(() => verifyAndRecoverWebSocketAPI(contextBridge, initializeWebSocketAPI), 1000);
    });

    window.addEventListener('load', () => {
      setTimeout(() => verifyAndRecoverWebSocketAPI(contextBridge, initializeWebSocketAPI), 500);
    });
  }
};

module.exports = {
  initializeWebSocketAPI,
  verifyAndRecoverWebSocketAPI,
  setupWebSocketAPI,
  logWebSocketAPIState,
  DummySocketIO
};
