/**
 * OS-based SMB Client Implementation
 * Uses system commands to access SMB/CIFS shares across platforms
 */
const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');
const { exec, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const util = require('util');

// Promisify functions
const execPromise = util.promisify(exec);
const execFilePromise = util.promisify(execFile);
const fsPromises = fs.promises;

/**
 * Platform-agnostic SMB/CIFS client for file operations
 * Uses system commands for maximum compatibility
 */
class SmbClient extends EventEmitter {
  /**
   * Create a new SMB client
   * @param {Object} options Client connection options
   * @param {string} options.host Target hostname or IP
   * @param {string} options.share Share name
   * @param {string} [options.domain=''] Domain name
   * @param {string} [options.username=''] Username
   * @param {string} [options.password=''] Password
   * @param {number} [options.port=445] SMB port
   * @param {number} [options.timeout=30000] Connection timeout in ms
   * @param {boolean} [options.debug=false] Enable debug logging
   */
  constructor(options = {}) {
    super();
    
    this.id = uuidv4();
    this.host = options.host || '';
    this.share = options.share || '';
    this.domain = options.domain || '';
    this.username = options.username || '';
    this.password = options.password || '';
    this.port = options.port || 445; // SMB default port
    this.timeout = options.timeout || 30000; // 30 seconds default
    
    // Connection state
    this.connected = false;
    
    // Debug mode
    this.debug = options.debug || false;
    
    // Platform detection
    this.platform = os.platform();
    this.isWindows = this.platform === 'win32';
    this.isMac = this.platform === 'darwin';
    this.isLinux = this.platform === 'linux';
    
    // Temp directory for operations
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smb-client-'));
    
    // Tracking mount point
    this.mountPoint = null;
    this.cleanupRequired = false;
  }
  
  /**
   * Log debug messages
   * Always logs errors and important messages regardless of debug mode
   * @param {...any} args Arguments to log
   */
  log(...args) {
    // Always log errors and important status messages, even if debug is off
    const isError = args.some(arg => 
      typeof arg === 'string' && 
      (arg.includes('error') || arg.includes('fail') || arg.includes('timeout'))
    );
    
    if (this.debug || isError || process.env.SMB_LOG === 'true') {
      console.log(`[SMB:${this.id}]`, ...args);
    }
  }
  
  /**
   * Platform-specific commands and utilities
   */
  getPlatformCommands() {
    if (this.isWindows) {
      return {
        // Windows
        testCommand: 'net use',
        connectCommand: (host, share, username, password, domain) => {
          const credentials = domain 
            ? `${domain}\\${username}` 
            : username;
            
          return `net use \\\\${host}\\${share} "${password}" /user:${credentials}`;
        },
        disconnectCommand: (host, share) => `net use \\\\${host}\\${share} /delete`,
        listCommand: (path) => `dir "${path}" /b`,
        copyCommand: (src, dest) => `copy "${src}" "${dest}" /y`,
        deleteCommand: (path) => `del "${path}" /q`,
        makeDirCommand: (path) => `mkdir "${path}"`,
        removeDirCommand: (path) => `rmdir "${path}" /s /q`,
        getFullPath: (host, share, filepath) => `\\\\${host}\\${share}\\${filepath}`,
      };
    } else if (this.isMac) {
      return {
        // macOS
        testCommand: 'mount',
        mountPoint: path.join(this.tempDir, 'smb_mount'),
        connectCommand: (host, share, username, password, domain) => {
          const credentials = domain 
            ? `${domain};${username}` 
            : username;
            
          return `mkdir -p "${this.tempDir}/smb_mount" && mount -t smbfs "//${credentials}:${password}@${host}/${share}" "${this.tempDir}/smb_mount"`;
        },
        disconnectCommand: () => `umount "${this.tempDir}/smb_mount"`,
        listCommand: (path) => `ls -1 "${path}"`,
        copyCommand: (src, dest) => `cp "${src}" "${dest}"`,
        deleteCommand: (path) => `rm "${path}"`,
        makeDirCommand: (path) => `mkdir -p "${path}"`,
        removeDirCommand: (path) => `rm -rf "${path}"`,
        getFullPath: (host, share, filepath) => path.join(this.tempDir, 'smb_mount', filepath),
      };
    } else {
      // Linux and other platforms
      return {
        testCommand: 'which smbclient',
        mountPoint: path.join(this.tempDir, 'smb_mount'),
        connectCommand: (host, share, username, password, domain) => {
          const credentials = domain 
            ? `${domain}\\${username}` 
            : username;
          
          // There are multiple implementation options for Linux:
          // 1. Using mount (requires root)
          // 2. Using smbclient (more reliable in non-root environments)
          
          // Create credentials file for security
          const credFile = path.join(this.tempDir, '.smbcredentials');
          fs.writeFileSync(credFile, `username=${credentials}\npassword=${password}`, { mode: 0o600 });
          
          // Let's try a different approach using smbclient instead of mount
          // This stores authentication in a credentials file but doesn't require root
          const testCmd = `mkdir -p "${this.tempDir}/smb_mount" && ` +
                         `echo "Creating test connection to SMB server..." && ` +
                         `smbclient -U "${credentials}%${password}" "//${host}/${share}" -c "ls" 2>&1`;
        
          return testCmd;
        },
        disconnectCommand: () => `rm -rf "${this.tempDir}/smb_mount" "${this.tempDir}/.smbcredentials"`,
        listCommand: (path) => {
          const normPath = path.replace(/^[\/\\]+/, '').replace(/[\/\\]+$/, '') || '.';
          return `smbclient -A ${this.tempDir}/.smbcredentials "//${this.host}/${this.share}" -c "ls ${normPath}"`;
        },
        copyCommand: (src, dest) => {
          if (src.startsWith('//')) {
            // Get from SMB to local
            const remotePath = src.replace(`//${this.host}/${this.share}/`, '');
            return `smbclient -A ${this.tempDir}/.smbcredentials "//${this.host}/${this.share}" -c "get ${remotePath} ${dest}"`;
          } else {
            // Put from local to SMB
            const remotePath = dest.replace(`//${this.host}/${this.share}/`, '');
            return `smbclient -A ${this.tempDir}/.smbcredentials "//${this.host}/${this.share}" -c "put ${src} ${remotePath}"`;
          }
        },
        deleteCommand: (path) => {
          const remotePath = path.replace(`//${this.host}/${this.share}/`, '').replace(/^[\/\\]+/, '');
          return `smbclient -A ${this.tempDir}/.smbcredentials "//${this.host}/${this.share}" -c "del ${remotePath}"`;
        },
        makeDirCommand: (path) => {
          const remotePath = path.replace(`//${this.host}/${this.share}/`, '').replace(/^[\/\\]+/, '');
          return `smbclient -A ${this.tempDir}/.smbcredentials "//${this.host}/${this.share}" -c "mkdir ${remotePath}"`;
        },
        removeDirCommand: (path) => {
          const remotePath = path.replace(`//${this.host}/${this.share}/`, '').replace(/^[\/\\]+/, '');
          return `smbclient -A ${this.tempDir}/.smbcredentials "//${this.host}/${this.share}" -c "rmdir ${remotePath}"`;
        },
        getFullPath: (host, share, filepath) => `//${host}/${share}/${filepath}`,
      };
    }
  }
  
  /**
   * Connect to the SMB share
   * @returns {Promise<boolean>} Connection success
   */
  async connect() {
    if (this.connected) {
      return true;
    }
    
    try {
      // Always log connection attempts
      console.log(`[SMB:${this.id}] Connecting to ${this.host}\\${this.share}`);
      
      // Log all connection parameters (except password)
      const connectionDetails = {
        host: this.host,
        share: this.share,
        domain: this.domain || 'none',
        username: this.username || 'none',
        platform: this.platform,
        tempDir: this.tempDir
      };
      console.log(`[SMB:${this.id}] Connection parameters:`, connectionDetails);
      
      // Get platform-specific commands
      const commands = this.getPlatformCommands();
      
      // Create connection command
      const connectCmd = commands.connectCommand(
        this.host, 
        this.share, 
        this.username, 
        this.password, 
        this.domain
      );
      
      this.log(`Executing command to connect to SMB share (command details hidden)`);
      
      // Execute connection command
      await execPromise(connectCmd, { timeout: this.timeout });
      
      // Mark as connected
      this.connected = true;
      this.cleanupRequired = true;
      
      // Store mount point if applicable
      if (commands.mountPoint) {
        this.mountPoint = commands.mountPoint;
      }
      
      this.log(`Connected successfully to ${this.host}\\${this.share}`);
      return true;
    } catch (err) {
      // Always log connection failures with full details
      console.log(`[SMB:${this.id}] Connection failed: ${err.message}`);
      
      // Add suggestions for common errors
      if (err.message.includes('Permission denied') || 
          err.message.includes('access denied') ||
          err.message.includes('not authorized')) {
        console.log(`[SMB:${this.id}] Suggestion: Check username and password credentials.`);
      } else if (err.message.includes('No such file') || 
                 err.message.includes('Cannot find') ||
                 err.message.includes('not found')) {
        console.log(`[SMB:${this.id}] Suggestion: Verify the host and share name are correct.`);
      } else if (err.message.includes('timed out') || 
                 err.message.includes('unreachable')) {
        console.log(`[SMB:${this.id}] Suggestion: Check if the SMB server is running and accessible.`);
      }
      
      await this.disconnect();
      throw new Error(`Failed to connect to SMB share: ${err.message}`);
    }
  }
  
  /**
   * Normalize path for SMB operations
   * @param {string} filePath Path to normalize
   * @returns {string} Normalized path
   * @private
   */
  _normalizePath(filePath = '') {
    // Remove leading/trailing slashes
    let normalizedPath = filePath.replace(/^[\/\\]+|[\/\\]+$/g, '');
    
    // Handle platform-specific path separators
    if (this.isWindows) {
      // Windows uses backslashes
      normalizedPath = normalizedPath.replace(/\//g, '\\');
    } else {
      // Unix systems use forward slashes
      normalizedPath = normalizedPath.replace(/\\/g, '/');
    }
    
    return normalizedPath;
  }
  
  /**
   * Get the full path to a file on the SMB share
   * @param {string} filePath Path relative to share
   * @returns {string} Full path
   * @private
   */
  _getFullPath(filePath) {
    const normalizedPath = this._normalizePath(filePath);
    const commands = this.getPlatformCommands();
    
    return commands.getFullPath(this.host, this.share, normalizedPath);
  }
  
  /**
   * Check connection state
   * @throws {Error} If not connected
   * @private
   */
  _checkConnection() {
    if (!this.connected) {
      throw new Error('Not connected to SMB share');
    }
  }
  
  /**
   * Disconnect from the SMB share
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this.connected || !this.cleanupRequired) {
      return;
    }
    
    try {
      this.log(`Disconnecting from \\\\${this.host}\\${this.share}`);
      
      // Get platform-specific commands
      const commands = this.getPlatformCommands();
      
      // Create disconnect command
      const disconnectCmd = commands.disconnectCommand(this.host, this.share);
      
      // Execute disconnect command
      await execPromise(disconnectCmd, { timeout: this.timeout });
      
      // Clean up temp directory if needed
      if (this.tempDir && fs.existsSync(this.tempDir)) {
        try {
          fs.rmSync(this.tempDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          this.log(`Warning: Could not clean up temp directory: ${cleanupErr.message}`);
        }
      }
      
      this.connected = false;
      this.cleanupRequired = false;
      this.mountPoint = null;
      
      this.log(`Disconnected from \\\\${this.host}\\${this.share}`);
    } catch (err) {
      this.log(`Error disconnecting: ${err.message}`);
      
      // Still mark as disconnected to prevent reuse
      this.connected = false;
    }
  }
  
  /**
   * Close the client connection
   * Alias for disconnect
   * @returns {Promise<void>}
   */
  async close() {
    return this.disconnect();
  }
  
  /**
   * Read a directory listing
   * @param {string} dirPath Path to the directory
   * @returns {Promise<Array<object>>} Array of file/directory entries
   */
  async readdir(dirPath = '') {
    this._checkConnection();
    const normalizedPath = this._normalizePath(dirPath);
    
    try {
      this.log(`Reading directory: ${normalizedPath || '\\'}`);
      
      // Get the command to list directory
      const commands = this.getPlatformCommands();
      
      // Get full path to the directory
      const fullPath = this._getFullPath(normalizedPath);
      
      // Create list command
      const listCmd = commands.listCommand(fullPath);
      
      this.log(`Executing directory listing command: ${listCmd}`);
      
      // Execute list command
      const { stdout } = await execPromise(listCmd, { timeout: this.timeout });
      
      // Log command output for debugging
      this.log(`Directory listing output: ${stdout.length} bytes`);
      if (this.debug) {
        console.log(`[SMB:${this.id}] Directory listing raw output:\n${stdout}`);
      }
      
      // Parse the output based on platform
      let items = [];
      
      if (this.isWindows) {
        // Windows format - split by lines and filter empty lines
        items = stdout.split(/\r?\n/)
          .filter(line => line.trim() !== '')
          .map(filename => ({
            name: filename.trim(),
            isDirectory: !filename.includes('.'),
            size: 0,
            modified: new Date().toISOString()
          }));
      } else if (this.isLinux || this.isMac) {
        // Parse smbclient output format:
        // Parse smbclient output which looks like:
        //   .                                   D        0  Thu Jan  1 00:00:00 1970
        //   ..                                  D        0  Thu Jan  1 00:00:00 1970
        //   myfile.txt                          A    12345  Mon Feb  3 10:20:30 2020
        const lines = stdout.split(/\r?\n/);
        
        // Look for lines with file/directory information
        for (const line of lines) {
          // Skip header, prompt lines and empty lines
          if (!line.trim() || 
              line.includes('blocks of size') || 
              line.includes('Domain=') || 
              line.includes('smb:')) {
            continue;
          }
          
          // Parse file/dir info - the format is name followed by attributes
          const match = line.match(/^\s*([^\s]+)\s+([A-Z]+)\s+(\d+)\s+(.+)$/);
          if (match) {
            const name = match[1].trim();
            const attrs = match[2]; // A=file, D=directory, etc.
            const size = parseInt(match[3], 10) || 0;
            const dateStr = match[4] || '';
            
            // Skip . and .. entries
            if (name === '.' || name === '..') {
              continue;
            }
            
            items.push({
              name,
              isDirectory: attrs.includes('D'),
              size,
              modified: dateStr 
            });
          } else {
            // Try simpler parsing - just extract names
            const nameParts = line.trim().split(/\s+/);
            if (nameParts.length > 0 && nameParts[0] !== '.' && nameParts[0] !== '..') {
              items.push({
                name: nameParts[0],
                isDirectory: line.includes('D'), // Look for D attribute
                size: 0,
                modified: new Date().toISOString()
              });
            }
          }
        }
      }
      
      this.log(`Found ${items.length} items in directory ${normalizedPath || '\\'}`);
      return items;
    } catch (err) {
      this.log(`Error reading directory ${normalizedPath}: ${err.message}`);
      
      if (err.message.includes('No such file') || 
          err.message.includes('Cannot find') ||
          err.message.includes('not found')) {
        throw new Error(`Directory not found: ${normalizedPath}`);
      }
      
      throw new Error(`Failed to read directory: ${err.message}`);
    }
  }
  
  /**
   * Get file or directory information
   * @param {string} filePath Path to the file or directory
   * @returns {Promise<Object>} File stats
   */
  async stat(filePath) {
    this._checkConnection();
    const normalizedPath = this._normalizePath(filePath);
    
    try {
      this.log(`Getting stats for: ${normalizedPath}`);
      
      // Get the full path
      const fullPath = this._getFullPath(normalizedPath);
      
      // Check if it's a directory by trying to list it
      try {
        const commands = this.getPlatformCommands();
        const listCmd = commands.listCommand(fullPath);
        await execPromise(listCmd, { timeout: this.timeout });
        
        // If it succeeds, it's a directory
        return {
          size: 0,
          isDirectory: () => true,
          isFile: () => false,
          mtime: new Date(),
          atime: new Date(),
          ctime: new Date(),
          birthtime: new Date()
        };
      } catch (dirErr) {
        // Not a directory, check if it's a file
        if (dirErr.message.includes('No such file') || 
            dirErr.message.includes('Cannot find') ||
            dirErr.message.includes('not found')) {
          
          // Try to read the file - if it succeeds, it's a file
          try {
            await this.readFile(normalizedPath, null, true); // Just check, don't read data
            
            // If it succeeds, it's a file
            return {
              size: 0, // Size not available without additional commands
              isDirectory: () => false,
              isFile: () => true,
              mtime: new Date(),
              atime: new Date(),
              ctime: new Date(),
              birthtime: new Date()
            };
          } catch (fileErr) {
            // Neither a directory nor a file
            throw new Error(`Path not found: ${normalizedPath}`);
          }
        } else {
          // Some other error
          throw dirErr;
        }
      }
    } catch (err) {
      this.log(`Error getting stats for ${normalizedPath}: ${err.message}`);
      throw new Error(`Failed to get file stats: ${err.message}`);
    }
  }
  
  /**
   * Read a file's contents
   * @param {string} filePath Path to the file
   * @param {string} [encoding] Optional encoding (if null, returns Buffer)
   * @param {boolean} [checkOnly] Just check if file exists, don't read data
   * @returns {Promise<string|Buffer>} File contents
   */
  async readFile(filePath, encoding = null, checkOnly = false) {
    this._checkConnection();
    const normalizedPath = this._normalizePath(filePath);
    
    try {
      this.log(`Reading file: ${normalizedPath}`);
      
      // Get full path
      const fullPath = this._getFullPath(normalizedPath);
      
      if (checkOnly) {
        // Just check if the file exists, don't read data
        if (this.isWindows) {
          // On Windows, use 'if exist' to check
          await execPromise(`if not exist "${fullPath}" exit 1`, { timeout: this.timeout });
        } else {
          // On Unix, use 'test' to check
          await execPromise(`test -f "${fullPath}"`, { timeout: this.timeout });
        }
        return Buffer.alloc(0); // Return empty buffer for check only
      }
      
      // Read the file to a temp location first
      const tempFile = path.join(this.tempDir, `read_${Math.random().toString(36).substring(2)}`);
      
      // Get platform-specific commands
      const commands = this.getPlatformCommands();
      
      // Create copy command to copy from SMB to local
      const copyCmd = commands.copyCommand(fullPath, tempFile);
      
      // Execute copy command
      await execPromise(copyCmd, { timeout: this.timeout });
      
      // Read the local copy
      const content = await fsPromises.readFile(tempFile);
      
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupErr) {
        this.log(`Warning: Could not clean up temp file: ${cleanupErr.message}`);
      }
      
      // Return as buffer or convert to string based on encoding
      return encoding ? content.toString(encoding) : content;
    } catch (err) {
      this.log(`Error reading file ${normalizedPath}: ${err.message}`);
      
      if (err.message.includes('No such file') || 
          err.message.includes('Cannot find') ||
          err.message.includes('not found')) {
        throw new Error(`File not found: ${normalizedPath}`);
      }
      
      throw new Error(`Failed to read file: ${err.message}`);
    }
  }
  
  /**
   * Write data to a file
   * @param {string} filePath Path to the file
   * @param {string|Buffer} data Data to write
   * @param {string} [encoding] Optional encoding (if data is string)
   * @returns {Promise<void>}
   */
  async writeFile(filePath, data, encoding = null) {
    this._checkConnection();
    const normalizedPath = this._normalizePath(filePath);
    
    try {
      this.log(`Writing file: ${normalizedPath}`);
      
      // Create a temp file
      const tempFile = path.join(this.tempDir, `write_${Math.random().toString(36).substring(2)}`);
      
      // Convert string to buffer if needed
      const buffer = typeof data === 'string' 
        ? Buffer.from(data, encoding || 'utf8') 
        : data;
      
      // Write data to temp file
      await fsPromises.writeFile(tempFile, buffer);
      
      // Get full path to destination
      const fullPath = this._getFullPath(normalizedPath);
      
      // Get platform-specific commands
      const commands = this.getPlatformCommands();
      
      // Create copy command to copy from local to SMB
      const copyCmd = commands.copyCommand(tempFile, fullPath);
      
      // Execute copy command
      await execPromise(copyCmd, { timeout: this.timeout });
      
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupErr) {
        this.log(`Warning: Could not clean up temp file: ${cleanupErr.message}`);
      }
    } catch (err) {
      this.log(`Error writing file ${normalizedPath}: ${err.message}`);
      throw new Error(`Failed to write file: ${err.message}`);
    }
  }
  
  /**
   * Delete a file
   * @param {string} filePath Path to the file
   * @returns {Promise<void>}
   */
  async unlink(filePath) {
    this._checkConnection();
    const normalizedPath = this._normalizePath(filePath);
    
    try {
      this.log(`Deleting file: ${normalizedPath}`);
      
      // Get full path
      const fullPath = this._getFullPath(normalizedPath);
      
      // Get platform-specific commands
      const commands = this.getPlatformCommands();
      
      // Create delete command
      const deleteCmd = commands.deleteCommand(fullPath);
      
      // Execute delete command
      await execPromise(deleteCmd, { timeout: this.timeout });
    } catch (err) {
      this.log(`Error deleting file ${normalizedPath}: ${err.message}`);
      throw new Error(`Failed to delete file: ${err.message}`);
    }
  }
  
  /**
   * Create a directory
   * @param {string} dirPath Path to the directory
   * @returns {Promise<void>}
   */
  async mkdir(dirPath) {
    this._checkConnection();
    const normalizedPath = this._normalizePath(dirPath);
    
    try {
      this.log(`Creating directory: ${normalizedPath}`);
      
      // Get full path
      const fullPath = this._getFullPath(normalizedPath);
      
      // Get platform-specific commands
      const commands = this.getPlatformCommands();
      
      // Create mkdir command
      const mkdirCmd = commands.makeDirCommand(fullPath);
      
      // Execute mkdir command
      await execPromise(mkdirCmd, { timeout: this.timeout });
    } catch (err) {
      this.log(`Error creating directory ${normalizedPath}: ${err.message}`);
      throw new Error(`Failed to create directory: ${err.message}`);
    }
  }
  
  /**
   * Delete a directory
   * @param {string} dirPath Path to the directory
   * @param {boolean} recursive Whether to recursively delete contents
   * @returns {Promise<void>}
   */
  async rmdir(dirPath, recursive = false) {
    this._checkConnection();
    const normalizedPath = this._normalizePath(dirPath);
    
    try {
      this.log(`Removing directory: ${normalizedPath} (recursive: ${recursive})`);
      
      // Get full path
      const fullPath = this._getFullPath(normalizedPath);
      
      // Get platform-specific commands
      const commands = this.getPlatformCommands();
      
      if (recursive) {
        // Use the recursive remove command
        const rmdirCmd = commands.removeDirCommand(fullPath);
        await execPromise(rmdirCmd, { timeout: this.timeout });
      } else {
        // First check if the directory is empty
        const listCmd = commands.listCommand(fullPath);
        const { stdout } = await execPromise(listCmd, { timeout: this.timeout });
        
        const lines = stdout.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length > 0) {
          throw new Error('Directory not empty');
        }
        
        // Use the recursive remove command
        const rmdirCmd = commands.removeDirCommand(fullPath);
        await execPromise(rmdirCmd, { timeout: this.timeout });
      }
    } catch (err) {
      this.log(`Error removing directory ${normalizedPath}: ${err.message}`);
      throw new Error(`Failed to remove directory: ${err.message}`);
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
    } catch {
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
    this._checkConnection();
    const normalizedSource = this._normalizePath(source);
    const normalizedDest = this._normalizePath(destination);
    
    try {
      this.log(`Copying file: ${normalizedSource} to ${normalizedDest}`);
      
      // Get full paths
      const fullSrcPath = this._getFullPath(normalizedSource);
      const fullDestPath = this._getFullPath(normalizedDest);
      
      // Get platform-specific commands
      const commands = this.getPlatformCommands();
      
      // Create copy command
      const copyCmd = commands.copyCommand(fullSrcPath, fullDestPath);
      
      // Execute copy command
      await execPromise(copyCmd, { timeout: this.timeout });
    } catch (err) {
      this.log(`Error copying file ${normalizedSource} to ${normalizedDest}: ${err.message}`);
      throw new Error(`Failed to copy file: ${err.message}`);
    }
  }
  
  /**
   * Move or rename a file or directory
   * @param {string} oldPath Old path
   * @param {string} newPath New path
   * @returns {Promise<void>}
   */
  async rename(oldPath, newPath) {
    this._checkConnection();
    const normalizedOldPath = this._normalizePath(oldPath);
    const normalizedNewPath = this._normalizePath(newPath);
    
    try {
      this.log(`Renaming: ${normalizedOldPath} to ${normalizedNewPath}`);
      
      // On most platforms, copy then delete is safer than move across SMB
      // Get stat first to know if it's a file or directory
      const stats = await this.stat(normalizedOldPath);
      
      if (stats.isFile()) {
        // Copy the file
        await this.copyFile(normalizedOldPath, normalizedNewPath);
        
        // Delete the original
        await this.unlink(normalizedOldPath);
      } else {
        // For directories, create the new one
        await this.mkdir(normalizedNewPath);
        
        // Copy all contents
        const entries = await this.readdir(normalizedOldPath);
        
        for (const entry of entries) {
          const srcPath = path.join(normalizedOldPath, entry.name);
          const destPath = path.join(normalizedNewPath, entry.name);
          
          if (entry.isDirectory) {
            await this.rename(srcPath, destPath);
          } else {
            await this.copyFile(srcPath, destPath);
            await this.unlink(srcPath);
          }
        }
        
        // Remove the original directory
        await this.rmdir(normalizedOldPath, false);
      }
    } catch (err) {
      this.log(`Error renaming ${normalizedOldPath} to ${normalizedNewPath}: ${err.message}`);
      throw new Error(`Failed to rename: ${err.message}`);
    }
  }
}

module.exports = SmbClient;