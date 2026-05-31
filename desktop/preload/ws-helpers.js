/**
 * Shared helper functions for WebSocket API domain modules.
 * Handles path normalization, client ID resolution across
 * storage locations, and client ID lifecycle management.
 */

/**
 * Normalize a path argument to a string.
 * Handles objects with .path property, toString(), and fallbacks.
 * @param {*} p - Path to normalize
 * @returns {string}
 */
function normalizePath(p) {
  if (typeof p === 'string') return p;
  if (p && typeof p === 'object' && typeof p.path === 'string') return p.path;
  if (p && typeof p === 'object' && typeof p.toString === 'function') {
    const str = p.toString();
    if (str !== '[object Object]') return str;
  }
  const str = String(p || '');
  return str === '[object Object]' ? '' : str;
}

/**
 * Resolve a client ID for a connection type by searching all storage locations.
 * Searches: client.clientIds, global.wsClient, connectionManager,
 * global._wsClientData, and window storage (SMB only).
 * @param {object} client - The WebSocket client state object
 * @param {string} type - Connection type ('rcon', 'smb', 'mysql')
 * @returns {string|null} The client ID or null if not found
 */
function resolveClientId(client, type) {
  if (client.clientIds && client.clientIds[type]) {
    return client.clientIds[type];
  }

  if (typeof global !== 'undefined' && global.wsClient && global.wsClient.clientIds) {
    const id = global.wsClient.clientIds[type];
    if (id) {
      client.clientIds = client.clientIds || {};
      client.clientIds[type] = id;
      return id;
    }
  }

  try {
    const { connectionManager } = require('./connection-manager.js');
    const id = connectionManager.getClientId(type);
    if (id) {
      client.clientIds = client.clientIds || {};
      client.clientIds[type] = id;
      return id;
    }
  } catch (_) { /* connectionManager not available */ }

  if (typeof global !== 'undefined' && global._wsClientData && global._wsClientData.clientIds) {
    const id = global._wsClientData.clientIds[type];
    if (id) {
      client.clientIds = client.clientIds || {};
      client.clientIds[type] = id;
      return id;
    }
  }

  if (type === 'smb' && typeof window !== 'undefined' && window._smbConnectionData) {
    const id = window._smbConnectionData.clientId;
    if (id) {
      client.clientIds = client.clientIds || {};
      client.clientIds[type] = id;
      return id;
    }
  }

  return null;
}

/**
 * Clear a client ID from all storage locations.
 * @param {object} client - The WebSocket client state object
 * @param {string} type - Connection type ('rcon', 'smb', 'mysql')
 */
function clearClientId(client, type) {
  if (client.clientIds) client.clientIds[type] = null;

  if (typeof global !== 'undefined') {
    if (global.wsClient && global.wsClient.clientIds) {
      global.wsClient.clientIds[type] = null;
    }
    if (global._wsClientData && global._wsClientData.clientIds) {
      global._wsClientData.clientIds[type] = null;
    }
  }

  if (type === 'smb' && typeof window !== 'undefined' && window._smbConnectionData) {
    window._smbConnectionData.clientId = null;
    window._smbConnectionData.connected = false;
  }

  try {
    const { connectionManager } = require('./connection-manager.js');
    connectionManager.clearConnection(type);
  } catch (_) { /* connectionManager not available */ }
}

/**
 * Store a client ID and connection params in all storage locations.
 * @param {object} client - The WebSocket client state object
 * @param {string} type - Connection type ('rcon', 'smb', 'mysql')
 * @param {string} clientId - The client ID to store
 * @param {object} [params] - Connection parameters to persist for reconnection
 */
function storeClientId(client, type, clientId, params) {
  client.clientIds = client.clientIds || {};
  client.clientIds[type] = clientId;

  if (!client.connections) {
    client.connections = { rcon: null, smb: null, mysql: null };
  }
  if (params) client.connections[type] = params;

  if (typeof global !== 'undefined' && global._wsClientData) {
    global._wsClientData.clientIds = global._wsClientData.clientIds || {};
    global._wsClientData.clientIds[type] = clientId;
    if (params) {
      global._wsClientData.connections = global._wsClientData.connections || {};
      global._wsClientData.connections[type] = params;
    }
  }

  if (typeof global !== 'undefined' && global.wsClient) {
    global.wsClient.clientIds = global.wsClient.clientIds || {};
    global.wsClient.clientIds[type] = clientId;
  }

  try {
    const { connectionManager } = require('./connection-manager.js');
    connectionManager.setClientId(type, clientId);
    if (params) connectionManager.saveConnection(type, params);
  } catch (_) { /* connectionManager not available */ }

  if (type === 'smb' && typeof window !== 'undefined') {
    window._agentWebSocketClient = window._agentWebSocketClient || {};
    window._agentWebSocketClient.clientIds = window._agentWebSocketClient.clientIds || {};
    window._agentWebSocketClient.clientIds.smb = clientId;

    if (!window._smbConnectionData) window._smbConnectionData = {};
    window._smbConnectionData.clientId = clientId;
    window._smbConnectionData.connected = true;
    window._smbConnectionData.timestamp = Date.now();
    if (params) {
      const { password, ...safeParams } = params;
      window._smbConnectionData.details = safeParams;
    }
  }
}

/**
 * Check if an error indicates an invalid/expired client ID.
 * @param {Error} err
 * @returns {boolean}
 */
function isInvalidClientError(err) {
  const msg = err && err.message ? err.message : '';
  return msg.includes('Client not found') ||
         msg.includes('invalid clientId') ||
         msg.includes('Not connected');
}

/**
 * Get stored connection parameters for a type.
 * Searches client.connections and global._wsClientData.
 * @param {object} client - The WebSocket client state object
 * @param {string} type - Connection type
 * @returns {object|null}
 */
function getConnectionParams(client, type) {
  if (client.connections && client.connections[type]) {
    return client.connections[type];
  }
  if (typeof global !== 'undefined' && global._wsClientData &&
      global._wsClientData.connections && global._wsClientData.connections[type]) {
    return global._wsClientData.connections[type];
  }
  return null;
}

module.exports = {
  normalizePath,
  resolveClientId,
  clearClientId,
  storeClientId,
  isInvalidClientError,
  getConnectionParams
};
