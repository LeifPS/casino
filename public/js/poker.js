// Texas Hold’em: Oberfläche und Verbindung zum Tisch (Durable Object, siehe src/tisch.js).
import * as Store from './store.js';
import { STUFEN } from './poker-stufen.js';
import { TISCHE } from './tische.js';
import { chipSvg, stapelHtml, fmt } from './chips.js';
import { karteHtml } from './cards.js';
import { Ton } from './ton.js';
import { dialog, tischWahl, esc, hinweis, bestaetigen, dom } from './ui.js';

const FRIST_MS = 30000;

// ---------- Verbindung (bleibt bestehen, auch wenn man das Spiel wechselt, bis die Auszahlung da ist) ----------
const netz = { ws: null, letzte: null, hoerer: new Set(), versuch: 0, timer: 0, aus: false, gehen: false, verbunden: false };
const unterwegs = () => Store.state.pokerUnterwegs || null;
function setzeUnterwegs(u) { if (u) Store.state.pokerUnterwegs = u; else delete Store.state.pokerUnterwegs; Store.speichern(); }
const melde = (e, d) => { for (const f of [...netz.hoerer]) { try { f(e, d); } catch (x) { console.error(x); } } };
const neuesToken = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 30) + 'x'; };
const adresse = (raum) => (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/' + raum;
const sende = (o) => { if (netz.ws && netz.ws.readyState === 1) { netz.ws.send(JSON.stringify(o)); return true; } return false; };
function raumMelden(code) { try { window.parent.postMessage({ lgh: 'status', spiel: 'casino', raum: code || '' }, '*'); } catch (e) { } }

function rueckgabe() {
  const u = unterwegs(); if (!u) return 0;
  Store.gutschreiben(u.betrag); setzeUnterwegs(null); return u.betrag;
}

function behandle(m) {
  if (m.t === 'tisch') { netz.letzte = m; melde('tisch', m); }
  else if (m.t === 'ende') {
    const u = unterwegs();
    let betrag = 0;
    if (u) { betrag = m.betrag; if (betrag > 0) Store.gutschreiben(betrag); setzeUnterwegs(null); }
    sende({ t: 'quittung', nr: m.nr });
    netz.letzte = null; netz.aus = true; raumMelden('');
    if (!netz.hoerer.size && betrag > 0) hinweis(`+${fmt(betrag)} Chips vom Pokertisch ausgezahlt`);
    melde('ende', { betrag, grund: m.grund, doppelt: !u });
    setTimeout(() => { try { netz.ws && netz.ws.close(); } catch (e) { } }, 300);
  } else if (m.t === 'ersetzt') { netz.aus = true; melde('ersetzt'); }
  else if (m.t === 'unbekannt') { const b = rueckgabe(); netz.aus = true; netz.letzte = null; melde('ende', { betrag: b, grund: 'unbekannt' }); }
  else if (m.t === 'fehler') hinweis(m.text || 'Fehler');
  else if (m.t === 'willkommen') { netz.versuch = 0; if (netz.gehen) sende({ t: 'gehen' }); melde('willkommen', m); }
}

function anschliessen(ws) {
  netz.ws = ws;
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } behandle(m); };
  ws.onclose = () => { if (netz.ws !== ws) return; netz.verbunden = false; melde('getrennt'); if (!netz.aus && unterwegs()) planeNeu(); };
  netz.verbunden = true;
}
function planeNeu() {
  clearTimeout(netz.timer);
  const warte = Math.min(8000, 700 * 2 ** netz.versuch++);
  netz.timer = setTimeout(wiederverbinden, warte);
}
export function wiederverbinden() {
  const u = unterwegs(); if (!u || !u.raum) return;
  clearTimeout(netz.timer); netz.aus = false;
  if (netz.ws && netz.ws.readyState <= 1) return;
  let ws; try { ws = new WebSocket(adresse(u.raum)); } catch (e) { return planeNeu(); }
  anschliessen(ws);
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hallo', token: u.token, name: u.name, wiederkehr: true }));
}
/** Eine Verbindung zu einem Raum aufbauen und auf die erste Antwort warten: 'ok' | 'voll' | 'fehler' */
function versuche(raum, hallo) {
  return new Promise((fertig) => {
    let ws, fertigGemeldet = false, t = 0;
    const ende = (r) => { if (fertigGemeldet) return; fertigGemeldet = true; clearTimeout(t); if (r !== 'ok') { try { ws.close(); } catch (e) { } } fertig(r); };
    try { ws = new WebSocket(adresse(raum)); } catch (e) { return fertig('fehler'); }
    t = setTimeout(() => ende('fehler'), 9000);
    ws.onopen = () => ws.send(JSON.stringify(hallo));
    ws.onerror = () => ende('fehler'); ws.onclose = () => ende('fehler');
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.t === 'willkommen') { anschliessen(ws); netz.aus = false; ende('ok'); behandle(m); }
      else if (m.t === 'voll') ende('voll');
      else if (m.t === 'fehler') { hinweis(m.text); ende('fehler'); }
    };
  });
}
async function beitreten({ stufe, buyin, name, code }) {
  if (unterwegs()) return { ok: false, fehler: 'Du sitzt schon an einem Tisch.' };
  if (!Store.nehmen(buyin)) return { ok: false, fehler: 'Nicht genug Chips.' };
  const token = neuesToken();
  const u = { token, raum: null, stufe, betrag: buyin, bestaetigt: false, name, seit: Date.now() };
  setzeUnterwegs(u);
  const raeume = code ? [`s${stufe}-p-${code.toLowerCase()}`] : Array.from({ length: 8 }, (_, i) => `s${stufe}-r${i + 1}`);
  let grund = 'Der Tisch ist gerade nicht erreichbar.';
  for (const raum of raeume) {
    u.raum = raum; setzeUnterwegs(u);
    const r = await versuche(raum, { t: 'hallo', token, name, buyin });
    if (r === 'ok') { u.bestaetigt = true; setzeUnterwegs(u); raumMelden(code || ''); return { ok: true }; }
    if (r === 'voll') { grund = code ? 'Dieser private Tisch ist voll.' : 'Alle Tische dieser Stufe sind voll.'; continue; }
    break;
  }
  rueckgabe();
  return { ok: false, fehler: grund };
}
function aufstehen() { netz.gehen = true; if (!sende({ t: 'gehen' })) wiederverbinden(); }

// ---------- Oberfläche ----------
const ALTE = { fold: 'Fold', check: 'Check', call: 'Call', bet: 'Setzt', raise: 'Erhöht', allin: 'All-in', sb: '', bb: '' };
const zufallsCode = () => { const z = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += z[Math.floor(Math.random() * z.length)]; return s; };

export const poker = {
  id: 'poker', name: 'Texas Hold’em', bereit: true, zeile: 'Mit echten Spielern, freie Plätze füllen Computergegner.',
  start(host, api) {
    let ansicht = 'wahl', letzte = null, vorher = { hand: -1, board: 0, lognr: -1, legal: false, ergebnisHand: -1 };
    let raise = { offen: false, wert: 0 }, zeitStempel = 0, weg = false;
    host.classList.add('pk-host');

    function zeige() {
      if (weg) return;
      if (ansicht === 'wahl') return wahl();
      if (ansicht === 'wartet') { host.innerHTML = '<div class="wahl"><div class="wahl-kopf"><h2>Texas Hold’em</h2><p>Verbinde mit dem Tisch …</p></div></div>'; return; }
      if (letzte) zeichne(letzte);
      else host.innerHTML = '<div class="wahl"><div class="wahl-kopf"><h2>Texas Hold’em</h2><p>Verbinde mit dem Tisch …</p></div></div>';
    }

    function wahl() {
      tischWahl(host, {
        titel: 'Texas Hold’em', chips: Store.chips(), aktuell: -1,
        zeilen: (t) => { const s = STUFEN[t.id]; return `<span class="tk-zeile">Blinds <b>${fmt(s.sb)}</b> / <b>${fmt(s.bb)}</b></span><span class="tk-zeile">Buy-in <b>${fmt(s.minBuy)}</b> – <b>${fmt(s.maxBuy)}</b></span>`; },
        buyin: (t) => STUFEN[t.id].minBuy, beiWahl: einkaufen,
      });
      host.querySelector('.wahl-kopf').insertAdjacentHTML('beforeend', '<button type="button" class="knopf leise klein" data-a="lobby">‹ Zurück zur Lobby</button>');
    }

    function einkaufen(stufe) {
      const s = STUFEN[stufe], c = Store.chips();
      const hoechst = Math.min(s.maxBuy, c), start = Math.min(hoechst, Math.max(s.minBuy, Math.round(s.maxBuy / 2 / s.bb) * s.bb));
      const d = dialog({
        titel: `${s.name}: Platz nehmen`,
        html: `<p>Blinds ${fmt(s.sb)} / ${fmt(s.bb)}. Die Chips kommen aus deinem Konto an den Tisch und gehen beim Aufstehen zurück.</p>
          <label class="feld">Dein Name am Tisch<input id="pk-name" type="text" maxlength="14" autocomplete="off" value="${esc(Store.state.name || '')}" placeholder="Name"></label>
          <label class="feld">Buy-in: <b id="pk-bi-wert">${fmt(start)}</b> Chips<input id="pk-bi" type="range" min="${s.minBuy}" max="${hoechst}" step="${s.sb}" value="${start}"></label>
          <div class="schnell"><button type="button" class="knopf klein leise" data-bi="${s.minBuy}">Minimum</button><button type="button" class="knopf klein leise" data-bi="${Math.round((s.minBuy + hoechst) / 2 / s.sb) * s.sb}">Mitte</button><button type="button" class="knopf klein leise" data-bi="${hoechst}">Maximum</button></div>
          <label class="feld klein-feld">Privater Tisch (Code, leer = offener Tisch)<span class="codezeile"><input id="pk-code" type="text" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="z. B. K7M2P"><button type="button" class="knopf klein leise" id="pk-neu">Neuer Code</button></span></label>
          <p class="fehlertext" id="pk-fehler"></p>`,
        knoepfe: [{ text: 'Abbrechen', art: 'leise' }, { text: 'Hinsetzen', art: 'gold', fn: () => { los(); return false; } }],
      });
      const q = (x) => d.el.querySelector(x);
      const bi = q('#pk-bi'), wert = q('#pk-bi-wert');
      const setze = (v) => { v = Math.max(s.minBuy, Math.min(hoechst, Math.round(v / s.sb) * s.sb)); bi.value = v; wert.textContent = fmt(Number(bi.value)); };
      bi.addEventListener('input', () => setze(Number(bi.value)));
      d.el.querySelectorAll('[data-bi]').forEach(b => b.addEventListener('click', () => { Ton.klick(); setze(Number(b.dataset.bi)); }));
      q('#pk-neu').addEventListener('click', () => { q('#pk-code').value = zufallsCode(); });
      q('#pk-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
      async function los() {
        const name = q('#pk-name').value.replace(/[<>&"'`\\]/g, '').trim().slice(0, 14);
        const code = q('#pk-code').value.trim();
        if (!name) { q('#pk-fehler').textContent = 'Bitte gib einen Namen ein.'; return; }
        if (code && code.length < 4) { q('#pk-fehler').textContent = 'Der Code braucht mindestens 4 Zeichen.'; return; }
        Store.state.name = name; Store.speichern();
        d.zu(); ansicht = 'wartet'; zeige();
        const r = await beitreten({ stufe, buyin: Number(bi.value), name, code: code || null });
        if (weg) return;
        if (!r.ok) { ansicht = 'wahl'; zeige(); hinweis(r.fehler); }
        else { ansicht = 'tisch'; letzte = netz.letzte; vorher = { hand: -1, board: 0, lognr: -1, legal: false, ergebnisHand: -1 }; zeige(); }
      }
    }

    // ----- Tisch zeichnen -----
    function sitzHtml(s, i, pos, m) {
      const ich = i === m.ich, akt = m.aktuell === i;
      const gew = m.ergebnis && m.ergebnis.gewinne && m.ergebnis.gewinne[i];
      const karten = (s.karten || []).map((c, k) => c < 0 ? karteHtml(0, { rueck: true }) : karteHtml(c, { neu: undefined })).join('');
      const status = s.gefoldet ? 'Fold' : s.allin ? 'All-in' : (s.letzte && ALTE[s.letzte] ? ALTE[s.letzte] : '');
      const zeit = akt && !s.bot && m.phase !== 'zwischen' ? `<span class="zeit"><i style="--von:${Math.min(1, m.rest / FRIST_MS)};--ms:${m.rest}ms"></i></span>` : '';
      return `<div class="sitz p${pos}${ich ? ' ich' : ''}${akt ? ' aktiv' : ''}${s.gefoldet ? ' gefoldet' : ''}${gew ? ' gewinner' : ''}${s.verbunden === false ? ' offline' : ''}">
        <div class="sitz-karten">${karten}</div>
        <div class="sitz-box"><div class="sitz-name">${esc(s.name)}${s.bot ? '<i>PC</i>' : ''}</div><div class="sitz-stack">${s.stack ? fmt(s.stack) : (s.allin ? 'All-in' : '0')}</div>${status ? `<div class="sitz-status ${s.letzte || ''}">${status}</div>` : ''}${zeit}</div>
        ${gew ? `<div class="gewinn-marke">+${fmt(gew)}</div>` : ''}</div>`;
    }

    function zeichne(m) {
      const stu = STUFEN[m.stufe], tt = TISCHE[m.stufe];
      const pos = (i) => (m.ich >= 0 ? (i - m.ich + 6) % 6 : i);
      const neueHand = m.handNr !== vorher.hand;
      const boardAlt = neueHand ? 0 : vorher.board;
      const board = m.board.map((c, k) => karteHtml(c, { neu: k >= boardAlt ? (k - boardAlt) * 0.6 : undefined })).join('');
      const sitze = m.sitze.map((s, i) => s ? sitzHtml(s, i, pos(i), m) : '').join('');
      const einsaetze = m.sitze.map((s, i) => s && s.einsatz > 0 && m.phase !== 'zwischen' ? `<div class="einsatz b${pos(i)}">${stapelHtml(s.einsatz)}<span>${fmt(s.einsatz)}</span></div>` : '').join('');
      const dpos = m.button >= 0 ? pos(m.button) : -1;
      let mitte = '';
      if (m.phase === 'zwischen' && m.ergebnis) {
        mitte = m.ergebnis.toepfe.map(t => `<div class="ergzeile">${t.gewinner.map(g => esc(m.sitze[g].name)).join(' & ')} ${t.gewinner.length > 1 ? 'teilen' : 'gewinnt'} <b>${fmt(t.betrag)}</b>${t.hand ? ` mit ${t.hand}` : ''}</div>`).join('');
      } else if (m.wartet) mitte = '<div class="ergzeile">Du spielst ab der nächsten Hand mit.</div>';
      else if (m.phase === 'warten') mitte = '<div class="ergzeile">Warte auf die nächste Hand …</div>';
      host.innerHTML = `<div class="pk" style="--filz:${tt.filz};--rand:${tt.rand}">
        <div class="pk-kopf"><button type="button" class="knopf leise klein" data-a="aufstehen">Aufstehen</button><span class="pk-info">${esc(stu.name)} · ${fmt(stu.sb)}/${fmt(stu.bb)}</span><span class="pk-netz${netz.verbunden ? '' : ' aus'}">${netz.verbunden ? '' : 'Verbindung weg …'}</span><button type="button" class="knopf leise klein" data-a="regeln">Regeln</button></div>
        <div class="pk-tisch"><div class="oval"></div>
          <div class="mitte"><div class="board">${board}</div><div class="pot">${m.pot ? `<span class="pot-chip">${chipSvg(m.pot >= 1000 ? 1000 : m.pot >= 100 ? 100 : 25)}</span>Pot <b>${fmt(m.pot)}</b>` : ''}</div><div class="erg">${mitte}</div></div>
          ${einsaetze}${sitze}${dpos >= 0 ? `<div class="dealer d${dpos}">D</div>` : ''}
        </div>
        <div class="pk-steuer">${steuerHtml(m)}</div></div>`;
      // Töne
      if (neueHand && vorher.hand >= 0) Ton.mischen();
      if (m.board.length > boardAlt && !neueHand) Ton.karte(); else if (m.board.length > boardAlt) { /* neue Hand */ }
      if (vorher.lognr < 0) vorher.lognr = m.log.length ? m.log[m.log.length - 1].nr : 0;
      for (const l of m.log) if (l.nr > vorher.lognr) { if (l.a === 'check') Ton.klick(); else if (l.a === 'fold') Ton.karte(); else Ton.chip(); }
      if (m.log.length) vorher.lognr = Math.max(vorher.lognr, m.log[m.log.length - 1].nr);
      if (m.phase === 'zwischen' && m.ergebnis && vorher.ergebnisHand !== m.handNr) {
        vorher.ergebnisHand = m.handNr;
        if (m.ergebnis.gewinne && m.ich >= 0 && m.ergebnis.gewinne[m.ich]) setTimeout(() => (m.ergebnis.gewinne[m.ich] >= stu.bb * 20 ? Ton.grosserGewinn() : Ton.gewinn()), 400);
      }
      if (m.legal && !vorher.legal) { Ton.tick(); setTimeout(() => Ton.tick(), 120); raise = { offen: false, wert: m.legal.minTo }; }
      vorher.legal = !!m.legal; vorher.hand = m.handNr; vorher.board = m.board.length;
      zeitStempel = performance.now();
      bindeRegler();
    }

    function steuerHtml(m) {
      const stu = STUFEN[m.stufe];
      if (m.ich < 0 && !m.wartet) return '<p class="leise-text">Du schaust zu …</p>';
      const eigene = m.meineHand && m.ich >= 0 ? `<div class="meinhand">${esc(m.meineHand)}</div>` : '';
      if (!m.legal) {
        const am = m.aktuell >= 0 && m.sitze[m.aktuell] ? m.sitze[m.aktuell].name : '';
        const text = m.wartet ? 'Du bist gleich dabei …' : m.sitze[m.ich] && m.sitze[m.ich].gefoldet ? 'Du hast gefoldet.' : (am ? `${esc(am)} ist dran …` : '');
        return `${eigene}<p class="leise-text">${text}</p>`;
      }
      const l = m.legal;
      if (raise.offen && l.raise) {
        const w = Math.max(l.minTo, Math.min(l.maxTo, raise.wert || l.minTo));
        const teile = [['Min', l.minTo], ['½ Pot', Math.round(m.hoechster + (m.pot + l.zuZahlen) * 0.5)], ['¾ Pot', Math.round(m.hoechster + (m.pot + l.zuZahlen) * 0.75)], ['Pot', Math.round(m.hoechster + (m.pot + l.zuZahlen))], ['All-in', l.maxTo]];
        return `${eigene}<div class="raise"><div class="raise-kopf"><button type="button" class="knopf klein leise" data-a="raise-minus">−</button><b id="raise-wert">${fmt(w)}</b><button type="button" class="knopf klein leise" data-a="raise-plus">+</button></div>
          <input id="raise-reg" type="range" min="${l.minTo}" max="${l.maxTo}" step="${Math.max(1, stu.sb)}" value="${w}">
          <div class="schnell">${teile.map(([n, v]) => `<button type="button" class="knopf klein leise" data-a="raise-set" data-w="${Math.max(l.minTo, Math.min(l.maxTo, v))}">${n}</button>`).join('')}</div>
          <div class="knoepfe2"><button type="button" class="knopf leise" data-a="raise-zu">Zurück</button><button type="button" class="knopf gold" data-a="raise-ok">${w >= l.maxTo ? 'All-in' : 'Erhöhen auf'} ${fmt(w)}</button></div></div>`;
      }
      return `${eigene}<div class="aktionen3"><button type="button" class="knopf" data-a="fold">Fold</button>
        ${l.check ? '<button type="button" class="knopf gold" data-a="check">Check</button>' : `<button type="button" class="knopf gold" data-a="call">${l.call >= m.sitze[m.ich].stack ? 'All-in ' : 'Call '}${fmt(l.call)}</button>`}
        ${l.raise ? `<button type="button" class="knopf" data-a="raise-auf">${l.zuZahlen === 0 ? 'Setzen' : 'Erhöhen'}</button>` : '<button type="button" class="knopf" disabled>—</button>'}</div>`;
    }

    function aktion(a, w) {
      const m = letzte;
      switch (a) {
        case 'lobby': return api.zurLobby();
        case 'regeln': return regeln();
        case 'aufstehen': return fragenUndAufstehen();
        case 'fold': case 'check': case 'call': Ton.klick(); sende({ t: 'aktion', a }); if (m) m.legal = null; return;
        case 'raise-auf': raise.offen = true; raise.wert = m.legal.minTo; return zeichneSteuer();
        case 'raise-zu': raise.offen = false; return zeichneSteuer();
        case 'raise-set': raise.wert = Number(w); return zeichneSteuer();
        case 'raise-plus': raise.wert = Math.min(m.legal.maxTo, (raise.wert || m.legal.minTo) + STUFEN[m.stufe].bb); return zeichneSteuer();
        case 'raise-minus': raise.wert = Math.max(m.legal.minTo, (raise.wert || m.legal.minTo) - STUFEN[m.stufe].bb); return zeichneSteuer();
        case 'raise-ok': { const v = Math.max(m.legal.minTo, Math.min(m.legal.maxTo, raise.wert || m.legal.minTo)); Ton.chip(); sende({ t: 'aktion', a: v >= m.legal.maxTo ? 'allin' : 'raise', betrag: v }); raise.offen = false; m.legal = null; return zeichneSteuer(); }
      }
    }
    function zeichneSteuer() { const s = host.querySelector('.pk-steuer'); if (s && letzte) { s.innerHTML = steuerHtml(letzte); bindeRegler(); } }
    function bindeRegler() {
      const reg = host.querySelector('#raise-reg'); if (!reg) return;
      reg.addEventListener('input', () => { raise.wert = Number(reg.value); const b = host.querySelector('#raise-wert'); if (b) b.textContent = fmt(raise.wert); const ok = host.querySelector('[data-a=raise-ok]'); if (ok) ok.textContent = `${raise.wert >= letzte.legal.maxTo ? 'All-in' : 'Erhöhen auf'} ${fmt(raise.wert)}`; });
    }

    async function fragenUndAufstehen() {
      const u = unterwegs();
      const ok = await bestaetigen('Aufstehen?', u ? 'Du verlässt den Tisch und bekommst deinen Stapel zurück. Läuft gerade eine Hand, wirfst du sie weg.' : 'Tisch verlassen?', 'Ja, aufstehen');
      if (ok) { aufstehen(); }
    }
    function regeln() {
      dialog({ titel: 'Texas Hold’em – Regeln', html: `<ul class="regeln">
        <li>No Limit, bis zu 6 Plätze. Jeder bekommt zwei Karten, dazu kommen fünf Gemeinschaftskarten (Flop, Turn, River). Die beste Hand aus fünf Karten gewinnt.</li>
        <li>Freie Plätze füllen Computergegner (PC). Setzt sich ein Mensch dazu, räumt ein PC nach der Hand den Platz.</li>
        <li>Die Reihenfolge der Hände: Royal Flush, Straight Flush, Vierling, Full House, Flush, Straße, Drilling, Zwei Paare, Ein Paar, Hohe Karte.</li>
        <li>Mindesterhöhung: so viel wie die letzte Erhöhung. All-in geht immer. Bei All-in entstehen Nebentöpfe.</li>
        <li>Du hast ${FRIST_MS / 1000} Sekunden pro Zug, danach wird automatisch gecheckt oder gefoldet. Bei Verbindungsabbruch hält der Tisch deinen Platz etwa 90 Sekunden.</li>
        <li>Buy-in: 20 bis 100 große Blinds. Die Chips liegen am Tisch, bis du aufstehst. Mit einem Code kannst du einen privaten Tisch für Freunde eröffnen.</li></ul>` });
    }

    const klick = (e) => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; aktion(b.dataset.a, b.dataset.w); };
    host.addEventListener('click', klick);

    const hoerer = (ev, d) => {
      if (weg) return;
      if (ev === 'tisch') {
        letzte = d;
        if (ansicht === 'tisch') {
          const u = host.querySelector('.pk-steuer');
          zeichne(d); bindeRegler();
        }
      } else if (ev === 'getrennt') { if (ansicht === 'tisch' && letzte) zeichne(letzte); }
      else if (ev === 'willkommen') { netz.letzte && (letzte = netz.letzte); }
      else if (ev === 'ende') {
        ansicht = 'wahl'; letzte = null; zeige();
        if (d.betrag > 0) hinweis(`+${fmt(d.betrag)} Chips ausgezahlt`);
        else if (d.grund === 'pleite') hinweis('Deine Chips am Tisch sind aufgebraucht.');
        else if (d.grund === 'getrennt') hinweis('Du warst zu lange getrennt, der Tisch hat dich ausgezahlt.');
      } else if (ev === 'ersetzt') { ansicht = 'wahl'; letzte = null; zeige(); hinweis('Du bist an diesem Tisch in einem anderen Fenster angemeldet.'); }
    };
    netz.hoerer.add(hoerer);

    const stopper = [];
    // Start: war schon jemand am Tisch (Neuladen, Verbindungsabbruch)? Dann dort weitermachen.
    if (unterwegs()) {
      ansicht = 'wartet'; netz.gehen = false;
      if (netz.letzte) { ansicht = 'tisch'; letzte = netz.letzte; }
      else if (!netz.ws || netz.ws.readyState > 1) { netz.aus = false; wiederverbinden(); }
      if (unterwegs() && ansicht === 'wartet') {
        // Wenn der Tisch gleich antwortet, wechselt hoerer() über 'tisch'; sicherheitshalber:
        const frage = setInterval(() => { if (weg) return clearInterval(frage); if (netz.letzte) { clearInterval(frage); ansicht = 'tisch'; letzte = netz.letzte; zeige(); } }, 400);
        stopper.push(() => clearInterval(frage));
      }
    }
    zeige();

    return {
      fragen: async () => {
        if (!unterwegs() || ansicht === 'wahl') return true;
        const ok = await bestaetigen('Spiel wechseln?', 'Du sitzt am Pokertisch. Wenn du jetzt gehst, stehst du auf: du bekommst deinen Stapel zurück und eine laufende Hand ist weg.', 'Ja, aufstehen');
        if (ok) aufstehen();
        return ok;
      },
      stop() { weg = true; netz.hoerer.delete(hoerer); stopper.forEach(f => f()); host.removeEventListener('click', klick); host.classList.remove('pk-host'); host.innerHTML = ''; },
    };
  },
};
export const pokerUnterwegs = unterwegs;
export { wiederverbinden as pokerWiederverbinden };
