// Spielkarten als HTML
export const FARBEN = ['♠', '♥', '♦', '♣'];
export const RAENGE = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'D', 'K'];
const VS = '︎';   // Textdarstellung erzwingen (kein Emoji)

export const farbe = (c) => Math.floor(c / 13);
export const rang = (c) => c % 13;
export const rot = (c) => farbe(c) === 1 || farbe(c) === 2;
export const name = (c) => RAENGE[rang(c)] + FARBEN[farbe(c)];

/** o: { neu: Verzögerungsschritte oder undefined, rueck: true, dreh: true, klein: true } */
export function karteHtml(c, o = {}) {
  const kl = ['karte'];
  let stil = '';
  if (o.neu !== undefined) { kl.push('neu'); stil = ` style="--v:${o.neu}"`; }
  if (o.dreh) kl.push('dreh');
  if (o.rueck) { kl.push('rueck'); return `<div class="${kl.join(' ')}"${stil}><i></i></div>`; }
  kl.push(rot(c) ? 'rot' : 'schwarz');
  const r = RAENGE[rang(c)], f = FARBEN[farbe(c)] + VS;
  return `<div class="${kl.join(' ')}"${stil} data-k="${c}"><span class="ecke o"><b>${r}</b><u>${f}</u></span><span class="mitte">${f}</span><span class="ecke u"><b>${r}</b><u>${f}</u></span></div>`;
}
