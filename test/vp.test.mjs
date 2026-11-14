import assert from 'node:assert/strict';
import * as V from '../public/js/vp-engine.js';
// Karten: Farbe*13 + Rang (0=Ass, 1..9 = 2..10, 10=B, 11=D, 12=K)
const h = (...s) => s.map(([f, r]) => f * 13 + r);
const art = (k) => V.bewerten(k).art;
assert.equal(art(h([0, 0], [0, 12], [0, 11], [0, 10], [0, 9])), 'royal');
assert.equal(art(h([1, 4], [1, 5], [1, 6], [1, 7], [1, 8])), 'strflush');
assert.equal(art(h([0, 0], [0, 1], [0, 2], [0, 3], [0, 4])), 'strflush');            // Rad: A-2-3-4-5 gleiche Farbe
assert.equal(art(h([0, 5], [1, 5], [2, 5], [3, 5], [0, 1])), 'vierling');
assert.equal(art(h([0, 5], [1, 5], [2, 5], [3, 1], [0, 1])), 'fullhouse');
assert.equal(art(h([2, 1], [2, 4], [2, 6], [2, 8], [2, 12])), 'flush');
assert.equal(art(h([0, 3], [1, 4], [2, 5], [3, 6], [0, 7])), 'strasse');
assert.equal(art(h([0, 0], [1, 12], [2, 11], [3, 10], [0, 9])), 'strasse');           // Broadway ohne gleiche Farbe
assert.equal(art(h([0, 11], [1, 12], [2, 0], [3, 1], [0, 2])), null);                // Ecke: D-K-A-2-3 ist keine Straße
assert.equal(art(h([0, 5], [1, 5], [2, 5], [3, 1], [0, 8])), 'drilling');
assert.equal(art(h([0, 5], [1, 5], [2, 3], [3, 3], [0, 8])), 'zweipaar');
assert.equal(art(h([0, 10], [1, 10], [2, 3], [3, 4], [0, 8])), 'paar');               // Buben
assert.equal(art(h([0, 0], [1, 0], [2, 3], [3, 4], [0, 8])), 'paar');                 // Asse
assert.equal(art(h([0, 9], [1, 9], [2, 3], [3, 4], [0, 8])), null);                   // Zehnerpaar zahlt nicht
assert.equal(art(h([0, 1], [1, 3], [2, 5], [3, 7], [0, 9])), null);
assert.equal(V.bewerten(h([0, 0], [1, 0], [2, 3], [3, 4], [0, 8])).mult, 1);
// Ziehen: gehaltene Karten bleiben, Rest wird ersetzt
const d = V.austeilen(); assert.equal(d.karten.length, 5); assert.equal(d.rest.length, 47); assert.equal(new Set([...d.karten, ...d.rest]).size, 52);
const z = V.ziehen(d.karten, d.rest, [true, false, true, false, false]);
assert.equal(z.karten[0], d.karten[0]); assert.equal(z.karten[2], d.karten[2]); assert.equal(z.karten[1], d.rest[0]); assert.equal(z.karten[3], d.rest[1]); assert.equal(z.karten[4], d.rest[2]); assert.equal(z.rest.length, 44);
// Gesamt-RTP bei bestem Spiel liegt bei ~99,5 %; hier nur grobe Prüfung mit einfacher Strategie (immer Paar halten, sonst nichts):
let einsatz = 0, aus = 0; const N = 60000;
for (let i = 0; i < N; i++) {
  const t = V.austeilen(); const zz = {}; t.karten.forEach((c, k) => (zz[c % 13] = (zz[c % 13] || [])).push(k));
  const halt = [false, false, false, false, false]; for (const k of Object.values(zz)) if (k.length >= 2) k.forEach(i2 => halt[i2] = true);
  if (!halt.some(Boolean)) t.karten.forEach((c, k) => { if (c % 13 === 0 || c % 13 >= 10) halt[k] = true; });
  einsatz += 1; aus += V.ziehen(t.karten, t.rest, halt).wertung.mult;
}
const rtp = aus / einsatz; assert.ok(rtp > 0.80 && rtp < 1.02, 'RTP ' + rtp);
console.log('Video-Poker-Engine: alle Tests bestanden (einfache Strategie ~' + (rtp * 100).toFixed(1) + ' %)');
