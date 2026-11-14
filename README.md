# Casino

Virtuelles Casino für den Leif Game Hub (LGH). Alle Spiele teilen sich ein gemeinsames Chipkonto (Start: 1.000 Chips, einmalig). Kein Echtgeld, keine Hexis.

- Blackjack (sechs Decks, 3:2, Verdoppeln, Teilen, Versicherung)
- Texas Hold’em und Roulette folgen

Chips liegen im `localStorage` (Schlüssel `casino.v1`) und gelten im selben Browser spielübergreifend. Auf andere Geräte kommen sie über den Spielstand-Code im Einstellungsmenü.

## Dateien

- `public/` – statisches Spiel (`index.html`, `js/`, `css/`), `lgh-vorlade.js` und `lgh-modul.js` stammen aus dem Hub (`tools/lgh-einbauen.py`)
- `test/bj.test.mjs` – Regeltests Blackjack: `node test/bj.test.mjs`

## Deploy

Cloudflare Worker mit statischen Dateien (`wrangler.jsonc`), Adresse `https://casino.leifps.workers.dev`.
