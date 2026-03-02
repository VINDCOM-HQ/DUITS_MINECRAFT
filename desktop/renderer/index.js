// src/renderer/index.js

// Core setup
import initErrorHandlers from './errorHandlers.js';
// Fix import path to match actual filename (lowercase 'w')
import initWebSocket from './initwebSocket.js';
import initModals from './modals.js';
import initConfigLoader from './configLoader.js';
import initUiTabs from './uiTabs.js';
import initServerManagement from './serverManagement.js';

// Feature modules
import initRconClient      from './rconClient.js';
import initQuery           from './query.js';
import initRefreshers      from './refreshers.js';
import initServerFunctions from './serverFunctions.js';
import initSmb             from './smb.js';
import initMysql           from './mysql.js';
import initAgentSettings   from './agent.js';
import initEncryptionSettings from './settings.js';

// Wait for DOM, then bootstrap all modules in sequence
window.addEventListener('DOMContentLoaded', async () => {
  // initialize global error handlers, modals, config, and socket recovery
  initErrorHandlers();
  initWebSocket();
  initModals();
  // Load and decrypt config before initializing UI modules
  await initConfigLoader();
  initEncryptionSettings();

  // set up tab navigation and server‐list UI
  initUiTabs();
  initServerManagement();

  // wire up each feature area
  initRconClient();
  initQuery();
  initRefreshers();
  initServerFunctions();
  initSmb();
  initMysql();
  initAgentSettings();
});
