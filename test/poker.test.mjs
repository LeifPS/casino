import assert from 'node:assert/strict';
import * as P from '../src/poker-engine.js';

// Karten: Rang (A=0,2=1,...,K=12) + 13*Farbe (0=Pik,1=Herz,2=Karo,3=Kreuz)
const k = (r, f) => ({ A: 0, K: 12, D: 11, B: 10, 10: 9, 9: 8, 8: 7, 7: 6, 6: 5, 5: 4, 4: 3, 3: 2, 2: 1 }[r] + 13 * f);
const h = (...s) => s.map(x => k(x.slice(0, -1), Number(x.slice(-1))));
const kat = (cards) => P.handKategorie(P.bewerte(h(...cards)));

// Kategorien
assert.equal(kat(['A0', 'K0', 'D0', 'B0', '100']), 8);                   // Royal Flush
assert.equal(P.handName(P.bewerte(h('A0', 'K0', 'D0', 'B0', '100'))), 'Royal Flush');
assert.equal(kat(['50', '60', '70', '80', '90', 'K1', '21']), 8);        // Straight Flush 5-9
assert.equal(kat(['A0', '20', '30', '40', '50']), 8);                    // Wheel Straight Flush
assert.equal(kat(['91', '92', '93', '90', 'K1']), 7);
assert.equal(kat(['91', '92', '93', 'K0', 'K1']), 6);
assert.equal(kat(['91', '92', '93', 'K0', 'K1', 'K2', '21']), 6);        // zwei Drillinge -> Full House
assert.equal(kat(['A0', '90', '70', '40', '20']), 5);
assert.equal(kat(['A0', '21', '32', '43', '50']), 4);                    // Wheel
assert.equal(kat(['A0', 'A1', 'A2', '90', 'K1']), 3);                    // Drilling
assert.equal(kat(['A0', 'A1', 'K2', 'K3', '51']), 2);
assert.equal(kat(['A0', 'A1', 'K2', '73', '51']), 1);
assert.equal(kat(['A0', '91', 'K2', '73', '51']), 0);
// Vergleiche
const S = (...c) => P.bewerte(h(...c));
assert.ok(S('A0', 'K0', 'D0', 'B0', '90') > S('A1', 'K1', 'D1', 'B1', '80'));     // Flush: höchste Karte
assert.ok(S('A0', 'A1', 'K2', '73', '51') > S('K0', 'K1', 'A2', '73', '51'));     // Paar Asse > Paar Könige
assert.ok(S('A0', 'A1', '92', '93', '51') > S('A2', 'A3', '82', '83', 'K1'));     // Zwei Paare: zweites Paar zählt
assert.ok(S('A0', 'A1', 'K2', '73', '51') > S('A2', 'A3', 'K0', '73', '41'));     // Kicker
assert.equal(S('A0', 'A1', 'K2', '73', '51'), S('A2', 'A3', 'K0', '73', '51'));   // Gleichstand
assert.ok(S('60', '71', '82', '93', '103') > S('50', '61', '72', '83', '93'));    // Straße höher
assert.ok(S('50', '61', '72', '83', 'A3', 'A1', 'K1') > 0);
// 7 Karten: bestes Blatt ist ein Flush, obwohl auch ein Paar da ist
assert.equal(kat(['A0', 'K0', '90', '40', '20', 'A1', 'K1']), 5);

// Spieltisch-Hilfen
let zeit = 1_000_000; P.umwelt.jetzt = () => zeit;
function seq(...werte) { let i = 0; return (n) => werte[i++ % werte.length] % n; }
function tisch(stufe = 0, stacks = [200, 200, 200]) {
  const st = P.neuerTisch(stufe);
  stacks.forEach((s, i) => { st.sitze[i] = { id: 'm' + i, name: 'M' + i, bot: false, stack: s, verbunden: true, getrennt: 0, weg: false, hole: [], einsatz: 0, gesamt: 0, gefoldet: false, allin: false, imSpiel: false, braucht: false, darfRaisen: true, zeigt: false, letzte: '' }; });
  return st;
}
const gesamt = (st) => st.sitze.reduce((a, s) => a + (s ? s.stack + (st.phase === 'zwischen' ? 0 : s.gesamt) : 0), 0);

// 1) Blinds und erster Zug bei drei Spielern: Button 0 -> SB 1, BB 2, UTG = 0
{
  const st = tisch(0, [200, 200, 200]); st.button = -1;
  P.starteHand(st);
  assert.equal(st.button, 0); assert.equal(st.sbSitz, 1); assert.equal(st.bbSitz, 2);
  assert.equal(st.sitze[1].einsatz, 1); assert.equal(st.sitze[2].einsatz, 2); assert.equal(st.aktuell, 0);
  // Preflop: 0 ruft, SB ruft, BB hat Option und checkt -> Flop
  assert.ok(P.aktion(st, 0, 'call').ok); assert.ok(P.aktion(st, 1, 'call').ok);
  assert.equal(st.phase, 'preflop'); assert.equal(st.aktuell, 2);
  assert.ok(P.aktion(st, 2, 'check').ok);
  assert.equal(st.phase, 'flop'); assert.equal(st.board.length, 3); assert.equal(st.aktuell, 1);   // Postflop zuerst links vom Button = SB
}
// 2) Heads-up: Button ist SB und beginnt preflop, postflop beginnt BB
{
  const st = tisch(0, [200, 200]); P.starteHand(st);
  assert.equal(st.sbSitz, st.button); assert.equal(st.aktuell, st.button);
  P.aktion(st, st.aktuell, 'call'); P.aktion(st, st.bbSitz, 'check');
  assert.equal(st.phase, 'flop'); assert.equal(st.aktuell, st.bbSitz);
}
// 3) Mindesterhöhung und Erhöhungsregeln
{
  const st = tisch(1, [1000, 1000, 1000]); P.starteHand(st);   // 5/10
  const l = P.legal(st, st.aktuell);
  assert.equal(l.minTo, 20); assert.ok(!P.aktion(st, st.aktuell, 'raise', 15).ok);
  assert.ok(P.aktion(st, st.aktuell, 'raise', 40).ok);          // Erhöhung auf 40 (Größe 30)
  const l2 = P.legal(st, st.aktuell); assert.equal(l2.minTo, 70);
  assert.ok(!P.aktion(st, st.aktuell, 'raise', 60).ok);
  assert.ok(P.aktion(st, st.aktuell, 'raise', 70).ok);
}
// 4) Kurzer All-in öffnet das Setzen nicht neu
{
  const st = tisch(1, [1000, 1000, 35]); st.button = 1;   // Button 2 -> SB 0, BB 1, UTG = 2 (35 Chips)
  P.starteHand(st);
  assert.equal(st.aktuell, 2);
  P.aktion(st, 2, 'allin');                                  // auf 35, Größe 25 >= 10 -> volle Erhöhung
  assert.equal(st.hoechster, 35); assert.equal(st.letzterRaise, 25);
  P.aktion(st, 0, 'call'); P.aktion(st, 1, 'call');
  assert.equal(st.phase, 'flop');
  // Postflop: Spieler 0 setzt 100, Spieler 1 geht kurz all-in? (Stack 965): hier prüfen wir Kurz-All-in mit eigenem Aufbau unten
}
{
  const st = tisch(1, [1000, 1000, 1000]); st.button = -1; P.starteHand(st);
  while (st.phase === 'preflop') { const l = P.legal(st, st.aktuell); P.aktion(st, st.aktuell, l.check ? 'check' : 'call'); }
  assert.equal(st.phase, 'flop'); assert.equal(st.aktuell, 1);
  st.sitze[2].stack = 55;
  assert.ok(P.aktion(st, 1, 'raise', 40).ok);             // volle Erhöhung (Größe 40)
  assert.ok(P.aktion(st, 2, 'allin').ok);                 // 55: nur 15 mehr, kurz -> öffnet nicht neu
  assert.equal(st.hoechster, 55); assert.equal(st.letzterRaise, 40);
  assert.ok(P.legal(st, 0).raise);                        // Seat 0 hat noch nicht gehandelt
  assert.ok(P.aktion(st, 0, 'call').ok);
  assert.equal(st.aktuell, 1);
  const l = P.legal(st, 1); assert.ok(!l.raise); assert.equal(l.call, 15);
  assert.ok(!P.aktion(st, 1, 'raise', 200).ok);
}
// 5) Nebentöpfe: A 100 all-in, B 300 all-in, C 300 ruft. A hat die beste Hand, B die zweitbeste.
{
  const st = tisch(0, [100, 300, 300]); st.button = 1; P.starteHand(st);
  // Karten festlegen
  st.sitze[0].hole = h('A0', 'A1'); st.sitze[1].hole = h('K0', 'K1'); st.sitze[2].hole = h('D0', 'D1');
  st.deck = h('23', '52', '83', '91', '32').reverse();
  // Blinds: Button 2 -> SB 0, BB 1; UTG = 2
  P.aktion(st, 2, 'allin'); P.aktion(st, 0, 'allin'); P.aktion(st, 1, 'call');
  assert.equal(st.phase, 'zwischen');
  const er = st.ergebnis;
  assert.equal(er.toepfe.length, 2);
  assert.equal(er.toepfe[0].betrag, 300); assert.equal(er.toepfe[1].betrag, 400);
  assert.deepEqual(er.toepfe[0].gewinner, [0]);
  assert.deepEqual(er.toepfe[1].gewinner, [1]);
  assert.equal(st.sitze[0].stack, 300); assert.equal(st.sitze[1].stack, 400); assert.equal(st.sitze[2].stack, 0);
}
// 6) Alle werfen weg: Big Blind gewinnt, nicht gedeckter Einsatz kommt zurück
{
  const st = tisch(0, [200, 200, 200]); st.button = -1; P.starteHand(st);
  P.aktion(st, 0, 'raise', 20);   // UTG erhöht
  P.aktion(st, 1, 'fold'); P.aktion(st, 2, 'fold');
  assert.equal(st.phase, 'zwischen'); assert.ok(!st.ergebnis.showdown);
  assert.equal(st.sitze[0].stack, 200 + 1 + 2);   // bekommt Blinds (1+2), sein Einsatz kommt zurück
  assert.equal(st.sitze[1].stack, 199); assert.equal(st.sitze[2].stack, 198);
}
// 7) Gleichstand: Pot wird geteilt, Rest geht links vom Button
{
  const st = tisch(0, [200, 200]); P.starteHand(st);
  st.sitze[0].hole = h('A0', 'K0'); st.sitze[1].hole = h('A1', 'K1');
  st.deck = h('23', '52', '83', '91', '32').reverse();
  const ersterZug = st.aktuell; P.aktion(st, ersterZug, 'call'); P.aktion(st, st.aktuell, 'check');
  while (st.phase !== 'zwischen') { const l = P.legal(st, st.aktuell); P.aktion(st, st.aktuell, l.check ? 'check' : 'call'); }
  assert.equal(st.sitze[0].stack + st.sitze[1].stack, 400); assert.equal(st.sitze[0].stack, 200);
}
// 8) Bots füllen auf, Mensch ersetzt Bot, Chips bleiben beim Menschen zusammen
{
  const st = P.neuerTisch(2);
  const r = P.beitreten(st, { id: 'x', name: 'Leif', stack: 2000 });
  assert.ok(r.ok && r.sofort);
  P.naechsteHand(st);
  assert.equal(st.sitze.filter(Boolean).length, 6); assert.equal(st.sitze.filter(s => s && s.bot).length, 5);
  assert.ok(st.sitze.filter(s => s.bot).every(s => s.stack >= 1000 && s.stack <= 5000));
}
// 9) Simulation: viele Hände nur mit Bots und zufälligen Menschen-Aktionen, Chips bleiben erhalten
{
  let hands = 0, fehler = 0;
  for (let durchlauf = 0; durchlauf < 40; durchlauf++) {
    const st = P.neuerTisch(durchlauf % 3);
    P.beitreten(st, { id: 'h1', name: 'Test', stack: P.STUFEN[st.stufe].minBuy * 2 });
    P.naechsteHand(st);
    for (let n = 0; n < 40; n++) {
      const vorher = gesamt(st), botsAmTisch = st.sitze.filter(s => s && s.bot).reduce((a, s) => a + s.stack + s.gesamt, 0);
      let guard = 0;
      while (st.phase !== 'zwischen' && guard++ < 200) {
        const s = st.sitze[st.aktuell];
        if (!s) break;
        if (s.bot) { const d = P.botEntscheidung(st, st.aktuell); const r = P.aktion(st, st.aktuell, d.a, d.betrag); if (!r.ok) { fehler++; P.aktion(st, st.aktuell, P.legal(st, st.aktuell).check ? 'check' : 'fold', 0, true); } }
        else { const l = P.legal(st, st.aktuell); const w = Math.random(); P.aktion(st, st.aktuell, w < .15 ? 'fold' : l.check ? (w < .5 ? 'check' : 'raise') : (w < .6 ? 'call' : w < .8 ? 'raise' : 'allin'), l.minTo + Math.floor(Math.random() * 40), true); }
      }
      assert.equal(st.phase, 'zwischen', 'Hand endet');
      assert.equal(gesamt(st), vorher, 'Chips bleiben erhalten (Hand ' + n + ')');
      assert.ok(st.sitze.every(s => !s || s.stack >= 0));
      hands++;
      P.naechsteHand(st);
      if (!st.sitze.some(s => s && !s.bot)) { P.beitreten(st, { id: 'h1', name: 'Test', stack: P.STUFEN[st.stufe].minBuy * 2 }); P.naechsteHand(st); }
    }
  }
  assert.equal(fehler, 0, 'Bots machen nur gültige Aktionen');
  console.log('Simulation:', hands, 'Hände ohne Fehler');
}
// 10) Zeitgesteuerte Schritte: Bot-Zug nach Wartezeit, Mensch-Frist, Pause zwischen Händen
{
  zeit = 5_000_000;
  const st = P.neuerTisch(0); P.beitreten(st, { id: 'a', name: 'A', stack: 100 }); P.naechsteHand(st);
  let n = 0;
  while (n++ < 500) {
    const t = P.naechsterTermin(st, zeit); assert.ok(t > 0);
    zeit = Math.max(zeit, t); P.schritt(st, zeit);
    if (st.handNr >= 3) break;
  }
  assert.ok(st.handNr >= 3, 'Spiel läuft von selbst weiter');
}
// 11) Weggehen: Auszahlung des Stapels, laufende Hand wird geworfen
{
  const st = P.neuerTisch(0); P.beitreten(st, { id: 'a', name: 'A', stack: 100 }); P.naechsteHand(st);
  const bet = P.verlassen(st, 'a');
  assert.ok(bet >= 0 && st.ausgang.some(x => x.id === 'a'));
  const sa = st.sitze.find(s => s && s.id === 'a'); assert.ok(sa.weg);
  P.naechsteHand(st); assert.ok(!st.sitze.some(s => s && s.id === 'a'));
}
console.log('Poker-Engine: alle Tests bestanden');
