// src/renderer/uiTabs.js
// ───────────────────────────────────────────────────────────────────────────────
// showTab, showPrimaryTab + wiring
import {
    tabConsoleBtn, tabPlayersBtn, tabServerFunctionsBtn,
    consoleSection, playerSection, serverFunctionsSection,
    tabConnectionBtn, tabActionsBtn, tabStorageBtn,
    tabMysqlBtn, tabSettingsBtn,
    connectionSection, actionsSection, storageSection,
    mysqlSection, settingsSection, actionsWarning,
    disconnectBtn
  } from './domElements.js';
  import { loadBanned, loadBannedIPs } from './refreshers.js';
  import { updatePlayerStats } from './refreshers.js';
  
  export default function initUITabs() {
    function showTab(tab) {
      consoleSection.classList.add('hidden');
      playerSection.classList.add('hidden');
      serverFunctionsSection.classList.add('hidden');
      [tabConsoleBtn, tabPlayersBtn, tabServerFunctionsBtn].forEach(btn => {
        btn.classList.add('text-gray-400','border-transparent');
        btn.classList.remove('text-indigo-400','border-indigo-500');
      });
      if (tab==='console') {
        consoleSection.classList.remove('hidden');
        tabConsoleBtn.classList.add('text-indigo-400','border-indigo-500');
      } else if (tab==='players') {
        playerSection.classList.remove('hidden');
        tabPlayersBtn.classList.add('text-indigo-400','border-indigo-500');
        updatePlayerStats();
      } else {
        serverFunctionsSection.classList.remove('hidden');
        tabServerFunctionsBtn.classList.add('text-indigo-400','border-indigo-500');
        loadBanned(false);
        loadBannedIPs(false);
      }
    }
    [tabConsoleBtn, tabPlayersBtn, tabServerFunctionsBtn].forEach((btn, i) => {
      btn.addEventListener('click', ()=> showTab(['console','players','server-functions'][i]));
    });
    showTab('console');
  
    function showPrimaryTab(tab) {
      [connectionSection,actionsSection,storageSection,mysqlSection,settingsSection].forEach(s=>s.classList.add('hidden'));
      [tabConnectionBtn,tabActionsBtn,tabStorageBtn,tabMysqlBtn,tabSettingsBtn].forEach(b=>{b.classList.remove('bg-indigo-600','text-white');b.classList.add('text-gray-400');});
      if(tab==='connection'){ connectionSection.classList.remove('hidden'); tabConnectionBtn.classList.add('bg-indigo-600','text-white'); }
      if(tab==='actions'){ actionsSection.classList.remove('hidden'); if(disconnectBtn.disabled) actionsWarning.classList.remove('hidden'); else actionsWarning.classList.add('hidden'); tabActionsBtn.classList.add('bg-indigo-600','text-white'); showTab('console'); }
      if(tab==='storage'){ storageSection.classList.remove('hidden'); tabStorageBtn.classList.add('bg-indigo-600','text-white'); }
      if(tab==='mysql'){ mysqlSection.classList.remove('hidden'); tabMysqlBtn.classList.add('bg-indigo-600','text-white'); }
      if(tab==='settings'){ settingsSection.classList.remove('hidden'); tabSettingsBtn.classList.add('bg-indigo-600','text-white'); }
    }
    tabConnectionBtn.addEventListener('click',()=>showPrimaryTab('connection'));
    tabActionsBtn.addEventListener('click',()=>showPrimaryTab('actions'));
    tabStorageBtn.addEventListener('click',()=>showPrimaryTab('storage'));
    tabMysqlBtn.addEventListener('click',()=>showPrimaryTab('mysql'));
    tabSettingsBtn.addEventListener('click',()=>showPrimaryTab('settings'));
    showPrimaryTab('connection');
  }
  