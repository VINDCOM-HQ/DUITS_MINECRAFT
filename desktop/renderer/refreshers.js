// src/renderer/refreshers.js
// ───────────────────────────────────────────────────────────────────────────────
// updatePlayerStats, loadPlayers, loadBanned, loadBannedIPs
// Utilities: strip color codes
import { stripCodes } from './utils.js';
// Toast notifications
import { showToast } from './toast.js';
import { statusSp, refreshPlayersBtn, playerSelect, playerStatsEl,
         refreshStatsBtn, bannedListEl, refreshBannedBtn,
         bannedCountSpan, bannedIPsListEl, refreshBannedIPsBtn,
         bannedIPsCountSpan } from './domElements.js';
import { rconCommand } from './api.js';

export async function updatePlayerStats() {
  if (!window.client) return;
  if (['Disconnected','Reconnect Failed'].includes(statusSp.textContent)) return;
  const player = playerSelect.value;
  if (!player) { playerStatsEl.textContent=''; return; }
  try {
    const resp = await window.client.command(`data get entity ${player} Pos`);
    if (!resp.success) throw new Error(resp.error.message);
    const cleaned = stripCodes(resp.result);
    const nums = cleaned.match(/-?\d*\.?\d+/g);
    if (nums && nums.length>=3) {
      playerStatsEl.textContent = `${parseFloat(nums[0]).toFixed(2)}, ${parseFloat(nums[1]).toFixed(2)}, ${parseFloat(nums[2]).toFixed(2)}`;
    } else playerStatsEl.textContent=cleaned;
    window.playerStatsErrorCount=0;
  } catch(err) {
    console.error(`[ERROR] updatePlayerStats: ${err.message}`);
    if (/Not connected|invalid clientId|ECONNREFUSED/.test(err.message)) {
      // swallow
      playerStatsEl.textContent='---';
    } else {
      const now=Date.now();
      if (!window.lastPlayerStatsErrorToast||now-window.lastPlayerStatsErrorToast>30000){
        showToast(`Player coordinates error: ${err.message}`,'error');
        window.lastPlayerStatsErrorToast=now;
      }
      playerStatsEl.textContent='---';
    }
  }
}
export async function loadPlayers(showMsg=false){
  if (!window.client) return;
  if (['Disconnected','Reconnect Failed'].includes(statusSp.textContent)) return;
  refreshPlayersBtn.disabled=true;
  try {
    const resp = await window.client.command('list');
    if (!resp.success) throw new Error(resp.error.message);
    const parts = resp.result.split(':');
    const m=parts[0].match(/There are\s*(\d+)\s*of a max of\s*(\d+)/i);
    const online = m?parseInt(m[1],10):0, max=m?parseInt(m[2],10):0;
    const players = (parts[1]||'').split(',').map(s=>s.trim()).filter(Boolean);
    const prev=playerSelect.value;
    playerSelect.innerHTML='';
    players.forEach(p=>{
      const o=document.createElement('option');
      o.value=p; o.textContent=p; playerSelect.appendChild(o);
    });
    if (prev&&players.includes(prev)) playerSelect.value=prev;
    document.getElementById('player-count').textContent = max>0?`${online}/${max}`:`${players.length}`;
    window.playerRefreshErrorCount=0;
    if(showMsg){ showToast(`Success: Loaded ${players.length} player(s)`,'success'); await updatePlayerStats(); }
  } catch(err){
    console.error(`[ERROR] loadPlayers: ${err.message}`);
    if(showMsg||!/Not connected|invalid clientId|ECONNREFUSED/.test(err.message)){
      showToast(`Failed to load players: ${err.message}`,'error');
    }
  } finally { refreshPlayersBtn.disabled=false; }
}
export async function loadBanned(showMsg=false){
  if (!window.client) return;
  if (['Disconnected','Reconnect Failed'].includes(statusSp.textContent)) return;
  refreshBannedBtn.disabled=true;
  try {
    const resp = await window.client.command('banlist players');
    if (!resp.success) throw new Error(resp.error.message);
    const names = resp.result.match(/\b[0-9A-Za-z_]+(?= was banned by)/g)||[];
    bannedListEl.innerHTML='';
    names.forEach(n=>{
      const li=document.createElement('li');
      li.className='flex items-center justify-between mb-2';
      const span=document.createElement('span'); span.textContent=n; li.appendChild(span);
      const btn=document.createElement('button');
      btn.textContent='Unban'; btn.className='ml-2 px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs';
      btn.addEventListener('click',async()=>{
        btn.disabled=true;
        try{
          const r=await window.client.command(`pardon ${n}`);
          if(!r.success){ showToast(`Failed to unban player: ${r.error.message}`,'error'); return; }
          showToast(`Success: Unbanned ${n}`,'success');
          await loadBanned(false);
        }catch(e){ showToast(`Unban ${n} failed: ${e.message}`,'error'); }
        finally{btn.disabled=false;}
      });
      li.appendChild(btn);
      bannedListEl.appendChild(li);
    });
    bannedCountSpan.textContent=`${names.length}`;
    if(showMsg) showToast(`Loaded ${names.length} banned player(s)`,'success');
    window.bannedListErrorCount=0;
  }catch(err){
    console.error(`[ERROR] loadBanned: ${err.message}`);
    if(showMsg||!/Not connected|invalid clientId|ECONNREFUSED/.test(err.message))
      showToast(`Failed to load banned players: ${err.message}`,'error');
  }finally{ refreshBannedBtn.disabled=false; }
}
export async function loadBannedIPs(showMsg=false){
  if (!window.client) return;
  if (['Disconnected','Reconnect Failed'].includes(statusSp.textContent)) return;
  refreshBannedIPsBtn.disabled=true;
  try {
    const resp = await window.client.command('banlist ips');
    if (!resp.success) throw new Error(resp.error.message);
    const ips = resp.result.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g)||[];
    bannedIPsListEl.innerHTML='';
    ips.forEach(ip=>{
      const li=document.createElement('li');
      li.className='flex items-center justify-between mb-2';
      const span=document.createElement('span'); span.textContent=ip; li.appendChild(span);
      const btn=document.createElement('button');
      btn.textContent='Unban'; btn.className='ml-2 px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs';
      btn.addEventListener('click',async()=>{
        btn.disabled=true;
        try{
          const r=await window.client.command(`pardon-ip ${ip}`);
          if(!r.success){ showToast(`Failed to unban IP: ${r.error.message}`,'error'); return; }
          showToast(`Success: Unbanned IP ${ip}`,'success');
          await loadBannedIPs(false);
        }catch(e){ showToast(`Unban IP ${ip} failed: ${e.message}`,'error');}
        finally{btn.disabled=false;}
      });
      li.appendChild(btn);
      bannedIPsListEl.appendChild(li);
    });
    bannedIPsCountSpan.textContent = `${ips.length}`;
    if(showMsg) showToast(`Loaded ${ips.length} banned IP(s)`,'success');
  }catch(err){
    console.error(`[ERROR] loadBannedIPs: ${err.message}`);
    if(showMsg||!/Not connected|invalid clientId|ECONNREFUSED/.test(err.message))
      showToast(`Failed to load banned IPs: ${err.message}`,'error');
  }finally{ refreshBannedIPsBtn.disabled=false; }
}
// Initialize manual refresh handlers (bind after DOM is loaded)
export default function initRefreshers() {
  refreshPlayersBtn.addEventListener('click', () => loadPlayers(false));
  refreshStatsBtn.addEventListener('click', () => updatePlayerStats(false));
  refreshBannedBtn.addEventListener('click', () => loadBanned(false));
  refreshBannedIPsBtn.addEventListener('click', () => loadBannedIPs(false));
}
