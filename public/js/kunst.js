// Bilder der Spiele, aus Spielelementen gezeichnet (Karten, Chips, Rad)
function karteSvg(x, y, w, h, drehung, rang, farbe, rotFarbe) {
  const f = rotFarbe ? '#c4262e' : '#1c1c21';
  return `<g transform="rotate(${drehung} ${x + w / 2} ${y + h / 2})"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="#fbf8ef" stroke="#0004" stroke-width="1.5"/>` +
    `<text x="${x + 7}" y="${y + 19}" font-family="Georgia,serif" font-weight="700" font-size="19" fill="${f}">${rang}</text>` +
    `<text x="${x + w / 2}" y="${y + h / 2 + 15}" text-anchor="middle" font-size="${w * 0.62}" fill="${f}">${farbe}︎</text></g>`;
}
function chipMini(cx, cy, r, f, rand) {
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" stroke="#0006" stroke-width="1.2"/><circle cx="${cx}" cy="${cy}" r="${r * 0.87}" fill="none" stroke="${rand}" stroke-width="${r * 0.2}" stroke-dasharray="${r * 0.5} ${r * 0.5}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.58}" fill="none" stroke="${rand}" stroke-width="1.4"/>`;
  return s;
}
export function kunstBlackjack() {
  return `<svg viewBox="0 0 120 120" aria-hidden="true">${karteSvg(20, 16, 54, 76, -14, 'K', '♥', true)}${karteSvg(44, 20, 54, 76, 10, 'A', '♠', false)}${chipMini(34, 98, 15, '#c8322f', '#f6dcda')}${chipMini(52, 104, 13, '#1f3f94', '#d3dcf4')}</svg>`;
}
export function kunstPoker() {
  return `<svg viewBox="0 0 120 120" aria-hidden="true">${karteSvg(16, 14, 50, 70, -16, 'A', '♠', false)}${karteSvg(40, 14, 50, 70, 6, 'A', '♥', true)}${chipMini(84, 88, 17, '#1c1c21', '#dcdce2')}${chipMini(84, 80, 17, '#d9a521', '#fff1bd')}${chipMini(84, 72, 17, '#7a3fb5', '#e7d8f6')}</svg>`;
}
export function kunstRoulette() {
  const n = 12, cx = 60, cy = 60, R = 50, r = 22;
  let keile = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const p = (a, rr) => `${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`;
    const f = i === 0 ? '#1b8a4a' : i % 2 ? '#1c1c21' : '#c4262e';
    keile += `<path d="M${p(a0, r)} L${p(a0, R - 6)} A${R - 6},${R - 6} 0 0 1 ${p(a1, R - 6)} L${p(a1, r)} A${r},${r} 0 0 0 ${p(a0, r)}Z" fill="${f}" stroke="#e8c56a" stroke-width=".8"/>`;
  }
  return `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${R}" fill="#6b3f1d" stroke="#e8c56a" stroke-width="2"/>${keile}<circle cx="60" cy="60" r="${r - 2}" fill="#d9a521" stroke="#fff1bd" stroke-width="1.5"/><circle cx="60" cy="60" r="5" fill="#fff1bd"/><circle cx="86" cy="38" r="4" fill="#fff" stroke="#0004"/></svg>`;
}
export function kunstLobby() { return ''; }
