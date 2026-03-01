/**
 * MySQL WebSocket methods factory.
 * Creates MySQL connection, query, and disconnect methods
 * that operate over a Socket.IO connection to the agent server.
 */
const {
  resolveClientId,
  clearClientId,
  storeClientId,
  isInvalidClientError
} = require('./ws-helpers');

/**
 * Create MySQL methods bound to the given client state and transport.
 * @param {object} client - WebSocket client state
 * @param {Function} sendRequest - Function to send Socket.IO requests
 * @returns {object} { connectToMysql, disconnectFromMysql, mysqlQuery }
 */
function createMysqlMethods(client, sendRequest) {

  /**
   * Connect to a MySQL database via the agent.
   * @param {string} host - MySQL server host
   * @param {number|string} port - MySQL server port
   * @param {string} user - Database username
   * @param {string} password - Database password
   * @param {string} database - Database name
   * @param {boolean} [ssl=false] - Enable SSL
   * @returns {Promise<object>} Connection result with clientId
   */
  const connectToMysql = async (host, port, user, password, database, ssl = false) => {
    const result = await sendRequest('connect', 'mysql', {
      host,
      port: parseInt(port, 10),
      user,
      password,
      database,
      ssl
    });

    if (!result || !result.clientId) {
      throw new Error('MySQL connection failed: No clientId returned');
    }

    storeClientId(client, 'mysql', result.clientId, {
      host, port, user, password, database, ssl
    });

    return {
      success: true,
      clientId: result.clientId,
      usingAgent: true,
      result
    };
  };

  /**
   * Disconnect from the MySQL database.
   * @returns {Promise<object>} Disconnect result
   */
  const disconnectFromMysql = async () => {
    const clientId = resolveClientId(client, 'mysql');
    if (!clientId) {
      return { success: true, message: 'Already disconnected' };
    }

    try {
      await sendRequest('disconnect', 'mysql', { clientId });
      clearClientId(client, 'mysql');
      return { success: true };
    } catch (err) {
      clearClientId(client, 'mysql');
      throw new Error(`Failed to disconnect from MySQL: ${err.message}`);
    }
  };

  /**
   * Execute a SQL query on the connected MySQL database.
   * @param {string} query - SQL query to execute
   * @returns {Promise<*>} Query result
   */
  const mysqlQuery = async (query) => {
    const clientId = resolveClientId(client, 'mysql');
    if (!clientId) {
      throw new Error('Not connected to MySQL database - please connect first');
    }

    try {
      return await sendRequest('command', 'mysql', {
        clientId,
        sql: query
      });
    } catch (err) {
      if (isInvalidClientError(err)) clearClientId(client, 'mysql');
      throw new Error(`Failed to execute query: ${err.message}`);
    }
  };

  return { connectToMysql, disconnectFromMysql, mysqlQuery };
}

module.exports = { createMysqlMethods };
