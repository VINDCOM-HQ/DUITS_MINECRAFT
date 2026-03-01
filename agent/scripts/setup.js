#!/usr/bin/env node
/**
 * DUITS Minecraft RMM Agent Setup Script
 * 
 * Interactive setup script to configure the agent
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const agentDir = path.resolve(__dirname, '..');
const envPath = path.join(agentDir, '.env');
const examplePath = path.join(agentDir, '.env.example');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Generate a random API key
function generateApiKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// Main setup function
async function setupAgent() {
  console.log('=== DUITS Minecraft RMM Agent Setup ===');
  
  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    const answer = await new Promise(resolve => {
      rl.question('.env file already exists. Overwrite? (y/N): ', resolve);
    });
    
    if (answer.toLowerCase() !== 'y') {
      console.log('Setup canceled. Existing .env file was kept.');
      rl.close();
      return;
    }
  }
  
  // Start with example file content
  let envContent;
  try {
    envContent = fs.readFileSync(examplePath, 'utf8');
  } catch (err) {
    console.error(`Error reading .env.example file: ${err.message}`);
    rl.close();
    return;
  }
  
  // Ask for port
  const port = await new Promise(resolve => {
    rl.question('Enter port number [3500]: ', answer => {
      return resolve(answer || '3500');
    });
  });
  
  // Ask whether to generate a random API key
  const randomKey = await new Promise(resolve => {
    rl.question('Generate random API key? (Y/n): ', answer => {
      return resolve(answer.toLowerCase() !== 'n');
    });
  });
  
  let apiKey;
  if (randomKey) {
    apiKey = generateApiKey();
    console.log(`Generated API key: ${apiKey}`);
  } else {
    apiKey = await new Promise(resolve => {
      rl.question('Enter API key: ', resolve);
    });
  }
  
  // Ask about TLS
  const enableTls = await new Promise(resolve => {
    rl.question('Enable TLS/HTTPS? (y/N): ', answer => {
      return resolve(answer.toLowerCase() === 'y');
    });
  });
  
  // Update .env content
  envContent = envContent.replace(/AGENT_PORT=\d+/, `AGENT_PORT=${port}`);
  envContent = envContent.replace(/AGENT_API_KEY=.*/, `AGENT_API_KEY=${apiKey}`);
  envContent = envContent.replace(/AGENT_ENABLE_TLS=.*/, `AGENT_ENABLE_TLS=${enableTls}`);
  
  // If TLS is enabled, ask for certificate and key paths
  if (enableTls) {
    const certPath = await new Promise(resolve => {
      rl.question('Path to TLS certificate: ', resolve);
    });
    
    const keyPath = await new Promise(resolve => {
      rl.question('Path to TLS key: ', resolve);
    });
    
    const passphrase = await new Promise(resolve => {
      rl.question('TLS key passphrase (leave empty if none): ', resolve);
    });
    
    envContent = envContent.replace(/AGENT_TLS_CERT=.*/, `AGENT_TLS_CERT=${certPath}`);
    envContent = envContent.replace(/AGENT_TLS_KEY=.*/, `AGENT_TLS_KEY=${keyPath}`);
    
    if (passphrase) {
      envContent = envContent.replace(/AGENT_TLS_PASSPHRASE=.*/, `AGENT_TLS_PASSPHRASE=${passphrase}`);
    }
  }
  
  // Write the .env file
  try {
    fs.writeFileSync(envPath, envContent);
    console.log(`\nConfiguration saved to ${envPath}`);
    console.log('\nTo start the agent:');
    console.log('  npm start');
    console.log('\nTo install as a service:');
    console.log('  npm run service:install');
  } catch (err) {
    console.error(`Error writing .env file: ${err.message}`);
  }
  
  rl.close();
}

// Run setup
setupAgent().catch(err => {
  console.error('Setup error:', err);
  rl.close();
});