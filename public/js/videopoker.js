// Video-Poker: Oberfläche. Regeln stehen in vp-engine.js.
import * as Store from './store.js';
import { tisch } from './tische.js';
import { fmt } from './chips.js';
import { Ton } from './ton.js';
import * as V from './vp-engine.js';
import { karteHtml } from './cards.js';
import { dialog, tischWahl, esc, hinweis } from './ui.js';
import { wettHtml, wettAktion } from './wette.js';

const zustand = () => Store.state.vp || (Store.state.vp = { tisch: 0, phase: 'einsatz', einsatz: 0, karten: [], rest: [], halt: [false, false, false, false, false], letzter: 0, wertung: null });
const vorz = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));

export const videopoker = {
  id: 'videopoker', name: 'Video-Poker', bereit: true, zeile: 'Fünf Karten, halten, ziehen: Buben oder besser zahlt.',
  start(host, api) {
    const S = zustand();
    let ansicht = S.gewaehlt || S.phase === 'halten' ? 'tisch' : 'wahl';
    let einsatz = S.phase === 'einsatz' ? S.einsatz : 0, weg = false, neu = false;
    host.classList.add('sp-host');
    const t = () => tisch(S.tisch);
    if (ansicht === 'tisch' && S.phase !== 'halten' && Store.chips() < t().min) ansicht = 'wahl';

    function zeige() {
      if (weg) return;
      if (ansicht === 'wahl') {
        tischWahl(host, { titel: 'Video-Poker', chips: Store.chips(), aktuell: -1,
          zeilen: (x) => `<span class="tk-zeile">Einsatz <b>${fmt(x.min)}</b> – <b>${fmt(x.max)}</b></span><span class="tk-zeile">Royal Flush <b>800×</b></span>`,
          info: () => 'Buben oder besser · 9/6',
          beiWahl: (id) => { S.tisch = id; S.gewaehlt = true; S.phase = 'einsatz'; einsatz = Math.min(Math.max(t().min, S.letzter || 0), Math.min(t().max, Store.chips())); if (einsatz < t().min) einsatz = 0; Store.speichern(); ansicht = 'tisch'; zeige(); } });
        host.querySelector('.wahl-kopf').insertAdjacentHTML('beforeend', '<button type="button" class="knopf leise klein" data-a="lobby">‹ Zurück zur Lobby</button>');
        return;
      }
      baue();
    }

    function tabelleHtml() {
      const w = S.phase === 'ende' && S.wertung && S.wertung.art;
      return `<div class="vp-tabelle">${V.AUSZAHLUNG.map(a => `<div class="vp-z${w === a.art ? ' treffer' : ''}"><span>${a.name}</span><b>${a.mult}×</b></div>`).join('')}</div>`;
    }
    function kartenHtml() {
      if (S.phase === 'einsatz' || !S.karten.length) return [0, 1, 2, 3, 4].map(() => `<div class="vp-platz">${karteHtml(0, { rueck: true })}</div>`).join('');
      return S.karten.map((c, i) => {
        const gehalten = S.phase === 'halten' && S.halt[i];
        const o = neu ? { neu: i * 0.9 } : (S.phase === 'ende' && S.neue && S.neue[i] ? { dreh: true } : {});
        return `<button type="button" class="vp-platz${gehalten ? ' gehalten' : ''}" data-a="halt" data-i="${i}"${S.phase === 'halten' ? '' : ' disabled'}>${karteHtml(c, o)}<span class="vp-halt">${gehalten ? 'HALTEN' : ''}</span></button>`;
      }).join('');
    }
    function meldungHtml() {
      if (S.phase === 'halten') return '<div class="vp-meld">Tippe auf Karten, die du behalten willst.</div>';
      if (S.phase === 'ende' && S.wertung) {
        const net = S.wertung.mult * S.einsatz - S.einsatz;
        return S.wertung.art ? `<div class="vp-meld gut"><b>${S.wertung.name}</b> <span>${vorz(net)}</span></div>` : `<div class="vp-meld schlecht"><b>Keine Gewinnhand</b> <span>${vorz(net)}</span></div>`;
      }
      return '<div class="vp-meld leise">Einsatz wählen und Karten geben.</div>';
    }
    function steuerHtml() {
      const tt = t(), c = Store.chips();
      if (S.phase === 'halten') return `<div class="knoepfe gross"><button type="button" class="knopf" data-a="alle">Alle halten</button><button type="button" class="knopf gold gross" data-a="ziehen">Ziehen</button></div>`;
      if (c < tt.min) return `<div class="steuer-text"><p>Für diesen Tisch hast du zu wenig Chips.</p><div class="knoepfe"><button type="button" class="knopf gold" data-a="tische">Anderen Tisch wählen</button></div></div>`;
      return wettHtml({ einsatz, tt, c, letzter: S.letzter, aktion: { a: 'geben', text: 'Geben' } }) + '<div class="spiel-fuss"><button type="button" class="knopf leise klein" data-a="tische">Tisch wechseln</button></div>';
    }

    function baue() {
      const tt = t();
      host.innerHTML = `<div class="sp vp" style="--filz:${tt.filz};--rand:${tt.rand}"><div class="sp-kopf"><button type="button" class="knopf leise klein" data-a="lobby">‹ Lobby</button><span class="sp-tisch">${esc(tt.name)} · ${fmt(tt.min)}–${fmt(tt.max)}</span><button type="button" class="knopf leise klein" data-a="regeln">Regeln</button></div>
        <div class="sp-flaeche">${tabelleHtml()}<div class="vp-karten">${kartenHtml()}</div>${meldungHtml()}</div>
        <div class="sp-steuer" id="sp-steuer">${steuerHtml()}</div></div>`;
      neu = false;
    }
    const steuerNeu = () => { const s = document.getElementById('sp-steuer'); if (s) s.innerHTML = steuerHtml(); };

    function geben() {
      const tt = t();
      if (einsatz < tt.min || einsatz > Math.min(tt.max, Store.chips()) || !Store.nehmen(einsatz)) return hinweis('Einsatz nicht möglich');
      const d = V.austeilen();
      Object.assign(S, { phase: 'halten', einsatz, karten: d.karten, rest: d.rest, halt: [false, false, false, false, false], letzter: einsatz, wertung: null, neue: null });
      Store.speichern(); neu = true; Ton.mischen(); baue(); [0, 1, 2, 3, 4].forEach(i => setTimeout(() => !weg && Ton.karte(), 120 + i * 150));
    }
    function ziehen() {
      const alt = S.karten.slice();
      const r = V.ziehen(S.karten, S.rest, S.halt);
      const aus = r.wertung.mult * S.einsatz;
      Object.assign(S, { karten: r.karten, rest: [], wertung: r.wertung, phase: 'ende', neue: r.karten.map((c, i) => c !== alt[i]) });
      if (aus > 0) Store.gutschreiben(aus);
      Store.statistik('videopoker', 1, aus - S.einsatz);
      einsatz = Math.min(S.einsatz, t().max); Store.speichern();
      baue(); Ton.karte();
      if (r.wertung.mult >= 25) Ton.grosserGewinn(); else if (aus > 0) Ton.gewinn(); else Ton.verlust();
      S.phase = 'einsatz';
      { const g = Math.min(t().max, Store.chips()); if (einsatz > g || einsatz < t().min) einsatz = g >= t().min ? g : 0; S.einsatz = einsatz; }
      Store.speichern(); steuerNeu();
    }

    function regeln() {
      dialog({ titel: 'Video-Poker – Regeln', html: `<ul class="regeln"><li>Du bekommst fünf Karten. Tippe auf die Karten, die du behalten willst, und ziehe Ersatz für den Rest. Danach zählt deine Hand nach der Tabelle oben.</li>
        <li>Gewinnhand ab einem Paar aus Buben, Damen, Königen oder Assen. Die Auszahlung ist ein Vielfaches deines Einsatzes (Royal Flush 800×).</li>
        <li>Der Einsatz wird beim Geben abgebucht. Eine laufende Runde bleibt auch nach dem Neuladen erhalten.</li></ul>` });
    }

    host.addEventListener('click', klick);
    function klick(e) {
      const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
      const a = b.dataset.a;
      const w = wettAktion(a, b.dataset.w, { einsatz, tt: t(), c: Store.chips(), letzter: S.letzter });
      if (w !== undefined) { einsatz = w; S.einsatz = einsatz; return steuerNeu(); }
      switch (a) {
        case 'lobby': return api.zurLobby();
        case 'regeln': return regeln();
        case 'tische': if (S.phase === 'halten') return; ansicht = 'wahl'; return zeige();
        case 'geben': return geben();
        case 'halt': { const i = Number(b.dataset.i); S.halt[i] = !S.halt[i]; Store.speichern(); Ton.klick(); const p = host.querySelectorAll('.vp-platz')[i]; p.classList.toggle('gehalten', S.halt[i]); p.querySelector('.vp-halt').textContent = S.halt[i] ? 'HALTEN' : ''; return; }
        case 'alle': S.halt = [true, true, true, true, true]; Store.speichern(); Ton.klick(); return baue();
        case 'ziehen': return ziehen();
      }
    }
    zeige();
    return { fragen: async () => true, stop() { weg = true; host.removeEventListener('click', klick); host.classList.remove('sp-host'); host.innerHTML = ''; } };
  },
};
