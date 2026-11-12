# Casino

Virtuelles Casino-Spiel für den Leif Game Hub. Die erste Etappe enthält Blackjack; weitere Spiele folgen schrittweise. Es gibt keine Echtgeldzahlungen und keine Verbindung zur Hub-Währung Hexis.

## Blackjack

- Startguthaben: 1.000 virtuelle Chips, spielübergreifend im lokalen Browserstand gespeichert.
- Tabellen: Einsteiger, Klassik und Salon mit gestaffeltem Buy-in und Höchsteinsatz.
- Dealer steht auf Soft 17. Blackjack zahlt 3:2. Verdoppeln und einmaliges Teilen sind möglich.
- Hub-Lautstärke und eigener Spielton-Schalter; Spielstand-Code im Einstellungsmenü.

## Lokal starten

Mit Wrangler:

```sh
npx wrangler dev
```

## Geplant

Texas Hold’em mit echten Spielern und Computergegnern zum Auffüllen freier Plätze. Echtzeit-Tische werden später über Cloudflare Workers und Durable Objects umgesetzt.
