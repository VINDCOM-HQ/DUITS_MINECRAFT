/**
 * RCON Client Model
 * Handles connection and communication with Minecraft servers via RCON protocol
 */
const net = require('net');
const { v4: uuidv4 } = require('uuid');

class RconClient {
  constructor(host, port, password) {
    this.id = uuidv4();
    this.host = host;
    this.port = port;
    this.password = password;
    this.socket = null;
    this.connected = false;
    this.authenticated = false;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.buffer = Buffer.alloc(0);
    this.lastActivity = Date.now();
    this.keepAliveInterval = null;
  }

  /**
   * Connect to the RCON server
   * @returns {Promise<void>} A promise that resolves when connected and authenticated
   */
  connect() {
    return new Promise((resolve, reject) => {
      // Validate connection parameters
      if (!this.host || !this.port || !this.password) {
        return reject(new Error('Missing required RCON connection parameters'));
      }
      
      // Clean up existing connection if any
      this.disconnect();
      
      // Reset state
      this.connected = false;
      this.authenticated = false;
      this.buffer = Buffer.alloc(0);
      this.lastActivity = Date.now();
      
      // Create a new socket with improved options
      this.socket = new net.Socket({
        allowHalfOpen: false,  // Close both ends when one end is closed
        readable: true,
        writable: true
      });
      
      // Configure socket behavior
      this.socket.setKeepAlive(true, 30000);  // Enable TCP keepalive
      this.socket.setNoDelay(true);          // Disable Nagle's algorithm
      
      // Set up event handlers
      this.socket.on('data', (data) => {
        try {
          this._handleData(data);
        } catch (err) {
          console.error(`[RCON:${this.id}] Error handling data:`, err.message);
        }
      });
      
      this.socket.on('close', (hadError) => {
        const wasConnected = this.connected;
        this.connected = false;
        this.authenticated = false;
        
        if (wasConnected) {
          console.log(`[RCON:${this.id}] Connection closed to ${this.host}:${this.port}${hadError ? ' due to error' : ''}`);
          
          // Reject all pending requests when a previously connected socket closes
          this._rejectAllPending(new Error('Disconnected from server'));
        }
      });
      
      this.socket.on('error', (err) => {
        console.error(`[RCON:${this.id}] Socket error:`, err.message);
        
        // Only reject pending requests on error, socket close will already handle disconnection
        this._rejectAllPending(err);
      });
      
      this.socket.on('timeout', () => {
        console.warn(`[RCON:${this.id}] Socket timeout`);
        
        // If we're still connecting, fail the connection
        if (!this.authenticated && this.socket) {
          this.socket.destroy(new Error('Connection timed out'));
          reject(new Error('Connection timed out'));
        }
      });
      
      // Connect to the server
      console.log(`[RCON:${this.id}] Connecting to ${this.host}:${this.port}`);
      
      // Create a connection timeout that will be cleared on successful authentication
      const connectionTimeout = setTimeout(() => {
        if (!this.authenticated) {
          console.error(`[RCON:${this.id}] Connection timed out after 15 seconds`);
          if (this.socket) {
            // Check if socket still exists before destroying it
            this.socket.destroy(new Error('Connection timed out'));
          }
          reject(new Error('Connection timed out after 15 seconds'));
        }
      }, 15000);
      
      // Begin connection
      this.socket.connect(this.port, this.host, () => {
        this.connected = true;
        console.log(`[RCON:${this.id}] Connected to ${this.host}:${this.port}, authenticating...`);
        
        // Authenticate with the server
        try {
          this._authenticate(this.password)
            .then(() => {
              console.log(`[RCON:${this.id}] Successfully authenticated with ${this.host}:${this.port}`);
              
              // Clear the connection timeout
              clearTimeout(connectionTimeout);
              
              this.authenticated = true;
              this.lastActivity = Date.now();
              
              // Start keep-alive
              this._startKeepAlive();
              
              resolve();
            })
            .catch(err => {
              console.error(`[RCON:${this.id}] Authentication failed:`, err.message);
              clearTimeout(connectionTimeout);
              this.disconnect();
              reject(new Error(`Authentication failed: ${err.message}`));
            });
        } catch (err) {
          console.error(`[RCON:${this.id}] Failed to send authentication:`, err.message);
          clearTimeout(connectionTimeout);
          this.disconnect();
          reject(new Error(`Failed to send authentication: ${err.message}`));
        }
      });
      
      // Set a socket-level timeout
      this.socket.setTimeout(15000);
    });
  }
  
  /**
   * Send a command to the RCON server
   * @param {string} command - The command to execute
   * @param {number} [timeout=15000] - Timeout in milliseconds
   * @returns {Promise<string>} - A promise that resolves with the command response
   */
  async sendCommand(command, timeout = 15000) {
    // Check connection state
    if (!this.connected || !this.socket) {
      console.warn(`[RCON:${this.id}] Attempted to send command when not connected`);
      throw new Error('Not connected to RCON server');
    }
    
    if (!this.authenticated) {
      console.warn(`[RCON:${this.id}] Attempted to send command when not authenticated`);
      throw new Error('Not authenticated with RCON server');
    }
    
    // Check socket state - Node's socket.writable is unreliable, so we do our own check
    try {
      // Check if socket is writable
      if (!this.socket.writable) {
        console.warn(`[RCON:${this.id}] Socket marked as not writable`);
        throw new Error('Socket is not writable');
      }
    } catch (err) {
      console.error(`[RCON:${this.id}] Error checking socket state:`, err.message);
      throw new Error(`Socket error: ${err.message}`);
    }
    
    // Update activity timestamp
    this.lastActivity = Date.now();
    
    console.log(`[RCON:${this.id}] Sending command: ${command.substring(0, 50)}${command.length > 50 ? '...' : ''}`);
    
    try {
      // Set up a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Command timed out after ${timeout}ms`));
        }, timeout);
      });
      
      // Race between the command execution and timeout
      return await Promise.race([
        this._sendPacket(2, command), // 2 = SERVERDATA_EXECCOMMAND
        timeoutPromise
      ]);
    } catch (err) {
      console.error(`[RCON:${this.id}] Command execution failed:`, err.message);
      
      // Clean up connection on fatal errors
      if (err.message.includes('Socket') || err.message.includes('ECONNRESET') || err.message.includes('timed out')) {
        console.warn(`[RCON:${this.id}] Fatal error detected, marking as disconnected`);
        this.connected = false;
        this.authenticated = false;
      }
      
      throw err;
    }
  }
  
  /**
   * Disconnect from the RCON server
   */
  disconnect() {
    this._stopKeepAlive();
    
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch (err) {
        console.error(`[RCON:${this.id}] Error destroying socket:`, err.message);
      }
      this.socket = null;
    }
    
    this.connected = false;
    this.authenticated = false;
    this._rejectAllPending(new Error('Disconnected from server'));
  }
  
  /**
   * Send an authentication packet to the server
   * @private
   * @param {string} password - The RCON password
   * @returns {Promise<void>} - A promise that resolves on successful authentication
   */
  _authenticate(password) {
    return this._sendPacket(3, password); // 3 = SERVERDATA_AUTH
  }
  
  /**
   * Send a packet to the RCON server
   * @private
   * @param {number} type - Packet type
   * @param {string} body - Packet body
   * @returns {Promise<string>} - A promise that resolves with the response
   */
  _sendPacket(type, body) {
    return new Promise((resolve, reject) => {
      try {
        if (!this.socket || !this.connected) {
          return reject(new Error('Not connected to server'));
        }
        
        // Assign and increment request ID
        const id = ++this.requestId;
        
        // Store the promise handlers for later resolution
        this.pendingRequests.set(id, { resolve, reject, timestamp: Date.now() });
        
        // Create the packet
        const bodyBuffer = Buffer.from(body + '\0', 'utf8');
        const packetLength = bodyBuffer.length + 10; // ID (4) + Type (4) + Body + null terminator (1) + padding (1)
        
        const packet = Buffer.alloc(packetLength + 4); // +4 for size field
        packet.writeInt32LE(packetLength, 0); // Size
        packet.writeInt32LE(id, 4); // Request ID
        packet.writeInt32LE(type, 8); // Type
        bodyBuffer.copy(packet, 12); // Body + null terminator
        packet.writeInt8(0, packet.length - 2); // Padding null byte
        
        // Send the packet
        this.socket.write(packet);
        
        // Set a timeout for the request
        setTimeout(() => {
          if (this.pendingRequests.has(id)) {
            this.pendingRequests.delete(id);
            reject(new Error('Request timed out'));
          }
        }, 30000);
      } catch (err) {
        reject(new Error(`Failed to send packet: ${err.message}`));
      }
    });
  }
  
  /**
   * Handle incoming data from the RCON server
   * @private
   * @param {Buffer} data - Incoming data buffer
   */
  _handleData(data) {
    // Append the new data to our buffer
    this.buffer = Buffer.concat([this.buffer, data]);
    
    // Process packets until we can't anymore
    while (this.buffer.length >= 4) {
      // Try to read packet size
      const packetSize = this.buffer.readInt32LE(0);
      
      // Make sure we have a complete packet
      if (this.buffer.length < packetSize + 4) {
        break;
      }
      
      // Extract the packet
      const packetBuffer = this.buffer.slice(0, packetSize + 4);
      
      // Remove the processed packet from the buffer
      this.buffer = this.buffer.slice(packetSize + 4);
      
      // Process the packet
      this._processPacket(packetBuffer);
    }
  }
  
  /**
   * Process a complete RCON packet
   * @private
   * @param {Buffer} packet - The complete packet buffer
   */
  _processPacket(packet) {
    // Extract packet components
    const id = packet.readInt32LE(4);
    const type = packet.readInt32LE(8);
    
    // Decode the body (minus the null terminators)
    const bodyBuffer = packet.slice(12, packet.length - 2);
    let body = '';
    try {
      body = bodyBuffer.toString('utf8').replace(/\0+$/, '');
    } catch (err) {
      console.error(`[RCON:${this.id}] Error decoding packet body:`, err.message);
    }
    
    // Handle different packet types
    if (type === 2 || type === 0) { // SERVERDATA_RESPONSE_VALUE or SERVERDATA_RESPONSE_AUTH
      // Find and resolve the pending request
      const pendingRequest = this.pendingRequests.get(id);
      if (pendingRequest) {
        pendingRequest.resolve(body);
        this.pendingRequests.delete(id);
      }
    }
  }
  
  /**
   * Reject all pending requests with an error
   * @private
   * @param {Error} err - The error to reject with
   */
  _rejectAllPending(err) {
    for (const [id, { reject }] of this.pendingRequests.entries()) {
      reject(err);
      this.pendingRequests.delete(id);
    }
  }
  
  /**
   * Start the keep-alive timer
   * @private
   */
  _startKeepAlive() {
    this._stopKeepAlive();
    
    // Track consecutive failures
    let consecutiveFailures = 0;
    const MAX_FAILURES = 3;
    
    // Send a keep-alive command every 60 seconds (changed from 30 seconds)
    this.keepAliveInterval = setInterval(async () => {
      try {
        // Only send keep-alive if no activity for 45 seconds (changed from 25 seconds)
        if (Date.now() - this.lastActivity > 45000) {
          console.log(`[RCON:${this.id}] Sending keep-alive ping`);
          
          // Use a simple command with timeout
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Keep-alive timed out')), 5000);
          });
          
          // Race between the command and timeout
          await Promise.race([
            this.sendCommand('list'),
            timeoutPromise
          ]);
          
          // Reset failures on success
          consecutiveFailures = 0;
          console.log(`[RCON:${this.id}] Keep-alive successful`);
        }
      } catch (err) {
        console.error(`[RCON:${this.id}] Keep-alive failed:`, err.message);
        
        // Count consecutive failures
        consecutiveFailures++;
        console.warn(`[RCON:${this.id}] Keep-alive failure #${consecutiveFailures}/${MAX_FAILURES}`);
        
        // Only disconnect after multiple consecutive failures
        if (consecutiveFailures >= MAX_FAILURES) {
          console.error(`[RCON:${this.id}] Too many consecutive keep-alive failures, disconnecting`);
          this.disconnect();
        }
      }
    }, 60000); // Changed from 30000 to 60000
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

module.exports = RconClient;