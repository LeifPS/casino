// Einsatzleiste für Spiele mit einem Einsatz pro Runde (Video-Poker, Automat)
import { chipSvg, setzChips, stapelHtml, fmt } from './chips.js';
import { Ton } from './ton.js';

/** { einsatz, tt, c (Guthaben), letzter, aktion: { a, text } } */
export function wettHtml({ einsatz, tt, c, letzter, aktion }) {
  const grenze = Math.min(tt.max, c);
  const knoepfe = setzChips(tt.min, tt.max).map(w => `<button type="button" class="chipknopf" data-a="chip" data-w="${w}" aria-label="${fmt(w)} Chips"${einsatz + w > grenze ? ' disabled' : ''}>${chipSvg(w)}</button>`).join('');
  const geht = einsatz >= tt.min && einsatz <= grenze;
  const nochmal = letzter >= tt.min && letzter <= grenze && letzter !== einsatz;
  return `<div class="einsatzbereich"><div class="einsatzfeld">${einsatz ? stapelHtml(einsatz) : '<span class="leer">Einsatz</span>'}<span class="betrag">${einsatz ? fmt(einsatz) : '0'}</span></div>
    <div class="chipreihe">${knoepfe}</div>
    <div class="knoepfe w4"><button type="button" class="knopf leise" data-a="loeschen"${einsatz ? '' : ' disabled'}>Löschen</button><button type="button" class="knopf leise" data-a="letzter"${nochmal ? '' : ' disabled'}>Letzter</button><button type="button" class="knopf leise" data-a="max"${grenze >= tt.min && einsatz !== grenze ? '' : ' disabled'}>Max</button><button type="button" class="knopf gold gross" data-a="${aktion.a}"${geht ? '' : ' disabled'}>${aktion.text}</button></div></div>`;
}
/** Gibt den neuen Einsatz zurück oder undefined, wenn die Aktion nichts mit dem Einsatz zu tun hat. */
export function wettAktion(a, w, { einsatz, tt, c, letzter }) {
  const grenze = Math.min(tt.max, c);
  if (a === 'chip') { const n = Number(w); if (einsatz + n <= grenze) { Ton.chip(); return einsatz + n; } return einsatz; }
  if (a === 'loeschen') { Ton.klick(); return 0; }
  if (a === 'letzter') { Ton.chip(); return Math.max(0, Math.min(letzter, grenze)); }
  if (a === 'max') { Ton.chips(); return grenze >= tt.min ? grenze : 0; }
  return undefined;
}
