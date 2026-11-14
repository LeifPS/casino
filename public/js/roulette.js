// Roulette: Oberfläche. Regeln stehen in rl-engine.js.
import * as Store from './store.js';
import { tisch } from './tische.js';
import { chipSvg, setzChips, stapelHtml, zerlege, fmt } from './chips.js';
import { Ton } from './ton.js';
import * as R from './rl-engine.js';
import { dialog, tischWahl, warte, esc, hinweis } from './ui.js';

const rl = () => Store.state.rl || (Store.state.rl = { verlauf: [], tisch: 0, letzte: null, offen: null });
const vorz = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));
const ARTEN = { plein: 'Zahl', cheval: 'Split', transversale: 'Straße', carre: 'Ecke', sechser: 'Sechserreihe', dutzend: 'Dutzend', kolonne: 'Kolonne', aussen: '' };
const NAME = (k) => { const w = R.wette(k); if (!w) return k; if (w.art === 'aussen') return R.AUSSEN_NAMEN[k]; if (w.art === 'dutzend') return `${k.slice(2)}. Dutzend`; if (w.art === 'kolonne') return `${k.slice(2)}. Kolonne`; return `${ARTEN[w.art]} ${w.zahlen.length > 1 ? w.zahlen.join('/') : w.zahlen[0]}`; };

/** Eine noch offene (unterbrochene) Drehung abrechnen: Einsatz ist schon abgebucht, die Auszahlung kommt jetzt. */
export function rouletteRetten() {
  const s = Store.state.rl; if (!s || !s.offen) return 0;
  const o = s.offen; s.offen = null;
  if (o.auszahlung > 0) Store.gutschreiben(o.auszahlung);
  Store.statistik('roulette', 1, o.auszahlung - o.gesamt);
  s.verlauf = [o.zahl, ...s.verlauf].slice(0, 14);
  Store.speichern();
  return o.auszahlung;
}

function radSvg() {
  const n = 37, st = 360 / n, R1 = 96, R0 = 62;
  const pt = (a, r) => { const t = (a - 90) * Math.PI / 180; return `${(Math.cos(t) * r).toFixed(2)},${(Math.sin(t) * r).toFixed(2)}`; };
  let keile = '';
  R.RAD.forEach((z, i) => {
    const a0 = (i - .5) * st, a1 = (i + .5) * st, f = { gruen: '#1b8a4a', rot: '#c4262e', schwarz: '#17171c' }[R.farbe(z)];
    keile += `<path d="M${pt(a0, R0)} L${pt(a0, R1)} A${R1},${R1} 0 0 1 ${pt(a1, R1)} L${pt(a1, R0)} A${R0},${R0} 0 0 0 ${pt(a0, R0)}Z" fill="${f}" stroke="#e8c56a" stroke-width=".7"/>` +
      `<text transform="rotate(${i * st}) translate(0,-80)" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="700" fill="#fff" font-family="Arial,sans-serif">${z}</text>`;
  });
  return `<svg viewBox="-104 -104 208 208" class="rad" aria-hidden="true"><circle r="103" fill="#4a2a12" stroke="#e8c56a" stroke-width="2"/>
    <g id="rl-rad" class="rad-dreh">${keile}<circle r="60" fill="#2a1a0c" stroke="#e8c56a" stroke-width="1.5"/><circle r="34" fill="#d9a521"/><circle r="30" fill="#f0c447"/><path d="M0,-28 V28 M-28,0 H28" stroke="#8a5d0e" stroke-width="3"/><circle r="6" fill="#8a5d0e"/></g>
    <g id="rl-ball" class="ball-dreh"><circle id="rl-kugel" cx="0" cy="-99" r="5" fill="#fff" stroke="#999" stroke-width=".8"/></g>
    <path d="M-7,-107 L7,-107 L0,-96Z" fill="#ffe27a" stroke="#000" stroke-width=".6"/></svg>`;
}

export const roulette = {
  id: 'roulette', name: 'Roulette', bereit: true, zeile: 'Setze auf Zahlen, Farben und Felder.',
  start(host, api) {
    rouletteRetten();
    const S = rl();
    let ansicht = S.tisch >= 0 && Store.chips() >= tisch(S.tisch).buyin && S.gewaehlt ? 'tisch' : 'wahl';
    let wetten = {}, verlaufAktionen = [], gewaehlt = 0, dreht = false, weg = false, letzteAuszahlung = null, hoch = false;
    const mq = matchMedia('(min-aspect-ratio: 13/10)');
    host.classList.add('rl-host');
    const t = () => tisch(S.tisch);
    const summe = () => Object.values(wetten).reduce((a, b) => a + b, 0);

    function zeige() {
      if (weg) return;
      if (ansicht === 'wahl') {
        tischWahl(host, {
          titel: 'Roulette', chips: Store.chips(), aktuell: -1,
          zeilen: (x) => `<span class="tk-zeile">Pro Feld <b>${fmt(x.min)}</b> – <b>${fmt(x.max)}</b></span><span class="tk-zeile">Zahl bis <b>${fmt(R.limitFuer('n:1', x.max))}</b></span>`,
          info: () => 'Europäisch, eine Null',
          beiWahl: (id) => { S.tisch = id; S.gewaehlt = true; Store.speichern(); wetten = {}; verlaufAktionen = []; gewaehlt = 0; ansicht = 'tisch'; zeige(); },
        });
        host.querySelector('.wahl-kopf').insertAdjacentHTML('beforeend', '<button type="button" class="knopf leise klein" data-a="lobby">‹ Zurück zur Lobby</button>');
        return;
      }
      hoch = !mq.matches;
      baue();
    }

    // ----- Tisch bauen -----
    function gitterHtml() {
      const zel = (n) => {
        const c = Math.floor((n - 1) / 3), r = (n - 1) % 3;
        const [x, y] = hoch ? [r + 3, c + 2] : [c + 2, 3 - r];
        return `<button type="button" class="rl-z f-${R.farbe(n)}" data-n="${n}" style="grid-column:${x};grid-row:${y}"><span>${n}</span></button>`;
      };
      let h = '';
      if (hoch) {
        h += `<button type="button" class="rl-z f-gruen" data-n="0" style="grid-column:3 / span 3;grid-row:1"><span>0</span></button>`;
        for (let n = 1; n <= 36; n++) h += zel(n);
        [['niedrig', 2, 3], ['gerade', 4, 5], ['rot', 6, 7], ['schwarz', 8, 9], ['ungerade', 10, 11], ['hoch', 12, 13]].forEach(([k, a, b]) => { h += `<button type="button" class="rl-a ${k === 'rot' ? 'f-rot' : k === 'schwarz' ? 'f-schwarz' : ''}" data-k="${k}" style="grid-column:1;grid-row:${a} / ${b + 1}"><span>${R.AUSSEN_NAMEN[k]}</span></button>`; });
        [1, 2, 3].forEach(d => { h += `<button type="button" class="rl-a" data-k="d:${d}" style="grid-column:2;grid-row:${(d - 1) * 4 + 2} / span 4"><span>${d}. Dutzend</span></button>`; });
        [1, 2, 3].forEach(k => { h += `<button type="button" class="rl-a" data-k="k:${k}" style="grid-column:${k + 2};grid-row:14"><span>2 : 1</span></button>`; });
      } else {
        h += `<button type="button" class="rl-z f-gruen" data-n="0" style="grid-column:1;grid-row:1 / span 3"><span>0</span></button>`;
        for (let n = 1; n <= 36; n++) h += zel(n);
        [1, 2, 3].forEach(k => { h += `<button type="button" class="rl-a" data-k="k:${k}" style="grid-column:14;grid-row:${4 - k}"><span>2 : 1</span></button>`; });
        [1, 2, 3].forEach(d => { h += `<button type="button" class="rl-a" data-k="d:${d}" style="grid-column:${(d - 1) * 4 + 2} / span 4;grid-row:4"><span>${d}. Dutzend</span></button>`; });
        [['niedrig', 2], ['gerade', 4], ['rot', 6], ['schwarz', 8], ['ungerade', 10], ['hoch', 12]].forEach(([k, a]) => { h += `<button type="button" class="rl-a ${k === 'rot' ? 'f-rot' : k === 'schwarz' ? 'f-schwarz' : ''}" data-k="${k}" style="grid-column:${a} / span 2;grid-row:5"><span>${R.AUSSEN_NAMEN[k]}</span></button>`; });
      }
      return h;
    }

    function baue() {
      const tt = t(), c = Store.chips();
      host.innerHTML = `<div class="rl ${hoch ? 'hoch' : 'quer'}" style="--filz:${tt.filz};--rand:${tt.rand}">
        <div class="rl-kopf"><button type="button" class="knopf leise klein" data-a="lobby">‹ Lobby</button><span class="rl-tisch">${esc(tt.name)} · ${fmt(tt.min)}–${fmt(tt.max)}</span><button type="button" class="knopf leise klein" data-a="tisch">Tisch</button><button type="button" class="knopf leise klein" data-a="regeln">Regeln</button></div>
        <div class="rl-oben"><div class="rl-rad">${radSvg()}</div><div class="rl-info"><div class="rl-verlauf" id="rl-verlauf"></div><div class="rl-meldung" id="rl-meldung"></div></div></div>
        <div class="rl-tafel"><div class="rl-gitter" id="rl-gitter">${gitterHtml()}<div class="rl-chips" id="rl-marker"></div></div></div>
        <div class="rl-steuer"><div class="rl-einsatz">Einsatz <b id="rl-summe">0</b></div><div class="chipreihe" id="rl-tray"></div>
          <div class="rl-knoepfe"><button type="button" class="knopf leise" data-a="zurueck">Zurück</button><button type="button" class="knopf leise" data-a="loeschen">Löschen</button><button type="button" class="knopf leise" data-a="doppelt">×2</button><button type="button" class="knopf leise" data-a="wieder">Nochmal</button><button type="button" class="knopf gold gross" data-a="drehen">Drehen</button></div></div></div>`;
      verlauf(); tray(); markerNeu(); steuerStand();
      if (letzteAuszahlung !== null) meldung();
    }

    function verlauf() {
      const v = document.getElementById('rl-verlauf'); if (!v) return;
      v.innerHTML = S.verlauf.slice(0, 12).map(z => `<span class="vz f-${R.farbe(z)}">${z}</span>`).join('') || '<span class="leise-text">Noch keine Zahlen</span>';
    }
    function tray() {
      const tr = document.getElementById('rl-tray'); if (!tr) return;
      const tt = t(), liste = setzChips(tt.min, tt.max);
      if (!liste.includes(gewaehlt)) gewaehlt = liste.includes(tt.min) ? tt.min : liste[0];
      tr.innerHTML = liste.map(w => `<button type="button" class="chipknopf${w === gewaehlt ? ' gewaehlt' : ''}" data-a="chip" data-w="${w}" aria-label="${fmt(w)} Chips" aria-pressed="${w === gewaehlt}"${dreht ? ' disabled' : ''}>${chipSvg(w)}</button>`).join('');
    }
    function steuerStand() {
      const s = document.getElementById('rl-summe'); if (s) s.textContent = fmt(summe());
      const q = (a) => host.querySelector(`[data-a=${a}]`);
      const leer = !summe();
      if (q('drehen')) q('drehen').disabled = dreht || leer;
      if (q('zurueck')) q('zurueck').disabled = dreht || !verlaufAktionen.length;
      if (q('loeschen')) q('loeschen').disabled = dreht || leer;
      if (q('doppelt')) q('doppelt').disabled = dreht || leer || !kannVerdoppeln();
      if (q('wieder')) q('wieder').disabled = dreht || !S.letzte || !leer || !kannWieder();
      host.querySelectorAll('.rl-z, .rl-a').forEach(b => b.disabled = dreht);
    }
    const limit = (k) => R.limitFuer(k, t().max);
    const kannVerdoppeln = () => summe() * 2 <= Store.chips() && Object.entries(wetten).every(([k, b]) => b * 2 <= limit(k));
    const kannWieder = () => { const s = Object.values(S.letzte || {}).reduce((a, b) => a + b, 0); return s > 0 && s <= Store.chips() && Object.entries(S.letzte).every(([k, b]) => b <= limit(k) && b >= t().min); };

    // ----- Setzen -----
    function wahlSchluessel(zelle, e) {
      const n = Number(zelle.dataset.n), r = zelle.getBoundingClientRect();
      let fx = .5, fy = .5;
      if (e && (e.clientX || e.clientY)) { fx = (e.clientX - r.left) / r.width; fy = (e.clientY - r.top) / r.height; }
      const rand = 0.27;
      if (n === 0) {
        // Rand zu den Zahlen: Split mit 1, 2 oder 3
        const nah = hoch ? fy > 1 - rand : fx > 1 - rand;
        if (!nah) return 'n:0';
        const pos = hoch ? fx : 1 - fy;   // 0..1 entlang der Reihe 1-2-3
        return `s:0-${1 + Math.min(2, Math.floor(pos * 3))}`;
      }
      const c = Math.floor((n - 1) / 3), v = (n - 1) % 3;
      let du, dv;
      if (hoch) { du = fy < rand ? -1 : fy > 1 - rand ? 1 : 0; dv = fx < rand ? -1 : fx > 1 - rand ? 1 : 0; }
      else { du = fx < rand ? -1 : fx > 1 - rand ? 1 : 0; dv = fy < rand ? 1 : fy > 1 - rand ? -1 : 0; }
      if (v + dv > 2) dv = 0;
      if (c + du > 11) du = 0;
      if (c + du < 0) return c === 0 && du === -1 ? `s:0-${n}` : `n:${n}`;
      if (v + dv < 0) {   // Außenkante auf der Seite von Reihe 1: Straße bzw. Sechserreihe
        if (du === 0) return `t:${3 * c + 1}`;
        return `l:${3 * Math.min(c, c + du) + 1}`;
      }
      const m = (cc, vv) => 3 * cc + vv + 1;
      if (du && dv) { const zs = [m(c, v), m(c + du, v), m(c, v + dv), m(c + du, v + dv)].sort((a, b) => a - b); return `c:${zs.join('-')}`; }
      if (du || dv) { const zs = [n, m(c + du, v + dv)].sort((a, b) => a - b); return `s:${zs.join('-')}`; }
      return `n:${n}`;
    }

    function setze(key) {
      if (dreht || !R.wette(key)) return;
      const tt = t(), alt = wetten[key] || 0, lim = limit(key);
      let add = alt ? gewaehlt : Math.max(gewaehlt, tt.min);
      if (alt + add > lim) { if (alt >= lim) return hinweis(`Höchsteinsatz an diesem Feld: ${fmt(lim)}`); add = lim - alt; if (!alt && add < tt.min) return hinweis(`Mindesteinsatz ${fmt(tt.min)}`); }
      if (summe() + add > Store.chips()) return hinweis('Nicht genug Chips');
      wetten[key] = alt + add; verlaufAktionen.push({ key, add });
      Ton.chip(); aktualisiere(key);
    }
    function aktualisiere(key) { markerNeu(); steuerStand(); if (key) hell(key); }
    function hell(key) {
      const w = R.wette(key); if (!w) return;
      const zs = [];
      w.zahlen.forEach(n => { const el = host.querySelector(`.rl-z[data-n="${n}"]`); if (el) { el.classList.add('hi'); zs.push(el); } });
      if (w.art === 'aussen' || w.art === 'dutzend' || w.art === 'kolonne') { const el = host.querySelector(`.rl-a[data-k="${key}"]`); if (el) { el.classList.add('hi'); zs.push(el); } }
      setTimeout(() => zs.forEach(e => e.classList.remove('hi')), 900);
    }

    function marker(key, betrag) {
      const g = document.getElementById('rl-gitter'); if (!g) return '';
      let x, y;
      const w = R.wette(key);
      const el = host.querySelector(`.rl-a[data-k="${key}"]`);
      if (el) { x = el.offsetLeft + el.offsetWidth / 2; y = el.offsetTop + el.offsetHeight / 2; }
      else {
        const els = w.zahlen.map(n => host.querySelector(`.rl-z[data-n="${n}"]`)).filter(Boolean);
        const x0 = Math.min(...els.map(e => e.offsetLeft)), x1 = Math.max(...els.map(e => e.offsetLeft + e.offsetWidth));
        const y0 = Math.min(...els.map(e => e.offsetTop)), y1 = Math.max(...els.map(e => e.offsetTop + e.offsetHeight));
        x = (x0 + x1) / 2; y = (y0 + y1) / 2;
        if (w.art === 'transversale' || w.art === 'sechser') { if (hoch) x = x0; else y = y1; }
        if (w.art === 'cheval' && w.zahlen[0] === 0) { /* Mitte der Kante */ }
      }
      const z = zerlege(betrag)[0];
      return `<div class="mk" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px">${chipSvg(z ? z.w : 1)}<span>${betrag >= 10000 ? (betrag >= 1e6 ? (betrag / 1e6).toFixed(1).replace('.0', '') + 'M' : Math.round(betrag / 1000) + 'K') : betrag}</span></div>`;
    }
    function markerNeu() { const m = document.getElementById('rl-marker'); if (m) m.innerHTML = Object.entries(wetten).map(([k, b]) => marker(k, b)).join(''); }

    function meldung(text, art) {
      const m = document.getElementById('rl-meldung'); if (!m) return;
      if (text !== undefined) { m.innerHTML = text; m.className = 'rl-meldung ' + (art || ''); return; }
    }

    // ----- Drehen -----
    async function drehe() {
      if (dreht || !summe()) return;
      const gesamt = summe();
      if (!Store.nehmen(gesamt)) return hinweis('Nicht genug Chips');
      const zahl = R.drehen(), erg = R.abrechnen(wetten, zahl);
      S.offen = { zahl, gesamt, auszahlung: erg.auszahlung, wetten: { ...wetten } };
      S.letzte = { ...wetten }; Store.speichern();
      dreht = true; steuerStand(); tray(); meldung('', '');
      await animation(zahl);
      if (weg) return;
      // Abrechnung
      if (S.offen) { rouletteRetten(); }
      dreht = false;
      wetten = {}; verlaufAktionen = []; letzteAuszahlung = erg.netto;
      verlauf(); markerNeu();
      const farbT = { gruen: 'Grün', rot: 'Rot', schwarz: 'Schwarz' }[R.farbe(zahl)];
      meldung(`<span class="rl-zahl f-${R.farbe(zahl)}">${zahl}</span><span class="rl-erg ${erg.netto > 0 ? 'gut' : erg.netto < 0 ? 'schlecht' : ''}">${erg.netto > 0 ? 'Gewonnen ' : erg.netto < 0 ? 'Verloren ' : 'Gleich '}${vorz(erg.netto)}</span>`, 'da');
      host.querySelectorAll('.rl-z.treffer').forEach(e => e.classList.remove('treffer'));
      const tz = host.querySelector(`.rl-z[data-n="${zahl}"]`); if (tz) tz.classList.add('treffer');
      if (erg.netto > 0) (erg.netto >= gesamt * 10 ? Ton.grosserGewinn() : Ton.gewinn()); else if (erg.netto < 0) Ton.verlust(); else Ton.gleich();
      steuerStand(); tray();
      if (Store.chips() < t().buyin) hinweis('Nicht mehr genug Chips für diesen Tisch.');
    }

    async function animation(zahl) {
      const rad = document.getElementById('rl-rad'), ball = document.getElementById('rl-ball'), kugel = document.getElementById('rl-kugel');
      if (!rad) return;
      const idx = R.RAD.indexOf(zahl), st = 360 / 37;
      const kurz = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const dauer = kurz ? 400 : 4600;
      rad.style.transition = 'none'; ball.style.transition = 'none'; kugel.style.transition = 'none';
      rad.style.transform = 'rotate(0deg)'; ball.style.transform = 'rotate(0deg)'; kugel.setAttribute('cy', '-99'); kugel.style.transform = '';
      void rad.getBoundingClientRect();
      rad.style.transition = `transform ${dauer}ms cubic-bezier(.15,.55,.2,1)`;
      ball.style.transition = `transform ${dauer}ms cubic-bezier(.2,.6,.15,1)`;
      rad.style.transform = `rotate(${360 * 3 - idx * st}deg)`;
      ball.style.transform = `rotate(${-360 * 6}deg)`;
      Ton.drehen();
      if (!kurz) {
        // Klacken, das langsamer wird
        let ms = 90, t0 = performance.now();
        while (performance.now() - t0 < dauer - 600 && !weg) { Ton.kugel(); ms = Math.min(520, ms * 1.075); await warte(ms); }
        kugel.style.transition = 'transform .45s ease-in'; kugel.style.transform = 'translateY(20px)';
        await warte(500); Ton.kugel(); await warte(150); Ton.kugel(); await warte(200);
      } else await warte(dauer);
    }

    function regeln() {
      const tt = t();
      dialog({ titel: 'Roulette – Regeln', html: `<ul class="regeln">
        <li>Europäisches Roulette mit 37 Feldern (0 bis 36). Tippe ein Feld, um den gewählten Chip zu setzen. Mehrere Tipps sind möglich.</li>
        <li>Tippst du auf die Kante oder Ecke zwischen Zahlen, setzt du auf mehrere zugleich: zwei Zahlen (Split, 17:1), vier (Ecke, 8:1), drei (Straße, 11:1) oder sechs (Sechserreihe, 5:1). Die Straße setzt du an der äußeren Kante der Reihe zum Dutzend-Feld hin.</li>
        <li>Einzelne Zahl 35:1, Dutzend und Kolonne 2:1, Rot/Schwarz, Gerade/Ungerade und 1–18/19–36 jeweils 1:1. Bei der 0 verlieren alle diese Außenwetten.</li>
        <li>Tisch ${esc(tt.name)}: pro Feld ${fmt(tt.min)} bis ${fmt(tt.max)}, auf eine einzelne Zahl höchstens ${fmt(R.limitFuer('n:1', tt.max))}.</li>
        <li>„Nochmal“ wiederholt die Einsätze der letzten Drehung, „×2“ verdoppelt alle.</li></ul>` });
    }

    // ----- Bedienung -----
    host.addEventListener('click', klick);
    function klick(e) {
      const z = e.target.closest('.rl-z'), a = e.target.closest('.rl-a'), b = e.target.closest('[data-a]');
      if (z && host.contains(z)) { setze(wahlSchluessel(z, e)); return; }
      if (a && host.contains(a)) { setze(a.dataset.k); return; }
      if (!b || b.disabled) return;
      switch (b.dataset.a) {
        case 'lobby': return api.zurLobby();
        case 'tisch': if (dreht) return; wetten = {}; verlaufAktionen = []; ansicht = 'wahl'; return zeige();
        case 'regeln': return regeln();
        case 'chip': Ton.klick(); gewaehlt = Number(b.dataset.w); return tray();
        case 'zurueck': { const l = verlaufAktionen.pop(); if (!l) return; wetten[l.key] -= l.add; if (wetten[l.key] <= 0) delete wetten[l.key]; Ton.klick(); return aktualisiere(); }
        case 'loeschen': wetten = {}; verlaufAktionen = []; Ton.klick(); return aktualisiere();
        case 'doppelt': if (!kannVerdoppeln()) return; for (const k of Object.keys(wetten)) { verlaufAktionen.push({ key: k, add: wetten[k] }); wetten[k] *= 2; } Ton.chips(); return aktualisiere();
        case 'wieder': if (!kannWieder()) return; wetten = { ...S.letzte }; verlaufAktionen = Object.entries(wetten).map(([key, add]) => ({ key, add })); Ton.chips(); letzteAuszahlung = null; meldung('', ''); return aktualisiere();
        case 'drehen': return drehe();
      }
    }
    const umbau = () => { if (ansicht === 'tisch' && !dreht && !weg) baue(); };
    mq.addEventListener('change', umbau);
    window.addEventListener('resize', markerNeuSpaeter);
    let rz = 0; function markerNeuSpaeter() { clearTimeout(rz); rz = setTimeout(() => { if (ansicht === 'tisch' && !weg) markerNeu(); }, 120); }
    zeige();
    return {
      fragen: async () => true,
      stop() { weg = true; host.removeEventListener('click', klick); mq.removeEventListener('change', umbau); window.removeEventListener('resize', markerNeuSpaeter); host.classList.remove('rl-host'); host.innerHTML = ''; },
    };
  },
};
