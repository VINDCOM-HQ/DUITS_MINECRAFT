const fs = require('fs');
const axios = require('axios');
const https = require('https');
const QueryClient = require('../lib/query');
const configModule = require('../lib/config');

function register(ipcMain) {
  ipcMain.handle('query-status', async (_e, host, port, mode = 'basic') => {
    // If agent relay is enabled, proxy via HTTP API
    try {
      const agent = configModule.getAgentSettings();
      if (agent.enabled) {
        const base = agent.url.replace(/\/$/, '');
        const params = new URLSearchParams({ host, port: String(port), mode });
        const agentUrl = `${base}/query?${params.toString()}`;
        const options = { headers: { 'x-api-key': agent.apiKey } };
        if (agent.caFile) {
          const ca = fs.readFileSync(agent.caFile);
          options.httpsAgent = new https.Agent({ ca });
        }
        const resp = await axios.get(agentUrl, options);
        if (resp.data && resp.data.success) return resp.data.info;
        throw new Error(resp.data.error || 'Agent query failed');
      }
    } catch (err) {
      throw new Error(`Agent query failed: ${err.message}`);
    }
    // Validate inputs to prevent invalid queries
    if (!host || typeof host !== 'string' || host.trim() === '') {
      throw new Error('Host is required for query');
    }
    // Ensure port is a valid integer
    const portNum = parseInt(port, 10);
    if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
      throw new Error(`Invalid query port: ${port}`);
    }
    // Create a new QueryClient with sanitized inputs
    const qc = new QueryClient(host.trim(), portNum);
    try {
      // choose query type: basic or full
      // perform basic or full query
      let info;
      if (mode === 'full' && typeof qc.queryFull === 'function') {
        info = await qc.queryFull();
      } else {
        info = await qc.queryBasic();
      }
      // annotate which host:port was actually used
      try {
        info.queryHost = qc.host;
        info.queryPort = qc.port;
      } catch (_) {}
      return info;
    } catch (err) {
      // provide guidance on timeout, include actual IP/port used
      if (err && err.message && err.message.includes('Query timed out')) {
        const usedHost = qc.host;
        const usedPort = qc.port;
        throw new Error(
          `Query timed out after ${qc.timeout}ms connecting to ${usedHost}:${usedPort}. ` +
          `Ensure your server.properties has enable-query=true and query.port=${usedPort}, ` +
          `and that UDP port ${usedPort} is reachable.`
        );
      }
      throw err;
    } finally {
      qc.close();
    }
  });
}

module.exports = { register };
