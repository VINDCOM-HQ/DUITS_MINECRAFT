// src/renderer/domElements.js
// ───────────────────────────────────────────────────────────────────────────────
// All your document.getElementById / querySelector calls
export const hostEl        = document.getElementById('host');
export const portEl        = document.getElementById('port');
export const passEl        = document.getElementById('password');
export const logEl         = document.getElementById('logpath');
export const startLogBtn   = document.getElementById('startLogBtn');
export const connectBtn    = document.getElementById('connectBtn');
export const reconnectBtn  = document.getElementById('reconnectBtn');
export const disconnectBtn = document.getElementById('disconnectBtn');
export const statusSp      = document.getElementById('status');
export const serverStatusInd = document.getElementById('server-status-indicator');
// SMB status text element (connected/disconnected)
export const smbStatusSp = document.getElementById('smb-status');
// (Optional) SMB status indicator element if present
export const smbStatusInd  = document.getElementById('smb-status-indicator');
// MySQL status text and (optional) indicator in the MySQL panel
export const mysqlStatusSp   = document.getElementById('mysql-status');
export const mysqlStatusInd  = document.getElementById('mysql-status-indicator') || null;
export const queryPortEl   = document.getElementById('query-port');
export const queryModeEl   = document.getElementById('query-mode');
export const queryBtn      = document.getElementById('queryBtn');
export const queryOut      = document.getElementById('query-output');
export const cmdEl         = document.getElementById('command');
export const toggleBtn     = document.getElementById('toggleCmdListBtn');
export const acEl          = document.getElementById('autocomplete');
export const sendBtn       = document.getElementById('sendBtn');
export const outPr         = document.getElementById('output');
export const playerSection = document.getElementById('player-management');
export const playerSelect  = document.getElementById('player-select');
export const refreshPlayersBtn = document.getElementById('refresh-players');
export const playerCountSpan   = document.getElementById('player-count');
export const playerStatsEl     = document.getElementById('player-stats');
export const refreshStatsBtn   = document.getElementById('refresh-stats-btn');
// Manual ban list refresh button
export const refreshBannedBtn  = document.getElementById('refresh-banned-btn');
export const bannedCountSpan   = document.getElementById('banned-count');
export const bannedListEl      = document.getElementById('banned-list');
// Manual banned-IPs list refresh button
export const refreshBannedIPsBtn = document.getElementById('refresh-banned-ips-btn');
export const bannedIPsCountSpan = document.getElementById('banned-ips-count');
export const bannedIPsListEl    = document.getElementById('banned-ips-list');
export const actionButtons    = Array.from(document.querySelectorAll('.action-btn'));
export const toastContainer   = document.getElementById('toast-container');

// Sub-tabs
export const tabConsoleBtn   = document.getElementById('tab-console');
export const tabPlayersBtn   = document.getElementById('tab-players');
export const tabServerFunctionsBtn = document.getElementById('tab-server-functions');
export const consoleSection  = document.getElementById('console-section');
export const serverFunctionsSection = document.getElementById('server-functions');
export const bannedSection   = document.getElementById('banned-section');
export const bannedIpsSection = document.getElementById('banned-ips-section');

// Primary tabs
export const tabConnectionBtn = document.getElementById('tab-connection');
export const tabActionsBtn    = document.getElementById('tab-actions');
export const tabStorageBtn    = document.getElementById('tab-storage');
export const tabMysqlBtn      = document.getElementById('tab-mysql');
export const tabSettingsBtn   = document.getElementById('tab-settings');
export const connectionSection = document.getElementById('connection-section');
export const actionsSection    = document.getElementById('actions-section');
export const actionsWarning    = document.getElementById('actions-warning');
export const storageSection    = document.getElementById('storage-section');
export const mysqlSection      = document.getElementById('mysql-section');
export const settingsSection   = document.getElementById('settings-section');

// Modals (we also reference these in modals.js)
export const pwdModal    = document.getElementById('password-modal');
export const confirmModal = document.getElementById('confirm-modal');

// Server list management
export const serverSelectEl = document.getElementById('server-list');
export const addServerBtn   = document.getElementById('add-server-btn');
export const editServerBtn  = document.getElementById('edit-server-btn');
export const removeServerBtn= document.getElementById('remove-server-btn');

// SMB storage
export const smbHostEl      = document.getElementById('smb-host');
export const smbShareEl     = document.getElementById('smb-share');
export const smbUserEl      = document.getElementById('smb-username');
export const smbPassEl      = document.getElementById('smb-password');
export const smbConnectBtn  = document.getElementById('smb-connect-btn');
export const smbDisconnectBtn = document.getElementById('smb-disconnect-btn');
export const smbBrowser     = document.getElementById('smb-browser');
export const smbBackBtn     = document.getElementById('smb-back-btn');
export const smbCurrentPathSp = document.getElementById('smb-current-path');
export const smbRefreshBtn    = document.getElementById('smb-refresh-btn');
export const smbListEl        = document.getElementById('smb-list');
export const smbUploadInput   = document.getElementById('smb-upload-input');
export const smbUploadBtn     = document.getElementById('smb-upload-btn');
export const smbEditorContainer = document.getElementById('smb-editor-container');
export const smbEditingFileSp  = document.getElementById('smb-editing-file');
export const smbEditorEl       = document.getElementById('smb-editor');
export const smbSaveBtn        = document.getElementById('smb-save-btn');
export const smbCloseEditorBtn = document.getElementById('smb-close-editor-btn');
export const smbFormatWarningEl= document.getElementById('smb-format-warning');
export const smbShareListEl    = document.getElementById('smb-share-list');
export const addSmbShareBtn    = document.getElementById('smb-add-share-btn');
export const editSmbShareBtn   = document.getElementById('smb-edit-share-btn');
export const removeSmbShareBtn = document.getElementById('smb-remove-share-btn');
export const smbFindBar        = document.getElementById('smb-find-bar');
export const smbFindInput      = document.getElementById('smb-find-input');
export const smbFindPrevBtn    = document.getElementById('smb-find-prev');
export const smbFindNextBtn    = document.getElementById('smb-find-next');
// Find bar close button
export const smbFindCloseBtn   = document.getElementById('smb-find-close');
export const smbSettingsHeader = document.getElementById('smb-settings-header');
export const smbSettingsPanel  = document.getElementById('smb-settings-panel');
export const smbToggleIcon     = document.getElementById('smb-toggle-icon');
// MySQL settings panel toggle elements
export const mysqlSettingsHeader = document.getElementById('mysql-settings-header');
export const mysqlSettingsPanel  = document.getElementById('mysql-settings-panel');
export const mysqlToggleIcon     = document.getElementById('mysql-toggle-icon');

// MySQL
export const mysqlListEl       = document.getElementById('mysql-list');
export const mysqlAddBtn       = document.getElementById('mysql-add-btn');
export const mysqlEditBtn      = document.getElementById('mysql-edit-btn');
export const mysqlRemoveBtn    = document.getElementById('mysql-remove-btn');
export const mysqlHostEl       = document.getElementById('mysql-host');
export const mysqlPortEl       = document.getElementById('mysql-port');
export const mysqlUserEl       = document.getElementById('mysql-user');
export const mysqlPasswordEl   = document.getElementById('mysql-password');
export const mysqlDatabaseEl   = document.getElementById('mysql-database');
export const mysqlSslEl        = document.getElementById('mysql-ssl');
export const mysqlSslOptionsEl = document.getElementById('mysql-ssl-options');
export const mysqlCustomCaEl   = document.getElementById('mysql-custom-ca');
export const mysqlCaSettingsEl = document.getElementById('mysql-ca-settings');
export const mysqlCaPathEl     = document.getElementById('mysql-ca-path');
export const mysqlCaBrowseBtn  = document.getElementById('mysql-ca-browse-btn');
export const mysqlConnectBtn   = document.getElementById('mysql-connect-btn');
export const mysqlDisconnectBtn= document.getElementById('mysql-disconnect-btn');
export const mysqlQueryEl      = document.getElementById('mysql-query');
export const mysqlRunBtn       = document.getElementById('mysql-run-btn');
export const mysqlResultsEl    = document.getElementById('mysql-results');
// Encryption Mode UI elements
export const encDefaultRadio      = document.getElementById('enc-default');
export const encCustomRadio       = document.getElementById('enc-custom');
export const customPasswordContainer = document.getElementById('custom-password-container');
export const customPasswordInput  = document.getElementById('custom-password');

// Agent settings
export const agentEnabledEl      = document.getElementById('agent-enabled');
export const agentSettingsContainer = document.getElementById('agent-settings-container');
export const agentUrlEl          = document.getElementById('agent-url');
export const agentUseSslEl       = document.getElementById('agent-use-ssl');
export const agentSslOptionsEl   = document.getElementById('agent-ssl-options');
export const agentCustomCaEl     = document.getElementById('agent-custom-ca');
export const agentCaContainerEl  = document.getElementById('agent-ca-container');
export const agentCaFileEl       = document.getElementById('agent-ca-file');
export const agentCaFileBtnEl    = document.getElementById('agent-ca-file-btn');
export const agentApiKeyEl       = document.getElementById('agent-api-key');
// Agent status display elements (in sidebar)
export const agentStatusContainer = document.getElementById('agent-status-container');
export const agentStatusIndicator = document.getElementById('agent-status-indicator');
export const agentStatusText      = document.getElementById('agent-status');
// Settings panel save button
export const settingsSaveBtn     = document.getElementById('settings-save-btn');
// Sidebar storage status elements
export const smbStatusSidebar     = document.getElementById('smb-status-sidebar');
export const smbStatusIndSidebar  = document.getElementById('smb-status-indicator-sidebar');
// Sidebar database status elements
export const mysqlStatusSidebar   = document.getElementById('mysql-status-sidebar');
export const mysqlStatusIndSidebar= document.getElementById('mysql-status-indicator-sidebar');
