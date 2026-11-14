// Spielautomat: Oberfläche. Regeln stehen in sl-engine.js.
import * as Store from './store.js';
import { tisch } from './tische.js';
import { fmt } from './chips.js';
import { Ton } from './ton.js';
import * as A from './sl-engine.js';
import { dialog, tischWahl, warte, esc, hinweis } from './ui.js';
import { wettHtml, wettAktion } from './wette.js';

const zustand = () => Store.state.sl || (Store.state.sl = { tisch: 0, letzter: 0, offen: null, stopps: [0, 5, 10] });
const vorz = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));

/** Unterbrochene Drehung abrechnen (Einsatz war schon abgebucht). */
export function slotsRetten() {
  const s = Store.state.sl; if (!s || !s.offen) return 0;
  const o = s.offen; s.offen = null; s.stopps = o.stopps;
  if (o.auszahlung > 0) Store.gutschreiben(o.auszahlung);
  Store.statistik('slots', 1, o.auszahlung - o.gesamt);
  Store.speichern();
  return o.auszahlung;
}

const FARBE = { karo: '#d8323b', herz: '#d8323b', kreuz: '#f2f2f5', pik: '#f2f2f5' };
const ZEICHEN = { karo: '♦', herz: '♥', kreuz: '♣', pik: '♠' };
export function symbolSvg(s) {
  if (s === 'sieben') return `<svg viewBox="0 0 60 60" aria-hidden="true"><text x="30" y="47" text-anchor="middle" font-family="Georgia,serif" font-weight="800" font-size="52" fill="#d8323b" stroke="#ffe27a" stroke-width="2.5" paint-order="stroke">7</text></svg>`;
  if (s === 'bar') return `<svg viewBox="0 0 60 60" aria-hidden="true"><rect x="4" y="16" width="52" height="28" rx="5" fill="#15151a" stroke="#ffe27a" stroke-width="2.5"/><text x="30" y="38" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="20" letter-spacing="2" fill="#ffe27a">BAR</text></svg>`;
  return `<svg viewBox="0 0 60 60" aria-hidden="true"><text x="30" y="46" text-anchor="middle" font-size="46" fill="${FARBE[s]}" stroke="#0007" stroke-width="1.2" paint-order="stroke">${ZEICHEN[s]}︎</text></svg>`;
}

export const slots = {
  id: 'slots', name: 'Automat', bereit: true, zeile: 'Drei Walzen, eine Linie: die Sieben zahlt 500×.',
  start(host, api) {
    slotsRetten();
    const S = zustand();
    let ansicht = S.gewaehlt ? 'tisch' : 'wahl', einsatz = Math.min(S.letzter || 0, 1e12), dreht = false, weg = false, letzte = null;
    host.classList.add('sp-host');
    const t = () => tisch(S.tisch);
    if (ansicht === 'tisch' && Store.chips() < t().min) ansicht = 'wahl';
    const grenze = () => Math.min(t().max, Store.chips());
    if (einsatz > grenze() || einsatz < t().min) einsatz = 0;

    function zeige() {
      if (weg) return;
      if (ansicht === 'wahl') {
        tischWahl(host, { titel: 'Automat', chips: Store.chips(), aktuell: -1, zeilen: (x) => `<span class="tk-zeile">Einsatz <b>${fmt(x.min)}</b> – <b>${fmt(x.max)}</b></span><span class="tk-zeile">Sieben <b>500×</b></span>`, info: () => 'Auszahlungsquote etwa 95 %',
          beiWahl: (id) => { S.tisch = id; S.gewaehlt = true; einsatz = Math.min(Math.max(t().min, S.letzter || 0), grenze()); if (einsatz < t().min) einsatz = 0; Store.speichern(); ansicht = 'tisch'; zeige(); } });
        host.querySelector('.wahl-kopf').insertAdjacentHTML('beforeend', '<button type="button" class="knopf leise klein" data-a="lobby">‹ Zurück zur Lobby</button>');
        return;
      }
      baue();
    }
    function walzeHtml(i) {
      const n = A.WALZE.length, reihen = 6, items = [];
      for (let k = 0; k < n * reihen; k++) items.push(`<div class="sl-sym">${symbolSvg(A.WALZE[k % n])}</div>`);
      return `<div class="sl-walze" data-i="${i}"><div class="sl-streifen">${items.join('')}</div></div>`;
    }
    function tabelleHtml() {
      const z = (s, m) => `<div class="sl-pz"><span class="sl-mini">${symbolSvg(s)}${symbolSvg(s)}${symbolSvg(s)}</span><b>${m}×</b></div>`;
      return `<div class="sl-tabelle">${z('sieben', 500)}${z('bar', 100)}${z('karo', 40)}${z('herz', 20)}${z('kreuz', 10)}${z('pik', 10)}<div class="sl-pz zwei"><span>Zwei gleiche links</span><b>1× / 2×</b></div></div>`;
    }
    function steuerHtml() {
      const tt = t(), c = Store.chips();
      if (c < tt.min) return `<div class="steuer-text"><p>Für diesen Tisch hast du zu wenig Chips.</p><div class="knoepfe"><button type="button" class="knopf gold" data-a="tische">Anderen Tisch wählen</button></div></div>`;
      return wettHtml({ einsatz, tt, c, letzter: S.letzter, aktion: { a: 'drehen', text: 'Drehen' } }) + '<div class="spiel-fuss"><button type="button" class="knopf leise klein" data-a="tische">Tisch wechseln</button></div>';
    }
    function baue() {
      const tt = t();
      host.innerHTML = `<div class="sp sl" style="--filz:${tt.filz};--rand:${tt.rand}"><div class="sp-kopf"><button type="button" class="knopf leise klein" data-a="lobby">‹ Lobby</button><span class="sp-tisch">${esc(tt.name)} · ${fmt(tt.min)}–${fmt(tt.max)}</span><button type="button" class="knopf leise klein" data-a="regeln">Regeln</button></div>
        <div class="sp-flaeche">${tabelleHtml()}<div class="sl-automat"><div class="sl-fenster">${[0, 1, 2].map(walzeHtml).join('')}<div class="sl-linie"></div></div></div><div class="vp-meld" id="sl-meld">${letzte ? letzte : 'Einsatz wählen und drehen.'}</div></div>
        <div class="sp-steuer" id="sp-steuer">${steuerHtml()}</div></div>`;
      setze(S.stopps, false);
    }
    const steuerNeu = () => { const s = document.getElementById('sp-steuer'); if (s) s.innerHTML = steuerHtml(); };
    const hoehe = () => { const w = host.querySelector('.sl-walze'); return w ? w.getBoundingClientRect().height / 3 : 0; };
    /** Walzen ohne Animation auf Stopps stellen (Mittelzeile = Stopp) */
    function setze(stopps, ani, dauern) {
      const h = hoehe(), n = A.WALZE.length;
      host.querySelectorAll('.sl-streifen').forEach((el, i) => {
        el.style.transition = 'none';
        el.style.transform = `translateY(${-((stopps[i] - 1 + n) % n + n) * h}px)`;
      });
    }
    async function drehe() {
      const tt = t();
      if (dreht || einsatz < tt.min || einsatz > grenze() || !Store.nehmen(einsatz)) return;
      const stopps = A.drehen(), erg = A.auszahlung(stopps), aus = erg.mult * einsatz;
      S.offen = { stopps, gesamt: einsatz, auszahlung: aus }; S.letzter = einsatz; Store.speichern();
      dreht = true; steuerNeu(); document.getElementById('sl-meld').textContent = '';
      host.querySelectorAll('.sl-treffer').forEach(e => e.classList.remove('sl-treffer'));
      const h = hoehe(), n = A.WALZE.length, kurz = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const streifen = [...host.querySelectorAll('.sl-streifen')];
      Ton.drehen();
      streifen.forEach((el, i) => {
        const von = ((S.stopps[i] - 1 + n) % n + n) * h;
        const nach = (((stopps[i] - 1 + n) % n) + n * (2 + i)) * h + n * h;
        el.style.transition = 'none'; el.style.transform = `translateY(${-von}px)`; void el.offsetHeight;
        el.style.transition = `transform ${kurz ? 200 : 1300 + i * 650}ms cubic-bezier(.2,.7,.25,1)`; el.style.transform = `translateY(${-nach}px)`;
      });
      if (!kurz) { const t0 = performance.now(); for (let k = 0; k < 14 && !weg; k++) { Ton.tick(); await warte(110 + k * 14); } await warte(Math.max(0, 1300 + 2 * 650 - (performance.now() - t0))); await warte(120); } else await warte(260);
      if (weg) return;
      slotsRetten(); dreht = false;
      setze(stopps, false);
      const net = aus - einsatz;
      letzte = erg.art ? `<b>${erg.art === 'drei' ? 'Dreifach!' : 'Zwei gleiche'}</b> <span>${vorz(net)}</span>` : `<b class="schlecht">Leider nichts</b> <span>${vorz(net)}</span>`;
      const m = document.getElementById('sl-meld'); m.innerHTML = letzte; m.className = 'vp-meld ' + (net > 0 ? 'gut' : net < 0 ? 'schlecht' : '');
      if (erg.art) { host.querySelector('.sl-fenster').classList.add('sl-treffer'); }
      if (erg.mult >= 40) Ton.grosserGewinn(); else if (aus > einsatz) Ton.gewinn(); else if (aus === einsatz) Ton.gleich(); else if (aus > 0) Ton.klick(); else Ton.verlust();
      if (einsatz > grenze() || einsatz < tt.min) einsatz = grenze() >= tt.min ? grenze() : 0;
      steuerNeu();
    }
    function regeln() {
      dialog({ titel: 'Automat – Regeln', html: `<ul class="regeln"><li>Drei Walzen, eine Gewinnlinie in der Mitte. Gewinn bei drei gleichen Symbolen: Sieben 500×, BAR 100×, Karo 40×, Herz 20×, Kreuz und Pik je 10×.</li>
        <li>Zwei gleiche Symbole auf den ersten beiden Walzen zahlen: Sieben, BAR und Karo 2×, Herz, Kreuz und Pik 1× (Einsatz zurück).</li>
        <li>Auszahlungsquote etwa 95 %. Eine unterbrochene Drehung wird beim nächsten Öffnen abgerechnet.</li></ul>` });
    }
    host.addEventListener('click', klick);
    function klick(e) {
      const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
      const a = b.dataset.a;
      if (!dreht) { const w = wettAktion(a, b.dataset.w, { einsatz, tt: t(), c: Store.chips(), letzter: S.letzter }); if (w !== undefined) { einsatz = w; return steuerNeu(); } }
      switch (a) {
        case 'lobby': return api.zurLobby();
        case 'regeln': return regeln();
        case 'tische': if (dreht) return; ansicht = 'wahl'; return zeige();
        case 'drehen': return drehe();
      }
    }
    zeige();
    return { fragen: async () => true, stop() { weg = true; host.removeEventListener('click', klick); host.classList.remove('sp-host'); host.innerHTML = ''; } };
  },
};
