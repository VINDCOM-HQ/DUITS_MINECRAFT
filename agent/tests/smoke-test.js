/**
 * Smoke test for DUITS Minecraft RMM Agent
 * 
 * This test starts the agent and performs a basic health check
 * to ensure it's working correctly.
 * 
 * Run with: node smoke-test.js
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const TEST_PORT = 8081;
const TEST_API_KEY = 'test-api-key';

// Start agent with test configuration
process.env.AGENT_PORT = TEST_PORT;
process.env.AGENT_API_KEY = TEST_API_KEY;
process.env.NODE_ENV = 'test';

console.log('Starting agent for smoke test...');
const agentProcess = spawn('node', [path.join(__dirname, '..', 'index.js')], {
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe']
});

// Handle agent logs
agentProcess.stdout.on('data', (data) => {
  console.log(`[AGENT] ${data.toString().trim()}`);
});

agentProcess.stderr.on('data', (data) => {
  console.error(`[AGENT ERR] ${data.toString().trim()}`);
});

// Wait for agent to start
setTimeout(() => {
  console.log(`Testing agent health endpoint on port ${TEST_PORT}...`);
  
  // Make a health check request
  const req = http.request({
    method: 'GET',
    hostname: 'localhost',
    port: TEST_PORT,
    path: '/health',
    headers: {
      'X-API-Key': TEST_API_KEY
    }
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('Health check response:', response);
        
        if (response.status === 'ok') {
          console.log('\n✅ Smoke test passed: Agent is running and responding');
          exitTest(0);
        } else {
          console.error('\n❌ Smoke test failed: Unexpected response');
          exitTest(1);
        }
      } catch (err) {
        console.error('\n❌ Smoke test failed:', err);
        exitTest(1);
      }
    });
  });
  
  req.on('error', (err) => {
    console.error('\n❌ Smoke test failed:', err);
    exitTest(1);
  });
  
  req.end();
}, 2000); // Give the agent 2 seconds to start

// Graceful shutdown
function exitTest(code) {
  console.log('Shutting down agent...');
  agentProcess.kill('SIGTERM');
  
  // Wait for cleanup
  setTimeout(() => {
    console.log('Smoke test complete');
    process.exit(code);
  }, 1000);
}

// Handle interruption
process.on('SIGINT', () => exitTest(1));