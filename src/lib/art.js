'use strict';

/**
 * Urun gorselleri: SVG data URI olarak uretilir.
 * Harici gorsel dosyasi gerektirmez, oyun kimligine gore renklenir.
 */

const THEMES = {
  valorant: { a: '#ff2b4a', b: '#ff6a3d', label: 'VALORANT' },
  cs2: { a: '#ff3b30', b: '#b3121f', label: 'COUNTER-STRIKE 2' },
  default: { a: '#ff2233', b: '#7a0d18', label: 'NEXUS' },
};

/** Basit ve deterministik bir hash (gorsel varyasyonu icin). */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const MOTIFS = ['grid', 'wave', 'pulse', 'crosshair'];

/**
 * @param {'valorant'|'cs2'|'default'} game
 * @param {string} seed
 * @returns {string} data:image/svg+xml;base64,...
 */
function productArt(game, seed = '') {
  const theme = THEMES[game] || THEMES.default;
  const motif = MOTIFS[hash(`${game}:${seed}`) % MOTIFS.length];
  const id = hash(seed).toString(36).slice(0, 6);

  const motifMarkup = {
    grid: `<g stroke="${theme.a}" stroke-opacity="0.35" stroke-width="1">
             ${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="360"/>`).join('')}
             ${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${i * 60}" x2="540" y2="${i * 60}"/>`).join('')}
           </g>`,
    wave: `<g fill="none" stroke="${theme.a}" stroke-opacity="0.45" stroke-width="2">
             <path d="M0 250 C 90 190, 150 300, 240 235 S 400 150, 540 215"/>
             <path d="M0 285 C 90 225, 150 335, 240 270 S 400 185, 540 250" stroke-opacity="0.22"/>
             <path d="M0 215 C 90 155, 150 265, 240 200 S 400 115, 540 180" stroke-opacity="0.16"/>
           </g>`,
    pulse: `<g fill="none" stroke="${theme.a}" stroke-opacity="0.5" stroke-width="2">
              <path d="M0 210 L120 210 L150 140 L185 285 L215 210 L540 210"/>
            </g>
            <g fill="none" stroke="${theme.a}" stroke-opacity="0.18">
              <circle cx="270" cy="180" r="70"/><circle cx="270" cy="180" r="110"/><circle cx="270" cy="180" r="150"/>
            </g>`,
    crosshair: `<g fill="none" stroke="${theme.a}" stroke-opacity="0.42" stroke-width="2">
                  <circle cx="270" cy="180" r="62"/>
                  <circle cx="270" cy="180" r="96" stroke-opacity="0.2"/>
                  <line x1="270" y1="70" x2="270" y2="130"/>
                  <line x1="270" y1="230" x2="270" y2="290"/>
                  <line x1="160" y1="180" x2="220" y2="180"/>
                  <line x1="320" y1="180" x2="380" y2="180"/>
                </g>`,
  }[motif];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 360" width="540" height="360" role="img" aria-label="${theme.label}">
  <defs>
    <linearGradient id="bg${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0a0c"/>
      <stop offset="0.55" stop-color="#140408"/>
      <stop offset="1" stop-color="#25060c"/>
    </linearGradient>
    <radialGradient id="glow${id}" cx="0.5" cy="0.42" r="0.62">
      <stop offset="0" stop-color="${theme.a}" stop-opacity="0.42"/>
      <stop offset="1" stop-color="${theme.a}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="scan${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${theme.b}" stop-opacity="0.30"/>
      <stop offset="1" stop-color="${theme.b}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="540" height="360" fill="url(#bg${id})"/>
  <rect width="540" height="360" fill="url(#glow${id})"/>
  <rect y="0" width="540" height="360" fill="url(#scan${id})"/>
  ${motifMarkup}
  <rect x="0.75" y="0.75" width="538.5" height="358.5" fill="none" stroke="${theme.a}" stroke-opacity="0.45" stroke-width="1.5"/>
  <g font-family="Segoe UI, Arial, sans-serif" font-weight="700">
    <text x="30" y="52" fill="${theme.a}" font-size="15" letter-spacing="4">NEXUS CHEATS</text>
    <text x="30" y="322" fill="#ffffff" font-size="26" letter-spacing="1">${theme.label}</text>
    <text x="30" y="346" fill="#ff8a96" font-size="12" letter-spacing="3">EGITIM PLATFORMU</text>
  </g>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

/** Kucuk kare gorsel (paketler, ikonlar). */
function planArt(accent = '#ff2233', badge = 'NEXUS') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="p" cx="0.5" cy="0.35" r="0.7">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="200" height="200" fill="#0a0a0c"/>
  <rect width="200" height="200" fill="url(#p)"/>
  <g fill="none" stroke="${accent}" stroke-opacity="0.4">
    <circle cx="100" cy="100" r="46"/><circle cx="100" cy="100" r="70" stroke-opacity="0.18"/>
  </g>
  <text x="100" y="108" text-anchor="middle" fill="#fff" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="2">${badge}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

module.exports = { productArt, planArt, THEMES };
