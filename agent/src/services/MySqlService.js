/**
 * MySQL Service
 * Manages MySQL client connections and provides API for MySQL operations
 */
const MySqlClient = require('../models/MySqlClient');

class MySqlService {
  constructor() {
    // Store active clients
    this.clients = new Map();
    
    // Client activity tracking
    this.clientActivity = new Map();
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => this._cleanupInactiveClients(), 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Connect to a MySQL database
   * @param {Object} options - Connection options
   * @param {string} options.host - Database host
   * @param {number} options.port - Database port
   * @param {string} options.user - Username
   * @param {string} options.password - Password
   * @param {string} options.database - Database name
   * @param {Object} [options.ssl] - SSL options
   * @returns {Promise<string>} A promise that resolves with the client ID
   */
  async connect(options) {
    // Validate input
    if (!options.host || !options.user || !options.database) {
      throw new Error('Missing required MySQL connection parameters');
    }
    
    try {
      // Create a new MySQL client
      const client = new MySqlClient(options);
      
      // Connect to the database
      await client.connect();
      
      // Store the client
      this.clients.set(client.id, client);
      
      // Track activity
      this.trackClientActivity(client.id);
      
      return client.id;
    } catch (err) {
      throw new Error(`MySQL connection failed: ${err.message}`);
    }
  }

  /**
   * Execute a SQL query
   * @param {string} clientId - The client ID
   * @param {string} sql - The SQL query to execute
   * @param {Array} [params] - Optional query parameters
   * @returns {Promise<Array>} A promise that resolves with query results
   */
  async query(clientId, sql, params = []) {
    // Get the client
    const client = this.getClient(clientId);
    
    // Track activity
    this.trackClientActivity(clientId);
    
    // Execute the query
    return await client.query(sql, params);
  }

  /**
   * Disconnect from a MySQL database
   * @param {string} clientId - The client ID
   * @returns {Promise<void>} A promise that resolves when disconnected
   */
  async disconnect(clientId) {
    const client = this.clients.get(clientId);
    
    if (!client) {
      console.log(`[MYSQL-SERVICE] Client ${clientId} not found or already disconnected`);
      return;
    }
    
    try {
      await client.disconnect();
    } catch (err) {
      console.error(`[MYSQL-SERVICE] Error disconnecting client ${clientId}:`, err.message);
    } finally {
      // Always remove the client from our maps
      this.clients.delete(clientId);
      this.clientActivity.delete(clientId);
    }
  }

  /**
   * Reconnect a MySQL client
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
   * Get a MySQL client by ID
   * @param {string} clientId - The client ID
   * @returns {MySqlClient} The MySQL client
   */
  getClient(clientId) {
    const client = this.clients.get(clientId);
    
    if (!client) {
      throw new Error(`MySQL client not found: ${clientId}`);
    }
    
    return client;
  }

  /**
   * Get connection parameters for a MySQL client
   * @param {string} clientId - The client ID
   * @returns {Object} The connection parameters
   */
  getConnectionParams(clientId) {
    const client = this.getClient(clientId);
    
    return {
      host: client.host,
      port: client.port,
      user: client.user,
      password: client.password,
      database: client.database,
      ssl: client.ssl
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
        console.log(`[MYSQL-SERVICE] Cleaning up inactive client ${clientId}`);
        this.disconnect(clientId).catch(err => {
          console.error(`[MYSQL-SERVICE] Error cleaning up client ${clientId}:`, err.message);
        });
      }
    }
  }

  /**
   * Shut down the service and clean up resources
   */
  shutdown() {
    console.log('[MYSQL-SERVICE] Shutting down MySQL service');
    
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

module.exports = new MySqlService();