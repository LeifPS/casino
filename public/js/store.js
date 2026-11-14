// Gemeinsames Chipkonto und Einstellungen. Alles in einem localStorage-Schlüssel (Spielstand-Code des Hubs sichert ihn mit).
export const START_CHIPS = 1000;
const KEY = 'casino.v1';

function leer() {
  return { v: 1, chips: START_CHIPS, erstellt: Date.now(), spitze: START_CHIPS, ton: true, stat: {}, bj: null, tischBj: 0 };
}
function ganz(x, std) { x = Math.floor(Number(x)); return Number.isFinite(x) && x >= 0 && x < 1e15 ? x : std; }

function bereinige(o) {
  const b = leer();
  b.chips = ganz(o.chips, START_CHIPS);
  b.spitze = Math.max(ganz(o.spitze, b.chips), b.chips);
  b.erstellt = ganz(o.erstellt, b.erstellt);
  b.ton = o.ton !== false;
  b.stat = o.stat && typeof o.stat === 'object' ? o.stat : {};
  b.bj = o.bj && typeof o.bj === 'object' && Array.isArray(o.bj.schuh) ? o.bj : null;
  b.tischBj = ganz(o.tischBj, 0);
  for (const k of Object.keys(o)) if (!(k in b)) b[k] = o[k];   // Felder späterer Spiele nicht verlieren
  return b;
}

let speicherOk = true;
function lade() {
  try {
    const t = localStorage.getItem(KEY);
    if (t) { const o = JSON.parse(t); if (o && typeof o === 'object') return bereinige(o); }
  } catch (e) { speicherOk = false; }
  return leer();
}

export const state = lade();
const hoerer = new Set();

export function speichern() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { speicherOk = false; }
}
export function speicherGeht() { return speicherOk; }
function melden() { for (const f of hoerer) { try { f(state.chips); } catch (e) { } } }
export function beiAenderung(f) { hoerer.add(f); return () => hoerer.delete(f); }

export const chips = () => state.chips;
export function nehmen(n) {
  n = Math.floor(n);
  if (!(n >= 0) || n > state.chips) return false;
  state.chips -= n; melden(); return true;
}
export function gutschreiben(n) {
  n = Math.floor(n);
  if (!(n > 0)) return;
  state.chips += n;
  if (state.chips > state.spitze) state.spitze = state.chips;
  melden();
}
export function statistik(spiel, runden, netto) {
  const s = state.stat[spiel] || (state.stat[spiel] = { runden: 0, siege: 0, bester: 0 });
  s.runden += 1;
  if (netto > 0) { s.siege += 1; if (netto > s.bester) s.bester = netto; }
}
export function neuAnfangen() {
  const n = leer();
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, n);
  speichern(); melden();
}
export function tonAn() { return state.ton; }
export function tonSetzen(an) { state.ton = !!an; speichern(); }

addEventListener('pagehide', speichern);
document.addEventListener('visibilitychange', () => { if (document.hidden) speichern(); });
