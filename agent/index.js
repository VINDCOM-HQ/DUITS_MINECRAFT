#!/usr/bin/env node
/**
 * VINDCOM NetherDeck Agent
 *
 * Exposes both HTTP(S) endpoints and Socket.IO interface to proxy RCON and Query calls (and more) via a single port.
 * Secured by API key (environment variable AGENT_API_KEY or config file).
 * 
 * This file is kept for backward compatibility.
 * The actual implementation has been moved to the 'src' directory.
 */

// Ensure dotenv is loaded at the entry point
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Try to load .env file explicitly
try {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (result.error) {
      console.error(`[ROOT] Error loading .env file: ${result.error.message}`);
    } else {
      console.log(`[ROOT] Loaded environment variables from ${envPath}`);
      
      // Log some config values to verify they're loaded
      console.log(`[ROOT] AGENT_API_KEY ${process.env.AGENT_API_KEY ? 'is set' : 'is not set'}`);
      console.log(`[ROOT] AGENT_PORT is set to ${process.env.AGENT_PORT || 'default'}`);
      console.log(`[ROOT] AGENT_ALLOW_CORS is set to ${process.env.AGENT_ALLOW_CORS || 'default'}`);
    }
  } else {
    console.warn('[ROOT] No .env file found at', envPath);
  }
} catch (err) {
  console.error(`[ROOT] Error processing .env file: ${err.message}`);
}

// Import the server from the src directory
const { startServer } = require('./src/server');

// Start the server
startServer();