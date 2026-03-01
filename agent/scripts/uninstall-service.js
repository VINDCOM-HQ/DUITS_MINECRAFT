#!/usr/bin/env node
/**
 * Service uninstallation script
 * 
 * Detects platform and removes the appropriate service
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
  name: 'DUITS-MC-Agent'
};

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

function uninstallWindowsService() {
  if (!isAdmin) {
    console.error('ERROR: Administrator privileges required. Please run as Administrator.');
    process.exit(1);
  }
  
  try {
    // Dynamically require node-windows
    const { Service } = require('node-windows');
    
    // Create a new service reference
    const svc = new Service({
      name: serviceConfig.name,
      script: path.join(agentDir, 'index.js')
    });
    
    // Uninstallation events
    svc.on('uninstall', () => {
      console.log('Service uninstalled successfully!');
    });
    
    svc.on('error', (err) => {
      console.error('Service uninstallation error:', err);
    });
    
    // Uninstall the service
    console.log('Uninstalling Windows service...');
    svc.uninstall();
  } catch (err) {
    console.error('Failed to uninstall Windows service:', err);
    if (err.message.includes('Cannot find module \'node-windows\'')) {
      console.log('\nPlease install node-windows package:');
      console.log('npm install node-windows --save');
    }
    process.exit(1);
  }
}

function uninstallLinuxService() {
  if (!isAdmin) {
    console.error('ERROR: Root privileges required. Please run with sudo.');
    process.exit(1);
  }
  
  try {
    const serviceFile = `/etc/systemd/system/${serviceConfig.name.toLowerCase()}.service`;
    
    // Stop and disable service
    console.log(`Stopping ${serviceConfig.name} service...`);
    try {
      execSync(`systemctl stop ${serviceConfig.name.toLowerCase()}`, { stdio: 'inherit' });
      console.log(`Disabling ${serviceConfig.name} service...`);
      execSync(`systemctl disable ${serviceConfig.name.toLowerCase()}`, { stdio: 'inherit' });
    } catch (err) {
      console.warn(`Warning: Service might not be running or enabled: ${err.message}`);
    }
    
    // Remove service file
    if (fs.existsSync(serviceFile)) {
      fs.unlinkSync(serviceFile);
      console.log(`Removed service file: ${serviceFile}`);
    } else {
      console.warn(`Service file not found: ${serviceFile}`);
    }
    
    // Reload systemd
    execSync('systemctl daemon-reload', { stdio: 'inherit' });
    console.log('Service uninstalled successfully!');
  } catch (err) {
    console.error('Failed to uninstall Linux service:', err);
    process.exit(1);
  }
}

function uninstallMacService() {
  if (!isAdmin) {
    console.error('ERROR: Root privileges required. Please run with sudo.');
    process.exit(1);
  }
  
  try {
    const plistFile = `/Library/LaunchDaemons/com.duits.${serviceConfig.name.toLowerCase()}.plist`;
    
    // Unload service
    console.log(`Unloading ${serviceConfig.name} service...`);
    if (fs.existsSync(plistFile)) {
      execSync(`launchctl unload ${plistFile}`, { stdio: 'inherit' });
      
      // Remove plist file
      fs.unlinkSync(plistFile);
      console.log(`Removed plist file: ${plistFile}`);
    } else {
      console.warn(`Plist file not found: ${plistFile}`);
    }
    
    console.log('Service uninstalled successfully!');
  } catch (err) {
    console.error('Failed to uninstall macOS service:', err);
    process.exit(1);
  }
}

// Main execution
console.log(`=== DUITS Minecraft RMM Agent Service Uninstaller ===`);
console.log(`Platform: ${platform}`);

// Uninstall service based on platform
if (platform === 'win32') {
  uninstallWindowsService();
} else if (platform === 'linux') {
  uninstallLinuxService();
} else if (platform === 'darwin') {
  uninstallMacService();
} else {
  console.error(`Unsupported platform: ${platform}`);
  process.exit(1);
}