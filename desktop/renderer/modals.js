// src/renderer/modals.js
// ───────────────────────────────────────────────────────────────────────────────
// showPasswordModal & showConfirmModal
// Default initializer (no-op) for modals
export default function initModals() {
  // No initialization required; use showPasswordModal and showConfirmModal directly
}
export function showPasswordModal(message) {
    const pwdModal    = document.getElementById('password-modal');
    const pwdTitle    = document.getElementById('password-modal-title');
    const pwdInput    = document.getElementById('password-modal-input');
    const pwdOk       = document.getElementById('password-modal-ok');
    const pwdCancel   = document.getElementById('password-modal-cancel');
    const pwdError    = document.getElementById('password-modal-error');
    return new Promise((resolve, reject) => {
      pwdTitle.textContent = message;
      pwdInput.value = '';
      pwdError.classList.add('hidden');
      pwdModal.classList.remove('hidden');
      pwdInput.focus();
      function cleanup() {
        pwdOk.removeEventListener('click', onOk);
        pwdCancel.removeEventListener('click', onCancel);
        pwdInput.removeEventListener('keydown', onKeydown);
      }
      function onOk() {
        const val = pwdInput.value;
        if (!val) {
          pwdError.textContent = 'Password cannot be empty';
          pwdError.classList.remove('hidden');
          return;
        }
        cleanup();
        pwdModal.classList.add('hidden');
        resolve(val);
      }
      function onCancel() {
        cleanup();
        pwdModal.classList.add('hidden');
        reject(new Error('cancelled'));
      }
      function onKeydown(e) { if (e.key === 'Enter') onOk(); }
      pwdOk.addEventListener('click', onOk);
      pwdCancel.addEventListener('click', onCancel);
      pwdInput.addEventListener('keydown', onKeydown);
    });
  }

  export function showConfirmModal(message) {
    const confirmModal    = document.getElementById('confirm-modal');
    const confirmTitle    = document.getElementById('confirm-modal-title');
    const confirmOk       = document.getElementById('confirm-modal-ok');
    const confirmCancel   = document.getElementById('confirm-modal-cancel');
    return new Promise(resolve => {
      confirmTitle.textContent = message;
      confirmModal.classList.remove('hidden');
      function cleanup() {
        confirmOk.removeEventListener('click', onOk);
        confirmCancel.removeEventListener('click', onCancel);
      }
      function onOk() {
        cleanup();
        confirmModal.classList.add('hidden');
        resolve(true);
      }
      function onCancel() {
        cleanup();
        confirmModal.classList.add('hidden');
        resolve(false);
      }
      confirmOk.addEventListener('click', onOk);
      confirmCancel.addEventListener('click', onCancel);
    });
  }
