(function () {
  'use strict';

  var SCHLUESSEL = 'casino.spielstand.v1';
  var FORMAT = new Intl.NumberFormat('de-DE');
  var SUITS = ['♠', '♥', '♦', '♣'];
  var TISCHE = [
    { id: 'einsteiger', name: 'Einsteiger', buyMin: 100, buyMax: 1000, maxBet: 100, klasse: 'Einsteiger' },
    { id: 'klassik', name: 'Klassik', buyMin: 500, buyMax: 3000, maxBet: 500, klasse: 'Klassik' },
    { id: 'salon', name: 'Salon', buyMin: 2000, buyMax: 10000, maxBet: 2500, klasse: 'Salon' }
  ];
  var POKER_TISCHE = [
    { id: 'low', name: 'Einsteiger', buyMin: 100, buyMax: 1000, sb: 1, bb: 2 },
    { id: 'classic', name: 'Klassik', buyMin: 500, buyMax: 3000, sb: 5, bb: 10 },
    { id: 'salon', name: 'Salon', buyMin: 2000, buyMax: 10000, sb: 25, bb: 50 }
  ];
  var STUFEN = [
    [1, 'Grau', 'chip-gray'], [5, 'Rot', 'chip-red'], [10, 'Dunkelblau', 'chip-blue'], [25, 'Dunkelgrün', 'chip-green'],
    [50, 'Hellblau', 'chip-lightblue'], [100, 'Schwarz', 'chip-black'], [500, 'Lila', 'chip-purple'], [1000, 'Gold', 'chip-gold'],
    [5000, 'Pink', 'chip-pink'], [10000, 'Braun', 'chip-brown'], [25000, 'Smaragd', 'chip-gradient g-emerald'],
    [50000, 'Saphir', 'chip-gradient g-sapphire'], [100000, 'Amethyst', 'chip-gradient g-amethyst'], [500000, 'Aurora', 'chip-gradient g-aurora'], [1000000, 'Sonnenaufgang', 'chip-gradient g-sunrise']
  ];

  function standard() { return { balance: 1000, rettung: false, tisch: TISCHE[0].id, ton: true, sitzung: null, pokerName: '', poker: null, pokerCredited: [], roulette: { chip: 1, target: 'red', bets: [], history: [], result: null } }; }
  function validRouletteTarget(t) { return /^(n:(?:[0-9]|[12][0-9]|3[0-6])|red|black|even|odd|low|high|d[1-3]|c[1-3])$/.test(String(t || '')); }
  function laden() {
    try {
      var v = JSON.parse(localStorage.getItem(SCHLUESSEL));
      if (!v || typeof v !== 'object') return standard();
      return {
        balance: Math.max(0, Math.floor(Number(v.balance) || 0)),
        rettung: v.rettung === true,
        tisch: TISCHE.some(function (t) { return t.id === v.tisch; }) ? v.tisch : TISCHE[0].id,
        ton: v.ton !== false,
        sitzung: v.sitzung && typeof v.sitzung === 'object' ? v.sitzung : null,
        pokerName: typeof v.pokerName === 'string' ? v.pokerName.slice(0, 16) : '',
        poker: v.poker && typeof v.poker === 'object' ? v.poker : null,
        pokerCredited: Array.isArray(v.pokerCredited) ? v.pokerCredited.slice(-30) : [],
        roulette: v.roulette && typeof v.roulette === 'object' ? {
          chip: [1,5,10,25,50].indexOf(Number(v.roulette.chip)) >= 0 ? Number(v.roulette.chip) : 1,
          target: validRouletteTarget(v.roulette.target) ? v.roulette.target : 'red',
          bets: Array.isArray(v.roulette.bets) ? v.roulette.bets.filter(function (b) { return b && validRouletteTarget(b.target) && Number.isSafeInteger(Number(b.amount)) && Number(b.amount) > 0; }).slice(0, 80).map(function (b) { return { target: b.target, amount: Math.min(500, Number(b.amount)) }; }) : [],
          history: Array.isArray(v.roulette.history) ? v.roulette.history.filter(function (n) { return Number.isInteger(n) && n >= 0 && n <= 36; }).slice(-8) : [],
          result: Number.isInteger(v.roulette.result) && v.roulette.result >= 0 && v.roulette.result <= 36 ? v.roulette.result : null,
          lastReturn: Number.isSafeInteger(Number(v.roulette.lastReturn)) ? Math.max(0, Number(v.roulette.lastReturn)) : 0,
          lastStake: Number.isSafeInteger(Number(v.roulette.lastStake)) ? Math.max(0, Number(v.roulette.lastStake)) : 0
        } : { chip: 1, target: 'red', bets: [], history: [], result: null }
      };
    } catch (e) { return standard(); }
  }
  var daten = laden();
  function sichern() { try { localStorage.setItem(SCHLUESSEL, JSON.stringify(daten)); } catch (e) {} }
  function tisch() { return TISCHE.find(function (t) { return t.id === daten.tisch; }) || TISCHE[0]; }
  function zahl(n) { return FORMAT.format(Math.floor(Number(n) || 0)); }
  function gesamt() {
    var sum = daten.balance + (daten.sitzung ? Math.max(0, Number(daten.sitzung.stack) || 0) : 0);
    if (daten.poker) {
      var me = pokerView && pokerView.players && pokerView.players.find(function (p) { return p.id === daten.poker.id; });
      sum += me ? Math.max(0, Number(me.stack) || 0) : Math.max(0, Number(daten.poker.buyIn) || 0);
    }
    return sum;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]; }); }
  function zufall(max) { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % max; }
  function ton(f, dauer) {
    if (!daten.ton) return;
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      var c = ton.ctx || (ton.ctx = new C());
      if (c.state === 'suspended') c.resume();
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.06, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + dauer);
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dauer);
    } catch (e) {}
  }
  var screen = document.getElementById('screen');
  var walletTotal = document.getElementById('wallet-total');

  function updateWallet() { walletTotal.textContent = zahl(gesamt()); }
  function home() {
    updateWallet();
    var resumed = daten.sitzung;
    var cards = '<div class="preview-light"></div><div class="preview-cards"><div class="preview-card"><span class="card-rank">A</span><span class="card-suit card-red">♥</span></div><div class="preview-card"><span class="card-rank">K</span><span class="card-suit">♠</span></div></div><div class="preview-chip"></div><div class="preview-caption">BLACKJACK · 21</div>';
    var options = TISCHE.map(function (t) {
      var selected = t.id === daten.tisch;
      var lock = daten.balance < t.buyMin;
      return '<button class="table-option' + (selected ? ' selected' : '') + '" data-table="' + t.id + '" ' + (lock ? 'disabled' : '') + '>' +
        '<span class="table-name">' + t.name + '</span><span class="table-rate">Max ' + zahl(t.maxBet) + '</span>' +
        '<span class="table-limits">Buy-in ' + zahl(t.buyMin) + '–' + zahl(t.buyMax) + '</span></button>';
    }).join('');
    var stage = STUFEN.map(function (s) { return '<span class="mini-chip ' + s[2] + '" title="' + esc(s[1]) + '">' + zahl(s[0]) + '</span>'; }).join('');
    var notfall = !daten.sitzung && gesamt() < TISCHE[0].buyMin && !daten.rettung;
    screen.innerHTML = '<section class="home" id="start"><div class="intro">' +
      '<p class="eyebrow">Leif Game Hub · Virtuelle Tische</p><h1>Dein Zug.<br><span>Dein Spiel.</span></h1>' +
      '<p class="intro-copy">Setz dich an den Tisch, spiel eine Runde Blackjack und lass den nächsten Zug für sich sprechen.</p>' +
      '<div class="chip-balance"><span class="balance-stack"><span></span></span><div class="balance-label"><small>Gemeinsames Chipkonto</small><strong>' + zahl(gesamt()) + ' Chips</strong></div></div>' +
      '<div class="section-kicker"><span>Blackjack · Tisch wählen</span><span>21</span></div><div class="table-list">' + options + '</div>' +
      '<p class="table-foot">Der Tisch behält seinen Stack bis du gehst. Jeder Einsatz bleibt unter dem Tischlimit.' + (!notfall && !resumed && daten.balance < TISCHE[0].buyMin && daten.rettung ? ' Deine einmalige Auffüllung wurde bereits genutzt.' : '') + '</p>' +
      (notfall ? '<button class="primary-btn" id="rescue">Einmalig 100 Notfallchips holen<span class="arrow">→</span></button>' : '<button class="primary-btn" id="play" ' + (!resumed && daten.balance < tisch().buyMin ? 'disabled' : '') + '>' + (resumed ? 'Zur laufenden Runde' : 'Am Tisch Platz nehmen') + '<span class="arrow">→</span></button>') +
      '<div class="other-games"><button class="poker-entry" id="poker-entry"><span class="poker-entry-icon">♠</span><span><b>Texas Hold’em</b><small>Online · echte Spieler und Computergegner</small></span><span class="poker-entry-arrow">→</span></button><button class="poker-entry" id="roulette-entry"><span class="poker-entry-icon roulette-icon">◉</span><span><b>Roulette</b><small>European · ein grünes Feld</small></span><span class="poker-entry-arrow">→</span></button></div>' +
      '<div class="chips-guide" aria-label="Chipwerte">' + stage + '</div></div><div class="game-preview" aria-hidden="true">' + cards + '</div></section>';
    screen.querySelectorAll('[data-table]').forEach(function (b) { b.addEventListener('click', function () { daten.tisch = b.dataset.table; sichern(); home(); }); });
    var play = document.getElementById('play'); if (play) play.addEventListener('click', function () { if (daten.sitzung) { tableScreen(); return; } sitDown(); });
    var rescue = document.getElementById('rescue'); if (rescue) rescue.addEventListener('click', function () { if (daten.rettung || gesamt() >= TISCHE[0].buyMin) return; daten.balance = Math.max(daten.balance, 100); daten.rettung = true; sichern(); home(); notice('Dein Stand wurde einmalig auf 100 Chips angehoben.'); });
    document.getElementById('poker-entry').addEventListener('click', pokerHome);
    document.getElementById('roulette-entry').addEventListener('click', rouletteHome);
  }

  var pokerTier = 'low', pokerSocket = null, pokerView = null, pokerJoinTimer = 0, pokerJoining = false;
  function pokerId() {
    var id = '';
    try { id = localStorage.getItem('casino.poker.id') || ''; } catch (e) {}
    if (!/^[a-f0-9-]{36}$/i.test(id)) { id = crypto.randomUUID(); try { localStorage.setItem('casino.poker.id', id); } catch (e) {} }
    return id;
  }
  function pokerConfig() { return POKER_TISCHE.find(function (t) { return t.id === pokerTier; }) || POKER_TISCHE[0]; }
  function pokerHome() {
    updateWallet();
    if (daten.poker) { openPoker(); pokerRender(pokerView); return; }
    pokerView = null;
    var config = pokerConfig();
    var options = POKER_TISCHE.map(function (t) {
      var disabled = daten.balance < t.buyMin;
      return '<button class="table-option' + (t.id === pokerTier ? ' selected' : '') + '" data-poker-table="' + t.id + '" ' + (disabled ? 'disabled' : '') + '><span class="table-name">' + t.name + ' · Texas Hold’em</span><span class="table-rate">Blinds ' + zahl(t.sb) + '/' + zahl(t.bb) + '</span><span class="table-limits">Buy-in ' + zahl(t.buyMin) + '–' + zahl(t.buyMax) + ' · Max ' + zahl(t.maxBet) + ' je Runde</span></button>';
    }).join('');
    screen.innerHTML = '<section class="table-view poker-lobby"><div class="table-head"><div class="table-heading"><small>ONLINE · TEXAS HOLD’EM</small><h1>Such dir deinen Tisch</h1><p>Kein Login nötig · bis zu fünf Computergegner füllen freie Plätze</p></div><button class="soft-btn" id="poker-back">Zurück</button></div>' +
      '<div class="poker-lobby-card"><div class="section-kicker"><span>Blinds, Einsatzlimit und Buy-in</span><span>Virtuelle Chips</span></div><div class="table-list">' + options + '</div>' +
      '<label class="nick-label" for="poker-name">Dein Anzeigename</label><input class="nick-input" id="poker-name" maxlength="16" autocomplete="nickname" autocapitalize="words" placeholder="Zum Beispiel Leif" value="' + esc(daten.pokerName) + '">' +
      '<p class="table-foot">Ein frei gewählter Name genügt. Es gibt kein Konto und keinen zusätzlichen Login.</p><button class="primary-btn" id="join-poker" ' + (daten.balance < config.buyMin ? 'disabled' : '') + '>Zum Tisch · Buy-in ab ' + zahl(config.buyMin) + '<span class="arrow">→</span></button></div>' +
      '<div class="table-bottom"><span class="stack-display">Verfügbar ' + zahl(daten.balance) + ' Chips</span><span class="table-help">Texas Hold’em · Einsatzlimit je Runde · Server entscheidet Karten und Einsätze</span></div></section>';
    screen.querySelectorAll('[data-poker-table]').forEach(function (b) { b.addEventListener('click', function () { pokerTier = b.dataset.pokerTable; pokerHome(); }); });
    document.getElementById('poker-back').addEventListener('click', home);
    document.getElementById('join-poker').addEventListener('click', pokerJoin);
  }
  function pokerJoin() {
    var name = document.getElementById('poker-name').value.trim().replace(/\s+/g, ' '), t = pokerConfig();
    if (!/^[\p{L}\p{N} _-]{2,16}$/u.test(name)) { notice('Der Name braucht 2 bis 16 Buchstaben oder Zahlen.'); return; }
    if (daten.balance < t.buyMin) { notice('Für diesen Tisch reichen deine Chips gerade nicht.'); return; }
    var buyIn = Math.min(t.buyMax, daten.balance, Math.max(t.buyMin, Math.floor(daten.balance / 4 / 10) * 10));
    daten.balance -= buyIn; daten.pokerName = name;
    daten.poker = { id: pokerId(), name: name, tier: t.id, buyIn: buyIn, leaving: false, confirmed: false };
    sichern(); openPoker(); pokerRender(null);
  }
  function openPoker() {
    if (!daten.poker || pokerJoining || (pokerSocket && (pokerSocket.readyState === WebSocket.OPEN || pokerSocket.readyState === WebSocket.CONNECTING))) return;
    pokerJoining = true;
    var p = daten.poker, u = new URL('/ws/poker', location.href);
    u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    u.searchParams.set('tisch', p.tier); u.searchParams.set('id', p.id); u.searchParams.set('name', p.name); u.searchParams.set('buyIn', p.buyIn);
    try { pokerSocket = new WebSocket(u); } catch (e) { pokerJoining = false; pokerRender(null); return; }
    var s = pokerSocket;
    pokerJoinTimer = setTimeout(function () {
      if (s === pokerSocket && !pokerView) {
        pokerJoining = false;
        if (!pokerView && daten.poker && !daten.poker.leaving) {
          if (!daten.poker.confirmed) { daten.balance += daten.poker.buyIn; daten.poker = null; sichern(); home(); notice('Der Pokertisch ist gerade nicht erreichbar.'); try { s.close(); } catch (e) {} }
          else pokerRender(null);
        }
      }
    }, 6500);
    s.onopen = function () { pokerJoining = false; };
    s.onmessage = function (e) {
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.type === 'state') { clearTimeout(pokerJoinTimer); pokerJoining = false; pokerView = m; if (daten.poker) { daten.poker.confirmed = true; sichern(); } if (daten.poker && daten.poker.leaving) { try { s.send(JSON.stringify({ type: 'leave' })); } catch (x) {} pokerRender(null); } else pokerRender(m); }
      else if (m.type === 'cashout') {
        if (daten.pokerCredited.indexOf(m.id) < 0) { daten.balance += Math.max(0, Math.floor(Number(m.amount) || 0)); daten.pokerCredited.push(m.id); daten.pokerCredited = daten.pokerCredited.slice(-30); }
        sichern(); try { s.send(JSON.stringify({ type: 'cashout-ack', id: m.id })); } catch (x) {}
        daten.poker = null; pokerView = null; pokerSocket = null; sichern(); updateWallet(); home(); notice('Dein Pokertisch-Stack liegt wieder im gemeinsamen Konto.');
      }
    };
    s.onerror = function () { pokerJoining = false; };
    s.onclose = function () { if (s === pokerSocket) { pokerSocket = null; pokerJoining = false; if (daten.poker) { pokerView = null; pokerRender(null); } } };
  }
  function pokerCard(c) {
    if (!c) return '';
    var suit = ['♠', '♥', '♦', '♣'][c.s] || '♠', r = c.r === 14 ? 'A' : c.r === 13 ? 'K' : c.r === 12 ? 'Q' : c.r === 11 ? 'J' : c.r;
    return '<span class="playing-card poker-card' + ((c.s === 1 || c.s === 2) ? ' red' : '') + '"><span>' + r + '</span><span class="pip">' + suit + '</span></span>';
  }
  function pokerRender(state) {
    if (!daten.poker) { pokerHome(); return; }
    updateWallet();
    var p = daten.poker, t = POKER_TISCHE.find(function (x) { return x.id === p.tier; }) || POKER_TISCHE[0];
    if (!state) {
      screen.innerHTML = '<section class="table-view"><div class="table-head"><div class="table-heading"><small>ONLINE · TEXAS HOLD’EM</small><h1>' + (pokerSocket ? 'Verbinde mit ' + t.name : 'Verbindung unterbrochen') + '</h1><p>Buy-in ' + zahl(p.buyIn) + ' Chips · Tisch mit Computergegnern</p></div><button class="soft-btn" id="poker-cancel" ' + (p.leaving ? 'disabled' : '') + '>' + (p.leaving ? 'Verlassen …' : 'Tisch verlassen') + '</button></div><div class="felt-table poker-felt poker-wait"><div class="status-dot"></div><p>' + (p.leaving ? 'Runde wird beendet · Stack wird zurückgelegt …' : pokerSocket ? 'Tisch wird geöffnet …' : 'Tippe auf „Erneut verbinden“, um zum Tisch zurückzukehren.') + '</p></div><div class="table-status">Dein Name: ' + esc(p.name) + '</div><div class="action-row">' + (!pokerSocket && !pokerJoining ? '<button class="action-btn primary" id="poker-reconnect">' + (p.leaving ? 'Stack zurückholen' : 'Erneut verbinden') + '</button>' : '') + '</div><div class="table-bottom"><span class="stack-display">Buy-in ' + zahl(p.buyIn) + '</span><span class="table-help">Deine Chips bleiben während der Runde am Tisch.</span></div></section>';
      var cancel = document.getElementById('poker-cancel'); if (cancel) cancel.addEventListener('click', pokerLeave);
      var reconnect = document.getElementById('poker-reconnect'); if (reconnect) reconnect.addEventListener('click', function () { pokerView = null; openPoker(); pokerRender(null); });
      return;
    }
    var cards = state.board.map(pokerCard).join('');
    var seats = state.players.map(function (s) {
      var cls = (s.id === state.turnId ? ' is-turn' : '') + (s.folded ? ' folded' : '') + (s.waiting ? ' waiting' : '');
      return '<div class="poker-seat' + cls + '"><div class="poker-seat-name">' + esc(s.name) + (s.bot ? '<small>CPU</small>' : '') + (s.dealer ? '<i>D</i>' : '') + '</div><div class="poker-seat-stack">' + (s.folded ? 'Passt' : zahl(s.stack) + ' Chips') + (s.bet ? '<small>setzt ' + zahl(s.bet) + '</small>' : '') + '</div><div class="poker-hole">' + (s.cards.length ? s.cards.map(pokerCard).join('') : (!s.folded && !s.waiting ? '<span class="card-back-small">✦</span><span class="card-back-small">✦</span>' : '')) + '</div></div>';
    }).join('');
    var me = state.players.find(function (x) { return x.id === state.myId; });
    var isTurn = state.turnId === state.myId && state.phase !== 'showdown';
    var betText = state.phase === 'waiting' ? 'Warte auf den Start der nächsten Hand.' : state.phase === 'showdown' ? 'Hand abgeschlossen.' : state.message;
    var buttons = isTurn ? '<button class="action-btn danger" data-poker-action="fold">Passen</button>' +
      (state.call > 0 ? '<button class="action-btn primary" data-poker-action="call">Mitgehen<span>' + zahl(state.call) + ' Chips</span></button>' : '<button class="action-btn primary" data-poker-action="check">Check</button>') +
      '<button class="action-btn" data-poker-action="raise">Erhöhen<span>mind. ' + zahl(state.minRaise) + '</span></button><button class="action-btn" data-poker-action="allin">Maximal<span>bis ' + zahl(state.maxBet) + '</span></button>' : '';
    var canRebuy = me && me.stack === 0 && daten.balance >= t.buyMin;
    var winnerText = state.winners && state.winners.length ? state.winners.map(function (w) { return esc(w.name) + ' +' + zahl(w.amount); }).join(' · ') : '';
    screen.innerHTML = '<section class="table-view poker-room"><div class="table-head"><div class="table-heading"><small>TEXAS HOLD’EM · ' + esc(t.name) + '</small><h1>Hand ' + zahl(state.handNo) + '</h1><p>Blinds ' + zahl(t.sb) + '/' + zahl(t.bb) + ' · Max ' + zahl(t.maxBet) + ' je Runde · ' + (state.phase === 'waiting' ? 'Neue Runde gleich' : esc(state.phase)) + '</p></div><div class="table-head-actions"><button class="soft-btn" id="poker-rules">Regeln</button><button class="soft-btn" id="poker-leave">Tisch verlassen</button></div></div>' +
      '<div class="felt-table poker-felt"><div class="poker-seats">' + seats + '</div><div class="poker-center"><div class="poker-pot">POT <b>' + zahl(state.pot) + '</b></div><div class="poker-board">' + cards + '</div><div class="poker-message" aria-live="polite">' + (winnerText || esc(betText)) + '</div></div></div>' +
      '<div class="table-status">' + (me ? 'Dein Stack am Tisch: ' + zahl(me.stack) : 'Du bist Zuschauer') + (me && me.waiting ? ' · bereit für die nächste Hand' : '') + '</div>' +
      (canRebuy ? '<div class="poker-rebuy"><span>Dein Stack ist leer.</span><button class="secondary-btn" id="poker-rebuy">Nachkaufen ' + zahl(t.buyMin) + '</button></div>' : '') +
      '<div class="action-row">' + buttons + '</div><div class="table-bottom"><span class="stack-display">Kontostand ' + zahl(daten.balance + (me ? me.stack : 0)) + '</span><span class="table-help">Virtuelle Chips · Server mischt · Einsatzlimit ' + zahl(t.maxBet) + ' je Runde</span></div></section>';
    screen.querySelectorAll('[data-poker-action]').forEach(function (b) { b.addEventListener('click', function () { if (pokerSocket && pokerSocket.readyState === WebSocket.OPEN) pokerSocket.send(JSON.stringify({ type: 'action', action: b.dataset.pokerAction })); }); });
    document.getElementById('poker-leave').addEventListener('click', pokerLeave);
    document.getElementById('poker-rules').addEventListener('click', function () { modal('Texas Hold’em', 'Jeder Spieler bekommt zwei verdeckte Karten. Gemeinsam nutzt ihr bis zu fünf offene Karten. Setze, gehe mit oder passe in deiner Runde. Die beste Fünf-Karten-Kombination gewinnt den Pot. Computergegner füllen leere Plätze. Der Cloudflare-Worker verwaltet den Tisch und begrenzt den Einsatz je Runde auf ' + zahl(t.maxBet) + ' Chips.', 'Verstanden'); });
    var rebuy = document.getElementById('poker-rebuy'); if (rebuy) rebuy.addEventListener('click', function () { if (!pokerSocket || pokerSocket.readyState !== WebSocket.OPEN || daten.balance < t.buyMin) return; var amount = Math.min(t.buyMax, daten.balance, t.buyMin); daten.balance -= amount; sichern(); pokerSocket.send(JSON.stringify({ type: 'rebuy', amount: amount })); pokerRender(pokerView); });
  }
  function pokerLeave() {
    if (!daten.poker || daten.poker.leaving) return;
    daten.poker.leaving = true; sichern();
    if (pokerSocket && pokerSocket.readyState === WebSocket.OPEN) pokerSocket.send(JSON.stringify({ type: 'leave' }));
    else openPoker();
    pokerRender(null);
  }

  var ROULETTE_MAX = 500;
  var ROULETTE_RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  function rouletteTotal() { return daten.roulette.bets.reduce(function (s, b) { return s + b.amount; }, 0); }
  function rouletteLabel(t) {
    if (t.indexOf('n:') === 0) return 'Zahl ' + t.slice(2);
    return ({ red:'Rot', black:'Schwarz', even:'Gerade', odd:'Ungerade', low:'1–18', high:'19–36', d1:'1. Dutzend', d2:'2. Dutzend', d3:'3. Dutzend', c1:'1. Kolonne', c2:'2. Kolonne', c3:'3. Kolonne' })[t] || t;
  }
  function rouletteColor(n) { return n === 0 ? 'green' : ROULETTE_RED.indexOf(n) >= 0 ? 'red' : 'black'; }
  function rouletteMatches(target, n) {
    if (target.indexOf('n:') === 0) return Number(target.slice(2)) === n;
    if (target === 'red' || target === 'black') return rouletteColor(n) === target;
    if (target === 'even') return n > 0 && n % 2 === 0;
    if (target === 'odd') return n > 0 && n % 2 === 1;
    if (target === 'low') return n >= 1 && n <= 18;
    if (target === 'high') return n >= 19 && n <= 36;
    if (target.indexOf('d') === 0) { var d = Number(target.slice(1)); return n > 0 && Math.ceil(n / 12) === d; }
    if (target.indexOf('c') === 0) return n > 0 && ((n - 1) % 3) + 1 === Number(target.slice(1));
    return false;
  }
  function rouletteReturn(target, amount) { return amount * (target.indexOf('n:') === 0 ? 36 : target[0] === 'd' || target[0] === 'c' ? 3 : 2); }
  function roulettePlace(target) {
    var r = daten.roulette;
    if (rouletteTotal() + r.chip > ROULETTE_MAX) { notice('Tischlimit: höchstens 500 Chips pro Dreh.'); return; }
    if (rouletteTotal() + r.chip > daten.balance) { notice('Für diesen Einsatz reichen deine Chips nicht.'); return; }
    var bet = r.bets.find(function (b) { return b.target === target; });
    if (bet) bet.amount += r.chip; else r.bets.push({ target: target, amount: r.chip });
    r.target = target; sichern(); rouletteHome();
  }
  function rouletteSpin() {
    var r = daten.roulette, total = rouletteTotal();
    if (!total) { notice('Lege zuerst einen Einsatz auf den Tisch.'); return; }
    if (total > daten.balance) { notice('Für diese Einsätze reichen deine Chips nicht.'); return; }
    daten.balance -= total;
    var result = zufall(37), back = 0;
    r.bets.forEach(function (b) { if (rouletteMatches(b.target, result)) back += rouletteReturn(b.target, b.amount); });
    daten.balance += back; r.history.unshift(result); r.history = r.history.slice(0, 8); r.result = result; r.lastReturn = back; r.lastStake = total; r.bets = [];
    sichern(); ton(result === 0 ? 560 : ROULETTE_RED.indexOf(result) >= 0 ? 420 : 300, .12); rouletteHome();
  }
  function rouletteHome() {
    var r = daten.roulette, total = rouletteTotal(), numberRows = '';
    for (var row = 0; row < 3; row++) for (var col = 0; col < 12; col++) {
      var n = col * 3 + (3 - row);
      numberRows += '<button class="roulette-number ' + rouletteColor(n) + (r.target === 'n:' + n ? ' chosen' : '') + '" data-r-target="n:' + n + '">' + n + '</button>';
    }
    var chipButtons = [1,5,10,25,50].map(function (v) { return '<button class="roulette-chip' + (r.chip === v ? ' selected' : '') + '" data-r-chip="' + v + '">' + zahl(v) + '</button>'; }).join('');
    var outside = [
      ['low','1–18'],['even','GERADE'],['red','ROT'],['black','SCHWARZ'],['odd','UNGERADE'],['high','19–36']
    ].map(function (x) { return '<button class="roulette-outside ' + (x[0] === 'red' ? 'red' : x[0] === 'black' ? 'black' : '') + (r.target === x[0] ? ' chosen' : '') + '" data-r-target="' + x[0] + '">' + x[1] + '</button>'; }).join('');
    var groups = [['d1','1. Dutzend'],['d2','2. Dutzend'],['d3','3. Dutzend'],['c1','1. Kolonne'],['c2','2. Kolonne'],['c3','3. Kolonne']].map(function (x) { return '<button class="roulette-outside' + (r.target === x[0] ? ' chosen' : '') + '" data-r-target="' + x[0] + '">' + x[1] + '</button>'; }).join('');
    var placed = r.bets.length ? r.bets.map(function (b) { return '<span class="roulette-bet-tag">' + esc(rouletteLabel(b.target)) + ' <b>' + zahl(b.amount) + '</b></span>'; }).join('') : '<span class="roulette-empty">Wähle ein Feld und lege Chips darauf.</span>';
    var hist = r.history.length ? r.history.map(function (n) { return '<span class="roulette-history ' + rouletteColor(n) + '">' + n + '</span>'; }).join('') : '<span class="roulette-empty">Noch keine Drehung</span>';
    var resultText = r.result === null ? 'Setze deine Chips' : (r.result === 0 ? '0 · Grün' : r.result + ' · ' + (rouletteColor(r.result) === 'red' ? 'Rot' : 'Schwarz')) + ' · ' + (r.lastReturn > r.lastStake ? '+' + zahl(r.lastReturn - r.lastStake) + ' Gewinn' : 'kein Gewinn');
    screen.innerHTML = '<section class="table-view roulette-view"><div class="table-head"><div class="table-heading"><small>ROULETTE · EUROPEAN</small><h1>Ein grünes Feld</h1><p>Einfacher Nullpunkt · Höchsteinsatz 500 Chips pro Dreh</p></div><button class="soft-btn" id="roulette-back">Zur Übersicht</button></div>' +
      '<div class="roulette-table"><div class="roulette-top"><div class="roulette-result ' + (r.result === null ? '' : rouletteColor(r.result)) + '">' + (r.result === null ? '·' : r.result) + '</div><div class="roulette-center-copy"><b>' + esc(resultText) + '</b><div class="roulette-history-row">' + hist + '</div></div><div class="roulette-bank">Konto <b>' + zahl(daten.balance) + '</b></div></div>' +
      '<div class="roulette-chips"><span>CHIPWERT</span>' + chipButtons + '</div><div class="roulette-grid-wrap"><button class="roulette-zero ' + (r.target === 'n:0' ? 'chosen' : '') + '" data-r-target="n:0">0</button><div class="roulette-grid">' + numberRows + '</div></div>' +
      '<div class="roulette-outside-row">' + outside + '</div><div class="roulette-outside-row roulette-groups">' + groups + '</div>' +
      '<div class="roulette-bets">' + placed + '<b class="roulette-total">' + zahl(total) + ' / ' + zahl(ROULETTE_MAX) + '</b></div></div>' +
      '<div class="action-row roulette-actions"><button class="secondary-btn" id="roulette-clear" ' + (!r.bets.length ? 'disabled' : '') + '>Einsätze löschen</button><button class="primary-btn" id="roulette-spin" ' + (!r.bets.length || total > daten.balance ? 'disabled' : '') + '>Drehen<span class="arrow">→</span></button></div>' +
      '<div class="table-bottom"><span class="stack-display">' + zahl(daten.balance) + ' Chips verfügbar</span><span class="table-help">Rot/Schwarz und Gerade/Ungerade zahlen 1:1 · Zahl zahlt 35:1</span></div></section>';
    document.querySelectorAll('[data-r-target]').forEach(function (b) { b.addEventListener('click', function () { roulettePlace(b.dataset.rTarget); }); });
    document.querySelectorAll('[data-r-chip]').forEach(function (b) { b.addEventListener('click', function () { r.chip = Number(b.dataset.rChip); sichern(); rouletteHome(); }); });
    document.getElementById('roulette-back').addEventListener('click', home);
    document.getElementById('roulette-spin').addEventListener('click', rouletteSpin);
    document.getElementById('roulette-clear').addEventListener('click', function () { r.bets = []; sichern(); rouletteHome(); });
  }

  function sitDown() {
    var t = tisch();
    if (daten.balance < t.buyMin) { notice('Für diesen Tisch reichen deine Chips gerade nicht.'); return; }
    var buy = Math.min(t.buyMax, daten.balance, Math.max(t.buyMin, Math.floor(daten.balance / 4 / 10) * 10));
    daten.balance -= buy;
    daten.sitzung = { tisch: t.id, stack: buy, bet: Math.min(10, t.maxBet, buy), deck: [], dealer: [], hands: [], aktiv: 0, phase: 'setzen', status: 'Wähle deinen Einsatz und gib die Karten.' };
    sichern(); tableScreen();
  }
  function leaveTable() {
    if (!daten.sitzung) { home(); return; }
    daten.balance += daten.sitzung.stack;
    daten.sitzung = null; sichern(); home(); notice('Chips ins gemeinsame Konto zurückgelegt.');
  }
  function makeDeck() {
    var d = [];
    SUITS.forEach(function (suit, si) { for (var n = 1; n <= 13; n++) d.push({ n: n, suit: suit, red: si === 1 || si === 2 }); });
    for (var i = d.length - 1; i > 0; i--) { var j = zufall(i + 1); var x = d[i]; d[i] = d[j]; d[j] = x; }
    return d;
  }
  function draw(s) { return s.deck.pop(); }
  function rank(c) { return c.n === 1 ? 'A' : c.n > 10 ? ({ 11: 'J', 12: 'Q', 13: 'K' })[c.n] : String(c.n); }
  function cardHtml(c, hidden) {
    if (hidden) return '<div class="playing-card back" aria-label="Verdeckte Karte"></div>';
    var r = rank(c), cl = c.red ? ' red' : '';
    return '<div class="playing-card' + cl + '" aria-label="' + r + ' ' + c.suit + '"><span>' + r + '</span><span class="pip">' + c.suit + '</span><span class="corner-bottom">' + r + '</span></div>';
  }
  function value(hand) {
    var n = 0, aces = 0;
    hand.forEach(function (c) { if (c.n === 1) { n += 11; aces++; } else n += Math.min(c.n, 10); });
    while (n > 21 && aces) { n -= 10; aces--; }
    return { total: n, soft: aces > 0 };
  }
  function natural(hand, isSplit) { return hand.length === 2 && value(hand).total === 21 && !isSplit; }
  function beginRound(amount) {
    var s = daten.sitzung, t = tisch();
    amount = Math.max(1, Math.floor(amount));
    if (s.phase !== 'setzen' || amount > t.maxBet || amount > s.stack) return;
    s.stack -= amount; s.bet = amount; s.deck = makeDeck(); s.dealer = [draw(s), draw(s)];
    s.hands = [{ cards: [draw(s), draw(s)], bet: amount, done: false, split: false }]; s.aktiv = 0; s.phase = 'spielen';
    s.status = 'Dein Zug.';
    if (natural(s.hands[0].cards)) finishRound(); else if (value(s.dealer).total === 21) finishRound();
    else sichern();
    ton(620, .08); tableScreen();
  }
  function activeHand() { var s = daten.sitzung; return s && s.hands[s.aktiv]; }
  function handDone() {
    var s = daten.sitzung, hand = activeHand();
    hand.done = true;
    var next = s.hands.findIndex(function (h, i) { return i > s.aktiv && !h.done; });
    if (next >= 0) { s.aktiv = next; s.status = 'Weiter mit Hand ' + (next + 1) + '.'; }
    else finishRound();
    sichern(); tableScreen();
  }
  function hit() {
    var s = daten.sitzung, h = activeHand(); if (!s || s.phase !== 'spielen' || !h || h.done) return;
    h.cards.push(draw(s)); var v = value(h.cards); ton(390, .07);
    if (v.total >= 21) handDone(); else { s.status = 'Dein Zug.'; sichern(); tableScreen(); }
  }
  function stand() { var s = daten.sitzung, h = activeHand(); if (!s || s.phase !== 'spielen' || !h) return; h.done = true; handDone(); }
  function doubleDown() {
    var s = daten.sitzung, h = activeHand(), t = tisch();
    if (!s || s.phase !== 'spielen' || !h || h.cards.length !== 2 || s.stack < h.bet || h.done || h.split) return;
    s.stack -= h.bet; h.bet *= 2; s.bet += h.bet / 2; h.cards.push(draw(s)); ton(540, .1); handDone();
  }
  function splitHand() {
    var s = daten.sitzung, h = activeHand();
    if (!s || s.phase !== 'spielen' || !h || h.cards.length !== 2 || h.cards[0].n !== h.cards[1].n || h.split || s.hands.length > 1 || s.stack < h.bet) return;
    var second = { cards: [h.cards.pop()], bet: h.bet, done: false, split: true };
    s.stack -= h.bet; s.bet += h.bet; h.split = true; h.cards.push(draw(s)); second.cards.push(draw(s)); s.hands.push(second); s.status = 'Hand 1: dein Zug.'; sichern(); tableScreen();
  }
  function finishRound() {
    var s = daten.sitzung;
    if (!s) return;
    var dealerV = value(s.dealer);
    if (s.hands.some(function (h) { return value(h.cards).total <= 21; })) {
      while (dealerV.total < 17) { s.dealer.push(draw(s)); dealerV = value(s.dealer); }
    }
    var dealerNatural = natural(s.dealer);
    var lines = s.hands.map(function (h, i) {
      var pv = value(h.cards).total, bet = h.bet, pay = 0, label;
      if (pv > 21) { label = 'Überkauft'; }
      else if (natural(h.cards, h.split) && !dealerNatural) { pay = Math.floor(bet * 2.5); label = 'Blackjack · 3:2'; }
      else if (dealerNatural && natural(h.cards, h.split)) { pay = bet; label = 'Gleichstand'; }
      else if (dealerNatural) { label = 'Dealer-Blackjack'; }
      else if (dealerV.total > 21 || pv > dealerV.total) { pay = bet * 2; label = 'Gewonnen'; }
      else if (pv === dealerV.total) { pay = bet; label = 'Gleichstand'; }
      else { label = 'Dealer gewinnt'; }
      s.stack += pay;
      return (s.hands.length > 1 ? 'Hand ' + (i + 1) + ': ' : '') + label + (pay ? ' · +' + zahl(pay - bet) : '');
    });
    s.phase = 'Ergebnis'; s.status = lines.join('   ·   '); sichern();
    ton(s.status.indexOf('Gewonnen') >= 0 || s.status.indexOf('Blackjack') >= 0 ? 720 : 260, .14);
  }
  function setBet(delta) {
    var s = daten.sitzung, t = tisch(); if (!s || s.phase !== 'setzen') return;
    var next = Math.max(1, Math.min(t.maxBet, s.stack, s.bet + delta));
    s.bet = next; sichern(); tableScreen();
  }
  function renderHand(hand, hideDealer, active, index) {
    var v = value(hand.cards), dealerValue = hideDealer ? '?' : v.total;
    var cards = hand.cards.map(function (c) { return cardHtml(c, false); }).join('');
    return '<div class="hand-zone' + (active ? ' active' : '') + '"><div class="hand-label">' + (hideDealer ? 'Dealer' : (daten.sitzung.hands.length > 1 ? 'Hand ' + (index + 1) : 'Deine Hand')) + ' <span class="hand-total">' + dealerValue + '</span></div><div class="card-row">' + cards + '</div></div>';
  }
  function tableScreen() {
    var s = daten.sitzung; if (!s) { home(); return; }
    updateWallet();
    var t = TISCHE.find(function (x) { return x.id === s.tisch; }) || TISCHE[0];
    var inRound = s.phase === 'spielen' || s.phase === 'Ergebnis';
    var dealerHidden = s.phase === 'spielen';
    var dealerHtml = s.dealer.length ? renderHand({ cards: s.dealer }, dealerHidden, false, 0) : '<div class="hand-zone"><div class="hand-label">Dealer</div><div class="card-row"></div></div>';
    if (dealerHidden) dealerHtml = dealerHtml.replace(cardHtml(s.dealer[1], false), cardHtml(s.dealer[1], true)).replace('>' + value(s.dealer).total + '<', '>' + value([s.dealer[0]]).total + '<');
    var handsHtml = s.hands.map(function (h, i) { var html = renderHand(h, false, s.phase === 'spielen' && i === s.aktiv, i); return html.replace('<div class="hand-zone', '<div class="hand-zone'); }).join('');
    var title = s.phase === 'setzen' ? 'Nächste Runde' : s.phase === 'Ergebnis' ? 'Runde abgeschlossen' : 'Dein Zug';
    var dealerVisible = s.phase === 'Ergebnis' || s.phase === 'spielen';
    var status = esc(s.status || 'Wähle deinen Einsatz.');
    var bet = s.bet;
    var showActions = s.phase === 'spielen';
    var splitOK = s.phase === 'spielen' && s.hands.length === 1 && s.hands[0].cards.length === 2 && s.hands[0].cards[0].n === s.hands[0].cards[1].n && s.stack >= s.hands[0].bet;
    var doubleOK = s.phase === 'spielen' && activeHand() && activeHand().cards.length === 2 && !activeHand().split && s.stack >= activeHand().bet;
    screen.innerHTML = '<section class="table-view"><div class="table-head"><div class="table-heading"><small>BLACKJACK · ' + esc(t.name) + '</small><h1>' + title + '</h1><p>Dealer steht auf Soft 17 · Blackjack zahlt 3:2</p></div><div class="table-head-actions"><button class="soft-btn" id="rules">Regeln</button><button class="soft-btn" id="leave">Tisch verlassen</button></div></div>' +
      '<div class="felt-table"><div class="felt-mark"><span>LEIF GAME HUB</span></div>' + (dealerVisible ? dealerHtml : '<div class="hand-zone"><div class="hand-label">Dealer</div><div class="card-row"></div></div>') + '<div class="hand-result" id="hand-result">' + (s.phase === 'Ergebnis' ? status : '') + '</div>' + handsHtml + '</div>' +
      '<div class="table-status" aria-live="polite">' + (s.phase === 'Ergebnis' ? 'Wähle deinen nächsten Einsatz.' : status) + '</div>' +
      (s.phase === 'setzen' ? '<div class="bet-control"><label for="bet-value">Einsatz</label><div class="bet-stepper"><button id="bet-down" aria-label="Einsatz um einen Chip senken">−</button><span class="bet-value" id="bet-value">' + zahl(bet) + ' Chips</span><button id="bet-up" aria-label="Einsatz um einen Chip erhöhen">+</button></div></div>' : '<div class="bet-control"><label>Rundeneinsatz</label><span class="bet-value">' + zahl(s.bet) + ' Chips</span></div>') +
      '<div class="action-row">' + (s.phase === 'setzen' ? '<button class="action-btn primary" id="deal" ' + (s.stack < 1 ? 'disabled' : '') + '>Karten geben<span>Einsatz ' + zahl(bet) + '</span></button>' : '') +
      (showActions ? '<button class="action-btn" id="hit">Karte</button><button class="action-btn" id="stand">Halten</button><button class="action-btn" id="double" ' + (doubleOK ? '' : 'disabled') + '>Verdoppeln<span>+' + zahl(activeHand() ? activeHand().bet : 0) + '</span></button><button class="action-btn" id="split" ' + (splitOK ? '' : 'disabled') + '>Teilen</button>' : '') +
      (s.phase === 'Ergebnis' ? '<button class="action-btn primary" id="again" ' + (s.stack < 1 ? 'disabled' : '') + '>Neue Runde<span>Bis ' + zahl(t.maxBet) + ' max.</span></button><button class="action-btn" id="home">Zur Übersicht</button>' : '') + '</div>' +
      '<div class="table-bottom"><span class="stack-display">Stack ' + zahl(s.stack) + ' Chips</span><span class="table-help">Tischlimit ' + zahl(t.maxBet) + ' · Kein Echtgeld</span></div></section>';

    document.getElementById('leave').addEventListener('click', function () {
      if (s.phase === 'spielen') { modal('Runde verlassen?', 'Wenn du jetzt gehst, ist der aktuelle Einsatz verloren. Die restlichen Chips wandern zurück ins gemeinsame Konto.', 'Runde aufgeben und gehen', function () { leaveTable(); }); }
      else leaveTable();
    });
    document.getElementById('rules').addEventListener('click', function () { modal('Blackjack-Regeln', 'Du gewinnst mit einer höheren Summe als der Dealer, ohne 21 zu überschreiten. Der Dealer zieht bis 17 und bleibt auch bei Soft 17 stehen. Ein Blackjack mit zwei Karten zahlt 3:2. Bei Gleichstand bekommst du den Einsatz zurück. Verdoppeln und einmaliges Teilen sind möglich.', 'Verstanden'); });
    var down = document.getElementById('bet-down'), up = document.getElementById('bet-up'); if (down) down.addEventListener('click', function () { setBet(-1); }); if (up) up.addEventListener('click', function () { setBet(1); });
    var deal = document.getElementById('deal'); if (deal) deal.addEventListener('click', function () { beginRound(s.bet); });
    var h = document.getElementById('hit'), st = document.getElementById('stand'), dd = document.getElementById('double'), sp = document.getElementById('split');
    if (h) h.addEventListener('click', hit); if (st) st.addEventListener('click', stand); if (dd) dd.addEventListener('click', doubleDown); if (sp) sp.addEventListener('click', splitHand);
    var again = document.getElementById('again'); if (again) again.addEventListener('click', function () { s.phase = 'setzen'; s.bet = Math.min(10, t.maxBet, s.stack); s.dealer = []; s.hands = []; s.status = 'Wähle deinen Einsatz.'; sichern(); tableScreen(); });
    var homeBtn = document.getElementById('home'); if (homeBtn) homeBtn.addEventListener('click', function () { s.phase = 'setzen'; s.dealer = []; s.hands = []; sichern(); leaveTable(); });
  }

  var toastTimer;
  function notice(text) { var old = document.querySelector('.toast'); if (old) old.remove(); var t = document.createElement('div'); t.className = 'toast'; t.textContent = text; document.body.appendChild(t); requestAnimationFrame(function () { t.classList.add('visible'); }); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('visible'); setTimeout(function () { t.remove(); }, 240); }, 2300); }
  function modal(title, text, action, cb) {
    var back = document.createElement('div'); back.className = 'modal-backdrop'; back.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p><div class="modal-actions"><button class="secondary-btn" data-cancel>Zurück</button><button class="primary-btn" data-ok style="width:auto;min-height:40px;margin:0;padding:0 14px">' + esc(action) + '</button></div></div>'; document.body.appendChild(back);
    back.querySelector('[data-cancel]').addEventListener('click', function () { back.remove(); }); back.querySelector('[data-ok]').addEventListener('click', function () { back.remove(); if (cb) cb(); }); back.addEventListener('click', function (e) { if (e.target === back) back.remove(); });
  }
  window.LGH_ZEILEN = function () { return [{ text: 'Spielton', an: daten.ton, setze: function (v) { daten.ton = v; sichern(); } }]; };
  window.addEventListener('storage', function (e) { if (e.key === SCHLUESSEL) { daten = laden(); if (daten.sitzung) tableScreen(); else home(); } });
  if (daten.sitzung) tableScreen(); else if (daten.poker) pokerHome(); else home();
})();
