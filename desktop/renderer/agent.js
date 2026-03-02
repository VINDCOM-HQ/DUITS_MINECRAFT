// src/renderer/agent.js
// ───────────────────────────────────────────────────────────────────────────────
// Agent settings UI: load, save, updateAgentStatus, stopAgentStatusCheck, startAgentStatusCheck

import {
    agentEnabledEl, agentSettingsContainer, agentUrlEl,
    agentUseSslEl, agentSslOptionsEl, agentCustomCaEl,
    agentCaContainerEl, agentCaFileEl, agentCaFileBtnEl,
    agentApiKeyEl, settingsSaveBtn, tabSettingsBtn
  } from './domElements.js';
  
import {
    getAgentSettings, setAgentSettings,
    openCaFileDialog, agentReconnect
} from './api.js';
import {
    updateAgentStatus, stopAgentStatusCheck, startAgentStatusCheck
} from './agentStatus.js';
  
  import { showToast } from './toast.js';
  
  export default function initAgentSettings() {
    async function loadAgentSettings() {
      try {
        const settings = await getAgentSettings();
        let url=settings.url||'', protocol='ws';
        if (/^(wss?:\/\/)/.test(url)) {
          protocol = url.startsWith('wss://')?'wss':'ws';
          url = url.split('://')[1];
        }
        agentEnabledEl.checked = settings.enabled;
        agentUrlEl.value      = url;
        agentUseSslEl.checked = settings.useSSL;
        agentSettingsContainer.classList.toggle('hidden', !settings.enabled);
        agentSslOptionsEl.classList.toggle('hidden', !agentUseSslEl.checked);
        agentCustomCaEl.checked = !!settings.caFile;
        agentCaContainerEl.classList.toggle('hidden', !agentCustomCaEl.checked);
        agentCaFileEl.value     = settings.caFile||'';
        agentApiKeyEl.value     = settings.apiKey||'';
        if (settings.enabled) {
          await updateAgentStatus();
        }
      } catch(err){ console.error('Failed to load agent settings:',err); showToast('Failed to load agent settings','error'); }
    }
  
    agentEnabledEl.addEventListener('change', ()=> {
      agentSettingsContainer.classList.toggle('hidden', !agentEnabledEl.checked);
    });
    agentUseSslEl.addEventListener('change', ()=> {
      agentSslOptionsEl.classList.toggle('hidden', !agentUseSslEl.checked);
      if (!agentUseSslEl.checked) {
        agentCustomCaEl.checked=false;
        agentCaContainerEl.classList.add('hidden');
      }
    });
    agentCustomCaEl.addEventListener('change', ()=> {
      agentCaContainerEl.classList.toggle('hidden', !agentCustomCaEl.checked);
      if (!agentCustomCaEl.checked) agentCaFileEl.value = '';
    });
    agentCaFileBtnEl.addEventListener('click',async ()=> {
      try {
        const filePath = await openCaFileDialog();
        if (filePath) agentCaFileEl.value = filePath;
      } catch(err){ showToast(`Failed to select CA file: ${err.message}`,'error'); }
    });
  
    settingsSaveBtn.addEventListener('click', async ()=> {
      let rawUrl = agentUrlEl.value.trim();
      if (/^(https?|wss?):\/\//.test(rawUrl)) rawUrl = rawUrl.split('://')[1];
      const fullUrl = (agentUseSslEl.checked?'wss':'ws') + '://' + rawUrl;
      const newSettings = {
        enabled: agentEnabledEl.checked,
        url: fullUrl,
        useSSL: agentUseSslEl.checked,
        caFile: agentCustomCaEl.checked?agentCaFileEl.value.trim():'',
        apiKey: agentApiKeyEl.value.trim()
      };
      if (newSettings.enabled) {
        if (!rawUrl) { showToast('Agent URL is required','error'); return; }
        if (agentCustomCaEl.checked && !newSettings.caFile) { showToast('Custom CA file required','error'); return; }
        if (!newSettings.apiKey) { showToast('API Key is required','error'); return; }
      }
      try {
        const current = await getAgentSettings();
        const stateChanged = current.enabled !== newSettings.enabled;
        const settingsChanged = stateChanged || current.url!==newSettings.url||
                                current.apiKey!==newSettings.apiKey||
                                current.useSSL!==newSettings.useSSL||
                                current.caFile!==newSettings.caFile;
        if (settingsChanged) {
          showToast('Agent settings saved – disconnecting active connections…','info');
          // If enabling agent, reconnect; if disabling, do not attempt reconnect
          if (newSettings.enabled) {
            await agentReconnect(); // ensure the agent itself is restarted
          }
        }
        await setAgentSettings(newSettings);
        showToast('Agent settings saved','success');
        stopAgentStatusCheck();
        if (newSettings.enabled) {
          await updateAgentStatus();
          startAgentStatusCheck();
        } else {
          document.getElementById('agent-status-container').classList.add('hidden');
        }
      } catch(err){ console.error('Failed to save agent settings:',err); showToast(`Failed to save agent settings: ${err.message}`,'error'); }
    });
  
    tabSettingsBtn.addEventListener('click', loadAgentSettings);
    loadAgentSettings();
  }
  