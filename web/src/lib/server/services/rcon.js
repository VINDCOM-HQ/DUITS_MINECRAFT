/**
 * Enhanced RCON Client for Minecraft (ESM)
 * A robust implementation with improved error handling and connection management.
 * Ported from lib/rcon.js (CommonJS) to ESM.
 */
import net from 'node:net'
import { EventEmitter } from 'node:events'

export default class RconClient extends EventEmitter {
  static SERVERDATA_AUTH           = 3
  static SERVERDATA_AUTH_RESPONSE  = 2
  static SERVERDATA_EXECCOMMAND    = 2
  static SERVERDATA_RESPONSE_VALUE = 0

  constructor(host, port, password, timeout = 5000) {
    super()

    this.host     = host
    this.port     = port
    this.password = password
    this.timeout  = timeout
    this.reqId    = 0
    this.socket   = null
    this._buffer  = Buffer.alloc(0)
    this._callbacks = new Map()

    // Store connection parameters as a frozen snapshot for reconnection
    this.connectionParams = Object.freeze({
      host,
      port,
      password,
      timeout
    })

    // Connection state
    this.connected = false
    this.authenticated = false
    this.connecting = false
    this.lastActivity = Date.now()

    // Keepalive ping timer
    this.keepaliveInterval = null
    this.keepaliveTimeout = 30000  // 30 seconds between keepalives
    this.maxIdleTime = 45000       // 45 seconds of inactivity before auto-reconnect
    this.consecutiveFailures = 0
    this.maxConsecutiveFailures = 3

    // Unique client ID for logging
    this.id = Math.random().toString(36).substring(2, 10)

    // Default error handler - prevents unhandled error events
    this.on('error', () => {
      // Default handler - caller should add their own specific handlers
    })
  }

  _nextId() {
    return ++this.reqId
  }

  _onData(chunk) {
    // Update activity timestamp on data received
    this.lastActivity = Date.now()

    this._buffer = Buffer.concat([this._buffer, chunk])

    // Process all complete packets
    while (this._buffer.length >= 4) {
      const length = this._buffer.readInt32LE(0)
      if (this._buffer.length < 4 + length) break

      const packet = this._buffer.slice(4, 4 + length)
      this._buffer = this._buffer.slice(4 + length)

      const id   = packet.readInt32LE(0)
      const type = packet.readInt32LE(4)
      const str  = packet.slice(8, packet.length - 2).toString('utf8')

      // Find and resolve the callback for this request ID
      const cb = this._callbacks.get(id)
      if (cb) {
        this._callbacks.delete(id)
        cb.resolve({ type, str })

        // Reset consecutive failures on successful response
        this.consecutiveFailures = 0
      }
    }
  }

  _sendPacket(type, payload) {
    const id   = this._nextId()
    const body = Buffer.from(payload, 'utf8')
    const packet = Buffer.alloc(4 + 4 + 4 + body.length + 2)
    const length = 4 + 4 + body.length + 2

    packet.writeInt32LE(length, 0)
    packet.writeInt32LE(id,     4)
    packet.writeInt32LE(type,   8)
    body.copy(packet, 12)
    packet.writeInt16LE(0, 12 + body.length)

    return new Promise((resolve, reject) => {
      // Enhanced socket check
      if (!this.socket) {
        return reject(new Error(`Socket not initialized for ${this.host}:${this.port}`))
      }

      if (this.socket.destroyed) {
        return reject(new Error(`Socket is destroyed for ${this.host}:${this.port}`))
      }

      if (!this.connected) {
        return reject(new Error(`Not connected to RCON server at ${this.host}:${this.port}`))
      }

      try {
        // Store callback with timeout
        this._callbacks.set(id, { resolve, reject })

        // Set timeout for this specific request
        const requestTimeout = setTimeout(() => {
          if (this._callbacks.has(id)) {
            this._callbacks.delete(id)

            // If request times out, increment failures
            this.consecutiveFailures++

            const timeoutErr = new Error(`Request to ${this.host}:${this.port} timed out after ${this.timeout}ms`)

            // If we have too many failures, mark connection as broken
            if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
              this.connected = false
              this.authenticated = false

              // Clean up socket on repeated failures
              if (this.socket) {
                try {
                  this.socket.removeAllListeners()
                  this.socket.destroy()
                } catch (_cleanupErr) {
                  // Socket cleanup failed silently
                }
                this.socket = null
              }
            }

            reject(timeoutErr)
          }
        }, this.timeout)

        // Update last activity time
        this.lastActivity = Date.now()

        // Send the packet with error handling
        this.socket.write(packet, (err) => {
          if (err) {
            clearTimeout(requestTimeout)
            this._callbacks.delete(id)
            this.consecutiveFailures++

            const writeErr = new Error(`Failed to send RCON packet to ${this.host}:${this.port}: ${err.message}`)

            // On write error, mark connection as broken
            this.connected = false
            this.authenticated = false

            // Clean up socket
            if (this.socket) {
              try {
                this.socket.removeAllListeners()
                this.socket.destroy()
              } catch (_cleanupErr) {
                // Socket cleanup failed silently
              }
              this.socket = null
            }

            reject(writeErr)
          }
        })
      } catch (err) {
        this._callbacks.delete(id)
        this.consecutiveFailures++

        const sendErr = new Error(`Exception sending packet to ${this.host}:${this.port}: ${err.message}`)

        // On exception, mark connection as broken
        this.connected = false
        this.authenticated = false

        // Clean up socket
        if (this.socket) {
          try {
            this.socket.removeAllListeners()
            this.socket.destroy()
          } catch (_cleanupErr) {
            // Socket cleanup failed silently
          }
          this.socket = null
        }

        reject(sendErr)
      }
    })
  }

  connect() {
    // If already connected, just return
    if (this.connected && this.authenticated) {
      return Promise.resolve()
    }

    // If connection in progress, wait for it
    if (this.connecting) {
      return new Promise((resolve, reject) => {
        this.once('connect', resolve)
        this.once('error', reject)
      })
    }

    this.connecting = true

    return new Promise((resolve, reject) => {
      try {
        // Validate connection parameters
        if (!this.host || !this.port) {
          this.connecting = false
          return reject(new Error('Invalid connection parameters: host and port are required'))
        }

        // Stop any existing keepalive interval
        this._stopKeepalive()

        // Clean up any existing socket
        if (this.socket) {
          try {
            this.socket.removeAllListeners()
            this.socket.end()
            this.socket.destroy()
          } catch (_err) {
            // Existing socket cleanup failed silently
          }
          this.socket = null
        }

        // Reset connection state
        this.connected = false
        this.authenticated = false
        this._buffer = Buffer.alloc(0)

        // Set a connection timeout
        const connectionTimeout = setTimeout(() => {
          // Clean up
          this.connecting = false
          if (this.socket) {
            try {
              this.socket.removeAllListeners()
              this.socket.destroy()
            } catch (_cleanupErr) {
              // Socket cleanup after timeout failed silently
            }
            this.socket = null
          }

          const timeoutErr = new Error(`Connection to ${this.host}:${this.port} timed out after ${this.timeout}ms`)
          this.emit('error', timeoutErr)
          reject(timeoutErr)
        }, this.timeout)

        // Try to create a socket
        try {
          const socket = new net.Socket()
          this.socket = socket

          // Set up socket options
          socket.setTimeout(this.timeout)

          // Set up connection handler
          socket.once('connect', async () => {
            try {
              // Clear the connection timeout
              clearTimeout(connectionTimeout)

              // Disable socket timeout after successful connection - we use our own keepalive
              socket.setTimeout(0)

              // Configure socket for better reliability
              socket.setKeepAlive(true, 5000)
              socket.setNoDelay(true)

              // Handle data events
              socket.on('data', this._onData.bind(this))

              // Set up persistent error handlers
              this._setupSocketListeners()

              // Set connected flag (but not authenticated yet)
              this.connected = true

              // Authenticate with the server
              const resp = await this._sendPacket(RconClient.SERVERDATA_AUTH, this.password)

              if (resp.type !== RconClient.SERVERDATA_AUTH_RESPONSE) {
                throw new Error('Authentication failed - invalid response type')
              }

              // Update state
              this.authenticated = true
              this.connecting = false
              this.lastActivity = Date.now()
              this.consecutiveFailures = 0

              // Start keepalive
              this._startKeepalive()

              // Emit event
              this.emit('connect')

              resolve()
            } catch (err) {
              // Clean up
              this.connecting = false
              this.connected = false
              this.authenticated = false

              // Close socket
              if (socket) {
                socket.removeAllListeners()
                socket.end()
                socket.destroy()
              }
              this.socket = null

              // Emit error
              this.emit('error', err)

              reject(err)
            }
          })

          // Set up error handler
          socket.once('error', (err) => {
            // Clear the connection timeout
            clearTimeout(connectionTimeout)

            const enhancedError = new Error(`Socket error connecting to ${this.host}:${this.port}: ${err.message}`)

            // Clean up
            this.connecting = false
            this.connected = false
            this.authenticated = false

            // Safely cleanup socket
            if (socket) {
              try {
                socket.removeAllListeners()
                socket.destroy()
              } catch (_cleanupErr) {
                // Socket cleanup after error failed silently
              }
            }
            this.socket = null

            // Emit error with enhanced message
            this.emit('error', enhancedError)

            reject(enhancedError)
          })

          // Set up timeout handler
          socket.once('timeout', () => {
            // Clear the connection timeout
            clearTimeout(connectionTimeout)

            // Clean up
            this.connecting = false
            this.connected = false
            this.authenticated = false

            // Safely cleanup socket
            if (socket) {
              try {
                socket.removeAllListeners()
                socket.destroy()
              } catch (_cleanupErr) {
                // Socket cleanup after timeout failed silently
              }
            }
            this.socket = null

            const timeoutErr = new Error(`Socket timed out during connection to ${this.host}:${this.port}`)

            // Emit error
            this.emit('error', timeoutErr)

            reject(timeoutErr)
          })

          // Connect the socket
          socket.connect({
            host: this.host,
            port: this.port
          })
        } catch (socketErr) {
          // Clear the connection timeout
          clearTimeout(connectionTimeout)

          // Clean up
          this.connecting = false
          this.connected = false
          this.authenticated = false
          this.socket = null

          reject(socketErr)
        }
      } catch (err) {
        // Handle any unexpected errors during connection setup
        this.connecting = false
        this.connected = false
        this.authenticated = false

        reject(new Error(`RCON connection setup error: ${err.message}`))
      }
    })
  }

  // Set up persistent socket event listeners
  _setupSocketListeners() {
    if (!this.socket) return

    // Handle socket errors
    this.socket.on('error', (err) => {
      // Mark connection as broken
      this.connected = false
      this.authenticated = false
      this.consecutiveFailures++

      // Clean up socket more aggressively on ECONNRESET
      if (err.code === 'ECONNRESET' || err.message.includes('ECONNRESET')) {
        try {
          this.socket.removeAllListeners('data')
          this.socket.destroy()
        } catch (_cleanupErr) {
          // Socket cleanup after ECONNRESET failed silently
        }
        this.socket = null
      }

      // Reject all pending callbacks with detailed error
      const enhancedError = new Error(`Socket error: ${err.message}`)
      enhancedError.originalError = err
      enhancedError.code = err.code

      this._rejectAllPending(enhancedError)

      // Emit event with enhanced error
      this.emit('error', enhancedError)

      // If this is a connection reset, attempt reconnection with exponential backoff
      if ((err.code === 'ECONNRESET' || err.message.includes('ECONNRESET')) &&
          this.connectionParams &&
          !this.connecting) {

        // Calculate appropriate delay with exponential backoff
        const reconnectDelay = this._getReconnectDelay()

        // Queue a reconnection attempt (don't await - just put it in the event loop)
        setTimeout(() => {
          if (!this.isConnected() && !this.connecting) {
            // Use stored parameters to reconnect
            this.host = this.connectionParams.host
            this.port = this.connectionParams.port
            this.password = this.connectionParams.password
            this.timeout = this.connectionParams.timeout

            this.connect()
              .then(() => {
                this.consecutiveFailures = 0 // Reset on success
              })
              .catch(() => {
                // Auto-reconnect failed silently - will retry on next command
              })
          }
        }, reconnectDelay)
      }
    })

    // Handle socket close
    this.socket.on('close', (hadError) => {
      this.connected = false
      this.authenticated = false
      this.socket = null

      // Reject all pending callbacks
      this._rejectAllPending(new Error('Socket closed'))

      // Increment consecutive failures on error
      if (hadError) {
        this.consecutiveFailures++
      }

      // Emit event
      this.emit('close', hadError)
    })

    // Handle socket end
    this.socket.on('end', () => {
      this.connected = false
      this.authenticated = false

      // Cleanup socket resources
      try {
        this.socket.removeAllListeners('data')
        this.socket.destroy()
      } catch (_err) {
        // Socket cleanup after end failed silently
      }
      this.socket = null

      // Reject all pending callbacks
      this._rejectAllPending(new Error('Socket ended by server'))

      // Increment consecutive failures
      this.consecutiveFailures++

      // Emit event
      this.emit('end')
    })

    // Handle socket timeout - this should only happen during initial connection
    // since we disable timeout after successful connection
    this.socket.on('timeout', () => {
      // Only increment failures if we're not yet authenticated
      // After authentication, socket timeout is disabled so this shouldn't fire
      if (!this.authenticated) {
        this.consecutiveFailures++
      }

      // Emit event
      this.emit('timeout')
    })
  }

  // Reject all pending callbacks when socket fails
  _rejectAllPending(error) {
    for (const [id, { reject }] of this._callbacks.entries()) {
      reject(error)
      this._callbacks.delete(id)
    }
  }

  async command(cmd) {
    // Check if we need to reconnect
    if (!this.isConnected()) {
      // Check if we're already trying to reconnect
      if (this.connecting) {
        // Wait for the current connection attempt to complete
        try {
          await new Promise((resolve, reject) => {
            const connectListener = () => {
              this.removeListener('error', errorListener)
              resolve()
            }

            const errorListener = (err) => {
              this.removeListener('connect', connectListener)
              reject(err)
            }

            this.once('connect', connectListener)
            this.once('error', errorListener)

            // Set a timeout to prevent waiting forever
            setTimeout(() => {
              this.removeListener('connect', connectListener)
              this.removeListener('error', errorListener)
              reject(new Error('Timed out waiting for reconnection'))
            }, this.timeout)
          })
        } catch (waitErr) {
          throw new Error(`Connection issue: ${waitErr.message}`)
        }
      } else if (this.connectionParams) {
        // Attempt auto-reconnect if we have connection parameters available

        // Get appropriate delay based on consecutive failures
        const reconnectDelay = this._getReconnectDelay()

        // If we've had multiple failures, wait before reconnecting
        if (reconnectDelay > 1000) {
          await new Promise(resolve => setTimeout(resolve, reconnectDelay))
        }

        try {
          // Use stored parameters to reconnect
          this.host = this.connectionParams.host
          this.port = this.connectionParams.port
          this.password = this.connectionParams.password
          this.timeout = this.connectionParams.timeout

          // Reconnect
          await this.connect()

          // Reset consecutive failures on successful reconnect
          this.consecutiveFailures = 0
        } catch (reconnectErr) {
          throw new Error(`Not connected to RCON server at ${this.host}:${this.port}: ${reconnectErr.message}`)
        }
      } else {
        throw new Error('Not connected to RCON server and no connection parameters available')
      }
    }

    // Double-check connection status after potential reconnection
    if (!this.isConnected()) {
      throw new Error('Still not connected to RCON server after reconnection attempt')
    }

    if (!this.authenticated) {
      throw new Error('Not authenticated with RCON server')
    }

    try {
      // Update last activity time
      this.lastActivity = Date.now()

      // Send command and await response with timeout
      const resp = await this._sendPacket(RconClient.SERVERDATA_EXECCOMMAND, cmd)

      // Validate response type
      if (resp.type !== RconClient.SERVERDATA_RESPONSE_VALUE) {
        throw new Error(`Unexpected packet type ${resp.type}`)
      }

      // Command succeeded, update activity time again
      this.lastActivity = Date.now()
      this.consecutiveFailures = 0

      return resp.str
    } catch (err) {
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

        this.consecutiveFailures++

        if (this.socket) {
          try {
            this.socket.removeAllListeners()
            this.socket.destroy()
          } catch (_closeErr) {
            // Socket cleanup failed silently
          }
          this.socket = null
        }

        this.connected = false
        this.authenticated = false

        // Emit a disconnection event so client knows connection was lost
        this.emit('error', new Error(`Connection lost to ${this.host}:${this.port}: ${err.message}`))
      }

      throw err
    }
  }

  disconnect() {
    // Stop the keepalive timer first
    this._stopKeepalive()

    if (this.socket) {
      try {
        // Properly clean up the socket
        this.socket.removeAllListeners()
        this.socket.end()
        this.socket.destroy()
      } catch (_err) {
        // Disconnect cleanup failed silently
      } finally {
        // Always null out the socket reference
        this.socket = null
        // Clear any pending callbacks
        this._callbacks.clear()
        // Update connection state
        this.connected = false
        this.authenticated = false
      }
    }

    // Emit event
    this.emit('disconnect')
  }

  // Start keepalive timer to maintain the connection
  _startKeepalive() {
    this._stopKeepalive()

    this.keepaliveInterval = setInterval(async () => {
      try {
        // Check if we're still connected
        if (!this.isConnected()) {
          // Try to reconnect if we aren't already connecting
          if (!this.connecting && this.connectionParams && this.consecutiveFailures < this.maxConsecutiveFailures) {
            try {
              // Use stored parameters to reconnect
              this.host = this.connectionParams.host
              this.port = this.connectionParams.port
              this.password = this.connectionParams.password
              this.timeout = this.connectionParams.timeout

              // Reconnect
              await this.connect()
              this.consecutiveFailures = 0
              return
            } catch (_reconnectErr) {
              this.consecutiveFailures++
            }
          }

          // If we can't reconnect, or don't have params, stop the timer
          if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
            this._stopKeepalive()
          }
          return
        }

        // Only send keepalive if we haven't had activity recently
        const idleTime = this.getIdleTime()

        if (idleTime > this.keepaliveTimeout / 2) {
          // Send a simple command to check connection
          await this._sendKeepaliveCommand()

          // Reset consecutive failures on successful ping
          this.consecutiveFailures = 0
        }
      } catch (_err) {
        this.consecutiveFailures++

        // If socket error occurs, clean up the socket
        if (_err.message.includes('Socket') ||
            _err.message.includes('write after end') ||
            _err.message.includes('ECONNRESET') ||
            _err.message.includes('not opened') ||
            _err.message.includes('timed out') ||
            _err.message.includes('ETIMEDOUT') ||
            _err.message.includes('EHOSTUNREACH') ||
            _err.message.includes('ECONNREFUSED')) {

          // Cleanup socket to force reconnection on next command
          if (this.socket) {
            try {
              this.socket.removeAllListeners()
              this.socket.destroy()
            } catch (_cleanupErr) {
              // Socket cleanup failed silently
            }
            this.socket = null
          }

          this.connected = false
          this.authenticated = false
        }

        // If we've had too many errors, disconnect
        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
          this.disconnect()
        }
      }
    }, this.keepaliveTimeout / 3) // Check more frequently than the keepalive threshold
  }

  // Stop the keepalive timer
  _stopKeepalive() {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval)
      this.keepaliveInterval = null
    }
  }

  // Send a harmless command to keep the connection alive
  async _sendKeepaliveCommand() {
    if (!this.isConnected()) {
      throw new Error('Not connected to RCON server')
    }

    // Use a command that won't spam server logs
    const resp = await this._sendPacket(RconClient.SERVERDATA_EXECCOMMAND, 'help')

    // Update last activity time on successful ping
    this.lastActivity = Date.now()

    return resp.str
  }

  // Check if connection is still valid
  isConnected() {
    return this.connected && this.authenticated && this.socket && !this.socket.destroyed
  }

  // Get time since last activity in milliseconds
  getIdleTime() {
    return Date.now() - this.lastActivity
  }

  // Calculate exponential backoff time for reconnection attempts
  _getReconnectDelay() {
    // Base delay of 1 second
    const baseDelay = 1000

    // Calculate exponential delay with jitter
    const maxDelay = Math.min(30000, baseDelay * Math.pow(2, this.consecutiveFailures))

    // Add random jitter (+/- 20%) to avoid reconnection storms
    const jitter = Math.random() * 0.4 - 0.2
    const delay = Math.floor(maxDelay * (1 + jitter))

    return delay
  }
}
