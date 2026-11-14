// Texas Hold’em (No Limit, 6 Plätze): Regeln, Tischverwaltung und Computergegner. Ohne Netzwerk und Oberfläche, damit alles mit Node testbar ist.
// Karten wie im Blackjack: 0..51, Rang = c % 13 (0 = Ass), Farbe = floor(c / 13).

import { STUFEN } from '../public/js/poker-stufen.js';
export { STUFEN };
export const PLAETZE = 6;
export const FRIST_MS = 30000;            // Bedenkzeit für Menschen
export const GETRENNT_MS = 90000;         // so lange wird der Platz eines getrennten Spielers gehalten
export const PAUSE_SHOWDOWN_MS = 6500, PAUSE_FOLD_MS = 3200;

export const umwelt = { jetzt: () => Date.now(), rnd: zufall };
export function zufall(n) {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const grenze = Math.floor(0x100000000 / n) * n, a = new Uint32Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= grenze);
    return a[0] % n;
  }
  return Math.floor(Math.random() * n);
}

// ---------- Handbewertung ----------
const wert = (c) => { const r = c % 13; return r === 0 ? 14 : r + 1; };
const B = 15 ** 5;
function strasse(pres) {
  for (let h = 14; h >= 5; h--) {
    let ok = true;
    for (let k = 0; k < 5; k++) { const v = h - k, i = v === 1 ? 14 : v; if (!pres[i]) { ok = false; break; } }
    if (ok) return h;
  }
  return 0;
}
const pack = (kat, ...k) => { let s = kat; for (let i = 0; i < 5; i++) s = s * 15 + (k[i] || 0); return s; };
/** Beste Fünf-Karten-Hand aus 5 bis 7 Karten als Zahl (größer = besser). */
export function bewerte(karten) {
  const cnt = new Array(15).fill(0), fs = [[], [], [], []];
  for (const c of karten) { const v = wert(c); cnt[v]++; fs[Math.floor(c / 13)].push(v); }
  let fl = -1; for (let f = 0; f < 4; f++) if (fs[f].length >= 5) fl = f;
  if (fl >= 0) {
    const pres = new Array(15).fill(0); fs[fl].forEach(v => pres[v] = 1);
    const sf = strasse(pres); if (sf) return pack(8, sf);
  }
  const vier = [], drei = [], zwei = [];
  for (let v = 14; v >= 2; v--) { if (cnt[v] === 4) vier.push(v); else if (cnt[v] === 3) drei.push(v); else if (cnt[v] === 2) zwei.push(v); }
  const hoch = (ausser) => { const r = []; for (let v = 14; v >= 2; v--) if (cnt[v] && !ausser.includes(v)) r.push(v); return r; };
  if (vier.length) return pack(7, vier[0], hoch([vier[0]])[0]);
  if (drei.length && (drei.length > 1 || zwei.length)) { const p = drei.length > 1 ? drei[1] : zwei[0]; return pack(6, drei[0], p); }
  if (fl >= 0) { const top = fs[fl].sort((a, b) => b - a).slice(0, 5); return pack(5, ...top); }
  const pres = cnt.map(n => (n ? 1 : 0)); const st = strasse(pres); if (st) return pack(4, st);
  if (drei.length) { const k = hoch([drei[0]]); return pack(3, drei[0], k[0], k[1]); }
  if (zwei.length >= 2) { const k = hoch([zwei[0], zwei[1]]); return pack(2, zwei[0], zwei[1], k[0]); }
  if (zwei.length === 1) { const k = hoch([zwei[0]]); return pack(1, zwei[0], k[0], k[1], k[2]); }
  return pack(0, ...hoch([]).slice(0, 5));
}
export const handKategorie = (score) => Math.floor(score / B);
const NAMEN = ['Hohe Karte', 'Ein Paar', 'Zwei Paare', 'Drilling', 'Straße', 'Flush', 'Full House', 'Vierling', 'Straight Flush'];
export function handName(score) {
  const k = handKategorie(score);
  if (k === 8 && Math.floor(score / 15 ** 4) % 15 === 14) return 'Royal Flush';
  return NAMEN[k];
}

/** Gewinnchance gegen zufällige Gegnerhände (Monte Carlo) */
export function gewinnchance(hole, board, gegner, sims, rnd = umwelt.rnd) {
  const bekannt = new Set([...hole, ...board]); const rest = [];
  for (let c = 0; c < 52; c++) if (!bekannt.has(c)) rest.push(c);
  let punkte = 0;
  const braucht = 5 - board.length + gegner * 2;
  for (let i = 0; i < sims; i++) {
    for (let k = 0; k < braucht; k++) { const j = k + rnd(rest.length - k); const t = rest[k]; rest[k] = rest[j]; rest[j] = t; }
    const tafel = board.concat(rest.slice(0, 5 - board.length));
    const meine = bewerte(hole.concat(tafel));
    let beste = -1, gleich = 0;
    for (let g = 0; g < gegner; g++) {
      const o = 5 - board.length + g * 2, s = bewerte([rest[o], rest[o + 1], ...tafel]);
      if (s > beste) { beste = s; gleich = 1; } else if (s === beste) gleich++;
    }
    if (meine > beste) punkte += 1; else if (meine === beste) punkte += 1 / (gleich + 1);
  }
  return punkte / sims;
}

// ---------- Tisch ----------
export function neuerTisch(stufe) {
  return {
    stufe, sitze: new Array(PLAETZE).fill(null), button: -1, phase: 'warten', board: [], deck: [], handNr: 0,
    hoechster: 0, letzterRaise: 0, aktuell: -1, ergebnis: null, log: [], logNr: 0, wartend: [], ausgang: [],
    faellig: 0, frist: 0, botBis: 0, zwischenBis: 0,
  };
}
const blinds = (st) => STUFEN[st.stufe];
const sitz = (st, i) => st.sitze[i];
export const menschen = (st) => st.sitze.filter(s => s && !s.bot && !s.weg);
export const potSumme = (st) => st.sitze.reduce((a, s) => a + (s ? s.gesamt : 0), 0);
function logge(st, i, a, betrag) { st.log.push({ nr: ++st.logNr, sitz: i, a, betrag: betrag || 0 }); if (st.log.length > 14) st.log.shift(); }

const BOT_NAMEN = ['Kasimir', 'Luna', 'Henri', 'Mia', 'Otto', 'Zoe', 'Fritz', 'Lotte', 'Bruno', 'Emma', 'Anton', 'Nele', 'Ida', 'Karl', 'Frieda', 'Emil'];
function botStack(st, rnd) {
  const b = blinds(st), schritte = Math.floor((b.maxBuy - b.minBuy) / b.bb);
  return b.minBuy + b.bb * rnd(schritte + 1);
}
function neuerBot(st, rnd) {
  const benutzt = new Set(st.sitze.filter(Boolean).map(s => s.name));
  let name; do { name = BOT_NAMEN[rnd(BOT_NAMEN.length)]; } while (benutzt.has(name) && benutzt.size < BOT_NAMEN.length);
  return { id: 'bot-' + Math.random().toString(36).slice(2, 8), name, bot: true, stack: botStack(st, rnd), stil: { mut: 0.85 + rnd(60) / 100, lose: rnd(9) / 100 }, ...leereHand() };
}
function leereHand() { return { hole: [], einsatz: 0, gesamt: 0, gefoldet: false, allin: false, imSpiel: false, braucht: false, darfRaisen: true, zeigt: false, letzte: '' }; }

export function beitreten(st, spieler) {
  const rnd = umwelt.rnd;
  if (menschen(st).length + st.wartend.length >= PLAETZE) return { ok: false, fehler: 'voll' };
  const neu = { id: spieler.id, name: spieler.name, bot: false, stack: spieler.stack, verbunden: true, getrennt: 0, weg: false, ...leereHand() };
  const frei = st.sitze.findIndex(s => !s);
  if (frei >= 0) { st.sitze[frei] = neu; return { ok: true, sitz: frei, sofort: true }; }
  const ruhig = st.phase === 'zwischen' || st.phase === 'warten';
  const bots = st.sitze.map((s, i) => (s && s.bot && !s.geht ? i : -1)).filter(i => i >= 0);
  if (!bots.length) return { ok: false, fehler: 'voll' };
  const i = bots[rnd(bots.length)];
  if (ruhig) { st.sitze[i] = neu; return { ok: true, sitz: i, sofort: true }; }
  st.sitze[i].geht = true; st.wartend.push(neu);
  return { ok: true, sitz: -1, sofort: false };
}

/** Spieler steht auf: wirft die Hand weg und bekommt seinen Stapel. Gibt den Betrag zurück (oder null, wenn unbekannt). */
export function verlassen(st, id, grund = 'gegangen') {
  const w = st.wartend.findIndex(s => s.id === id);
  if (w >= 0) { const s = st.wartend.splice(w, 1)[0]; st.ausgang.push({ id, betrag: s.stack, grund }); return s.stack; }
  const i = st.sitze.findIndex(s => s && s.id === id && !s.bot && !s.weg);
  if (i < 0) return null;
  const s = st.sitze[i];
  const mitten = s.imSpiel && !s.gefoldet && st.phase !== 'zwischen' && st.phase !== 'warten';
  const betrag = s.stack; s.stack = 0; s.weg = true; s.verbunden = false;
  st.ausgang.push({ id, betrag, grund });
  if (mitten) {
    if (st.aktuell === i) aktion(st, i, 'fold', 0, true);
    else {
      s.gefoldet = true; s.braucht = false; s.letzte = 'fold'; logge(st, i, 'fold');
      if (st.sitze.filter(o => o && o.imSpiel && !o.gefoldet).length === 1) abrechnen(st, false);
    }
  }
  return betrag;   // der Platz wird beim Start der nächsten Hand frei
}

function ausgeschieden(st) {
  // Spieler ohne Chips fliegen raus, Bots kaufen neu ein
  for (let i = 0; i < PLAETZE; i++) {
    const s = st.sitze[i]; if (!s) continue;
    if (s.weg) { st.sitze[i] = null; continue; }
    if (s.bot) { if (s.geht) { st.sitze[i] = null; continue; } if (s.stack <= 0) s.stack = botStack(st, umwelt.rnd); continue; }
    if (s.stack <= 0) { st.ausgang.push({ id: s.id, betrag: 0, grund: 'pleite' }); st.sitze[i] = null; }
  }
}

export function naechsteHand(st) {
  const rnd = umwelt.rnd;
  ausgeschieden(st);
  while (st.wartend.length) { const f = st.sitze.findIndex(s => !s); if (f < 0) break; st.sitze[f] = st.wartend.shift(); }
  for (let i = 0; i < PLAETZE; i++) if (!st.sitze[i] && menschen(st).length) st.sitze[i] = neuerBot(st, rnd);
  return starteHand(st);
}

function naechsterBraucht(st, von) {
  for (let k = 1; k <= PLAETZE; k++) {
    const i = (von + k) % PLAETZE, s = st.sitze[i];
    if (s && s.imSpiel && !s.gefoldet && !s.allin && s.braucht) return i;
  }
  return -1;
}
function setze(st, i, betrag) {
  const s = st.sitze[i], zahl = Math.min(s.stack, betrag);
  s.stack -= zahl; s.einsatz += zahl; s.gesamt += zahl; if (s.stack === 0) s.allin = true;
  return zahl;
}
function mischen(rnd) {
  const d = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) { const j = rnd(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

export function starteHand(st) {
  const rnd = umwelt.rnd, b = blinds(st);
  const dabei = [];
  for (let i = 0; i < PLAETZE; i++) { const s = st.sitze[i]; if (s && s.stack > 0) dabei.push(i); }
  st.ergebnis = null; st.board = [];
  if (dabei.length < 2) { st.phase = 'warten'; st.aktuell = -1; for (const s of st.sitze) if (s) Object.assign(s, leereHand(), { stack: s.stack }); return false; }
  for (let i = 0; i < PLAETZE; i++) { const s = st.sitze[i]; if (s) { const behalte = { stack: s.stack }; Object.assign(s, leereHand(), behalte); s.imSpiel = dabei.includes(i); } }
  // Button zum nächsten Spieler
  let bt = st.button; for (let k = 1; k <= PLAETZE; k++) { const i = (Math.max(bt, -1) + k) % PLAETZE; if (dabei.includes(i)) { bt = i; break; } }
  st.button = bt;
  const reihe = []; for (let k = 1; k <= PLAETZE; k++) { const i = (bt + k) % PLAETZE; if (dabei.includes(i)) reihe.push(i); }
  const sb = dabei.length === 2 ? bt : reihe[0], bbSitz = dabei.length === 2 ? reihe[0] : reihe[1];
  st.deck = mischen(rnd); st.handNr += 1;
  const start = (sb + 0) % PLAETZE;
  for (let r = 0; r < 2; r++) for (let k = 0; k < PLAETZE; k++) { const i = (start + k) % PLAETZE; if (dabei.includes(i)) st.sitze[i].hole.push(st.deck.pop()); }
  setze(st, sb, b.sb); logge(st, sb, 'sb', st.sitze[sb].einsatz);
  setze(st, bbSitz, b.bb); logge(st, bbSitz, 'bb', st.sitze[bbSitz].einsatz);
  st.hoechster = b.bb; st.letzterRaise = b.bb; st.bbSitz = bbSitz; st.sbSitz = sb;
  for (const i of dabei) { const s = st.sitze[i]; s.braucht = !s.allin; s.darfRaisen = true; }
  st.phase = 'preflop';
  const n = naechsterBraucht(st, bbSitz);
  if (n < 0) { rundeFertig(st); return true; }
  starteZug(st, n);
  return true;
}

function starteZug(st, i) {
  st.aktuell = i;
  const s = st.sitze[i], jetzt = umwelt.jetzt();
  if (s.bot) st.botBis = jetzt + 600 + umwelt.rnd(1000);
  else st.frist = jetzt + (s.verbunden ? FRIST_MS : 1200);
}

export function legal(st, i) {
  const s = st.sitze[i];
  if (!s || st.aktuell !== i) return null;
  const zu = Math.max(0, st.hoechster - s.einsatz), max = s.einsatz + s.stack;
  const kannRaisen = s.darfRaisen && s.stack > zu;
  return { check: zu === 0, call: Math.min(zu, s.stack), zuZahlen: zu, raise: kannRaisen, minTo: Math.min(st.hoechster + st.letzterRaise, max), maxTo: max, pot: potSumme(st) };
}

/** a: 'fold' | 'check' | 'call' | 'raise' (betrag = Erhöhung auf diesen Gesamteinsatz der Runde) | 'allin' */
export function aktion(st, i, a, betrag, erzwingen = false) {
  const s = st.sitze[i];
  if (!s || st.aktuell !== i || !s.imSpiel || s.gefoldet || s.allin) return { ok: false, fehler: 'nicht dran' };
  const zu = Math.max(0, st.hoechster - s.einsatz), max = s.einsatz + s.stack;
  if (a === 'allin') { a = max > st.hoechster ? 'raise' : 'call'; betrag = max; }
  if (a === 'check' && zu > 0) { if (erzwingen) a = 'fold'; else return { ok: false, fehler: 'check nicht möglich' }; }
  if (a === 'fold') { s.gefoldet = true; s.braucht = false; logge(st, i, 'fold'); s.letzte = 'fold'; }
  else if (a === 'check') { s.braucht = false; s.darfRaisen = false; logge(st, i, 'check'); s.letzte = 'check'; }
  else if (a === 'call') {
    if (zu === 0) return { ok: false, fehler: 'nichts zu bezahlen' };
    const z = setze(st, i, zu); s.braucht = false; s.darfRaisen = false; logge(st, i, 'call', z); s.letzte = 'call';
  } else if (a === 'raise') {
    betrag = Math.floor(betrag);
    if (!s.darfRaisen) return { ok: false, fehler: 'Erhöhen nicht erlaubt' };
    const bis = Math.min(betrag, max);
    if (!(bis > st.hoechster)) return { ok: false, fehler: 'zu wenig' };
    const minTo = st.hoechster + st.letzterRaise, vollAllin = bis === max;
    if (bis < minTo && !vollAllin) return { ok: false, fehler: 'unter Mindesterhöhung' };
    const vorher = st.hoechster;
    setze(st, i, bis - s.einsatz);
    const groesse = bis - vorher, voll = groesse >= st.letzterRaise;
    st.hoechster = bis;
    if (voll) st.letzterRaise = groesse;
    for (let k = 0; k < PLAETZE; k++) {
      const o = st.sitze[k]; if (!o || k === i || !o.imSpiel || o.gefoldet || o.allin) continue;
      if (voll) { o.braucht = true; o.darfRaisen = true; } else if (o.einsatz < st.hoechster) o.braucht = true;
    }
    s.braucht = false; s.darfRaisen = false;
    s.letzte = vollAllin ? 'allin' : vorher > 0 && st.log.some(l => l.a === 'raise' || l.a === 'bet') ? 'raise' : 'bet';
    logge(st, i, vollAllin ? 'allin' : (vorher === 0 ? 'bet' : 'raise'), bis);
  } else return { ok: false, fehler: 'unbekannte Aktion' };
  weiter(st, i);
  return { ok: true };
}

function weiter(st, von) {
  const live = st.sitze.filter(s => s && s.imSpiel && !s.gefoldet);
  if (live.length === 1) { return abrechnen(st, false); }
  const n = naechsterBraucht(st, von);
  if (n >= 0) { starteZug(st, n); return; }
  rundeFertig(st);
}

function rundeFertig(st) {
  // Einsätze der Runde sind eingesammelt (Pot ist die Summe der Gesamteinsätze)
  for (const s of st.sitze) if (s) s.einsatz = 0;
  st.hoechster = 0; st.letzterRaise = blinds(st).bb; st.aktuell = -1;
  const aktive = () => st.sitze.filter(s => s && s.imSpiel && !s.gefoldet && !s.allin);
  while (true) {
    if (st.phase === 'river') return abrechnen(st, true);
    if (st.phase === 'preflop') { st.board.push(st.deck.pop(), st.deck.pop(), st.deck.pop()); st.phase = 'flop'; }
    else if (st.phase === 'flop') { st.board.push(st.deck.pop()); st.phase = 'turn'; }
    else if (st.phase === 'turn') { st.board.push(st.deck.pop()); st.phase = 'river'; }
    for (const s of st.sitze) if (s) { s.braucht = !!(s.imSpiel && !s.gefoldet && !s.allin); s.darfRaisen = true; s.letzte = ''; }
    if (aktive().length >= 2) break;
    // höchstens ein Spieler kann noch setzen: Karten laufen weiter
  }
  const n = naechsterBraucht(st, st.button);
  if (n < 0) return rundeFertig(st);
  starteZug(st, n);
}

function abrechnen(st, showdown) {
  st.aktuell = -1;
  const sitzeImSpiel = st.sitze.map((s, i) => (s && s.imSpiel ? i : -1)).filter(i => i >= 0);
  // nicht gedeckten Einsatz zurückgeben
  const sortiert = sitzeImSpiel.map(i => st.sitze[i].gesamt).sort((a, b) => b - a);
  if (sortiert.length >= 2 && sortiert[0] > sortiert[1]) {
    const i = sitzeImSpiel.find(k => st.sitze[k].gesamt === sortiert[0]);
    const zurueck = sortiert[0] - sortiert[1]; st.sitze[i].gesamt -= zurueck; st.sitze[i].stack += zurueck;
  }
  const live = sitzeImSpiel.filter(i => !st.sitze[i].gefoldet);
  const scores = {};
  if (showdown) for (const i of live) { scores[i] = bewerte(st.sitze[i].hole.concat(st.board)); st.sitze[i].zeigt = true; }
  // Töpfe (Haupt- und Nebentöpfe)
  const ebenen = [...new Set(live.map(i => st.sitze[i].gesamt))].sort((a, b) => a - b);
  const toepfe = []; let vor = 0;
  for (const L of ebenen) {
    let betrag = 0;
    for (const i of sitzeImSpiel) betrag += Math.max(0, Math.min(st.sitze[i].gesamt, L) - Math.min(st.sitze[i].gesamt, vor));
    const berechtigt = live.filter(i => st.sitze[i].gesamt >= L);
    if (betrag > 0) toepfe.push({ betrag, berechtigt });
    vor = L;
  }
  // Einsätze von Ausgestiegenen über der höchsten Ebene der Lebenden (kann nur durch Aussteigen entstehen) gehen in den letzten Topf
  let uebrig = 0; for (const i of sitzeImSpiel) uebrig += Math.max(0, st.sitze[i].gesamt - vor);
  if (uebrig && toepfe.length) toepfe[toepfe.length - 1].betrag += uebrig;
  const gewinne = {}, ergebnisToepfe = [];
  for (const t of toepfe) {
    let gewinner;
    if (!showdown || t.berechtigt.length === 1) gewinner = [t.berechtigt[0]];
    else { const best = Math.max(...t.berechtigt.map(i => scores[i])); gewinner = t.berechtigt.filter(i => scores[i] === best); }
    const teil = Math.floor(t.betrag / gewinner.length); let rest = t.betrag - teil * gewinner.length;
    // Reste links vom Button
    const ordnung = []; for (let k = 1; k <= PLAETZE; k++) { const i = (st.button + k) % PLAETZE; if (gewinner.includes(i)) ordnung.push(i); }
    for (const i of ordnung) { let g = teil; if (rest > 0) { g += 1; rest -= 1; } gewinne[i] = (gewinne[i] || 0) + g; }
    ergebnisToepfe.push({ betrag: t.betrag, gewinner: ordnung, hand: showdown ? handName(scores[ordnung[0]]) : null });
  }
  for (const i of Object.keys(gewinne)) st.sitze[i].stack += gewinne[i];
  st.ergebnis = { showdown, toepfe: ergebnisToepfe, gewinne, haende: showdown ? Object.fromEntries(live.map(i => [i, handName(scores[i])])) : {} };
  st.phase = 'zwischen';
  st.zwischenBis = umwelt.jetzt() + (showdown ? PAUSE_SHOWDOWN_MS : PAUSE_FOLD_MS);
}

// ---------- Computergegner ----------
export function botEntscheidung(st, i, rnd = umwelt.rnd) {
  const s = st.sitze[i], l = legal(st, i), b = blinds(st);
  const gegner = st.sitze.filter((o, k) => o && k !== i && o.imSpiel && !o.gefoldet).length;
  const sims = st.phase === 'preflop' ? 140 : 220;
  const e = gewinnchance(s.hole, st.board, Math.max(1, gegner), sims, rnd);
  const pot = l.pot, zu = l.zuZahlen, stil = s.stil || { mut: 1, lose: 0.03 };
  const potOdds = zu / (pot + zu || 1);
  const zufallsw = rnd(1000) / 1000;
  const erhoehe = (anteil) => {
    if (!l.raise) return zu > 0 ? { a: 'call' } : { a: 'check' };
    let ziel = st.hoechster + Math.max(st.letzterRaise, Math.floor(anteil * (pot + zu)));
    ziel = Math.round(ziel / b.sb) * b.sb;
    ziel = Math.max(l.minTo, Math.min(ziel, l.maxTo));
    if (ziel >= l.maxTo * 0.8 || l.maxTo - ziel < b.bb) ziel = l.maxTo;
    return { a: 'raise', betrag: ziel };
  };
  const kurz = s.stack <= b.bb * 8;
  if (zu === 0) {
    if (e > 0.78 - (stil.mut - 1) * 0.1) return erhoehe(0.55 + rnd(40) / 100);
    if (e > 0.6 && zufallsw < 0.55 * stil.mut) return erhoehe(0.4 + rnd(30) / 100);
    if (e < 0.4 && zufallsw < 0.06 * stil.mut && st.phase !== 'preflop') return erhoehe(0.5);
    return { a: 'check' };
  }
  if (kurz && e > 0.5 - stil.lose) return { a: l.raise ? 'allin' : 'call' };
  const belastung = zu / (s.stack + s.einsatz || 1);
  const grenze = potOdds + 0.04 - stil.lose + belastung * 0.18;
  if (e < grenze) { if (zufallsw < 0.03 * stil.mut && l.raise && st.phase !== 'preflop') return erhoehe(0.7); return { a: 'fold' }; }
  if (e > 0.82 && zufallsw < 0.7 * stil.mut) return erhoehe(0.7 + rnd(50) / 100);
  if (e > 0.68 && zufallsw < 0.35 * stil.mut) return erhoehe(0.6);
  return { a: 'call' };
}

/** Führt den fälligen automatischen Schritt aus (Bot-Zug, Frist abgelaufen, nächste Hand, getrennte Spieler entfernen). Gibt zurück, ob sich etwas geändert hat. */
export function schritt(st, jetzt = umwelt.jetzt()) {
  let geaendert = false;
  for (const s of st.sitze) {
    if (s && !s.bot && !s.weg && !s.verbunden && s.getrennt && jetzt - s.getrennt > GETRENNT_MS) { verlassen(st, s.id, 'getrennt'); geaendert = true; }
  }
  if (!menschen(st).length && st.wartend.length === 0) { return geaendert; }
  if (st.phase === 'warten') { if (naechsteHand(st)) geaendert = true; return geaendert; }
  if (st.phase === 'zwischen') { if (jetzt >= st.zwischenBis) { naechsteHand(st); geaendert = true; } return geaendert; }
  if (st.aktuell >= 0) {
    const s = st.sitze[st.aktuell];
    if (s.bot) {
      if (jetzt >= st.botBis) { const d = botEntscheidung(st, st.aktuell); const r = aktion(st, st.aktuell, d.a, d.betrag); if (!r.ok) aktion(st, st.aktuell, legal(st, st.aktuell).check ? 'check' : 'fold', 0, true); geaendert = true; }
    } else if (jetzt >= st.frist) {
      const i = st.aktuell; aktion(st, i, legal(st, i).check ? 'check' : 'fold', 0, true); geaendert = true;
    }
  }
  return geaendert;
}

/** Wann ist der nächste automatische Schritt fällig? (ms seit 1970, 0 = nichts zu tun) */
export function naechsterTermin(st, jetzt = umwelt.jetzt()) {
  if (!menschen(st).length && !st.wartend.length) return 0;
  const t = [];
  for (const s of st.sitze) if (s && !s.bot && !s.weg && !s.verbunden && s.getrennt) t.push(s.getrennt + GETRENNT_MS + 50);
  if (st.phase === 'warten') t.push(jetzt + 1200);
  else if (st.phase === 'zwischen') t.push(st.zwischenBis);
  else if (st.aktuell >= 0) t.push(st.sitze[st.aktuell].bot ? st.botBis : st.frist);
  return t.length ? Math.min(...t) : 0;
}

/** Was ein Spieler sehen darf */
export function ansicht(st, id, jetzt = umwelt.jetzt()) {
  const ich = st.sitze.findIndex(s => s && s.id === id);
  const ruhig = st.phase === 'zwischen' || st.phase === 'warten';
  const warte = st.wartend.some(s => s.id === id);
  return {
    t: 'tisch', stufe: st.stufe, phase: st.phase, handNr: st.handNr, button: st.button, board: st.board, pot: potSumme(st), hoechster: st.hoechster,
    aktuell: st.aktuell, ich, wartet: warte, blinds: [blinds(st).sb, blinds(st).bb],
    rest: st.aktuell >= 0 ? Math.max(0, (st.sitze[st.aktuell].bot ? st.botBis : st.frist) - jetzt) : (st.phase === 'zwischen' ? Math.max(0, st.zwischenBis - jetzt) : 0),
    sitze: st.sitze.map((s, i) => !s ? null : {
      name: s.name, bot: s.bot, stack: s.stack, einsatz: s.einsatz, gefoldet: s.gefoldet, allin: s.allin, imSpiel: s.imSpiel, letzte: s.letzte,
      verbunden: s.bot ? true : s.verbunden, geht: !!s.geht || !!s.weg,
      karten: s.imSpiel ? (s.id === id || s.zeigt ? s.hole : (s.hole.length ? [-1, -1] : [])) : [],
    }),
    legal: ich >= 0 && st.aktuell === ich ? legal(st, ich) : null,
    log: st.log.slice(-8), ergebnis: ruhig || st.ergebnis ? st.ergebnis : null,
    meineHand: ich >= 0 && st.sitze[ich].hole.length && st.board.length >= 3 && !st.sitze[ich].gefoldet ? handName(bewerte(st.sitze[ich].hole.concat(st.board))) : null,
  };
}
