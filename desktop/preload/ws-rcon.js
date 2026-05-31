/**
 * RCON WebSocket methods factory.
 * Creates RCON connection, command, and disconnect methods
 * that operate over a Socket.IO connection to the agent server.
 */
const { storeClientId, clearClientId, getConnectionParams } = require('./ws-helpers');

/**
 * Create RCON methods bound to the given client state and transport.
 * @param {object} client - WebSocket client state
 * @param {Function} sendRequest - Function to send Socket.IO requests
 * @param {Function} connectWebSocket - Function to (re)establish the Socket.IO connection
 * @returns {object} { connectToRcon, rconCommand, disconnectFromRcon }
 */
function createRconMethods(client, sendRequest, connectWebSocket) {

  async function ensureSocketConnected(context) {
    if (!client.connected || !client.ws || !client.ws.connected) {
      await connectWebSocket();
    }
  }

  /**
   * Connect to a Minecraft RCON server via the agent.
   * Validates existing connections, retries on failure with exponential backoff.
   * @param {string} host - RCON server host
   * @param {number|string} port - RCON server port
   * @param {string} password - RCON password
   * @returns {Promise<string>} The client ID for the connection
   */
  const connectToRcon = async (host, port, password) => {
    if (!host || typeof host !== 'string') throw new Error('Invalid RCON host: must be a non-empty string');
    if (!port || isNaN(parseInt(port, 10))) throw new Error('Invalid RCON port: must be a number');
    if (!password || typeof password !== 'string') throw new Error('Invalid RCON password: must be a non-empty string');

    await ensureSocketConnected('RCON connection');

    // Check for existing valid connection with same params
    if (client.clientIds.rcon && client.connections && client.connections.rcon) {
      const existing = client.connections.rcon;
      if (existing.host === host &&
          existing.port === parseInt(port, 10) &&
          existing.password === password) {
        try {
          await sendRequest('command', 'rcon', {
            clientId: client.clientIds.rcon,
            command: 'list'
          });
          return client.clientIds.rcon;
        } catch (_) {
          clearClientId(client, 'rcon');
        }
      } else {
        clearClientId(client, 'rcon');
      }
    }

    // Connect with retry logic
    let lastError = null;
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await ensureSocketConnected(`RCON attempt ${attempt + 1}`);

        const result = await sendRequest('connect', 'rcon', {
          host,
          port: parseInt(port, 10),
          password
        });

        if (!result || !result.clientId) {
          throw new Error('RCON connection succeeded but no clientId was returned');
        }

        storeClientId(client, 'rcon', result.clientId, { host, port, password });

        // Verify connection with a test command (non-fatal if it fails)
        try {
          await sendRequest('command', 'rcon', {
            clientId: result.clientId,
            command: 'list'
          });
        } catch (_) {
          console.warn('[WS:RCON] Connection test failed, but connection attempt succeeded');
        }

        return result.clientId;
      } catch (err) {
        lastError = err;
        clearClientId(client, 'rcon');

        if (attempt < maxAttempts - 1) {
          const delay = 1000 * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('RCON connection failed after multiple attempts');
  };

  /**
   * Execute an RCON command via the agent.
   * Auto-reconnects on stale client IDs with retry logic.
   * @param {string} command - The RCON command to execute
   * @param {number} [maxRetries=2] - Maximum retry attempts
   * @returns {Promise<string>} The command response
   */
  const rconCommand = async (command, maxRetries = 2) => {
    // Auto-reconnect if no client ID
    if (!client.clientIds.rcon) {
      const params = getConnectionParams(client, 'rcon');
      if (params && params.host && params.port && params.password) {
        await connectToRcon(params.host, params.port, params.password);
      } else {
        throw new Error('Not connected to RCON server');
      }
    }

    await ensureSocketConnected('RCON command');

    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await sendRequest('command', 'rcon', {
          clientId: client.clientIds.rcon,
          command
        });
        return result.response;
      } catch (err) {
        lastError = err;

        const isConnError =
          err.message.includes('Not connected') ||
          err.message.includes('Client disconnected') ||
          err.message.includes('Socket.IO') ||
          err.message.includes('Client not found') ||
          err.message.includes('invalid clientId') ||
          err.message.includes('Missing clientId');

        if (isConnError && attempt < maxRetries) {
          if (err.message.includes('Client not found') ||
              err.message.includes('invalid clientId') ||
              err.message.includes('Missing clientId')) {
            clearClientId(client, 'rcon');
          }

          const params = getConnectionParams(client, 'rcon');
          if (params && params.host && params.port && params.password) {
            clearClientId(client, 'rcon');
            try {
              await connectToRcon(params.host, params.port, params.password);
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            } catch (_) { /* recovery failed, will retry or throw */ }
          }

          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`RCON command failed: ${lastError?.message || 'Unknown error'}`);
  };

  /**
   * Disconnect from the RCON server.
   */
  const disconnectFromRcon = async () => {
    if (!client.clientIds.rcon) return;
    try {
      await sendRequest('disconnect', 'rcon', {
        clientId: client.clientIds.rcon
      });
    } finally {
      clearClientId(client, 'rcon');
    }
  };

  return { connectToRcon, rconCommand, disconnectFromRcon };
}

module.exports = { createRconMethods };
