import { DurableObject } from 'cloudflare:workers';

const TABLES = {
  low: { label: 'Einsteiger', min: 100, max: 1000, sb: 1, bb: 2, maxBet: 100 },
  classic: { label: 'Klassik', min: 500, max: 3000, sb: 5, bb: 10, maxBet: 500 },
  salon: { label: 'Salon', min: 2000, max: 10000, sb: 25, bb: 50, maxBet: 2500 }
};
const MAX_SEATS = 6;
const TURN_MS = 25000;
const START_MS = 4500;

function emptyTable() {
  return {
    phase: 'waiting', players: [], board: [], deck: [], pot: 0, currentBet: 0, minRaise: 0,
    dealer: -1, turnId: null, handNo: 0, message: 'Warte auf Spieler.', winners: [], cashouts: {}
  };
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function int(v, fallback) { const n = Number(v); return Number.isSafeInteger(n) && n >= 0 ? n : fallback; }
function cards() {
  const d = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) { const a = new Uint32Array(1); crypto.getRandomValues(a); const j = a[0] % (i + 1); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
function value5(cs) {
  const rs = cs.map(c => c.r).sort((a, b) => b - a);
  const counts = new Map(); rs.forEach(r => counts.set(r, (counts.get(r) || 0) + 1));
  const groups = [...counts].map(([r, n]) => ({ r, n })).sort((a, b) => b.n - a.n || b.r - a.r);
  const flush = cs.every(c => c.s === cs[0].s);
  let uniq = [...new Set(rs)];
  if (uniq.includes(14)) uniq.push(1);
  let straightHigh = 0;
  for (let i = 0; i <= uniq.length - 5; i++) if (uniq[i] - uniq[i + 4] === 4) { straightHigh = uniq[i]; break; }
  if (flush && straightHigh) return [8, straightHigh];
  if (groups[0].n === 4) return [7, groups[0].r, groups[1].r];
  if (groups[0].n === 3 && groups[1].n === 2) return [6, groups[0].r, groups[1].r];
  if (flush) return [5, ...rs];
  if (straightHigh) return [4, straightHigh];
  if (groups[0].n === 3) return [3, groups[0].r, ...groups.slice(1).map(g => g.r).sort((a,b)=>b-a)];
  const pairs = groups.filter(g => g.n === 2).map(g => g.r).sort((a,b)=>b-a);
  if (pairs.length >= 2) return [2, pairs[0], pairs[1], groups.find(g => g.n === 1).r];
  if (pairs.length === 1) return [1, pairs[0], ...groups.filter(g => g.n === 1).map(g => g.r).sort((a,b)=>b-a)];
  return [0, ...rs];
}
function compare(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; }
function bestOf(cs) {
  let best = null;
  for (let a = 0; a < cs.length - 4; a++) for (let b = a + 1; b < cs.length - 3; b++) for (let c = b + 1; c < cs.length - 2; c++) for (let d = c + 1; d < cs.length - 1; d++) for (let e = d + 1; e < cs.length; e++) {
    const v = value5([cs[a], cs[b], cs[c], cs[d], cs[e]]); if (!best || compare(v, best) > 0) best = v;
  }
  return best || [0];
}

export class PokerTable extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.state = emptyTable();
    this.tier = 'low';
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get('table')) || emptyTable();
      this.tier = (await ctx.storage.get('tier')) || 'low';
    });
  }

  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket-Upgrade erforderlich', { status: 426 });
    const u = new URL(request.url), tier = u.searchParams.get('tisch'), table = TABLES[tier];
    const id = u.searchParams.get('id'), name = (u.searchParams.get('name') || '').trim().replace(/\s+/g, ' '), buyIn = Number(u.searchParams.get('buyIn'));
    if (!table || !/^[a-f0-9-]{36}$/i.test(id || '') || !/^[\p{L}\p{N} _-]{2,16}$/u.test(name) || !Number.isSafeInteger(buyIn) || buyIn < table.min || buyIn > table.max) return new Response('Ungültiger Tischbeitritt.', { status: 400 });
    this.tier = tier;
    await this.ctx.storage.put('tier', tier);

    let player = this.state.players.find(p => p.id === id);
    if (!player && this.state.cashouts[id]) {
      const pair = new WebSocketPair(), client = pair[0], server = pair[1];
      server.serializeAttachment({ id }); this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({ type: 'cashout', ...this.state.cashouts[id] }));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (!player) {
      if (this.state.players.length >= MAX_SEATS) return new Response('Der Tisch ist voll. Versuch es gleich noch einmal.', { status: 409 });
      player = { id, name, stack: buyIn, bot: false, cards: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, waiting: this.state.phase !== 'waiting', leaving: false, seen: Date.now() };
      this.state.players.push(player);
    } else { player.name = name; player.seen = Date.now(); }

    const pair = new WebSocketPair(), client = pair[0], server = pair[1];
    for (const old of this.ctx.getWebSockets()) if (old.deserializeAttachment()?.id === id) { try { old.close(1000, 'Erneut verbunden'); } catch (e) {} }
    server.serializeAttachment({ id }); this.ctx.acceptWebSocket(server);
    await this.save();
    if (this.state.phase === 'waiting') await this.ctx.storage.setAlarm(Date.now() + START_MS);
    this.send(server, this.view(id));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    const id = ws.deserializeAttachment()?.id;
    if (!id || typeof raw !== 'string' || raw.length > 1000) return;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.type === 'cashout-ack') {
      const pending = this.state.cashouts[id]; if (pending && pending.id === m.id) { delete this.state.cashouts[id]; await this.save(); }
      return;
    }
    const player = this.state.players.find(p => p.id === id);
    if (!player) return;
    player.seen = Date.now();
    if (m.type === 'leave') { await this.leave(player); return; }
    if (m.type === 'action' && player.id === this.state.turnId) {
      const i = this.state.players.indexOf(player);
      if (this.act(i, m.action)) { await this.runOn(); await this.save(); this.broadcast(); }
      return;
    }
    if (m.type === 'rebuy' && player.stack === 0) {
      const table = this.tableConfig(), amount = int(m.amount, 0);
      if (amount >= table.min && amount <= table.max) { player.stack = amount; player.waiting = false; player.folded = this.state.phase !== 'waiting'; await this.save(); this.broadcast(); }
    }
  }

  async webSocketClose(ws) {
    const id = ws.deserializeAttachment()?.id, p = this.state.players.find(x => x.id === id);
    if (p) { p.seen = Date.now(); await this.save(); }
  }

  async alarm() {
    if (this.state.phase === 'waiting') {
      const humans = this.state.players.filter(p => !p.bot && p.stack > 0 && !p.leaving);
      if (!humans.length) return;
      this.fillBots(); this.startHand(); await this.runOn(); await this.save(); this.broadcast(); return;
    }
    if (this.state.phase === 'showdown') {
      this.state.players = this.state.players.filter(p => !p.leaving && (p.bot ? p.stack > 0 : (this.hasConnection(p.id) || Date.now() - p.seen < 120000)));
      this.state.players.forEach(p => { p.waiting = p.stack <= 0; });
      this.state.phase = 'waiting'; this.state.board = []; this.state.pot = 0; this.state.turnId = null; this.state.winners = [];
      this.fillBots(); this.startHand(); await this.runOn(); await this.save(); this.broadcast(); return;
    }
    const p = this.state.players.find(x => x.id === this.state.turnId);
    if (p && !p.bot) {
      const due = this.state.currentBet - p.bet;
      this.act(this.state.players.indexOf(p), due > 0 ? 'fold' : 'check');
      await this.runOn(); await this.save(); this.broadcast();
    }
  }

  async save() { await this.ctx.storage.put('table', this.state); }
  hasConnection(id) { return this.ctx.getWebSockets().some(ws => ws.deserializeAttachment()?.id === id); }
  send(ws, data) { try { ws.send(JSON.stringify(data)); } catch (e) {} }
  broadcast() {
    for (const ws of this.ctx.getWebSockets()) {
      const id = ws.deserializeAttachment()?.id;
      if (id) this.send(ws, this.view(id));
    }
    for (const [id, cashout] of Object.entries(this.state.cashouts)) for (const ws of this.ctx.getWebSockets()) if (ws.deserializeAttachment()?.id === id) this.send(ws, { type: 'cashout', ...cashout });
  }
  view(id) {
    const reveal = this.state.phase === 'showdown';
    const players = this.state.players.map((p, i) => ({
      id: p.id, name: p.name, bot: p.bot, stack: p.stack, bet: p.bet, folded: p.folded, allIn: p.allIn,
      waiting: p.waiting, leaving: p.leaving, dealer: i === this.state.dealer,
      cards: (reveal && !p.folded) || p.id === id ? p.cards : []
    }));
    const me = this.state.players.find(p => p.id === id);
    const call = me ? Math.min(me.stack, Math.max(0, this.state.currentBet - me.bet)) : 0;
    return { type: 'state', table: this.tier, phase: this.state.phase, players, board: this.state.board, pot: this.state.pot, currentBet: this.state.currentBet, turnId: this.state.turnId, myId: id, call, minRaise: this.state.minRaise, maxBet: this.tableConfig().maxBet, message: this.state.message, winners: this.state.winners, handNo: this.state.handNo };
  }
  tableConfig() { return TABLES[this.tier] || TABLES.low; }
  fillBots() {
    const t = this.tableConfig();
    while (this.state.players.length < MAX_SEATS) {
      const id = 'bot-' + crypto.randomUUID();
      this.state.players.push({ id, name: ['Mila', 'Theo', 'Nora', 'Ben', 'Lina', 'Emil', 'Ida'][this.state.players.length % 7], stack: Math.min(t.max, Math.max(t.min, 500)), bot: true, cards: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, waiting: false, leaving: false, seen: Date.now() });
    }
  }
  nextSeat(from, test) {
    for (let step = 1; step <= this.state.players.length; step++) { const i = (from + step + this.state.players.length) % this.state.players.length; if (test(this.state.players[i], i)) return i; }
    return -1;
  }
  startHand() {
    const s = this.state, t = this.tableConfig();
    s.players.forEach(p => { if (p.stack > 0 && !p.leaving) p.waiting = false; });
    const active = s.players.filter(p => p.stack > 0 && !p.waiting && !p.leaving);
    if (active.length < 2) { s.phase = 'waiting'; s.turnId = null; s.message = 'Warte auf Spieler.'; return; }
    s.deck = cards(); s.board = []; s.pot = 0; s.currentBet = 0; s.minRaise = t.bb; s.winners = []; s.handNo++;
    s.players.forEach(p => { p.cards = []; p.bet = 0; p.total = 0; p.folded = p.stack <= 0 || p.waiting || p.leaving; p.allIn = false; p.acted = false; });
    let button = this.nextSeat(s.dealer, p => !p.folded); if (button < 0) button = active.length ? s.players.indexOf(active[0]) : -1;
    s.dealer = button;
    const small = active.length === 2 ? button : this.nextSeat(button, p => !p.folded);
    const big = this.nextSeat(small, p => !p.folded);
    for (const p of active) p.cards = [s.deck.pop(), s.deck.pop()];
    this.postBlind(s.players[small], t.sb); this.postBlind(s.players[big], t.bb);
    s.currentBet = Math.max(s.players[small].bet, s.players[big].bet); s.phase = 'preflop'; s.message = 'Hand ' + s.handNo + ' · Vor dem Flop';
    s.turnId = s.players[big]?.id || null;
  }
  postBlind(p, amount) { const put = Math.min(amount, p.stack); p.stack -= put; p.bet += put; p.total += put; this.state.pot += put; if (p.stack === 0) p.allIn = true; }
  act(i, action) {
    const s = this.state, p = s.players[i];
    if (!p || p.folded || p.allIn || p.id !== s.turnId) return false;
    const owed = Math.max(0, s.currentBet - p.bet);
    if (action === 'fold') { p.folded = true; p.acted = true; s.message = p.name + ' passt.'; }
    else if (action === 'check' && owed === 0) { p.acted = true; s.message = p.name + ' checkt.'; }
    else if (action === 'call' && owed > 0) { const put = Math.min(owed, p.stack, Math.max(0, this.tableConfig().maxBet - p.bet)); p.stack -= put; p.bet += put; p.total += put; s.pot += put; p.allIn = p.stack === 0; p.acted = true; s.message = p.name + ' geht mit.'; }
    else if (action === 'raise' || action === 'allin') {
      const cap = this.tableConfig().maxBet;
      const target = action === 'allin' ? Math.min(p.bet + p.stack, cap) : Math.min(p.bet + p.stack, cap, s.currentBet + s.minRaise);
      const put = Math.max(0, target - p.bet); if (!put) return false;
      if (action === 'raise' && target < s.currentBet + s.minRaise) return false;
      if (target <= s.currentBet) return false;
      p.stack -= put; p.bet += put; p.total += put; s.pot += put;
      const increase = p.bet - s.currentBet; p.allIn = p.stack === 0; p.acted = true;
      if (increase > 0) { if (increase >= s.minRaise) s.minRaise = increase; s.currentBet = p.bet; s.players.forEach(q => { if (q !== p && !q.folded && !q.allIn) q.acted = false; }); }
      s.message = p.name + (p.allIn ? ' ist All-in.' : ' erhöht.');
    } else return false;
    s.turnId = p.id;
    return true;
  }
  needs(p) { return !p.folded && !p.allIn && (p.bet < this.state.currentBet || !p.acted); }
  async runOn() {
    const s = this.state;
    for (let guard = 0; guard < 64; guard++) {
      const alive = s.players.filter(p => !p.folded);
        if (alive.length <= 1) { await this.finish(); return; }
      const next = this.nextSeat(s.players.findIndex(p => p.id === s.turnId), p => this.needs(p));
      if (next < 0) {
        if (s.phase === 'river') { await this.finish(); return; }
        this.nextStreet();
        if (s.phase === 'showdown') { this.finish(); return; }
        continue;
      }
      const p = s.players[next]; s.turnId = p.id;
      if (!p.bot) { await this.ctx.storage.setAlarm(Date.now() + TURN_MS); return; }
      const owed = Math.min(p.stack, Math.max(0, s.currentBet - p.bet));
      const a = new Uint32Array(1); crypto.getRandomValues(a); const roll = a[0] % 100;
      const strength = this.preflopStrength(p.cards);
      if (owed === 0) {
        if (strength > 67 && roll < 32 && p.stack > s.minRaise) this.act(next, 'raise');
        else this.act(next, 'check');
      } else if (strength < 28 && roll < 62) this.act(next, 'fold');
      else if (owed > p.stack * .55 && strength < 75) this.act(next, 'fold');
      else this.act(next, 'call');
    }
  }
  preflopStrength(cs) { const [a,b] = cs || []; if (!a || !b) return 0; let score = (a.r + b.r) * 2; if (a.r === b.r) score += 28 + a.r; if (a.s === b.s) score += 7; if (Math.abs(a.r-b.r) === 1) score += 7; return score; }
  nextStreet() {
    const s = this.state;
    if (s.phase === 'preflop') { s.board.push(s.deck.pop(), s.deck.pop(), s.deck.pop()); s.phase = 'flop'; }
    else if (s.phase === 'flop') { s.board.push(s.deck.pop()); s.phase = 'turn'; }
    else if (s.phase === 'turn') { s.board.push(s.deck.pop()); s.phase = 'river'; }
    else { s.phase = 'showdown'; return; }
    s.currentBet = 0; s.minRaise = this.tableConfig().bb;
    s.players.forEach(p => { p.bet = 0; p.acted = false; });
    s.message = s.phase === 'flop' ? 'Flop' : s.phase === 'turn' ? 'Turn' : 'River';
    s.turnId = s.players[s.dealer]?.id || null;
  }
  async finish() {
    const s = this.state, eligible = s.players.filter(p => !p.folded);
    if (!s.board || s.board.length < 5) while (s.board.length < 5) s.board.push(s.deck.pop());
    const levels = [...new Set(s.players.map(p => p.total).filter(n => n > 0))].sort((a,b)=>a-b);
    let prev = 0; const won = new Map();
    for (const level of levels) {
      const contributors = s.players.filter(p => p.total >= level), pot = (level - prev) * contributors.length;
      const candidates = eligible.filter(p => p.total >= level);
      if (!candidates.length) candidates.push(...eligible);
      if (candidates.length) {
        let best = null, winners = [];
        for (const p of candidates) { const v = bestOf(p.cards.concat(s.board)); const c = best ? compare(v,best) : 1; if (c > 0) { best = v; winners = [p]; } else if (c === 0) winners.push(p); }
        const each = Math.floor(pot / winners.length), extra = pot % winners.length;
        winners.forEach((p,i) => { p.stack += each + (i < extra ? 1 : 0); won.set(p.id, (won.get(p.id) || 0) + each + (i < extra ? 1 : 0)); });
      }
      prev = level;
    }
    s.winners = [...won].map(([id, amount]) => ({ name: s.players.find(p=>p.id===id)?.name || 'Spieler', amount }));
    if (eligible.length === 1 && levels.length) {
      // A single remaining hand receives any uncalled chips through the same contribution layers.
    }
    s.phase = 'showdown'; s.turnId = null;
    s.message = s.winners.length ? s.winners.map(w => w.name + ' gewinnt ' + w.amount + ' Chips').join(' · ') : 'Keine Gewinnchips.';
    const leaving = s.players.filter(p => p.leaving);
    leaving.forEach(p => this.issueCashout(p));
    await this.ctx.storage.setAlarm(Date.now() + 5500);
  }
  async leave(p) {
    if (this.state.phase !== 'waiting' && this.state.phase !== 'showdown') {
      p.leaving = true;
      if (!p.bot && !p.folded) p.folded = true;
      await this.runOn(); await this.save(); this.broadcast();
    } else { this.issueCashout(p); await this.save(); this.broadcast(); }
  }
  issueCashout(p) {
    const id = p.id;
    this.state.cashouts[id] = { id: crypto.randomUUID(), amount: p.stack };
    this.state.players = this.state.players.filter(q => q !== p);
  }
}
