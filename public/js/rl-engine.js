// Roulette (europäisch, eine Null). Reine Regeln ohne Oberfläche.
import { zufall } from './bj-engine.js';

export const RAD = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const ROT = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const farbe = (n) => (n === 0 ? 'gruen' : ROT.has(n) ? 'rot' : 'schwarz');
export const spaltenNr = (n) => (n - 1) % 3;        // 0 unten, 1 Mitte, 2 oben
export const reiheNr = (n) => Math.floor((n - 1) / 3); // 0..11 (Dutzend = reihe/4)

/** Wetten werden als Text-Schlüssel geführt: 'n:17', 's:1-2', 'c:1-2-4-5', 't:7', 'l:7', 'd:1', 'k:2', 'rot' … */
const ZAHLEN = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const AUSSEN = {
  rot: [[...ROT], 1], schwarz: [ZAHLEN(1, 36).filter(n => !ROT.has(n)), 1],
  gerade: [ZAHLEN(1, 36).filter(n => n % 2 === 0), 1], ungerade: [ZAHLEN(1, 36).filter(n => n % 2 === 1), 1],
  niedrig: [ZAHLEN(1, 18), 1], hoch: [ZAHLEN(19, 36), 1],
};
export const AUSSEN_NAMEN = { rot: 'Rot', schwarz: 'Schwarz', gerade: 'Gerade', ungerade: 'Ungerade', niedrig: '1–18', hoch: '19–36' };

const benachbart = (a, b) => {
  if (a > b) [a, b] = [b, a];
  if (a === 0) return b >= 1 && b <= 3;
  if (b - a === 1) return reiheNr(a) === reiheNr(b);
  return b - a === 3;
};

/** { zahlen:[...], quote } oder null bei ungültigem Schlüssel. quote = Gewinn pro Einsatz (ohne Einsatz). */
export function wette(key) {
  if (AUSSEN[key]) return { zahlen: AUSSEN[key][0], quote: AUSSEN[key][1], art: 'aussen' };
  const m = /^([nsctldk]):([0-9-]+)$/.exec(key);
  if (!m) return null;
  const z = m[2].split('-').map(Number);
  if (z.some(x => !Number.isInteger(x) || x < 0 || x > 36)) return null;
  switch (m[1]) {
    case 'n': return z.length === 1 ? { zahlen: z, quote: 35, art: 'plein' } : null;
    case 's': return z.length === 2 && z[0] < z[1] && benachbart(z[0], z[1]) ? { zahlen: z, quote: 17, art: 'cheval' } : null;
    case 't': return z.length === 1 && z[0] >= 1 && z[0] <= 34 && z[0] % 3 === 1 ? { zahlen: [z[0], z[0] + 1, z[0] + 2], quote: 11, art: 'transversale' } : null;
    case 'l': return z.length === 1 && z[0] >= 1 && z[0] <= 31 && z[0] % 3 === 1 ? { zahlen: ZAHLEN(z[0], z[0] + 5), quote: 5, art: 'sechser' } : null;
    case 'c': {
      if (z.length !== 4) return null;
      const x = z[0];
      if (x < 1 || x > 32 || spaltenNr(x) === 2) return null;
      return z[1] === x + 1 && z[2] === x + 3 && z[3] === x + 4 ? { zahlen: z, quote: 8, art: 'carre' } : null;
    }
    case 'd': return z.length === 1 && z[0] >= 1 && z[0] <= 3 ? { zahlen: ZAHLEN((z[0] - 1) * 12 + 1, z[0] * 12), quote: 2, art: 'dutzend' } : null;
    case 'k': return z.length === 1 && z[0] >= 1 && z[0] <= 3 ? { zahlen: ZAHLEN(1, 36).filter(n => spaltenNr(n) === z[0] - 1), quote: 2, art: 'kolonne' } : null;
  }
  return null;
}

/** Höchsteinsatz je Feld: Pleinwetten dürfen höchstens ein Fünftel des Tischlimits sein. */
export const limitFuer = (key, max) => (key.startsWith('n:') ? Math.max(1, Math.floor(max / 5)) : max);

/** wetten: { key: betrag }. Rückgabe: { gesamt, auszahlung, netto, gewinne:{key:auszahlung} } */
export function abrechnen(wetten, zahl) {
  let gesamt = 0, auszahlung = 0; const gewinne = {};
  for (const [k, b] of Object.entries(wetten)) {
    const w = wette(k); if (!w || !(b > 0)) continue;
    gesamt += b;
    if (w.zahlen.includes(zahl)) { const a = b * (w.quote + 1); gewinne[k] = a; auszahlung += a; }
  }
  return { gesamt, auszahlung, netto: auszahlung - gesamt, gewinne };
}
export const drehen = () => zufall(37);
