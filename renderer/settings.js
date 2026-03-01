// src/renderer/settings.js
// ───────────────────────────────────────────────────────────────────────────────
// Load and save encryption mode settings in UI

import {
  encDefaultRadio,
  encCustomRadio,
  customPasswordContainer,
  customPasswordInput,
  settingsSaveBtn
} from './domElements.js';
import {
  getEncryptionMode,
  setEncryptionMode,
  setCustomPassword
} from './api.js';
import { showToast } from './toast.js';

// Initialize encryption UI to reflect current config
export default async function initEncryptionSettings() {
  try {
    const mode = await getEncryptionMode();
    if (mode === 'custom') {
      encCustomRadio.checked = true;
      customPasswordContainer.classList.remove('hidden');
    } else {
      encDefaultRadio.checked = true;
      customPasswordContainer.classList.add('hidden');
    }
  } catch (err) {
    console.error('Failed to load encryption mode:', err);
  }
  // Toggle custom password input visibility
  encDefaultRadio.addEventListener('change', () => {
    customPasswordContainer.classList.add('hidden');
  });
  encCustomRadio.addEventListener('change', () => {
    customPasswordContainer.classList.remove('hidden');
    customPasswordInput.focus();
  });
  // Hook into save settings to persist encryption
  settingsSaveBtn.addEventListener('click', async () => {
    const mode = encCustomRadio.checked ? 'custom' : 'default';
    try {
      await setEncryptionMode(mode);
      if (mode === 'custom') {
        const pw = customPasswordInput.value;
        if (!pw) {
          showToast('Encryption password is required', 'error');
          return;
        }
        await setCustomPassword(pw);
      }
    } catch (err) {
      console.error('Failed to save encryption mode:', err);
      showToast(`Failed to save encryption mode: ${err.message}`, 'error');
    }
  });
}