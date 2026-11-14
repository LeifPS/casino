// Cloudflare Worker: liefert die statischen Dateien aus und leitet WebSocket-Verbindungen an den Pokertisch (Durable Object) weiter.
import { PokerTisch } from './tisch.js';
export { PokerTisch };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/ws\/(s[0-5]-[a-z0-9-]{1,24})$/);
    if (m) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket erwartet', { status: 426 });
      const origin = request.headers.get('Origin');
      if (origin) { try { if (new URL(origin).host !== url.host) return new Response('Fremder Ursprung', { status: 403 }); } catch (e) { return new Response('Ursprung', { status: 403 }); } }
      const stub = env.POKER.get(env.POKER.idFromName(m[1]));
      return stub.fetch(new Request(request, { headers: new Headers([...request.headers, ['x-raum', m[1]]]) }));
    }
    return env.ASSETS.fetch(request);
  },
};
