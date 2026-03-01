/**
 * SMB Service
 * Manages SMB client connections and provides API for SMB operations
 */
const SmbClientAdapter = require('../models/SmbClient');

class SmbService {
  constructor() {
    // Store active clients
    this.clients = new Map();
    
    // Client activity tracking
    this.clientActivity = new Map();
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => this._cleanupInactiveClients(), 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Connect to an SMB share
   * @param {string} host - Server hostname or IP
   * @param {string} share - Share name
   * @param {string} username - Username
   * @param {string} password - Password
   * @param {string} [domain] - Optional domain
   * @returns {Promise<string>} A promise that resolves with the client ID
   */
  async connect(host, share, username, password, domain = '') {
    // Validate input
    if (!host || !share) {
      throw new Error('Missing required SMB connection parameters');
    }
    
    // Ensure we're using real SMB connections, no simulation modes
    process.env.SMB_SIMULATION_MODE = 'false';
    
    try {
      // Create a new SMB client
      const client = new SmbClientAdapter(host, share, username, password, domain);
      
      // Connect to the share
      await client.connect();
      
      // Store the client
      this.clients.set(client.id, client);
      
      // Track activity
      this.trackClientActivity(client.id);
      
      return client.id;
    } catch (err) {
      throw new Error(`SMB connection failed: ${err.message}`);
    }
  }

  /**
   * Read a directory listing
   * @param {string} clientId - The client ID
   * @param {string} dirPath - Path to the directory
   * @returns {Promise<Array>} A promise that resolves with directory contents
   */
  async readdir(clientId, dirPath) {
    // Get the client
    const client = this.getClient(clientId);
    
    // Track activity
    this.trackClientActivity(clientId);
    
    // Read the directory
    return await client.readdir(dirPath);
  }

  /**
   * Get file or directory stats
   * @param {string} clientId - The client ID
   * @param {string} filePath - Path to the file or directory
   * @returns {Promise<Object>} A promise that resolves with file stats
   */
  async stat(clientId, filePath) {
    // Get the client
    const client = this.getClient(clientId);
    
    // Track activity
    this.trackClientActivity(clientId);
    
    // Get file stats
    const stats = await client.stat(filePath);
    
    // Return a simplified object
    return {
      isDirectory: stats.isDirectory(),
      size: stats.size,
      modified: stats.mtime.toISOString()
    };
  }

  /**
   * Read a file's contents
   * @param {string} clientId - The client ID
   * @param {string} filePath - Path to the file
   * @param {string} [encoding] - Optional encoding
   * @returns {Promise<string|Buffer>} A promise that resolves with file contents
   */
  async readFile(clientId, filePath, encoding) {
    // Get the client
    const client = this.getClient(clientId);
    
    // Track activity
    this.trackClientActivity(clientId);
    
    // Read the file
    return await client.readFile(filePath, encoding);
  }

  /**
   * Write data to a file
   * @param {string} clientId - The client ID
   * @param {string} filePath - Path to the file
   * @param {string|Buffer} data - Data to write
   * @param {string} [encoding] - Optional encoding
   * @returns {Promise<void>} A promise that resolves when the file is written
   */
  async writeFile(clientId, filePath, data, encoding) {
    // Get the client
    const client = this.getClient(clientId);
    
    // Track activity
    this.trackClientActivity(clientId);
    
    // Write the file
    await client.writeFile(filePath, data, encoding);
  }

  /**
   * Delete a file
   * @param {string} clientId - The client ID
   * @param {string} filePath - Path to the file
   * @returns {Promise<void>} A promise that resolves when the file is deleted
   */
  async unlink(clientId, filePath) {
    // Get the client
    const client = this.getClient(clientId);
    
    // Track activity
    this.trackClientActivity(clientId);
    
    // Delete the file
    await client.unlink(filePath);
  }

  /**
   * Disconnect from an SMB share
   * @param {string} clientId - The client ID
   * @returns {Promise<void>} A promise that resolves when disconnected
   */
  async disconnect(clientId) {
    const client = this.clients.get(clientId);
    
    if (!client) {
      console.log(`[SMB-SERVICE] Client ${clientId} not found or already disconnected`);
      return;
    }
    
    try {
      await client.disconnect();
    } catch (err) {
      console.error(`[SMB-SERVICE] Error disconnecting client ${clientId}:`, err.message);
    } finally {
      // Always remove the client from our maps
      this.clients.delete(clientId);
      this.clientActivity.delete(clientId);
    }
  }

  /**
   * Reconnect an SMB client
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
   * Get an SMB client by ID
   * @param {string} clientId - The client ID
   * @returns {SmbClient} The SMB client
   */
  getClient(clientId) {
    const client = this.clients.get(clientId);
    
    if (!client) {
      throw new Error(`SMB client not found: ${clientId}`);
    }
    
    return client;
  }

  /**
   * Get connection parameters for an SMB client
   * @param {string} clientId - The client ID
   * @returns {Object} The connection parameters
   */
  getConnectionParams(clientId) {
    const client = this.getClient(clientId);
    
    return {
      host: client.host,
      share: client.share,
      username: client.username,
      password: client.password,
      domain: client.domain
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
        console.log(`[SMB-SERVICE] Cleaning up inactive client ${clientId}`);
        this.disconnect(clientId).catch(err => {
          console.error(`[SMB-SERVICE] Error cleaning up client ${clientId}:`, err.message);
        });
      }
    }
  }

  /**
   * Shut down the service and clean up resources
   */
  shutdown() {
    console.log('[SMB-SERVICE] Shutting down SMB service');
    
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

module.exports = new SmbService();