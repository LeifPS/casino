// Blackjack: Oberfläche. Regeln stehen in bj-engine.js.
import * as Store from './store.js';
import { tisch } from './tische.js';
import { chipSvg, setzChips, stapelHtml, fmt } from './chips.js';
import { Ton } from './ton.js';
import * as E from './bj-engine.js';
import { karteHtml } from './cards.js';
import { dialog, tischWahl, warte, esc } from './ui.js';

const geld = { guthaben: Store.chips, nehmen: Store.nehmen, gutschreiben: Store.gutschreiben };
const ART = { blackjack: 'Blackjack!', gewonnen: 'Gewonnen', gleich: 'Unentschieden', verloren: 'Verloren', ueberkauft: 'Überkauft' };
const vorz = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));

function zaehlen(st) {
  return st ? { runde: st.runde, bank: st.bank.length, haende: st.haende.map(h => h.karten.length), offen: st.offen } : { runde: -1, bank: 0, haende: [], offen: false };
}

export const blackjack = {
  id: 'blackjack', name: 'Blackjack', bereit: true,
  text: 'Schlage die Bank, ohne über 21 zu kommen.',
  start(host, api) {
    let st = Store.state.bj;
    let ansicht = st && Store.chips() >= tisch(st.tisch).buyin ? 'tisch' : 'wahl';
    if (st && st.phase !== 'einsatz' && st.phase !== 'ende') ansicht = 'tisch';   // laufende Runde fortsetzen
    let einsatz = 0, token = 0, belegt = false, vorher = zaehlen(st);
    host.classList.add('bj-host');

    const speichere = () => { Store.state.bj = st; Store.speichern(); };
    const t = () => tisch(st ? st.tisch : 0);
    const klemme = (x) => Math.max(0, Math.min(x, t().max, Store.chips()));

    function waehleTisch(id) {
      if (!st) st = E.neuerZustand(id); else { st.tisch = id; if (st.phase === 'ende') st.phase = 'einsatz'; }
      einsatz = klemme(st.letzter); if (einsatz < t().min) einsatz = 0;
      ansicht = 'tisch'; vorher = zaehlen(st); speichere(); zeige();
    }

    function zeige() {
      if (ansicht === 'wahl') {
        tischWahl(host, { titel: 'Blackjack', chips: Store.chips(), aktuell: st ? st.tisch : -1, info: (x) => 'Sechs Decks · 3:2', beiWahl: waehleTisch });
        host.querySelector('.wahl-kopf').insertAdjacentHTML('beforeend', '<button type="button" class="knopf leise klein" data-a="lobby">‹ Zurück zur Lobby</button>');
        return;
      }
      zeichne();
      if (st.phase === 'bank') bankLauf();
      else if (st.phase === 'ende') ende();
    }

    // ----- Zeichnen -----
    function handHtml(h, i, aktiv, schritte) {
      const s = E.summe(h.karten), ueber = s.total > 21;
      const alt = vorher.runde === st.runde ? (vorher.haende[i] || 0) : 0;
      const karten = h.karten.map((c, k) => {
        let neu;
        if (k >= alt) neu = schritte ? (k === 0 ? 0 : 2) : 0;
        return karteHtml(c, { neu });
      }).join('');
      const erg = st.ergebnis && st.ergebnis.haende[i];
      const marke = erg ? `<span class="erg ${erg.art}">${ART[erg.art]} ${erg.netto ? vorz(erg.netto) : ''}</span>` : '';
      const badge = `<span class="summe${ueber ? ' ueber' : ''}">${s.weich && s.total < 21 && h.karten.length > 1 ? 'weich ' : ''}${s.total}</span>`;
      return `<div class="hand${aktiv ? ' aktiv' : ''}" data-i="${i}"><div class="karten">${karten}</div><div class="hand-info">${badge}${marke}</div><div class="hand-einsatz">${stapelHtml(h.einsatz)}<span class="betrag">${fmt(h.einsatz)}</span></div></div>`;
    }

    function zeichne() {
      const tt = t();
      const neueRunde = vorher.runde !== st.runde;
      const haende = st.haende, vieleKl = haende.length >= 3 ? ' v3' : haende.length === 2 ? ' v2' : ' v1';
      const bankAlt = neueRunde ? 0 : vorher.bank;
      const bankKarten = st.bank.map((c, k) => {
        if (k === 1 && !st.offen) return karteHtml(c, { rueck: true, neu: neueRunde ? 3 : undefined });
        const dreh = k === 1 && st.offen && !vorher.offen && !neueRunde;
        let neu; if (k >= bankAlt) neu = neueRunde ? (k === 0 ? 1 : 3) : 0;
        return karteHtml(c, { neu, dreh });
      }).join('');
      const bs = st.bank.length ? (st.offen ? E.summe(st.bank).total : E.kartenWert(st.bank[0])) : '';
      const bankBadge = st.bank.length ? `<span class="summe${st.offen && bs > 21 ? ' ueber' : ''}">${bs}</span>` : '';
      const alt = (st.phase === 'einsatz' && st.haende.length) ? ' alt' : '';

      let mitte = '';
      if (st.phase === 'ende' && st.ergebnis) {
        const e = st.ergebnis;
        const einzel = e.haende.length === 1 && !e.versicherung;
        const kopf = einzel ? ART[e.haende[0].art] : (e.netto > 0 ? 'Gewonnen' : e.netto < 0 ? 'Verloren' : 'Unentschieden');
        mitte = `<div class="meldung ${e.netto > 0 ? 'gut' : e.netto < 0 ? 'schlecht' : ''}"><b>${kopf}</b> <span>${vorz(e.netto)}</span></div>`;
        if (e.versicherung) mitte += `<div class="meldung-klein">Versicherung ${vorz(e.versicherung)}</div>`;
      } else if (st.phase === 'einsatz') {
        mitte = st.neuGemischt ? '<div class="meldung-klein">Schuh neu gemischt</div>' : `<div class="filzschrift">Blackjack zahlt 3:2<br>Bank steht bei 17</div>`;
      } else if (st.phase === 'versicherung') mitte = '<div class="meldung-klein">Die Bank zeigt ein Ass</div>';
      else if (st.phase === 'bank') mitte = '<div class="meldung-klein">Die Bank spielt …</div>';
      else if (st.phase === 'spieler' && haende.length > 1) mitte = `<div class="meldung-klein">Hand ${st.aktiv + 1} von ${haende.length}</div>`;

      host.innerHTML = `<div class="bj" style="--filz:${tt.filz};--rand:${tt.rand}">
        <div class="bj-kopf"><button type="button" class="knopf leise klein" data-a="tische"${belegtPhase() ? ' disabled' : ''}>⌂ Tische</button><span class="bj-tisch">${esc(tt.name)} · ${fmt(tt.min)}–${fmt(tt.max)}</span><span class="bj-schuh">Schuh ${(st.schuh.length / 52).toFixed(1).replace('.', ',')}</span><button type="button" class="knopf leise klein" data-a="regeln">Regeln</button></div>
        <div class="bj-flaeche${alt}">
          <div class="bj-bank"><div class="zone-titel">Bank ${bankBadge}</div><div class="karten bankkarten">${bankKarten}</div></div>
          <div class="bj-mitte">${mitte}</div>
          <div class="bj-spieler${vieleKl}">${haende.length ? haende.map((h, i) => handHtml(h, i, st.phase === 'spieler' && i === st.aktiv && haende.length > 1, neueRunde)).join('') : '<div class="leerhinweis">Setze deinen Einsatz</div>'}</div>
        </div>
        <div class="bj-steuer">${steuerHtml()}</div></div>`;

      // Ton für neue Karten
      const neueKarten = host.querySelectorAll('.karte.neu');
      neueKarten.forEach(k => setTimeout(() => Ton.karte(), Number(k.style.getPropertyValue('--v') || 0) * 170 + 30));
      if (host.querySelector('.karte.dreh')) setTimeout(() => Ton.karte(), 40);
      if (neueRunde && st.neuGemischt) Ton.mischen();
      vorher = zaehlen(st);
    }
    const belegtPhase = () => st.phase !== 'einsatz' && st.phase !== 'ende';

    function steuerHtml() {
      const tt = t(), c = Store.chips();
      if (st.phase === 'einsatz' || st.phase === 'ende') {
        if (c < tt.min) {
          return `<div class="steuer-text"><p>Für diesen Tisch hast du zu wenig Chips.</p><div class="knoepfe"><button type="button" class="knopf gold" data-a="tische">Anderen Tisch wählen</button></div></div>`;
        }
        if (st.phase === 'ende') {
          const gleich = Math.min(st.letzter, tt.max);
          const geht = gleich >= tt.min && gleich <= c;
          return `<div class="knoepfe gross"><button type="button" class="knopf gold" data-a="nochmal"${geht ? '' : ' disabled'}>Nochmal · ${fmt(gleich)}</button><button type="button" class="knopf" data-a="aendern">Einsatz ändern</button></div>`;
        }
        const chipsKnoepfe = setzChips(tt.min, tt.max).map(w => `<button type="button" class="chipknopf" data-a="chip" data-w="${w}" aria-label="${fmt(w)} Chips"${einsatz + w > Math.min(tt.max, c) ? ' disabled' : ''}>${chipSvg(w)}</button>`).join('');
        const kannAus = einsatz >= tt.min && einsatz <= tt.max && einsatz <= c;
        return `<div class="einsatzbereich"><div class="einsatzfeld">${einsatz ? stapelHtml(einsatz) : '<span class="leer">Einsatz</span>'}<span class="betrag">${einsatz ? fmt(einsatz) : '0'}</span></div>
          <div class="chipreihe">${chipsKnoepfe}</div>
          <div class="knoepfe"><button type="button" class="knopf leise" data-a="loeschen"${einsatz ? '' : ' disabled'}>Löschen</button><button type="button" class="knopf leise" data-a="wieder"${st.letzter >= tt.min && st.letzter <= Math.min(tt.max, c) && st.letzter !== einsatz ? '' : ' disabled'}>Letzter</button><button type="button" class="knopf leise" data-a="doppelt"${einsatz && einsatz * 2 <= Math.min(tt.max, c) ? '' : ' disabled'}>×2</button><button type="button" class="knopf gold gross" data-a="austeilen"${kannAus ? '' : ' disabled'}>Austeilen</button></div></div>`;
      }
      if (st.phase === 'versicherung') {
        const v = Math.floor(st.haende[0].einsatz / 2);
        return `<div class="steuer-text"><p>Versicherung für <b>${fmt(v)}</b> Chips? Sie zahlt 2:1, falls die Bank Blackjack hat.</p><div class="knoepfe gross"><button type="button" class="knopf gold" data-a="vers-ja">Ja, versichern</button><button type="button" class="knopf" data-a="vers-nein">Nein</button></div></div>`;
      }
      if (st.phase === 'spieler') {
        const k = (a, text, ok, art = '') => `<button type="button" class="knopf ${art}" data-a="${a}"${ok && !belegt ? '' : ' disabled'}>${text}</button>`;
        return `<div class="aktionen">${k('ziehen', 'Karte', E.kannZiehen(st), 'gold')}${k('halten', 'Halten', E.kannZiehen(st))}${k('verdoppeln', 'Verdoppeln', E.kannVerdoppeln(st, geld))}${k('teilen', 'Teilen', E.kannTeilen(st, geld))}</div>`;
      }
      return `<div class="steuer-text"><p class="leise-text">Die Bank zieht …</p></div>`;
    }

    // ----- Abläufe -----
    async function kurzSperren(ms) { belegt = true; await warte(ms); belegt = false; }

    function austeilen() {
      if (belegt) return;
      const r = E.austeilen(st, einsatz, geld);
      if (!r.ok) return;
      Ton.chips(); speichere(); zeige();
      kurzSperren(900).then(() => zeigeFalls('spieler'));
    }
    function zeigeFalls(phase) { if (ansicht === 'tisch' && st && st.phase === phase) zeichne(); }

    async function bankLauf() {
      const meins = ++token; belegt = true;
      await warte(700);
      while (meins === token && st.phase === 'bank') {
        const zog = E.bankSchritt(st, geld);
        speichere(); zeichne();
        if (!zog) break;
        await warte(750);
      }
      if (meins === token) { belegt = false; zeige(); }
    }

    function ende() {
      if (st.gezaehlt === st.runde) return;
      st.gezaehlt = st.runde;
      const e = st.ergebnis;
      Store.statistik('blackjack', 1, e.netto); speichere();
      const art = e.haende.length === 1 ? e.haende[0].art : null;
      setTimeout(() => {
        if (e.netto > 0) (art === 'blackjack' || e.netto >= t().max) ? Ton.grosserGewinn() : Ton.gewinn();
        else if (e.netto < 0) Ton.verlust(); else Ton.gleich();
      }, 450);
    }

    function aktion(a, w) {
      switch (a) {
        case 'lobby': return api.zurLobby();
        case 'tische': if (!belegtPhase()) { ansicht = 'wahl'; zeige(); } return;
        case 'regeln': return regeln();
        case 'chip': { const n = Number(w); if (einsatz + n <= Math.min(t().max, Store.chips())) { einsatz += n; Ton.chip(); zeichneSteuer(); } return; }
        case 'loeschen': einsatz = 0; Ton.klick(); return zeichneSteuer();
        case 'wieder': einsatz = klemme(st.letzter); Ton.chip(); return zeichneSteuer();
        case 'doppelt': einsatz = klemme(einsatz * 2); Ton.chip(); return zeichneSteuer();
        case 'austeilen': return austeilen();
        case 'nochmal': if (belegt) return; st.phase = 'einsatz'; einsatz = klemme(st.letzter); if (einsatz >= t().min) return austeilen(); return zeige();
        case 'aendern': st.phase = 'einsatz'; einsatz = klemme(st.letzter); if (einsatz < t().min) einsatz = 0; speichere(); return zeige();
        case 'vers-ja': case 'vers-nein': { const r = E.versichern(st, a === 'vers-ja', geld); if (r.ok) { if (a === 'vers-ja') Ton.chip(); speichere(); zeige(); } return; }
        case 'ziehen': if (!belegt && E.ziehen(st, geld).ok) { speichere(); zeige(); } return;
        case 'halten': if (!belegt && E.halten(st, geld).ok) { Ton.klick(); speichere(); zeige(); } return;
        case 'verdoppeln': if (!belegt && E.verdoppeln(st, geld).ok) { Ton.chip(); speichere(); zeige(); } return;
        case 'teilen': if (!belegt && E.teilen(st, geld).ok) { Ton.chip(); speichere(); zeige(); } return;
      }
    }
    function zeichneSteuer() { const s = host.querySelector('.bj-steuer'); if (s) s.innerHTML = steuerHtml(); }

    function regeln() {
      dialog({ titel: 'Blackjack – Regeln', html: `<ul class="regeln">
        <li>Komm mit deinen Karten näher an 21 als die Bank, ohne darüber zu gehen. Bube, Dame und König zählen 10, ein Ass 1 oder 11.</li>
        <li>Sechs Decks, der Schuh wird nach etwa drei Vierteln neu gemischt.</li>
        <li>Die Bank zieht bis 17 und bleibt dann stehen, auch bei weichen 17.</li>
        <li>Blackjack (Ass + Zehn mit den ersten zwei Karten) zahlt 3:2, sonst gewinnst du 1:1. Gleichstand gibt den Einsatz zurück.</li>
        <li>Verdoppeln: bei den ersten zwei Karten, du bekommst genau eine Karte. Teilen: bei zwei gleichwertigen Karten, bis zu vier Hände. Nach geteilten Assen gibt es nur eine Karte je Ass, und 21 zählt dann nicht als Blackjack.</li>
        <li>Zeigt die Bank ein Ass, kannst du für die Hälfte deines Einsatzes eine Versicherung abschließen (zahlt 2:1 bei Bank-Blackjack).</li>
        <li>Der Höchsteinsatz des Tisches gilt für den Ausgangseinsatz; beim Verdoppeln und Teilen darfst du darüber hinaus gehen.</li></ul>` });
    }

    const klick = (e) => {
      const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
      aktion(b.dataset.a, b.dataset.w);
    };
    host.addEventListener('click', klick);
    const weg = Store.beiAenderung(() => { if (ansicht === 'tisch' && st && (st.phase === 'einsatz' || st.phase === 'ende') && !belegt) { einsatz = klemme(einsatz); zeichneSteuer(); } });

    if (ansicht === 'tisch') { if (st.phase === 'einsatz') { einsatz = klemme(st.letzter); if (einsatz < t().min) einsatz = 0; } }
    zeige();

    return { stop() { token++; belegt = false; host.removeEventListener('click', klick); weg(); host.classList.remove('bj-host'); host.innerHTML = ''; } };
  },
};
