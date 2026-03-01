// src/renderer/serverFunctions.js
// ───────────────────────────────────────────────────────────────────────────────
// Server control buttons and quick command handlers
import { showToast } from './toast.js';

export default function initServerFunctions() {
  // Tick Rate Control
  const tickRateValueEl = document.getElementById('tick-rate-value');
  const cmdTickSetBtn = document.getElementById('cmd-tick-set');

  if (cmdTickSetBtn) {
    cmdTickSetBtn.addEventListener('click', async () => {
      if (!window.client) {
        showToast('Not connected to server', 'error');
        return;
      }
      const value = parseInt(tickRateValueEl?.value || '20', 10);
      if (isNaN(value) || value < 1 || value > 100) {
        showToast('Tick rate must be between 1 and 100', 'error');
        return;
      }
      cmdTickSetBtn.disabled = true;
      try {
        const result = await window.client.command(`tick rate ${value}`);
        if (result.success) {
          showToast(`Tick rate set to ${value}`, 'success');
        } else {
          showToast(`Failed: ${result.error.message}`, 'error');
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        cmdTickSetBtn.disabled = false;
      }
    });
  }

  // Idle Timeout Control
  const idleTimeoutValueEl = document.getElementById('idle-timeout-value');
  const cmdIdleTimeoutBtn = document.getElementById('cmd-idle-timeout');

  if (cmdIdleTimeoutBtn) {
    cmdIdleTimeoutBtn.addEventListener('click', async () => {
      if (!window.client) {
        showToast('Not connected to server', 'error');
        return;
      }
      const value = parseInt(idleTimeoutValueEl?.value || '10', 10);
      if (isNaN(value) || value < 0 || value > 60) {
        showToast('Idle timeout must be between 0 and 60 minutes', 'error');
        return;
      }
      cmdIdleTimeoutBtn.disabled = true;
      try {
        const result = await window.client.command(`setidletimeout ${value}`);
        if (result.success) {
          showToast(`Idle timeout set to ${value} minutes`, 'success');
        } else {
          showToast(`Failed: ${result.error.message}`, 'error');
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        cmdIdleTimeoutBtn.disabled = false;
      }
    });
  }

  // Time Control
  const timePresetEl = document.getElementById('time-preset');
  const timeCustomValueEl = document.getElementById('time-custom-value');
  const cmdSetTimeBtn = document.getElementById('cmd-set-time');

  // Show/hide custom time input based on preset selection
  if (timePresetEl && timeCustomValueEl) {
    timePresetEl.addEventListener('change', () => {
      if (timePresetEl.value === 'custom') {
        timeCustomValueEl.classList.remove('hidden');
      } else {
        timeCustomValueEl.classList.add('hidden');
      }
    });
  }

  if (cmdSetTimeBtn) {
    cmdSetTimeBtn.addEventListener('click', async () => {
      if (!window.client) {
        showToast('Not connected to server', 'error');
        return;
      }
      let value;
      if (timePresetEl?.value === 'custom') {
        value = parseInt(timeCustomValueEl?.value || '0', 10);
      } else {
        value = parseInt(timePresetEl?.value || '0', 10);
      }
      if (isNaN(value) || value < 0 || value > 24000) {
        showToast('Time must be between 0 and 24000', 'error');
        return;
      }
      cmdSetTimeBtn.disabled = true;
      try {
        const result = await window.client.command(`time set ${value}`);
        if (result.success) {
          showToast(`Time set to ${value}`, 'success');
        } else {
          showToast(`Failed: ${result.error.message}`, 'error');
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        cmdSetTimeBtn.disabled = false;
      }
    });
  }

  // Weather Control
  const weatherTypeEl = document.getElementById('weather-type');
  const cmdSetWeatherBtn = document.getElementById('cmd-set-weather');

  if (cmdSetWeatherBtn) {
    cmdSetWeatherBtn.addEventListener('click', async () => {
      if (!window.client) {
        showToast('Not connected to server', 'error');
        return;
      }
      const weatherType = weatherTypeEl?.value || 'clear';
      cmdSetWeatherBtn.disabled = true;
      try {
        const result = await window.client.command(`weather ${weatherType}`);
        if (result.success) {
          showToast(`Weather set to ${weatherType}`, 'success');
        } else {
          showToast(`Failed: ${result.error.message}`, 'error');
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        cmdSetWeatherBtn.disabled = false;
      }
    });
  }

  // Quick Commands (buttons with data-command attribute)
  const quickCommandBtns = document.querySelectorAll('.cmd-btn[data-command]');

  quickCommandBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!window.client) {
        showToast('Not connected to server', 'error');
        return;
      }
      const command = btn.dataset.command;
      if (!command) return;

      btn.disabled = true;
      try {
        const result = await window.client.command(command);
        if (result.success) {
          showToast(`Command executed: ${command}`, 'success');
          // Log result to console output if available
          const outPr = document.getElementById('output');
          if (outPr && result.result) {
            outPr.textContent += `> ${command}\n${result.result}\n`;
            outPr.scrollTop = outPr.scrollHeight;
          }
        } else {
          showToast(`Failed: ${result.error.message}`, 'error');
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Collapsible panel toggles
  const serverCommandsHeader = document.getElementById('server-commands-header');
  const serverCommandsPanel = document.getElementById('server-commands-panel');
  const serverCommandsToggle = document.getElementById('server-commands-toggle');

  if (serverCommandsHeader && serverCommandsPanel) {
    serverCommandsHeader.addEventListener('click', () => {
      serverCommandsPanel.classList.toggle('hidden');
      serverCommandsToggle?.classList.toggle('rotate-180');
    });
  }

  const bannedPlayersHeader = document.getElementById('banned-players-header');
  const bannedSection = document.getElementById('banned-section');
  const bannedPlayersToggle = document.getElementById('banned-players-toggle');

  if (bannedPlayersHeader && bannedSection) {
    bannedPlayersHeader.addEventListener('click', () => {
      bannedSection.classList.toggle('hidden');
      bannedPlayersToggle?.classList.toggle('rotate-180');
    });
  }

  const bannedIpsHeader = document.getElementById('banned-ips-header');
  const bannedIpsSection = document.getElementById('banned-ips-section');
  const bannedIpsToggle = document.getElementById('banned-ips-toggle');

  if (bannedIpsHeader && bannedIpsSection) {
    bannedIpsHeader.addEventListener('click', () => {
      bannedIpsSection.classList.toggle('hidden');
      bannedIpsToggle?.classList.toggle('rotate-180');
    });
  }
}
