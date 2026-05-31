/**
 * MySQL IPC handlers
 * Per-window MySQL client management
 */
const MySQLClient = require('../lib/mysql');

/**
 * Safely send an IPC event to a webContents if it still exists
 * @param {Electron.WebContents} sender
 * @param {string} channel
 * @param {any} data
 */
function safeSend(sender, channel, data) {
  try {
    if (sender && !sender.isDestroyed()) {
      sender.send(channel, data);
    }
  } catch {
    // Window was closed — nothing to notify
  }
}

/**
 * Attach lifecycle listeners to a MySQL client so errors are forwarded
 * to the renderer instead of crashing the process.
 * @param {MySQLClient} client
 * @param {Electron.WebContents} sender
 * @param {Map} mysqlClients
 * @param {number} wcId
 */
function attachClientListeners(client, sender, mysqlClients, wcId) {
  client.on('error', (err) => {
    safeSend(sender, 'mysql-event', {
      type: 'error',
      message: err.message,
      code: err.code || null
    });
  });

  client.on('end', () => {
    safeSend(sender, 'mysql-event', { type: 'disconnected' });
  });

  client.on('reconnecting', ({ attempt, max }) => {
    safeSend(sender, 'mysql-event', { type: 'reconnecting', attempt, max });
  });

  client.on('reconnect', () => {
    safeSend(sender, 'mysql-event', { type: 'reconnected' });
  });

  client.on('reconnect_failed', () => {
    mysqlClients.delete(wcId);
    safeSend(sender, 'mysql-event', { type: 'reconnect_failed' });
  });
}

function register(ipcMain, getState) {
  ipcMain.handle('mysql-connect', async (event, opts) => {
    const mysqlClients = getState().mysqlClients;
    const wcId = event.sender.id;
    // Tear down existing client for this window, if any
    if (mysqlClients.has(wcId)) {
      try { await mysqlClients.get(wcId).close(); } catch {}
      mysqlClients.delete(wcId);
    }
    // Create and connect new client
    const client = new MySQLClient(opts);
    attachClientListeners(client, event.sender, mysqlClients, wcId);
    await client.connect();
    mysqlClients.set(wcId, client);
    return true;
  });

  ipcMain.handle('mysql-disconnect', async (event) => {
    const mysqlClients = getState().mysqlClients;
    const wcId = event.sender.id;
    const client = mysqlClients.get(wcId);
    if (client) {
      try { await client.close(); } catch {}
      mysqlClients.delete(wcId);
    }
    return true;
  });

  ipcMain.handle('mysql-query', async (event, sql) => {
    const mysqlClients = getState().mysqlClients;
    const wcId = event.sender.id;
    const client = mysqlClients.get(wcId);
    if (!client) throw new Error('Not connected to MySQL');
    return await client.query(sql);
  });
}

module.exports = { register };
