const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Configuration stored as binary: [version:1][mode:1][iv:16][encrypted payload...]
const CONFIG_FILENAME = '.mc-rcon-client-config.bin';
const configPath = path.join(os.homedir(), CONFIG_FILENAME);
// Encryption mode: 'default' uses machine ID, 'custom' uses provided password
let encryptionMode = 'default';
let customPassword = null;

// PBKDF2 parameters
const SALT = 'mc-rcon-client-salt';
const ITERATIONS = 100000;
const KEYLEN = 32;
const DIGEST = 'sha256';
// Config file format version: 1 = AES-CBC, 2 = AES-GCM with auth tag
const VERSION = 2;

// Retrieve a machine-specific ID for encryption key derivation
function getMachineIdSync() {
  const platform = process.platform;
  try {
    if (platform === 'linux') {
      if (fs.existsSync('/etc/machine-id')) {
        return fs.readFileSync('/etc/machine-id', 'utf8').trim();
      }
      if (fs.existsSync('/var/lib/dbus/machine-id')) {
        return fs.readFileSync('/var/lib/dbus/machine-id', 'utf8').trim();
      }
    } else if (platform === 'darwin') {
      const output = execSync(
        'ioreg -rd1 -c IOPlatformExpertDevice | awk \'/IOPlatformUUID/ { print $3; }\'',
        { encoding: 'utf8' }
      );
      return output.replace(/"/g, '').trim();
    } else if (platform === 'win32') {
      // Try reading MachineGuid from registry (no wmic dependency)
      try {
        const reg = execSync(
          'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
          { encoding: 'utf8' }
        );
        const m = reg.match(/MachineGuid\s+REG_\w+\s+([A-Za-z0-9-]+)/i);
        if (m && m[1]) {
          return m[1].trim();
        }
      } catch (_err) {
        // ignore and fallback
      }
      // Fallback to WMIC if available
      try {
        const output = execSync('wmic csproduct get uuid', { encoding: 'utf8' });
        const lines = output.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length >= 2 && lines[0].toLowerCase().includes('uuid')) {
          return lines[1];
        }
        if (lines.length >= 1) {
          return lines[0];
        }
      } catch (_err) {
        // ignore
      }
      // Last resort: hostname
      return os.hostname() || 'unknown';
    }
  } catch (err) {
    console.error('Error retrieving machine id', err);
  }
  return os.hostname() || 'unknown';
}

// Derive a 256-bit key based on current encryption mode
function getKey() {
  let secret;
  if (encryptionMode === 'custom') {
    secret = customPassword || '';
  } else {
    secret = getMachineIdSync();
  }
  return crypto.pbkdf2Sync(secret, SALT, ITERATIONS, KEYLEN, DIGEST);
}

// Load and decrypt the configuration, or initialize a default
// Read raw config file mode (unencrypted metadata)
// Read encryption mode from config binary header, or default if not yet configured
function loadRawConfigMode() {
  try {
    if (!fs.existsSync(configPath)) return 'default';
    // Read first two bytes: version, mode
    const fd = fs.openSync(configPath, 'r');
    const buf = Buffer.alloc(2);
    fs.readSync(fd, buf, 0, 2, 0);
    fs.closeSync(fd);
    const modeByte = buf.readUInt8(1);
    return modeByte === 1 ? 'custom' : 'default';
  } catch (err) {
    console.error('Error reading config mode', err);
    return 'default';
  }
}

// Default configuration structure
const DEFAULT_CONFIG = {
  servers: [],
  smbShares: [],
  mysqls: [],
  agent: { enabled: false, url: '', apiKey: '', caFile: '' }
};
// Load and decrypt the configuration, or initialize defaults
function loadConfig() {
  // If no config file, return defaults
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  // Read binary config: header + encrypted payload
  const content = fs.readFileSync(configPath);
  if (content.length < 18) {
    throw new Error('Invalid config file');
  }
  // Parse header
  const version = content.readUInt8(0);
  const modeByte = content.readUInt8(1);
  // encryptionMode preserved from initial load or user override
  const key = getKey();
  let decrypted;
  try {
    if (version === 1) {
      // AES-CBC: 16-byte IV, rest is encrypted payload
      const iv = content.slice(2, 18);
      const encrypted = content.slice(18);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } else if (version === 2) {
      // AES-GCM: 12-byte IV, 16-byte auth tag, then encrypted payload
      const iv = content.slice(2, 14);
      const tag = content.slice(14, 30);
      const encrypted = content.slice(30);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } else {
      throw new Error('Unsupported config version: ' + version);
    }
  } catch (err) {
    throw new Error('Failed to decrypt configuration: ' + err.message);
  }
  // Parse JSON
  let cfg;
  try {
    cfg = JSON.parse(decrypted.toString('utf8'));
  } catch (err) {
    throw new Error('Failed to parse configuration JSON: ' + err.message);
  }
  // Ensure required keys
  if (!Array.isArray(cfg.servers))   cfg.servers   = [];
  if (!Array.isArray(cfg.smbShares)) cfg.smbShares = [];
  if (!Array.isArray(cfg.mysqls))    cfg.mysqls    = [];
  if (typeof cfg.agent !== 'object' || cfg.agent === null) cfg.agent = { ...DEFAULT_CONFIG.agent };
  return cfg;
}

// Encrypt and save the configuration
// Encrypt and save the configuration
// Encrypt and save the configuration in binary format
function saveConfig(cfg) {
  try {
    const key = getKey();
    // AES-256-GCM encryption with 12-byte IV and 16-byte auth tag
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const plaintext = Buffer.from(JSON.stringify(cfg), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Header: [version:1][mode:1]
    const versionBuf = Buffer.from([VERSION]);
    const modeBuf = Buffer.from([encryptionMode === 'custom' ? 1 : 0]);
    // Layout: version (1) + mode (1) + IV (12) + AuthTag (16) + Encrypted payload
    const outBuf = Buffer.concat([versionBuf, modeBuf, iv, tag, encrypted]);
    // Write config with restrictive permissions (owner read/write)
    fs.writeFileSync(configPath, outBuf, { mode: 0o600 });
    // Log save action for debugging
    try {
      console.log(`[CONFIG] Saved config to ${configPath}, bytes=${outBuf.length}`);
    } catch (_) {}
  } catch (err) {
    console.error('Error saving config:', err);
    throw err;
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  loadRawConfigMode,
  setEncryptionMode: (mode) => { encryptionMode = mode; },
  setCustomPassword: (pw) => { customPassword = pw; },
  getEncryptionMode: () => encryptionMode,
  // Agent configuration getter/setter
  getAgentSettings: () => {
    const cfg = loadConfig();
    return cfg.agent;
  },
  setAgentSettings: (agentCfg) => {
    const cfg = loadConfig();
    cfg.agent = agentCfg;
    saveConfig(cfg);
  },
  configPath
};