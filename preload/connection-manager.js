// Connection Manager Module
const { ipcRenderer } = require('electron');

// Connection state constants
const CONNECTION_STATE = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error'
};

// Create a raw agent function that doesn't use the connection manager
// Used internally by the connection manager for reconnection
function createRawAgentFunction(method, endpoint, transformRequest) {
  return async (...args) => {
    // Get current agent settings
    const agentCfg = await ipcRenderer.invoke('config-getAgentSettings');
    
    if (!agentCfg.enabled) {
      throw new Error('Agent relay is disabled');
    }
    
    try {
      // Transform request data based on method and endpoint
      let reqData = null;
      if (transformRequest) {
        reqData = transformRequest(...args);
      } else if (args.length > 0) {
        reqData = args[0];
      }
      
      // Execute the request via IPC to main process
      const response = await ipcRenderer.invoke('agent-proxy-request', {
        method,
        url: `${agentCfg.url.replace(/\/$/, '')}${endpoint}`,
        data: reqData,
        useSSL: agentCfg.useSSL,
        apiKey: agentCfg.apiKey,
        caFile: agentCfg.caFile
      });
      
      return response;
    } catch (err) {
      console.error(`Raw agent relay error (${endpoint}):`, err);
      throw err;
    }
  };
}

// Connection manager for client sessions
const connectionManager = {
  // Connection state tracking
  state: CONNECTION_STATE.DISCONNECTED,
  clientIds: {
    rcon: null,
    smb: null,
    mysql: null
  },
  
  // Connection parameters storage for each connection type
  connections: {
    rcon: null,
    smb: null,
    mysql: null
  },
  
  // Health monitor settings
  healthCheck: {
    interval: null,
    intervalMs: 15000, // Check connection every 15 seconds (reduced from 30s)
    failCount: 0,
    maxFails: 3
  },
  
  // Last operation timestamp to track activity
  lastActivity: Date.now(),
  
  // Connection management functions
  setClientId: function(type, clientId) {
    if (!clientId) {
      console.warn(`[CONNECTION] Invalid ${type} clientId provided`);
      return false;
    }
    
    this.clientIds[type] = clientId;
    this.state = CONNECTION_STATE.CONNECTED;
    this.healthCheck.failCount = 0;
    this.lastActivity = Date.now();
    
    // Start health monitoring if not already running
    this._startHealthMonitor();
    
    console.log(`[CONNECTION] Registered ${type} client ID: ${clientId}`);
    return true;
  },
  
  getClientId: function(type) {
    return this.clientIds[type];
  },
  
  saveConnection: function(type, params) {
    this.connections[type] = params;
    console.log(`[CONNECTION] Saved ${type} connection parameters`);
  },
  
  clearConnection: function(type) {
    this.clientIds[type] = null;
    console.log(`[CONNECTION] Cleared ${type} clientId`);
  },
  
  // Health monitoring to detect stale connections
  _startHealthMonitor: function() {
    // Only start if not already running
    if (this.healthCheck.interval === null) {
      console.log('[CONNECTION] Starting connection health monitor');
      
      this.healthCheck.interval = setInterval(() => {
        this._checkConnectionHealth();
      }, this.healthCheck.intervalMs);
    }
  },
  
  _stopHealthMonitor: function() {
    if (this.healthCheck.interval !== null) {
      clearInterval(this.healthCheck.interval);
      this.healthCheck.interval = null;
      console.log('[CONNECTION] Stopped connection health monitor');
    }
  },
  
  _checkConnectionHealth: async function() {
    // Only check health if we have active connections
    if (Object.values(this.clientIds).some(id => id !== null)) {
      try {
        // Skip health check if there was recent activity
        const inactiveTime = Date.now() - this.lastActivity;
        if (inactiveTime < this.healthCheck.intervalMs) {
          console.log(`[CONNECTION] Skipping health check - recent activity ${Math.round(inactiveTime/1000)}s ago`);
          return;
        }
        
        console.log('[CONNECTION] Performing connection health check');
        
        // Get agent settings
        const agentCfg = await ipcRenderer.invoke('config-getAgentSettings');
        
        if (!agentCfg.enabled) {
          console.log('[CONNECTION] Agent disabled, skipping health check');
          return;
        }
        
        // Call the health endpoint to check connection
        // Use HTTP/HTTPS URL format for agent-proxy-request compatibility
        let healthUrl = agentCfg.url.replace(/\/$/, '');
        
        // Ensure we're using HTTP URL for health checks, not WebSocket
        if (healthUrl.startsWith('ws://')) {
          healthUrl = healthUrl.replace('ws://', 'http://');
        } else if (healthUrl.startsWith('wss://')) {
          healthUrl = healthUrl.replace('wss://', 'https://');
        } else if (!healthUrl.startsWith('http://') && !healthUrl.startsWith('https://')) {
          // Add http:// if no protocol specified
          healthUrl = 'http://' + healthUrl;
        }
        
        try {
          // Define all possible health check endpoints to try in order
          const healthEndpoints = [
            '/health',           // Main unauthenticated health endpoint
            '/api/health',       // Authenticated API health endpoint
            '/',                 // Root endpoint fallback
            '/api'               // API root endpoint fallback
          ];
          
          let allEndpointsFailed = true;
          
          // Try each endpoint in sequence
          for (const endpoint of healthEndpoints) {
            try {
              console.log(`[CONNECTION] Checking endpoint: ${endpoint}`);
              
              const response = await ipcRenderer.invoke('agent-proxy-request', {
                method: 'GET',
                url: `${healthUrl}${endpoint}`,
                data: null,
                apiKey: agentCfg.apiKey,
                useSSL: healthUrl.startsWith('https://') || healthUrl.startsWith('wss://'),
                caFile: agentCfg.caFile,
                timeout: 5000 // Short timeout for health checks
              });
              
              // Consider any valid response a success
              if (response && (response.status === 'ok' || response.success === true)) {
                console.log(`[CONNECTION] Health check successful via ${endpoint}`);
                this.healthCheck.failCount = 0;
                allEndpointsFailed = false;
                break; // Exit the loop on success
              } else {
                console.log(`[CONNECTION] Endpoint ${endpoint} responded but status check failed:`, response);
                // Continue to try other endpoints
              }
            } catch (endpointErr) {
              console.log(`[CONNECTION] Endpoint ${endpoint} check failed:`, endpointErr.message);
              // Continue to try other endpoints
            }
          }
          
          // Only increment fail count if all endpoints failed
          if (allEndpointsFailed) {
            console.error('[CONNECTION] All health endpoints failed');
            this.healthCheck.failCount++;
            console.log('[CONNECTION] Agent server appears to be unavailable - fail count now:', this.healthCheck.failCount);
          }
        } catch (requestErr) {
          // Outer try/catch for any unexpected errors in our health check logic
          console.error('[CONNECTION] Health check error:', requestErr.message);
          this.healthCheck.failCount++;
        }
        
        // After max failures, try to reconnect, but with proper backoff pattern
        if (this.healthCheck.failCount >= this.healthCheck.maxFails) {
          // Calculate time since last reconnect attempt to avoid excessive attempts
          const lastReconnectTime = global._wsClientData?.connectionState?.lastReconnectTime || 0;
          const timeSinceLastReconnect = Date.now() - lastReconnectTime;
          const minReconnectInterval = 60000; // Min 60 seconds between reconnect attempts
          
          if (timeSinceLastReconnect > minReconnectInterval) {
            console.warn(`[CONNECTION] ${this.healthCheck.failCount} consecutive health check failures, attempting reconnect`);
            
            // Update reconnect time before attempt
            if (global._wsClientData?.connectionState) {
              global._wsClientData.connectionState.lastReconnectTime = Date.now();
            }
            
            try {
              await this.reconnectAll();
              // Reset fail count only on successful reconnect
              this.healthCheck.failCount = 0;
            } catch (reconnectErr) {
              console.error('[CONNECTION] Reconnect failed:', reconnectErr.message);
              // Don't reset fail count on error, but don't increment either
            }
          } else {
            console.log(`[CONNECTION] Skipping reconnect attempt - last attempt was ${Math.round(timeSinceLastReconnect/1000)}s ago`);
          }
        }
      } catch (err) {
        console.error('[CONNECTION] Health check process failed:', err.message);
        // Don't increment fail count for operational errors
      }
    } else {
      // No active connections, stop the health monitor
      this._stopHealthMonitor();
    }
  },
  
  // Reconnection functionality with enhanced reliability
  reconnect: async function(type) {
    // Only attempt reconnect if we have saved connection parameters
    if (!this.connections[type]) {
      console.error(`[CONNECTION] No saved ${type} connection parameters for reconnect`);
      return false;
    }
    
    console.log(`[CONNECTION] Attempting to reconnect ${type} client`);
    this.state = CONNECTION_STATE.RECONNECTING;
    
    // First, try to clean up the existing connection if possible
    if (this.clientIds[type]) {
      try {
        // Try to explicitly disconnect the previous connection
        switch (type) {
          case 'rcon':
            const rconDisconnect = createRawAgentFunction(
              'POST',
              '/rcon/disconnect',
              (clientId) => ({ clientId })
            );
            await rconDisconnect(this.clientIds[type]);
            break;
          
          case 'smb':
            const smbDisconnect = createRawAgentFunction(
              'POST',
              '/smb/disconnect',
              (clientId) => ({ clientId })
            );
            await smbDisconnect(this.clientIds[type]);
            break;
            
          case 'mysql':
            const mysqlDisconnect = createRawAgentFunction(
              'POST',
              '/mysql/disconnect',
              (clientId) => ({ clientId })
            );
            await mysqlDisconnect(this.clientIds[type]);
            break;
        }
        console.log(`[CONNECTION] Successfully disconnected previous ${type} client before reconnect`);
      } catch (cleanupErr) {
        // Ignore cleanup errors - it may already be disconnected
        console.log(`[CONNECTION] Cleanup error (expected): ${cleanupErr.message}`);
      }
    }
    
    // Small delay to ensure server has time to clean up
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      let result;
      
      switch (type) {
        case 'rcon':
          // Create a fresh RCON connect function
          const rconConnect = createRawAgentFunction(
            'POST', 
            '/rcon/connect',
            (host, port, password) => ({ host, port, password })
          );
          
          // Reconnect with saved params
          const { host, port, password } = this.connections.rcon;
          result = await rconConnect(host, port, password);
          break;
          
        case 'smb':
          const smbConnect = createRawAgentFunction(
            'POST', 
            '/smb/connect',
            (host, share, username, password) => ({ host, share, username, password })
          );
          
          const smbParams = this.connections.smb;
          result = await smbConnect(smbParams.host, smbParams.share, smbParams.username, smbParams.password);
          break;
          
        case 'mysql':
          const mysqlConnect = createRawAgentFunction(
            'POST', 
            '/mysql/connect',
            (host, port, user, password, database, ssl) => ({ host, port, user, password, database, ssl })
          );
          
          const mysqlParams = this.connections.mysql;
          result = await mysqlConnect(
            mysqlParams.host, 
            mysqlParams.port, 
            mysqlParams.user, 
            mysqlParams.password, 
            mysqlParams.database, 
            mysqlParams.ssl
          );
          break;
          
        default:
          throw new Error(`Unsupported connection type: ${type}`);
      }
      
      if (result && result.clientId) {
        // Update the client ID with the new one
        this.setClientId(type, result.clientId);
        console.log(`[CONNECTION] Successfully reconnected ${type} client with ID ${result.clientId}`);
        
        // Reset health check failures on successful reconnect
        this.healthCheck.failCount = 0;
        this.lastActivity = Date.now();
        
        return true;
      } else {
        console.error(`[CONNECTION] Reconnect for ${type} did not return a valid clientId`);
        return false;
      }
    } catch (err) {
      console.error(`[CONNECTION] Failed to reconnect ${type} client:`, err.message);
      this.state = CONNECTION_STATE.ERROR;
      return false;
    }
  },
  
  reconnectAll: async function() {
    // Try to reconnect all saved connections
    let success = true;
    
    for (const type of Object.keys(this.connections)) {
      if (this.connections[type] !== null) {
        const reconnectSuccess = await this.reconnect(type);
        success = success && reconnectSuccess;
      }
    }
    
    return success;
  }
};

module.exports = {
  CONNECTION_STATE,
  connectionManager,
  createRawAgentFunction
};