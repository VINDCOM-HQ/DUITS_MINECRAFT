const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');
const configModule = require('../lib/config');

function register(ipcMain, getState) {
  // getState() returns { smbClientMain, setSmbClientMain }

  ipcMain.handle('smb-connect', async (_e, { host, share, username, password, domain }) => {
    // If agent relay is enabled, proxy via HTTP API
    try {
      const agent = configModule.getAgentSettings();
      if (agent.enabled) {
        const base = agent.url.replace(/\/$/, '');
        const agentUrl = `${base}/smb/connect`;
        const options = { headers: { 'x-api-key': agent.apiKey } };
        if (agent.caFile) {
          const ca = fs.readFileSync(agent.caFile);
          options.httpsAgent = new https.Agent({ ca });
        }
        const resp = await axios.post(agentUrl, { host, share, username, password, domain }, options);
        if (resp.data && resp.data.success) return true;
        throw new Error(resp.data.error || 'Agent SMB connect failed');
      }
    } catch (err) {
      throw new Error(`Agent SMB connect failed: ${err.message}`);
    }

    // Clean up any existing client
    if (getState().smbClientMain) {
      try { getState().smbClientMain.close(); } catch {};
      getState().setSmbClientMain(null);
    }

    // Create connection options
    const smbOptions = {
      host,
      share,
      username,
      password,
      domain,
      debug: true  // Enable debug mode for better diagnostics
    };

    // Create and store the connection in the config
    try {
      const config = configModule.loadConfig();

      // Update or add the SMB connection
      if (!config.connections) {
        config.connections = [];
      }

      // Find existing SMB connection or create a new one
      const existingIndex = config.connections.findIndex(c => c && c.type === 'smb');
      if (existingIndex >= 0) {
        config.connections[existingIndex] = {
          ...config.connections[existingIndex],
          ...smbOptions,
          type: 'smb' // Ensure type is set
        };
      } else {
        config.connections.push({
          ...smbOptions,
          type: 'smb'
        });
      }

      // Save the config
      configModule.saveConfig(config);
      console.log(`[SMB] Saved connection to config file`);
    } catch (configErr) {
      console.warn(`[SMB] Failed to save connection to config: ${configErr.message}`);
      // Continue anyway - non-fatal error
    }

    // Create the client
    const StorageClient = require(path.join(path.resolve(__dirname, '..'), 'lib', 'storage'));
    getState().setSmbClientMain(new StorageClient(smbOptions));

    // Store options directly on client for easier access
    getState().smbClientMain.connectionOptions = smbOptions;

    console.log(`[SMB] Creating SMB client for ${host}\\${share} in client mode`);

    try {
      // Connect to the SMB share
      await getState().smbClientMain.connect();

      // Test connection by reading root directory
      console.log(`[SMB] Connected to SMB share, listing root directory`);
      const files = await getState().smbClientMain.readdir('');

      console.log(`[SMB] Successfully listed ${files.length} files/directories from root`);

      return true;
    } catch (err) {
      console.error(`[SMB] Connection or directory listing failed: ${err.message}`);

      // Clean up the client
      if (getState().smbClientMain) {
        try { getState().smbClientMain.close(); } catch {};
        getState().setSmbClientMain(null);
      }

      throw err;
    }
  });
  ipcMain.handle('smb-disconnect', async (_e) => {
    // If agent relay is enabled, proxy via HTTP API
    try {
      const agent = configModule.getAgentSettings();
      if (agent.enabled) {
        const base = agent.url.replace(/\/$/, '');
        const agentUrl = `${base}/smb/disconnect`;
        const options = { headers: { 'x-api-key': agent.apiKey } };
        if (agent.caFile) {
          const ca = fs.readFileSync(agent.caFile);
          options.httpsAgent = new https.Agent({ ca });
        }
        await axios.post(agentUrl, {}, options);
        return true;
      }
    } catch (err) {
      throw new Error(`Agent SMB disconnect failed: ${err.message}`);
    }
    if (getState().smbClientMain) {
      try { getState().smbClientMain.close(); } catch {};
      getState().setSmbClientMain(null);
    }
    return true;
  });
  ipcMain.handle('smb-readdir', async (_e, dirPath) => {
    if (!getState().smbClientMain) throw new Error('Not connected to SMB');

    console.log(`[SMB] Reading directory: "${dirPath || '<root>'}"`);

    try {
      // Try to list the directory
      const files = await getState().smbClientMain.readdir(dirPath);

      console.log(`[SMB] Successfully listed ${files.length} files/directories from "${dirPath || '<root>'}"`);

      // Sort files only alphabetically without changing directories/files order
      files.sort((a, b) => {
        return a.name.localeCompare(b.name);
      });

      // Log the result
      console.log(`[SMB] Returning directory listing (${files.length} items)`);

      // Map the response to the format expected by the renderer
      const mappedFiles = files.map(file => ({
        name: file.name,
        isDirectory: !!file.isDirectory,  // Ensure boolean
        size: file.size || 0,
        modified: file.modified || new Date().toISOString()
      }));

      return mappedFiles;
    } catch (err) {
      console.error(`[SMB] Directory listing failed: ${err.message}`);

      // If it's a potentially recoverable error, try to reconnect
      if (err.message.includes('Not connected') ||
          err.message.includes('Connection') ||
          err.message.includes('timed out') ||
          err.message.includes('ECONNRESET') ||
          err.message.includes('ETIMEDOUT')) {

        try {
          console.log(`[SMB] Attempting to reconnect...`);

          // Get the original connection parameters
          const config = configModule.loadConfig();
          const smbConfig = config.connections.find(c => c.type === 'smb') || {};

          if (smbConfig.host && smbConfig.share) {
            // Close the existing client
            if (getState().smbClientMain) {
              try { getState().smbClientMain.close(); } catch {};
              getState().setSmbClientMain(null);
            }

            // Create a new client
            const StorageClient = require(path.join(path.resolve(__dirname, '..'), 'lib', 'storage'));
            getState().setSmbClientMain(new StorageClient({
              host: smbConfig.host,
              share: smbConfig.share,
              username: smbConfig.username,
              password: smbConfig.password,
              debug: true
            }));

            console.log(`[SMB] Reconnecting to ${smbConfig.host}\\${smbConfig.share}`);

            // Connect and try again
            await getState().smbClientMain.connect();

            console.log(`[SMB] Reconnection successful, retrying directory listing`);

            // Try the directory listing again
            const files = await getState().smbClientMain.readdir(dirPath);

            console.log(`[SMB] Successfully listed ${files.length} files/directories after reconnection`);

            // Sort files only alphabetically without changing directories/files order
            files.sort((a, b) => {
              return a.name.localeCompare(b.name);
            });

            // Log the result after reconnection
            console.log(`[SMB] Returning directory listing after reconnection (${files.length} items)`);

            // Map the response to the format expected by the renderer, matching the format above
            const mappedFiles = files.map(file => ({
              name: file.name,
              isDirectory: !!file.isDirectory,  // Ensure boolean
              size: file.size || 0,
              modified: file.modified || new Date().toISOString()
            }));

            return mappedFiles;
          } else {
            console.error(`[SMB] Cannot reconnect: missing host/share in config`);
            throw err;
          }
        } catch (reconnectErr) {
          console.error(`[SMB] Reconnection failed: ${reconnectErr.message}`);
          throw new Error(`Failed to list directory: ${err.message} (Reconnection failed: ${reconnectErr.message})`);
        }
      }

      throw err;
    }
  });
  ipcMain.handle('smb-stat', async (_e, filePath) => {
    if (!getState().smbClientMain) throw new Error('Not connected to SMB');
    const stats = await getState().smbClientMain.stat(filePath);
    return { isDirectory: stats.isDirectory() };
  });
  ipcMain.handle('smb-read-file', async (_e, filePath) => {
    if (!getState().smbClientMain) throw new Error('Not connected to SMB');

    console.log(`[SMB] Reading file: "${filePath}"`);

    // Get the original connection parameters
    let smbConfig = {};
    try {
      const config = configModule.loadConfig();

      // Check if config and connections exist
      if (config && config.connections && Array.isArray(config.connections)) {
        const foundConfig = config.connections.find(c => c && c.type === 'smb');
        if (foundConfig) {
          smbConfig = foundConfig;
          console.log(`[SMB] Found config for ${smbConfig.host}\\${smbConfig.share}`);
        } else {
          console.log(`[SMB] No SMB connection found in config, using current connection`);
          // Use current connection details instead
          if (getState().smbClientMain) {
            // Extract info from the current client
            smbConfig = {
              host: getState().smbClientMain.options?.host || '',
              share: getState().smbClientMain.options?.share || '',
              username: getState().smbClientMain.options?.username || '',
              password: getState().smbClientMain.options?.password || '',
              domain: getState().smbClientMain.options?.domain || ''
            };
            console.log(`[SMB] Using current connection: ${smbConfig.host}\\${smbConfig.share}`);
          }
        }
      } else {
        console.warn(`[SMB] Config or connections array missing, using direct client connection info`);
        // Fallback to direct client info
        if (getState().smbClientMain) {
          // Extract info from the current client
          smbConfig = {
            host: getState().smbClientMain.options?.host || '',
            share: getState().smbClientMain.options?.share || '',
            username: getState().smbClientMain.options?.username || '',
            password: getState().smbClientMain.options?.password || '',
            domain: getState().smbClientMain.options?.domain || ''
          };
          console.log(`[SMB] Using direct connection: ${smbConfig.host}\\${smbConfig.share}`);
        }
      }
    } catch (configErr) {
      console.error(`[SMB] Error loading config: ${configErr.message}`);

      // Fallback to retrieving config from the client itself
      if (getState().smbClientMain) {
        // Try to extract info from the client
        smbConfig = {
          host: getState().smbClientMain.options?.host || '',
          share: getState().smbClientMain.options?.share || '',
          username: getState().smbClientMain.options?.username || '',
          password: getState().smbClientMain.options?.password || '',
          domain: getState().smbClientMain.options?.domain || ''
        };
        console.log(`[SMB] Using fallback connection info: ${smbConfig.host}\\${smbConfig.share}`);
      }
    }

    // Get direct connection info from the client if available
    if (!smbConfig.host && getState().smbClientMain && getState().smbClientMain.connectionOptions) {
      smbConfig = getState().smbClientMain.connectionOptions;
      console.log(`[SMB] Using direct connection options: ${smbConfig.host}\\${smbConfig.share}`);
    } else if (!smbConfig.host && getState().smbClientMain && getState().smbClientMain.options) {
      smbConfig = getState().smbClientMain.options;
      console.log(`[SMB] Using client options: ${smbConfig.host}\\${smbConfig.share}`);
    } else if (!smbConfig.host && getState().smbClientMain && getState().smbClientMain.client) {
      // Try to access through nested client
      const clientOpts = getState().smbClientMain.client.options ||
                        getState().smbClientMain.client.connectionParams ||
                        {};

      smbConfig = {
        host: clientOpts.host || '',
        share: clientOpts.share || '',
        username: clientOpts.username || '',
        password: clientOpts.password || '',
        domain: clientOpts.domain || ''
      };
      console.log(`[SMB] Using nested client options: ${smbConfig.host}\\${smbConfig.share}`);
    }

    // Use a completely native approach for maximum compatibility
    // This bypasses our SMB client implementation entirely
    if (process.platform === 'win32' && smbConfig.host && smbConfig.share) {
      try {
        console.log(`[SMB] Using direct Windows native approach for file download`);

        // Create a proper temp directory with a unique name
        const os = require('os');
        const crypto = require('crypto');
        const uniqueId = crypto.randomBytes(4).toString('hex');
        const tempDir = path.join(os.tmpdir(), `smb-dl-${uniqueId}`);

        // Create the temp directory
        fs.mkdirSync(tempDir, { recursive: true });
        console.log(`[SMB] Created temporary directory: ${tempDir}`);

        // Create a unique file name based on original file name
        const tempFileName = `dl-${Date.now()}-${path.basename(filePath)}`;
        const tempFilePath = path.join(tempDir, tempFileName);
        console.log(`[SMB] Target temporary file: ${tempFilePath}`);

        // Format the SMB path properly
        const smbFilePath = `\\\\${smbConfig.host}\\${smbConfig.share}${filePath.startsWith('\\') ? filePath : '\\' + filePath}`;
        console.log(`[SMB] SMB source file path: ${smbFilePath}`);

        // Try first to map the network drive using PowerShell
        try {
          const { execSync } = require('child_process');

          // Generate a strong random letter for drive mapping
          const driveLetter = String.fromCharCode(67 + Math.floor(Math.random() * 19)); // C-Z excluding some reserved

          // Create a PowerShell command to map drive, copy, and clean up
          // Using PowerShell for better error handling and security
          let psCommand = `
          $ErrorActionPreference = "Stop"

          # Function to handle cleanup
          function Cleanup {
              param($driveLetter)
              try {
                  Remove-PSDrive $driveLetter -Force -ErrorAction SilentlyContinue
              } catch {
                  Write-Host "Cleanup error: $_"
              }
          }

          # Map network drive
          $secpasswd = ConvertTo-SecureString '${smbConfig.password}' -AsPlainText -Force
          $creds = New-Object System.Management.Automation.PSCredential ('${smbConfig.username}', $secpasswd)

          try {
              New-PSDrive -Name ${driveLetter} -PSProvider FileSystem -Root "\\\\${smbConfig.host}\\${smbConfig.share}" -Credential $creds -Scope Global

              # Check if source file exists
              if(Test-Path ${driveLetter}:${filePath.replace(/\\/g, '\\\\')}) {
                  # Copy the file
                  Copy-Item -Path ${driveLetter}:${filePath.replace(/\\/g, '\\\\')} -Destination "${tempFilePath}" -Force
                  Write-Host "FILE_COPIED_SUCCESS: $((Get-Item "${tempFilePath}").Length) bytes"
              } else {
                  Write-Host "FILE_NOT_FOUND: Source file does not exist"
                  exit 1
              }
          } catch {
              Write-Host "ERROR: $_"
              exit 1
          } finally {
              # Always clean up
              Cleanup ${driveLetter}
          }`;

          // Execute the PowerShell script
          console.log(`[SMB] Executing PowerShell file copy script`);
          const output = execSync(`powershell -Command "${psCommand.replace(/"/g, '\\"')}"`, {
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024,
            windowsHide: true
          });

          // Log the output
          console.log(`[SMB] PowerShell output: ${output}`);

          // Check if file was successfully copied
          if (output.includes('FILE_COPIED_SUCCESS')) {
            // Extract the file size from the output
            const sizeMatch = output.match(/FILE_COPIED_SUCCESS: (\d+) bytes/);
            const fileSize = sizeMatch ? sizeMatch[1] : 'unknown';
            console.log(`[SMB] File successfully copied, size: ${fileSize} bytes`);

            // Check if file exists
            if (fs.existsSync(tempFilePath)) {
              // Read the file
              console.log(`[SMB] Reading file from temp location: ${tempFilePath}`);
              const fileData = fs.readFileSync(tempFilePath);

              // Clean up by removing the temp file and directory
              try {
                fs.unlinkSync(tempFilePath);
                fs.rmdirSync(tempDir);
                console.log(`[SMB] Cleaned up temporary files`);
              } catch (cleanupErr) {
                console.warn(`[SMB] Cleanup error: ${cleanupErr.message}`);
              }

              // Try to determine if it's text or binary
              try {
                const textContent = fileData.toString('utf8');
                if (textContent.includes('\uFFFD')) {
                  // Contains replacement character, likely binary
                  console.log(`[SMB] File appears to be binary (${fileData.length} bytes)`);
                  return fileData;
                } else {
                  console.log(`[SMB] File is text (${textContent.length} characters)`);
                  return textContent;
                }
              } catch (textErr) {
                // Encoding error, definitely binary
                console.log(`[SMB] File is definitely binary (${fileData.length} bytes)`);
                return fileData;
              }
            } else {
              throw new Error('File was reported as copied but does not exist');
            }
          } else if (output.includes('FILE_NOT_FOUND')) {
            throw new Error(`File not found: ${smbFilePath}`);
          } else {
            throw new Error(`PowerShell copy failed: ${output}`);
          }
        } catch (psErr) {
          console.error(`[SMB] PowerShell approach failed: ${psErr.message}`);

          // Try direct copy as backup approach
          try {
            const { execSync } = require('child_process');

            console.log(`[SMB] Attempting direct copy fallback`);

            // Build credential string
            const credString = smbConfig.username ?
              `/user:"${smbConfig.domain ? smbConfig.domain + '\\' : ''}${smbConfig.username}" ${smbConfig.password ? `/pass:"${smbConfig.password}"` : ''}` :
              '';

            // Attempt network connection with net use
            execSync(`net use "${smbFilePath.substring(0, smbFilePath.lastIndexOf('\\'))}" ${credString} /persistent:no`, {
              stdio: 'pipe',
              windowsHide: true
            });

            // Attempt the copy with xcopy which is more reliable than copy
            execSync(`xcopy "${smbFilePath}" "${tempFilePath}" /Y /Q /H /R`, {
              stdio: 'pipe',
              windowsHide: true
            });

            // Verify the file exists
            if (fs.existsSync(tempFilePath)) {
              // Read the file
              const fileData = fs.readFileSync(tempFilePath);

              // Clean up
              try {
                fs.unlinkSync(tempFilePath);
                fs.rmdirSync(tempDir);
              } catch (cleanupErr) {
                console.warn(`[SMB] Cleanup error: ${cleanupErr.message}`);
              }

              // Try to determine if it's text or binary
              try {
                const textContent = fileData.toString('utf8');
                if (textContent.includes('\uFFFD')) {
                  // Contains replacement character, likely binary
                  console.log(`[SMB] File appears to be binary (${fileData.length} bytes)`);
                  return fileData;
                } else {
                  console.log(`[SMB] File is text (${textContent.length} characters)`);
                  return textContent;
                }
              } catch (textErr) {
                // Encoding error, definitely binary
                console.log(`[SMB] File is definitely binary (${fileData.length} bytes)`);
                return fileData;
              }
            } else {
              throw new Error('File was not copied');
            }
          } catch (copyErr) {
            console.error(`[SMB] Direct copy fallback failed: ${copyErr.message}`);
            // Continue to client approach
          }
        }
      } catch (nativeErr) {
        console.error(`[SMB] Native file access approach failed: ${nativeErr.message}`);
        // Continue to client approach
      }
    }

    // Fall back to using the SMB client
    try {
      // Special handling for binary files - add a dedicated direct binary download function
      async function downloadBinaryFile(filepath) {
        console.log(`[SMB] Attempting direct binary file download for: ${filepath}`);

        const os = require('os');
        const tempPath = path.join(os.tmpdir(), `download-${Date.now()}-${path.basename(filepath)}`);

        // Try PowerShell first - most reliable for large binary files
        try {
          const { execSync } = require('child_process');

          // Create a PowerShell script for downloading
          console.log(`[SMB] Using PowerShell to download binary file to: ${tempPath}`);

          let psScript = `
          $ErrorActionPreference = "Stop"

          ${smbConfig.username ? `
          # Create credentials object
          $secpasswd = ConvertTo-SecureString '${smbConfig.password || ""}' -AsPlainText -Force
          $creds = New-Object System.Management.Automation.PSCredential ('${smbConfig.domain ? smbConfig.domain + "\\" : ""}${smbConfig.username}', $secpasswd)
          ` : ''}

          try {
            # Create a PSDrive
            ${smbConfig.username ? `
              New-PSDrive -Name Z -PSProvider FileSystem -Root "\\\\${smbConfig.host}\\${smbConfig.share}" -Credential $creds -Scope Global
            ` : `
              New-PSDrive -Name Z -PSProvider FileSystem -Root "\\\\${smbConfig.host}\\${smbConfig.share}" -Scope Global
            `}

            # Copy the file
            Copy-Item -Path "Z:${filepath.replace(/\\/g, '\\\\')}" -Destination "${tempPath.replace(/\\/g, '\\\\')}" -Force

            # Report success with file size
            $fileSize = (Get-Item -Path "${tempPath.replace(/\\/g, '\\\\')}").Length
            Write-Output "SUCCESS: Downloaded file, size: $fileSize bytes"

            # Remove the drive
            Remove-PSDrive -Name Z -Force
          } catch {
            Write-Error "PowerShell download failed: $_"
            exit 1
          }
          `;

          // Execute the PowerShell script
          console.log(`[SMB] Executing PowerShell download script`);
          const result = execSync(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`, {
            encoding: 'utf8',
            maxBuffer: 100 * 1024 * 1024, // 100MB buffer for large files
            windowsHide: true
          });

          // Check if download succeeded
          if (result.includes("SUCCESS:")) {
            console.log(`[SMB] PowerShell download succeeded: ${result.trim()}`);

            // Read the file as binary data
            console.log(`[SMB] Reading downloaded file as binary data`);
            const data = fs.readFileSync(tempPath);

            // Clean up the temp file
            try {
              fs.unlinkSync(tempPath);
              console.log(`[SMB] Cleaned up temporary file: ${tempPath}`);
            } catch (cleanupErr) {
              console.warn(`[SMB] Failed to clean up temp file: ${cleanupErr.message}`);
              // Continue anyway
            }

            return data;
          } else {
            throw new Error(`PowerShell download did not succeed: ${result}`);
          }
        } catch (psErr) {
          // If PowerShell fails, fall back to direct binary read from smbClientMain
          console.error(`[SMB] PowerShell binary download failed: ${psErr.message}`);

          try {
            console.log(`[SMB] Falling back to direct SMB client binary read`);
            return await getState().smbClientMain.readFile(filepath);
          } catch (clientErr) {
            console.error(`[SMB] SMB client binary read failed: ${clientErr.message}`);
            throw clientErr;
          }
        }
      }

      // Check file extension to determine if it's likely binary
      const ext = path.extname(filePath).toLowerCase();
      const binaryExtensions = ['.jar', '.zip', '.exe', '.dll', '.bin', '.dat', '.class', '.png', '.jpg', '.jpeg', '.gif'];

      // If it's a known binary format, read as binary directly
      if (binaryExtensions.includes(ext)) {
        console.log(`[SMB] File has binary extension (${ext}), using special binary download`);
        try {
          // Use the specialized binary download function
          const binaryContent = await downloadBinaryFile(filePath);
          console.log(`[SMB] Successfully downloaded binary file: "${filePath}" (${binaryContent.length} bytes)`);
          return binaryContent;
        } catch (binErr) {
          console.error(`[SMB] Binary download failed, falling back to regular method: ${binErr.message}`);
          // Fall back to regular method
          const binaryContent = await getState().smbClientMain.readFile(filePath);
          console.log(`[SMB] Successfully read binary file with regular method: "${filePath}" (${binaryContent.length} bytes)`);
          return binaryContent;
        }
      }

      // Otherwise try to read as text - this works for most files including configuration files
      const content = await getState().smbClientMain.readFile(filePath, 'utf8');
      console.log(`[SMB] Successfully read file as text: "${filePath}" (${content.length} characters)`);
      return content;
    } catch (err) {
      console.error(`[SMB] Error reading file as text: ${err.message}`);

      // If it's a reconnectable error, try to reconnect
      if (err.message.includes('Not connected') ||
          err.message.includes('Connection') ||
          err.message.includes('timed out') ||
          err.message.includes('ECONNRESET') ||
          err.message.includes('ETIMEDOUT')) {

        try {
          console.log(`[SMB] Attempting to reconnect for file read...`);

          // Get the original connection parameters
          const config = configModule.loadConfig();
          const smbConfig = config.connections.find(c => c.type === 'smb') || {};

          if (smbConfig.host && smbConfig.share) {
            // Close the existing client
            if (getState().smbClientMain) {
              try { getState().smbClientMain.close(); } catch {};
              getState().setSmbClientMain(null);
            }

            // Create a new client
            const StorageClient = require(path.join(path.resolve(__dirname, '..'), 'lib', 'storage'));
            getState().setSmbClientMain(new StorageClient({
              host: smbConfig.host,
              share: smbConfig.share,
              username: smbConfig.username,
              password: smbConfig.password,
              debug: true
            }));

            console.log(`[SMB] Reconnecting to ${smbConfig.host}\\${smbConfig.share} for file read`);

            // Connect and try again
            await getState().smbClientMain.connect();

            console.log(`[SMB] Reconnection successful, retrying file read`);

            // Try reading as text again
            const content = await getState().smbClientMain.readFile(filePath, 'utf8');
            console.log(`[SMB] Successfully read file as text after reconnection: "${filePath}" (${content.length} characters)`);
            return content;
          }
        } catch (reconnectErr) {
          console.error(`[SMB] Reconnection or re-read failed: ${reconnectErr.message}`);
        }
      }

      // If reading as text fails, try as binary
      if (err.message.includes('Invalid UTF-8') || err.message.includes('not valid')) {
        console.log(`[SMB] Reading binary file: "${filePath}"`);
        try {
          const binaryContent = await getState().smbClientMain.readFile(filePath);
          console.log(`[SMB] Successfully read file as binary: "${filePath}" (${binaryContent.length} bytes)`);
          return binaryContent;
        } catch (binaryErr) {
          console.error(`[SMB] Error reading file as binary: ${binaryErr.message}`);
          throw new Error(`Failed to read file: ${binaryErr.message}`);
        }
      }

      // If we got here, rethrow the original error
      throw err;
    }
  });
  ipcMain.handle('smb-write-file', async (_e, params) => {
    if (!getState().smbClientMain) throw new Error('Not connected to SMB');

    // Handle both object parameter styles for maximum compatibility
    const filePath = params.filePath || params.path;
    const data = params.data;

    if (!filePath) {
      throw new Error('Missing file path parameter');
    }

    if (data === undefined || data === null) {
      throw new Error('Missing data parameter');
    }

    if (typeof data === 'string') {
      // For text data, use utf8 encoding
      await getState().smbClientMain.writeFile(filePath, data, 'utf8');
    } else if (Buffer.isBuffer(data)) {
      // For binary data (Buffer), don't specify encoding
      await getState().smbClientMain.writeFile(filePath, data);
    } else {
      console.error('Invalid data type:', typeof data, data);
      throw new Error('Data must be a string or Buffer');
    }

    return true;
  });
  ipcMain.handle('smb-unlink', async (_e, filePath) => {
    if (!getState().smbClientMain) throw new Error('Not connected to SMB');
    await getState().smbClientMain.unlink(filePath);
    return true;
  });
}

module.exports = { register };
