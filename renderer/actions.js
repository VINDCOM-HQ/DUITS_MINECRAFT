// src/renderer/actions.js
// ───────────────────────────────────────────────────────────────────────────────
// “.action-btn” handlers (ban, kick, gamemode, etc.)
import { actionButtons, playerSelect } from './domElements.js';
import { loadPlayers } from './refreshers.js';
import { showToast } from './toast.js';

export default function initActions(client, log) {
  actionButtons.forEach(btn => btn.addEventListener('click', async () => {
    if (!client) return;
    const action = btn.dataset.action;
    const player = playerSelect.value;
    if (!player) { showToast('Failed: No player selected','error'); return; }
    let cmd;
    switch(action) {
      case 'ban': cmd = `ban ${player}`; break;
      case 'kick': cmd = `kick ${player}`; break;
      case 'ban-ip': cmd = `ban-ip ${player}`; break;
      case 'op': cmd = `op ${player}`; break;
      case 'deop': cmd = `deop ${player}`; break;
      case 'survival': cmd = `gamemode survival ${player}`; break;
      case 'creative': cmd = `gamemode creative ${player}`; break;
      case 'adventure': cmd = `gamemode adventure ${player}`; break;
      case 'spectator': cmd = `gamemode spectator ${player}`; break;
      default: return;
    }
    btn.disabled=true;
    try {
      const r = await client.command(cmd);
      if (!r.success) { showToast(`Failed: ${r.error.message}`,'error'); return; }
      let name = action.charAt(0).toUpperCase()+action.slice(1);
      if (action==='ban-ip') name='Ban IP';
      showToast(`Success: ${name} ${player}`,'success');
      window.expectingConsoleCount=2;
      log(`> ${cmd}`);
      if (r.result) log(r.result);
      if (['ban','kick','ban-ip'].includes(action)) {
        // Refresh player list after mutating actions
        await loadPlayers();
      }
    } catch(e){
      showToast(`${cmd} failed: ${e.message}`,'error');
    } finally{ btn.disabled=false; }
  }));
}
