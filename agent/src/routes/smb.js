/**
 * SMB Routes
 * Express routes for SMB operations
 */
const express = require('express');
const router = express.Router();
const smbService = require('../services/SmbService');
const { apiKeyAuth } = require('../middleware/auth');

// No simulation mode - we're testing with a real SMB server

/**
 * Connect to an SMB share
 * @route POST /api/smb/connect
 * @param {string} host - Server hostname or IP
 * @param {string} share - Share name
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {string} [domain] - Optional domain
 * @returns {object} Client ID
 */
router.post('/connect', apiKeyAuth, async (req, res) => {
  try {
    const { host, share, username, password, domain } = req.body;
    
    // Connect to SMB share
    const clientId = await smbService.connect(host, share, username, password, domain);
    
    res.json({ success: true, clientId });
  } catch (err) {
    console.error('SMB connect error:', err.message);
    res.status(500).json({ success: false, error: `SMB connect failed: ${err.message}` });
  }
});

/**
 * Disconnect from an SMB share
 * @route POST /api/smb/disconnect
 * @param {string} clientId - Client ID
 * @returns {object} Success status
 */
router.post('/disconnect', apiKeyAuth, async (req, res) => {
  try {
    const { clientId } = req.body;
    
    // Disconnect from SMB share
    await smbService.disconnect(clientId);
    
    res.json({ success: true });
  } catch (err) {
    console.error('SMB disconnect error:', err.message);
    res.status(500).json({ success: false, error: `SMB disconnect failed: ${err.message}` });
  }
});

/**
 * Read a directory listing
 * @route POST /api/smb/readdir
 * @param {string} clientId - Client ID
 * @param {string} path - Directory path
 * @returns {object} Directory contents
 */
router.post('/readdir', apiKeyAuth, async (req, res) => {
  try {
    const { clientId, path } = req.body;
    
    // Read directory
    const files = await smbService.readdir(clientId, path);
    
    res.json({ success: true, files });
  } catch (err) {
    console.error('SMB readdir error:', err.message);
    res.status(500).json({ success: false, error: `SMB readdir failed: ${err.message}` });
  }
});

/**
 * Get file stats
 * @route POST /api/smb/stat
 * @param {string} clientId - Client ID
 * @param {string} path - File path
 * @returns {object} File stats
 */
router.post('/stat', apiKeyAuth, async (req, res) => {
  try {
    const { clientId, path } = req.body;
    
    // Get file stats
    const stats = await smbService.stat(clientId, path);
    
    res.json({ success: true, stats });
  } catch (err) {
    console.error('SMB stat error:', err.message);
    res.status(500).json({ success: false, error: `SMB stat failed: ${err.message}` });
  }
});

/**
 * Read a file
 * @route POST /api/smb/readFile
 * @param {string} clientId - Client ID
 * @param {string} path - File path
 * @param {string} [encoding] - Optional encoding
 * @returns {object} File contents
 */
router.post('/readFile', apiKeyAuth, async (req, res) => {
  try {
    const { clientId, path, encoding } = req.body;
    
    // Read file
    const data = await smbService.readFile(clientId, path, encoding);
    
    // If encoding is not provided, data is a Buffer
    // Convert to base64 for JSON transport
    const content = encoding ? data : data.toString('base64');
    
    res.json({ 
      success: true, 
      content,
      isBase64: !encoding
    });
  } catch (err) {
    console.error('SMB readFile error:', err.message);
    res.status(500).json({ success: false, error: `SMB readFile failed: ${err.message}` });
  }
});

/**
 * Write a file
 * @route POST /api/smb/writeFile
 * @param {string} clientId - Client ID
 * @param {string} path - File path
 * @param {string} content - File content
 * @param {string} [encoding] - Optional encoding
 * @param {boolean} [isBase64] - Whether content is base64 encoded
 * @returns {object} Success status
 */
router.post('/writeFile', apiKeyAuth, async (req, res) => {
  try {
    const { clientId, path, content, encoding, isBase64 } = req.body;
    
    // Create data from content
    let data;
    if (isBase64) {
      data = Buffer.from(content, 'base64');
    } else {
      data = content;
    }
    
    // Write file
    await smbService.writeFile(clientId, path, data, encoding);
    
    res.json({ success: true });
  } catch (err) {
    console.error('SMB writeFile error:', err.message);
    res.status(500).json({ success: false, error: `SMB writeFile failed: ${err.message}` });
  }
});

/**
 * Delete a file
 * @route POST /api/smb/unlink
 * @param {string} clientId - Client ID
 * @param {string} path - File path
 * @returns {object} Success status
 */
router.post('/unlink', apiKeyAuth, async (req, res) => {
  try {
    const { clientId, path } = req.body;
    
    // Delete file
    await smbService.unlink(clientId, path);
    
    res.json({ success: true });
  } catch (err) {
    console.error('SMB unlink error:', err.message);
    res.status(500).json({ success: false, error: `SMB unlink failed: ${err.message}` });
  }
});

module.exports = router;
