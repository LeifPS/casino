// Ein Pokertisch als Durable Object: Verbindungen, Zeitsteuerung und Speicherung. Die Regeln stehen in poker-engine.js.
import * as P from './poker-engine.js';

const TOKEN = /^[A-Za-z0-9_-]{16,48}$/;
const KASSE_TAGE = 30;

function saubererName(n) {
  n = String(n ?? '').replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
  return n || 'Gast';
}

export class PokerTisch {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.st = null; this.kasse = {}; this.stufe = 0;
    ctx.blockConcurrencyWhile(async () => {
      this.st = (await ctx.storage.get('st')) || null;
      this.kasse = (await ctx.storage.get('kasse')) || {};
      this.stufe = (await ctx.storage.get('stufe')) ?? 0;
      const grenze = Date.now() - KASSE_TAGE * 864e5;
      for (const t of Object.keys(this.kasse)) { this.kasse[t] = this.kasse[t].filter(e => e.zeit > grenze); if (!this.kasse[t].length) delete this.kasse[t]; }
    });
  }

  async fetch(request) {
    const raum = request.headers.get('x-raum') || '';
    const m = raum.match(/^s([0-5])-/);
    if (!m) return new Response('Raum', { status: 400 });
    if (this.stufe !== Number(m[1]) || !this.st) { this.stufe = Number(m[1]); await this.ctx.storage.put('stufe', this.stufe); if (!this.st) this.st = P.neuerTisch(this.stufe); }
    const paar = new WebSocketPair(); const [client, server] = Object.values(paar);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ token: null });
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---------- Hilfen ----------
  sockets() { return this.ctx.getWebSockets(); }
  tokenVon(ws) { try { return (ws.deserializeAttachment() || {}).token || null; } catch (e) { return null; } }
  senden(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (e) { } }
  async sichern() { await this.ctx.storage.put('st', this.st); await this.ctx.storage.put('kasse', this.kasse); }

  /** Auszahlungen an Spieler, die den Tisch verlassen haben (sofort, wenn verbunden, sonst in die Kasse bis zur Quittung) */
  ausgangVerarbeiten() {
    const st = this.st;
    while (st.ausgang.length) {
      const e = st.ausgang.shift();
      const eintrag = { nr: Date.now() * 1000 + Math.floor(Math.random() * 1000), betrag: e.betrag, grund: e.grund, zeit: Date.now() };
      (this.kasse[e.id] || (this.kasse[e.id] = [])).push(eintrag);
      for (const ws of this.sockets()) if (this.tokenVon(ws) === e.id) this.senden(ws, { t: 'ende', nr: eintrag.nr, betrag: eintrag.betrag, grund: eintrag.grund });
    }
  }

  sendeAlle() {
    for (const ws of this.sockets()) {
      const tk = this.tokenVon(ws); if (!tk) continue;
      this.senden(ws, P.ansicht(this.st, tk));
    }
  }

  async planen() {
    const t = P.naechsterTermin(this.st);
    if (t > 0) await this.ctx.storage.setAlarm(Math.max(t, Date.now() + 30));
    else await this.ctx.storage.deleteAlarm();
  }

  async nachAenderung() {
    // Ist kein Mensch mehr am Tisch, wird der Tisch zurückgesetzt (Bots spielen nicht allein weiter)
    if (!P.menschen(this.st).length && !this.st.wartend.length) {
      const offen = this.st.ausgang.length;
      if (!offen && this.st.sitze.some(Boolean)) this.st = P.neuerTisch(this.stufe);
    }
    this.ausgangVerarbeiten();
    await this.sichern(); this.sendeAlle(); await this.planen();
  }

  // ---------- Nachrichten ----------
  async webSocketMessage(ws, nachricht) {
    if (typeof nachricht !== 'string' || nachricht.length > 600) return;
    let m; try { m = JSON.parse(nachricht); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    P.umwelt.jetzt = () => Date.now();
    const st = this.st;
    let token = this.tokenVon(ws);

    if (m.t === 'hallo') {
      if (!TOKEN.test(String(m.token || ''))) return this.senden(ws, { t: 'fehler', text: 'Ungültige Kennung.' });
      token = m.token;
      for (const o of this.sockets()) if (o !== ws && this.tokenVon(o) === token) { this.senden(o, { t: 'ersetzt' }); try { o.serializeAttachment({ token: null }); o.close(1000, 'ersetzt'); } catch (e) { } }
      ws.serializeAttachment({ token });
      const sitz = st.sitze.findIndex(s => s && s.id === token && !s.weg);
      const wartet = st.wartend.some(s => s.id === token);
      // offene Auszahlungen immer (erneut) melden, bis der Client sie quittiert
      for (const e of this.kasse[token] || []) this.senden(ws, { t: 'ende', nr: e.nr, betrag: e.betrag, grund: e.grund });
      if (sitz >= 0 || wartet) {
        if (sitz >= 0) { const s = st.sitze[sitz]; s.verbunden = true; s.getrennt = 0; if (st.aktuell === sitz) st.frist = Math.max(st.frist, Date.now() + 15000); }
        this.senden(ws, { t: 'willkommen', wiederkehr: true });
        return this.nachAenderung();
      }
      if ((this.kasse[token] || []).length) return;               // war schon draußen, Auszahlung ist unterwegs
      if (m.wiederkehr) return this.senden(ws, { t: 'unbekannt' });
      const stufe = P.STUFEN[this.stufe], buyin = Math.floor(Number(m.buyin));
      if (!(buyin >= stufe.minBuy && buyin <= stufe.maxBuy)) return this.senden(ws, { t: 'fehler', text: 'Buy-in außerhalb des erlaubten Bereichs.' });
      const r = P.beitreten(st, { id: token, name: saubererName(m.name), stack: buyin });
      if (!r.ok) { this.senden(ws, { t: 'voll' }); return; }
      this.senden(ws, { t: 'willkommen', wiederkehr: false, sofort: r.sofort });
      if (st.phase === 'warten') P.naechsteHand(st);
      else if (st.phase === 'zwischen' && !st.zwischenBis) P.naechsteHand(st);
      return this.nachAenderung();
    }
    if (!token) return;

    if (m.t === 'quittung') {
      const liste = this.kasse[token]; if (liste) { this.kasse[token] = liste.filter(e => e.nr !== m.nr); if (!this.kasse[token].length) delete this.kasse[token]; }
      return this.sichern();
    }
    if (m.t === 'gehen') { P.verlassen(st, token, 'gegangen'); return this.nachAenderung(); }
    if (m.t === 'aktion') {
      const i = st.sitze.findIndex(s => s && s.id === token && !s.weg);
      if (i < 0 || st.aktuell !== i) return this.senden(ws, P.ansicht(st, token));
      const a = ['fold', 'check', 'call', 'raise', 'allin'].includes(m.a) ? m.a : null; if (!a) return;
      const r = P.aktion(st, i, a, Number(m.betrag) || 0);
      if (!r.ok) this.senden(ws, { t: 'fehler', text: r.fehler });
      return this.nachAenderung();
    }
    if (m.t === 'ping') return this.senden(ws, { t: 'pong' });
  }

  async trennen(ws) {
    const token = this.tokenVon(ws); if (!token) return;
    if (this.sockets().some(o => o !== ws && this.tokenVon(o) === token)) return;
    const i = this.st.sitze.findIndex(s => s && s.id === token && !s.weg);
    if (i >= 0) {
      const s = this.st.sitze[i]; s.verbunden = false; s.getrennt = Date.now();
      if (this.st.aktuell === i) this.st.frist = Math.min(this.st.frist, Date.now() + 1500);
    }
    await this.nachAenderung();
  }
  async webSocketClose(ws) { try { ws.close(); } catch (e) { } await this.trennen(ws); }
  async webSocketError(ws) { await this.trennen(ws); }

  async alarm() {
    const st = this.st; if (!st) return;
    let n = 0;
    while (n++ < 40) {
      const jetzt = Date.now(); P.umwelt.jetzt = () => jetzt;
      const t = P.naechsterTermin(st, jetzt);
      if (!t || t > jetzt) break;
      if (!P.schritt(st, jetzt)) break;
    }
    await this.nachAenderung();
  }
}
