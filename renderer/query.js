// src/renderer/query.js
// ───────────────────────────────────────────────────────────────────────────────
// Minecraft “Query” button logic
import { hostEl, queryPortEl, queryModeEl, queryBtn, queryOut } from './domElements.js';
import { getAgentSettings, queryStatus } from './api.js';
import { formatQueryResult, stripCodes } from './utils.js';
import { showToast } from './toast.js';

export default function initQuery() {
  queryBtn.addEventListener('click', async () => {
    const host = hostEl.value.trim();
    const port = parseInt(queryPortEl.value, 10);
    const mode = queryModeEl.value;
    if (!host)    { showToast('Host is required for query','error'); return; }
    if (isNaN(port)||port<1||port>65535){ showToast('Query port must be 1–65535','error'); return; }
    queryOut.innerHTML='';
    try {
      const agentSettings = await getAgentSettings();
      let info;
      if (agentSettings.enabled && window.agentWebSocket) {
        info = await window.agentWebSocket.query(host, port, mode);
      } else {
        info = await queryStatus(host, port, mode);
      }
      if (info._noConnection) {
        queryOut.innerHTML = formatQueryResult(info,'basic');
        const note = document.createElement('div');
        note.className='text-sm text-gray-500 mt-2 italic';
        note.textContent='Server unreachable – showing estimated information only';
        queryOut.appendChild(note);
      } else {
        queryOut.innerHTML = formatQueryResult(info, mode);
      }
    } catch(err) {
      console.error('Query error:',err);
      const agentSettings = await getAgentSettings();
      if (agentSettings.enabled) {
        showToast('Query failed – check agent connection','warning');
        queryOut.innerHTML = `<div class="space-y-2 font-mono text-sm">
          <p class="text-amber-600">Unable to reach Minecraft server or agent.</p>
          <p class="text-sm text-gray-500">Check agent connection and server status.</p>
        </div>`;
      } else {
        showToast(`Query failed: ${err.message}`,'error');
        queryOut.textContent = `[ERROR] ${err.message}`;
      }
    }
  });
}
