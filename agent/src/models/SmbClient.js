/**
 * SMB Client Model
 * Handles connection and file operations with SMB/CIFS shares
 * Pure JavaScript implementation with NTLMv2 authentication support
 */
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const SmbClient = require('../lib/smbClient');

/**
 * Adapter class for the SMB client that matches the expected API
 */
class SmbClientAdapter {
  constructor(host, share, username, password, domain = '') {
    this.id = uuidv4();
    
    // Create new SMB client with provided credentials
    this.client = new SmbClient({
      host,
      share,
      username,
      password,
      domain,
      debug: false // Set to true for debug logs
    });
    
    this.host = host;
    this.share = share;
    this.username = username;
    this.domain = domain;
    this.connected = false;
    this.lastActivity = Date.now();
    
    // Track temporary files for cleanup
    this.tempFiles = new Set();
  }

  /**
   * Connect to the SMB share
   * @returns {Promise<object>} A promise that resolves when connected with { success }
   */
  async connect() {
    try {
      // Connect to the share
      await this.client.connect();
      
      this.connected = true;
      this.lastActivity = Date.now();
      console.log(`[SMB:${this.id}] Connected to \\\\${this.host}\\${this.share}`);
      
      return { success: true };
    } catch (err) {
      console.error(`[SMB:${this.id}] Connection error:`, err.message);
      throw new Error(`Failed to connect to SMB share: ${err.message}`);
    }
  }
  
  /**
   * Disconnect from the SMB share
   * @returns {Promise<void>} A promise that resolves when disconnected
   */
  async disconnect() {
    if (!this.connected) {
      return;
    }
    
    try {
      console.log(`[SMB:${this.id}] Disconnecting from \\\\${this.host}\\${this.share}`);
      
      // Close the SMB connection
      await this.client.close();
      
      // Clean up temporary files
      this._cleanupTempFiles();
      
      this.connected = false;
      
      console.log(`[SMB:${this.id}] Disconnected from \\\\${this.host}\\${this.share}`);
    } catch (err) {
      console.error(`[SMB:${this.id}] Disconnect error:`, err.message);
    }
  }
  
  /**
   * Read a directory listing
   * @param {string} dirPath - Path to the directory
   * @returns {Promise<Array>} A promise that resolves with directory contents
   */
  async readdir(dirPath) {
    this._checkConnection();
    this.lastActivity = Date.now();
    
    try {
      // Get directory listing
      return await this.client.readdir(dirPath);
    } catch (err) {
      throw new Error(`Failed to read directory: ${err.message}`);
    }
  }
  
  /**
   * Get file or directory stats
   * @param {string} filePath - Path to the file or directory
   * @returns {Promise<object>} A promise that resolves with file stats
   */
  async stat(filePath) {
    this._checkConnection();
    this.lastActivity = Date.now();
    
    try {
      return await this.client.stat(filePath);
    } catch (err) {
      throw new Error(`Failed to get file stats: ${err.message}`);
    }
  }
  
  /**
   * Read a file's contents
   * @param {string} filePath - Path to the file
   * @param {string} [encoding] - Optional encoding
   * @returns {Promise<string|Buffer>} A promise that resolves with file contents
   */
  async readFile(filePath, encoding = null) {
    this._checkConnection();
    this.lastActivity = Date.now();
    
    try {
      return await this.client.readFile(filePath, encoding);
    } catch (err) {
      throw new Error(`Failed to read file: ${err.message}`);
    }
  }
  
  /**
   * Write data to a file
   * @param {string} filePath - Path to the file
   * @param {string|Buffer} data - Data to write
   * @param {string} [encoding] - Optional encoding
   * @returns {Promise<void>} A promise that resolves when the file is written
   */
  async writeFile(filePath, data, encoding = null) {
    this._checkConnection();
    this.lastActivity = Date.now();
    
    try {
      await this.client.writeFile(filePath, data, encoding);
    } catch (err) {
      throw new Error(`Failed to write file: ${err.message}`);
    }
  }
  
  /**
   * Delete a file
   * @param {string} filePath - Path to the file
   * @returns {Promise<void>} A promise that resolves when the file is deleted
   */
  async unlink(filePath) {
    this._checkConnection();
    this.lastActivity = Date.now();
    
    try {
      await this.client.unlink(filePath);
    } catch (err) {
      throw new Error(`Failed to delete file: ${err.message}`);
    }
  }
  
  /**
   * Check if the client is connected
   * @private
   */
  _checkConnection() {
    if (!this.connected) {
      throw new Error('Not connected to SMB share');
    }
  }
  
  /**
   * Clean up temporary files
   * @private
   */
  _cleanupTempFiles() {
    for (const filePath of this.tempFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.warn(`[SMB:${this.id}] Error removing temp file ${filePath}:`, err.message);
      }
    }
    this.tempFiles.clear();
  }
  
  /**
   * Create a directory
   * @param {string} dirPath - Path to the directory to create
   * @returns {Promise<void>} A promise that resolves when the directory is created
   */
  async mkdir(dirPath) {
    this._checkConnection();
    this.lastActivity = Date.now();
    
    try {
      await this.client.mkdir(dirPath);
    } catch (err) {
      throw new Error(`Failed to create directory: ${err.message}`);
    }
  }
  
  /**
   * Delete a directory
   * @param {string} dirPath - Path to the directory to delete
   * @param {boolean} recursive - Whether to recursively delete contents
   * @returns {Promise<void>} A promise that resolves when the directory is deleted
   */
  async rmdir(dirPath, recursive = false) {
    this._checkConnection();
    this.lastActivity = Date.now();
    
    try {
      await this.client.rmdir(dirPath, recursive);
    } catch (err) {
      throw new Error(`Failed to delete directory: ${err.message}`);
    }
  }
  
  /**
   * Check if a file or directory exists
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>} A promise that resolves with true if exists, false otherwise
   */
  async exists(filePath) {
    try {
      await this.stat(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Copy a file
   * @param {string} source - Source file path (relative to share)
   * @param {string} destination - Destination file path (relative to share)
   * @returns {Promise<void>} A promise that resolves when the file is copied
   */
  async copyFile(source, destination) {
    this._checkConnection();
    this.lastActivity = Date.now();
    
    try {
      await this.client.copyFile(source, destination);
    } catch (err) {
      throw new Error(`Failed to copy file: ${err.message}`);
    }
  }
  
  /**
   * Move/rename a file or directory
   * @param {string} oldPath - Old file/directory path (relative to share)
   * @param {string} newPath - New file/directory path (relative to share)
   * @returns {Promise<void>} A promise that resolves when the file/directory is moved
   */
  async rename(oldPath, newPath) {
    this._checkConnection();
    this.lastActivity = Date.now();
    
    try {
      await this.client.rename(oldPath, newPath);
    } catch (err) {
      throw new Error(`Failed to move/rename: ${err.message}`);
    }
  }
}

module.exports = SmbClientAdapter;