// src/renderer/agentStatus.js
// ───────────────────────────────────────────────────────────────────────────────
// Agent connection status check and update routines

import {
  agentStatusContainer,
  agentStatusIndicator,
  agentStatusText
} from './domElements.js';
import {
  getAgentSettings,
  agentReconnect
} from './api.js';

let wsClient = null;
let agentStatusInterval = null;

// Check and update agent connection status
export async function updateAgentStatus() {
  try {
    const agentSettings = await getAgentSettings();
    if (agentSettings.enabled) {
      agentStatusContainer.classList.remove('hidden');
      if (!wsClient) {
        wsClient = await window.agentWebSocket.connect(agentSettings.url, agentSettings.apiKey);
        wsClient.setOnDisconnected(() => {
          agentStatusIndicator.classList.remove('bg-green-500');
          agentStatusIndicator.classList.add('bg-red-500');
          agentStatusText.textContent = 'Agent WebSocket disconnected';
        });
        wsClient.setOnConnected(() => {
          agentStatusIndicator.classList.remove('bg-red-500');
          agentStatusIndicator.classList.add('bg-green-500');
          updateAgentStatus();
        });
      }
      let status;
      try {
        status = await wsClient.getStatus();
        status.connected = true;
      } catch (e) {
        status = { connected: false, reason: e.message };
      }
      if (status.connected) {
        agentStatusIndicator.classList.remove('bg-gray-400','bg-red-500');
        agentStatusIndicator.classList.add('bg-green-500');
        const name = status.hostname || 'remote agent';
        const version = status.version ? `v${status.version}` : '';
        agentStatusText.textContent = `Connected to ${name} ${version} via WebSocket`;
        return true;
      } else {
        agentStatusIndicator.classList.remove('bg-gray-400','bg-green-500');
        agentStatusIndicator.classList.add('bg-red-500');
        agentStatusText.textContent = `Agent error: ${status.reason || 'Connection failed'}`;
        return false;
      }
    } else {
      agentStatusContainer.classList.add('hidden');
      if (wsClient) {
        try { wsClient.close(); } catch {};
        wsClient = null;
      }
      return false;
    }
  } catch (err) {
    console.error('Error checking agent status:', err);
    agentStatusContainer.classList.remove('hidden');
    agentStatusIndicator.classList.remove('bg-gray-400','bg-green-500');
    agentStatusIndicator.classList.add('bg-red-500');
    agentStatusText.textContent = `Agent error: ${err.message}`;
    return false;
  }
}

// Stop the agent status check interval
export function stopAgentStatusCheck() {
  if (agentStatusInterval) {
    clearInterval(agentStatusInterval);
    agentStatusInterval = null;
  }
}

// Start periodic agent status check
export async function startAgentStatusCheck() {
  try {
    stopAgentStatusCheck();
    const settings = await getAgentSettings();
    if (settings.enabled) {
      await updateAgentStatus();
      agentStatusInterval = setInterval(() => {
        updateAgentStatus().catch(() => {});
      }, 30000);
    }
  } catch (err) {
    console.error('Failed to start agent status check:', err);
  }
}