import assert from 'node:assert/strict';
import * as R from '../public/js/rl-engine.js';

assert.equal(R.RAD.length, 37); assert.equal(new Set(R.RAD).size, 37);
assert.equal(R.ROT.size, 18);
assert.equal(R.farbe(0), 'gruen'); assert.equal(R.farbe(1), 'rot'); assert.equal(R.farbe(2), 'schwarz'); assert.equal(R.farbe(36), 'rot');
// Wetten gültig/ungültig
assert.ok(R.wette('n:0')); assert.ok(R.wette('n:36')); assert.equal(R.wette('n:37'), null); assert.equal(R.wette('n:1-2'), null);
assert.ok(R.wette('s:1-2')); assert.ok(R.wette('s:1-4')); assert.ok(R.wette('s:0-3')); assert.equal(R.wette('s:3-4'), null); assert.equal(R.wette('s:1-3'), null); assert.equal(R.wette('s:0-4'), null); assert.equal(R.wette('s:2-1'), null);
assert.deepEqual(R.wette('t:1').zahlen, [1, 2, 3]); assert.equal(R.wette('t:2'), null); assert.ok(R.wette('t:34'));
assert.deepEqual(R.wette('l:1').zahlen, [1, 2, 3, 4, 5, 6]); assert.equal(R.wette('l:34'), null);
assert.deepEqual(R.wette('c:1-2-4-5').zahlen, [1, 2, 4, 5]); assert.ok(R.wette('c:2-3-5-6')); assert.equal(R.wette('c:1-2-3-4'), null); assert.ok(R.wette('c:32-33-35-36'));
assert.equal(R.wette('c:3-4-6-7'), null);
assert.equal(R.wette('d:2').zahlen.length, 12); assert.equal(R.wette('d:2').zahlen[0], 13);
assert.equal(R.wette('k:1').zahlen.length, 12); assert.deepEqual(R.wette('k:1').zahlen.slice(0, 3), [1, 4, 7]); assert.deepEqual(R.wette('k:3').zahlen.slice(0, 2), [3, 6]);
assert.equal(R.wette('rot').zahlen.length, 18); assert.equal(R.wette('gerade').zahlen.length, 18); assert.equal(R.wette('quatsch'), null);
// Auszahlung
let a = R.abrechnen({ 'n:17': 10 }, 17); assert.equal(a.auszahlung, 360); assert.equal(a.netto, 350);
a = R.abrechnen({ 'n:17': 10 }, 18); assert.equal(a.auszahlung, 0); assert.equal(a.netto, -10);
a = R.abrechnen({ rot: 100, 'd:1': 50 }, 3); assert.equal(a.auszahlung, 200 + 150); assert.equal(a.gesamt, 150);
a = R.abrechnen({ rot: 100, schwarz: 100 }, 0); assert.equal(a.auszahlung, 0); assert.equal(a.netto, -200);
a = R.abrechnen({ 's:1-2': 5, 'c:1-2-4-5': 4, 't:1': 3, 'l:1': 2 }, 2); assert.equal(a.auszahlung, 5 * 18 + 4 * 9 + 3 * 12 + 2 * 6);
assert.equal(R.limitFuer('n:5', 500), 100); assert.equal(R.limitFuer('rot', 500), 500);
// Jede Wette: Erwartungswert = -1/37 des Einsatzes (alle 37 Zahlen durchrechnen)
const keys = ['n:7', 's:7-8', 's:7-10', 'c:7-8-10-11', 't:7', 'l:7', 'd:1', 'k:2', 'rot', 'schwarz', 'gerade', 'ungerade', 'niedrig', 'hoch', 's:0-1', 'n:0'];
for (const k of keys) { let s = 0; for (let n = 0; n < 37; n++) s += R.abrechnen({ [k]: 37 }, n).netto; assert.equal(s, -37, k); }
// Verteilung
const z = new Array(37).fill(0); for (let i = 0; i < 37000; i++) z[R.drehen()]++;
assert.ok(z.every(c => c > 800 && c < 1200), 'Verteilung');
console.log('Roulette-Engine: alle Tests bestanden');
