import * as Store from './store.js';
import { chipDefs, chipSvg, CHIPS, fmt, stapelHtml } from './chips.js';
import { Ton } from './ton.js';
import { dom, dialog, bestaetigen, hinweis, zaehle, esc } from './ui.js';
import { kunstBlackjack, kunstPoker, kunstRoulette } from './kunst.js';
import { blackjack } from './blackjack.js';

const SPIELE = [
  { ...blackjack, kunst: kunstBlackjack, zeile: 'Schlage die Bank, ohne über 21 zu kommen.' },
  { id: 'poker', name: 'Texas Hold’em', bereit: false, kunst: kunstPoker, zeile: 'Mit echten Spielern, freie Plätze füllen Computergegner.' },
  { id: 'roulette', name: 'Roulette', bereit: false, kunst: kunstRoulette, zeile: 'Setze auf Zahlen, Farben und Felder.' },
];

const app = document.getElementById('app');
app.innerHTML = chipDefs() + `
  <header class="leiste">
    <button type="button" class="spielwahl" id="spielwahl" aria-haspopup="true"><span id="spielname">Casino</span><i>▾</i></button>
    <div class="konto" aria-label="Guthaben"><span class="konto-chip">${chipSvg(1000)}</span><b id="guthaben">0</b></div>
    <button type="button" class="zahnrad" id="zahnrad" aria-label="Einstellungen"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg></button>
  </header>
  <main id="buehne"></main>`;
const buehne = document.getElementById('buehne');
const guthaben = document.getElementById('guthaben');
zaehle(guthaben, Store.chips());
Store.beiAenderung((c) => zaehle(guthaben, c));

let aktiv = null;   // { id, stop }
function oeffne(id) {
  if (aktiv && aktiv.stop) aktiv.stop();
  aktiv = null; buehne.innerHTML = ''; buehne.className = '';
  const sp = SPIELE.find(s => s.id === id);
  document.getElementById('spielname').textContent = sp && sp.bereit ? sp.name : 'Casino';
  if (!sp || !sp.bereit) { lobby(); aktiv = { id: 'lobby' }; return; }
  const r = sp.start(buehne, { zurLobby: () => oeffne('lobby') });
  aktiv = { id, stop: r && r.stop };
}

function lobby() {
  const laufend = Store.state.bj && Store.state.bj.phase !== 'einsatz' && Store.state.bj.phase !== 'ende';
  buehne.className = 'lobby';
  buehne.innerHTML = `<div class="lobby-kopf"><h1>Casino</h1><p>Alle Spiele teilen sich dieselben Chips.</p></div>
    <div class="lobby-konto">${stapelHtml(Store.chips()) || ''}<div class="lobby-summe"><small>Dein Guthaben</small><b>${fmt(Store.chips())}</b></div></div>
    <div class="lobby-spiele">${SPIELE.map(s => `<button type="button" class="spielkarte${s.bereit ? '' : ' bald'}" data-id="${s.id}"${s.bereit ? '' : ' disabled'}>
      <span class="kunst">${s.kunst()}</span><span class="sk-name">${esc(s.name)}</span><span class="sk-zeile">${esc(s.zeile)}</span>
      ${s.bereit ? (s.id === 'blackjack' && laufend ? '<span class="sk-marke">Runde läuft</span>' : '') : '<span class="sk-marke bald-marke">Bald</span>'}</button>`).join('')}</div>`;
  buehne.querySelectorAll('.spielkarte').forEach(b => b.addEventListener('click', () => { Ton.klick(); oeffne(b.dataset.id); }));
}

// ----- Spielwahl oben -----
document.getElementById('spielwahl').addEventListener('click', (e) => {
  e.stopPropagation();
  const alt = document.getElementById('spielmenue');
  if (alt) { alt.remove(); return; }
  const m = dom(`<div id="spielmenue" role="menu"><button type="button" data-id="lobby" role="menuitem"><b>Lobby</b></button>${SPIELE.map(s => `<button type="button" data-id="${s.id}" role="menuitem"${s.bereit ? '' : ' disabled'}><b>${esc(s.name)}</b>${s.bereit ? '' : '<small>bald</small>'}</button>`).join('')}</div>`);
  m.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b || b.disabled) return; m.remove(); Ton.klick(); oeffne(b.dataset.id); });
  app.appendChild(m);
  setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
});

// ----- Einstellungen -----
document.getElementById('zahnrad').addEventListener('click', einstellungen);
function einstellungen() {
  const s = Store.state.stat.blackjack;
  const d = dialog({
    titel: 'Einstellungen', breit: true,
    html: `<div class="opt"><span>Ton</span><button type="button" class="knopf klein" id="opt-ton" aria-pressed="${Store.tonAn()}">${Store.tonAn() ? 'An' : 'Aus'}</button></div>
      <div class="opt"><span>Spielstand-Code<small>Chips in ein anderes Fenster oder Gerät mitnehmen</small></span><button type="button" class="knopf klein" id="opt-code">Öffnen</button></div>
      <h3>Chipstufen</h3><div class="chipliste">${CHIPS.map(c => `<div class="chipeintrag">${chipSvg(c.w)}<span>${fmt(c.w)}<small>${c.name}</small></span></div>`).join('')}</div>
      <h3>Dein Stand</h3><p class="stand">Höchster Stand: <b>${fmt(Store.state.spitze)}</b> Chips${s ? `<br>Blackjack: ${s.runden} Runden, ${s.siege} gewonnen, bester Gewinn ${fmt(s.bester)}` : ''}</p>
      <div class="opt"><span>Neu anfangen<small>Setzt auf 1.000 Chips zurück und löscht alle Zahlen</small></span><button type="button" class="knopf klein gefahr" id="opt-neu">Zurücksetzen</button></div>`,
  });
  const q = (id) => d.el.querySelector(id);
  q('#opt-ton').addEventListener('click', (e) => { const an = !Store.tonAn(); Store.tonSetzen(an); e.target.setAttribute('aria-pressed', an); e.target.textContent = an ? 'An' : 'Aus'; if (an) Ton.klick(); });
  q('#opt-code').addEventListener('click', () => { if (window.LGH && window.LGH.oeffnen) { d.zu(); window.LGH.oeffnen(); } else hinweis('Der Spielstand-Code ist hier nicht verfügbar.'); });
  q('#opt-neu').addEventListener('click', async () => {
    if (await bestaetigen('Neu anfangen?', 'Dein Guthaben geht auf 1.000 Chips zurück, laufende Runden und Zahlen werden gelöscht. Das lässt sich nicht rückgängig machen.', 'Ja, neu anfangen')) {
      d.zu(); Store.neuAnfangen(); zaehle(guthaben, Store.chips()); oeffne('lobby'); hinweis('Neu gestartet mit 1.000 Chips.');
    }
  });
}

// Start: laufende Runde fortsetzen, sonst Lobby
const b = Store.state.bj;
oeffne(b && b.phase !== 'einsatz' && b.phase !== 'ende' ? 'blackjack' : 'lobby');
if (!Store.speicherGeht()) hinweis('Dieser Browser speichert nichts: Chips gehen beim Schließen verloren.');
