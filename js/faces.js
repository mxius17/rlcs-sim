/* RL Esports Simulator — generated player portraits.
 *
 * Players without a real photo (career rookies, academy prospects and wonderkids) get a drawn portrait, the way
 * FIFA career mode gives generated youth players a face. Everything comes from a seed, so a player always looks
 * the same: skin tone (weighted by nationality), face and jaw shape, hair style and colour, brows, eyes, nose,
 * mouth, facial hair for older players, sometimes glasses, often a gaming headset, and a jersey in club colours.
 */
(function (global) {
  'use strict';
  function rng(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; }; }
  const pickW = (r, list) => { const tot = list.reduce((s, x) => s + x[1], 0); let v = r() * tot; for (const x of list) { v -= x[1]; if (v <= 0) return x[0]; } return list[0][0]; };
  const SKIN = ['#f6d7c3', '#eec1a2', '#e0ac8a', '#c98e66', '#a96f4a', '#8a5636', '#6b3f26', '#4a2a19'];
  // skin tone weights by region / a few countries (index into SKIN)
  const SKIN_W = {
    EU: [3, 4, 3, 1.5, 0.6, 0.4, 0.3, 0.2], NA: [2, 3, 2.5, 2, 1.2, 1, 0.8, 0.5], SAM: [0.8, 2, 3, 3, 2, 1.2, 0.6, 0.3], MENA: [0.3, 1.5, 3, 3.5, 2, 0.8, 0.3, 0.1],
    OCE: [2.5, 3, 2, 1.5, 1, 0.6, 0.4, 0.2], APAC: [1.5, 3.5, 3, 2, 1, 0.4, 0.1, 0], SSA: [0.4, 0.6, 0.8, 1, 1.5, 2.5, 3, 2.5],
  };
  const COUNTRY_REGION = { Nigeria: 'SSA', Kenya: 'SSA', Ghana: 'SSA', Zimbabwe: 'SSA', Botswana: 'SSA', Namibia: 'SSA', 'South Africa': 'SSA', Mauritius: 'SSA', Japan: 'APAC', 'South Korea': 'APAC', China: 'APAC', Taiwan: 'APAC', 'Hong Kong': 'APAC', Thailand: 'APAC', Vietnam: 'APAC', Philippines: 'APAC', Indonesia: 'APAC', Malaysia: 'APAC', Singapore: 'APAC', India: 'MENA' };
  const HAIR_C = [['#14110f', 6], ['#2b1d14', 5], ['#4a3020', 3], ['#6e4a2e', 2], ['#a77b4b', 1.2], ['#d8b56d', 1], ['#8d3b1e', 0.5], ['#e9e4dc', 0.25], ['#2f5fd0', 0.15], ['#d24a8a', 0.12], ['#3aa776', 0.08]];
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)))); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };
  const cache = new Map();

  /** o: { seed, region, country, age, color (club colour) } → SVG string, 200 x 250 */
  function svg(o) {
    const r = rng(String(o.seed));
    const region = COUNTRY_REGION[o.country] || o.region || 'EU';
    const skin = SKIN[pickW(r, (SKIN_W[region] || SKIN_W.EU).map((w, i) => [i, w]))];
    const skinD = shade(skin, -0.18), skinL = shade(skin, 0.12);
    let hairC = pickW(r, HAIR_C);
    if ((region === 'APAC' || region === 'SSA' || region === 'MENA') && r() < 0.75) hairC = r() < 0.7 ? '#14110f' : '#2b1d14';
    const col = /^#[0-9a-f]{6}$/i.test(o.color || '') ? o.color : '#1f5bff';
    const colD = shade(col, -0.45), colL = shade(col, 0.25);
    const age = o.age || 18;
    const W = 52 + r() * 12; // face half-width
    const jaw = 0.55 + r() * 0.35; // 0.55 pointed … 0.9 square
    const cx = 100, top = 58, chin = 172 + r() * 8;
    const eyeY = 112 + r() * 4, eyeGap = 21 + r() * 4;
    const out = [];
    // background and spotlight
    out.push(`<defs><radialGradient id="bg" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="${shade(col, 0.15)}"/><stop offset="1" stop-color="${shade(col, -0.75)}"/></radialGradient><linearGradient id="sk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${skinD}"/><stop offset=".35" stop-color="${skin}"/><stop offset=".7" stop-color="${skinL}"/><stop offset="1" stop-color="${skinD}"/></linearGradient></defs>`);
    out.push('<rect width="200" height="250" fill="url(#bg)"/>');
    out.push(`<circle cx="100" cy="40" r="120" fill="#fff" opacity=".06"/>`);
    // shoulders + jersey (club colours), collar and a stripe
    out.push(`<path d="M10 250 Q14 204 58 192 Q80 186 100 190 Q120 186 142 192 Q186 204 190 250Z" fill="${col}"/>`);
    out.push(`<path d="M10 250 Q14 204 58 192 L64 250Z M190 250 Q186 204 142 192 L136 250Z" fill="${colD}" opacity=".55"/>`);
    if (r() < 0.6) out.push(`<path d="M40 250 L52 200 L60 198 L50 250Z M160 250 L148 200 L140 198 L150 250Z" fill="${colL}" opacity=".7"/>`);
    // neck
    out.push(`<path d="M${cx - 20} ${chin - 18} L${cx - 22} 196 Q${cx} 206 ${cx + 22} 196 L${cx + 20} ${chin - 18}Z" fill="${skinD}"/>`);
    out.push(`<path d="M76 192 Q100 214 124 192 L118 188 Q100 202 82 188Z" fill="${colD}"/>`);
    // ears
    [-1, 1].forEach((s) => out.push(`<ellipse cx="${cx + s * (W - 2)}" cy="${eyeY + 6}" rx="9" ry="14" fill="${skinD}"/><ellipse cx="${cx + s * (W - 2)}" cy="${eyeY + 6}" rx="4.5" ry="8" fill="${shade(skin, -0.3)}" opacity=".5"/>`));
    // head
    const jx = W * jaw;
    const head = `M${cx - W} ${eyeY - 30} Q${cx - W} ${top} ${cx} ${top} Q${cx + W} ${top} ${cx + W} ${eyeY - 30} L${cx + W - 2} ${eyeY + 22} Q${cx + W - 6} ${chin - 22} ${cx + jx} ${chin - 10} Q${cx} ${chin + 6} ${cx - jx} ${chin - 10} Q${cx - W + 6} ${chin - 22} ${cx - W + 2} ${eyeY + 22}Z`;
    out.push(`<path d="${head}" fill="url(#sk)"/>`);
    // facial hair for older players
    const beard = age >= 20 ? pickW(r, [['none', 4], ['stubble', 2.5], ['beard', 1.2], ['goatee', 0.8], ['moustache', 0.5]]) : age >= 18 && r() < 0.2 ? 'stubble' : 'none';
    const bc = shade(hairC === '#e9e4dc' || hairC.startsWith('#2f') || hairC.startsWith('#d2') || hairC.startsWith('#3a') ? '#2b1d14' : hairC, 0);
    if (beard === 'stubble') out.push(`<path d="M${cx - W + 6} ${eyeY + 24} Q${cx - W + 8} ${chin - 18} ${cx - jx} ${chin - 8} Q${cx} ${chin + 6} ${cx + jx} ${chin - 8} Q${cx + W - 8} ${chin - 18} ${cx + W - 6} ${eyeY + 24} L${cx + W - 14} ${eyeY + 28} Q${cx + 20} ${chin - 6} ${cx} ${chin - 4} Q${cx - 20} ${chin - 6} ${cx - W + 14} ${eyeY + 28}Z" fill="${bc}" opacity=".28"/>`);
    if (beard === 'beard') out.push(`<path d="M${cx - W + 4} ${eyeY + 18} Q${cx - W + 6} ${chin - 10} ${cx - jx} ${chin} Q${cx} ${chin + 16} ${cx + jx} ${chin} Q${cx + W - 6} ${chin - 10} ${cx + W - 4} ${eyeY + 18} L${cx + W - 12} ${eyeY + 22} Q${cx + 18} ${chin - 14} ${cx + 10} ${eyeY + 50} L${cx - 10} ${eyeY + 50} Q${cx - 18} ${chin - 14} ${cx - W + 12} ${eyeY + 22}Z" fill="${bc}" opacity=".9"/>`);
    if (beard === 'goatee') out.push(`<path d="M${cx - 14} ${chin - 20} Q${cx} ${chin + 6} ${cx + 14} ${chin - 20} Q${cx} ${chin - 10} ${cx - 14} ${chin - 20}Z" fill="${bc}" opacity=".85"/>`);
    if (beard === 'moustache' || beard === 'goatee' || beard === 'beard') out.push(`<path d="M${cx - 16} ${eyeY + 40} Q${cx} ${eyeY + 32} ${cx + 16} ${eyeY + 40} Q${cx} ${eyeY + 37} ${cx - 16} ${eyeY + 40}Z" fill="${bc}" opacity=".9"/>`);
    // brows
    const browT = 2.5 + r() * 2.5, browTilt = (r() - 0.5) * 6;
    [-1, 1].forEach((s) => out.push(`<path d="M${cx + s * (eyeGap - 11)} ${eyeY - 12 + s * browTilt * 0.2} Q${cx + s * eyeGap} ${eyeY - 17 - browTilt * 0.3} ${cx + s * (eyeGap + 12)} ${eyeY - 12}" stroke="${shade(hairC.startsWith('#e9') || hairC.startsWith('#d8') ? '#6e4a2e' : hairC, -0.1)}" stroke-width="${browT}" fill="none" stroke-linecap="round"/>`));
    // eyes
    const eyeW = 7 + r() * 2, eyeH = 3.4 + r() * 1.6, iris = pickW(r, [['#3b2414', 5], ['#5a3a1e', 3], ['#2f5f8a', 1.2], ['#4a7a4a', 0.8], ['#1c1c1c', 2]]);
    [-1, 1].forEach((s) => { const ex = cx + s * eyeGap; out.push(`<ellipse cx="${ex}" cy="${eyeY}" rx="${eyeW}" ry="${eyeH}" fill="#fff"/><circle cx="${ex + (r() - 0.5)}" cy="${eyeY}" r="${eyeH * 0.95}" fill="${iris}"/><circle cx="${ex}" cy="${eyeY}" r="${eyeH * 0.45}" fill="#0b0b0b"/><circle cx="${ex + 1.4}" cy="${eyeY - 1.2}" r="1" fill="#fff"/><path d="M${ex - eyeW} ${eyeY} Q${ex} ${eyeY - eyeH * 2} ${ex + eyeW} ${eyeY}" stroke="${shade(skin, -0.45)}" stroke-width="1.6" fill="none"/>`); });
    // nose and mouth
    const nW = 7 + r() * 5, nY = eyeY + 24 + r() * 4;
    out.push(`<path d="M${cx - 2} ${eyeY + 6} Q${cx - 4} ${nY - 6} ${cx - nW} ${nY} Q${cx} ${nY + 5} ${cx + nW} ${nY}" stroke="${shade(skin, -0.32)}" stroke-width="2" fill="none" stroke-linecap="round"/>`);
    const mY = nY + 16 + r() * 4, mW = 11 + r() * 6, smile = r();
    if (smile < 0.55) out.push(`<path d="M${cx - mW} ${mY} Q${cx} ${mY + 7 + smile * 6} ${cx + mW} ${mY}" stroke="${shade(skin, -0.42)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
    else if (smile < 0.8) out.push(`<path d="M${cx - mW} ${mY} Q${cx} ${mY + 12} ${cx + mW} ${mY} Q${cx} ${mY + 3} ${cx - mW} ${mY}Z" fill="#fff"/><path d="M${cx - mW} ${mY} Q${cx} ${mY + 12} ${cx + mW} ${mY}" stroke="${shade(skin, -0.42)}" stroke-width="2" fill="none"/>`);
    else out.push(`<path d="M${cx - mW + 2} ${mY + 2} L${cx + mW - 2} ${mY + 1}" stroke="${shade(skin, -0.42)}" stroke-width="2.4" stroke-linecap="round"/>`);
    out.push(`<path d="M${cx - mW + 3} ${mY + 9} Q${cx} ${mY + 13} ${cx + mW - 3} ${mY + 9}" stroke="${shade(skin, -0.15)}" stroke-width="1.5" fill="none" opacity=".6"/>`);
    // hair
    const style = pickW(r, [['crop', 3], ['fringe', 2.5], ['side', 2], ['curly', 1.6], ['buzz', 1.4], ['spiky', 1.2], ['long', 0.9], ['afro', region === 'SSA' ? 2.5 : 0.4], ['mohawk', 0.3], ['bald', 0.25], ['cap', 0.6]]);
    const hD = shade(hairC, -0.25), hL = shade(hairC, 0.18);
    const crown = `M${cx - W - 2} ${eyeY - 22} Q${cx - W - 6} ${top - 24} ${cx} ${top - 26} Q${cx + W + 6} ${top - 24} ${cx + W + 2} ${eyeY - 22}`;
    if (style === 'crop') out.push(`<path d="${crown} Q${cx + W - 6} ${top + 2} ${cx + 18} ${top + 6} Q${cx} ${top + 12} ${cx - 22} ${top + 6} Q${cx - W + 6} ${top + 2} ${cx - W - 2} ${eyeY - 22}Z" fill="${hairC}"/>`);
    if (style === 'buzz') out.push(`<path d="${crown} Q${cx + W - 4} ${top + 8} ${cx} ${top + 10} Q${cx - W + 4} ${top + 8} ${cx - W - 2} ${eyeY - 22}Z" fill="${hairC}" opacity=".55"/>`);
    if (style === 'fringe') out.push(`<path d="${crown} Q${cx + W} ${top + 24} ${cx + 30} ${top + 26} L${cx + 18} ${top + 18} L${cx + 6} ${top + 30} L${cx - 8} ${top + 20} L${cx - 22} ${top + 32} L${cx - 34} ${top + 22} Q${cx - W} ${top + 28} ${cx - W - 2} ${eyeY - 22}Z" fill="${hairC}"/>`);
    if (style === 'side') out.push(`<path d="${crown} Q${cx + W} ${top + 10} ${cx + 30} ${top + 12} Q${cx - 10} ${top + 2} ${cx - 34} ${top + 30} Q${cx - W} ${top + 20} ${cx - W - 2} ${eyeY - 22}Z" fill="${hairC}"/><path d="M${cx + 24} ${top - 18} Q${cx + 4} ${top - 2} ${cx - 30} ${top + 22}" stroke="${hL}" stroke-width="3" fill="none" opacity=".6"/>`);
    if (style === 'spiky') { let d = `M${cx - W - 2} ${eyeY - 22} Q${cx - W - 4} ${top} ${cx - W + 6} ${top - 10}`; for (let i = 0; i <= 8; i++) { const x = cx - W + 6 + i * ((2 * W - 12) / 8); d += ` L${x - 6} ${top - 12} L${x} ${top - 34 - r() * 12}`; } d += ` L${cx + W - 6} ${top - 10} Q${cx + W + 4} ${top} ${cx + W + 2} ${eyeY - 22} Q${cx + W - 8} ${top + 6} ${cx} ${top + 8} Q${cx - W + 8} ${top + 6} ${cx - W - 2} ${eyeY - 22}Z`; out.push(`<path d="${d}" fill="${hairC}"/>`); }
    if (style === 'curly' || style === 'afro') { const big = style === 'afro' ? 1.5 : 1; let d = ''; for (let i = 0; i < (style === 'afro' ? 24 : 16); i++) { const a = Math.PI + (i / (style === 'afro' ? 23 : 15)) * Math.PI, rr = (W + 6) * big; const x = cx + Math.cos(a) * rr * (style === 'afro' ? 0.92 : 1), y = top + 14 + Math.sin(a) * rr * (style === 'afro' ? 0.95 : 0.62); d += `M${x} ${y} m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 `; } out.push(`<path d="${d}" fill="${hairC}"/><path d="${crown} Q${cx} ${top + 14} ${cx - W - 2} ${eyeY - 22}Z" fill="${hairC}"/>`); }
    if (style === 'long') out.push(`<path d="M${cx - W - 6} ${eyeY + 40} Q${cx - W - 14} ${top - 30} ${cx} ${top - 28} Q${cx + W + 14} ${top - 30} ${cx + W + 6} ${eyeY + 40} L${cx + W - 4} ${eyeY + 36} Q${cx + W - 6} ${top + 10} ${cx + 10} ${top + 14} Q${cx - 30} ${top + 6} ${cx - W + 4} ${eyeY + 36}Z" fill="${hairC}"/>`);
    if (style === 'mohawk') out.push(`<path d="M${cx - 12} ${top + 6} Q${cx - 18} ${top - 40} ${cx} ${top - 46} Q${cx + 18} ${top - 40} ${cx + 12} ${top + 6}Z" fill="${hairC}"/><path d="${crown} Q${cx} ${top + 10} ${cx - W - 2} ${eyeY - 22}Z" fill="${hairC}" opacity=".35"/>`);
    if (style === 'cap') out.push(`<path d="M${cx - W - 6} ${top + 22} Q${cx - W - 4} ${top - 30} ${cx} ${top - 30} Q${cx + W + 4} ${top - 30} ${cx + W + 6} ${top + 22}Z" fill="${colD}"/><path d="M${cx - W - 8} ${top + 22} Q${cx} ${top + 8} ${cx + W + 30} ${top + 18} Q${cx + W + 30} ${top + 30} ${cx + W - 10} ${top + 30} Q${cx} ${top + 24} ${cx - W - 8} ${top + 30}Z" fill="${col}"/><circle cx="${cx}" cy="${top - 28}" r="4" fill="${colL}"/>`);
    if (style !== 'bald' && style !== 'cap') out.push(`<path d="M${cx - W + 2} ${eyeY - 26} Q${cx - W} ${top + 6} ${cx - W + 14} ${top} M${cx + W - 2} ${eyeY - 26} Q${cx + W} ${top + 6} ${cx + W - 14} ${top}" stroke="${hD}" stroke-width="4" fill="none" opacity=".6"/>`);
    // glasses
    if (r() < 0.14) { const gc = r() < 0.6 ? '#1b1b1b' : shade(col, -0.2); [-1, 1].forEach((s) => out.push(`<rect x="${cx + s * eyeGap - 13}" y="${eyeY - 9}" width="26" height="18" rx="6" fill="#ffffff" fill-opacity=".08" stroke="${gc}" stroke-width="2.6"/>`)); out.push(`<path d="M${cx - eyeGap + 13} ${eyeY - 2} Q${cx} ${eyeY - 6} ${cx + eyeGap - 13} ${eyeY - 2}" stroke="${gc}" stroke-width="2.4" fill="none"/>`); }
    // gaming headset (most pros wear one on camera)
    if (r() < 0.62 && style !== 'cap') {
      const hc = r() < 0.5 ? '#16181d' : colD, ac = r() < 0.5 ? col : '#2a2d35';
      out.push(`<path d="M${cx - W - 10} ${eyeY + 2} Q${cx - W - 14} ${top - 40} ${cx} ${top - 42} Q${cx + W + 14} ${top - 40} ${cx + W + 10} ${eyeY + 2}" stroke="${hc}" stroke-width="9" fill="none" stroke-linecap="round"/>`);
      out.push(`<path d="M${cx - W - 10} ${eyeY + 2} Q${cx - W - 14} ${top - 40} ${cx} ${top - 42} Q${cx + W + 14} ${top - 40} ${cx + W + 10} ${eyeY + 2}" stroke="${ac}" stroke-width="3" fill="none" opacity=".7"/>`);
      [-1, 1].forEach((s) => out.push(`<rect x="${cx + s * (W + 4) - 13}" y="${eyeY - 14}" width="26" height="40" rx="11" fill="${hc}"/><rect x="${cx + s * (W + 4) - 8}" y="${eyeY - 8}" width="16" height="28" rx="7" fill="${ac}" opacity=".9"/>`));
      if (r() < 0.7) out.push(`<path d="M${cx - W - 6} ${eyeY + 20} Q${cx - W + 4} ${mY + 14} ${cx - mW - 8} ${mY + 4}" stroke="${hc}" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="${cx - mW - 8}" cy="${mY + 4}" r="4.5" fill="${hc}"/>`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250">${out.join('')}</svg>`;
  }
  /** Data URI, cached per seed and colour. */
  function uri(o) {
    const k = o.seed + '|' + (o.color || '') + '|' + (o.age >= 20 ? 'a' : 'y');
    let u = cache.get(k);
    if (!u) { u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(o)); cache.set(k, u); if (cache.size > 3000) cache.delete(cache.keys().next().value); }
    return u;
  }
  global.RLFaces = { svg, uri };
})(window);
