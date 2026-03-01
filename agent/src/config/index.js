/**
 * Configuration management for the DUITS Minecraft RMM Agent
 * Loads configuration from environment variables and config file
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// First load environment variables from .env file if it exists
try {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (result.error) {
      console.error(`[CONFIG] Error loading .env file: ${result.error.message}`);
    } else {
      console.log(`[CONFIG] Loaded environment variables from ${envPath}`);
    }
  }
} catch (err) {
  console.error(`[CONFIG] Error processing .env file: ${err.message}`);
}

// Initialize empty config object
let config = {};

/**
 * Load configuration from file and environment variables
 */
function loadConfig() {
  // Load from a JSON config file first if it exists
  const configFile = process.env.AGENT_CONFIG_FILE || path.join(__dirname, '..', '..', 'config.json');
  try {
    if (fs.existsSync(configFile)) {
      const fileConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      config = { ...config, ...fileConfig };
      console.log(`[CONFIG] Loaded configuration from ${configFile}`);
    }
  } catch (err) {
    console.error(`[CONFIG] Failed to load config file: ${err.message}`);
  }
  
  // Then override with environment variables (higher priority)
  config = {
    ...config,
    port: parseInt(process.env.AGENT_PORT, 10) || config.port || 3500,
    apiKey: process.env.AGENT_API_KEY || config.apiKey || '',
    tls: {
      enabled: process.env.AGENT_ENABLE_TLS === '1' || 
               process.env.AGENT_ENABLE_TLS === 'true' || 
               (config.tls && config.tls.enabled) || false,
      cert: process.env.AGENT_TLS_CERT || (config.tls && config.tls.cert) || '',
      key: process.env.AGENT_TLS_KEY || (config.tls && config.tls.key) || '',
      passphrase: process.env.AGENT_TLS_PASSPHRASE || (config.tls && config.tls.passphrase) || '',
    },
    logFormat: process.env.AGENT_LOG_FORMAT || config.logFormat || 'combined',
    allowCors: process.env.AGENT_ALLOW_CORS === '1' || 
               process.env.AGENT_ALLOW_CORS === 'true' || 
               config.allowCors || false
  };

  // Debug output to verify loaded configuration
  console.log(`[CONFIG] Configuration loaded with API Key ${config.apiKey ? 'present' : 'not present'}`);
  console.log(`[CONFIG] Port: ${config.port}, TLS: ${config.tls.enabled ? 'enabled' : 'disabled'}, CORS: ${config.allowCors ? 'enabled' : 'disabled'}`);
  
  return config;
}

/**
 * Get the current configuration
 */
function getConfig() {
  return config;
}

module.exports = {
  loadConfig,
  getConfig
};