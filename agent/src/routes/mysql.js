/**
 * MySQL routes
 * Handles HTTP endpoints for MySQL operations
 */
const express = require('express');
const router = express.Router();
const mysqlService = require('../services/MySqlService');

// Connect to a MySQL database
router.post('/connect', async (req, res) => {
  try {
    const { host, port, user, password, database, ssl } = req.body;
    
    // Validate required parameters
    if (!host || !user || !database) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: host, user, and database are required'
      });
    }
    
    // Connect to the database
    const clientId = await mysqlService.connect({
      host,
      port: port || 3306,
      user,
      password,
      database,
      ssl
    });
    
    res.json({
      success: true,
      clientId
    });
  } catch (err) {
    console.error('[MYSQL-ROUTE] Connect error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Execute a SQL query
router.post('/query', async (req, res) => {
  try {
    const { clientId, sql, params } = req.body;
    
    // Validate required parameters
    if (!clientId || !sql) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: clientId and sql are required'
      });
    }
    
    // Execute the query
    const result = await mysqlService.query(clientId, sql, params);
    
    res.json({
      success: true,
      result
    });
  } catch (err) {
    console.error('[MYSQL-ROUTE] Query error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Disconnect from a MySQL database
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
    
    // Disconnect from the database
    await mysqlService.disconnect(clientId);
    
    res.json({
      success: true
    });
  } catch (err) {
    console.error('[MYSQL-ROUTE] Disconnect error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Reconnect a MySQL client
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
    const success = await mysqlService.reconnect(clientId);
    
    res.json({
      success
    });
  } catch (err) {
    console.error('[MYSQL-ROUTE] Reconnect error:', err.message);
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
    const params = mysqlService.getConnectionParams(clientId);
    
    // Don't send the password
    const { password, ...safeParams } = params;
    
    res.json({
      success: true,
      ...safeParams
    });
  } catch (err) {
    console.error('[MYSQL-ROUTE] Get params error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;