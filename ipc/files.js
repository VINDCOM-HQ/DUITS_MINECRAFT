const fs = require('fs');
const path = require('path');
const os = require('os');
const { app, dialog } = require('electron');

function register(ipcMain, getState) {
  // getState() returns { mainWindow, Tail, logTailer, setLogTailer }

  ipcMain.handle('start-log-tail', (_e, logPath) => {
    if (!logPath) return false;
    const { mainWindow, Tail, logTailer, setLogTailer } = getState();
    // Ensure tail module loaded
    if (!Tail) {
      mainWindow.webContents.send('log-line', '[TAIL FAIL] log tail module not available');
      return false;
    }
    const resolved = path.resolve(logPath);
    // Stop any previous tailer
    if (logTailer) {
      try { logTailer.unwatch(); } catch (_) {}
      setLogTailer(null);
    }
    try {
      const newTailer = new Tail(resolved, { follow: true, fromBeginning: false, useWatchFile: true });
      newTailer.on('line', line => getState().mainWindow.webContents.send('log-line', line));
      newTailer.on('error', err => getState().mainWindow.webContents.send('log-line', `[TAIL ERROR] ${err.message}`));
      setLogTailer(newTailer);
      return true;
    } catch (err) {
      mainWindow.webContents.send('log-line', `[TAIL FAIL] ${err.message}`);
      return false;
    }
  });

  // Folder picker for logs
  ipcMain.handle('open-log-dialog', async () => {
    const { mainWindow } = getState();
    // Debug: log invocation
    if (!app.isPackaged) console.log('ipcMain: open-log-dialog invoked');
    const options = { title: 'Select log directory', properties: ['openDirectory', 'createDirectory'] };
    if (!app.isPackaged) console.log('ipcMain: showOpenDialog options:', options);
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, options);
      if (!app.isPackaged) console.log('ipcMain: open-log-dialog result canceled=%s, filePaths=%o', canceled, filePaths);
      if (canceled || filePaths.length === 0) return null;
      return filePaths[0];
    } catch (err) {
      console.error('ipcMain: open-log-dialog error:', err);
      // Propagate as an explicit error to renderer (user cancel still returns null)
      throw new Error(`Failed to open log directory: ${err.message}`);
    }
  });

  // Combined select log directory and prepare file (create directory + latest.log)
  ipcMain.handle('select-log-file', async () => {
    const { mainWindow } = getState();
    if (!app.isPackaged) console.log('ipcMain: select-log-file invoked');
    const options = { title: 'Select log directory', properties: ['openDirectory', 'createDirectory'] };
    if (!app.isPackaged) console.log('ipcMain: showOpenDialog options (select-log-file):', options);
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, options);
      if (!app.isPackaged) console.log('ipcMain: select-log-file result canceled=%s, filePaths=%o', canceled, filePaths);
      if (canceled || filePaths.length === 0) return null;
      const dir = filePaths[0];
      const filePath = path.join(dir, 'latest.log');
      // Ensure directory exists
      fs.mkdirSync(dir, { recursive: true });
      // Remove existing log file if present to start fresh
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.warn('select-log-file: failed to remove existing log file:', err.message);
      }
      // Create new empty log file
      try {
        fs.writeFileSync(filePath, '');
      } catch (err) {
        console.error('select-log-file: failed to create log file:', err);
        throw err;
      }
      return filePath;
    } catch (err) {
      console.error('ipcMain: select-log-file error:', err);
      // Wrap and sanitize any errors during log file selection/creation
      throw new Error(`Failed to select log file: ${err.message}`);
    }
  });

  // Save file dialog for downloads - works on all platforms (Windows, macOS, Linux, etc.)
  ipcMain.handle('save-file-dialog', async (_e, defaultFilename = '') => {
    const { mainWindow } = getState();
    if (!app.isPackaged) console.log('ipcMain: save-file-dialog invoked for:', defaultFilename);

    // Get file extension for filter suggestion
    let extension = '';
    if (defaultFilename && defaultFilename.includes('.')) {
      extension = defaultFilename.split('.').pop().toLowerCase();
    }

    // Build filters based on extension
    let filters = [{ name: 'All Files', extensions: ['*'] }];

    // Add specific filter based on file type if we recognize it
    if (extension) {
      if (['txt', 'log', 'properties', 'yml', 'yaml', 'json', 'xml', 'conf', 'config'].includes(extension)) {
        filters.unshift({ name: 'Text Files', extensions: [extension] });
      } else if (['jar', 'zip'].includes(extension)) {
        filters.unshift({ name: 'Java Archives', extensions: [extension] });
      } else if (['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(extension)) {
        filters.unshift({ name: 'Image Files', extensions: [extension] });
      } else {
        // For any other extension, add a specific filter for it
        filters.unshift({ name: `${extension.toUpperCase()} Files`, extensions: [extension] });
      }
    }

    const options = {
      title: 'Save File',
      defaultPath: path.join(os.homedir(), defaultFilename || 'download'),
      properties: ['createDirectory', 'showOverwriteConfirmation'],
      filters: filters
    };

    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, options);
      if (canceled || !filePath) return null;
      return filePath;
    } catch (err) {
      console.error('ipcMain: save-file-dialog error:', err);
      throw new Error(`Failed to open save dialog: ${err.message}`);
    }
  });

  // File dialog to select a custom Root CA file for MySQL SSL
  ipcMain.handle('open-ca-file-dialog', async () => {
    const { mainWindow } = getState();
    // Debug: log invocation
    if (!app.isPackaged) console.log('ipcMain: open-ca-file-dialog invoked');
    const options = {
      title: 'Select Root CA File',
      properties: ['openFile'],
      filters: [
        { name: 'Certificates', extensions: ['pem', 'crt', 'cer', 'der'] },
        { name: 'PKCS#12 Bundles', extensions: ['pfx', 'p12'] }
      ]
    };
    if (!app.isPackaged) console.log('ipcMain: showOpenDialog options:', options);
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, options);
      if (!app.isPackaged) console.log('ipcMain: open-ca-file-dialog result canceled=%s, filePaths=%o', canceled, filePaths);
      if (canceled || filePaths.length === 0) return null;
      return filePaths[0];
    } catch (err) {
      console.error('ipcMain: open-ca-file-dialog error:', err);
      // Propagate as explicit error; user cancel returns null above
      throw new Error(`Failed to open CA file dialog: ${err.message}`);
    }
  });

  // File dialog to select one or more files for upload
  ipcMain.handle('open-file-dialog', async () => {
    const { mainWindow } = getState();
    const options = {
      title: 'Select file(s) to upload',
      properties: ['openFile', 'multiSelections']
    };
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, options);
      if (canceled) return [];
      return filePaths;
    } catch (err) {
      console.error('ipcMain: open-file-dialog error:', err);
      // Propagate as explicit error; user cancel still yields empty array
      throw new Error(`Failed to open file dialog: ${err.message}`);
    }
  });

  ipcMain.handle('append-log', async (_e, filePath, data) => {
    try {
      await fs.promises.appendFile(filePath, data);
      return true;
    } catch (err) {
      console.error('ipcMain: append-log error:', err);
      // Wrap and sanitize append errors
      throw new Error(`Failed to append to log file: ${err.message}`);
    }
  });

  // Read file (used by renderer for uploads and CA file reading)
  ipcMain.handle('fs-read-file', async (_e, filePath) => {
    try {
      const data = await fs.promises.readFile(filePath);
      return data;
    } catch (err) {
      console.error('ipcMain: fs-read-file error:', err);
      // Wrap and sanitize read errors
      throw new Error(`Failed to read file: ${err.message}`);
    }
  });

  // Write file (used by renderer for downloads)
  ipcMain.handle('fs-write-file', async (_e, filePath, data) => {
    try {
      await fs.promises.writeFile(filePath, data);
      return true;
    } catch (err) {
      console.error('ipcMain: fs-write-file error:', err);
      // Wrap and sanitize write errors
      throw new Error(`Failed to write file: ${err.message}`);
    }
  });
}

module.exports = { register };
