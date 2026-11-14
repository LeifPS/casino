# Casino

Virtuelles Casino für den Leif Game Hub (LGH). Alle Spiele teilen sich ein gemeinsames Chipkonto (Start: 1.000 Chips, einmalig). Kein Echtgeld, keine Hexis.

- Blackjack (sechs Decks, 3:2, Verdoppeln, Teilen, Versicherung)
- Texas Hold’em (No Limit, 6 Plätze, Mehrspieler über einen Durable Object, freie Plätze füllen Computergegner, private Tische per Code)
- Roulette folgt

Chips liegen im `localStorage` (Schlüssel `casino.v1`) und gelten im selben Browser spielübergreifend. Auf andere Geräte kommen sie über den Spielstand-Code im Einstellungsmenü.

## Dateien

- `public/` – statisches Spiel (`index.html`, `js/`, `css/`), `lgh-vorlade.js` und `lgh-modul.js` stammen aus dem Hub (`tools/lgh-einbauen.py`)
- `src/worker.js`, `src/tisch.js`, `src/poker-engine.js` – Worker mit Poker-Tisch (Durable Object, WebSocket)
- `test/bj.test.mjs`, `test/poker.test.mjs` – Regeltests: `npm test`
- Lokal: `npm run dev` (wrangler dev)

## Deploy

Cloudflare Worker mit statischen Dateien und einem Durable Object `PokerTisch` (`wrangler.jsonc`, Migration `v1`), Adresse `https://casino.leifps.workers.dev`.
