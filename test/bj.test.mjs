import assert from 'node:assert/strict';
import * as E from '../public/js/bj-engine.js';

// Karten: Ass=0, 2=1 ... 10=9, B=10, D=11, K=12 (Farbe egal)
const K = { A: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 10: 9, B: 10, D: 11, K: 12 };
function geld(start) { const g = { c: start, guthaben: () => g.c, nehmen: (n) => { if (n > g.c) return false; g.c -= n; return true; }, gutschreiben: (n) => { g.c += n; } }; return g; }
// Schuh so bauen, dass die Reihenfolge der Karten bekannt ist: pop() zieht vom Ende. Reihenfolge: Spieler1, Bank1, Spieler2, Bank2, danach Zugkarten
function zustand(tischId, folge) {
  const st = E.neuerZustand(tischId);
  st.schuh = [...Array(100).fill(K[5])].concat([...folge].reverse());   // Füllung unten
  return st;
}

// Werte
assert.deepEqual(E.summe([K.A, K.K]), { total: 21, weich: true });
assert.deepEqual(E.summe([K.A, K.A, K[9]]), { total: 21, weich: true });
assert.deepEqual(E.summe([K.A, K.K, K[5]]), { total: 16, weich: false });
assert.equal(E.summe([K.K, K.D, K[2]]).total, 22);

// 1) Einfacher Sieg: Spieler 10+9=19, Bank 10+8=18 -> +Einsatz
{
  const g = geld(1000), st = zustand(1, [K[10], K[10], K[9], K[8]]);
  assert.ok(E.austeilen(st, 100, g).ok);
  assert.equal(g.c, 900); assert.equal(st.phase, 'spieler');
  E.halten(st, g);
  assert.equal(st.phase, 'bank');
  while (E.bankSchritt(st, g));
  assert.equal(st.phase, 'ende'); assert.equal(st.ergebnis.haende[0].art, 'gewonnen');
  assert.equal(g.c, 1100);
}
// 2) Blackjack zahlt 3:2 (Einsatz 100 -> +150), Bank 10+9
{
  const g = geld(1000), st = zustand(1, [K.A, K[10], K.K, K[9]]);
  E.austeilen(st, 100, g);
  assert.equal(st.phase, 'ende'); assert.equal(st.ergebnis.haende[0].art, 'blackjack'); assert.equal(g.c, 1150);
}
// 3) Blackjack gegen Bank-Blackjack = Push
{
  const g = geld(1000), st = zustand(1, [K.A, K.A, K.K, K.K]);   // Spieler A+K, Bank A+K, Bank zeigt Ass -> Versicherung angeboten
  E.austeilen(st, 100, g);
  assert.equal(st.phase, 'versicherung');
  E.versichern(st, false, g);
  assert.equal(st.phase, 'ende'); assert.equal(st.ergebnis.haende[0].art, 'gleich'); assert.equal(g.c, 1000);
}
// 4) Versicherung gewinnt: Bank A+K, Spieler 10+9, Versicherung 50 -> 2:1, Hand verloren
{
  const g = geld(1000), st = zustand(1, [K[10], K.A, K[9], K.K]);
  E.austeilen(st, 100, g);
  assert.equal(st.phase, 'versicherung');
  E.versichern(st, true, g);
  assert.equal(st.phase, 'ende'); assert.equal(st.ergebnis.haende[0].art, 'verloren');
  assert.equal(g.c, 1000);   // -100 Hand, +100 Versicherung netto -> 1000 insgesamt
  assert.equal(st.ergebnis.netto, 0);
}
// 5) Versicherung verloren, Bank hat keinen Blackjack: Bank A+6 (soft 17) steht, Spieler 10+9 gewinnt
{
  const g = geld(1000), st = zustand(1, [K[10], K.A, K[9], K[6]]);
  E.austeilen(st, 100, g); E.versichern(st, true, g);
  assert.equal(st.phase, 'spieler'); E.halten(st, g);
  while (E.bankSchritt(st, g));
  assert.equal(st.ergebnis.bank, 17);   // Soft 17: Bank steht
  assert.equal(st.ergebnis.haende[0].art, 'gewonnen'); assert.equal(st.ergebnis.versicherung, -50);
  assert.equal(g.c, 1000 - 100 - 50 + 200);   // 1050
}
// 6) Überkaufen: Spieler 10+6, zieht 10 -> 26
{
  const g = geld(1000), st = zustand(1, [K[10], K[10], K[6], K[7], K[10]]);
  E.austeilen(st, 100, g); E.ziehen(st, g);
  assert.equal(st.phase, 'ende'); assert.equal(st.ergebnis.haende[0].art, 'ueberkauft'); assert.equal(g.c, 900);
}
// 7) Verdoppeln: Spieler 5+6, Bank 10+7; Doppel-Karte 10 -> 21, gewinnt 2x
{
  const g = geld(1000), st = zustand(1, [K[5], K[10], K[6], K[7], K[10]]);
  E.austeilen(st, 100, g);
  assert.ok(E.verdoppeln(st, g).ok); assert.equal(g.c, 800);
  while (E.bankSchritt(st, g));
  assert.equal(st.ergebnis.haende[0].netto, 200); assert.equal(g.c, 1200);
}
// 8) Verdoppeln nicht möglich ohne Guthaben
{
  const g = geld(150), st = zustand(1, [K[5], K[10], K[6], K[7]]);
  E.austeilen(st, 100, g);
  assert.ok(!E.kannVerdoppeln(st, g));
}
// 9) Teilen: 8+8 gegen Bank 10+7. Zugkarten: Hand A bekommt 3 (11) -> weiter, Hand B 10 (18)
{
  const g = geld(1000), st = zustand(1, [K[8], K[10], K[8], K[7], K[3], K[10]]);
  E.austeilen(st, 100, g);
  assert.ok(E.kannTeilen(st, g)); E.teilen(st, g);
  assert.equal(st.haende.length, 2); assert.equal(g.c, 800);
  assert.equal(st.aktiv, 0);
  E.halten(st, g);   // Hand 1 (8+3=11) bleibt
  assert.equal(st.aktiv, 1); E.halten(st, g);   // Hand 2 (8+10=18)
  while (E.bankSchritt(st, g));
  // Bank 17: Hand1 11 verliert, Hand2 18 gewinnt
  assert.equal(st.ergebnis.haende[0].art, 'verloren'); assert.equal(st.ergebnis.haende[1].art, 'gewonnen');
  assert.equal(g.c, 1000);
}
// 10) Geteilte Asse: nur eine Karte, 21 zählt kein Blackjack
{
  const g = geld(1000), st = zustand(1, [K.A, K[10], K.A, K[7], K.K, K.K]);   // Spieler A,A; Bank 10,7; Asse bekommen K, K
  E.austeilen(st, 100, g); E.teilen(st, g);
  assert.equal(st.phase, 'bank');   // beide Hände fertig
  while (E.bankSchritt(st, g));
  assert.equal(st.ergebnis.haende[0].art, 'gewonnen');   // 21 gegen 17, 1:1 statt 3:2
  assert.equal(st.ergebnis.haende[0].netto, 100);
  assert.equal(g.c, 1200);
}
// 11) Bank zieht bis 17: Bank 10+5, zieht 2 -> 17 steht
{
  const g = geld(1000), st = zustand(1, [K[10], K[10], K[8], K[5], K[2]]);
  E.austeilen(st, 100, g); E.halten(st, g);
  while (E.bankSchritt(st, g));
  assert.equal(st.bank.length, 3); assert.equal(st.ergebnis.bank, 17); assert.equal(st.ergebnis.haende[0].art, 'gewonnen');
}
// 12) Bank überkauft: Bank 10+6, zieht 10 -> 26; Spieler 10+2 steht und gewinnt
{
  const g = geld(1000), st = zustand(1, [K[10], K[10], K[2], K[6], K[10]]);
  E.austeilen(st, 100, g); E.halten(st, g);
  while (E.bankSchritt(st, g));
  assert.equal(st.ergebnis.haende[0].art, 'gewonnen'); assert.equal(g.c, 1100);
}
// 13) Limits
{
  const g = geld(1000), st = zustand(0, [K[10], K[10], K[9], K[8]]);   // Einsteiger: 1..50
  assert.ok(!E.austeilen(st, 51, g).ok); assert.ok(!E.austeilen(st, 0, g).ok); assert.ok(E.austeilen(st, 50, g).ok);
  const g2 = geld(30), st2 = zustand(0, [K[10], K[10], K[9], K[8]]);
  assert.ok(!E.austeilen(st2, 40, g2).ok);
}
// 14) Ungerader Blackjack-Einsatz rundet ab: 5 -> +7
{
  const g = geld(100), st = zustand(1, [K.A, K[10], K.K, K[9]]);
  E.austeilen(st, 15, g);
  assert.equal(st.ergebnis.haende[0].netto, 22); assert.equal(g.c, 100 + 22);
}
// 15) Schuh: 312 Karten, jeder Wert 24x; neuer Schuh bei < 78
{
  const s = E.neuerSchuh(); assert.equal(s.length, 312);
  const z = {}; s.forEach(c => z[c] = (z[c] || 0) + 1); assert.ok(Object.values(z).every(n => n === 6) && Object.keys(z).length === 52);
  const g = geld(1000), st = E.neuerZustand(1); st.schuh = st.schuh.slice(0, 50);
  E.austeilen(st, 10, g); assert.ok(st.neuGemischt); assert.ok(st.schuh.length > 300);
}
// 16) Zufallsprüfung: 20000 komplette Runden mit Grundstrategie-losem "immer Halten bei >=17" – Geld bleibt konsistent
{
  let abweichung = 0;
  for (let i = 0; i < 20000; i++) {
    const g = geld(1e6), st = E.neuerZustand(1); const start = g.c;
    E.austeilen(st, 100, g);
    if (st.phase === 'versicherung') E.versichern(st, i % 2 === 0, g);
    let guard = 0;
    while (st.phase === 'spieler' && guard++ < 50) {
      const h = E.aktuelleHand(st), s = E.summe(h.karten).total;
      if (E.kannTeilen(st, g) && i % 3 === 0) E.teilen(st, g);
      else if (E.kannVerdoppeln(st, g) && (s === 10 || s === 11) && i % 2) E.verdoppeln(st, g);
      else if (s < 17) E.ziehen(st, g); else E.halten(st, g);
    }
    while (E.bankSchritt(st, g));
    assert.equal(st.phase, 'ende');
    assert.equal(g.c - start, st.ergebnis.netto, 'Netto stimmt mit Guthabenänderung überein');
  }
}
console.log('Blackjack-Engine: alle Tests bestanden');
