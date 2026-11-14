// Spieltöne, selbst erzeugt über Web Audio (läuft über den Lautstärkeregler des Hubs, sobald lgh-vorlade.js eingebunden ist).
import { tonAn } from './store.js';
let ctx = null, rauschen = null;
function start() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  try { ctx = new C(); } catch (e) { return null; }
  const n = ctx.sampleRate * 0.5, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  rauschen = b;
  return ctx;
}
// Browser erlauben Ton erst nach einer Berührung
for (const e of ['pointerdown', 'keydown']) addEventListener(e, () => { if (tonAn()) start(); }, { passive: true });

function ton(f, dauer, o = {}) {
  if (!tonAn()) return; const c = start(); if (!c) return;
  const t = c.currentTime + (o.nach || 0), osz = c.createOscillator(), g = c.createGain();
  osz.type = o.form || 'sine'; osz.frequency.setValueAtTime(f, t);
  if (o.bis) osz.frequency.exponentialRampToValueAtTime(o.bis, t + dauer);
  const v = o.laut ?? 0.18;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
  osz.connect(g); g.connect(c.destination); osz.start(t); osz.stop(t + dauer + 0.05);
}
function zisch(dauer, o = {}) {
  if (!tonAn()) return; const c = start(); if (!c || !rauschen) return;
  const t = c.currentTime + (o.nach || 0), q = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  q.buffer = rauschen; f.type = o.filter || 'bandpass'; f.frequency.value = o.f || 3000; f.Q.value = o.q || 0.8;
  const v = o.laut ?? 0.25;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
  q.connect(f); f.connect(g); g.connect(c.destination); q.start(t, Math.random() * 0.2); q.stop(t + dauer + 0.05);
}

export const Ton = {
  karte() { zisch(0.09, { f: 2400, q: 0.7, laut: 0.28 }); zisch(0.05, { f: 5200, q: 1.2, laut: 0.12, nach: 0.03 }); },
  chip() { ton(2300, 0.05, { form: 'triangle', laut: 0.14 }); ton(3400, 0.04, { form: 'square', laut: 0.04, nach: 0.012 }); zisch(0.03, { f: 6000, q: 2, laut: 0.1 }); },
  chips() { for (let i = 0; i < 4; i++) { ton(2000 + Math.random() * 1200, 0.04, { form: 'triangle', laut: 0.1, nach: i * 0.055 }); } },
  klick() { ton(900, 0.04, { form: 'triangle', laut: 0.1 }); },
  mischen() { for (let i = 0; i < 7; i++) zisch(0.08, { f: 1800 + i * 250, q: 0.6, laut: 0.18, nach: i * 0.07 }); },
  gewinn() { [523, 659, 784, 1047].forEach((f, i) => ton(f, 0.22, { form: 'triangle', laut: 0.16, nach: i * 0.09 })); },
  grosserGewinn() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => ton(f, 0.28, { form: 'triangle', laut: 0.17, nach: i * 0.085 })); Ton.chips(); },
  verlust() { ton(300, 0.35, { form: 'sawtooth', bis: 150, laut: 0.1 }); },
  gleich() { ton(520, 0.16, { form: 'triangle', laut: 0.12 }); ton(520, 0.16, { form: 'triangle', laut: 0.12, nach: 0.17 }); },
  tick() { ton(1500, 0.025, { form: 'square', laut: 0.05 }); },
  kugel() { ton(1900 + Math.random() * 900, 0.03, { form: 'triangle', laut: 0.09 }); zisch(0.02, { f: 4500, q: 3, laut: 0.07 }); },
  drehen() { zisch(1.2, { filter: 'lowpass', f: 700, q: 0.5, laut: 0.08 }); },
};
