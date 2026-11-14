// Blackjack-Regeln ohne Oberfläche (zum Testen mit Node).
// Karten sind Zahlen 0..51: Rang = c % 13 (0 = Ass, 9 = Zehn, 10 = Bube, 11 = Dame, 12 = König), Farbe = floor(c / 13).
// Regeln: 6 Decks, Bank zieht bis 17 und steht auch bei Soft 17, Blackjack zahlt 3:2, Verdoppeln auf jede ersten zwei Karten
// (auch nach dem Teilen), Teilen bis zu 4 Hände, nach geteilten Assen nur eine Karte, Versicherung 2:1, Bank prüft auf Blackjack.
import { tisch } from './tische.js';

export const DECKS = 6;
export const NEU_MISCHEN_UNTER = 78;     // Schuh wird vor der Runde neu gemischt, wenn weniger Karten übrig sind
export const MAX_HAENDE = 4;

export function zufall(n) {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const grenze = Math.floor(0x100000000 / n) * n, a = new Uint32Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= grenze);
    return a[0] % n;
  }
  return Math.floor(Math.random() * n);
}

export function kartenWert(c) { const r = c % 13; return r === 0 ? 11 : r >= 9 ? 10 : r + 1; }
export function summe(karten) {
  let t = 0, asse = 0;
  for (const c of karten) { const v = kartenWert(c); t += v; if (v === 11) asse++; }
  while (t > 21 && asse) { t -= 10; asse--; }
  return { total: t, weich: asse > 0 };
}
export const istBlackjack = (karten) => karten.length === 2 && summe(karten).total === 21;

export function neuerSchuh(rnd = zufall) {
  const s = [];
  for (let d = 0; d < DECKS; d++) for (let c = 0; c < 52; c++) s.push(c);
  for (let i = s.length - 1; i > 0; i--) { const j = rnd(i + 1); [s[i], s[j]] = [s[j], s[i]]; }
  return s;
}

export function neuerZustand(tischId = 0, rnd = zufall) {
  return { phase: 'einsatz', tisch: tischId, schuh: neuerSchuh(rnd), neuGemischt: false, bank: [], offen: false, haende: [], aktiv: 0, versicherung: 0, letzter: 0, ergebnis: null, runde: 0 };
}

function ziehe(st) { return st.schuh.pop(); }

/** geld = { guthaben(): number, nehmen(n): boolean, gutschreiben(n) } */
export function austeilen(st, einsatz, geld, rnd = zufall) {
  const t = tisch(st.tisch);
  einsatz = Math.floor(einsatz);
  if (st.phase !== 'einsatz') return { ok: false, grund: 'phase' };
  if (!(einsatz >= t.min) || einsatz > t.max) return { ok: false, grund: 'limit' };
  if (geld.guthaben() < einsatz) return { ok: false, grund: 'guthaben' };
  geld.nehmen(einsatz);
  st.neuGemischt = false;
  if (st.schuh.length < NEU_MISCHEN_UNTER) { st.schuh = neuerSchuh(rnd); st.neuGemischt = true; }
  st.ergebnis = null; st.versicherung = 0; st.offen = false; st.aktiv = 0; st.runde += 1; st.letzter = einsatz;
  const h = { karten: [], einsatz, verdoppelt: false, fertig: false, geteilt: false };
  st.haende = [h]; st.bank = [];
  h.karten.push(ziehe(st)); st.bank.push(ziehe(st)); h.karten.push(ziehe(st)); st.bank.push(ziehe(st));
  const oben = kartenWert(st.bank[0]);
  if (oben === 11 && geld.guthaben() >= Math.floor(einsatz / 2) && Math.floor(einsatz / 2) >= 1) { st.phase = 'versicherung'; return { ok: true }; }
  pruefeBankBlackjack(st, geld);
  return { ok: true };
}

function pruefeBankBlackjack(st, geld) {
  const oben = kartenWert(st.bank[0]);
  if ((oben === 11 || oben === 10) && istBlackjack(st.bank)) { st.offen = true; abrechnen(st, geld); return; }
  if (istBlackjack(st.haende[0].karten)) { st.offen = true; abrechnen(st, geld); return; }
  st.phase = 'spieler';
}

export function versichern(st, ja, geld) {
  if (st.phase !== 'versicherung') return { ok: false };
  if (ja) {
    const v = Math.floor(st.haende[0].einsatz / 2);
    if (geld.guthaben() < v) return { ok: false, grund: 'guthaben' };
    geld.nehmen(v); st.versicherung = v;
  }
  pruefeBankBlackjack(st, geld);
  return { ok: true };
}

export const aktuelleHand = (st) => st.haende[st.aktiv];

function weiter(st, geld) {
  // zur nächsten offenen Hand, sonst Bank
  for (let i = st.aktiv; i < st.haende.length; i++) {
    const h = st.haende[i];
    if (!h.fertig) { st.aktiv = i; return; }
  }
  st.offen = true;
  if (st.haende.every(h => summe(h.karten).total > 21)) { abrechnen(st, geld); return; }
  st.phase = 'bank';
}

export function kannZiehen(st) { const h = aktuelleHand(st); return st.phase === 'spieler' && h && !h.fertig; }
export function kannVerdoppeln(st, geld) {
  const h = aktuelleHand(st);
  return st.phase === 'spieler' && h && !h.fertig && h.karten.length === 2 && geld.guthaben() >= h.einsatz;   // der Höchsteinsatz gilt für den Ausgangseinsatz, nicht fürs Verdoppeln
}
export function kannTeilen(st, geld) {
  const h = aktuelleHand(st);
  return st.phase === 'spieler' && h && !h.fertig && h.karten.length === 2 && st.haende.length < MAX_HAENDE
    && kartenWert(h.karten[0]) === kartenWert(h.karten[1]) && geld.guthaben() >= h.einsatz;
}

export function ziehen(st, geld) {
  if (!kannZiehen(st)) return { ok: false };
  const h = aktuelleHand(st);
  h.karten.push(ziehe(st));
  if (summe(h.karten).total >= 21) { h.fertig = true; weiter(st, geld); }
  return { ok: true };
}
export function halten(st, geld) {
  if (!kannZiehen(st)) return { ok: false };
  aktuelleHand(st).fertig = true; weiter(st, geld);
  return { ok: true };
}
export function verdoppeln(st, geld) {
  if (!kannVerdoppeln(st, geld)) return { ok: false };
  const h = aktuelleHand(st);
  geld.nehmen(h.einsatz); h.einsatz *= 2; h.verdoppelt = true;
  h.karten.push(ziehe(st)); h.fertig = true; weiter(st, geld);
  return { ok: true };
}
export function teilen(st, geld) {
  if (!kannTeilen(st, geld)) return { ok: false };
  const h = aktuelleHand(st);
  geld.nehmen(h.einsatz);
  const ass = h.karten[0] % 13 === 0;
  const a = { karten: [h.karten[0]], einsatz: h.einsatz, verdoppelt: false, fertig: false, geteilt: true };
  const b = { karten: [h.karten[1]], einsatz: h.einsatz, verdoppelt: false, fertig: false, geteilt: true };
  a.karten.push(ziehe(st)); b.karten.push(ziehe(st));
  if (ass) { a.fertig = true; b.fertig = true; } else {
    if (summe(a.karten).total === 21) a.fertig = true;
    if (summe(b.karten).total === 21) b.fertig = true;
  }
  st.haende.splice(st.aktiv, 1, a, b);
  weiter(st, geld);
  return { ok: true };
}

/** Ein Zug der Bank: true, wenn sie eine Karte gezogen hat. */
export function bankSchritt(st, geld) {
  if (st.phase !== 'bank') return false;
  if (summe(st.bank).total < 17) { st.bank.push(ziehe(st)); return true; }
  abrechnen(st, geld);
  return false;
}

export function abrechnen(st, geld) {
  const bank = summe(st.bank).total, bankBj = istBlackjack(st.bank);
  const res = [];
  let netto = 0;
  for (const h of st.haende) {
    const s = summe(h.karten).total, bj = !h.geteilt && istBlackjack(h.karten);
    let art, n;
    if (s > 21) { art = 'ueberkauft'; n = -h.einsatz; }
    else if (bj && !bankBj) { art = 'blackjack'; n = Math.floor(h.einsatz * 3 / 2); }
    else if (bankBj && !bj) { art = 'verloren'; n = -h.einsatz; }
    else if (bj && bankBj) { art = 'gleich'; n = 0; }
    else if (bank > 21 || s > bank) { art = 'gewonnen'; n = h.einsatz; }
    else if (s === bank) { art = 'gleich'; n = 0; }
    else { art = 'verloren'; n = -h.einsatz; }
    const zurueck = n >= 0 ? h.einsatz + n : 0;
    if (zurueck > 0) geld.gutschreiben(zurueck);
    res.push({ art, netto: n });
    netto += n;
  }
  let vers = 0;
  if (st.versicherung) {
    if (bankBj) { geld.gutschreiben(st.versicherung * 3); vers = st.versicherung * 2; } else vers = -st.versicherung;
    netto += vers;
  }
  st.ergebnis = { haende: res, versicherung: vers, netto, bankBlackjack: bankBj, bank };
  st.phase = 'ende';
  return st.ergebnis;
}
