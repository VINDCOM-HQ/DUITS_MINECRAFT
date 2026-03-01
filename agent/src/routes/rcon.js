/**
 * RCON routes
 * Handles HTTP endpoints for RCON operations
 */
const express = require('express');
const router = express.Router();
const rconService = require('../services/RconService');

// Connect to an RCON server
router.post('/connect', async (req, res) => {
  try {
    const { host, port, password } = req.body;
    
    // Validate required parameters
    if (!host || !port || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: host, port, and password are required'
      });
    }
    
    // Connect to the server
    const clientId = await rconService.connect(host, port, password);
    
    res.json({
      success: true,
      clientId
    });
  } catch (err) {
    console.error('[RCON-ROUTE] Connect error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Execute an RCON command
router.post('/command', async (req, res) => {
  try {
    const { clientId, command } = req.body;
    
    // Validate required parameters
    if (!clientId || !command) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: clientId and command are required'
      });
    }
    
    // Execute the command
    const response = await rconService.executeCommand(clientId, command);
    
    res.json({
      success: true,
      response
    });
  } catch (err) {
    console.error('[RCON-ROUTE] Command error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Disconnect from an RCON server
router.post('/disconnect', async (req, res) => {
  try {
    const { clientId } = req.body;
    
    // Validate required parameters
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: clientId is required'
      });
    }
    
    // Disconnect from the server
    await rconService.disconnect(clientId);
    
    res.json({
      success: true
    });
  } catch (err) {
    console.error('[RCON-ROUTE] Disconnect error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Reconnect an RCON client
router.post('/reconnect', async (req, res) => {
  try {
    const { clientId } = req.body;
    
    // Validate required parameters
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: clientId is required'
      });
    }
    
    // Reconnect the client
    const success = await rconService.reconnect(clientId);
    
    res.json({
      success
    });
  } catch (err) {
    console.error('[RCON-ROUTE] Reconnect error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Get connection parameters
router.get('/params', async (req, res) => {
  try {
    const { clientId } = req.query;
    
    // Validate required parameters
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: clientId is required'
      });
    }
    
    // Get connection parameters
    const params = rconService.getConnectionParams(clientId);
    
    res.json({
      success: true,
      ...params
    });
  } catch (err) {
    console.error('[RCON-ROUTE] Get params error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;