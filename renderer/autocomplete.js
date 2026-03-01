// src/renderer/autocomplete.js
// ───────────────────────────────────────────────────────────────────────────────
// Command autocomplete logic
import { cmdEl, toggleBtn, acEl } from './domElements.js';
import { stripCodes } from './utils.js';

let allCommands = [];

export default async function initAutocomplete(client, log) {
  // load all commands via /help pages
  const first = await client.command('help');
  if (!first.success) { console.warn('Failed to get help'); return; }
  const total = parseInt(stripCodes(first.result).match(/Help: Index\s*\(1\/(\d+)\)/)?.[1]||'1',10);
  const cmds = new Set();
  for (let i=1;i<=total;i++){
    const r = await client.command(i===1?'help':`help ${i}`);
    if (!r.success) continue;
    stripCodes(r.result).split('\n').forEach(line=>{
      if (/^[-\s]*Help: Index/.test(line)) return;
      if (/^Use \/help/.test(line)) return;
      line.split('/').slice(1).forEach(seg=>{
        const cmd = seg.trim().split(/[\s(<:]/)[0];
        if (/^[A-Za-z][\w-]*$/.test(cmd)) cmds.add(cmd);
      });
    });
  }
  allCommands = Array.from(cmds).sort();
  log(`[+] Loaded ${allCommands.length} commands into autocomplete`);

  function show(prefix) {
    acEl.innerHTML=''; let idx=-1;
    const norm = prefix.replace(/^\//,'').toLowerCase();
    const matches = allCommands.filter(c=>c.toLowerCase().startsWith(norm));
    if (!matches.length) return acEl.classList.add('hidden');
    matches.forEach(c=>{
      const d = document.createElement('div');
      d.textContent = c;
      d.className = 'px-3 py-1 hover:bg-gray-600 cursor-pointer';
      d.addEventListener('click', ()=>{
        cmdEl.value = c; acEl.classList.add('hidden'); cmdEl.focus();
      });
      acEl.appendChild(d);
    });
    acEl.classList.remove('hidden');
  }

  toggleBtn.addEventListener('click',()=>{
    acEl.classList.contains('hidden')? show(cmdEl.value.trim()) : acEl.classList.add('hidden');
  });
  document.addEventListener('click',e=>{
    if (!acEl.contains(e.target) && e.target!==cmdEl && e.target!==toggleBtn)
      acEl.classList.add('hidden');
  });
  cmdEl.addEventListener('input',()=>show(cmdEl.value.trim()));
  cmdEl.addEventListener('keydown',e=>{
    const items = Array.from(acEl.children);
    if (e.key==='ArrowDown' && items.length&&!acEl.classList.contains('hidden')) {
      e.preventDefault();
      idx = idx<items.length-1?idx+1:0;
      items.forEach(it=>it.classList.remove('bg-gray-600','text-white'));
      items[idx].classList.add('bg-gray-600','text-white');
      items[idx].scrollIntoView({block:'nearest'});
    } else if (e.key==='ArrowUp'&&items.length&&!acEl.classList.contains('hidden')) {
      e.preventDefault();
      idx = idx>0?idx-1:items.length-1;
      items.forEach(it=>it.classList.remove('bg-gray-600','text-white'));
      items[idx].classList.add('bg-gray-600','text-white');
      items[idx].scrollIntoView({block:'nearest'});
    } else if (e.key==='Enter') {
      if (items.length&&!acEl.classList.contains('hidden')&&idx>=0) {
        e.preventDefault();
        cmdEl.value = items[idx].textContent;
        acEl.classList.add('hidden');
      } else {
        e.preventDefault();
        document.getElementById('sendBtn').click();
      }
    }
  });
}
