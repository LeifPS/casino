import { TISCHE } from './tische.js';
import { fmt } from './chips.js';
import { Ton } from './ton.js';

export function dom(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const warte = (ms) => new Promise(r => setTimeout(r, ms));

/** Fenster mit Titel, Inhalt (HTML) und Knöpfen. knoepfe: [{ text, art: 'gold'|'leise'|'gefahr', fn: () => (false = offen lassen) }] */
export function dialog({ titel, html, knoepfe, breit }) {
  const s = dom(`<div class="schleier"><div class="dlg${breit ? ' breit' : ''}" role="dialog" aria-modal="true"><h2>${esc(titel || '')}</h2><div class="dlg-k">${html || ''}</div><div class="dlg-u"></div></div></div>`);
  const u = s.querySelector('.dlg-u');
  const zu = () => { s.remove(); document.removeEventListener('keydown', taste); };
  const taste = (e) => { if (e.key === 'Escape') zu(); };
  for (const k of (knoepfe || [{ text: 'Schließen', art: 'leise' }])) {
    const b = dom(`<button type="button" class="knopf ${k.art || 'leise'}">${esc(k.text)}</button>`);
    b.addEventListener('click', () => { if (!k.fn || k.fn() !== false) zu(); });
    u.appendChild(b);
  }
  s.addEventListener('click', (e) => { if (e.target === s) zu(); });
  document.addEventListener('keydown', taste);
  (document.getElementById('app') || document.body).appendChild(s);
  return { zu, el: s };
}
export function bestaetigen(titel, text, jaText = 'Ja') {
  return new Promise(res => dialog({
    titel, html: `<p>${text}</p>`,
    knoepfe: [{ text: 'Abbrechen', art: 'leise', fn: () => res(false) }, { text: jaText, art: 'gefahr', fn: () => res(true) }],
  }));
}

let toastT = 0;
export function hinweis(text) {
  let t = document.getElementById('toast');
  if (!t) { t = dom('<div id="toast" role="status"></div>'); document.getElementById('app').appendChild(t); }
  t.textContent = text; t.classList.add('an'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('an'), 2600);
}

/** Zahl in einem Element weich zählen lassen */
const lauf = new WeakMap();
export function zaehle(elem, nach) {
  const von = Number(elem.dataset.wert ?? nach);
  elem.dataset.wert = nach;
  if (von === nach || matchMedia('(prefers-reduced-motion: reduce)').matches) { elem.textContent = fmt(nach); return; }
  const t0 = performance.now(), dauer = Math.min(900, 250 + Math.abs(nach - von) / 20);
  const id = {}; lauf.set(elem, id);
  const f = (t) => {
    if (lauf.get(elem) !== id) return;
    const p = Math.min(1, (t - t0) / dauer), e = 1 - Math.pow(1 - p, 3);
    elem.textContent = fmt(von + (nach - von) * e);
    if (p < 1) requestAnimationFrame(f); else elem.textContent = fmt(nach);
  };
  requestAnimationFrame(f);
}

/** Tischwahl: Liste der Tische mit Mindest-/Höchsteinsatz und Buy-in */
export function tischWahl(host, { titel, chips, aktuell, info, beiWahl, zeilen, buyin }) {
  host.innerHTML = `<div class="wahl"><div class="wahl-kopf"><h2>${esc(titel)}</h2><p>Wähle einen Tisch. Deine Chips nimmst du mit, sie gelten in allen Spielen.</p></div><div class="wahl-liste"></div></div>`;
  const liste = host.querySelector('.wahl-liste');
  for (const t of TISCHE) {
    const mindest = buyin ? buyin(t) : t.buyin;
    const gehtNicht = chips < mindest;
    const b = dom(`<button type="button" class="tischkarte${t.id === aktuell ? ' aktuell' : ''}" ${gehtNicht ? 'disabled' : ''} style="--filz:${t.filz};--rand:${t.rand}">
      <span class="tk-name">${esc(t.name)}</span>
      ${zeilen ? zeilen(t) : `<span class="tk-zeile">Einsatz <b>${fmt(t.min)}</b> – <b>${fmt(t.max)}</b></span><span class="tk-zeile">Buy-in ab <b>${fmt(t.buyin)}</b></span>`}
      ${info ? `<span class="tk-extra">${esc(info(t))}</span>` : ''}
      ${gehtNicht ? `<span class="tk-sperre">Noch ${fmt(mindest - chips)} Chips</span>` : ''}</button>`);
    b.addEventListener('click', () => { Ton.klick(); beiWahl(t.id); });
    liste.appendChild(b);
  }
  return host;
}
