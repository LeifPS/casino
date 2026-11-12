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
  var STUFEN = [
    [1, 'Grau', 'chip-gray'], [5, 'Rot', 'chip-red'], [10, 'Dunkelblau', 'chip-blue'], [25, 'Dunkelgrün', 'chip-green'],
    [50, 'Hellblau', 'chip-lightblue'], [100, 'Schwarz', 'chip-black'], [500, 'Lila', 'chip-purple'], [1000, 'Gold', 'chip-gold'],
    [5000, 'Pink', 'chip-pink'], [10000, 'Braun', 'chip-brown'], [25000, 'Smaragd', 'chip-gradient g-emerald'],
    [50000, 'Saphir', 'chip-gradient g-sapphire'], [100000, 'Amethyst', 'chip-gradient g-amethyst'], [500000, 'Aurora', 'chip-gradient g-aurora'], [1000000, 'Sonnenaufgang', 'chip-gradient g-sunrise']
  ];

  function standard() { return { balance: 1000, rettung: false, tisch: TISCHE[0].id, ton: true, sitzung: null }; }
  function laden() {
    try {
      var v = JSON.parse(localStorage.getItem(SCHLUESSEL));
      if (!v || typeof v !== 'object') return standard();
      return {
        balance: Math.max(0, Math.floor(Number(v.balance) || 0)),
        rettung: v.rettung === true,
        tisch: TISCHE.some(function (t) { return t.id === v.tisch; }) ? v.tisch : TISCHE[0].id,
        ton: v.ton !== false,
        sitzung: v.sitzung && typeof v.sitzung === 'object' ? v.sitzung : null
      };
    } catch (e) { return standard(); }
  }
  var daten = laden();
  function sichern() { try { localStorage.setItem(SCHLUESSEL, JSON.stringify(daten)); } catch (e) {} }
  function tisch() { return TISCHE.find(function (t) { return t.id === daten.tisch; }) || TISCHE[0]; }
  function zahl(n) { return FORMAT.format(Math.floor(Number(n) || 0)); }
  function gesamt() { return daten.balance + (daten.sitzung ? Math.max(0, Number(daten.sitzung.stack) || 0) : 0); }
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
      '<div class="chips-guide" aria-label="Chipwerte">' + stage + '</div></div><div class="game-preview" aria-hidden="true">' + cards + '</div></section>';
    screen.querySelectorAll('[data-table]').forEach(function (b) { b.addEventListener('click', function () { daten.tisch = b.dataset.table; sichern(); home(); }); });
    var play = document.getElementById('play'); if (play) play.addEventListener('click', function () { if (daten.sitzung) { tableScreen(); return; } sitDown(); });
    var rescue = document.getElementById('rescue'); if (rescue) rescue.addEventListener('click', function () { if (daten.rettung || gesamt() >= TISCHE[0].buyMin) return; daten.balance = Math.max(daten.balance, 100); daten.rettung = true; sichern(); home(); notice('Dein Stand wurde einmalig auf 100 Chips angehoben.'); });
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
  if (daten.sitzung) tableScreen(); else home();
})();
