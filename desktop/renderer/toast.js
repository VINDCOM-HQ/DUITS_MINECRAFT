// src/renderer/toast.js
// ───────────────────────────────────────────────────────────────────────────────
// showToast, errorToast, successToast
export default function initToast() {
    // nothing to init: functions are global helpers
  }
  export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.textContent = message;
    let bgClass = 'bg-gray-500', duration = 3000;
    if (type === 'success') bgClass = 'bg-green-500';
    else if (type === 'error') { bgClass = 'bg-red-500'; duration = 5000; }
    toast.className = `text-white px-4 py-2 rounded shadow ${bgClass}`;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }
  export function errorToast(msg) { showToast(msg, 'error'); }
  export function successToast(msg) { showToast(msg, 'success'); }
  