// src/renderer/rconClient.js
// ───────────────────────────────────────────────────────────────────────────────
// Connect / reconnect / disconnect logic and client wrapper
import {
    hostEl, portEl, passEl,
    connectBtn, reconnectBtn, disconnectBtn,
    statusSp, serverStatusInd, sendBtn,
    logEl, startLogBtn, cmdEl, outPr,
    actionsWarning
  } from './domElements.js';
import {
    getAgentSettings, rconConnect, rconDisconnect, agentReconnect,
    selectLogFile, startLogTail
  } from './api.js';
  import { showToast, errorToast, successToast } from './toast.js';
  import { loadPlayers, updatePlayerStats, loadBanned, loadBannedIPs } from './refreshers.js';
  import initAutocomplete from './autocomplete.js';
  import initActions from './actions.js';
  
  let client = null;
  let wsClient = null;
  let savedLogPath = null;
  let playerRefreshInterval = null;
  let playerStatsInterval  = null;
  let bannedRefreshInterval = null;
  
  function log(line) {
    const clean = line; // assume stripCodes applied upstream
    if (window.savedLogPath) {
      window.electronAPI.appendToLog(window.savedLogPath, clean + '\n').catch(err => {
        showToast(`Log write error: ${err.message}`, 'error');
      });
    }
    if (window.expectingConsoleCount > 0) {
      document.getElementById('output').textContent += clean + '\n';
      window.expectingConsoleCount--;
    }
  }
  // Handle log file selection
  async function handleLogDialog() {
    try {
      const filePath = await selectLogFile();
      if (!filePath) return;
      savedLogPath = filePath;
      logEl.value = filePath;
      startLogBtn.disabled = false;
      log(`[+] Log file ready: ${filePath}`);
      logEl.blur();
    } catch (err) {
      showToast(`Failed to select log file: ${err.message}`, 'error');
      console.error('selectLogFile error:', err);
    }
  }
  // Attach log file UI handlers
  logEl.addEventListener('click', handleLogDialog);
  logEl.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogDialog(); });
  startLogBtn.addEventListener('click', async () => {
    if (!savedLogPath) return;
    try {
      const ok = await startLogTail(savedLogPath);
      if (!ok) {
        showToast('Failed to start log tail', 'error');
        log(`[ERROR] Failed to start log tail`);
        return;
      }
      log(`[+] Tailing logs at: ${savedLogPath}`);
      startLogBtn.textContent = 'Logging';
      startLogBtn.disabled = true;
      showToast('Started logging', 'success');
    } catch (err) {
      showToast(`Failed to start log tail: ${err.message}`, 'error');
      log(`[ERROR] Failed to start log tail: ${err.message}`);
    }
  });
  
  function restartTimers() {
    if (!playerRefreshInterval) {
      let failCount = 0;
      playerRefreshInterval = setInterval(async () => {
        try { await loadPlayers(false); failCount = 0; }
        catch(err){ failCount++; if(failCount>=3) clearInterval(playerRefreshInterval); }
      }, 10000);
    }
    if (!playerStatsInterval) {
      let failCount = 0;
      playerStatsInterval = setInterval(async () => {
        try { await updatePlayerStats(); failCount = 0; }
        catch(err){ failCount++; if(failCount>=3) clearInterval(playerStatsInterval); }
      }, 5000);
    }
    if (!bannedRefreshInterval) {
      let failCount = 0;
      bannedRefreshInterval = setInterval(async () => {
        try { await loadBanned(false); await loadBannedIPs(false); failCount = 0; }
        catch(err){ failCount++; if(failCount>=3) clearInterval(bannedRefreshInterval); }
      }, 10000);
    }
  }
  
  export default function initRconClient() {
    connectBtn.addEventListener('click', async () => {
      const host = hostEl.value.trim();
      const port = parseInt(portEl.value, 10);
      const pass = passEl.value;
      if (!host)    { showToast('Host is required', 'error'); return; }
      if (isNaN(port) || port<1||port>65535) { showToast('Port must be 1–65535','error');return; }
      if (!pass)    { showToast('Password is required','error');return; }
  
      statusSp.textContent = 'Connecting…';
      connectBtn.disabled = true;
  
      try {
        const agentSettings = await getAgentSettings();
        if (agentSettings.enabled) {
          if (!wsClient) {
            wsClient = await window.agentWebSocket.connect(agentSettings.url, agentSettings.apiKey);
            wsClient.setOnDisconnected(() => {
              errorToast('WebSocket connection to agent lost');
              statusSp.textContent = 'Disconnected';
              reconnectBtn.classList.remove('hidden'); reconnectBtn.disabled=false;
              disconnectBtn.classList.add('hidden');
            });
            wsClient.setOnConnected(() => {
              statusSp.textContent = 'Connected';
              reconnectBtn.classList.add('hidden');
              disconnectBtn.classList.remove('hidden'); disconnectBtn.disabled=false;
            });
          }
          await wsClient.connectToRcon(host, port, pass);
        } else {
          await rconConnect(host, port, pass);
        }
  
        // wrap client
        client = {
          command: async cmd => {
            try {
              const result = agentSettings.enabled
                ? await wsClient.rconCommand(cmd)
                : await window.electronAPI.rconCommand(cmd);
              window.connectionErrorCount = 0;
              if (statusSp.textContent === 'Disconnected') {
                statusSp.textContent = 'Connected';
                reconnectBtn.classList.add('hidden');
                disconnectBtn.classList.remove('hidden'); disconnectBtn.disabled=false;
                restartTimers();
              }
              return { success: true, result, error: null };
            } catch (err) {
              const isConnErr = /invalid clientId|Not connected/.test(err.message);
              if (isConnErr) {
                window.connectionErrorCount = (window.connectionErrorCount||0)+1;
                if (window.connectionErrorCount >= 3) {
                  clearInterval(playerRefreshInterval); playerRefreshInterval=null;
                  clearInterval(playerStatsInterval);  playerStatsInterval=null;
                  clearInterval(bannedRefreshInterval);bannedRefreshInterval=null;
                  statusSp.textContent = 'Disconnected';
                  serverStatusInd.classList.remove('bg-green-500');
                  serverStatusInd.classList.add('bg-red-500');
                  reconnectBtn.classList.remove('hidden'); reconnectBtn.disabled=false;
                  disconnectBtn.classList.add('hidden');
                  setTimeout(()=> reconnectBtn.click(),3000);
                } else if (window.connectionErrorCount === 2) {
                  statusSp.textContent = 'Reconnecting...';
                }
                showToast(`Connection lost: ${err.message}`, 'error');
              }
              return { success: false, result: null, error: { message: err.message, isConnectionError: isConnErr } };
            }
          },
          reconnect: async () => {
            try {
              await agentReconnect();
              window.connectionErrorCount = 0;
              restartTimers();
              statusSp.textContent='Connected';
              reconnectBtn.classList.add('hidden');
              disconnectBtn.classList.remove('hidden'); disconnectBtn.disabled=false;
              showToast('Reconnected successfully','success');
              return { success:true, error:null };
            } catch(e){
              statusSp.textContent='Reconnect Failed';
              showToast(`Reconnection failed: ${e.message}`,'error');
              return { success:false, error:{message:e.message} };
            }
          },
          disconnect: async () => {
            try {
              if (agentSettings.enabled) await wsClient.disconnectFromRcon();
              else await rconDisconnect();
              clearInterval(playerRefreshInterval); playerRefreshInterval=null;
              clearInterval(playerStatsInterval);  playerStatsInterval=null;
              clearInterval(bannedRefreshInterval);bannedRefreshInterval=null;
              statusSp.textContent='Disconnected';
              window.connectionErrorCount=0; window.playerRefreshErrorCount=0;
              disconnectBtn.classList.add('hidden');
              reconnectBtn.classList.add('hidden');
              connectBtn.classList.remove('hidden'); connectBtn.disabled=false;
              return { success:true, error:null };
            } catch(e){
              showToast(`Disconnect failed: ${e.message}`,'error');
              return { success:false, error:{message:e.message} };
            }
          }
        };

        // Make client available globally for refreshers and other modules
        window.client = client;

        statusSp.textContent = `Connected to ${host}`;
        serverStatusInd.classList.remove('bg-gray-400','bg-red-500');
        serverStatusInd.classList.add('bg-green-500');
        sendBtn.disabled = false;
        disconnectBtn.disabled = false;
        connectBtn.classList.add('hidden');
        disconnectBtn.classList.remove('hidden');
        actionsWarning.classList.add('hidden');
        restartTimers();

        // build autocomplete & actions
        await initAutocomplete(client, log);
        initActions(client, log);
  
        // initial loads
        await loadPlayers(true);
        await updatePlayerStats();
        await loadBanned(false);
        await loadBannedIPs(false);
  
      } catch(err) {
        statusSp.textContent='Error';
        showToast(`Connection failed: ${err.message}`,'error');
        log(`[ERROR] ${err.message}`);
        connectBtn.disabled=false;
      }
    });
  
    reconnectBtn.addEventListener('click', async () => {
      reconnectBtn.disabled = true;
      disconnectBtn.disabled = true;
      connectBtn.disabled = true;
      statusSp.textContent = 'Reconnecting...';
      log('[*] Attempting to reconnect...');
      if (!client || !client.reconnect) {
        showToast('No client available for reconnection','error');
        return;
      }
      async function attempt(n) {
        try {
          const r = await client.reconnect();
          if (!r.success) throw new Error(r.error.message);
          return true;
        } catch(e) {
          if (n<3) { await new Promise(r=>setTimeout(r,Math.min(2000*Math.pow(1.5,n-1),10000))); return attempt(n+1); }
          return false;
        }
      }
      const ok = await attempt(1);
      if (ok) {
        log('[+] Successfully reconnected');
        showToast('Reconnected successfully','success');
        statusSp.textContent='Connected';
        reconnectBtn.classList.add('hidden');
        disconnectBtn.classList.remove('hidden'); disconnectBtn.disabled=false;
        sendBtn.disabled=false;
      } else {
        log('[ERROR] All reconnection attempts failed');
        showToast('Reconnection failed after multiple attempts','error');
        statusSp.textContent='Reconnect Failed';
        reconnectBtn.disabled=false;
      }
      connectBtn.disabled=false;
    });
  
    disconnectBtn.addEventListener('click', async () => {
      disconnectBtn.disabled = true;
      if (!client) return;
      const r = await client.disconnect();
      if (!r.success) {
        showToast(`Disconnect failed: ${r.error.message}`,'error');
        disconnectBtn.disabled=false;
        return;
      }
      sendBtn.disabled = true;
      connectBtn.disabled = false;
      client = null;
      window.client = null;
      log('[+] Disconnected from server');
      statusSp.textContent='Not connected';
      serverStatusInd.classList.remove('bg-green-500','bg-red-500');
      serverStatusInd.classList.add('bg-gray-400');
      disconnectBtn.classList.add('hidden');
      reconnectBtn.classList.add('hidden');
      connectBtn.classList.remove('hidden');
      actionsWarning.classList.remove('hidden');
      // clear UI
      document.getElementById('output').textContent='';
    });

    // Console Send button handler
    sendBtn.addEventListener('click', async () => {
      if (!window.client) {
        showToast('Not connected to server', 'error');
        return;
      }
      const cmd = cmdEl.value.trim();
      if (!cmd) return;

      // Disable input while executing
      cmdEl.disabled = true;
      sendBtn.disabled = true;

      try {
        // Log command to output
        outPr.textContent += `> ${cmd}\n`;
        outPr.scrollTop = outPr.scrollHeight;

        const result = await window.client.command(cmd);
        if (result.success && result.result) {
          outPr.textContent += result.result + '\n';
        } else if (!result.success) {
          outPr.textContent += `Error: ${result.error.message}\n`;
        }
        outPr.scrollTop = outPr.scrollHeight;

        // Clear input
        cmdEl.value = '';
      } catch (err) {
        outPr.textContent += `Error: ${err.message}\n`;
        outPr.scrollTop = outPr.scrollHeight;
      } finally {
        // Re-enable input
        cmdEl.disabled = false;
        sendBtn.disabled = false;
        cmdEl.focus();
      }
    });
  }
  