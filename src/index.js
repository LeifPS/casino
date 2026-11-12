import { PokerTable } from './poker-table.js';

const LIMITS = {
  low: { name: 'Einsteiger', min: 100, max: 1000, smallBlind: 1, bigBlind: 2, maxBet: 100 },
  classic: { name: 'Klassik', min: 500, max: 3000, smallBlind: 5, bigBlind: 10, maxBet: 500 },
  salon: { name: 'Salon', min: 2000, max: 10000, smallBlind: 25, bigBlind: 50, maxBet: 2500 }
};

export { PokerTable };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws/poker') {
      if (request.method !== 'GET') return new Response('GET erforderlich', { status: 405 });
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket-Upgrade erforderlich', { status: 426 });
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return new Response('Ungültiger Ursprung', { status: 403 });
      const tier = url.searchParams.get('tisch');
      if (!Object.prototype.hasOwnProperty.call(LIMITS, tier)) return new Response('Unbekannter Tisch', { status: 400 });
      const playerId = url.searchParams.get('id') || '';
      if (!/^[a-f0-9-]{36}$/i.test(playerId)) return new Response('Ungültige Spielkennung', { status: 400 });
      const name = (url.searchParams.get('name') || '').trim().replace(/\s+/g, ' ');
      if (!/^[\p{L}\p{N} _-]{2,16}$/u.test(name)) return new Response('Name muss 2 bis 16 Zeichen haben.', { status: 400 });
      const buyIn = Number(url.searchParams.get('buyIn'));
      const limits = LIMITS[tier];
      if (!Number.isSafeInteger(buyIn) || buyIn < limits.min || buyIn > limits.max) return new Response('Buy-in außerhalb des Tischlimits.', { status: 400 });
      const stub = env.POKER_TABLE.getByName(tier);
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};
