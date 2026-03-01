/**
 * RCON Service
 * Manages RCON client connections and provides API for RCON operations
 */
const RconClient = require('../models/RconClient');

class RconService {
  constructor() {
    // Store active clients
    this.clients = new Map();
    
    // Client activity tracking
    this.clientActivity = new Map();
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => this._cleanupInactiveClients(), 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Connect to an RCON server
   * @param {string} host - Server hostname or IP
   * @param {number} port - Server port
   * @param {string} password - RCON password
   * @returns {Promise<string>} A promise that resolves with the client ID
   */
  async connect(host, port, password) {
    // Validate input
    if (!host) {
      throw new Error('Missing required RCON parameter: host');
    }
    if (!port) {
      throw new Error('Missing required RCON parameter: port');
    }
    if (!password) {
      throw new Error('Missing required RCON parameter: password');
    }
    
    console.log(`[RCON-SERVICE] Connecting to RCON server at ${host}:${port}`);
    
    try {
      // Create a new RCON client
      const client = new RconClient(host, port, password);
      
      // Connect to the server
      console.log(`[RCON-SERVICE] Attempting RCON connection with client ID ${client.id}`);
      await client.connect();
      
      // Store the client
      this.clients.set(client.id, client);
      
      // Track activity
      this.trackClientActivity(client.id);
      
      console.log(`[RCON-SERVICE] Successfully connected to RCON server at ${host}:${port} with client ID ${client.id}`);
      return client.id;
    } catch (err) {
      console.error(`[RCON-SERVICE] RCON connection failed to ${host}:${port}:`, err);
      throw new Error(`RCON connection failed: ${err.message}`);
    }
  }

  /**
   * Execute an RCON command
   * @param {string} clientId - The client ID
   * @param {string} command - The command to execute
   * @param {boolean} [autoReconnect=true] - Whether to attempt reconnection on failure
   * @returns {Promise<string>} A promise that resolves with the command response
   */
  async executeCommand(clientId, command, autoReconnect = true) {
    console.log(`[RCON-SERVICE] Executing command "${command}" for client ${clientId}`);
    
    try {
      // Get the client
      const client = this.getClient(clientId);
      
      console.log(`[RCON-SERVICE] Found RCON client ${clientId}, connected status: ${client.connected}`);
      
      // Track activity
      this.trackClientActivity(clientId);
      
      // Check if connected and reconnect if necessary
      if (!client.connected && autoReconnect) {
        console.warn(`[RCON-SERVICE] Client ${clientId} is not connected, attempting reconnection`);
        try {
          await client.connect();
          console.log(`[RCON-SERVICE] Successfully reconnected client ${clientId}`);
        } catch (reconnectErr) {
          console.error(`[RCON-SERVICE] Failed to reconnect client ${clientId}:`, reconnectErr);
          throw new Error(`RCON not connected and reconnection failed: ${reconnectErr.message}`);
        }
      } else if (!client.connected) {
        throw new Error('RCON client is disconnected');
      }
      
      // Execute the command with timeout
      const timeout = 10000; // 10 second timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Command execution timed out')), timeout);
      });
      
      // Race between command execution and timeout
      const response = await Promise.race([
        client.sendCommand(command),
        timeoutPromise
      ]);
      
      console.log(`[RCON-SERVICE] Successfully executed command "${command}" for client ${clientId}`);
      return response;
    } catch (err) {
      console.error(`[RCON-SERVICE] Error executing command "${command}" for client ${clientId}:`, err);
      
      // If this is a connection error and auto-reconnect is enabled, try reconnecting once
      if (autoReconnect && 
          (err.message.includes('Not connected') || 
           err.message.includes('Disconnected') || 
           err.message.includes('ECONNRESET') ||
           err.message.includes('timed out'))) {
        
        console.log(`[RCON-SERVICE] Connection error detected, attempting reconnection`);
        try {
          // Get the client again in case it was removed
          const client = this.clients.get(clientId);
          
          if (!client) {
            throw new Error('Client was removed');
          }
          
          // Disconnect explicitly to clear any lingering connections
          await client.disconnect();
          
          // Reconnect
          await client.connect();
          
          console.log(`[RCON-SERVICE] Reconnected, retrying command "${command}"`);
          
          // Retry the command without auto-reconnect to prevent infinite loops
          return await this.executeCommand(clientId, command, false);
        } catch (reconnectErr) {
          console.error(`[RCON-SERVICE] Reconnection failed:`, reconnectErr);
          throw new Error(`Command failed and reconnection failed: ${err.message}`);
        }
      }
      
      throw err;
    }
  }

  /**
   * Disconnect from an RCON server
   * @param {string} clientId - The client ID
   * @returns {Promise<void>} A promise that resolves when disconnected
   */
  async disconnect(clientId) {
    const client = this.clients.get(clientId);
    
    if (!client) {
      console.log(`[RCON-SERVICE] Client ${clientId} not found or already disconnected`);
      return;
    }
    
    try {
      await client.disconnect();
    } catch (err) {
      console.error(`[RCON-SERVICE] Error disconnecting client ${clientId}:`, err.message);
    } finally {
      // Always remove the client from our maps
      this.clients.delete(clientId);
      this.clientActivity.delete(clientId);
    }
  }

  /**
   * Reconnect an RCON client
   * @param {string} clientId - The client ID
   * @returns {Promise<boolean>} A promise that resolves with the reconnection result
   */
  async reconnect(clientId) {
    const client = this.clients.get(clientId);
    
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    try {
      // Disconnect first
      await client.disconnect();
      
      // Reconnect with the same parameters
      await client.connect();
      
      // Track activity
      this.trackClientActivity(clientId);
      
      return true;
    } catch (err) {
      throw new Error(`Reconnection failed: ${err.message}`);
    }
  }

  /**
   * Get an RCON client by ID
   * @param {string} clientId - The client ID
   * @returns {RconClient} The RCON client
   */
  getClient(clientId) {
    console.log(`[RCON-SERVICE] Looking up RCON client with ID: ${clientId}`);
    console.log(`[RCON-SERVICE] Current active clients: ${Array.from(this.clients.keys()).join(', ') || 'none'}`);
    
    const client = this.clients.get(clientId);
    
    if (!client) {
      console.error(`[RCON-SERVICE] RCON client not found with ID: ${clientId}`);
      throw new Error(`RCON client not found: ${clientId}`);
    }
    
    if (!client.connected) {
      console.warn(`[RCON-SERVICE] RCON client exists but is not connected: ${clientId}`);
    }
    
    return client;
  }

  /**
   * Get connection parameters for an RCON client
   * @param {string} clientId - The client ID
   * @returns {Object} The connection parameters
   */
  getConnectionParams(clientId) {
    const client = this.getClient(clientId);
    
    return {
      host: client.host,
      port: client.port
    };
  }

  /**
   * Track client activity
   * @param {string} clientId - The client ID
   * @private
   */
  trackClientActivity(clientId) {
    this.clientActivity.set(clientId, Date.now());
  }

  /**
   * Clean up inactive clients
   * @private
   */
  _cleanupInactiveClients() {
    const now = Date.now();
    const MAX_INACTIVE_TIME = 60 * 60 * 1000; // 1 hour
    
    for (const [clientId, lastActivity] of this.clientActivity.entries()) {
      if (now - lastActivity > MAX_INACTIVE_TIME) {
        console.log(`[RCON-SERVICE] Cleaning up inactive client ${clientId}`);
        this.disconnect(clientId).catch(err => {
          console.error(`[RCON-SERVICE] Error cleaning up client ${clientId}:`, err.message);
        });
      }
    }
  }

  /**
   * Shut down the service and clean up resources
   */
  shutdown() {
    console.log('[RCON-SERVICE] Shutting down RCON service');
    
    // Clear cleanup interval
    clearInterval(this.cleanupInterval);
    
    // Disconnect all clients
    const disconnectPromises = [];
    for (const clientId of this.clients.keys()) {
      disconnectPromises.push(this.disconnect(clientId));
    }
    
    return Promise.all(disconnectPromises);
  }
}

module.exports = new RconService();