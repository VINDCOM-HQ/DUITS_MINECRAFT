/**
 * API routes index
 * Defines and combines all API routes
 */
const express = require('express');
const router = express.Router();

// Import route modules
const rconRoutes = require('./rcon');
const smbRoutes = require('./smb');
const mysqlRoutes = require('./mysql');
const queryRoutes = require('./query');

// Root endpoint - API information
router.get('/', (req, res) => {
  res.json({
    name: 'Minecraft RCON Agent API',
    status: 'ok'
  });
});

// Status endpoint
router.get('/status', (req, res) => {
  res.json({
    success: true,
    status: 'ok'
  });
});

// Health check endpoint (authenticated)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Mount routes
router.use('/rcon', rconRoutes);
router.use('/smb', smbRoutes);
router.use('/mysql', mysqlRoutes);
router.use('/query', queryRoutes);

module.exports = router;