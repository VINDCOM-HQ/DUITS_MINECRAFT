#!/usr/bin/env node
/**
 * Service installation script
 * 
 * Detects platform and installs the appropriate service
 * Supports Windows, Linux, macOS
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const platform = os.platform();
const isAdmin = checkAdmin();
const agentDir = path.resolve(__dirname, '..');
const serviceConfig = {
  name: 'VINDCOM-NetherDeck-Agent',
  description: 'VINDCOM NetherDeck Agent Relay Service',
  script: path.join(agentDir, 'index.js')
};

// Verify API key is configured
function checkApiKey() {
  // Check environment variable
  if (process.env.AGENT_API_KEY) {
    return true;
  }
  
  // Check .env file if it exists
  const envPath = path.join(agentDir, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const apiKeyMatch = envContent.match(/AGENT_API_KEY\s*=\s*(.+)/);
      if (apiKeyMatch && apiKeyMatch[1] && apiKeyMatch[1] !== 'your-api-key-here') {
        return true;
      }
    } catch (err) {
      console.error(`Error reading .env file: ${err.message}`);
    }
  }
  
  // Check config file if it exists
  const configPath = path.join(agentDir, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return !!config.apiKey;
    } catch (err) {
      console.error(`Error reading config.json: ${err.message}`);
    }
  }
  
  return false;
}

// Check for admin/root privileges
function checkAdmin() {
  try {
    if (platform === 'win32') {
      // On Windows, try to create a file in a location that requires admin rights
      execSync('net session >nul 2>&1', { shell: true });
      return true;
    } else {
      // On Linux/macOS, check if running as root (uid 0)
      return process.getuid && process.getuid() === 0;
    }
  } catch (err) {
    return false;
  }
}

function installWindowsService() {
  if (!isAdmin) {
    console.error('ERROR: Administrator privileges required. Please run as Administrator.');
    process.exit(1);
  }
  
  try {
    // Create logs directory
    const logsDir = path.join(agentDir, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Dynamically require node-windows
    const { Service } = require('node-windows');
    
    // Prepare environment variables from .env file if it exists
    const env = [
      {
        name: "NODE_ENV",
        value: "production"
      }
    ];
    
    // Add variables from .env file if it exists
    const envPath = path.join(agentDir, '.env');
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envLines = envContent.split('\n');
        
        for (const line of envLines) {
          // Skip comments and empty lines
          if (line.trim().startsWith('#') || !line.trim()) continue;
          
          const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
          if (match) {
            const key = match[1];
            let value = match[2] || '';
            
            // Remove surrounding quotes if they exist
            value = value.replace(/^['"]|['"]$/g, '');
            
            if (key && value) {
              env.push({
                name: key,
                value: value
              });
            }
          }
        }
        
        console.log(`Loaded ${env.length - 1} environment variables from .env file`);
      } catch (err) {
        console.error(`Error reading .env file: ${err.message}`);
      }
    }
    
    // Create a new service
    const svc = new Service({
      name: serviceConfig.name,
      description: serviceConfig.description,
      script: serviceConfig.script,
      nodeOptions: [],
      workingDirectory: agentDir,
      allowServiceLogon: true,
      env: env
    });
    
    // Installation events
    svc.on('install', () => {
      console.log('Service installed successfully!');
      svc.start();
    });
    
    svc.on('alreadyinstalled', () => {
      console.log('Service is already installed.');
    });
    
    svc.on('start', () => {
      console.log('Service started successfully!');
    });
    
    svc.on('error', (err) => {
      console.error('Service installation error:', err);
    });
    
    // Install the service
    console.log('Installing Windows service...');
    svc.install();
  } catch (err) {
    console.error('Failed to install Windows service:', err);
    if (err.message.includes('Cannot find module \'node-windows\'')) {
      console.log('\nPlease install node-windows package:');
      console.log('npm install node-windows --save');
    }
    process.exit(1);
  }
}

function installLinuxService() {
  if (!isAdmin) {
    console.error('ERROR: Root privileges required. Please run with sudo.');
    process.exit(1);
  }
  
  try {
    // Collect environment variables from .env file
    const envVars = ['NODE_ENV=production'];
    const envPath = path.join(agentDir, '.env');
    
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envLines = envContent.split('\n');
        
        for (const line of envLines) {
          // Skip comments and empty lines
          if (line.trim().startsWith('#') || !line.trim()) continue;
          
          const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
          if (match) {
            const key = match[1];
            let value = match[2] || '';
            
            // Remove surrounding quotes if they exist
            value = value.replace(/^['"]|['"]$/g, '');
            
            if (key && value) {
              envVars.push(`${key}=${value}`);
            }
          }
        }
        
        console.log(`Loaded ${envVars.length - 1} environment variables from .env file`);
      } catch (err) {
        console.error(`Error reading .env file: ${err.message}`);
      }
    }
    
    // Create systemd service file
    const serviceFile = `/etc/systemd/system/${serviceConfig.name.toLowerCase()}.service`;
    const serviceContent = `[Unit]
Description=${serviceConfig.description}
After=network.target

[Service]
Type=simple
User=nobody
WorkingDirectory=${agentDir}
ExecStart=/usr/bin/env node ${serviceConfig.script}
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=${serviceConfig.name.toLowerCase()}
${envVars.map(env => `Environment=${env}`).join('\n')}

[Install]
WantedBy=multi-user.target
`;
    
    // Write service file
    fs.writeFileSync(serviceFile, serviceContent);
    console.log(`Created systemd service file: ${serviceFile}`);
    
    // Reload systemd, enable and start service
    execSync('systemctl daemon-reload', { stdio: 'inherit' });
    execSync(`systemctl enable ${serviceConfig.name.toLowerCase()}`, { stdio: 'inherit' });
    execSync(`systemctl start ${serviceConfig.name.toLowerCase()}`, { stdio: 'inherit' });
    
    console.log('Service installed and started successfully!');
    console.log(`To check status: systemctl status ${serviceConfig.name.toLowerCase()}`);
  } catch (err) {
    console.error('Failed to install Linux service:', err);
    process.exit(1);
  }
}

function installMacService() {
  if (!isAdmin) {
    console.error('ERROR: Root privileges required. Please run with sudo.');
    process.exit(1);
  }
  
  try {
    // Collect environment variables from .env file
    const envVars = {
      'NODE_ENV': 'production'
    };
    
    const envPath = path.join(agentDir, '.env');
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envLines = envContent.split('\n');
        
        for (const line of envLines) {
          // Skip comments and empty lines
          if (line.trim().startsWith('#') || !line.trim()) continue;
          
          const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
          if (match) {
            const key = match[1];
            let value = match[2] || '';
            
            // Remove surrounding quotes if they exist
            value = value.replace(/^['"]|['"]$/g, '');
            
            if (key && value) {
              envVars[key] = value;
            }
          }
        }
        
        console.log(`Loaded ${Object.keys(envVars).length - 1} environment variables from .env file`);
      } catch (err) {
        console.error(`Error reading .env file: ${err.message}`);
      }
    }
    
    // Build environment variables XML for plist
    let envXml = '';
    for (const [key, value] of Object.entries(envVars)) {
      envXml += `        <key>${key}</key>\n        <string>${value}</string>\n`;
    }
    
    // Create launchd plist file
    const plistFile = `/Library/LaunchDaemons/com.vindcom.${serviceConfig.name.toLowerCase()}.plist`;
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vindcom.${serviceConfig.name.toLowerCase()}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>${serviceConfig.script}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${agentDir}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/${serviceConfig.name.toLowerCase()}.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/${serviceConfig.name.toLowerCase()}.log</string>
    <key>EnvironmentVariables</key>
    <dict>
${envXml}
    </dict>
</dict>
</plist>`;
    
    // Write plist file
    fs.writeFileSync(plistFile, plistContent);
    console.log(`Created launchd plist file: ${plistFile}`);
    
    // Set permissions and load service
    execSync(`chown root:wheel ${plistFile}`, { stdio: 'inherit' });
    execSync(`chmod 644 ${plistFile}`, { stdio: 'inherit' });
    execSync(`launchctl load ${plistFile}`, { stdio: 'inherit' });
    
    console.log('Service installed and started successfully!');
    console.log(`To check status: launchctl list | grep com.vindcom.${serviceConfig.name.toLowerCase()}`);
  } catch (err) {
    console.error('Failed to install macOS service:', err);
    process.exit(1);
  }
}

// Helper function to ensure .env file exists
function ensureEnvFile() {
  const envPath = path.join(agentDir, '.env');
  const examplePath = path.join(agentDir, '.env.example');
  
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    try {
      fs.copyFileSync(examplePath, envPath);
      console.log(`Created .env file from example. Please edit ${envPath} with your configuration.`);
      return false;
    } catch (err) {
      console.error(`Failed to create .env file: ${err.message}`);
    }
  }
  
  return fs.existsSync(envPath);
}

// Main execution
console.log(`=== VINDCOM NetherDeck Agent Service Installer ===`);
console.log(`Platform: ${platform}`);

// Ensure .env file exists
const envExists = ensureEnvFile();

// Check if API key is configured
if (!checkApiKey()) {
  console.warn('WARNING: No API key configured. Service will run in insecure mode.');
  if (envExists) {
    console.warn('Please edit the .env file and set AGENT_API_KEY to a secure value.');
  } else {
    console.warn('You should set the AGENT_API_KEY environment variable or configure it in config.json');
  }
}

// Install service based on platform
if (platform === 'win32') {
  installWindowsService();
} else if (platform === 'linux') {
  installLinuxService();
} else if (platform === 'darwin') {
  installMacService();
} else {
  console.error(`Unsupported platform: ${platform}`);
  process.exit(1);
}