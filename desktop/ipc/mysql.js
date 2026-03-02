/**
 * MySQL IPC handlers
 * Per-window MySQL client management
 */
const MySQLClient = require('../lib/mysql');

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
