// src/renderer/smb.js
// ───────────────────────────────────────────────────────────────────────────────
// All SMB storage: connect, browse, read/write/edit/delete, upload, find, share management

import {
  smbHostEl, smbShareEl, smbUserEl, smbPassEl,
  smbConnectBtn, smbDisconnectBtn,
  smbStatusSp, smbStatusInd,
  smbStatusSidebar, smbStatusIndSidebar,
  smbBrowser, smbBackBtn, smbCurrentPathSp,
  smbRefreshBtn, smbListEl,
  smbUploadBtn,
  smbEditorContainer, smbEditingFileSp,
  smbEditorEl, smbSaveBtn, smbCloseEditorBtn,
  smbFormatWarningEl,
  smbShareListEl, addSmbShareBtn, editSmbShareBtn, removeSmbShareBtn,
  smbSettingsHeader, smbSettingsPanel, smbToggleIcon,
  smbFindBar, smbFindInput, smbFindPrevBtn, smbFindNextBtn, smbFindCloseBtn
} from './domElements.js';
  
import {
  smbConnect, smbDisconnect, smbReaddir, smbStat,
  smbReadFile, smbWriteFile, smbUnlink,
  getAgentSettings, agentReconnect, ensureSmbConnection,
  openFileDialog, saveFileDialog,
  writeFile, readFile,
  validateYaml,
  saveConfig
} from './api.js';
  
import { showToast, successToast, errorToast } from './toast.js';
import { showConfirmModal } from './modals.js';
  import { stripCodes } from './utils.js';
  import { findInEditor } from './utils.js';
  
let currentPath = '';
// WebSocket client for agent mode SMB
let wsClient = null;
  let originalEditorContent = '';
  
  export default function initSmb() {
    // Refresh share list
    function refreshSmbShareList() {
      smbShareListEl.innerHTML = '';
      window.cfg.smbShares.forEach((sh,idx)=> {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `${sh.host}/${sh.share}`;
        smbShareListEl.appendChild(opt);
      });
      if (window.cfg.smbShares.length>0) {
        smbShareListEl.selectedIndex = 0;
        onSmbShareSelectChange();
      } else {
        smbHostEl.value=''; smbShareEl.value=''; smbUserEl.value=''; smbPassEl.value='';
        editSmbShareBtn.disabled=true; removeSmbShareBtn.disabled=true;
      }
      smbHostEl.disabled = smbShareEl.disabled = smbUserEl.disabled = smbPassEl.disabled = false;
      updateSmbButtons();
    }
  
    function updateSmbButtons() {
      const host = smbHostEl.value.trim(), share = smbShareEl.value.trim();
      const idx = window.cfg.smbShares.findIndex(sh=>sh.host===host&&sh.share===share);
      if (host&&share&&idx>=0) {
        addSmbShareBtn.classList.add('hidden');
        editSmbShareBtn.classList.remove('hidden'); editSmbShareBtn.disabled=false;
        removeSmbShareBtn.disabled=false;
        smbShareListEl.selectedIndex = idx;
      } else {
        editSmbShareBtn.classList.add('hidden');
        addSmbShareBtn.classList.remove('hidden');
        removeSmbShareBtn.disabled=true;
      }
    }
  
    function onSmbShareSelectChange() {
      const idx = smbShareListEl.selectedIndex;
      if (idx<0) return;
      const sh = window.cfg.smbShares[idx];
      smbHostEl.value=sh.host; smbShareEl.value=sh.share;
      smbUserEl.value=sh.username||''; smbPassEl.value=sh.password||'';
      editSmbShareBtn.disabled=false; removeSmbShareBtn.disabled=false;
      updateSmbButtons();
    }
  
    addSmbShareBtn.addEventListener('click', ()=> {
      const host=smbHostEl.value.trim(), share=smbShareEl.value.trim();
      const user=smbUserEl.value.trim(), pw=smbPassEl.value;
      if(!host||!share){ showToast('Host and share required','error');return; }
      const exist=window.cfg.smbShares.findIndex(sh=>sh.host===host&&sh.share===share);
      if(exist>=0){
        window.cfg = { ...window.cfg, smbShares: window.cfg.smbShares.map((sh,i) => i===exist ? {host,share,username:user,password:pw} : sh) };
        saveConfig(window.cfg); refreshSmbShareList(); showToast('SMB share updated','success');
      } else {
        window.cfg = { ...window.cfg, smbShares: [...window.cfg.smbShares, {host,share,username:user,password:pw}] };
        saveConfig(window.cfg); refreshSmbShareList(); showToast('SMB share added','success');
      }
    });
  
    editSmbShareBtn.addEventListener('click', ()=> {
      const idx=smbShareListEl.selectedIndex; if(idx<0)return;
      const host=smbHostEl.value.trim(), share=smbShareEl.value.trim();
      const user=smbUserEl.value.trim(), pw=smbPassEl.value;
      if(!host||!share){ showToast('Host and share required','error');return; }
      const dup=window.cfg.smbShares.findIndex((sh,i)=>i!==idx&&sh.host===host&&sh.share===share);
      if(dup!==-1){ showToast('Another with same host/share exists','error');return; }
      window.cfg = { ...window.cfg, smbShares: window.cfg.smbShares.map((sh,i) => i===idx ? {host,share,username:user,password:pw} : sh) };
      saveConfig(window.cfg); refreshSmbShareList(); showToast('SMB share updated','success');
    });
  
    removeSmbShareBtn.addEventListener('click', ()=> {
      const idx = smbShareListEl.selectedIndex; if(idx<0)return;
      window.cfg = { ...window.cfg, smbShares: window.cfg.smbShares.filter((_,i) => i!==idx) };
      saveConfig(window.cfg);
      refreshSmbShareList();
      smbShareListEl.selectedIndex=-1; smbHostEl.value=''; smbShareEl.value='';
      smbUserEl.value=''; smbPassEl.value='';
      addSmbShareBtn.classList.remove('hidden');
      editSmbShareBtn.classList.add('hidden');
      removeSmbShareBtn.disabled=true;
      smbSettingsPanel.classList.remove('hidden'); smbToggleIcon.classList.remove('rotate-180');
      updateSmbButtons(); smbHostEl.focus();
      showToast('SMB share removed','success');
    });
  
    // Toggle SMB share settings panel
    smbSettingsHeader.addEventListener('click', () => {
      // Toggle SMB settings panel (guard against missing elements)
      if (smbSettingsPanel && smbToggleIcon) {
        smbSettingsPanel.classList.toggle('hidden');
        smbToggleIcon.classList.toggle('rotate-180');
      }
    });
  
    async function loadSmbDirectory() {
      smbRefreshBtn.disabled=true;
      smbListEl.innerHTML='';
      smbCurrentPathSp.textContent=currentPath||'/';
      let agentSettings;
      try { agentSettings = await getAgentSettings(); }
      catch(err){ showToast(`Failed to get agent settings: ${err.message}`,'error'); smbRefreshBtn.disabled=false; return; }
  
      try {
        let items;
        if (agentSettings.enabled) {
          try {
            const conn = await ensureSmbConnection();
            if (!conn.success) throw new Error(`SMB connection: ${conn.reason}`);
            items = await wsClient.smbReaddir(currentPath);
          } catch(agentErr) {
            try {
              await agentReconnect();
              items = wsClient ? await wsClient.smbReaddir(currentPath) : await smbReaddir(currentPath);
            } catch(err) {
              items = await smbReaddir(currentPath);
            }
          }
        } else {
          items = await smbReaddir(currentPath);
        }
  
        for (const item of items) {
          let fileName, fileStats;
          if (typeof item==='object'&&item!==null) {
            fileName=item.name;
            fileStats={isDirectory:item.isDirectory||false, size:item.size||0, modified:item.modified||new Date().toISOString()};
          } else {
            fileName=item;
          }
          const itemPath = currentPath ? `${currentPath}/${fileName}` : fileName;
          let isDir=false;
          try {
            let stats;
            if (fileStats) stats=fileStats;
            else {
            if (agentSettings.enabled) {
                try {
                  stats = await wsClient.smbStat(itemPath);
                } catch(err) {
                  stats = await smbStat(itemPath);
                }
              } else {
                stats = await smbStat(itemPath);
              }
            }
            isDir = stats.isDirectory;
          } catch {}
          const div = document.createElement('div');
          div.className='flex justify-between items-center hover:bg-gray-600 p-1 rounded';
          const nameSpan=document.createElement('span');
          nameSpan.textContent=`${isDir?'[DIR]':'[FILE]'} ${fileName}`;
          nameSpan.className='cursor-pointer flex-1';
          nameSpan.addEventListener('click', async ()=>{
            smbFindBar.classList.add('hidden');
            if (isDir) {
              currentPath=itemPath; await loadSmbDirectory();
            } else {
              // handle file open, auto-save, etc.
              if (smbEditorContainer.classList.contains('hidden')===false && smbEditingFileSp.textContent) {
                if (smbEditorEl.value!==originalEditorContent) {
                  if (confirm(`Save changes to ${smbEditingFileSp.textContent}?`)) {
                    try {
                      if (agentSettings.enabled) {
                        const conn=await ensureSmbConnection();
                        if (!conn.success) throw new Error(`SMB connection: ${conn.reason}`);
                        await wsClient.smbWriteFile(smbEditingFileSp.textContent, smbEditorEl.value);
                      } else {
                        await smbWriteFile(smbEditingFileSp.textContent, smbEditorEl.value);
                      }
                      showToast('File saved','success');
                    } catch(err){ showToast(`Auto-save failed: ${err.message}`,'error'); }
                  }
                }
              }
              try {
                let content;
                if (agentSettings.enabled) {
                  const conn=await ensureSmbConnection();
                  if (!conn.success) throw new Error(`SMB connection: ${conn.reason}`);
                  content = typeof wsClient.smbReadFile==='function'
                    ? await wsClient.smbReadFile(itemPath)
                    : await smbReadFile(itemPath);
                } else {
                  content = await smbReadFile(itemPath);
                }
                smbEditingFileSp.textContent=itemPath;
                smbEditorEl.value=content;
                originalEditorContent=content;
                smbEditorContainer.classList.remove('hidden');
                validateYaml(smbEditorEl.value).then(valid=> {
                  if (valid) smbFormatWarningEl.classList.add('hidden');
                  else smbFormatWarningEl.classList.remove('hidden');
                }).catch(()=> smbFormatWarningEl.classList.remove('hidden'));
              } catch(err){ showToast(`Failed to read file: ${err.message}`,'error'); }
            }
          });
          div.appendChild(nameSpan);
  
          if (!isDir) {
            const ext = fileName.includes('.')?fileName.slice(fileName.lastIndexOf('.')).toLowerCase():'';
            const binaryExts=['.jar','.dll','.exe','.class','.so','.zip','.tar','.gz','.rar','.bin','.dat','.db','.sqlite','.pdf','.png','.jpg','.jpeg','.gif','.bmp','.ico'];
            if (binaryExts.includes(ext)) {
              nameSpan.classList.add('text-purple-400');
              nameSpan.title='Binary file (download only)';
            }
            const dlBtn=document.createElement('button');
            dlBtn.textContent='💾'; dlBtn.className='ml-2 text-blue-400'; dlBtn.title='Download';
            dlBtn.addEventListener('click',async e=>{
              e.stopPropagation();
              try {
                const savePath = await saveFileDialog(fileName);
                if (!savePath) return;
                const fileContent = await smbReadFile(itemPath);
                let dataToWrite = typeof fileContent==='object'&&fileContent.data!==undefined ? fileContent.data : fileContent;
                await writeFile(savePath, dataToWrite);
                showToast(`Downloaded: ${fileName}`,'success');
              } catch(err){ showToast(`Download failed: ${err.message}`,'error'); }
            });
            div.appendChild(dlBtn);
  
            const delBtn=document.createElement('button');
            delBtn.textContent='🗑️'; delBtn.className='ml-2 text-red-500'; delBtn.title='Delete';
            delBtn.addEventListener('click', async e => {
              e.stopPropagation();
              const ok = await showConfirmModal(`Remove file ${fileName}?`);
              if (!ok) return;
              try {
                if (agentSettings.enabled) {
                  const conn=await ensureSmbConnection();
                  if (!conn.success) throw new Error(`SMB connection: ${conn.reason}`);
                  if (typeof wsClient.smbUnlink==='function') await wsClient.smbUnlink(itemPath);
                  else await smbUnlink(itemPath);
                } else {
                  await smbUnlink(itemPath);
                }
                showToast(`Deleted ${fileName}`,'success');
                await loadSmbDirectory();
              } catch(err){ showToast(`Delete failed: ${err.message}`,'error'); }
            });
            div.appendChild(delBtn);
          }
  
          smbListEl.appendChild(div);
        }
      } catch(err) {
        showToast(`Failed to list directory: ${err.message}`,'error');
        console.error(`[ERROR] SMB list directory failed: ${err.message}`);
      } finally {
        smbRefreshBtn.disabled=false;
      }
    }
  
    smbConnectBtn.addEventListener('click',async ()=>{
      const host=smbHostEl.value.trim(), share=smbShareEl.value.trim();
      if(!host||!share){ showToast('Host and share required','error'); return; }
      smbConnectBtn.disabled=true;
      let agentSettings;
      try { agentSettings=await getAgentSettings(); } catch(err){
        showToast(`Failed to get agent settings: ${err.message}`,'error'); smbConnectBtn.disabled=false; return;
      }
      try {
        if (agentSettings.enabled) {
          if (!window.agentWebSocket) throw new Error('WebSocket API not available. Restart app.');
          // Use global WebSocket client for agent mode SMB
          let client = window.wsClient;
          if (!client) {
            client = await window.agentWebSocket.connect(agentSettings.url, agentSettings.apiKey);
            client.setOnDisconnected(() => { smbStatusSp.textContent = 'Disconnected (WebSocket)'; });
            window.wsClient = client;
          }
          await client.connectToSmb(host, share, smbUserEl.value.trim(), smbPassEl.value);
        } else {
          await smbConnect({ host, share, username: smbUserEl.value.trim(), password: smbPassEl.value });
        }
        smbStatusSp.textContent='Connected';
        // Update sidebar storage status
        // Update sidebar storage status
        const sidebarText = document.getElementById('smb-status-sidebar');
        const sidebarInd = document.getElementById('smb-status-indicator-sidebar');
        if (sidebarText) sidebarText.textContent = 'Connected';
        if (sidebarInd) {
          sidebarInd.classList.remove('bg-gray-400','bg-red-500');
          sidebarInd.classList.add('bg-green-500');
        }
        if (smbBrowser) smbBrowser.classList.remove('hidden');
        currentPath=''; await loadSmbDirectory();
        console.log(`[SMB] Connected to \\\\${host}\\${share}`);
        // Keep generic status text for compatibility with upload checks
        // smbStatusSp.textContent = `Connected to ${host}`;
        // Update tab's status indicator if present
        if (smbStatusInd) {
          smbStatusInd.classList.remove('bg-gray-400','bg-red-500');
          smbStatusInd.classList.add('bg-green-500');
        }
        if (agentSettings.enabled) { /* update agent status…*/ }
        if (smbConnectBtn) smbConnectBtn.classList.add('hidden');
        if (smbDisconnectBtn) smbDisconnectBtn.classList.remove('hidden');
        if (smbSettingsPanel) smbSettingsPanel.classList.add('hidden');
        if (smbToggleIcon) smbToggleIcon.classList.add('rotate-180');
      } catch(err) {
        // Notify user of failure
        showToast(`SMB connect failed: ${err.message}`, 'error');
        console.error(`[ERROR] SMB connect failed: ${err.message}`);
        // Update panel status
        smbStatusSp.textContent = 'Error';
        if (smbStatusInd) {
          smbStatusInd.classList.remove('bg-gray-400','bg-green-500');
          smbStatusInd.classList.add('bg-red-500');
        }
        // Update sidebar storage status
        if (smbStatusSidebar) smbStatusSidebar.textContent = 'Error';
        if (smbStatusIndSidebar) {
          smbStatusIndSidebar.classList.remove('bg-gray-400','bg-green-500');
          smbStatusIndSidebar.classList.add('bg-red-500');
        }
      } finally { smbConnectBtn.disabled=false; }
    });
  
    smbDisconnectBtn.addEventListener('click',async ()=>{
      try {
        const agentSettings = await getAgentSettings();
        if (agentSettings.enabled && wsClient && typeof wsClient.disconnectFromSmb==='function') {
          await wsClient.disconnectFromSmb();
        } else {
          await smbDisconnect();
        }
      } catch(err){ console.error('[ERROR] Error disconnecting from SMB:',err.message); }
      if (smbBrowser) smbBrowser.classList.add('hidden');
      if (smbEditorContainer) smbEditorContainer.classList.add('hidden');
      // Update main SMB status
      smbStatusSp.textContent = 'Not connected';
      console.log('[SMB] Disconnected');
      // Toggle Connect/Disconnect buttons
      if (smbDisconnectBtn) smbDisconnectBtn.classList.add('hidden');
      if (smbConnectBtn) smbConnectBtn.classList.remove('hidden');
      // Update sidebar storage status
      // Update sidebar storage status
      const sidebarText = document.getElementById('smb-status-sidebar');
      const sidebarInd = document.getElementById('smb-status-indicator-sidebar');
      if (sidebarText) sidebarText.textContent = 'Not connected';
      if (sidebarInd) {
        sidebarInd.classList.remove('bg-green-500','bg-red-500');
        sidebarInd.classList.add('bg-gray-400');
      }
      // Update tab's local status indicator if present
      if (smbStatusInd) {
        smbStatusInd.classList.remove('bg-green-500','bg-red-500');
        smbStatusInd.classList.add('bg-gray-400');
      }
      if (smbSettingsPanel) smbSettingsPanel.classList.remove('hidden');
      if (smbToggleIcon) smbToggleIcon.classList.remove('rotate-180');
    });
  
    smbBackBtn.addEventListener('click',async ()=> {
      if (!currentPath) return;
      const idx=currentPath.lastIndexOf('/');
      currentPath=idx>=0?currentPath.substring(0,idx):'';
      await loadSmbDirectory();
    });
  
    smbRefreshBtn.addEventListener('click', ()=> loadSmbDirectory());
  
    smbUploadBtn.addEventListener('click',async ()=> {
      if (smbStatusSp.textContent!=='Connected') { showToast('Not connected','error'); return; }
      const filePaths = await openFileDialog();
      if (!filePaths||!filePaths.length) return;
      for (const localPath of filePaths) {
        const name = localPath.split(/[\\/]/).pop();
        const dest = currentPath?`${currentPath}/${name}`:name;
        try {
          let data = await readFile(localPath);
          if (typeof data!=='string') data = data.toString('utf8');
          const agentSettings = await getAgentSettings();
          if (agentSettings.enabled) {
            const conn=await ensureSmbConnection();
            if (!conn.success) throw new Error(`SMB connection: ${conn.reason}`);
            await wsClient.smbWriteFile(dest,data);
          } else {
            await smbWriteFile(dest,data);
          }
          showToast(`Uploaded: ${name}`,'success');
        } catch(err){ showToast(`Upload failed: ${err.message}`,'error'); }
      }
      await loadSmbDirectory();
    });
  
    smbSaveBtn.addEventListener('click',async ()=>{
      const filePath=smbEditingFileSp.textContent, content=smbEditorEl.value;
      try {
        const agentSettings=await getAgentSettings();
        if (agentSettings.enabled) {
          const conn=await ensureSmbConnection();
          if (!conn.success) throw new Error(`SMB connection: ${conn.reason}`);
          if (typeof wsClient.smbWriteFile==='function') await wsClient.smbWriteFile(filePath,content);
          else await smbWriteFile(filePath,content);
        } else {
          await smbWriteFile(filePath,content);
        }
        showToast('File saved','success');
        originalEditorContent = content;
        smbEditorContainer.classList.add('hidden');
        await loadSmbDirectory();
      } catch(err){ showToast(`Save failed: ${err.message}`,'error'); }
    });
  
    smbCloseEditorBtn.addEventListener('click',()=> {
      smbEditorContainer.classList.add('hidden');
    });
  
    // Find bar logic
    smbFindInput.addEventListener('keydown', e => {
      if (e.key==='Enter') { e.preventDefault(); findInEditor(!e.shiftKey); }
      else if (e.key==='Escape'){ smbFindBar.classList.add('hidden'); smbEditorEl.focus(); }
    });
    smbFindNextBtn.addEventListener('click',()=> findInEditor(true));
    smbFindPrevBtn.addEventListener('click',()=> findInEditor(false));
    smbFindCloseBtn.addEventListener('click',()=>{ smbFindBar.classList.add('hidden'); smbEditorEl.focus(); });
  
    smbEditorEl.addEventListener('keydown', e => {
      if ((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f') {
        e.preventDefault(); smbFindBar.classList.remove('hidden'); smbFindInput.focus();
      } else if (e.key==='Escape'&&!smbFindBar.classList.contains('hidden')) {
        smbFindBar.classList.add('hidden'); smbEditorEl.focus();
      }
    });
  
    refreshSmbShareList();
  }
  