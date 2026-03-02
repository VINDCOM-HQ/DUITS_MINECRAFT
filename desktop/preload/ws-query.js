/**
 * Query WebSocket methods factory.
 * Creates Minecraft Query protocol methods that operate
 * over a Socket.IO connection to the agent server.
 */

/**
 * Create Query methods bound to the given client state and transport.
 * @param {object} client - WebSocket client state
 * @param {Function} sendRequest - Function to send Socket.IO requests
 * @param {Function} connectWebSocket - Function to (re)establish the Socket.IO connection
 * @returns {object} { query }
 */
function createQueryMethods(client, sendRequest, connectWebSocket) {

  async function ensureSocketConnected() {
    if (!client.connected || !client.ws || !client.ws.connected) {
      await connectWebSocket();
    }
  }

  /**
   * Query a Minecraft server using the Query protocol via the agent.
   * Retries with increasing timeouts on failure.
   * Returns minimal placeholder data on total failure to keep UI clean.
   * @param {string} host - Server host
   * @param {number|string} port - Server query port
   * @param {string} [mode='basic'] - Query mode: basic, full, players, rules
   * @param {number} [maxRetries=2] - Maximum retry attempts
   * @returns {Promise<object>} Server information
   */
  const query = async (host, port, mode = 'basic', maxRetries = 2) => {
    if (!host || typeof host !== 'string') {
      throw new Error('Invalid query host: must be a non-empty string');
    }
    if (!port || isNaN(parseInt(port))) {
      throw new Error('Invalid query port: must be a number');
    }

    const validMode = ['basic', 'full', 'players', 'rules'].includes(mode) ? mode : 'basic';
    await ensureSocketConnected();

    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const timeout = 20000 + (attempt * 10000);
        const result = await sendRequest('query', 'query', {
          host,
          port: parseInt(port, 10),
          mode: validMode,
          bypassCache: attempt > 0,
          timeout
        });

        if (result && result.info) return result.info;

        return {
          hostname: 'Minecraft Server',
          version: 'Unknown',
          numPlayers: '0',
          maxPlayers: '20',
          gameType: 'MINECRAFT',
          map: 'world'
        };
      } catch (err) {
        lastError = err;

        if (err.message.includes('not connected') || err.message.includes('Socket.IO')) {
          try { await connectWebSocket(); } catch (_) { /* ignore */ }
        }

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Return minimal info on total failure to keep UI clean
    return {
      motd: `Minecraft Server (${host}:${port})`,
      version: 'Unknown',
      software: 'Minecraft',
      plugins: [],
      map: 'world',
      players: { online: 0, max: 20, list: [] },
      hostIp: host,
      hostPort: parseInt(port, 10),
      _noConnection: true
    };
  };

  return { query };
}

module.exports = { createQueryMethods };
