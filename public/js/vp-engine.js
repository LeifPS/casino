// Video-Poker "Buben oder besser" (Jacks or Better, Auszahlung 9/6). Reine Regeln.
import { zufall } from './bj-engine.js';

export const AUSZAHLUNG = [
  { art: 'royal', name: 'Royal Flush', mult: 800 }, { art: 'strflush', name: 'Straight Flush', mult: 50 }, { art: 'vierling', name: 'Vierling', mult: 25 },
  { art: 'fullhouse', name: 'Full House', mult: 9 }, { art: 'flush', name: 'Flush', mult: 6 }, { art: 'strasse', name: 'Straße', mult: 4 },
  { art: 'drilling', name: 'Drilling', mult: 3 }, { art: 'zweipaar', name: 'Zwei Paare', mult: 2 }, { art: 'paar', name: 'Buben oder besser', mult: 1 },
];
const MULT = Object.fromEntries(AUSZAHLUNG.map(a => [a.art, a.mult]));
const rang = (c) => c % 13, farbe = (c) => Math.floor(c / 13);   // Rang 0 = Ass, 10 = Bube, 11 = Dame, 12 = König

export function mischen() {
  const d = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) { const j = zufall(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
export function austeilen() { const d = mischen(); return { karten: d.slice(0, 5), rest: d.slice(5) }; }

/** Wertung einer Fünf-Karten-Hand: { art, name, mult } oder { art: null, mult: 0 } */
export function bewerten(karten) {
  const r = karten.map(rang).sort((a, b) => a - b), f = new Set(karten.map(farbe));
  const zaehl = {}; for (const x of r) zaehl[x] = (zaehl[x] || 0) + 1;
  const gruppen = Object.entries(zaehl).map(([k, n]) => [Number(k), n]).sort((a, b) => b[1] - a[1]);
  const flush = f.size === 1;
  const normal = r.every((x, i) => i === 0 || x === r[i - 1] + 1) && new Set(r).size === 5;
  const asHoch = JSON.stringify(r) === JSON.stringify([0, 9, 10, 11, 12]);
  const strasse = normal || asHoch;
  let art = null;
  if (flush && asHoch) art = 'royal';
  else if (flush && strasse) art = 'strflush';
  else if (gruppen[0][1] === 4) art = 'vierling';
  else if (gruppen[0][1] === 3 && gruppen[1] && gruppen[1][1] === 2) art = 'fullhouse';
  else if (flush) art = 'flush';
  else if (strasse) art = 'strasse';
  else if (gruppen[0][1] === 3) art = 'drilling';
  else if (gruppen[0][1] === 2 && gruppen[1] && gruppen[1][1] === 2) art = 'zweipaar';
  else if (gruppen[0][1] === 2 && (gruppen[0][0] === 0 || gruppen[0][0] >= 10)) art = 'paar';
  if (!art) return { art: null, name: 'Keine Gewinnhand', mult: 0 };
  return { art, name: AUSZAHLUNG.find(a => a.art === art).name, mult: MULT[art] };
}

/** Karten tauschen, die nicht gehalten werden. halt: 5 Wahrheitswerte. */
export function ziehen(karten, rest, halt) {
  const neu = karten.slice(), r = rest.slice();
  for (let i = 0; i < 5; i++) if (!halt[i]) neu[i] = r.shift();
  return { karten: neu, rest: r, wertung: bewerten(neu) };
}
