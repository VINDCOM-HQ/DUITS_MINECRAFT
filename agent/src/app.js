/**
 * Main application file
 * Sets up Express, middleware, and routes
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Import configuration
const config = require('./config');
const { loadConfig, getConfig } = config;

// Import utilities
const { createLogger } = require('./utils/logger');

// Import middleware
const { apiKeyAuth } = require('./middleware/auth');

// Import routes
const routes = require('./routes');

// Import Socket.IO setup
const { setupSocketServer } = require('./socket');

// Create Express application
const app = express();

/**
 * Initialize the application
 * @returns {Object} The configured server
 */
function init() {
  // Load configuration
  const config = loadConfig();
  
  // Set up middleware
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  
  // Enable CORS if configured
  if (config.allowCors) {
    app.use(cors());
  }
  
  // Set up logging
  app.use(createLogger(config.logFormat));
  
  // Mount API routes with authentication
  app.use('/api', apiKeyAuth, routes);
  
  // Root route for health check
  app.get('/', (req, res) => {
    res.json({
      name: 'NetherDeck Agent',
      version: '1.0.0',
      status: 'ok'
    });
  });
  
  // Dedicated health check endpoint - no authentication required
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal Server Error'
    });
  });
  
  // Create HTTP or HTTPS server
  let server;
  
  if (config.tls && config.tls.enabled && config.tls.cert && config.tls.key) {
    // Create HTTPS server
    const httpsOptions = {
      cert: fs.readFileSync(config.tls.cert),
      key: fs.readFileSync(config.tls.key)
    };
    
    // Add passphrase if provided
    if (config.tls.passphrase) {
      httpsOptions.passphrase = config.tls.passphrase;
    }
    
    server = https.createServer(httpsOptions, app);
    console.log('[APP] Created HTTPS server with TLS enabled');
  } else {
    // Create HTTP server
    server = http.createServer(app);
    console.log('[APP] Created HTTP server');
  }
  
  // Set up Socket.IO
  const io = setupSocketServer(server);
  
  return server;
}

module.exports = {
  app,
  init
};