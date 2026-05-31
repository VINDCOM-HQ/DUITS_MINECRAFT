// src/renderer/mysql.js
// ───────────────────────────────────────────────────────────────────────────────
// MySQL connect, disconnect, run query, connection management UI

import {
    mysqlListEl, mysqlAddBtn, mysqlEditBtn, mysqlRemoveBtn,
    mysqlHostEl, mysqlPortEl, mysqlUserEl, mysqlPasswordEl,
    mysqlDatabaseEl, mysqlSslEl, mysqlSslOptionsEl,
    mysqlCustomCaEl, mysqlCaSettingsEl, mysqlCaPathEl,
    mysqlCaBrowseBtn, mysqlConnectBtn, mysqlDisconnectBtn,
    mysqlStatusSp, mysqlStatusInd,
    mysqlStatusSidebar, mysqlStatusIndSidebar,
    mysqlQueryEl, mysqlRunBtn, mysqlResultsEl,
    mysqlSettingsHeader, mysqlSettingsPanel, mysqlToggleIcon
} from './domElements.js';
  
import {
    mysqlConnect, mysqlDisconnect, mysqlQuery,
    getAgentSettings, agentReconnect,
    saveConfig,
    readFile
} from './api.js';
  
import { showToast } from './toast.js';
import { showConfirmModal } from './modals.js';
  
  export default function initMysql() {
    function refreshMySQLList() {
      mysqlListEl.innerHTML = '';
      window.cfg.mysqls.forEach((c,i)=> {
        const opt=document.createElement('option');
        opt.value=i; opt.textContent=`${c.user}@${c.host}:${c.port}/${c.database}`;
        mysqlListEl.appendChild(opt);
      });
      if (window.cfg.mysqls.length>0) {
        mysqlListEl.selectedIndex=0; onMySQLSelectChange();
      } else {
        mysqlHostEl.value=''; mysqlPortEl.value=mysqlPortEl.defaultValue;
        mysqlUserEl.value=''; mysqlPasswordEl.value='';
        mysqlDatabaseEl.value=''; mysqlSslEl.checked=false;
        mysqlSslOptionsEl.classList.add('hidden');
        mysqlCustomCaEl.checked=false; mysqlCaSettingsEl.classList.add('hidden');
        mysqlCaPathEl.value='';
        mysqlEditBtn.disabled=true; mysqlRemoveBtn.disabled=true;
      }
      mysqlHostEl.disabled=mysqlPortEl.disabled=mysqlUserEl.disabled=mysqlPasswordEl.disabled=mysqlDatabaseEl.disabled=mysqlSslEl.disabled=false;
      updateMySQLButtons();
    }
  
    function onMySQLSelectChange() {
      const idx=mysqlListEl.selectedIndex; if(idx<0)return;
      const conn=window.cfg.mysqls[idx];
      mysqlHostEl.value=conn.host; mysqlPortEl.value=conn.port; mysqlUserEl.value=conn.user;
      mysqlPasswordEl.value=conn.password; mysqlDatabaseEl.value=conn.database;
      mysqlSslEl.checked = conn.ssl===true||!!conn.sslCaPath;
      mysqlSslOptionsEl.classList.toggle('hidden', !mysqlSslEl.checked);
      mysqlCustomCaEl.checked=!!conn.sslCaPath;
      mysqlCaSettingsEl.classList.toggle('hidden', !mysqlCustomCaEl.checked);
      mysqlCaPathEl.value=conn.sslCaPath||'';
      mysqlEditBtn.disabled=false; mysqlRemoveBtn.disabled=false;
    }
  
    function updateMySQLButtons() {
      const host=mysqlHostEl.value.trim();
      const port=parseInt(mysqlPortEl.value,10);
      const user=mysqlUserEl.value.trim();
      const db=mysqlDatabaseEl.value.trim();
      const idx=window.cfg.mysqls.findIndex(c=>c.host===host&&c.port===port&&c.user===user&&c.database===db);
      if(idx>=0){
        mysqlAddBtn.classList.add('hidden'); mysqlEditBtn.classList.remove('hidden');
        mysqlRemoveBtn.disabled=false; mysqlListEl.selectedIndex=idx;
      } else {
        mysqlEditBtn.classList.add('hidden'); mysqlAddBtn.classList.remove('hidden');
        mysqlRemoveBtn.disabled=true;
      }
    }
  
    mysqlListEl.addEventListener('change',()=>{ onMySQLSelectChange(); updateMySQLButtons(); });
    // Update Add/Edit buttons on input changes
    [mysqlHostEl, mysqlPortEl, mysqlUserEl, mysqlDatabaseEl].forEach(el => el.addEventListener('input', updateMySQLButtons));
    // Collapsible settings panel toggle
    mysqlSettingsHeader.addEventListener('click', () => {
      mysqlSettingsPanel.classList.toggle('hidden');
      mysqlToggleIcon.classList.toggle('rotate-180');
    });
  
    mysqlAddBtn.addEventListener('click',()=> {
      const host=mysqlHostEl.value.trim(), port=parseInt(mysqlPortEl.value,10),
            user=mysqlUserEl.value.trim(), pwd=mysqlPasswordEl.value,
            db=mysqlDatabaseEl.value.trim(), ssl=mysqlSslEl.checked,
            sslCa=mysqlCustomCaEl.checked?mysqlCaPathEl.value.trim():'';
      if(!host){ showToast('Host is required','error');return; }
      if(isNaN(port)||port<1||port>65535){ showToast('Port must be 1–65535','error');return; }
      if(!user){ showToast('User is required','error');return; }
      if(!db){ showToast('Database is required','error');return; }
      const exist=window.cfg.mysqls.findIndex(c=>c.host===host&&c.port===port&&c.user===user&&c.database===db);
      if(exist>=0){
        window.cfg.mysqls[exist]={host,port,user,password:pwd,database:db,ssl,sslCaPath:sslCa};
        saveConfig(window.cfg); refreshMySQLList(); showToast('Connection updated','success');
      } else {
        window.cfg.mysqls.push({host,port,user,password:pwd,database:db,ssl,sslCaPath:sslCa});
        saveConfig(window.cfg); refreshMySQLList(); showToast('Connection added','success');
        mysqlSettingsPanel.classList.add('hidden'); mysqlToggleIcon.classList.add('rotate-180');
      }
    });
  
    mysqlEditBtn.addEventListener('click',()=> {
      const idx=mysqlListEl.selectedIndex; if(idx<0)return;
      const host=mysqlHostEl.value.trim(), port=parseInt(mysqlPortEl.value,10),
            user=mysqlUserEl.value.trim(), pwd=mysqlPasswordEl.value,
            db=mysqlDatabaseEl.value.trim(), ssl=mysqlSslEl.checked,
            sslCa=mysqlCustomCaEl.checked?mysqlCaPathEl.value.trim():'';
      if(!host){ showToast('Host is required','error');return; }
      if(isNaN(port)||port<1||port>65535){ showToast('Port must be 1–65535','error');return; }
      if(!user){ showToast('User is required','error');return; }
      if(!db){ showToast('Database is required','error');return; }
      const dup=window.cfg.mysqls.findIndex((c,i)=>i!==idx&&c.host===host&&c.port===port&&c.user===user&&c.database===db);
      if(dup>=0){ showToast('A similar connection already exists','error');return; }
      window.cfg.mysqls[idx]={host,port,user,password:pwd,database:db,ssl,sslCaPath:sslCa};
      saveConfig(window.cfg); refreshMySQLList(); showToast('Connection updated','success');
    });
  
    mysqlRemoveBtn.addEventListener('click',async()=> {
      const idx=mysqlListEl.selectedIndex; if(idx<0)return;
      // Confirm removal via modal
      const confirmDel = await showConfirmModal(`Remove connection ${mysqlListEl.options[idx].text}?`);
      if (!confirmDel) return;
      // Remove and update UI
      window.cfg.mysqls.splice(idx,1);
      saveConfig(window.cfg);
      refreshMySQLList();
      mysqlListEl.selectedIndex=-1;
      mysqlHostEl.value=''; mysqlPortEl.value=mysqlPortEl.defaultValue;
      mysqlUserEl.value=''; mysqlPasswordEl.value=''; mysqlDatabaseEl.value='';
      mysqlSslEl.checked=false; mysqlSslOptionsEl.classList.add('hidden');
      mysqlCaSettingsEl.classList.add('hidden'); mysqlCaPathEl.value='';
      mysqlAddBtn.classList.remove('hidden'); mysqlEditBtn.classList.add('hidden');
      mysqlRemoveBtn.disabled=true; mysqlHostEl.focus();
      showToast('Connection removed','success');
    });
  
    mysqlConnectBtn.addEventListener('click',async()=>{
      const host=mysqlHostEl.value.trim(), port=parseInt(mysqlPortEl.value,10),
            user=mysqlUserEl.value.trim(), pwd=mysqlPasswordEl.value,
            db=mysqlDatabaseEl.value.trim(), ssl=mysqlSslEl.checked;
      if(!host){ showToast('Host is required','error');return; }
      if(isNaN(port)||port<1||port>65535){ showToast('Port must be 1–65535','error');return; }
      if(!user){ showToast('User is required','error');return; }
      if(!db){ showToast('Database is required','error');return; }
      mysqlConnectBtn.disabled=true;
      let sslOption=false;
      if(ssl) {
        const caPath=mysqlCaPathEl.value.trim();
        if(caPath) {
          try {
            const fileData=await readFile(caPath);
            const ext=caPath.slice(caPath.lastIndexOf('.')).toLowerCase();
            sslOption = (ext==='.pfx'||ext==='.p12')
              ? {rejectUnauthorized:true,pfx:fileData}
              : {rejectUnauthorized:true,ca:fileData};
          } catch(err){ showToast(`Failed to read CA file: ${err.message}`,'error'); throw err; }
        } else {
          sslOption=true;
        }
      }
      try {
        const agentSettings=await getAgentSettings();
        if(agentSettings.enabled&&window.agentWebSocket){
          if(typeof wsClient.connectToMysql!=='function'){
            await agentReconnect();
            if(typeof wsClient.connectToMysql!=='function')
              throw new Error('MySQL connect not available in agent mode');
          }
          await wsClient.connectToMysql(host,port,user,pwd,db,sslOption);
        } else {
          await mysqlConnect({host,port,user,password:pwd,database:db,ssl:sslOption});
        }
        // Update UI on successful connection
        // Update connection UI message
        mysqlStatusSp.textContent = `Connected to ${host}`;
        mysqlRunBtn.disabled = false;
        mysqlDisconnectBtn.disabled = false;
        mysqlConnectBtn.classList.add('hidden');
        mysqlDisconnectBtn.classList.remove('hidden');
        showToast('MySQL connected','success');
        if (mysqlStatusInd) {
          mysqlStatusInd.classList.remove('bg-gray-400','bg-red-500');
          mysqlStatusInd.classList.add('bg-green-500');
        }
        // Update sidebar database status
        // Update sidebar database status
        const dbSidebarText = document.getElementById('mysql-status-sidebar');
        const dbSidebarInd = document.getElementById('mysql-status-indicator-sidebar');
        if (dbSidebarText) dbSidebarText.textContent = 'Connected';
        if (dbSidebarInd) {
          dbSidebarInd.classList.remove('bg-gray-400','bg-red-500');
          dbSidebarInd.classList.add('bg-green-500');
        }
        mysqlSettingsPanel.classList.add('hidden');
        mysqlToggleIcon.classList.add('rotate-180');
      } catch(err) {
        // Update panel status
        mysqlStatusSp.textContent = 'Error';
        // Determine user-friendly message
        let msg = 'Connection failed';
        const em = err.message;
        if (/Access denied/.test(em)) msg = 'Access denied. Check credentials.';
        else if (/Connection refused/.test(em)) msg = 'Connection refused. Check host/port.';
        else if (/Unknown database/.test(em)) msg = 'Database not found. Check name.';
        else if (/timed out/.test(em)) msg = 'Connection timed out.';
        else if (/SSL/.test(em)) msg = 'SSL error: check certificate.';
        else msg = `Connection failed: ${em.split('\n')[0]}`;
        showToast(msg, 'error');
        console.error('MySQL connect error:', err);
        // Update panel indicator
        if (mysqlStatusInd) {
          mysqlStatusInd.classList.remove('bg-gray-400','bg-green-500');
          mysqlStatusInd.classList.add('bg-red-500');
        }
        // Update sidebar database status
        if (mysqlStatusSidebar) mysqlStatusSidebar.textContent = 'Error';
        if (mysqlStatusIndSidebar) {
          mysqlStatusIndSidebar.classList.remove('bg-gray-400','bg-green-500');
          mysqlStatusIndSidebar.classList.add('bg-red-500');
        }
      } finally { mysqlConnectBtn.disabled = false; }
    });
  
    mysqlDisconnectBtn.addEventListener('click',async()=>{
      try {
        const agentSettings=await getAgentSettings();
        if(agentSettings.enabled&&window.agentWebSocket&&typeof wsClient.disconnectFromMysql==='function'){
          await wsClient.disconnectFromMysql();
        } else {
          await mysqlDisconnect();
        }
      } catch(err){ console.error('[ERROR] MySQL disconnect error:',err); }
      // Update UI on disconnect
      mysqlStatusSp.textContent='Not connected';
      mysqlRunBtn.disabled = true;
      mysqlDisconnectBtn.disabled = true;
      mysqlDisconnectBtn.classList.add('hidden');
      mysqlConnectBtn.classList.remove('hidden');
      if (mysqlStatusInd) {
        mysqlStatusInd.classList.remove('bg-green-500','bg-red-500');
        mysqlStatusInd.classList.add('bg-gray-400');
      }
      // Update sidebar database status
      const dbSidebarText = document.getElementById('mysql-status-sidebar');
      const dbSidebarInd = document.getElementById('mysql-status-indicator-sidebar');
      if (dbSidebarText) dbSidebarText.textContent = 'Not connected';
      if (dbSidebarInd) {
        dbSidebarInd.classList.remove('bg-green-500','bg-red-500');
        dbSidebarInd.classList.add('bg-gray-400');
      }
      showToast('MySQL disconnected','info');
    });
  
    mysqlRunBtn.addEventListener('click',async()=>{
      const sql=mysqlQueryEl.value.trim();
      if(!sql){ showToast('SQL cannot be empty','error');return; }
      const first=sql.split(/\s+/)[0].toUpperCase();
      const ro=['SELECT','SHOW','DESCRIBE','EXPLAIN'];
      if(!ro.includes(first)) if(!confirm(`Statement ${first} may modify DB. Continue?`)) return;
      mysqlRunBtn.disabled=true;
      try {
        const agentSettings=await getAgentSettings();
        let result;
        if(agentSettings.enabled&&window.agentWebSocket){
          if(typeof wsClient.mysqlQuery!=='function'){
            await agentReconnect();
            if(typeof wsClient.mysqlQuery!=='function') throw new Error('MySQL query not available');
          }
          result=await wsClient.mysqlQuery(sql);
        } else {
          result=await mysqlQuery(sql);
        }
        mysqlResultsEl.textContent=typeof result==='object'?JSON.stringify(result,null,2):String(result);
        showToast('Query executed','success');
      } catch(err){ mysqlResultsEl.textContent=''; showToast(`Query failed: ${err.message}`,'error'); console.error('MySQL query error:',err); }
      finally{ mysqlRunBtn.disabled=false; }
    });
  
    refreshMySQLList();

    // Listen for async MySQL connection events from the main process
    if (window.electronAPI?.onMysqlEvent) {
      window.electronAPI.onMysqlEvent((data) => {
        switch (data.type) {
          case 'error':
            showToast(`MySQL connection error: ${data.message}`, 'error');
            break;

          case 'disconnected':
            mysqlStatusSp.textContent = 'Disconnected';
            mysqlRunBtn.disabled = true;
            mysqlDisconnectBtn.disabled = true;
            mysqlDisconnectBtn.classList.add('hidden');
            mysqlConnectBtn.classList.remove('hidden');
            if (mysqlStatusInd) {
              mysqlStatusInd.classList.remove('bg-green-500');
              mysqlStatusInd.classList.add('bg-red-500');
            }
            if (mysqlStatusSidebar) mysqlStatusSidebar.textContent = 'Disconnected';
            if (mysqlStatusIndSidebar) {
              mysqlStatusIndSidebar.classList.remove('bg-green-500');
              mysqlStatusIndSidebar.classList.add('bg-red-500');
            }
            showToast('MySQL connection lost — reconnecting...', 'error');
            break;

          case 'reconnecting':
            mysqlStatusSp.textContent = `Reconnecting (${data.attempt}/${data.max})...`;
            if (mysqlStatusInd) {
              mysqlStatusInd.classList.remove('bg-green-500', 'bg-red-500', 'bg-gray-400');
              mysqlStatusInd.classList.add('bg-amber-500');
            }
            if (mysqlStatusSidebar) mysqlStatusSidebar.textContent = 'Reconnecting...';
            if (mysqlStatusIndSidebar) {
              mysqlStatusIndSidebar.classList.remove('bg-green-500', 'bg-red-500', 'bg-gray-400');
              mysqlStatusIndSidebar.classList.add('bg-amber-500');
            }
            break;

          case 'reconnected':
            mysqlStatusSp.textContent = 'Reconnected';
            mysqlRunBtn.disabled = false;
            mysqlDisconnectBtn.disabled = false;
            mysqlDisconnectBtn.classList.remove('hidden');
            mysqlConnectBtn.classList.add('hidden');
            if (mysqlStatusInd) {
              mysqlStatusInd.classList.remove('bg-red-500', 'bg-amber-500', 'bg-gray-400');
              mysqlStatusInd.classList.add('bg-green-500');
            }
            if (mysqlStatusSidebar) mysqlStatusSidebar.textContent = 'Connected';
            if (mysqlStatusIndSidebar) {
              mysqlStatusIndSidebar.classList.remove('bg-red-500', 'bg-amber-500', 'bg-gray-400');
              mysqlStatusIndSidebar.classList.add('bg-green-500');
            }
            showToast('MySQL reconnected', 'success');
            break;

          case 'reconnect_failed':
            mysqlStatusSp.textContent = 'Connection lost';
            mysqlRunBtn.disabled = true;
            mysqlDisconnectBtn.disabled = true;
            mysqlDisconnectBtn.classList.add('hidden');
            mysqlConnectBtn.classList.remove('hidden');
            if (mysqlStatusInd) {
              mysqlStatusInd.classList.remove('bg-green-500', 'bg-amber-500');
              mysqlStatusInd.classList.add('bg-red-500');
            }
            if (mysqlStatusSidebar) mysqlStatusSidebar.textContent = 'Connection lost';
            if (mysqlStatusIndSidebar) {
              mysqlStatusIndSidebar.classList.remove('bg-green-500', 'bg-amber-500');
              mysqlStatusIndSidebar.classList.add('bg-red-500');
            }
            showToast('MySQL reconnection failed — please reconnect manually', 'error');
            break;
        }
      });
    }
  }
  