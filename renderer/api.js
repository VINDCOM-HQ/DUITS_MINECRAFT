// src/renderer/api.js
// ───────────────────────────────────────────────────────────────────────────────
// All IPC/WebSocket API bindings via preload, plus config API
export const {
    openLogDialog = async () => null,
    selectLogFile = async () => null,
    startLogTail = async () => false,
    queryStatus = async () => ({}),
    openCaFileDialog = async () => null,
    openFileDialog = async () => [],
    saveFileDialog = async () => null,
    onLogLine = () => {},
    appendToLog = async () => false,
    readFile = async () => null,
    writeFile = async () => false,
    smbConnect = async () => false,
    smbDisconnect = async () => false,
    smbReaddir = async () => [],
    smbStat = async () => ({ isDirectory: false }),
    smbReadFile = async () => '',
    smbWriteFile = async () => false,
    smbUnlink = async () => false,
    validateYaml = async () => false,
    rconConnect = async () => false,
    rconCommand = async () => '',
    rconDisconnect = async () => false,
    mysqlConnect = async () => false,
    mysqlDisconnect = async () => false,
    mysqlQuery = async () => '',
    getAgentSettings = async () => ({ enabled: false, url: '', apiKey: '', caFile: '' }),
    setAgentSettings = async () => false,
    agentReconnect = async () => ({ success: false, reason: 'Not implemented' }),
    ensureSmbConnection = async () => ({ success: false, reason: 'Not implemented', usingAgent: false })
  } = window.electronAPI || {};
  
  export const {
    loadRawConfigMode = async () => 'default',
    loadConfig = async () => ({ servers: [], smbShares: [], mysqls: [] }),
    saveConfig = async () => null,
    setEncryptionMode = async () => null,
    setCustomPassword = async () => null,
    getEncryptionMode = async () => 'default'
  } = window.config || {};
  