// src/renderer/errorHandlers.js
// ───────────────────────────────────────────────────────────────────────────────
// Global error & unhandledrejection handlers
// Shows a dismissible overlay instead of destroying the entire UI

function showErrorOverlay(msg) {
  // Remove any existing error overlay
  const existing = document.getElementById('error-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'error-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;padding:2rem;';

  const container = document.createElement('div');
  container.style.cssText = 'background:#1a1a2e;border:1px solid #e74c3c;border-radius:8px;max-width:80%;max-height:80%;overflow:auto;padding:1.5rem;position:relative;';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Dismiss';
  closeBtn.style.cssText = 'position:absolute;top:0.5rem;right:0.5rem;background:#e74c3c;color:white;border:none;border-radius:4px;padding:0.25rem 0.75rem;cursor:pointer;font-size:0.875rem;';
  closeBtn.addEventListener('click', () => overlay.remove());

  const pre = document.createElement('pre');
  pre.style.cssText = 'color:#e74c3c;white-space:pre-wrap;margin:0;margin-top:1.5rem;font-size:0.8rem;';
  pre.textContent = msg;

  container.appendChild(closeBtn);
  container.appendChild(pre);
  overlay.appendChild(container);
  document.body.appendChild(overlay);
}

export default function initErrorHandlers() {
  window.addEventListener('error', event => {
    console.error('Renderer error:', event.error);
    const msg = event.error?.stack || event.message;
    showErrorOverlay(msg);
  });
  window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled promise rejection:', event.reason);
    const msg = event.reason?.stack || event.reason;
    showErrorOverlay(msg);
  });
}
