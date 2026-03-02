/**
 * Socket.IO client for the Minecraft RCON agent
 * Provides a persistent connection to the agent server
 */
// ALWAYS use direct require for maximum reliability
// This avoids any dependency on window object or global variables
const SocketIOModule = require('socket.io-client');

class AgentSocketIOClient {
  constructor(url, apiKey) {
    this.url = url;
    this.apiKey = apiKey;
    this.ws = null; // We'll keep the .ws name for compatibility with existing code
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.autoReconnect = true;
    
    // Event callbacks
    this.onConnected = null;
    this.onDisconnected = null;
    this.onError = null;
    this.onReconnecting = null;
    
    // Client IDs for different connection types
    this.clientIds = {
      rcon: null,
      smb: null,
      mysql: null
    };
    
    console.log('[Socket.IO] AgentSocketIOClient initialized');
  }
  
  // Setter methods for event callbacks
  setOnConnected(callback) {
    if (typeof callback === 'function') {
      this.onConnected = callback;
    }
  }
  
  setOnDisconnected(callback) {
    if (typeof callback === 'function') {
      this.onDisconnected = callback;
    }
  }
  
  setOnError(callback) {
    if (typeof callback === 'function') {
      this.onError = callback;
    }
  }
  
  setOnReconnecting(callback) {
    if (typeof callback === 'function') {
      this.onReconnecting = callback;
    }
  }
  
  /**
   * Connect to the agent Socket.IO server
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      // Already connected
      if (this.ws?.connected) {
        console.log('[Socket.IO] Already connected, reusing connection');
        resolve();
        return;
      }
      
      // Ensure we have proper URL format for Socket.IO
      let wsUrl = this.url;
      
      // If URL doesn't have a protocol, add http://
      if (!wsUrl.includes('://')) {
        wsUrl = 'http://' + wsUrl;
        console.log('[Socket.IO] Adding protocol to URL:', wsUrl);
      }
      
      // No need to convert HTTP to WS for Socket.IO - it handles this internally
      
      // Create headers object for API key if provided
      const headers = {};
      if (this.apiKey) {
        headers['X-API-Key'] = this.apiKey;
      }
      
      console.log(`[Socket.IO] Connecting to ${wsUrl}`);
      
      // Check if we need to load a CA file for custom certificate validation
      const isSecure = wsUrl.startsWith('wss://');
      let ca = null;
      
      if (isSecure) {
        try {
          // Check if we have a CA file configured
          // Try to access from electron store or configuration
          const electron = require('electron');
          if (electron && electron.remote) {
            const configModule = electron.remote.require('./lib/config.js');
            const agentSettings = configModule.getAgentSettings();
            
            if (agentSettings && agentSettings.caFile) {
              const fs = require('fs');
              ca = fs.readFileSync(agentSettings.caFile);
              console.log(`[Socket.IO] Loaded CA certificate from ${agentSettings.caFile}`);
            }
          }
        } catch (caErr) {
          console.warn('[Socket.IO] Failed to load CA certificate, using system CA store:', caErr);
        }
      }
      
      // Create Socket.IO connection with robust options
      const options = { 
        autoConnect: true,
        reconnection: true, // Let Socket.IO handle basic reconnection
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        timeout: 15000,      // 15 second connection timeout
        query: this.apiKey ? { apiKey: this.apiKey } : {}, // Pass API key in query params
        extraHeaders: this.apiKey ? { 'X-API-Key': this.apiKey } : {}, // Also include it in headers
        transports: ['websocket', 'polling'], // Allow both transports for maximum compatibility
        rejectUnauthorized: isSecure, // Always validate certs when using SSL
        // Add CA if provided and using SSL
        ...(ca && isSecure ? { ca } : {}),
        forceNew: true // Create a new connection every time to avoid stale connections
      };
      
      console.log('[Socket.IO] Connecting with options:', {
        ...options,
        query: options.query ? 'apiKey=[REDACTED]' : {},
        extraHeaders: options.extraHeaders ? 'X-API-Key=[REDACTED]' : {}
      });
      
      // Create Socket.IO connection using direct module reference
      this.ws = SocketIOModule(wsUrl, options);
      
      // Connection timeout handler
      const connectionTimeout = setTimeout(() => {
        if (this.ws && !this.ws.connected) {
          console.log('[Socket.IO] Connection attempt timed out');
          this.ws.close();
          reject(new Error('Socket.IO connection timed out'));
        }
      }, 10000); // 10 second connection timeout
      
      // Handle Socket.IO events
      this.ws.on('connect', () => {
        clearTimeout(connectionTimeout);
        this.connected = true;
        this.reconnectAttempts = 0;
        console.log(`[Socket.IO] Connected to ${wsUrl}`);
        if (this.onConnected) this.onConnected();
        resolve();
      });
      
      this.ws.on('disconnect', (reason) => {
        clearTimeout(connectionTimeout);
        const wasConnected = this.connected;
        this.connected = false;
        console.log(`[Socket.IO] Disconnected from ${wsUrl} (reason: ${reason || 'none'})`);
        
        if (this.onDisconnected) this.onDisconnected();
        
        // Auto-reconnect logic with improved backoff
        if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          // More aggressive exponential backoff with jitter
          const baseDelay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
          // Add jitter to prevent reconnection storms (±20%)
          const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
          const delay = Math.min(baseDelay + jitter, 30000); // Cap at 30 seconds
          
          console.log(`[Socket.IO] Will attempt to reconnect in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          
          setTimeout(() => {
            console.log(`[Socket.IO] Attempting reconnection #${this.reconnectAttempts}`);
            this.connect().then(() => {
              console.log('[Socket.IO] Reconnected successfully');
              
              // Retry any pending requests
              this._retryPendingRequests();
              
              // Attempt to recover RCON connections if we have client IDs
              if (this.clientIds.rcon) {
                this._recoverRconConnection();
              }
            }).catch(err => {
              console.error('[Socket.IO] Reconnect failed:', err);
              
              // If this was the last attempt, notify all pending requests
              if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this._rejectAllPending(new Error(`Socket.IO reconnection failed after ${this.maxReconnectAttempts} attempts`));
              }
            });
          }, delay);
        } else if (wasConnected || this.reconnectAttempts >= this.maxReconnectAttempts) {
          // Reject all pending requests on permanent disconnection
          this._rejectAllPending(new Error('Socket.IO disconnected and max reconnection attempts reached'));
        }
      });
      
      this.ws.on('connect_error', (error) => {
        console.error('[Socket.IO] Connection error:', error);
        if (this.onError) this.onError(error);
        // Don't reject here - let disconnect event handle it
      });
      
      this.ws.on('response', (data) => {
        try {
          // Socket.IO automatically parses JSON, so we don't need to parse it
          const { id, success, error, ...result } = data;
          
          // Find and resolve/reject the pending request
          if (this.pendingRequests.has(id)) {
            const { resolve, reject } = this.pendingRequests.get(id);
            
            if (success) {
              resolve(result);
            } else {
              reject(new Error(error || 'Unknown error'));
            }
            
            this.pendingRequests.delete(id);
          }
        } catch (err) {
          console.error('[Socket.IO] Error processing response:', err);
        }
      });
    });
  }
  
  /**
   * Explicit reconnect method that users can call
   * @returns {Promise<boolean>} True if reconnection was successful
   */
  async reconnect() {
    console.log('[Socket.IO] Explicit reconnection requested');
    
    // Close existing connection first
    if (this.ws) {
      try {
        // Mark this as a reconnect attempt to enable auto-reconnect
        this.autoReconnect = true;
        
        // Log the current connection state
        console.log(`[Socket.IO] Current connection state: ${this.ws.connected ? 'connected' : 'disconnected'}`);
        
        // Store the client IDs before closing
        const savedClientIds = { ...this.clientIds };
        
        // Disconnect the Socket.IO connection
        this.ws.disconnect();
        this.ws = null;
        this.connected = false;
        
        // Wait a moment for the close to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Restore client IDs - we'll try to recover them
        this.clientIds = savedClientIds;
      } catch (err) {
        console.error('[Socket.IO] Error closing connection:', err);
        // Continue with reconnection anyway
      }
    }
    
    // Reset attempts to ensure we get full attempts
    this.reconnectAttempts = 0;
    
    try {
      // Establish a new connection
      await this.connect();
      console.log('[Socket.IO] Socket.IO reconnected successfully');
      
      // Recover active connections if we have client IDs
      const reconnectPromises = [];
      
      if (this.clientIds.rcon) {
        reconnectPromises.push(this._recoverRconConnection());
      }
      
      if (this.clientIds.smb) {
        reconnectPromises.push(this._recoverSmbConnection());
      }
      
      if (this.clientIds.mysql) {
        reconnectPromises.push(this._recoverMysqlConnection());
      }
      
      // Wait for all recovery attempts to complete
      if (reconnectPromises.length > 0) {
        await Promise.allSettled(reconnectPromises);
      }
      
      return true;
    } catch (err) {
      console.error('[Socket.IO] Reconnection failed:', err);
      return false;
    }
  }
  
  /**
   * Attempt to recover an RCON connection after Socket.IO reconnection
   * @private
   * @returns {Promise<boolean>} True if recovery was successful
   */
  async _recoverRconConnection() {
    if (!this.clientIds.rcon) return false;
    
    try {
      // First, check if the RCON client still exists on the server
      console.log(`[Socket.IO] Checking status of RCON client ${this.clientIds.rcon}`);
      
      // Store the client ID for recovery attempts
      const oldClientId = this.clientIds.rcon;
      
      // Try to retrieve the connection parameters
      let connectionParams = null;
      try {
        // Use our dedicated method to get connection parameters
        connectionParams = await this.getConnectionParams('rcon', {
          clientId: oldClientId
        });
        
        if (connectionParams && connectionParams.host && connectionParams.port) {
          console.log(`[Socket.IO] Retrieved connection parameters for RCON: ${connectionParams.host}:${connectionParams.port}`);
        }
      } catch (paramsErr) {
        console.warn(`[Socket.IO] Unable to retrieve connection parameters: ${paramsErr.message}`);
        // Continue with reconnection anyway - we might still be able to recover
      }
      
      // Try to send a harmless command to check connection
      try {
        console.log(`[Socket.IO] Testing existing RCON connection with client ID ${oldClientId}`);
        const result = await this.sendRequest('command', 'rcon', {
          clientId: oldClientId,
          command: 'list'
        });
        
        console.log(`[Socket.IO] RCON client ${oldClientId} is still valid`);
        return true; // Connection is still good, no need to recover
      } catch (cmdErr) {
        // Check if the error indicates the client is disconnected
        const isDisconnectedError = 
          cmdErr.message.includes('Not connected') || 
          cmdErr.message.includes('Client disconnected') ||
          cmdErr.message.includes('Client not found') ||
          cmdErr.message.includes('invalid clientId');
          
        if (!isDisconnectedError) {
          console.log(`[Socket.IO] RCON command failed but not due to disconnection: ${cmdErr.message}`);
          return false; // Some other error, not a disconnection
        }
        
        // The client ID is invalid, try to reconnect
        console.log(`[Socket.IO] RCON client ${oldClientId} is disconnected`);
        
        // Try explicit reconnection first if the client ID might be recoverable
        if (!cmdErr.message.includes('Client not found') && !cmdErr.message.includes('invalid clientId')) {
          try {
            // Request explicit reconnection from the agent
            console.log(`[Socket.IO] Requesting reconnection for RCON client ${oldClientId}`);
            await this.sendRequest('client/reconnect', 'rcon', {
              clientId: oldClientId
            });
            console.log(`[Socket.IO] Successfully requested RCON client reconnection`);
            
            // Verify the reconnection worked with a quick command
            try {
              await this.sendRequest('command', 'rcon', {
                clientId: oldClientId,
                command: 'list'
              });
              console.log(`[Socket.IO] RCON reconnection successful`);
              return true;
            } catch (verifyErr) {
              console.error(`[Socket.IO] RCON reconnection verification failed: ${verifyErr.message}`);
              // Fall through to full reconnection
            }
          } catch (reconnectErr) {
            console.error(`[Socket.IO] RCON reconnection request failed: ${reconnectErr.message}`);
            // Fall through to full reconnection
          }
        }
        
        // If we have connection parameters, try a full reconnection
        if (connectionParams && connectionParams.host && connectionParams.port && connectionParams.password) {
          try {
            console.log(`[Socket.IO] Attempting full RCON reconnection to ${connectionParams.host}:${connectionParams.port}`);
            
            // Clear the old client ID first
            this.clientIds.rcon = null;
            
            // Create a new connection
            const newClientId = await this.connectToRcon(
              connectionParams.host,
              connectionParams.port,
              connectionParams.password
            );
            
            console.log(`[Socket.IO] Successfully recreated RCON connection with new client ID: ${newClientId}`);
            return true;
          } catch (reconnErr) {
            console.error(`[Socket.IO] Full RCON reconnection failed: ${reconnErr.message}`);
            
            // Clear the client ID to force a new connection next time
            this.clientIds.rcon = null;
            return false;
          }
        } else {
          // Try to get connection parameters without a specific client ID
          try {
            console.log(`[Socket.IO] Attempting to get most recent RCON connection parameters`);
            connectionParams = await this.getConnectionParams('rcon', {});
            
            if (connectionParams && connectionParams.host && connectionParams.port && connectionParams.password) {
              console.log(`[Socket.IO] Found alternative RCON connection parameters for ${connectionParams.host}:${connectionParams.port}`);
              
              // Clear the old client ID
              this.clientIds.rcon = null;
              
              // Create a new connection with the recovered parameters
              const newClientId = await this.connectToRcon(
                connectionParams.host,
                connectionParams.port,
                connectionParams.password
              );
              
              console.log(`[Socket.IO] Successfully recreated RCON connection with new client ID: ${newClientId}`);
              return true;
            } else {
              throw new Error('Incomplete connection parameters');
            }
          } catch (altParamsErr) {
            console.error(`[Socket.IO] Failed to get alternative connection parameters: ${altParamsErr.message}`);
            
            // We don't have connection parameters for a full reconnect
            console.warn(`[Socket.IO] No valid connection parameters available for full RCON reconnection`);
            
            // Clear the client ID to force a new connection next time
            this.clientIds.rcon = null;
            return false;
          }
        }
      }
    } catch (err) {
      console.error(`[Socket.IO] RCON recovery failed: ${err.message}`);
      this.clientIds.rcon = null; // Clear the client ID on error
      return false;
    }
  }
  
  /**
   * Attempt to recover an SMB connection after Socket.IO reconnection
   * @private
   * @returns {Promise<boolean>} True if recovery was successful
   */
  async _recoverSmbConnection() {
    // Implementation similar to _recoverRconConnection but for SMB
    // We'll stub this for now as the current issue is focused on RCON
    if (!this.clientIds.smb) return false;
    
    console.log(`[Socket.IO] SMB connection recovery not yet implemented`);
    return false;
  }
  
  /**
   * Attempt to recover a MySQL connection after Socket.IO reconnection
   * @private
   * @returns {Promise<boolean>} True if recovery was successful
   */
  async _recoverMysqlConnection() {
    // Implementation similar to _recoverRconConnection but for MySQL
    // We'll stub this for now as the current issue is focused on RCON
    if (!this.clientIds.mysql) return false;
    
    console.log(`[Socket.IO] MySQL connection recovery not yet implemented`);
    return false;
  }
  
  /**
   * Close the Socket.IO connection
   */
  close() {
    if (this.ws) {
      // Prevent auto-reconnect on explicit close
      this.autoReconnect = false;
      
      // Close the connection
      this.ws.disconnect();
      this.ws = null;
      this.connected = false;
      
      // Reject all pending requests
      this._rejectAllPending(new Error('Socket.IO disconnected by user'));
    }
  }
  
  /**
   * Send a request to the agent
   * @param {string} action - Action to perform (connect, command, etc.)
   * @param {string} type - Connection type (rcon, smb, mysql)
   * @param {object} params - Parameters for the action
   * @param {number} [retryCount=0] - Current retry count
   * @returns {Promise<any>} - Response from the agent
   */
  async sendRequest(action, type, params = {}, retryCount = 0) {
    // Max retries for transient errors
    const MAX_RETRIES = 3;
    
    // Auto-connect if not connected
    if (!this.connected) {
      try {
        await this.connect();
      } catch (connectErr) {
        // If we can't connect and have retries left, attempt retry with backoff
        if (retryCount < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          console.log(`[Socket.IO] Connect failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(this.sendRequest(action, type, params, retryCount + 1));
            }, delay);
          });
        }
        throw connectErr;
      }
    }
    
    return new Promise((resolve, reject) => {
      // Generate a unique message ID
      const id = this._generateMessageId();
      
      // Store the promise callbacks
      this.pendingRequests.set(id, { 
        resolve, 
        reject,
        request: { action, type, params } // Save request for potential retry
      });
      
      // Create the message
      const message = {
        id,
        action,
        type,
        params
      };
      
      // Send the message
      try {
        if (!this.ws || !this.ws.connected) {
          throw new Error('Socket.IO is not connected');
        }
        
        // Socket.IO uses emit instead of send and automatically handles JSON serialization
        this.ws.emit('request', message);
      } catch (err) {
        // Remove the pending request
        this.pendingRequests.delete(id);
        
        // For transient errors, retry the request if we haven't exceeded max retries
        if (retryCount < MAX_RETRIES && 
            (err.message.includes('not connected') || 
             err.message.includes('TIMEOUT') || 
             err.message.includes('failed to emit'))) {
          
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          console.log(`[Socket.IO] Send failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES}): ${err.message}`);
          
          // Wait a bit and retry
          setTimeout(() => {
            this.sendRequest(action, type, params, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, delay);
          return;
        }
        
        reject(new Error(`Failed to send Socket.IO message: ${err.message}`));
        return;
      }
      
      // Set a timeout for the request - increase timeout for longer operations
      const timeout = (action === 'connect' || action === 'command') ? 45000 : 30000;
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          
          // For timeouts, retry the request if we haven't exceeded max retries
          if (retryCount < MAX_RETRIES) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
            console.log(`[Socket.IO] Request timed out, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            
            // Wait a bit and retry
            setTimeout(() => {
              this.sendRequest(action, type, params, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, delay);
            return;
          }
          
          reject(new Error(`Socket.IO request timed out after ${timeout/1000} seconds`));
        }
      }, timeout);
    });
  }
  
  /**
   * Request connection parameters from the agent for a specific client type and ID
   * @param {string} type - Connection type (rcon, smb, mysql)
   * @param {object} params - Parameters for the request, including optional clientId
   * @returns {Promise<object>} - Connection parameters if available
   */
  async getConnectionParams(type, params = {}) {
    try {
      console.log(`[Socket.IO] Requesting connection parameters for ${type}${params.clientId ? ` client ${params.clientId}` : ''}`);
      
      const result = await this.sendRequest('getConnectionParams', type, params);
      
      if (result && Object.keys(result).length > 0) {
        console.log(`[Socket.IO] Retrieved connection parameters for ${type}`);
        return result;
      } else {
        throw new Error('Empty or invalid connection parameters received');
      }
    } catch (err) {
      console.error(`[Socket.IO] Failed to get connection parameters: ${err.message}`);
      throw err;
    }
  }
  
  /**
   * Generate a unique message ID
   * @returns {number} Message ID
   * @private
   */
  _generateMessageId() {
    return this.messageId++;
  }
  
  /**
   * Reject all pending requests
   * @param {Error} error - Error to reject with
   * @private
   */
  _rejectAllPending(error) {
    for (const [id, { reject }] of this.pendingRequests.entries()) {
      reject(error);
      this.pendingRequests.delete(id);
    }
  }
  
  /**
   * Retry all pending requests after reconnection
   * @private
   */
  _retryPendingRequests() {
    const requests = Array.from(this.pendingRequests.entries());
    
    // Clear pending requests
    this.pendingRequests.clear();
    
    // Retry each request
    for (const [id, { resolve, reject, request }] of requests) {
      if (request) {
        this.sendRequest(request.action, request.type, request.params)
          .then(resolve)
          .catch(reject);
      }
    }
  }
  
  // ---- RCON Methods ----
  
  /**
   * Connect to RCON server
   * @param {string} host - RCON server host
   * @param {number} port - RCON server port
   * @param {string} password - RCON server password
   * @returns {Promise<string>} - Client ID
   */
  async connectToRcon(host, port, password) {
    try {
      const result = await this.sendRequest('connect', 'rcon', { host, port, password });
      
      // Store the client ID
      if (result.clientId) {
        this.clientIds.rcon = result.clientId;
      }
      
      return result.clientId;
    } catch (err) {
      console.error('[Socket.IO] RCON connect error:', err);
      throw err;
    }
  }
  
  /**
   * Execute RCON command
   * @param {string} command - Command to execute
   * @param {number} [maxRetries=2] - Maximum number of retries for this command
   * @returns {Promise<string>} - Command response
   */
  async rconCommand(command, maxRetries = 2) {
    // Ensure we have a client ID
    if (!this.clientIds.rcon) {
      // If we're being asked for a command but don't have an RCON client ID,
      // and we're not explicitly trying to connect, something is wrong
      throw new Error('Not connected to RCON server');
    }
    
    let lastError = null;
    let connectionParams = null;
    
    // Implement command-specific retry logic with full reconnection support
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Add connection integrity check
        if (!this.connected || !this.ws || !this.ws.connected) {
          throw new Error('Socket.IO connection is not available');
        }
        
        // Send the command
        const result = await this.sendRequest('command', 'rcon', {
          clientId: this.clientIds.rcon,
          command
        });
        
        console.log(`[Socket.IO] RCON command executed successfully, response length: ${result.response.length}`);
        return result.response;
      } catch (err) {
        console.error(`[Socket.IO] RCON command failed (attempt ${attempt + 1}/${maxRetries + 1}):`, err.message);
        lastError = err;
        
        // Check if this is a client/connection error that we need to handle
        const isDisconnectedError = 
          err.message.includes('Not connected') || 
          err.message.includes('Client disconnected') || 
          err.message.includes('Socket.IO') ||
          err.message.includes('not available') ||
          err.message.includes('Client not found') ||
          err.message.includes('invalid clientId');
          
        if (isDisconnectedError && attempt < maxRetries) {
          console.log(`[Socket.IO] Detected RCON connection issue, attempting recovery`);
          
          // Invalidate the client ID if it's explicitly known to be invalid
          if (err.message.includes('Client not found') || err.message.includes('invalid clientId')) {
            console.log(`[Socket.IO] Clearing invalid RCON client ID: ${this.clientIds.rcon}`);
            this.clientIds.rcon = null;
          }
          
          try {
            // First, check if the Socket.IO is still connected and reconnect if not
            if (!this.connected || !this.ws || !this.ws.connected) {
              console.log(`[Socket.IO] Socket.IO is not connected, attempting to reconnect`);
              await this.connect();
            }
            
            // If our client ID is gone, we need to refresh the entire connection
            if (!this.clientIds.rcon) {
              // If we don't have connection parameters yet, try to retrieve them
              if (!connectionParams) {
                try {
                  // Try to get connection parameters either for the specific client or any recent client
                  const clientId = this.clientIds.rcon; // This might be null at this point
                  
                  console.log(`[Socket.IO] Requesting connection parameters from agent${clientId ? ` for client ${clientId}` : ''}`);
                  connectionParams = await this.getConnectionParams('rcon', { clientId });
                  
                  if (connectionParams && connectionParams.host && connectionParams.port) {
                    console.log(`[Socket.IO] Successfully retrieved connection parameters for ${connectionParams.host}:${connectionParams.port}`);
                  } else {
                    console.warn(`[Socket.IO] Retrieved incomplete connection parameters`);
                  }
                } catch (paramsErr) {
                  console.warn(`[Socket.IO] Unable to retrieve connection parameters: ${paramsErr.message}`);
                  
                  // Try one more time without a specific client ID
                  if (this.clientIds.rcon) {
                    try {
                      console.log(`[Socket.IO] Trying to get parameters for any recent RCON connection`);
                      connectionParams = await this.getConnectionParams('rcon', {});
                      
                      if (connectionParams && connectionParams.host && connectionParams.port) {
                        console.log(`[Socket.IO] Retrieved fallback connection parameters for ${connectionParams.host}:${connectionParams.port}`);
                      }
                    } catch (fallbackErr) {
                      console.error(`[Socket.IO] Failed to get fallback connection parameters: ${fallbackErr.message}`);
                      connectionParams = null;
                    }
                  }
                }
              }
              
              // If we have connection params, attempt a fresh connection
              if (connectionParams && connectionParams.host && connectionParams.port && connectionParams.password) {
                try {
                  console.log(`[Socket.IO] Attempting full RCON reconnection to ${connectionParams.host}:${connectionParams.port}`);
                  const clientId = await this.connectToRcon(
                    connectionParams.host,
                    connectionParams.port,
                    connectionParams.password
                  );
                  
                  console.log(`[Socket.IO] Successfully recreated RCON connection with new client ID: ${clientId}`);
                  
                  // Now with a fresh connection, retry the command on the next loop iteration
                  continue;
                } catch (reconnErr) {
                  console.error(`[Socket.IO] Full RCON reconnection failed: ${reconnErr.message}`);
                  
                  // If we're at the last retry attempt, just throw the original error
                  if (attempt >= maxRetries - 1) {
                    break;
                  }
                  
                  // Wait longer between attempts after a failed reconnection
                  const delay = 3000 * Math.pow(2, attempt);
                  console.log(`[Socket.IO] Waiting ${delay}ms before next attempt`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  continue;
                }
              } else {
                console.warn(`[Socket.IO] No valid connection parameters available for reconnection`);
                
                // If we're at the last retry attempt, break out of the loop
                if (attempt >= maxRetries - 1) {
                  break;
                }
                
                // Wait a bit before next attempt
                const delay = 2000 * Math.pow(2, attempt);
                console.log(`[Socket.IO] Waiting ${delay}ms before next attempt`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
            }

            // If we still have a client ID, try to recover it
            if (this.clientIds.rcon) {
              try {
                // Try explicit reconnection request to the agent
                console.log(`[Socket.IO] Requesting reconnection for RCON client ${this.clientIds.rcon}`);
                await this.sendRequest('client/reconnect', 'rcon', {
                  clientId: this.clientIds.rcon
                });
                console.log(`[Socket.IO] Successfully requested RCON client reconnection`);
                
                // Wait a short time for the reconnection to take effect
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Continue to the next retry attempt
                continue;
              } catch (reconnectErr) {
                console.error(`[Socket.IO] RCON reconnection request failed: ${reconnectErr.message}`);
                
                // Try to get the connection parameters before clearing the client ID
                if (!connectionParams) {
                  try {
                    console.log(`[Socket.IO] Attempting to get connection parameters before clearing client ID`);
                    connectionParams = await this.getConnectionParams('rcon', {
                      clientId: this.clientIds.rcon
                    });
                    console.log(`[Socket.IO] Successfully cached connection parameters for later use`);
                  } catch (paramsErr) {
                    console.warn(`[Socket.IO] Unable to cache connection parameters: ${paramsErr.message}`);
                  }
                }
                
                // Client ID is probably invalid - clear it
                this.clientIds.rcon = null;
                
                // If we're at the last retry attempt, just throw the original error
                if (attempt >= maxRetries - 1) {
                  break;
                }
                
                // Wait longer between attempts after a failed reconnection
                const delay = 2000 * Math.pow(2, attempt);
                console.log(`[Socket.IO] Waiting ${delay}ms before next attempt`);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                // Try again with a full connection attempt
                continue;
              }
            }
          } catch (recoveryErr) {
            console.error(`[Socket.IO] RCON recovery attempt failed: ${recoveryErr.message}`);
            
            // If we're at the last retry attempt, just throw the original error
            if (attempt >= maxRetries - 1) {
              break;
            }
            
            // Wait longer between attempts after a failed recovery
            const delay = 2000 * Math.pow(2, attempt);
            console.log(`[Socket.IO] Waiting ${delay}ms before next attempt`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } else if (attempt < maxRetries) {
          // For other errors, add a short delay between attempts
          const delay = 500 * Math.pow(2, attempt);
          console.log(`[Socket.IO] Waiting ${delay}ms before next command attempt`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If we get here, all retries failed
    // Clear RCON client ID to force full reconnection next time
    if (lastError && (lastError.message.includes('Client not found') || 
                       lastError.message.includes('invalid clientId'))) {
      console.log(`[Socket.IO] Clearing RCON client ID after repeated failures`);
      this.clientIds.rcon = null;
    }
    
    console.error(`[Socket.IO] RCON command failed after all retries:`, lastError);
    throw lastError;
  }
  
  /**
   * Disconnect from RCON server
   * @returns {Promise<void>}
   */
  async disconnectFromRcon() {
    // Ensure we have a client ID
    if (!this.clientIds.rcon) {
      return; // Already disconnected
    }
    
    try {
      await this.sendRequest('disconnect', 'rcon', {
        clientId: this.clientIds.rcon
      });
      
      // Clear the client ID
      this.clientIds.rcon = null;
    } catch (err) {
      console.error('[Socket.IO] RCON disconnect error:', err);
      throw err;
    }
  }
  
  // ---- SMB Methods ----
  
  /**
   * Connect to SMB share
   * @param {string} host - SMB server host
   * @param {string} share - SMB share name
   * @param {string} username - SMB username
   * @param {string} password - SMB password
   * @returns {Promise<string>} - Client ID
   */
  async connectToSmb(host, share, username, password) {
    try {
      const result = await this.sendRequest('connect', 'smb', { host, share, username, password });
      
      // Store the client ID
      if (result.clientId) {
        this.clientIds.smb = result.clientId;
      }
      
      return result.clientId;
    } catch (err) {
      console.error('[Socket.IO] SMB connect error:', err);
      throw err;
    }
  }
  
  /**
   * Read directory contents
   * @param {string} path - Directory path
   * @returns {Promise<Array>} - Directory contents
   */
  async smbReaddir(path) {
    // Ensure we have a client ID
    if (!this.clientIds.smb) {
      throw new Error('Not connected to SMB share');
    }
    
    try {
      const result = await this.sendRequest('command', 'smb', {
        clientId: this.clientIds.smb,
        operation: 'readdir',
        path
      });
      
      return result.list;
    } catch (err) {
      console.error('[Socket.IO] SMB readdir error:', err);
      throw err;
    }
  }
  
  /**
   * Get file/directory stats
   * @param {string} path - File path
   * @returns {Promise<object>} - File stats
   */
  async smbStat(path) {
    // Ensure we have a client ID
    if (!this.clientIds.smb) {
      throw new Error('Not connected to SMB share');
    }
    
    try {
      return await this.sendRequest('command', 'smb', {
        clientId: this.clientIds.smb,
        operation: 'stat',
        path
      });
    } catch (err) {
      console.error('[Socket.IO] SMB stat error:', err);
      throw err;
    }
  }
  
  /**
   * Read file contents
   * @param {string} path - File path
   * @returns {Promise<string>} - File contents
   */
  async smbReadFile(path) {
    // Ensure we have a client ID
    if (!this.clientIds.smb) {
      throw new Error('Not connected to SMB share');
    }
    
    try {
      const result = await this.sendRequest('command', 'smb', {
        clientId: this.clientIds.smb,
        operation: 'readFile',
        path
      });
      
      return result.data;
    } catch (err) {
      console.error('[Socket.IO] SMB readFile error:', err);
      throw err;
    }
  }
  
  /**
   * Write file contents
   * @param {string} path - File path
   * @param {string|Buffer} data - File contents
   * @param {string} encoding - Optional encoding
   * @returns {Promise<void>}
   */
  async smbWriteFile(path, data, encoding) {
    // Ensure we have a client ID
    if (!this.clientIds.smb) {
      throw new Error('Not connected to SMB share');
    }
    
    try {
      await this.sendRequest('command', 'smb', {
        clientId: this.clientIds.smb,
        operation: 'writeFile',
        path,
        data,
        encoding
      });
    } catch (err) {
      console.error('[Socket.IO] SMB writeFile error:', err);
      throw err;
    }
  }
  
  /**
   * Delete a file
   * @param {string} path - File path
   * @returns {Promise<void>}
   */
  async smbUnlink(path) {
    // Ensure we have a client ID
    if (!this.clientIds.smb) {
      throw new Error('Not connected to SMB share');
    }
    
    try {
      await this.sendRequest('command', 'smb', {
        clientId: this.clientIds.smb,
        operation: 'unlink',
        path
      });
    } catch (err) {
      console.error('[Socket.IO] SMB unlink error:', err);
      throw err;
    }
  }
  
  /**
   * Disconnect from SMB share
   * @returns {Promise<void>}
   */
  async disconnectFromSmb() {
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
  }
  
  // ---- MySQL Methods ----
  
  /**
   * Connect to MySQL database
   * @param {string} host - MySQL server host
   * @param {number} port - MySQL server port
   * @param {string} user - MySQL username
   * @param {string} password - MySQL password
   * @param {string} database - MySQL database name
   * @param {object} ssl - SSL options
   * @returns {Promise<string>} - Client ID
   */
  async connectToMysql(host, port, user, password, database, ssl) {
    try {
      const result = await this.sendRequest('connect', 'mysql', {
        host, port, user, password, database, ssl
      });
      
      // Store the client ID
      if (result.clientId) {
        this.clientIds.mysql = result.clientId;
      }
      
      return result.clientId;
    } catch (err) {
      console.error('[Socket.IO] MySQL connect error:', err);
      throw err;
    }
  }
  
  /**
   * Execute MySQL query
   * @param {string} sql - SQL query
   * @returns {Promise<any>} - Query result
   */
  async mysqlQuery(sql) {
    // Ensure we have a client ID
    if (!this.clientIds.mysql) {
      throw new Error('Not connected to MySQL database');
    }
    
    try {
      const result = await this.sendRequest('command', 'mysql', {
        clientId: this.clientIds.mysql,
        sql
      });
      
      return result.result;
    } catch (err) {
      console.error('[Socket.IO] MySQL query error:', err);
      throw err;
    }
  }
  
  /**
   * Disconnect from MySQL database
   * @returns {Promise<void>}
   */
  async disconnectFromMysql() {
    // Ensure we have a client ID
    if (!this.clientIds.mysql) {
      return; // Already disconnected
    }
    
    try {
      await this.sendRequest('disconnect', 'mysql', {
        clientId: this.clientIds.mysql
      });
      
      // Clear the client ID
      this.clientIds.mysql = null;
    } catch (err) {
      console.error('[Socket.IO] MySQL disconnect error:', err);
      throw err;
    }
  }
  
  // ---- Query Methods ----
  
  /**
   * Query Minecraft server
   * @param {string} host - Server host
   * @param {number} port - Server port
   * @param {string} mode - Query mode (basic or full)
   * @returns {Promise<object>} - Query result
   */
  async query(host, port, mode = 'basic') {
    try {
      const result = await this.sendRequest('query', null, {
        host, port, mode
      });
      
      return result.info;
    } catch (err) {
      console.error('[Socket.IO] Query error:', err);
      throw err;
    }
  }
  
  /**
   * Get agent status
   * @returns {Promise<object>} - Status information
   */
  async getStatus() {
    try {
      return await this.sendRequest('status', null);
    } catch (err) {
      console.error('[Socket.IO] Status error:', err);
      throw err;
    }
  }
}

// Provide both CommonJS and ES module export for compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentSocketIOClient;
}

// Also export to global scope for browser environment
if (typeof window !== 'undefined') {
  window.AgentSocketIOClient = AgentSocketIOClient;
  
  // Keep backward compatibility with old name (for any code that might be using it)
  window.AgentWebSocketClient = AgentSocketIOClient;
}