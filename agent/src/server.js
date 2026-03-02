#!/usr/bin/env node
/**
 * VINDCOM NetherDeck Agent Server
 * 
 * Starts the agent server and handles process events
 */
const { init } = require('./app');
const { getConfig } = require('./config');
const rconService = require('./services/RconService');
const smbService = require('./services/SmbService');
const mysqlService = require('./services/MySqlService');
const queryService = require('./services/QueryService');

// The environment variables are now loaded by the config module
// This is kept for backward compatibility but is not actually needed
// The proper loading happens in config/index.js

// Start the server
async function startServer() {
  try {
    // Initialize the application
    const server = init();
    const config = getConfig();

    // Start listening on the configured port
    return new Promise((resolve, reject) => {
      server.listen(config.port, () => {
        console.log(`[SERVER] NetherDeck Agent server listening on port ${config.port}`);
        console.log(`[SERVER] API Key ${config.apiKey ? 'configured' : 'not configured'}`);
        console.log(`[SERVER] TLS ${config.tls && config.tls.enabled ? 'enabled' : 'disabled'}`);
        console.log(`[SERVER] CORS ${config.allowCors ? 'enabled' : 'disabled'}`);
        resolve(server);
      });

      server.on('error', (err) => {
        console.error('[SERVER] Server error:', err);
        reject(err);
      });
    });
  } catch (err) {
    console.error('[SERVER] Failed to start server:', err);
    // Don't call process.exit() when embedded - throw the error instead
    throw err;
  }
}

// Handle process events
process.on('uncaughtException', (err) => {
  console.error('[SERVER] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Unhandled rejection at:', promise, 'reason:', reason);
});

process.on('SIGINT', async () => {
  console.log('[SERVER] SIGINT received, shutting down...');
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[SERVER] SIGTERM received, shutting down...');
  await shutdown();
  process.exit(0);
});

// Graceful shutdown function
async function shutdown() {
  console.log('[SERVER] Shutting down services...');
  
  try {
    // Shut down services
    await Promise.all([
      rconService.shutdown(),
      smbService.shutdown(),
      mysqlService.shutdown(),
      queryService.shutdown()
    ]);
    
    console.log('[SERVER] All services shut down successfully');
  } catch (err) {
    console.error('[SERVER] Error during shutdown:', err);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  shutdown
};