/**
 * MySQL Client Model
 * Handles connection and query execution with MySQL databases
 */
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');
const fs = require('fs');

class MySqlClient {
  constructor(options) {
    this.id = uuidv4();
    this.host = options.host;
    this.port = options.port || 3306;
    this.user = options.user;
    this.password = options.password;
    this.database = options.database;
    this.ssl = options.ssl || false;
    
    this.connection = null;
    this.connected = false;
    this.lastActivity = Date.now();
    this.keepAliveInterval = null;
  }

  /**
   * Connect to the MySQL database
   * @returns {Promise<void>} A promise that resolves when connected
   */
  async connect() {
    // Clean up any existing connection
    await this.disconnect();
    
    try {
      const connectionConfig = {
        host: this.host,
        port: this.port,
        user: this.user,
        password: this.password,
        database: this.database,
        connectionLimit: 1,
        connectTimeout: 10000,
        dateStrings: true
      };
      
      // Configure SSL if enabled
      if (this.ssl) {
        connectionConfig.ssl = {};
        
        if (this.ssl.ca) {
          connectionConfig.ssl.ca = fs.readFileSync(this.ssl.ca);
        }
        
        if (this.ssl.rejectUnauthorized !== undefined) {
          connectionConfig.ssl.rejectUnauthorized = this.ssl.rejectUnauthorized;
        }
        
        console.log(`[MYSQL:${this.id}] Using SSL connection`);
      }
      
      console.log(`[MYSQL:${this.id}] Connecting to ${this.host}:${this.port}/${this.database}`);
      
      // Create the connection
      this.connection = await mysql.createConnection(connectionConfig);
      
      // Test the connection
      await this.connection.query('SELECT 1');
      
      this.connected = true;
      this.lastActivity = Date.now();
      
      console.log(`[MYSQL:${this.id}] Connected to ${this.host}:${this.port}/${this.database}`);
      
      // Start keep-alive
      this._startKeepAlive();
      
      return true;
    } catch (err) {
      console.error(`[MYSQL:${this.id}] Connection error:`, err.message);
      await this.disconnect();
      throw new Error(`Failed to connect to MySQL database: ${err.message}`);
    }
  }
  
  /**
   * Disconnect from the MySQL database
   * @returns {Promise<void>} A promise that resolves when disconnected
   */
  async disconnect() {
    this._stopKeepAlive();
    
    if (this.connection) {
      try {
        await this.connection.end();
        console.log(`[MYSQL:${this.id}] Disconnected from ${this.host}:${this.port}/${this.database}`);
      } catch (err) {
        console.error(`[MYSQL:${this.id}] Error disconnecting:`, err.message);
      } finally {
        this.connection = null;
        this.connected = false;
      }
    }
  }
  
  /**
   * Execute a SQL query
   * @param {string} sql - The SQL query to execute
   * @param {Array} [params] - Optional query parameters
   * @returns {Promise<Array>} A promise that resolves with query results
   */
  async query(sql, params = []) {
    this._checkConnection();
    this.lastActivity = Date.now();
    
    try {
      const [rows] = await this.connection.query(sql, params);
      return rows;
    } catch (err) {
      throw new Error(`Query execution failed: ${err.message}`);
    }
  }
  
  /**
   * Check if the client is connected
   * @private
   */
  _checkConnection() {
    if (!this.connected || !this.connection) {
      throw new Error('Not connected to MySQL database');
    }
  }
  
  /**
   * Start the keep-alive timer
   * @private
   */
  _startKeepAlive() {
    this._stopKeepAlive();
    
    // Send a keep-alive query every 30 seconds
    this.keepAliveInterval = setInterval(async () => {
      try {
        // Only send keep-alive if no activity for 25 seconds
        if (Date.now() - this.lastActivity > 25000) {
          console.log(`[MYSQL:${this.id}] Sending keep-alive ping`);
          await this.connection.query('SELECT 1');
        }
      } catch (err) {
        console.error(`[MYSQL:${this.id}] Keep-alive failed:`, err.message);
        // If keep-alive fails, disconnect
        this.disconnect();
      }
    }, 30000);
  }
  
  /**
   * Stop the keep-alive timer
   * @private
   */
  _stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}

module.exports = MySqlClient;