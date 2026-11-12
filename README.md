# Casino

Virtuelles Casino-Spiel für den Leif Game Hub. Die erste Etappe enthält Blackjack; weitere Spiele folgen schrittweise. Es gibt keine Echtgeldzahlungen und keine Verbindung zur Hub-Währung Hexis.

## Blackjack

- Startguthaben: 1.000 virtuelle Chips, spielübergreifend im lokalen Browserstand gespeichert.
- Tabellen: Einsteiger, Klassik und Salon mit gestaffeltem Buy-in und Höchsteinsatz.
- Dealer steht auf Soft 17. Blackjack zahlt 3:2. Verdoppeln und einmaliges Teilen sind möglich.
- Hub-Lautstärke und eigener Spielton-Schalter; Spielstand-Code im Einstellungsmenü.
- Texas Hold’em mit sechs Plätzen, frei gewählten Anzeigenamen ohne Login und Computergegnern an freien Plätzen.
- Online-Tische laufen über WebSockets an Cloudflare Durable Objects. Die Chips eines Buy-ins liegen während der Partie am Tisch; beim Verlassen kommen sie ins gemeinsame lokale Konto zurück. Jede Poker-Runde hat zusätzlich ein festes Einsatzlimit.

## Lokal starten

Mit Wrangler:

```sh
wrangler dev
```

## Geplant

Weitere Casinospiele folgen schrittweise.
