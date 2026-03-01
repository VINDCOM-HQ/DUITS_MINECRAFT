/**
 * Query routes
 * Handles HTTP endpoints for Minecraft server querying
 */
const express = require('express');
const router = express.Router();
const queryService = require('../services/QueryService');

// Query a Minecraft server
router.get('/', async (req, res) => {
  try {
    const { host, port, mode = 'basic', bypassCache } = req.query;
    
    // Validate required parameters
    if (!host) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: host is required'
      });
    }
    
    // Parse optional parameters
    const parsedPort = port ? parseInt(port, 10) : 25565;
    const parsedMode = ['basic', 'full'].includes(mode) ? mode : 'basic';
    const parsedBypassCache = bypassCache === 'true';
    
    // Execute the query
    const info = await queryService.query(
      host, 
      parsedPort,
      parsedMode,
      parsedBypassCache
    );
    
    res.json({
      success: true,
      info
    });
  } catch (err) {
    console.error('[QUERY-ROUTE] Query error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;