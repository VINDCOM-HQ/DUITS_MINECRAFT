/**
 * Socket.IO request handlers
 * Handles Socket.IO events and executes the appropriate services
 */
const rconService = require('../services/RconService');
const smbService = require('../services/SmbService');
const mysqlService = require('../services/MySqlService');
const queryService = require('../services/QueryService');

/**
 * Handle a Socket.IO request
 * @param {Object} data - The request data
 * @param {Function} callback - Optional callback function
 * @returns {Promise<Object>} The response data
 */
async function handleRequest(data, callback) {
  try {
    // Validate the request data
    if (!data || !data.action) {
      throw new Error('Invalid request: missing action');
    }
    
    // Check for other required fields
    const { id, action, type, params = {} } = data;
    
    // Track the client ID for each service
    const clientIds = {
      rcon: null,
      smb: null,
      mysql: null
    };
    
    // Determine the handler based on the action and type
    let response;
    
    switch (action) {
      case 'connect':
        response = await handleConnect(type, params);
        break;
        
      case 'command':
        response = await handleCommand(type, params);
        break;
        
      case 'disconnect':
        response = await handleDisconnect(type, params);
        break;
        
      case 'client/reconnect':
        response = await handleReconnect(type, params);
        break;
        
      case 'query':
        // Handle query action - works with both null and 'query' type
        if (type === null || type === 'query') {
          response = await handleQuery(params);
        } else {
          throw new Error(`Invalid type for query action: ${type}`);
        }
        break;
        
      case 'getConnectionParams':
        response = await handleGetConnectionParams(type, params);
        break;
        
      case 'status':
        response = await handleStatus();
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    // Return the response
    const result = {
      id,
      success: true,
      ...response
    };
    
    // If a callback is provided, use it
    if (typeof callback === 'function') {
      callback(result);
    }
    
    return result;
  } catch (err) {
    // Handle errors
    const error = {
      id: data?.id,
      success: false,
      error: err.message
    };
    
    // If a callback is provided, use it
    if (typeof callback === 'function') {
      callback(error);
    }
    
    return error;
  }
}

/**
 * Handle a connect request
 * @param {string} type - The connection type
 * @param {Object} params - The connection parameters
 * @returns {Promise<Object>} The response data
 */
async function handleConnect(type, params) {
  switch (type) {
    case 'rcon':
      const { host, port, password } = params;
      const clientId = await rconService.connect(host, port, password);
      return { clientId };
      
    case 'smb':
      const { host: smbHost, share, username, password: smbPassword, domain } = params;
      const smbClientId = await smbService.connect(smbHost, share, username, smbPassword, domain);
      return { clientId: smbClientId };
      
    case 'mysql':
      const mysqlClientId = await mysqlService.connect(params);
      return { clientId: mysqlClientId };
      
    default:
      throw new Error(`Unknown connection type: ${type}`);
  }
}

/**
 * Handle a command request
 * @param {string} type - The connection type
 * @param {Object} params - The command parameters
 * @returns {Promise<Object>} The response data
 */
async function handleCommand(type, params) {
  const { clientId } = params;
  
  // Validate clientId
  if (!clientId) {
    throw new Error('Missing clientId parameter');
  }
  
  switch (type) {
    case 'rcon':
      const { command } = params;
      
      // Validate command
      if (!command) {
        throw new Error('Missing command parameter');
      }
      
      const response = await rconService.executeCommand(clientId, command);
      return { response };
      
    case 'smb':
      const { operation, path, data, encoding } = params;
      
      // Validate operation
      if (!operation) {
        throw new Error('Missing operation parameter');
      }
      
      // Validate path
      if (path === undefined) {
        throw new Error('Missing path parameter');
      }
      
      // Execute the SMB operation
      switch (operation) {
        case 'readdir':
          const list = await smbService.readdir(clientId, path);
          return { list };
          
        case 'stat':
          const stats = await smbService.stat(clientId, path);
          return { stats };
          
        case 'readFile':
          const fileData = await smbService.readFile(clientId, path, encoding);
          
          // If data is a Buffer, convert it to base64
          if (Buffer.isBuffer(fileData)) {
            return {
              data: fileData.toString('base64'),
              encoding: 'base64'
            };
          }
          
          return { data: fileData };
          
        case 'writeFile':
          // Ensure data parameter is provided
          if (data === undefined) {
            throw new Error('Missing data parameter');
          }
          
          // If data is base64 encoded, decode it
          let fileContent = data;
          if (encoding === 'base64' && typeof data === 'string') {
            fileContent = Buffer.from(data, 'base64');
          }
          
          await smbService.writeFile(clientId, path, fileContent, encoding !== 'base64' ? encoding : undefined);
          return { success: true };
          
        case 'unlink':
          await smbService.unlink(clientId, path);
          return { success: true };
          
        default:
          throw new Error(`Unknown SMB operation: ${operation}`);
      }
      
    case 'mysql':
      const { sql, params: queryParams } = params;
      
      // Validate SQL
      if (!sql) {
        throw new Error('Missing sql parameter');
      }
      
      const result = await mysqlService.query(clientId, sql, queryParams);
      return { result };
      
    default:
      throw new Error(`Unknown command type: ${type}`);
  }
}

/**
 * Handle a disconnect request
 * @param {string} type - The connection type
 * @param {Object} params - The disconnect parameters
 * @returns {Promise<Object>} The response data
 */
async function handleDisconnect(type, params) {
  const { clientId } = params;
  
  // Validate clientId
  if (!clientId) {
    throw new Error('Missing clientId parameter');
  }
  
  switch (type) {
    case 'rcon':
      await rconService.disconnect(clientId);
      break;
      
    case 'smb':
      await smbService.disconnect(clientId);
      break;
      
    case 'mysql':
      await mysqlService.disconnect(clientId);
      break;
      
    default:
      throw new Error(`Unknown connection type: ${type}`);
  }
  
  return { success: true };
}

/**
 * Handle a reconnect request
 * @param {string} type - The connection type
 * @param {Object} params - The reconnect parameters
 * @returns {Promise<Object>} The response data
 */
async function handleReconnect(type, params) {
  const { clientId } = params;
  
  // Validate clientId
  if (!clientId) {
    throw new Error('Missing clientId parameter');
  }
  
  switch (type) {
    case 'rcon':
      const rconSuccess = await rconService.reconnect(clientId);
      return { success: rconSuccess };
      
    case 'smb':
      const smbSuccess = await smbService.reconnect(clientId);
      return { success: smbSuccess };
      
    case 'mysql':
      const mysqlSuccess = await mysqlService.reconnect(clientId);
      return { success: mysqlSuccess };
      
    default:
      throw new Error(`Unknown connection type: ${type}`);
  }
}

/**
 * Handle a query request
 * @param {Object} params - The query parameters
 * @returns {Promise<Object>} The response data
 */
async function handleQuery(params) {
  const { host, port, mode = 'basic', bypassCache = false, timeout = 25000 } = params;
  
  // Validate host
  if (!host) {
    throw new Error('Missing host parameter');
  }
  
  // Query protocol port is often different than the server port
  // Usually it's server port + 1 (e.g., if server is on 25565, query is on 25566)
  console.log(`[SOCKET] Handling query request for ${host}:${port} (mode: ${mode}, bypassCache: ${bypassCache}, timeout: ${timeout})`);
  
  // Log useful information about Minecraft Query protocol requirements
  console.log(`[SOCKET] ✓ Using proper Query protocol (0xFEFD) for Minecraft server query`);
  console.log(`[SOCKET] ℹ️ The Query protocol requires enable-query=true in server.properties`);
  
  // Warn if query port might be incorrect
  if (port === 25565) {
    console.warn(`[SOCKET] ⚠️ WARNING: Using default port 25565 for query which is typically the Minecraft SERVER port, not the QUERY port.`);
    console.warn(`[SOCKET] ⚠️ The query port is usually SERVER PORT + 1 (25566) and must be enabled in server.properties with query.port=25566`);
  } else {
    console.log(`[SOCKET] ✓ Using non-default port ${port} for query which appears to be intentional`);
  }
  
  // Log all parameters for debugging
  console.log('[SOCKET] Query parameters:', JSON.stringify(params, null, 2));
  
  try {
    // Set up a timeout for the query operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query operation timed out after ${timeout}ms`));
      }, timeout);
    });
    
    // Execute the query with a race against the timeout
    const info = await Promise.race([
      queryService.query(host, port, mode, bypassCache),
      timeoutPromise
    ]);
    
    console.log(`[SOCKET] Query successful for ${host}:${port}`);
    
    // Return sanitized result - ensure data is properly formatted
    const sanitizedInfo = {};
    
    // Just use the info object directly for most accurate results
    // The QueryClient already returns the right format
    console.log('[SOCKET] Query raw result:', JSON.stringify(info, null, 2));
    
    // No need to sanitize anymore - just preserve the structure exactly as it is
    if (typeof info === 'object' && info !== null) {
      // Keep the structure intact, only ensure plugins is an array if present
      console.log('[SOCKET] Returning raw query result');
      return { info: info };
    } else {
      // Fallback if info is not an object
      console.warn('[SOCKET] Query result is not an object:', typeof info);
      sanitizedInfo.hostname = 'Unknown';
      sanitizedInfo.version = 'Unknown';
      console.log('[SOCKET] Returning fallback query result');
      return { info: sanitizedInfo };
    }
  } catch (err) {
    console.error(`[SOCKET] Query failed for ${host}:${port}:`, err);
    throw new Error(`Query failed: ${err.message}`);
  }
}

/**
 * Handle a getConnectionParams request
 * @param {string} type - The connection type
 * @param {Object} params - The request parameters
 * @returns {Promise<Object>} The response data
 */
async function handleGetConnectionParams(type, params) {
  const { clientId } = params;
  
  // Validate clientId
  if (!clientId) {
    throw new Error('Missing clientId parameter');
  }
  
  switch (type) {
    case 'rcon':
      return rconService.getConnectionParams(clientId);
      
    case 'smb':
      return smbService.getConnectionParams(clientId);
      
    case 'mysql':
      const { password, ...safeParams } = mysqlService.getConnectionParams(clientId);
      return safeParams;
      
    default:
      throw new Error(`Unknown connection type: ${type}`);
  }
}

/**
 * Handle a status request
 * @returns {Promise<Object>} The response data
 */
async function handleStatus() {
  return {
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    platform: process.platform,
    arch: process.arch,
    nodejs: process.version,
    clients: {
      rcon: Array.from(rconService.clients.keys()),
      smb: Array.from(smbService.clients.keys()),
      mysql: Array.from(mysqlService.clients.keys())
    }
  };
}

module.exports = {
  handleRequest
};