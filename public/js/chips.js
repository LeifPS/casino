// Chipstufen, Farben und Darstellung
export const CHIPS = [
  { w: 1,       name: 'Grau',       f: '#8f959d', r: '#eceef1', t: '#ffffff' },
  { w: 5,       name: 'Rot',        f: '#c8322f', r: '#f6dcda', t: '#ffffff' },
  { w: 10,      name: 'Dunkelblau', f: '#1f3f94', r: '#d3dcf4', t: '#ffffff' },
  { w: 25,      name: 'Dunkelgrün', f: '#1b6b3a', r: '#d3ebdb', t: '#ffffff' },
  { w: 50,      name: 'Hellblau',   f: '#4fb4e8', r: '#effaff', t: '#0b2c40' },
  { w: 100,     name: 'Schwarz',    f: '#1c1c21', r: '#dcdce2', t: '#ffffff' },
  { w: 500,     name: 'Lila',       f: '#7a3fb5', r: '#e7d8f6', t: '#ffffff' },
  { w: 1000,    name: 'Gold',       f: '#d9a521', r: '#fff1bd', t: '#3a2a00' },
  { w: 5000,    name: 'Pink',       f: '#ec5fa6', r: '#ffe3f0', t: '#ffffff' },
  { w: 10000,   name: 'Braun',      f: '#7a4a28', r: '#ecd6c2', t: '#ffffff' },
  { w: 25000,   name: 'Glut',       g: ['#ffb02e', '#e8412b', '#b3123a'], r: '#fff0d6', t: '#ffffff' },
  { w: 50000,   name: 'Aurora',     g: ['#22d3c2', '#3a7be0', '#7b3fe0'], r: '#e6fbff', t: '#ffffff' },
  { w: 100000,  name: 'Platin',     g: ['#fbfcfe', '#b7c0cc', '#7f8a99'], r: '#3f4856', t: '#1f2631' },
  { w: 500000,  name: 'Opal',       g: ['#ff7ac8', '#ffd86b', '#5be3d0', '#7d6cff'], r: '#ffffff', t: '#241a45' },
  { w: 1000000, name: 'Obsidian',   g: ['#4a3a8a', '#16122c', '#06050d'], r: '#f5c542', t: '#f5c542', radial: true },
];
export const CHIP_NACH_WERT = Object.fromEntries(CHIPS.map(c => [c.w, c]));

export const fmt = (n) => Math.floor(n).toLocaleString('de-DE');
export function kurz(w) {
  if (w >= 1000000) return (w / 1000000) + 'M';
  if (w >= 1000) return (w / 1000) + 'K';
  return String(w);
}

/** Einmal in die Seite setzen: Farbverläufe der Chips (display:none würde sie in manchen Browsern kaputtmachen). */
export function chipDefs() {
  let d = '<radialGradient id="chip-glanz" cx="35%" cy="28%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient>';
  for (const c of CHIPS) {
    if (!c.g) continue;
    const stops = c.g.map((col, i) => `<stop offset="${(i / (c.g.length - 1)).toFixed(2)}" stop-color="${col}"/>`).join('');
    d += c.radial
      ? `<radialGradient id="cg-${c.w}" cx="40%" cy="35%" r="80%">${stops}</radialGradient>`
      : `<linearGradient id="cg-${c.w}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>`;
  }
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${d}</defs></svg>`;
}

export function chipSvg(w) {
  const c = CHIP_NACH_WERT[w] || CHIPS[0];
  const fill = c.g ? `url(#cg-${w})` : c.f;
  const txt = kurz(w);
  const fs = txt.length <= 2 ? 31 : txt.length === 3 ? 26 : 21;
  return `<svg class="chip" viewBox="0 0 100 100" aria-hidden="true">` +
    `<circle cx="50" cy="50" r="48.5" fill="${fill}"/>` +
    `<circle cx="50" cy="50" r="42.3" fill="none" stroke="${c.r}" stroke-width="10.5" stroke-dasharray="16.6 16.6" transform="rotate(-11 50 50)"/>` +
    `<circle cx="50" cy="50" r="48.5" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1.6"/>` +
    `<circle cx="50" cy="50" r="31.5" fill="${fill}" stroke="${c.r}" stroke-width="2.2"/>` +
    `<circle cx="50" cy="50" r="48.5" fill="url(#chip-glanz)"/>` +
    `<text x="50" y="${50 + fs * 0.36}" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-weight="800" font-size="${fs}" fill="${c.t}">${txt}</text></svg>`;
}

/** Betrag in Chips zerlegen (größte zuerst): [{w, n}] */
export function zerlege(betrag) {
  let rest = Math.floor(betrag);
  const aus = [];
  for (let i = CHIPS.length - 1; i >= 0 && rest > 0; i--) {
    const n = Math.floor(rest / CHIPS[i].w);
    if (n) { aus.push({ w: CHIPS[i].w, n }); rest -= n * CHIPS[i].w; }
  }
  return aus;
}

/** Gestapelte Chips für einen Betrag, höchstens 4 Säulen à 5 Chips sichtbar */
export function stapelHtml(betrag) {
  const teile = zerlege(betrag).slice(0, 4);
  if (!teile.length) return '';
  return `<div class="stapel">` + teile.map(t => {
    const sicht = Math.min(t.n, 5);
    return `<div class="saeule">` + Array.from({ length: sicht }, () => chipSvg(t.w)).join('') + `</div>`;
  }).join('') + `</div>`;
}

/** Chips, die an einem Tisch als Setzknöpfe gezeigt werden: nicht kleiner als min/5, nicht größer als max */
export function setzChips(min, max) {
  return CHIPS.filter(c => c.w >= min / 5 && c.w <= max).map(c => c.w);
}
