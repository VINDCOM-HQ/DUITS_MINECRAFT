// src/renderer/utils.js
// ───────────────────────────────────────────────────────────────────────────────
// stripCodes, escapeHtml, formatQueryResult, findInEditor
import { smbFindInput, smbEditorEl } from './domElements.js';
import { showToast } from './toast.js';

export function stripCodes(line) {
    if (typeof line !== 'string') return '';
    return line.replace(/§[0-9A-FK-OR]/gi, '');
  }
  export function escapeHtml(unsafe) {
    const str = unsafe == null ? '' : String(unsafe);
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
  }
  export function formatQueryResult(info, mode) {
    const players = info.players || {};
    let html = '<div class="space-y-2 font-mono text-sm"><dl class="grid grid-cols-2 gap-x-4">';
    if (info.queryHost && info.queryPort) {
      html += `<dt class="font-semibold">Queried:</dt><dd>${escapeHtml(info.queryHost)}:${escapeHtml(info.queryPort.toString())}</dd>`;
    }
    if (info.hostIp && info.hostPort) {
      html += `<dt class="font-semibold">Reported:</dt><dd>${escapeHtml(info.hostIp)}:${escapeHtml(info.hostPort.toString())}</dd>`;
    }
    html += `<dt class="font-semibold">MOTD:</dt><dd>${escapeHtml(info.motd||'')}</dd>`;
    if (mode==='full'&&info.version) {
      html+=`<dt class="font-semibold">Version:</dt><dd>${escapeHtml(info.version)}</dd>`;
      html+=`<dt class="font-semibold">Software:</dt><dd>${escapeHtml(info.software)}</dd>`;
      html+=`<dt class="font-semibold">Plugins:</dt><dd>${escapeHtml((info.plugins||[]).join(', '))}</dd>`;
      html+=`<dt class="font-semibold">Map:</dt><dd>${escapeHtml(info.map)}</dd>`;
      html+=`<dt class="font-semibold">Players:</dt><dd>${players.online??''}/${players.max??''}</dd>`;
      html+=`<dt class="font-semibold">Player List:</dt><dd>${escapeHtml((players.list||[]).join(', '))}</dd>`;
    } else {
      html+=`<dt class="font-semibold">Game Type:</dt><dd>${escapeHtml(info.gameType||'')}</dd>`;
      html+=`<dt class="font-semibold">Map:</dt><dd>${escapeHtml(info.map)}</dd>`;
      html+=`<dt class="font-semibold">Players:</dt><dd>${players.online??''}/${players.max??''}</dd>`;
    }
    return html + '</dl></div>';
  }
  export function findInEditor(forward=true) {
    const term = smbFindInput.value; if (!term) return;
    const content = smbEditorEl.value;
    const lower = content.toLowerCase(), tL = term.toLowerCase();
    let idx;
    if (forward) {
      idx = lower.indexOf(tL, smbEditorEl.selectionEnd);
      if (idx<0) idx = lower.indexOf(tL);
    } else {
      idx = lower.lastIndexOf(tL, smbEditorEl.selectionStart - term.length - 1);
      if (idx<0) idx = lower.lastIndexOf(tL);
    }
    if (idx<0) {
      showToast('No matches found','error');
      return;
    }
    smbEditorEl.focus();
    smbEditorEl.setSelectionRange(idx, idx+term.length);
    const total = content.length;
    const scrollable = smbEditorEl.scrollHeight - smbEditorEl.clientHeight;
    smbEditorEl.scrollTop = (idx/total)*scrollable;
  }
