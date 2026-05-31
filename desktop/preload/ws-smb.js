/**
 * SMB WebSocket methods factory.
 * Creates SMB file operation methods that operate
 * over a Socket.IO connection to the agent server.
 */
const {
  normalizePath,
  resolveClientId,
  clearClientId,
  storeClientId,
  isInvalidClientError
} = require('./ws-helpers');

/**
 * Execute an SMB command with automatic client ID resolution and error handling.
 * Shared by readdir, stat, readFile, writeFile, and unlink operations.
 * @param {object} client - WebSocket client state
 * @param {Function} sendRequest - Socket.IO request function
 * @param {string} operation - SMB operation name
 * @param {*} path - File/directory path (will be normalized)
 * @param {object} [extras={}] - Additional parameters (data, encoding, etc.)
 * @returns {Promise<*>} Operation result
 */
async function smbCommand(client, sendRequest, operation, path, extras = {}) {
  const normalizedPath = normalizePath(path);
  const clientId = resolveClientId(client, 'smb');
  if (!clientId) {
    throw new Error('Not connected to SMB share - please connect first');
  }

  try {
    return await sendRequest('command', 'smb', {
      clientId,
      operation,
      path: normalizedPath,
      ...extras
    });
  } catch (err) {
    if (isInvalidClientError(err)) clearClientId(client, 'smb');
    throw new Error(`Failed to ${operation}: ${err.message}`);
  }
}

/**
 * Create SMB methods bound to the given client state and transport.
 * @param {object} client - WebSocket client state
 * @param {Function} sendRequest - Function to send Socket.IO requests
 * @returns {object} SMB methods
 */
function createSmbMethods(client, sendRequest) {

  /**
   * Connect to an SMB share via the agent.
   * @param {string} host - SMB server host
   * @param {string} share - Share name
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<object>} Connection result with clientId
   */
  const connectToSmb = async (host, share, username, password) => {
    const result = await sendRequest('connect', 'smb', {
      host, share, username, password
    });

    if (!result || !result.clientId) {
      throw new Error('SMB connection failed: No clientId returned');
    }

    storeClientId(client, 'smb', result.clientId, {
      host, share, username, password
    });

    return {
      success: true,
      clientId: result.clientId,
      usingAgent: true,
      result
    };
  };

  /**
   * List directory contents on the SMB share.
   * @param {*} path - Directory path
   * @returns {Promise<Array>} Directory listing
   */
  const smbReaddir = async (path) => {
    const result = await smbCommand(client, sendRequest, 'readdir', path);
    if (result.list && Array.isArray(result.list)) return result.list;
    if (Array.isArray(result)) return result;
    return [];
  };

  /**
   * Get file/directory stat info from the SMB share.
   * @param {*} path - File path
   * @returns {Promise<object>} Stat result with isDirectory
   */
  const smbStat = async (path) => {
    const result = await smbCommand(client, sendRequest, 'stat', path);
    if (result.isDirectory !== undefined) return { isDirectory: result.isDirectory };
    if (result.stats && result.stats.isDirectory !== undefined) {
      return { isDirectory: result.stats.isDirectory };
    }
    return { isDirectory: false };
  };

  /**
   * Write a file to the SMB share.
   * @param {*} path - File path
   * @param {string|Buffer} data - File contents
   * @param {string} [encoding='utf8'] - Content encoding
   * @returns {Promise<*>} Write result
   */
  const smbWriteFile = async (path, data, encoding = 'utf8') => {
    if (data !== null && data !== undefined &&
        typeof data !== 'string' && !Buffer.isBuffer(data)) {
      data = String(data);
    }
    return await smbCommand(client, sendRequest, 'writeFile', path, {
      data, encoding
    });
  };

  /**
   * Read a file from the SMB share.
   * @param {*} path - File path
   * @param {string} [encoding='utf8'] - Content encoding
   * @returns {Promise<string|*>} File contents
   */
  const smbReadFile = async (path, encoding = 'utf8') => {
    const result = await smbCommand(client, sendRequest, 'readFile', path, {
      encoding
    });
    if (result && typeof result === 'object' && result.data !== undefined) {
      return result.data;
    }
    return result;
  };

  /**
   * Delete a file from the SMB share.
   * @param {*} path - File path
   * @returns {Promise<*>} Delete result
   */
  const smbUnlink = async (path) => {
    return await smbCommand(client, sendRequest, 'unlink', path);
  };

  /**
   * Disconnect from the SMB share.
   * @returns {Promise<object>} Disconnect result
   */
  const disconnectFromSmb = async () => {
    const clientId = resolveClientId(client, 'smb');
    if (!clientId) {
      return { success: true, message: 'Already disconnected' };
    }

    try {
      await sendRequest('disconnect', 'smb', { clientId });
      clearClientId(client, 'smb');
      return { success: true };
    } catch (err) {
      clearClientId(client, 'smb');
      throw new Error(`Failed to disconnect from SMB: ${err.message}`);
    }
  };

  return {
    connectToSmb,
    smbReaddir,
    smbStat,
    smbWriteFile,
    smbReadFile,
    smbUnlink,
    disconnectFromSmb
  };
}

module.exports = { createSmbMethods };
