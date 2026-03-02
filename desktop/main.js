const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const configModule = require('./lib/config');

// IPC modules
const ipcRcon = require('./ipc/rcon');
const ipcQuery = require('./ipc/query');
const ipcFiles = require('./ipc/files');
const ipcConfig = require('./ipc/config');
const ipcSmb = require('./ipc/smb');
const ipcMysql = require('./ipc/mysql');
const ipcAgent = require('./ipc/agent');
const ipcYaml = require('./ipc/yaml');

// Embedded Agent Server
let embeddedAgentServer = null;
let embeddedAgentShutdown = null;

/**
 * Start the embedded agent server
 * This runs the agent server in-process so users don't need to start it separately
 */
async function startEmbeddedAgentServer() {
  try {
    console.log('[EMBEDDED-AGENT] Starting embedded agent server...');

    // Set default environment variables for the agent if not already set
    if (!process.env.AGENT_PORT) {
      process.env.AGENT_PORT = '3500';
    }
    if (!process.env.AGENT_ALLOW_CORS) {
      process.env.AGENT_ALLOW_CORS = 'true';
    }

    // Check if user already has an API key saved - use that for consistency
    const existingSettings = configModule.getAgentSettings();
    if (existingSettings.apiKey && existingSettings.apiKey !== '') {
      process.env.AGENT_API_KEY = existingSettings.apiKey;
      console.log('[EMBEDDED-AGENT] Using existing API key from saved config');
    } else if (!process.env.AGENT_API_KEY) {
      const crypto = require('crypto');
      process.env.AGENT_API_KEY = crypto.randomBytes(32).toString('hex');
      console.log('[EMBEDDED-AGENT] Generated new API key for embedded agent');
    }

    // Load the agent server module
    // In dev, agent/ is at the repo root (sibling of desktop/).
    // When packaged, electron-builder copies it into the asar at agent/.
    const agentPath = app.isPackaged
      ? path.join(__dirname, 'agent', 'src', 'server.js')
      : path.join(__dirname, '..', 'agent', 'src', 'server.js');

    if (!fs.existsSync(agentPath)) {
      console.error('[EMBEDDED-AGENT] Agent server not found at:', agentPath);
      return false;
    }

    const { startServer, shutdown } = require(agentPath);

    // Start the server
    embeddedAgentServer = await startServer();
    embeddedAgentShutdown = shutdown;

    // Ensure agent settings are configured for embedded mode
    if (!existingSettings.apiKey || existingSettings.apiKey === '') {
      configModule.setAgentSettings({
        enabled: true,
        url: `http://localhost:${process.env.AGENT_PORT}`,
        apiKey: process.env.AGENT_API_KEY,
        caFile: ''
      });
      console.log('[EMBEDDED-AGENT] Auto-configured agent settings for embedded mode');
    }

    console.log(`[EMBEDDED-AGENT] Agent server started successfully on port ${process.env.AGENT_PORT}`);
    return true;
  } catch (err) {
    console.error('[EMBEDDED-AGENT] Failed to start embedded agent server:', err);
    return false;
  }
}

/**
 * Stop the embedded agent server
 */
async function stopEmbeddedAgentServer() {
  if (embeddedAgentShutdown) {
    try {
      console.log('[EMBEDDED-AGENT] Stopping embedded agent server...');
      await embeddedAgentShutdown();
      console.log('[EMBEDDED-AGENT] Agent server stopped successfully');
    } catch (err) {
      console.error('[EMBEDDED-AGENT] Error stopping agent server:', err);
    }
  }

  if (embeddedAgentServer) {
    try {
      embeddedAgentServer.close();
    } catch (err) {
      // Ignore errors when closing
    }
    embeddedAgentServer = null;
  }
  embeddedAgentShutdown = null;
}

// Use native JS tailing for cross-platform log streaming (fallback if module missing)
let Tail;
try {
  const tailMod = require('tail');
  Tail = tailMod.Tail || tailMod.default || tailMod;
} catch (err) {
  console.warn('tail module load failed; log tail disabled:', err.message);
  Tail = null;
}

// MySQL per-window clients
const mysqlClients = new Map();

// Global exception handlers to prevent crashes and surface errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  dialog.showErrorBox('An unexpected error occurred', err.stack || err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  dialog.showErrorBox('Unhandled Promise Rejection', reason instanceof Error ? reason.message : String(reason));
});

// Ensure correct app model for Win taskbar icon
app.setAppUserModelId('com.vindcom.netherdeck');

// Shared mutable state — accessed by IPC modules via getState()
let mainWindow;
let rconClient = null;
let logTailer = null;
let smbClientMain = null;

/**
 * Shared state accessor for IPC modules.
 * All mutable state is accessed through this function.
 */
function getState() {
  return {
    mainWindow,
    rconClient,
    setRconClient(v) { rconClient = v; },
    logTailer,
    setLogTailer(v) { logTailer = v; },
    Tail,
    smbClientMain,
    setSmbClientMain(v) { smbClientMain = v; },
    mysqlClients
  };
}

// Register all IPC handlers
ipcRcon.register(ipcMain, getState);
ipcQuery.register(ipcMain);
ipcFiles.register(ipcMain, getState);
ipcConfig.register(ipcMain, getState);
ipcSmb.register(ipcMain, getState);
ipcMysql.register(ipcMain, getState);
ipcAgent.register(ipcMain);
ipcYaml.register(ipcMain);

function createWindow() {
  // In dev, auto-build Tailwind CSS if missing or outdated
  Menu.setApplicationMenu(null);
  // Skip auto-building Tailwind CSS in development mode on WSL as it causes issues
  if (!app.isPackaged && process.platform !== 'linux') {
    console.log('Development mode: checking Tailwind CSS...');
    if (!fs.existsSync(path.join(__dirname, 'tailwind.css'))) {
      console.log('Tailwind CSS file not found, building...');
      const isWin = process.platform === 'win32';
      const npmCmd = isWin ? 'npm.cmd' : 'npm';
      try {
        console.log('Running build:css command...');
        const result = spawnSync(npmCmd, ['run', 'build:css'], { cwd: __dirname, stdio: 'inherit' });
        if (result.error) {
          console.error('Error building Tailwind CSS:', result.error);
        } else if (result.status !== 0) {
          console.error(`Tailwind CSS build exited with code ${result.status}`);
        }
      } catch (err) {
        console.error('Failed to run build:css script:', err);
      }
    } else {
      console.log('Tailwind CSS file already exists, skipping build');
    }
  }
  // Debug: verify preload script path and existence
  if (!app.isPackaged) {
    const preloadPath = path.join(__dirname, 'preload.js');
    const preloadDirPath = path.join(__dirname, 'preload');
    console.log('createWindow: __dirname =', __dirname);
    console.log('createWindow: preloadPath =', preloadPath, 'exists?', fs.existsSync(preloadPath));
    console.log('createWindow: preloadDirPath =', preloadDirPath, 'exists?', fs.existsSync(preloadDirPath));
    if (fs.existsSync(preloadDirPath)) {
      console.log('Files in preload directory:');
      fs.readdirSync(preloadDirPath).forEach(file => {
        console.log(' - ' + file);
      });
    }
  }

  mainWindow = new BrowserWindow({
    width: 700,
    height: 900,
    useContentSize: true,
    resizable: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      webSecurity: true,
      webviewTag: false,
      additionalArguments: ['--enable-websocket-bridge', '--allow-insecure-localhost']
    }
  });

  // Set Content Security Policy specifically for WebSockets
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = [
      "default-src 'self'",
      "connect-src 'self' ws: wss: ws://* wss://* http://* https://*",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'"
    ].join('; ');

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    });
  });

  // Load the regular HTML file
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // In development mode, open DevTools and log to console
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    console.log('App is in development mode: opened DevTools');
  }
}

app.whenReady().then(async () => {
  // Start the embedded agent server first
  await startEmbeddedAgentServer();

  // Then create the window
  createWindow();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Cleanup resources on app exit
app.on('will-quit', async (e) => {
  console.log('App is quitting, cleaning up resources...');

  // Prevent immediate quit to allow cleanup
  e.preventDefault();

  try {
    // Stop embedded agent server
    await stopEmbeddedAgentServer();

    // Cleanup SMB connections
    if (smbClientMain) {
      console.log('Closing SMB connection...');
      try {
        await smbClientMain.close();
        console.log('SMB connection closed successfully');
      } catch (err) {
        console.error('Error closing SMB connection:', err.message);
      }
      smbClientMain = null;
    }

    // Cleanup RCON connections
    if (rconClient) {
      console.log('Closing RCON connection...');
      try {
        rconClient.disconnect();
        console.log('RCON connection closed successfully');
      } catch (err) {
        console.error('Error closing RCON connection:', err.message);
      }
      rconClient = null;
    }

    // Cleanup MySQL connections
    if (mysqlClients.size > 0) {
      console.log(`Closing ${mysqlClients.size} MySQL connections...`);
      for (const [id, client] of mysqlClients.entries()) {
        try {
          await client.close();
          console.log(`MySQL connection ${id} closed successfully`);
        } catch (err) {
          console.error(`Error closing MySQL connection ${id}:`, err.message);
        }
      }
      mysqlClients.clear();
    }

    // Cleanup log tailer
    if (logTailer) {
      console.log('Stopping log tailer...');
      try {
        logTailer.unwatch();
        console.log('Log tailer stopped successfully');
      } catch (err) {
        console.error('Error stopping log tailer:', err.message);
      }
      logTailer = null;
    }

    console.log('All resources cleaned up, quitting application');
  } catch (err) {
    console.error('Error during cleanup:', err);
  }

  // Actually quit the app after cleanup
  app.quit();
});
