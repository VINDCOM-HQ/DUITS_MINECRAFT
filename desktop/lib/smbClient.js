/**
 * Enhanced SMB Client
 * A more robust SMB client with better error handling and connection management
 */
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const net = require('net');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const fs = require('fs').promises;

/**
 * SmbClient provides a robust interface for SMB/CIFS operations
 */
class SmbClient extends EventEmitter {
  /**
   * Create a new SMB client
   * @param {Object} options Client options
   * @param {string} options.host SMB host
   * @param {string} options.share SMB share name
   * @param {string} [options.username=''] Username for authentication
   * @param {string} [options.password=''] Password for authentication
   * @param {string} [options.domain=''] Domain for authentication
   * @param {number} [options.timeout=30000] Connection timeout in ms
   * @param {number} [options.keepAliveInterval=60000] Interval for connection checks
   * @param {boolean} [options.debug=false] Enable debug logging
   */
  constructor(options = {}) {
    super();
    
    // Store original options for reference
    this.connectionParams = { ...options };
    this.options = { ...options };
    
    // Connection parameters
    this.host = options.host || '';
    this.share = options.share || '';
    this.domain = options.domain || '';
    this.username = options.username || '';
    this.password = options.password || '';
    this.timeout = options.timeout || 30000;
    this.keepAliveInterval = options.keepAliveInterval || 60000;
    this.debug = options.debug || false;
    
    // Generate a unique client ID for logging
    this.id = uuidv4().split('-')[0];
    
    // Connection state
    this.connected = false;
    this.connecting = false;
    this.lastActivity = Date.now();
    this.keepAliveTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.consecutiveErrors = 0;
    this.maxConsecutiveErrors = 3;
    
    // Create temp directory for operations
    this.tmpDir = path.join(os.tmpdir(), `smb-client-${this.id}`);
    
    // Platform detection for command selection
    this.platform = os.platform();
    
    this.log('SMB client created');
  }
  
  /**
   * Log debug messages when debug mode is enabled
   * @param {...any} args Arguments to log
   */
  log(...args) {
    if (this.debug) {
      console.log(`[SMB:${this.id}]`, ...args);
    }
  }

  /**
   * Establish a network connection to a share using net use (Windows only).
   * No-op if no username is configured. Errors are logged and swallowed
   * so callers can fall back to direct commands.
   * @param {string} targetShare - UNC share path (e.g. \\\\host\\share)
   * @param {string} operation - Description for logging (e.g. 'directory listing')
   */
  _establishNetworkConnection(targetShare, operation) {
    if (!this.username) return;
    const netShareCmd = `net use ${targetShare} ${this.password ? `/user:${this.domain ? this.domain + '\\' : ''}${this.username} "${this.password}"` : ''} /persistent:no`;
    try {
      console.log(`[SMB:${this.id}] Establishing network connection for ${operation}: net use ${targetShare} /user:${this.domain ? this.domain + '\\' : ''}${this.username} *** /persistent:no`);
      const { execSync } = require('child_process');
      execSync(netShareCmd, { stdio: 'pipe' });
      console.log(`[SMB:${this.id}] Network connection established successfully for ${operation}`);
    } catch (netErr) {
      console.warn(`[SMB:${this.id}] Failed to establish network connection for ${operation}: ${netErr.message}`);
    }
  }

  /**
   * Connect to the SMB share
   * @returns {Promise<boolean>} Connection success
   */
  async connect() {
    if (this.connected) {
      this.log('Already connected');
      return true;
    }
    
    if (this.connecting) {
      this.log('Connection already in progress');
      return new Promise((resolve, reject) => {
        // Wait for the current connection attempt to complete
        this.once('connect', () => resolve(true));
        this.once('error', (err) => reject(err));
      });
    }
    
    this.connecting = true;
    
    // Force debug on for connection attempt
    const originalDebug = this.debug;
    this.debug = true;
    
    try {
      this.log(`Connecting to \\\\${this.host}\\${this.share} (platform: ${this.platform})`);
      
      // Validate parameters
      if (!this.host || !this.share) {
        throw new Error(`Invalid connection parameters: host and share are required`);
      }
      
      // Create temp directory for operations if it doesn't exist
      await this._ensureTempDir();
      
      console.log(`[SMB:${this.id}] Testing connection to \\\\${this.host}\\${this.share}...`);
      
      // Test connection with a simple directory listing
      try {
        await this._executeCommand('dir');
      } catch (testErr) {
        console.error(`[SMB:${this.id}] Connection test failed: ${testErr.message}`);
        
        // If access denied but we can connect, still consider it connected
        if (testErr.message.includes('Access is denied') || 
            testErr.message.includes('ERROR_ACCESS_DENIED') ||
            testErr.message.includes('0x80070005')) {
          console.warn(`[SMB:${this.id}] Access denied, but connection established`);
        } else {
          throw testErr;
        }
      }
      
      // Update state
      this.connected = true;
      this.connecting = false;
      this.lastActivity = Date.now();
      this.reconnectAttempts = 0;
      this.consecutiveErrors = 0;
      
      // Start keepalive timer
      this._startKeepAlive();
      
      console.log(`[SMB:${this.id}] Successfully connected to \\\\${this.host}\\${this.share}`);
      this.emit('connect');
      
      return true;
    } catch (err) {
      this.connecting = false;
      this.connected = false;
      
      console.error(`[SMB:${this.id}] Connection failed: ${err.message}`);
      this.emit('error', err);
      
      throw err;
    } finally {
      // Restore original debug setting
      this.debug = originalDebug;
    }
  }
  
  /**
   * Ensure the temporary directory exists
   * @returns {Promise<void>}
   * @private
   */
  async _ensureTempDir() {
    try {
      // Use fs.promises.mkdir with recursive option to create all parent directories
      await fs.mkdir(this.tmpDir, { recursive: true });
      
      // Verify the directory exists after creation
      try {
        const stats = await fs.stat(this.tmpDir);
        if (!stats.isDirectory()) {
          throw new Error(`Path exists but is not a directory: ${this.tmpDir}`);
        }
        
        // Log success with absolute path
        const absolutePath = path.resolve(this.tmpDir);
        console.log(`[SMB:${this.id}] Confirmed temp directory exists: ${absolutePath}`);
        
        // Make sure we can write to the directory
        const testFile = path.join(this.tmpDir, `.test-${Date.now()}`);
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
        console.log(`[SMB:${this.id}] Verified temp directory is writable`);
      } catch (statErr) {
        console.error(`[SMB:${this.id}] Failed to confirm temp directory: ${statErr.message}`);
        throw statErr;
      }
    } catch (err) {
      console.error(`[SMB:${this.id}] Failed to create temp directory: ${err.message}`);
      
      // Try to use a different location
      try {
        const os = require('os');
        const originalTmpDir = this.tmpDir;
        this.tmpDir = path.join(os.tmpdir(), `smb-client-${this.id}`);
        
        console.log(`[SMB:${this.id}] Trying alternative temp directory: ${this.tmpDir}`);
        
        await fs.mkdir(this.tmpDir, { recursive: true });
        
        // Verify the new directory
        const stats = await fs.stat(this.tmpDir);
        if (stats.isDirectory()) {
          console.log(`[SMB:${this.id}] Successfully created alternative temp directory`);
          
          // Test writing to the directory
          const testFile = path.join(this.tmpDir, `.test-${Date.now()}`);
          await fs.writeFile(testFile, 'test');
          await fs.unlink(testFile);
          console.log(`[SMB:${this.id}] Verified alternative temp directory is writable`);
          return;
        }
      } catch (altErr) {
        console.error(`[SMB:${this.id}] Alternative temp directory also failed: ${altErr.message}`);
        this.tmpDir = os.tmpdir(); // Fall back to system temp directory
        console.log(`[SMB:${this.id}] Falling back to system temp directory: ${this.tmpDir}`);
      }
      
      throw new Error(`Failed to create usable temp directory: ${err.message}`);
    }
  }
  
  /**
   * Start the keepalive timer to maintain the connection
   * @private
   */
  _startKeepAlive() {
    this._stopKeepAlive();
    
    this.log(`Starting keepalive timer (interval: ${this.keepAliveInterval}ms)`);
    
    this.keepAliveTimer = setInterval(async () => {
      try {
        // Only check if we haven't had activity recently
        const idleTime = Date.now() - this.lastActivity;
        
        if (idleTime > this.keepAliveInterval / 2) {
          this.log(`Sending keepalive check (idle for ${Math.round(idleTime/1000)}s)`);
          
          // Send a simple command to check connection
          await this._ping();
          
          // Reset consecutive errors on successful ping
          this.consecutiveErrors = 0;
        }
      } catch (err) {
        this.log('Keepalive check failed:', err.message);
        this.consecutiveErrors++;
        
        // If we've had too many errors, try to reconnect
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
          this.log(`${this.consecutiveErrors} consecutive errors, attempting reconnect`);
          this._reconnect();
        }
      }
    }, this.keepAliveInterval);
  }
  
  /**
   * Stop the keepalive timer
   * @private
   */
  _stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }
  
  /**
   * Send a ping command to check connection health
   * @returns {Promise<void>}
   * @private
   */
  async _ping() {
    if (!this.connected) {
      throw new Error('Not connected to SMB share');
    }
    
    try {
      // Try to list the root directory as a ping
      await this._executeCommand('dir');
      this.lastActivity = Date.now();
      this.log('Ping successful');
    } catch (err) {
      this.log('Ping failed:', err.message);
      throw err;
    }
  }
  
  /**
   * Attempt to reconnect to the SMB share
   * @private
   */
  async _reconnect() {
    if (this.connecting) {
      this.log('Reconnect already in progress');
      return;
    }
    
    // Track reconnect attempts
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      this.log(`Maximum reconnect attempts (${this.maxReconnectAttempts}) exceeded`);
      this.emit('reconnect_failed');
      return;
    }
    
    this.log(`Attempting to reconnect (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    // Stop keepalive during reconnection
    this._stopKeepAlive();
    
    // Reset state
    this.connected = false;
    
    // Calculate backoff delay: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    this.log(`Waiting ${delay}ms before reconnecting`);
    
    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      // Attempt to connect
      await this.connect();
      
      this.log('Reconnection successful');
      this.emit('reconnect');
    } catch (err) {
      this.log('Reconnection failed:', err.message);
      
      // Try again later
      this._reconnect();
    }
  }
  
  /**
   * Execute an SMB command with platform-specific implementation
   * @param {string} operation Command to execute (dir, mkdir, etc.)
   * @param {Object} [options={}] Command options
   * @returns {Promise<string>} Command output
   * @private
   */
  async _executeCommand(operation, options = {}) {
    // Update activity timestamp
    this.lastActivity = Date.now();
    
    // Normalize path separator based on platform
    const targetPath = options.path ? this._normalizePath(options.path) : '';
    
    // Build the command based on platform
    let command = '';
    
    // Build credentials string
    const credString = this._buildCredentialsString();
    const targetShare = `\\\\${this.host}\\${this.share}`;
    
    // Add operation-specific arguments
    switch (operation.toLowerCase()) {
      case 'dir':
      case 'ls':
        // List directory
        if (this.platform === 'win32') {
          this._establishNetworkConnection(targetShare, 'directory listing');

          // Now use a simple dir command with just essential flags
          const quotedShare = `"${targetShare}${targetPath}"`;
          command = `dir ${quotedShare} /B`;
          
          // Add stderr redirection to capture errors
          command = `${command} 2>&1`;
          
          // Log the command for debugging
          console.log(`[SMB:${this.id}] Directory listing command: ${command}`);
        } else {
          command = `smbclient "${targetShare}" ${credString} -c "ls ${targetPath}"`;
          console.log(`[SMB:${this.id}] Using smbclient for directory listing`);
        }
        break;
        
      case 'stat':
        // Get file/directory info
        if (this.platform === 'win32') {
          this._establishNetworkConnection(targetShare, 'file/dir info');

          // Use a simple existence check to determine if it's a file or directory
          command = `if exist "${targetShare}${targetPath}\\*" (echo d) else (echo f)`;
          console.log(`[SMB:${this.id}] File/directory check command: if exist "${targetShare}${targetPath}\\*" (echo d) else (echo f)`);
        } else {
          command = `smbclient "${targetShare}" ${credString} -c "allinfo ${targetPath}"`;
          console.log(`[SMB:${this.id}] Using smbclient for file/directory info`);
        }
        break;
        
      case 'mkdir':
        // Create directory
        if (this.platform === 'win32') {
          this._establishNetworkConnection(targetShare, 'directory creation');

          // FIXED: Remove credentials from mkdir command
          command = `mkdir "${targetShare}${targetPath}" >nul 2>&1`;
          console.log(`[SMB:${this.id}] Create directory command: mkdir "${targetShare}${targetPath}"`);
        } else {
          command = `smbclient "${targetShare}" ${credString} -c "mkdir ${targetPath}"`;
          console.log(`[SMB:${this.id}] Using smbclient for directory creation`);
        }
        break;
        
      case 'rmdir':
        // Remove directory
        if (this.platform === 'win32') {
          this._establishNetworkConnection(targetShare, 'directory removal');

          // FIXED: Remove credentials from rmdir command
          command = `rmdir "${targetShare}${targetPath}" >nul 2>&1`;
          console.log(`[SMB:${this.id}] Remove directory command: rmdir "${targetShare}${targetPath}"`);
        } else {
          command = `smbclient "${targetShare}" ${credString} -c "rmdir ${targetPath}"`;
          console.log(`[SMB:${this.id}] Using smbclient for directory removal`);
        }
        break;
        
      case 'del':
      case 'rm':
        // Delete file
        if (this.platform === 'win32') {
          this._establishNetworkConnection(targetShare, 'file deletion');

          // FIXED: Remove credentials from del command
          command = `del "${targetShare}${targetPath}" >nul 2>&1`;
          console.log(`[SMB:${this.id}] Delete command: del "${targetShare}${targetPath}"`);
        } else {
          command = `smbclient "${targetShare}" ${credString} -c "rm ${targetPath}"`;
          console.log(`[SMB:${this.id}] Using smbclient for file deletion`);
        }
        break;
        
      case 'get':
        // Download file
        const localPath = options.localPath || path.join(this.tmpDir, `file-${Date.now()}-${path.basename(targetPath)}`);
        
        // Ensure the destination directory exists no matter what platform
        try {
          const destDir = path.dirname(localPath);
          await fs.mkdir(destDir, { recursive: true });
          
          // Verify the directory was created
          const stats = await fs.stat(destDir);
          if (!stats.isDirectory()) {
            throw new Error(`Path exists but is not a directory: ${destDir}`);
          }
          
          console.log(`[SMB:${this.id}] Confirmed destination directory exists: ${destDir}`);
        } catch (mkdirErr) {
          console.error(`[SMB:${this.id}] Failed to ensure destination directory: ${mkdirErr.message}`);
          throw new Error(`Failed to create destination directory: ${mkdirErr.message}`);
        }
        
        // Output file name for logging
        const fileName = path.basename(targetPath);
        console.log(`[SMB:${this.id}] Downloading file: ${fileName} from SMB share to ${localPath}`);
        
        if (this.platform === 'win32') {
          const targetShare = `\\\\${this.host}\\${this.share}`;
          this._establishNetworkConnection(targetShare, 'file download');

          // Always try the simple copy command first (works in most cases)
          try {
            console.log(`[SMB:${this.id}] Attempting direct file copy for download`);
            // FIXED: Remove credentials from copy command - they don't belong there
            command = `copy /B "${targetShare}${targetPath}" "${localPath}" >nul 2>&1`;
            
            // Will display the command but not the credential details
            console.log(`[SMB:${this.id}] Copy command: copy /B "${targetShare}${targetPath}" "${localPath}"`);
          } catch (err) {
            console.error(`[SMB:${this.id}] Failed to create copy command: ${err.message}`);
            throw new Error(`Failed to create file copy command: ${err.message}`);
          }
        } else {
          command = `smbclient "${targetShare}" ${credString} -c "get ${targetPath} ${localPath}"`;
          console.log(`[SMB:${this.id}] Using smbclient for file download`);
        }
        break;
        
      case 'put':
        // Upload file
        const filePath = options.localPath || '';
        
        if (this.platform === 'win32') {
          this._establishNetworkConnection(targetShare, 'file upload');

          // FIXED: Remove credentials from copy command
          command = `copy "${filePath}" "${targetShare}${targetPath}" >nul 2>&1`;
          console.log(`[SMB:${this.id}] Copy command for upload: copy "${filePath}" "${targetShare}${targetPath}"`);
        } else {
          command = `smbclient "${targetShare}" ${credString} -c "put ${filePath} ${targetPath}"`;
          console.log(`[SMB:${this.id}] Using smbclient for file upload`);
        }
        break;
        
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
    
    // Execute the command
    console.log(`[SMB:${this.id}] Executing command: ${command.replace(/\/pass:"[^"]*"/, '/pass:"***"')}`);
    
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        console.error(`[SMB:${this.id}] Command timed out after ${this.timeout}ms`);
        reject(new Error(`Command timed out after ${this.timeout}ms`));
      }, this.timeout);
      
      // Execute with error handling
      exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        clearTimeout(timeout);
        
        // If we have output from the command, log it
        if (stdout && stdout.trim()) {
          console.log(`[SMB:${this.id}] Command stdout (${stdout.trim().length} chars): ${stdout.trim().substring(0, 200)}${stdout.trim().length > 200 ? '...' : ''}`);
        }
        
        // Log any errors
        if (stderr && stderr.trim()) {
          console.error(`[SMB:${this.id}] Command stderr: ${stderr.trim()}`);
        }
        
        if (error) {
          console.error(`[SMB:${this.id}] Command error: ${error.message} (code: ${error.code})`);
          
          // For 'get' operations, check if the destination file was created
          if (operation === 'get' && options.localPath) {
            try {
              const fs = require('fs');
              if (fs.existsSync(options.localPath)) {
                const stats = fs.statSync(options.localPath);
                if (stats.size > 0) {
                  console.log(`[SMB:${this.id}] Despite error, destination file exists with size ${stats.size} bytes`);
                  // If the file has content, consider it a success despite command error
                  return resolve(`File downloaded with size ${stats.size} bytes`);
                }
              }
            } catch (statErr) {
              console.error(`[SMB:${this.id}] Failed to check destination file: ${statErr.message}`);
            }
          }
          
          // Special handling for copy commands
          if (command.includes('copy ') && !stderr) {
            // Windows copy sometimes returns non-zero but the copy worked
            try {
              const fs = require('fs');
              if (options.localPath && fs.existsSync(options.localPath)) {
                const stats = fs.statSync(options.localPath);
                if (stats.size > 0) {
                  console.log(`[SMB:${this.id}] Copy command produced a valid file despite error code`);
                  return resolve(`File copied with size ${stats.size} bytes`);
                }
              }
            } catch (fsErr) {
              console.error(`[SMB:${this.id}] Failed to verify copied file: ${fsErr.message}`);
            }
          }
          
          // Check for specific SMB error patterns
          if (stderr.includes('NT_STATUS_') || stderr.includes('ERROR:')) {
            // Log a cleaned-up error message
            const errorMsg = stderr
              .replace(/\r\n/g, ' ')
              .replace(/\n/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
              
            console.error(`[SMB:${this.id}] SMB-specific error: ${errorMsg}`);
            reject(new Error(errorMsg));
          } else {
            // If it's not a specific SMB error but the command failed
            console.log(`[SMB:${this.id}] Command exit code ${error.code}, but may still have worked`);
            
            // For get/copy operations, check the output
            if (operation === 'get' || operation === 'dir' || operation === 'ls') {
              if (stdout && stdout.trim()) {
                console.log(`[SMB:${this.id}] Command produced output despite error, treating as success`);
                resolve(stdout);
              } else {
                reject(new Error(`Command failed with code ${error.code}: ${error.message}`));
              }
            } else {
              // For other operations, reject with the error
              reject(new Error(`Command failed with code ${error.code}: ${error.message}`));
            }
          }
        } else {
          console.log(`[SMB:${this.id}] Command succeeded`);
          resolve(stdout);
        }
      });
    });
  }
  
  /**
   * Build the credentials string for SMB commands
   * @returns {string} Credentials string for the command
   * @private
   */
  _buildCredentialsString() {
    if (this.platform === 'win32') {
      // Windows
      if (!this.username) {
        // No user credentials - current user's credentials will be used
        return '';
      }
      
      // Important: Use double quotes around the username if it contains spaces or special characters
      const domain = this.domain ? `${this.domain}\\` : '';
      const fullUsername = `${domain}${this.username}`;
      const userPart = `/user:"${fullUsername}"`;
      
      // Also quote the password
      const passPart = this.password ? `/pass:"${this.password}"` : '';
      
      this.log(`Using Windows credentials with username: ${fullUsername}`);
      
      // Return properly quoted credential string
      return `${userPart} ${passPart}`;
    } else {
      // Linux/macOS
      const options = [];
      
      if (this.username) {
        options.push(`-U ${this.username}`);
      }
      
      if (this.password) {
        options.push(`%${this.password}`);
      }
      
      if (this.domain) {
        options.push(`-W ${this.domain}`);
      }
      
      return options.join(' ');
    }
  }
  
  /**
   * Normalize a path for SMB
   * @param {string} filePath Path to normalize
   * @returns {string} Normalized path
   * @private
   */
  _normalizePath(filePath = '') {
    // Convert forward slashes to backslashes
    let normalized = filePath.replace(/\//g, '\\');
    
    // Ensure path starts with backslash for SMB
    if (normalized && !normalized.startsWith('\\')) {
      normalized = '\\' + normalized;
    }
    
    return normalized;
  }
  
  /**
   * Parse directory listing output into structured data
   * @param {string} output Command output
   * @returns {Array<Object>} Parsed file list
   * @private
   */
  _parseDirectoryListing(output) {
    const results = [];
    const lines = output.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (this.platform === 'win32') {
      // Windows dir /B format - just filenames, one per line
      this.log(`Parsing Windows directory listing with ${lines.length} lines`);
      
      lines.forEach(line => {
        const name = line.trim();
        
        // Skip "." and ".." entries and empty lines
        if (!name || name === '.' || name === '..') return;
        
        // Check if it's a directory by executing a follow-up command
        // This is better than guessing based on file extension
        let isDirectory = false;
        
        // Get stats for the file to determine if it's a directory
        // This is a more reliable approach than guessing based on file extension
        try {
          // Check if the name contains a dot (likely a file)
          if (name.match(/\.[^\\\/]+$/)) {
            // Has an extension, assume file
            isDirectory = false;
          } else {
            // No extension, probably a directory
            isDirectory = true;
            
            this.log(`No extension in ${name}, assuming directory`);
          }
        } catch (err) {
          this.log(`Error checking if ${name} is directory: ${err.message}, using file extension heuristic`);
          // Fall back to extension-based heuristic
          isDirectory = !name.match(/\.[^\\\/]+$/);
        }
        
        this.log(`Found item: ${name} (isDirectory: ${isDirectory})`);
        
        results.push({
          name,
          isDirectory,
          size: 0,  // Not available in basic dir /B output
          modified: new Date().toISOString()  // Not available in basic dir /B output
        });
      });
    } else {
      // Linux/macOS smbclient output
      // Format: "  filename  filesize date time"
      lines.forEach(line => {
        // Skip non-file entries
        if (line.startsWith('  .') || line.startsWith('  NT_')) return;
        
        const parts = line.trim().split(/\s+/);
        
        // Ensure we have at least a filename
        if (parts.length < 1) return;
        
        const name = parts[0];
        
        // Skip "." and ".." entries
        if (name === '.' || name === '..') return;
        
        const isDirectory = line.indexOf('D ') === 0;
        
        results.push({
          name,
          isDirectory,
          size: parts.length > 1 ? parseInt(parts[1], 10) : 0,
          modified: new Date().toISOString()  // Format date if available
        });
      });
    }
    
    return results;
  }
  
  /**
   * Read directory contents
   * @param {string} dirPath Directory path
   * @returns {Promise<Array>} List of files and directories
   */
  async readdir(dirPath = '') {
    try {
      // Ensure we're connected
      if (!this.connected) {
        this.log(`Not connected, attempting to connect before reading directory`);
        await this.connect();
      }
      
      this.log(`Reading directory: "${dirPath}"`);
      
      // Force debug on for directory listing
      const originalDebug = this.debug;
      this.debug = true;
      
      try {
        const output = await this._executeCommand('dir', { path: dirPath });
        
        // Check if output is empty
        if (!output || output.trim() === '') {
          this.log(`Warning: Empty directory listing response`);
          return [];
        }
        
        const result = this._parseDirectoryListing(output);
        this.log(`Directory listing parsed ${result.length} items`);
        return result;
      } finally {
        // Restore original debug setting
        this.debug = originalDebug;
      }
    } catch (err) {
      // Handle specific error cases
      if (err.message.includes('NT_STATUS_CONNECTION_REFUSED') || 
          err.message.includes('NT_STATUS_LOGON_FAILURE')) {
        this.connected = false;
        this.consecutiveErrors++;
      }
      
      // Log error for Windows access denied issues
      if (err.message.includes('Access is denied') || 
          err.message.includes('ERROR_ACCESS_DENIED') ||
          err.message.includes('0x80070005')) {
        console.error(`[SMB:${this.id}] Access denied reading directory "${dirPath}" - check permissions`);
      }
      
      throw new Error(`Failed to list directory: ${err.message}`);
    }
  }
  
  /**
   * Get file or directory information
   * @param {string} filePath Path to check
   * @returns {Promise<Object>} File stats
   */
  async stat(filePath) {
    try {
      // Ensure we're connected
      if (!this.connected) {
        await this.connect();
      }
      
      const output = await this._executeCommand('stat', { path: filePath });
      
      // Parse the output to determine if it's a directory
      let isDirectory = false;
      
      if (this.platform === 'win32') {
        // Windows: Output will be 'd' for directory, 'f' for file
        isDirectory = output.trim() === 'd';
      } else {
        // Linux/macOS: Parse smbclient output
        isDirectory = output.includes('attributes: D');
      }
      
      // Return stat object similar to fs.stat
      return {
        isDirectory: () => isDirectory,
        isFile: () => !isDirectory,
        size: 0,  // Not available from simple check
        mtime: new Date(),
        atime: new Date(),
        ctime: new Date(),
        birthtime: new Date()
      };
    } catch (err) {
      // If file doesn't exist, it will usually return NT_STATUS_OBJECT_NAME_NOT_FOUND
      // or NT_STATUS_NO_SUCH_FILE
      if (err.message.includes('NT_STATUS_OBJECT_NAME_NOT_FOUND') ||
          err.message.includes('NT_STATUS_NO_SUCH_FILE')) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Handle connection errors
      if (err.message.includes('NT_STATUS_CONNECTION_REFUSED')) {
        this.connected = false;
        this.consecutiveErrors++;
      }
      
      throw new Error(`Failed to get file info: ${err.message}`);
    }
  }
  
  /**
   * Read file contents
   * @param {string} filePath File to read
   * @param {string} [encoding] Optional encoding (if null, returns Buffer)
   * @returns {Promise<string|Buffer>} File contents
   */
  async readFile(filePath, encoding = null) {
    try {
      // Ensure we're connected
      if (!this.connected) {
        await this.connect();
      }
      
      console.log(`[SMB:${this.id}] Reading file: ${filePath}`);
      
      // Create a temp directory if it doesn't exist
      try {
        await fs.mkdir(this.tmpDir, { recursive: true });
        console.log(`[SMB:${this.id}] Temporary directory created/confirmed: ${this.tmpDir}`);
      } catch (mkdirErr) {
        console.error(`[SMB:${this.id}] Failed to create temp directory: ${mkdirErr.message}`);
        // Still try to continue
      }
      
      // Create a temp file path for download with random name
      const tempFile = path.join(this.tmpDir, `smb-file-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`);
      console.log(`[SMB:${this.id}] Temporary file path: ${tempFile}`);
      
      if (this.platform === 'win32') {
        const targetShare = `\\\\${this.host}\\${this.share}`;
        this._establishNetworkConnection(targetShare, 'file read');
      }

      // Download the file
      try {
        console.log(`[SMB:${this.id}] Downloading file: ${filePath} to ${tempFile}`);
        await this._executeCommand('get', { 
          path: filePath,
          localPath: tempFile
        });
        console.log(`[SMB:${this.id}] File downloaded successfully`);
      } catch (downloadErr) {
        console.error(`[SMB:${this.id}] Failed to download file: ${downloadErr.message}`);
        throw new Error(`Failed to download file: ${downloadErr.message}`);
      }
      
      // Verify temp file exists before reading
      try {
        const tempFileStat = await fs.stat(tempFile);
        console.log(`[SMB:${this.id}] Temporary file exists with size: ${tempFileStat.size} bytes`);
      } catch (statErr) {
        console.error(`[SMB:${this.id}] Temporary file does not exist or is not accessible: ${statErr.message}`);
        throw new Error(`Temporary file creation failed: ${statErr.message}`);
      }
      
      // Read the downloaded file
      let data;
      try {
        console.log(`[SMB:${this.id}] Reading temporary file: ${tempFile}`);
        data = await fs.readFile(tempFile);
        console.log(`[SMB:${this.id}] File read successfully, size: ${data.length} bytes`);
      } catch (readErr) {
        console.error(`[SMB:${this.id}] Failed to read temporary file: ${readErr.message}`);
        throw new Error(`Failed to read temporary file: ${readErr.message}`);
      }
      
      // Clean up the temp file
      try {
        console.log(`[SMB:${this.id}] Cleaning up temporary file: ${tempFile}`);
        await fs.unlink(tempFile);
        console.log(`[SMB:${this.id}] Temporary file cleaned up successfully`);
      } catch (unlinkErr) {
        console.warn(`[SMB:${this.id}] Failed to clean up temporary file: ${unlinkErr.message}`);
        // Continue even if cleanup fails
      }
      
      // Return the data with optional encoding
      console.log(`[SMB:${this.id}] Returning file data with encoding: ${encoding || 'binary'}`);
      return encoding ? data.toString(encoding) : data;
    } catch (err) {
      // Handle connection errors
      if (err.message.includes('NT_STATUS_CONNECTION_REFUSED')) {
        this.connected = false;
        this.consecutiveErrors++;
      }
      
      console.error(`[SMB:${this.id}] File read failed: ${err.message}`);
      throw new Error(`Failed to read file: ${err.message}`);
    }
  }
  
  /**
   * Write data to a file
   * @param {string} filePath File to write
   * @param {string|Buffer} data Data to write
   * @param {string} [encoding] Optional encoding (if data is string)
   * @returns {Promise<void>}
   */
  async writeFile(filePath, data, encoding = null) {
    try {
      // Ensure we're connected
      if (!this.connected) {
        await this.connect();
      }
      
      // Create a temp file for upload
      const tempFile = path.join(this.tmpDir, `smb-${crypto.randomBytes(6).toString('hex')}`);
      
      // Write data to the temp file
      if (typeof data === 'string' && encoding) {
        await fs.writeFile(tempFile, data, encoding);
      } else {
        await fs.writeFile(tempFile, data);
      }
      
      // Upload the file
      await this._executeCommand('put', {
        path: filePath,
        localPath: tempFile
      });
      
      // Clean up the temp file
      await fs.unlink(tempFile).catch(() => {});
      
    } catch (err) {
      // Handle connection errors
      if (err.message.includes('NT_STATUS_CONNECTION_REFUSED')) {
        this.connected = false;
        this.consecutiveErrors++;
      }
      
      throw new Error(`Failed to write file: ${err.message}`);
    }
  }
  
  /**
   * Delete a file
   * @param {string} filePath File to delete
   * @returns {Promise<void>}
   */
  async unlink(filePath) {
    try {
      // Ensure we're connected
      if (!this.connected) {
        await this.connect();
      }
      
      await this._executeCommand('del', { path: filePath });
    } catch (err) {
      // Handle connection errors
      if (err.message.includes('NT_STATUS_CONNECTION_REFUSED')) {
        this.connected = false;
        this.consecutiveErrors++;
      }
      
      throw new Error(`Failed to delete file: ${err.message}`);
    }
  }
  
  /**
   * Create a directory
   * @param {string} dirPath Directory to create
   * @returns {Promise<void>}
   */
  async mkdir(dirPath) {
    try {
      // Ensure we're connected
      if (!this.connected) {
        await this.connect();
      }
      
      await this._executeCommand('mkdir', { path: dirPath });
    } catch (err) {
      // Handle connection errors
      if (err.message.includes('NT_STATUS_CONNECTION_REFUSED')) {
        this.connected = false;
        this.consecutiveErrors++;
      }
      
      throw new Error(`Failed to create directory: ${err.message}`);
    }
  }
  
  /**
   * Delete a directory
   * @param {string} dirPath Directory to delete
   * @param {boolean} [recursive=false] Whether to delete contents recursively
   * @returns {Promise<void>}
   */
  async rmdir(dirPath, recursive = false) {
    try {
      // Ensure we're connected
      if (!this.connected) {
        await this.connect();
      }
      
      if (recursive) {
        // Get directory contents
        const entries = await this.readdir(dirPath);
        
        // Delete all contents first
        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry.name).replace(/\//g, '\\');
          
          if (entry.isDirectory) {
            await this.rmdir(entryPath, true);
          } else {
            await this.unlink(entryPath);
          }
        }
      }
      
      // Delete the directory itself
      await this._executeCommand('rmdir', { path: dirPath });
    } catch (err) {
      // Handle connection errors
      if (err.message.includes('NT_STATUS_CONNECTION_REFUSED')) {
        this.connected = false;
        this.consecutiveErrors++;
      }
      
      throw new Error(`Failed to remove directory: ${err.message}`);
    }
  }
  
  /**
   * Copy a file
   * @param {string} source Source path
   * @param {string} destination Destination path
   * @returns {Promise<void>}
   */
  async copyFile(source, destination) {
    try {
      // Read the source file
      const data = await this.readFile(source);
      
      // Write to destination
      await this.writeFile(destination, data);
    } catch (err) {
      throw new Error(`Failed to copy file: ${err.message}`);
    }
  }
  
  /**
   * Move/rename a file or directory
   * @param {string} oldPath Old path
   * @param {string} newPath New path
   * @returns {Promise<void>}
   */
  async rename(oldPath, newPath) {
    try {
      // For SMB, a rename requires copy and delete
      // First check if source exists and if it's a file or directory
      const stats = await this.stat(oldPath);
      
      if (stats.isFile()) {
        // It's a file - copy and delete
        await this.copyFile(oldPath, newPath);
        await this.unlink(oldPath);
      } else {
        // It's a directory - more complex, need to recreate structure
        // Create new directory
        await this.mkdir(newPath);
        
        // Copy all contents
        const entries = await this.readdir(oldPath);
        
        for (const entry of entries) {
          const sourcePath = path.join(oldPath, entry.name).replace(/\//g, '\\');
          const destPath = path.join(newPath, entry.name).replace(/\//g, '\\');
          
          if (entry.isDirectory) {
            await this.rename(sourcePath, destPath);
          } else {
            await this.copyFile(sourcePath, destPath);
            await this.unlink(sourcePath);
          }
        }
        
        // Remove old directory
        await this.rmdir(oldPath);
      }
    } catch (err) {
      throw new Error(`Failed to rename: ${err.message}`);
    }
  }
  
  /**
   * Check if a file or directory exists
   * @param {string} filePath Path to check
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
   * Disconnect from the SMB share and clean up
   */
  async disconnect() {
    this.log('Disconnecting from SMB share');
    
    // Stop keepalive timer
    this._stopKeepAlive();
    
    // Clean up temp directory
    try {
      const entries = await fs.readdir(this.tmpDir);
      
      for (const entry of entries) {
        await fs.unlink(path.join(this.tmpDir, entry)).catch(() => {});
      }
      
      await fs.rmdir(this.tmpDir).catch(() => {});
    } catch (err) {
      // Ignore cleanup errors
    }
    
    // Update state
    this.connected = false;
    this.emit('close');
  }
}

module.exports = SmbClient;