/**
 * Enhanced MySQL Client
 * A more robust MySQL client with auto-reconnect and connection health monitoring
 */
const mysql = require('mysql2/promise');
const EventEmitter = require('events');

/**
 * MySQLClient provides a robust interface to execute SQL commands with reconnection support,
 * connection health monitoring, and error handling.
 */
class MySQLClient extends EventEmitter {
  /**
   * Create a new MySQL client
   * @param {object} options MySQL connection options
   * @param {string} options.host MySQL server hostname
   * @param {number|string} options.port MySQL server port
   * @param {string} options.user MySQL username
   * @param {string} options.password MySQL password
   * @param {string} options.database MySQL database name
   * @param {boolean|object} [options.ssl=false] SSL options - true for rejectUnauthorized=true, or object with SSL options
   * @param {number} [options.timeout=30000] Connection/query timeout in milliseconds
   * @param {number} [options.keepAliveInterval=60000] Interval for keep-alive pings in milliseconds
   * @param {boolean} [options.debug=false] Enable debug logging
   */
  constructor({ 
    host, 
    port, 
    user, 
    password, 
    database, 
    ssl = false,
    timeout = 86400000,  // default to 24h connection timeout
    keepAliveInterval = 60000,
    debug = false
  }) {
    super();
    
    // Connection parameters
    this.host = host;
    this.port = parseInt(port, 10);
    this.user = user;
    this.password = password;
    this.database = database;
    this.ssl = ssl;
    this.timeout = timeout;
    this.keepAliveInterval = keepAliveInterval;
    this.debug = debug;
    
    // Connection state
    this.connection = null;
    this.connected = false;
    this.connecting = false;
    this.lastActivity = Date.now();
    this.keepAliveTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.consecutiveErrors = 0;
    this.maxConsecutiveErrors = 3;
    
    // Generate a unique client ID for logging
    this.id = Math.random().toString(36).substring(2, 10);
    
    this.log('MySQL client created');
  }
  
  /**
   * Log debug messages when debug mode is enabled
   * @param {...any} args Arguments to log
   */
  log(...args) {
    if (this.debug) {
      console.log(`[MySQL:${this.id}]`, ...args);
    }
  }
  
  /**
   * Get MySQL connection options with proper configuration
   * @returns {object} MySQL connection options
   * @private
   */
  _getConnectionOptions() {
    // Build MySQL connection options
    const options = {
      host: this.host,
      port: this.port,
      user: this.user,
      password: this.password,
      database: this.database,
      connectTimeout: this.timeout,
      // Prevent connection timeout during inactivity
      waitForConnections: true,
      // Single connection for simplicity
      connectionLimit: 1,
      // Enable TCP keep-alive
      enableKeepAlive: true
    };
    
    // Configure SSL if needed
    if (this.ssl) {
      if (typeof this.ssl === 'object') {
        options.ssl = this.ssl;
      } else {
        options.ssl = { rejectUnauthorized: true };
      }
    }
    
    return options;
  }
  
  /**
   * Connect to the MySQL server with robust error handling
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected) {
      this.log('Already connected');
      return;
    }
    
    if (this.connecting) {
      this.log('Connection already in progress');
      return;
    }
    
    this.connecting = true;
    
    try {
      this.log(`Connecting to MySQL at ${this.host}:${this.port}/${this.database}`);
      
      // Get connection options
      const options = this._getConnectionOptions();
      
      // Create the connection
      this.connection = await mysql.createConnection(options);
      
      // Set up connection event handlers
      this._setupConnectionEvents();
      
      // Perform a test query to verify the connection
      await this.connection.query('SELECT 1 AS ping');
      
      // Update state
      this.connected = true;
      this.connecting = false;
      this.lastActivity = Date.now();
      this.reconnectAttempts = 0;
      this.consecutiveErrors = 0;
      
      // Start keepalive timer
      this._startKeepAlive();
      
      this.log('Successfully connected to MySQL');
      this.emit('connect');
      
    } catch (err) {
      this.connecting = false;
      this.connected = false;
      this.log('Connection failed:', err.message);
      
      // Clean up any partially created connection
      if (this.connection) {
        try {
          await this.connection.end();
        } catch (endErr) {
          // Ignore errors during cleanup
        }
        this.connection = null;
      }
      
      this.emit('error', err);
      throw err;
    }
  }
  
  /**
   * Set up event handlers for the MySQL connection
   * @private
   */
  _setupConnectionEvents() {
    if (!this.connection) return;

    // Handle connection errors
    this.connection.on('error', (err) => {
      this.log('Connection error:', err.message);
      this.connected = false;

      // Emit the error event
      this.emit('error', err);

      // Auto-reconnect on connection loss
      this._reconnect();
    });

    // Handle connection closing (server-initiated graceful close)
    this.connection.on('end', () => {
      this.log('Connection ended by server');
      this.connected = false;
      this._stopKeepAlive();

      this.emit('end');

      // Auto-reconnect on graceful close too
      this._reconnect();
    });
  }
  
  /**
   * Start the keepalive timer to prevent connection timeout
   * @private
   */
  _startKeepAlive() {
    this._stopKeepAlive();
    
    this.log(`Starting keepalive timer (interval: ${this.keepAliveInterval}ms)`);
    
    this.keepAliveTimer = setInterval(async () => {
      try {
        // Only send keepalive if we haven't had activity recently
        const idleTime = Date.now() - this.lastActivity;
        
        if (idleTime > this.keepAliveInterval / 2) {
          this.log(`Sending keepalive ping (idle for ${Math.round(idleTime/1000)}s)`);
          
          // Send a simple query to keep the connection alive
          await this._ping();
          
          // Reset consecutive errors on successful ping
          this.consecutiveErrors = 0;
        }
      } catch (err) {
        this.log('Keepalive ping failed:', err.message);
        this.consecutiveErrors++;
        
        // If we've had too many errors, try to reconnect
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
          this.log(`${this.consecutiveErrors} consecutive errors, attempting reconnect`);
          this._reconnect();
        }
      }
    }, this.keepAliveInterval);
  }
  
  /**
   * Stop the keepalive timer
   * @private
   */
  _stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }
  
  /**
   * Send a ping query to check connection health
   * @returns {Promise<void>}
   * @private
   */
  async _ping() {
    if (!this.connection || !this.connected) {
      throw new Error('Not connected to MySQL');
    }
    
    try {
      await this.connection.query('SELECT 1 AS ping');
      this.lastActivity = Date.now();
      this.log('Ping successful');
    } catch (err) {
      this.log('Ping failed:', err.message);
      throw err;
    }
  }
  
  /**
   * Attempt to reconnect to the MySQL server with exponential backoff.
   * Retries up to maxReconnectAttempts (default 5) before giving up.
   * @private
   */
  async _reconnect() {
    if (this.connecting) {
      this.log('Reconnect already in progress');
      return;
    }

    // Stop keepalive during reconnection
    this._stopKeepAlive();

    // Close any existing connection before the retry loop
    if (this.connection) {
      try { await this.connection.end(); } catch { /* ignore */ }
      this.connection = null;
    }

    this.connected = false;

    for (let attempt = 1; attempt <= this.maxReconnectAttempts; attempt++) {
      // Calculate backoff delay: 2s, 4s, 8s, 16s, 30s (capped)
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000);

      this.log(`Reconnect attempt ${attempt}/${this.maxReconnectAttempts} in ${delay}ms`);
      this.emit('reconnecting', { attempt, max: this.maxReconnectAttempts, delay });

      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        await this.connect();
        this.reconnectAttempts = 0;
        this.consecutiveErrors = 0;
        this.log('Reconnection successful');
        this.emit('reconnect');
        return;
      } catch (err) {
        this.log(`Reconnect attempt ${attempt} failed: ${err.message}`);
      }
    }

    // All attempts exhausted
    this.log(`All ${this.maxReconnectAttempts} reconnect attempts failed`);
    this.emit('reconnect_failed');
  }
  
  /**
   * Execute a SQL query with proper error handling and reconnection support
   * @param {string} sql SQL query to execute
   * @returns {Promise<string>} JSON-formatted results
   */
  async query(sql) {
    // Check connection state
    if (!this.connection || !this.connected) {
      // Attempt to connect if we're not already connected
      try {
        await this.connect();
      } catch (err) {
        throw new Error(`Not connected to MySQL: ${err.message}`);
      }
    }
    
    try {
      this.log(`Executing query: ${sql.substring(0, 50)}${sql.length > 50 ? '...' : ''}`);
      
      // Update activity timestamp
      this.lastActivity = Date.now();
      
      // Execute the query with timeout
      const [rows] = await this._executeWithTimeout(sql);
      
      // Reset consecutive errors on success
      this.consecutiveErrors = 0;
      
      // Format response
      const result = JSON.stringify(rows, null, 2);
      
      this.log(`Query successful, returned ${rows.length} rows`);
      return result;
    } catch (err) {
      this.log('Query error:', err.message);
      
      // Count consecutive errors
      this.consecutiveErrors++;
      
      // Check for connection-related errors that might require reconnection
      if (
        err.code === 'PROTOCOL_CONNECTION_LOST' ||
        err.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR' ||
        err.code === 'PROTOCOL_PACKETS_OUT_OF_ORDER' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNREFUSED' ||
        err.code === 'ECONNRESET'
      ) {
        // Try to reconnect on connection errors
        this.log('Connection error detected, will attempt to reconnect');
        this.connected = false;
        
        // Try to reconnect on next query
        if (this.consecutiveErrors <= this.maxConsecutiveErrors) {
          await this._reconnect();
        }
      }
      
      // Throw a user-friendly error
      throw new Error(`Failed to execute SQL query: ${err.message}`);
    }
  }
  
  /**
   * Execute a query with a timeout
   * @param {string} sql SQL query to execute
   * @returns {Promise<any>} Query result
   * @private
   */
  _executeWithTimeout(sql) {
    return Promise.race([
      // The actual query
      this.connection.execute(sql),
      
      // A timeout promise
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Query timed out after ${this.timeout}ms`));
        }, this.timeout);
      })
    ]);
  }
  
  /**
   * Close the MySQL connection and clean up resources
   * @returns {Promise<void>}
   */
  async close() {
    this.log('Closing connection');
    
    // Stop keepalive timer
    this._stopKeepAlive();
    
    // Close the connection if it exists
    if (this.connection) {
      try {
        await this.connection.end();
        this.log('Connection closed');
      } catch (err) {
        this.log('Error closing connection:', err.message);
      }
      
      this.connection = null;
    }
    
    // Update state
    this.connected = false;
    this.emit('close');
  }
}

module.exports = MySQLClient;