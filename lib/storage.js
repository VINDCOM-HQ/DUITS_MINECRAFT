/**
 * Storage Client implementation for local filesystem and SMB/CIFS shares
 * This library now uses our custom SmbClient implementation
 */
const fs = require('fs');
const path = require('path');
const SmbClient = require('./smbClient');

// StorageClient provides operations on either local files or SMB shares
class StorageClient {
  constructor(options = {}) {
    this.options = options;
    this.isSmbMode = !!(options.host && options.share);
    
    if (this.isSmbMode) {
      // Add debug flag if not already present
      const smbOptions = {
        ...options,
        debug: options.debug ?? false
      };
      
      // Validate options
      if (!smbOptions.host || !smbOptions.share) {
        console.error('[StorageClient] Error: Missing required host or share in SMB options');
      }
      
      this.client = new SmbClient(smbOptions);
      
      // Store options for later access
      this.client.options = smbOptions;
      
      // Log connection details but mask password
      const logOptions = { 
        ...smbOptions, 
        password: smbOptions.password ? '****' : undefined 
      };
      console.log('[StorageClient] Creating SMB client with options:', logOptions);
    } else {
      // Local filesystem mode, no client needed
      this.basePath = '';
    }
  }

  /**
   * Connect to the storage (only needed for SMB)
   * @returns {Promise<boolean>} Success status
   */
  async connect() {
    if (this.isSmbMode) {
      return this.client.connect();
    }
    return true;
  }

  /**
   * List files and directories in a directory
   * @param {string} dirPath Directory path
   * @returns {Promise<Array>} List of files and directories
   */
  async readdir(dirPath = '') {
    if (this.isSmbMode) {
      return this.client.readdir(dirPath);
    } else {
      const fs = require('fs').promises;
      const path = require('path');
      
      // Resolve path
      const fullPath = this._resolvePath(dirPath);
      
      // Get directory entries
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      
      // Map to standardized format
      return Promise.all(entries.map(async (entry) => {
        const entryPath = path.join(fullPath, entry.name);
        const stats = await fs.stat(entryPath);
        
        return {
          name: entry.name,
          isDirectory: entry.isDirectory(),
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
      }));
    }
  }

  /**
   * Get file or directory information
   * @param {string} filePath File or directory path
   * @returns {Promise<Object>} File stats
   */
  async stat(filePath) {
    if (this.isSmbMode) {
      return this.client.stat(filePath);
    } else {
      const fs = require('fs').promises;
      return fs.stat(this._resolvePath(filePath));
    }
  }

  /**
   * Read file contents
   * @param {string} filePath File path
   * @param {string} [encoding] Optional encoding
   * @returns {Promise<string|Buffer>} File contents
   */
  async readFile(filePath, encoding = null) {
    if (this.isSmbMode) {
      return this.client.readFile(filePath, encoding);
    } else {
      const fs = require('fs').promises;
      const data = await fs.readFile(this._resolvePath(filePath));
      return encoding ? data.toString(encoding) : data;
    }
  }

  /**
   * Write data to a file
   * @param {string} filePath File path
   * @param {string|Buffer} data Data to write
   * @param {string} [encoding] Optional encoding
   * @returns {Promise<void>}
   */
  async writeFile(filePath, data, encoding = null) {
    if (this.isSmbMode) {
      return this.client.writeFile(filePath, data, encoding);
    } else {
      const fs = require('fs').promises;
      const path = require('path');
      
      // Ensure parent directory exists
      const fullPath = this._resolvePath(filePath);
      const dirPath = path.dirname(fullPath);
      await fs.mkdir(dirPath, { recursive: true });
      
      // Write file
      const buffer = typeof data === 'string' && encoding
        ? Buffer.from(data, encoding)
        : data;
      
      return fs.writeFile(fullPath, buffer);
    }
  }

  /**
   * Delete a file
   * @param {string} filePath File path
   * @returns {Promise<void>}
   */
  async unlink(filePath) {
    if (this.isSmbMode) {
      return this.client.unlink(filePath);
    } else {
      const fs = require('fs').promises;
      return fs.unlink(this._resolvePath(filePath));
    }
  }

  /**
   * Create a directory
   * @param {string} dirPath Directory path
   * @returns {Promise<void>}
   */
  async mkdir(dirPath) {
    if (this.isSmbMode) {
      return this.client.mkdir(dirPath);
    } else {
      const fs = require('fs').promises;
      return fs.mkdir(this._resolvePath(dirPath), { recursive: true });
    }
  }

  /**
   * Delete a directory
   * @param {string} dirPath Directory path
   * @param {boolean} [recursive=false] Whether to recursively delete contents
   * @returns {Promise<void>}
   */
  async rmdir(dirPath, recursive = false) {
    if (this.isSmbMode) {
      return this.client.rmdir(dirPath, recursive);
    } else {
      const fs = require('fs').promises;
      const fullPath = this._resolvePath(dirPath);
      
      if (recursive) {
        if (fs.rm) {
          // Node.js 14.14.0+
          return fs.rm(fullPath, { recursive: true, force: true });
        } else {
          // Older Node.js versions
          return this._recursiveRmdir(fullPath);
        }
      } else {
        return fs.rmdir(fullPath);
      }
    }
  }

  /**
   * Recursively remove a directory (for older Node.js versions)
   * @param {string} dirPath Directory path
   * @returns {Promise<void>}
   * @private
   */
  async _recursiveRmdir(dirPath) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await this._recursiveRmdir(entryPath);
      } else {
        await fs.unlink(entryPath);
      }
    }
    
    return fs.rmdir(dirPath);
  }

  /**
   * Check if a file or directory exists
   * @param {string} filePath File or directory path
   * @returns {Promise<boolean>}
   */
  async exists(filePath) {
    try {
      await this.stat(filePath);
      return true;
    } catch (err) {
      return false;
    }
  }
  
  /**
   * Copy a file
   * @param {string} source Source path
   * @param {string} destination Destination path
   * @returns {Promise<void>}
   */
  async copyFile(source, destination) {
    if (this.isSmbMode) {
      return this.client.copyFile(source, destination);
    } else {
      const fs = require('fs').promises;
      const path = require('path');
      
      const srcPath = this._resolvePath(source);
      const destPath = this._resolvePath(destination);
      
      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await fs.mkdir(destDir, { recursive: true });
      
      return fs.copyFile(srcPath, destPath);
    }
  }
  
  /**
   * Move or rename a file or directory
   * @param {string} oldPath Old path
   * @param {string} newPath New path
   * @returns {Promise<void>}
   */
  async rename(oldPath, newPath) {
    if (this.isSmbMode) {
      return this.client.rename(oldPath, newPath);
    } else {
      const fs = require('fs').promises;
      const path = require('path');
      
      const srcPath = this._resolvePath(oldPath);
      const destPath = this._resolvePath(newPath);
      
      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await fs.mkdir(destDir, { recursive: true });
      
      return fs.rename(srcPath, destPath);
    }
  }

  /**
   * Disconnect from storage (only needed for SMB)
   */
  close() {
    if (this.isSmbMode && this.client) {
      return this.client.disconnect();
    }
  }

  /**
   * Resolve a path for local filesystem
   * @param {string} filePath Relative path
   * @returns {string} Absolute path
   * @private
   */
  _resolvePath(filePath = '') {
    const path = require('path');
    
    if (this.basePath) {
      const absPath = path.resolve(this.basePath, filePath);
      const relative = path.relative(this.basePath, absPath);
      
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('Access denied: path outside storage root');
      }
      
      return absPath;
    }
    
    return path.resolve(filePath);
  }
}

module.exports = StorageClient;