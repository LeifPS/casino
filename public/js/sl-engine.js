// Spielautomat mit drei Walzen und einer Gewinnlinie. Reine Regeln.
import { zufall } from './bj-engine.js';

export const SYMBOLE = ['sieben', 'bar', 'karo', 'herz', 'kreuz', 'pik'];
/** Eine Walze: 20 Stopps (für alle drei gleich) */
export const WALZE = ['sieben', 'bar', 'bar', 'karo', 'karo', 'karo', 'herz', 'herz', 'herz', 'herz', 'kreuz', 'kreuz', 'kreuz', 'kreuz', 'kreuz', 'pik', 'pik', 'pik', 'pik', 'pik'];
export const DREIER = { sieben: 500, bar: 100, karo: 40, herz: 20, kreuz: 10, pik: 10 };
export const PAAR = { sieben: 2, bar: 2, karo: 2, herz: 1, kreuz: 1, pik: 1 };   // zwei gleiche Symbole auf den ersten beiden Walzen

/** stopps: Indizes 0..19 der drei Walzen */
export function auszahlung(stopps) {
  const [a, b, c] = stopps.map(i => WALZE[i]);
  if (a === b && b === c) return { mult: DREIER[a], art: 'drei', symbol: a };
  if (a === b) return { mult: PAAR[a], art: 'paar', symbol: a };
  return { mult: 0, art: null };
}
export const drehen = () => [zufall(20), zufall(20), zufall(20)];
export function rtp() {
  let s = 0; for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) for (let k = 0; k < 20; k++) s += auszahlung([i, j, k]).mult;
  return s / 8000;
}
