// src/renderer/serverManagement.js
// ───────────────────────────────────────────────────────────────────────────────
// refreshServerList + add/edit/remove server
import { serverSelectEl, addServerBtn, editServerBtn, removeServerBtn,
    hostEl, portEl, passEl, queryPortEl } from './domElements.js';
import { showConfirmModal } from './modals.js';
import { saveConfig } from './api.js';
import { showToast } from './toast.js';

export default function initServerManagement() {
function refreshServerList() {
serverSelectEl.innerHTML = '';
window.cfg.servers.forEach((srv,i)=>{
 const opt = document.createElement('option');
 opt.value = i; opt.textContent = `${srv.host}:${srv.port}`;
 serverSelectEl.appendChild(opt);
});
if(window.cfg.servers.length>0){
 serverSelectEl.selectedIndex=0; onServerSelectChange();
} else {
 hostEl.value=''; portEl.value=''; passEl.value='';
 queryPortEl.value = queryPortEl.defaultValue;
 editServerBtn.disabled=true; removeServerBtn.disabled=true;
}
hostEl.disabled=false; portEl.disabled=false; passEl.disabled=false; queryPortEl.disabled=false;
updateServerButtons();
}

function onServerSelectChange(){
const idx = serverSelectEl.selectedIndex; if(idx<0) return;
const srv=window.cfg.servers[idx];
hostEl.value=srv.host; portEl.value=srv.port; passEl.value=srv.password;
queryPortEl.value=srv.queryPort!==undefined?srv.queryPort:queryPortEl.defaultValue;
editServerBtn.disabled=false; removeServerBtn.disabled=false;
}

function updateServerButtons(){
const h=hostEl.value.trim(), p=parseInt(portEl.value,10);
const idx=window.cfg.servers.findIndex(s=>s.host===h&&s.port===p);
if(idx>=0){
 addServerBtn.classList.add('hidden'); editServerBtn.classList.remove('hidden');
 editServerBtn.disabled=false; removeServerBtn.disabled=false; serverSelectEl.selectedIndex=idx;
} else {
 editServerBtn.classList.add('hidden'); addServerBtn.classList.remove('hidden');
 removeServerBtn.disabled=true;
}
}

addServerBtn.addEventListener('click',()=>{
const h=hostEl.value.trim(), portStr=portEl.value.trim(), pwd=passEl.value, qStr=queryPortEl.value.trim();
if(!h){ showToast('Host is required','error'); return; }
const p=parseInt(portStr,10);
if(isNaN(p)||p<1||p>65535){ showToast('Port must be 1–65535','error'); return; }
if(!pwd){ showToast('Password is required','error'); return; }
const qp=parseInt(qStr,10);
if(isNaN(qp)||qp<1||qp>65535){ showToast('Query port must be 1–65535','error'); return; }
const exist=window.cfg.servers.findIndex(s=>s.host===h&&s.port===p);
if(exist>=0){
 window.cfg.servers[exist]={host:h,port:p,password:pwd,queryPort:qp};
 saveConfig(window.cfg); refreshServerList(); showToast('Server updated','success'); return;
}
window.cfg.servers.push({host:h,port:p,password:pwd,queryPort:qp});
saveConfig(window.cfg); refreshServerList(); showToast('Server added','success');
});

editServerBtn.addEventListener('click',()=>{
const idx=serverSelectEl.selectedIndex; if(idx<0)return;
const h=hostEl.value.trim(), p=parseInt(portEl.value,10), pwd=passEl.value, qp=parseInt(queryPortEl.value,10);
if(!h){ showToast('Host is required','error'); return; }
if(isNaN(p)||p<1||p>65535){ showToast('Port must be 1–65535','error'); return; }
if(!pwd){ showToast('Password is required','error'); return; }
if(isNaN(qp)||qp<1||qp>65535){ showToast('Query port must be 1–65535','error'); return; }
const dup=window.cfg.servers.findIndex((s,i)=>i!==idx&&s.host===h&&s.port===p);
if(dup>=0){ showToast('Another with same host/port exists','error'); return; }
window.cfg.servers[idx]={host:h,port:p,password:pwd,queryPort:qp};
saveConfig(window.cfg); refreshServerList(); showToast('Server updated','success');
});

removeServerBtn.addEventListener('click',async()=>{
const idx=serverSelectEl.selectedIndex; if(idx<0)return;
const srv=window.cfg.servers[idx];
    // Use custom confirmation modal
    const confirmed = await showConfirmModal(`Remove server ${srv.host}:${srv.port}?`);
    if (!confirmed) return;
    // Delete and reload
    window.cfg.servers.splice(idx,1);
    saveConfig(window.cfg);
    location.reload();
});

serverSelectEl.addEventListener('change', onServerSelectChange);
[hostEl,portEl,queryPortEl].forEach(el=>el.addEventListener('input',updateServerButtons));
refreshServerList();
}
