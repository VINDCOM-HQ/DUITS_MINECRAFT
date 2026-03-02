/**
 * Enhanced RCON Client for Minecraft
 * A more robust implementation with improved error handling and connection management
 */
const net = require('net');
const EventEmitter = require('events');

class RconClient extends EventEmitter {
  static SERVERDATA_AUTH           = 3;
  static SERVERDATA_AUTH_RESPONSE  = 2;
  static SERVERDATA_EXECCOMMAND    = 2;
  static SERVERDATA_RESPONSE_VALUE = 0;

  constructor(host, port, password, timeout = 5000) {
    super();
    
    this.host     = host;
    this.port     = port;
    this.password = password;
    this.timeout  = timeout;
    this.reqId    = 0;
    this.socket   = null;
    this._buffer  = Buffer.alloc(0);
    this._callbacks = new Map();
    
    // Store connection parameters for reconnection
    this.connectionParams = {
      host,
      port,
      password,
      timeout
    };
    
    // Connection state
    this.connected = false;
    this.authenticated = false;
    this.connecting = false;
    this.lastActivity = Date.now();
    
    // Add keepalive ping timer
    this.keepaliveInterval = null;
    this.keepaliveTimeout = 30000;  // 30 seconds between keepalives
    this.maxIdleTime = 45000;       // 45 seconds of inactivity before auto-reconnect
    this.consecutiveFailures = 0;
    this.maxConsecutiveFailures = 3;
    
    // Generate a unique client ID for logging
    this.id = Math.random().toString(36).substring(2, 10);
    
    // Create our default error handler - IMPORTANT: prevents unhandled error events
    this.on('error', (err) => {
      console.error(`[RCON:${this.id}] Error event handled: ${err.message}`);
      // Default handler just logs - caller should add their own specific handlers
    });
    
    console.log(`[RCON:${this.id}] Client created for ${this.host}:${this.port}`);
  }

  _nextId() {
    return ++this.reqId;
  }

  _onData(chunk) {
    // Update activity timestamp on data received
    this.lastActivity = Date.now();
    
    this._buffer = Buffer.concat([this._buffer, chunk]);
    
    // Process all complete packets
    while (this._buffer.length >= 4) {
      const length = this._buffer.readInt32LE(0);
      if (this._buffer.length < 4 + length) break;
      
      const packet = this._buffer.slice(4, 4 + length);
      this._buffer = this._buffer.slice(4 + length);
      
      const id   = packet.readInt32LE(0);
      const type = packet.readInt32LE(4);
      const str  = packet.slice(8, packet.length - 2).toString('utf8');
      
      // Find and resolve the callback for this request ID
      const cb = this._callbacks.get(id);
      if (cb) {
        this._callbacks.delete(id);
        cb.resolve({ type, str });
        
        // Reset consecutive failures on successful response
        this.consecutiveFailures = 0;
      }
    }
  }

  _sendPacket(type, payload) {
    const id   = this._nextId();
    const body = Buffer.from(payload, 'utf8');
    const packet = Buffer.alloc(4 + 4 + 4 + body.length + 2);
    const length = 4 + 4 + body.length + 2;
    
    packet.writeInt32LE(length, 0);
    packet.writeInt32LE(id,     4);
    packet.writeInt32LE(type,   8);
    body.copy(packet, 12);
    packet.writeInt16LE(0, 12 + body.length);

    return new Promise((resolve, reject) => {
      // Enhanced socket check
      if (!this.socket) {
        return reject(new Error(`Socket not initialized for ${this.host}:${this.port}`));
      }
      
      if (this.socket.destroyed) {
        return reject(new Error(`Socket is destroyed for ${this.host}:${this.port}`));
      }
      
      if (!this.connected) {
        return reject(new Error(`Not connected to RCON server at ${this.host}:${this.port}`));
      }
      
      try {
        // Store callback with timeout
        this._callbacks.set(id, { resolve, reject });
        
        // Set timeout for this specific request
        const timeout = setTimeout(() => {
          if (this._callbacks.has(id)) {
            this._callbacks.delete(id);
            
            // If request times out, increment failures
            this.consecutiveFailures++;
            
            // Create descriptive error
            const timeoutErr = new Error(`Request to ${this.host}:${this.port} timed out after ${this.timeout}ms`);
            
            // If we have too many failures, mark connection as broken
            if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
              this.connected = false;
              this.authenticated = false;
              
              // Clean up socket on repeated failures
              if (this.socket) {
                try {
                  this.socket.removeAllListeners();
                  this.socket.destroy();
                } catch (cleanupErr) {
                  console.error(`[RCON:${this.id}] Error during socket cleanup:`, cleanupErr.message);
                }
                this.socket = null;
              }
            }
            
            reject(timeoutErr);
          }
        }, this.timeout);
        
        // Update last activity time
        this.lastActivity = Date.now();
        
        // Send the packet with error handling
        this.socket.write(packet, (err) => {
          if (err) {
            clearTimeout(timeout);
            this._callbacks.delete(id);
            this.consecutiveFailures++;
            
            // Enhanced error message
            const writeErr = new Error(`Failed to send RCON packet to ${this.host}:${this.port}: ${err.message}`);
            
            // On write error, mark connection as broken
            this.connected = false;
            this.authenticated = false;
            
            // Clean up socket
            if (this.socket) {
              try {
                this.socket.removeAllListeners();
                this.socket.destroy();
              } catch (cleanupErr) {
                console.error(`[RCON:${this.id}] Error during socket cleanup:`, cleanupErr.message);
              }
              this.socket = null;
            }
            
            reject(writeErr);
          }
        });
      } catch (err) {
        this._callbacks.delete(id);
        this.consecutiveFailures++;
        
        // Enhanced error
        const sendErr = new Error(`Exception sending packet to ${this.host}:${this.port}: ${err.message}`);
        
        // On exception, mark connection as broken
        this.connected = false;
        this.authenticated = false;
        
        // Clean up socket
        if (this.socket) {
          try {
            this.socket.removeAllListeners();
            this.socket.destroy();
          } catch (cleanupErr) {
            console.error(`[RCON:${this.id}] Error during socket cleanup:`, cleanupErr.message);
          }
          this.socket = null;
        }
        
        reject(sendErr);
      }
    });
  }

  connect() {
    // If already connected, just return
    if (this.connected && this.authenticated) {
      console.log(`[RCON:${this.id}] Already connected and authenticated`);
      return Promise.resolve();
    }
    
    // If connection in progress, wait for it
    if (this.connecting) {
      console.log(`[RCON:${this.id}] Connection already in progress`);
      return new Promise((resolve, reject) => {
        this.once('connect', resolve);
        this.once('error', reject);
      });
    }
    
    this.connecting = true;
    
    return new Promise((resolve, reject) => {
      try {
        console.log(`[RCON:${this.id}] Connecting to ${this.host}:${this.port}`);
        
        // Validate connection parameters
        if (!this.host || !this.port) {
          this.connecting = false;
          return reject(new Error('Invalid connection parameters: host and port are required'));
        }
        
        // Stop any existing keepalive interval
        this._stopKeepalive();
        
        // Clean up any existing socket
        if (this.socket) {
          try {
            this.socket.removeAllListeners();
            this.socket.end();
            this.socket.destroy();
          } catch (err) {
            console.error(`[RCON:${this.id}] Error cleaning up existing socket:`, err.message);
          }
          this.socket = null;
        }
        
        // Reset connection state
        this.connected = false;
        this.authenticated = false;
        this._buffer = Buffer.alloc(0);
        
        // Set a connection timeout
        const connectionTimeout = setTimeout(() => {
          console.error(`[RCON:${this.id}] Connection attempt to ${this.host}:${this.port} timed out after ${this.timeout}ms`);
          
          // Clean up
          this.connecting = false;
          if (this.socket) {
            try {
              this.socket.removeAllListeners();
              this.socket.destroy();
            } catch (cleanupErr) {
              console.error(`[RCON:${this.id}] Error during socket cleanup after timeout:`, cleanupErr.message);
            }
            this.socket = null;
          }
          
          const timeoutErr = new Error(`Connection to ${this.host}:${this.port} timed out after ${this.timeout}ms`);
          this.emit('error', timeoutErr);
          reject(timeoutErr);
        }, this.timeout);
        
        // Try to create a socket
        try {
          console.log(`[RCON:${this.id}] Creating socket to ${this.host}:${this.port}`);
          
          const socket = new net.Socket();
          this.socket = socket;
          
          // Set up socket options
          socket.setTimeout(this.timeout);
          
          // Set up connection handler
          socket.once('connect', async () => {
            try {
              // Clear the connection timeout
              clearTimeout(connectionTimeout);

              console.log(`[RCON:${this.id}] Socket connected to ${this.host}:${this.port}`);

              // Disable socket timeout after successful connection - we use our own keepalive
              socket.setTimeout(0);

              // Configure socket for better reliability
              socket.setKeepAlive(true, 5000);
              socket.setNoDelay(true);
              
              // Handle data events
              socket.on('data', this._onData.bind(this));
              
              // Set up persistent error handlers
              this._setupSocketListeners();
              
              // Set connected flag (but not authenticated yet)
              this.connected = true;
              
              // Authenticate with the server
              console.log(`[RCON:${this.id}] Authenticating with server...`);
              const resp = await this._sendPacket(RconClient.SERVERDATA_AUTH, this.password);
              
              if (resp.type !== RconClient.SERVERDATA_AUTH_RESPONSE) {
                throw new Error('Authentication failed - invalid response type');
              }
              
              // Update state
              this.authenticated = true;
              this.connecting = false;
              this.lastActivity = Date.now();
              this.consecutiveFailures = 0;
              
              console.log(`[RCON:${this.id}] Successfully authenticated`);
              
              // Start keepalive
              this._startKeepalive();
              
              // Emit event
              this.emit('connect');
              
              resolve();
            } catch (err) {
              console.error(`[RCON:${this.id}] Authentication failed:`, err.message);
              
              // Clean up
              this.connecting = false;
              this.connected = false;
              this.authenticated = false;
              
              // Close socket
              if (socket) {
                socket.removeAllListeners();
                socket.end();
                socket.destroy();
              }
              this.socket = null;
              
              // Emit error
              this.emit('error', err);
              
              reject(err);
            }
          });
          
          // Set up error handler
          socket.once('error', (err) => {
            // Clear the connection timeout
            clearTimeout(connectionTimeout);
            
            // Enhance error message with connection details
            const enhancedError = new Error(`Socket error connecting to ${this.host}:${this.port}: ${err.message}`);
            console.error(`[RCON:${this.id}] ${enhancedError.message}`);
            
            // Clean up
            this.connecting = false;
            this.connected = false;
            this.authenticated = false;
            
            // Safely cleanup socket
            if (socket) {
              try {
                socket.removeAllListeners();
                socket.destroy();
              } catch (cleanupErr) {
                console.error(`[RCON:${this.id}] Error during socket cleanup after error:`, cleanupErr.message);
              }
            }
            this.socket = null;
            
            // Emit error with enhanced message
            this.emit('error', enhancedError);
            
            reject(enhancedError);
          });
          
          // Set up timeout handler
          socket.once('timeout', () => {
            // Clear the connection timeout
            clearTimeout(connectionTimeout);
            
            console.error(`[RCON:${this.id}] Socket timeout during connect to ${this.host}:${this.port}`);
            
            // Clean up
            this.connecting = false;
            this.connected = false;
            this.authenticated = false;
            
            // Safely cleanup socket
            if (socket) {
              try {
                socket.removeAllListeners();
                socket.destroy();
              } catch (cleanupErr) {
                console.error(`[RCON:${this.id}] Error during socket cleanup after timeout:`, cleanupErr.message);
              }
            }
            this.socket = null;
            
            // Create an error with connection details
            const timeoutErr = new Error(`Socket timed out during connection to ${this.host}:${this.port}`);
            
            // Emit error
            this.emit('error', timeoutErr);
            
            reject(timeoutErr);
          });
          
          // Connect the socket
          socket.connect({
            host: this.host,
            port: this.port
          });
        } catch (socketErr) {
          // Clear the connection timeout
          clearTimeout(connectionTimeout);
          
          console.error(`[RCON:${this.id}] Socket creation failed:`, socketErr.message);
          
          // Clean up
          this.connecting = false;
          this.connected = false;
          this.authenticated = false;
          this.socket = null;
          
          reject(socketErr);
        }
      } catch (err) {
        // Handle any unexpected errors during connection setup
        console.error(`[RCON:${this.id}] Unexpected error during connection setup:`, err.message);
        
        this.connecting = false;
        this.connected = false;
        this.authenticated = false;
        
        reject(new Error(`RCON connection setup error: ${err.message}`));
      }
    });
  }
  
  // Set up persistent socket event listeners
  _setupSocketListeners() {
    if (!this.socket) return;
    
    // Handle socket errors
    this.socket.on('error', (err) => {
      console.error(`[RCON:${this.id}] Socket error:`, err.message);
      
      // Mark connection as broken
      this.connected = false;
      this.authenticated = false;
      this.consecutiveFailures++;
      
      // Clean up socket more aggressively on ECONNRESET
      if (err.code === 'ECONNRESET' || err.message.includes('ECONNRESET')) {
        console.error(`[RCON:${this.id}] Connection reset by server, will reconnect on next command`);
        
        try {
          this.socket.removeAllListeners('data');
          this.socket.destroy();
        } catch (cleanupErr) {
          console.error(`[RCON:${this.id}] Error during socket cleanup after ECONNRESET:`, cleanupErr.message);
        }
        this.socket = null;
      }
      
      // Reject all pending callbacks with detailed error
      const enhancedError = new Error(`Socket error: ${err.message}`);
      enhancedError.originalError = err;
      enhancedError.code = err.code;
      
      this._rejectAllPending(enhancedError);
      
      // Emit event with enhanced error
      this.emit('error', enhancedError);
      
      // If this is a connection reset, attempt reconnection with exponential backoff
      if ((err.code === 'ECONNRESET' || err.message.includes('ECONNRESET')) && 
          this.connectionParams && 
          !this.connecting) {
        
        // Calculate appropriate delay with exponential backoff
        const reconnectDelay = this._getReconnectDelay();
        
        // Queue a reconnection attempt (don't await - just put it in the event loop)
        setTimeout(() => {
          if (!this.isConnected() && !this.connecting) {
            console.log(`[RCON:${this.id}] Attempting reconnection after ECONNRESET`);
            
            // Use stored parameters to reconnect
            this.host = this.connectionParams.host;
            this.port = this.connectionParams.port;
            this.password = this.connectionParams.password;
            this.timeout = this.connectionParams.timeout;
            
            this.connect()
              .then(() => {
                console.log(`[RCON:${this.id}] Auto-reconnect successful`);
                this.consecutiveFailures = 0; // Reset on success
              })
              .catch(reconnectErr => {
                console.error(`[RCON:${this.id}] Auto-reconnect failed:`, reconnectErr.message);
              });
          }
        }, reconnectDelay);
      }
    });
    
    // Handle socket close
    this.socket.on('close', (hadError) => {
      console.log(`[RCON:${this.id}] Socket closed ${hadError ? 'with error' : 'gracefully'}`);
      
      this.connected = false;
      this.authenticated = false;
      this.socket = null;
      
      // Reject all pending callbacks
      this._rejectAllPending(new Error('Socket closed'));
      
      // Increment consecutive failures on error
      if (hadError) {
        this.consecutiveFailures++;
      }
      
      // Emit event
      this.emit('close', hadError);
    });
    
    // Handle socket end
    this.socket.on('end', () => {
      console.log(`[RCON:${this.id}] Socket ended by server - will try to reconnect on next command`);
      
      this.connected = false;
      this.authenticated = false;
      
      // Cleanup socket resources
      try {
        this.socket.removeAllListeners('data');
        this.socket.destroy();
      } catch (err) {
        console.error(`[RCON:${this.id}] Error during socket cleanup after end:`, err.message);
      }
      this.socket = null;
      
      // Reject all pending callbacks
      this._rejectAllPending(new Error('Socket ended by server'));
      
      // Increment consecutive failures
      this.consecutiveFailures++;
      
      // Emit event
      this.emit('end');
    });
    
    // Handle socket timeout - this should only happen during initial connection
    // since we disable timeout after successful connection
    this.socket.on('timeout', () => {
      console.log(`[RCON:${this.id}] Socket timeout (should only occur during connection phase)`);

      // Only increment failures if we're not yet authenticated
      // After authentication, socket timeout is disabled so this shouldn't fire
      if (!this.authenticated) {
        this.consecutiveFailures++;
      }

      // Emit event
      this.emit('timeout');
    });
  }
  
  // Reject all pending callbacks when socket fails
  _rejectAllPending(error) {
    for (const [id, { reject }] of this._callbacks.entries()) {
      reject(error);
      this._callbacks.delete(id);
    }
  }

  async command(cmd) {
    // Check if we need to reconnect
    if (!this.isConnected()) {
      // Check if we're already trying to reconnect
      if (this.connecting) {
        console.log(`[RCON:${this.id}] Reconnection already in progress, waiting...`);
        
        // Wait for the current connection attempt to complete
        try {
          await new Promise((resolve, reject) => {
            const connectListener = () => {
              this.removeListener('error', errorListener);
              resolve();
            };
            
            const errorListener = (err) => {
              this.removeListener('connect', connectListener);
              reject(err);
            };
            
            this.once('connect', connectListener);
            this.once('error', errorListener);
            
            // Set a timeout to prevent waiting forever
            setTimeout(() => {
              this.removeListener('connect', connectListener);
              this.removeListener('error', errorListener);
              reject(new Error('Timed out waiting for reconnection'));
            }, this.timeout);
          });
        } catch (waitErr) {
          console.error(`[RCON:${this.id}] Failed while waiting for reconnect:`, waitErr.message);
          throw new Error(`Connection issue: ${waitErr.message}`);
        }
      } else if (this.connectionParams) {
        // Attempt auto-reconnect if we have connection parameters available
        console.log(`[RCON:${this.id}] Not connected, attempting reconnect...`);
        
        // Get appropriate delay based on consecutive failures
        const reconnectDelay = this._getReconnectDelay();
        
        // If we've had multiple failures, wait before reconnecting
        if (reconnectDelay > 1000) {
          console.log(`[RCON:${this.id}] Waiting ${reconnectDelay}ms before reconnect attempt`);
          await new Promise(resolve => setTimeout(resolve, reconnectDelay));
        }
        
        try {
          // Use stored parameters to reconnect
          this.host = this.connectionParams.host;
          this.port = this.connectionParams.port;
          this.password = this.connectionParams.password;
          this.timeout = this.connectionParams.timeout;
          
          // Reconnect
          await this.connect();
          console.log(`[RCON:${this.id}] Successfully reconnected`);
          
          // Reset consecutive failures on successful reconnect
          this.consecutiveFailures = 0;
        } catch (reconnectErr) {
          console.error(`[RCON:${this.id}] Failed to reconnect to ${this.host}:${this.port}:`, reconnectErr.message);
          throw new Error(`Not connected to RCON server at ${this.host}:${this.port}: ${reconnectErr.message}`);
        }
      } else {
        throw new Error('Not connected to RCON server and no connection parameters available');
      }
    }
    
    // Double-check connection status after potential reconnection
    if (!this.isConnected()) {
      throw new Error(`Still not connected to RCON server after reconnection attempt`);
    }
    
    if (!this.authenticated) {
      throw new Error('Not authenticated with RCON server');
    }
    
    try {
      console.log(`[RCON:${this.id}] Sending command: ${cmd.substring(0, 20)}${cmd.length > 20 ? '...' : ''}`);
      
      // Update last activity time
      this.lastActivity = Date.now();
      
      // Send command and await response with timeout
      const resp = await this._sendPacket(RconClient.SERVERDATA_EXECCOMMAND, cmd);
      
      // Validate response type
      if (resp.type !== RconClient.SERVERDATA_RESPONSE_VALUE) {
        throw new Error(`Unexpected packet type ${resp.type}`);
      }
      
      // Command succeeded, update activity time again
      this.lastActivity = Date.now();
      this.consecutiveFailures = 0;
      
      return resp.str;
    } catch (err) {
      console.error(`[RCON:${this.id}] Command error:`, err.message);
      
      // If socket error occurs, clean up the socket
      if (err.message.includes('Socket') || 
          err.message.includes('write after end') || 
          err.message.includes('ECONNRESET') ||
          err.code === 'ECONNRESET' ||
          err.message.includes('not opened') ||
          err.message.includes('timed out') ||
          err.message.includes('ETIMEDOUT') ||
          err.code === 'ETIMEDOUT' ||
          err.message.includes('EHOSTUNREACH') ||
          err.code === 'EHOSTUNREACH' ||
          err.message.includes('ECONNREFUSED') ||
          err.code === 'ECONNREFUSED') {
        
        this.consecutiveFailures++;
        console.error(`[RCON:${this.id}] Network error to ${this.host}:${this.port}: ${err.message}`);
        
        if (this.socket) {
          try {
            this.socket.removeAllListeners();
            this.socket.destroy();
          } catch (closeErr) {
            console.error(`[RCON:${this.id}] Error during socket cleanup: ${closeErr.message}`);
          }
          this.socket = null;
        }
        
        this.connected = false;
        this.authenticated = false;
        
        // Emit a disconnection event so client knows connection was lost
        this.emit('error', new Error(`Connection lost to ${this.host}:${this.port}: ${err.message}`));
      }
      
      throw err;
    }
  }

  disconnect() {
    // Stop the keepalive timer first
    this._stopKeepalive();
    
    if (this.socket) {
      try {
        // Properly clean up the socket
        this.socket.removeAllListeners();
        this.socket.end();
        this.socket.destroy();
        console.log(`[RCON:${this.id}] Disconnected from ${this.host}:${this.port}`);
      } catch (err) {
        console.error(`[RCON:${this.id}] Error during disconnect:`, err.message);
      } finally {
        // Always null out the socket reference
        this.socket = null;
        // Clear any pending callbacks
        this._callbacks.clear();
        // Update connection state
        this.connected = false;
        this.authenticated = false;
      }
    }
    
    // Emit event
    this.emit('disconnect');
  }
  
  // Start keepalive timer to maintain the connection
  _startKeepalive() {
    this._stopKeepalive();
    
    console.log(`[RCON:${this.id}] Starting keepalive timer (interval: ${this.keepaliveTimeout}ms)`);
    
    this.keepaliveInterval = setInterval(async () => {
      try {
        // Check if we're still connected
        if (!this.isConnected()) {
          console.log(`[RCON:${this.id}] Keepalive - connection lost, attempting reconnect`);
          
          // Try to reconnect if we aren't already connecting
          if (!this.connecting && this.connectionParams && this.consecutiveFailures < this.maxConsecutiveFailures) {
            try {
              // Use stored parameters to reconnect
              this.host = this.connectionParams.host;
              this.port = this.connectionParams.port;
              this.password = this.connectionParams.password;
              this.timeout = this.connectionParams.timeout;
              
              // Reconnect
              await this.connect();
              console.log(`[RCON:${this.id}] Keepalive - successfully reconnected`);
              this.consecutiveFailures = 0;
              return;
            } catch (reconnectErr) {
              console.error(`[RCON:${this.id}] Keepalive - reconnect failed:`, reconnectErr.message);
              this.consecutiveFailures++;
            }
          }
          
          // If we can't reconnect, or don't have params, stop the timer
          if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
            this._stopKeepalive();
          }
          return;
        }
        
        // Only send keepalive if we haven't had activity recently
        const idleTime = this.getIdleTime();
        
        if (idleTime > this.keepaliveTimeout / 2) {
          console.log(`[RCON:${this.id}] Keepalive check - idle for ${Math.round(idleTime/1000)}s, sending ping`);
          
          // Send a simple command to check connection
          await this._sendKeepaliveCommand();
          
          // Reset consecutive failures on successful ping
          this.consecutiveFailures = 0;
          
          console.log(`[RCON:${this.id}] Keepalive successful`);
        }
      } catch (err) {
        console.warn(`[RCON:${this.id}] Keepalive failed:`, err.message);
        this.consecutiveFailures++;
        
        console.warn(`[RCON:${this.id}] Keepalive failure #${this.consecutiveFailures}/${this.maxConsecutiveFailures}`);
        
        // If socket error occurs, clean up the socket
        if (err.message.includes('Socket') || 
            err.message.includes('write after end') || 
            err.message.includes('ECONNRESET') ||
            err.message.includes('not opened') ||
            err.message.includes('timed out') ||
            err.message.includes('ETIMEDOUT') ||
            err.message.includes('EHOSTUNREACH') ||
            err.message.includes('ECONNREFUSED')) {
          
          // Cleanup socket to force reconnection on next command
          if (this.socket) {
            try {
              this.socket.removeAllListeners();
              this.socket.destroy();
            } catch (cleanupErr) {
              console.error(`[RCON:${this.id}] Error during socket cleanup:`, cleanupErr.message);
            }
            this.socket = null;
          }
          
          this.connected = false;
          this.authenticated = false;
        }
        
        // If we've had too many errors, disconnect
        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
          console.error(`[RCON:${this.id}] Too many consecutive RCON failures, disconnecting`);
          this.disconnect();
        }
      }
    }, this.keepaliveTimeout / 3); // Check more frequently than the keepalive threshold
  }
  
  // Stop the keepalive timer
  _stopKeepalive() {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
  }
  
  // Send a harmless command to keep the connection alive
  async _sendKeepaliveCommand() {
    if (!this.isConnected()) {
      throw new Error('Not connected to RCON server');
    }
    
    try {
      // Use a command that won't spam server logs
      const resp = await this._sendPacket(RconClient.SERVERDATA_EXECCOMMAND, 'help');
      
      // Update last activity time on successful ping
      this.lastActivity = Date.now();
      
      return resp.str;
    } catch (err) {
      console.error(`[RCON:${this.id}] Keepalive command failed:`, err.message);
      throw err;
    }
  }
  
  // Method to check if connection is still valid
  isConnected() {
    return this.connected && this.authenticated && this.socket && !this.socket.destroyed;
  }
  
  // Method to get time since last activity in milliseconds
  getIdleTime() {
    return Date.now() - this.lastActivity;
  }
  
  // Calculate exponential backoff time for reconnection attempts
  _getReconnectDelay() {
    // Base delay of 1 second
    const baseDelay = 1000;
    
    // Calculate exponential delay with jitter
    const maxDelay = Math.min(30000, baseDelay * Math.pow(2, this.consecutiveFailures));
    
    // Add random jitter (± 20%) to avoid reconnection storms
    const jitter = Math.random() * 0.4 - 0.2; // Random value between -0.2 and 0.2
    const delay = Math.floor(maxDelay * (1 + jitter));
    
    console.log(`[RCON:${this.id}] Reconnect delay after ${this.consecutiveFailures} failures: ${delay}ms`);
    
    return delay;
  }
}

module.exports = RconClient;