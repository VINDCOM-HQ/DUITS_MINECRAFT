/**
 * YAML Validation IPC handler
 */
function register(ipcMain) {
  try {
    const jsYaml = require('js-yaml');
    ipcMain.handle('validate-yaml', (_e, content) => {
      try {
        jsYaml.load(content);
        return true;
      } catch (_err) {
        return false;
      }
    });
  } catch (err) {
    console.error('main: js-yaml not available for YAML validation:', err);
  }
}

module.exports = { register };
