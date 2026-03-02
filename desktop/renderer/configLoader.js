// src/renderer/configLoader.js
// ───────────────────────────────────────────────────────────────────────────────
// initConfig IIFE: decrypt+load config
import {
    loadRawConfigMode, loadConfig,
    setEncryptionMode, setCustomPassword
  } from './api.js';
  import { showPasswordModal, showConfirmModal } from './modals.js';
  
  export default async function initConfig() {
    window.cfg = { servers: [], smbShares: [], mysqls: [] };
    try {
      const rawMode = await loadRawConfigMode();
      if (rawMode === 'custom') {
        let attempts = 0;
        while (attempts < 3) {
          try {
            const pw = await showPasswordModal('Enter encryption password to unlock data');
            await setEncryptionMode('custom');
            await setCustomPassword(pw);
            window.cfg = await loadConfig();
            break;
          } catch {
            attempts++;
            if (attempts >= 3) {
              await showConfirmModal('Password incorrect or different host computer detected. The app will now exit.');
              window.close();
              return;
            }
            document.getElementById('password-modal-error').textContent = 'Password incorrect, please try again.';
            document.getElementById('password-modal-error').classList.remove('hidden');
          }
        }
      } else {
        await setEncryptionMode('default');
        await setCustomPassword(null);
        try {
          window.cfg = await loadConfig();
        } catch {
          let attempts = 0;
          while (attempts < 3) {
            try {
            const pw = await showPasswordModal('Default decryption failed. Enter custom password to unlock data');
              await setEncryptionMode('custom');
              await setCustomPassword(pw);
              window.cfg = await loadConfig();
              break;
            } catch {
              attempts++;
            if (attempts >= 3) {
                await showConfirmModal('Password incorrect or different host computer detected. The app will now exit.');
                window.close();
                return;
              }
              document.getElementById('password-modal-error').textContent = 'Password incorrect, please try again.';
              document.getElementById('password-modal-error').classList.remove('hidden');
            }
          }
        }
      }
    } catch (err) {
      console.error('Configuration load failed:', err);
      window.cfg = { servers: [], smbShares: [], mysqls: [] };
    }
    // Reveal UI
    const appEl = document.getElementById('app');
    if (appEl) appEl.classList.remove('hidden');
  };
  