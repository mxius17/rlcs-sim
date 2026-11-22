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
  const mix = (a, b, t) => { const p = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, k) => Math.round(v + (B[k] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const cache = new Map();

  /** o: { seed, region, country, age, color (club colour) } → SVG string, 200 x 250.
      Head pose (turn + tilt), a key light from one side with shading and a coloured rim light, textured hair,
      skin texture, varied expressions and an arena background with blurred stage lights. */
  function svg(o) {
    const r = rng(String(o.seed));
    const rr = (a, b) => a + r() * (b - a);
    const region = COUNTRY_REGION[o.country] || o.region || 'EU';
    const skin = SKIN[pickW(r, (SKIN_W[region] || SKIN_W.EU).map((w, i) => [i, w]))];
    const dark = parseInt(skin.slice(1, 3), 16) < 150;
    let hairC = pickW(r, HAIR_C);
    if ((region === 'APAC' || region === 'SSA' || region === 'MENA') && r() < 0.75) hairC = r() < 0.7 ? '#14110f' : '#2b1d14';
    const col = /^#[0-9a-f]{6}$/i.test(o.color || '') ? o.color : '#1f5bff';
    const age = o.age || 18;
    // pose and light
    const yaw = rr(-0.32, 0.32), tilt = rr(-5, 5), L = r() < 0.5 ? -1 : 1;
    const cx = 100, W = rr(50, 60), jaw = rr(0.58, 0.88), cheek = rr(0.96, 1.06);
    const top = rr(54, 62), chin = rr(172, 182), eyeY = rr(110, 116);
    const wl = W * (1 + yaw * 0.16), wr = W * (1 - yaw * 0.16); // the side turned towards us looks wider
    const fx = cx + yaw * W * 0.55; // the features follow the turn
    const gl = rr(19, 24) * (1 + yaw * 0.28), gr = (gl / (1 + yaw * 0.28)) * (1 - yaw * 0.28);
    const eyeW = rr(7.5, 9.5), eyeH = rr(3.2, 4.6);
    const sk = { base: skin, hi: shade(skin, 0.22), lo: shade(skin, -0.28), deep: shade(skin, -0.45), lip: mix(shade(skin, -0.22), '#b0485a', dark ? 0.18 : 0.32) };
    const hD = shade(hairC, -0.35), hL = shade(hairC, 0.28);
    const out = [];
    const defs = [];
    // ---- defs: gradients, blur, skin noise
    defs.push(`<radialGradient id="bg" cx="${50 + L * 18}%" cy="20%" r="95%"><stop offset="0" stop-color="${shade(col, -0.25)}"/><stop offset=".55" stop-color="${shade(col, -0.7)}"/><stop offset="1" stop-color="#05060a"/></radialGradient>`);
    defs.push(`<linearGradient id="sk" x1="${L > 0 ? 1 : 0}" y1="0" x2="${L > 0 ? 0 : 1}" y2="0.25"><stop offset="0" stop-color="${sk.hi}"/><stop offset=".45" stop-color="${sk.base}"/><stop offset=".85" stop-color="${sk.lo}"/><stop offset="1" stop-color="${sk.deep}"/></linearGradient>`);
    defs.push(`<radialGradient id="iris" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="${shade('#000000', 0)}"/><stop offset=".35" stop-color="IRIS"/><stop offset=".85" stop-color="IRISD"/><stop offset="1" stop-color="#0a0a0a"/></radialGradient>`);
    defs.push(`<linearGradient id="kit" x1="0" y1="0" x2="${L > 0 ? 0 : 1}" y2="1"><stop offset="0" stop-color="${shade(col, 0.12)}"/><stop offset="1" stop-color="${shade(col, -0.55)}"/></linearGradient>`);
    defs.push('<filter id="b2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter><filter id="b5" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter><filter id="b10" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>');
    defs.push(`<filter id="tex" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${rr(0.8, 1.2).toFixed(2)}" numOctaves="2" seed="${Math.floor(r() * 99)}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>`);
    // ---- background: arena, blurred stage lights, a light beam
    out.push('<rect width="200" height="250" fill="url(#bg)"/>');
    for (let i = 0; i < 9; i++) out.push(`<circle cx="${rr(0, 200).toFixed(1)}" cy="${rr(10, 150).toFixed(1)}" r="${rr(4, 14).toFixed(1)}" fill="${r() < 0.6 ? shade(col, 0.35) : '#ffffff'}" opacity="${rr(0.12, 0.35).toFixed(2)}" filter="url(#b5)"/>`);
    out.push(`<path d="M${100 + L * 120} -10 L${100 + L * 40} 260 L${100 + L * 90} 260Z" fill="#ffffff" opacity=".05" filter="url(#b10)"/>`);
    // ---- body: jersey with folds and collar, turned a little with the head
    const sx = yaw * 10;
    out.push(`<path d="M${4 + sx} 250 Q${8 + sx} 206 ${54 + sx} 193 Q${78 + sx} 186 ${100 + sx} 189 Q${122 + sx} 186 ${146 + sx} 193 Q${192 + sx} 206 ${196 + sx} 250Z" fill="url(#kit)"/>`);
    out.push(`<path d="M${30 + sx} 250 Q${40 + sx} 222 ${46 + sx} 204 M${170 + sx} 250 Q${160 + sx} 222 ${154 + sx} 204" stroke="${shade(col, -0.5)}" stroke-width="3" fill="none" opacity=".5" filter="url(#b2)"/>`);
    if (r() < 0.55) out.push(`<path d="M${22 + sx} 250 L${44 + sx} 200 L${52 + sx} 198 L${34 + sx} 250Z M${178 + sx} 250 L${156 + sx} 200 L${148 + sx} 198 L${166 + sx} 250Z" fill="${shade(col, 0.4)}" opacity=".55"/>`);
    out.push(`<circle cx="${100 + sx + L * 40}" cy="222" r="9" fill="${shade(col, 0.5)}" opacity=".18"/>`); // crest
    // ---- head group (tilted)
    out.push(`<g transform="rotate(${tilt.toFixed(2)} 100 190)">`);
    // neck with shadow under the jaw
    out.push(`<path d="M${fx - 21} ${chin - 22} L${cx - 24} 197 Q${cx} 210 ${cx + 24} 197 L${fx + 21} ${chin - 22}Z" fill="${sk.lo}"/>`);
    out.push(`<ellipse cx="${fx}" cy="${chin - 4}" rx="${W * 0.62}" ry="13" fill="${sk.deep}" opacity=".7" filter="url(#b5)"/>`);
    out.push(`<path d="M${76 + sx} 192 Q${100 + sx} 214 ${124 + sx} 192 L${118 + sx} 187 Q${100 + sx} 203 ${82 + sx} 187Z" fill="${shade(col, -0.6)}"/>`);
    // ears (the far ear tucks behind the head when turned)
    [[-1, wl], [1, wr]].forEach(([s, w]) => {
      const far = s * yaw > 0.12; const ex = cx + s * (w - (far ? 6 : 2)), ey = eyeY + 7;
      out.push(`<path d="M${ex} ${ey - 15} Q${ex + s * 13} ${ey - 13} ${ex + s * 11} ${ey + 4} Q${ex + s * 9} ${ey + 16} ${ex} ${ey + 15}Z" fill="${s === L ? sk.base : sk.lo}"/><path d="M${ex + s * 2} ${ey - 9} Q${ex + s * 9} ${ey - 7} ${ex + s * 7} ${ey + 4}" stroke="${sk.deep}" stroke-width="2" fill="none" opacity=".55"/>`);
    });
    // head shape
    const hp = `M${fx + yaw * 4} ${top} C${cx + wr * 0.7} ${top - 1} ${cx + wr} ${top + 18} ${cx + wr} ${eyeY - 22} C${cx + wr * cheek} ${eyeY + 8} ${cx + wr * cheek - 2} ${eyeY + 26} ${cx + wr * jaw + 4} ${chin - 20} C${fx + wr * jaw * 0.6} ${chin - 4} ${fx + 12} ${chin + 2} ${fx + yaw * 6} ${chin + 1} C${fx - 12} ${chin + 2} ${fx - wl * jaw * 0.6} ${chin - 4} ${cx - wl * jaw - 4} ${chin - 20} C${cx - wl * cheek + 2} ${eyeY + 26} ${cx - wl * cheek} ${eyeY + 8} ${cx - wl} ${eyeY - 22} C${cx - wl} ${top + 18} ${cx - wl * 0.7} ${top - 1} ${fx + yaw * 4} ${top}Z`;
    defs.push(`<clipPath id="hc"><path d="${hp}"/></clipPath>`);
    out.push(`<path d="${hp}" fill="url(#sk)"/>`);
    out.push('<g clip-path="url(#hc)">');
    // form shading: cheekbones, temples, under the nose, chin, a soft key-light highlight
    out.push(`<ellipse cx="${fx - L * (W * 0.75)}" cy="${eyeY + 10}" rx="${W * 0.45}" ry="70" fill="${sk.deep}" opacity=".35" filter="url(#b10)"/>`);
    out.push(`<ellipse cx="${fx + L * 16}" cy="${eyeY - 26}" rx="22" ry="16" fill="${sk.hi}" opacity=".55" filter="url(#b10)"/>`);
    [-1, 1].forEach((s) => out.push(`<ellipse cx="${fx + s * (s < 0 ? gl : gr) * 1.25}" cy="${eyeY + 22}" rx="12" ry="8" fill="${dark ? sk.hi : mix(sk.base, '#e0786e', 0.35)}" opacity="${dark ? 0.18 : 0.28}" filter="url(#b5)"/>`));
    out.push(`<ellipse cx="${fx}" cy="${chin - 8}" rx="14" ry="7" fill="${sk.hi}" opacity=".3" filter="url(#b5)"/>`);
    // eye sockets
    [-1, 1].forEach((s) => out.push(`<ellipse cx="${fx + s * (s < 0 ? gl : gr)}" cy="${eyeY - 3}" rx="${eyeW + 5}" ry="${eyeH + 5}" fill="${sk.deep}" opacity=".32" filter="url(#b2)"/>`));
    out.push('</g>');
    // skin texture
    out.push(`<path d="${hp}" fill="${sk.deep}" filter="url(#tex)" opacity=".07"/>`);
    defs.push(`<linearGradient id="rimg" x1="${L > 0 ? 0 : 1}" y1="0" x2="${L > 0 ? 1 : 0}" y2="0"><stop offset=".55" stop-color="${shade(col, 0.5)}" stop-opacity="0"/><stop offset="1" stop-color="${shade(col, 0.5)}" stop-opacity=".8"/></linearGradient>`);
    out.push(`<path d="${hp}" fill="none" stroke="url(#rimg)" stroke-width="3" opacity=".55" filter="url(#b2)"/>`);
    // facial hair (stubble uses the noise texture)
    const beard = age >= 20 ? pickW(r, [['none', 3.5], ['stubble', 3], ['beard', 1.2], ['goatee', 0.8], ['moustache', 0.4]]) : age >= 18 && r() < 0.25 ? 'stubble' : 'none';
    const bc = /^#(e9|2f|d2|3a)/i.test(hairC) ? '#2b1d14' : hairC;
    const mY0 = eyeY + rr(42, 50);
    const beardArea = `M${cx - wl + 6} ${eyeY + 20} C${cx - wl + 6} ${chin - 14} ${fx - 16} ${chin + 4} ${fx} ${chin + 2} C${fx + 16} ${chin + 4} ${cx + wr - 6} ${chin - 14} ${cx + wr - 6} ${eyeY + 20} L${cx + wr - 14} ${eyeY + 26} C${fx + 24} ${mY0 + 18} ${fx + 18} ${mY0 - 10} ${fx} ${mY0 - 12} C${fx - 18} ${mY0 - 10} ${fx - 24} ${mY0 + 18} ${cx - wl + 14} ${eyeY + 26}Z`;
    if (beard === 'stubble' || beard === 'beard') out.push(`<path d="${beardArea}" fill="${bc}" opacity="${beard === 'beard' ? 0.85 : 0.22}" ${beard === 'stubble' ? 'filter="url(#b2)"' : ''}/>`);
    if (beard === 'beard') for (let i = 0; i < 26; i++) { const x = rr(cx - wl + 10, cx + wr - 10), y = rr(mY0 + 4, chin - 2); out.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${rr(-2, 2).toFixed(1)} 5 ${rr(-1, 1).toFixed(1)} 9" stroke="${hL}" stroke-width=".8" opacity=".5" fill="none"/>`); }
    if (beard === 'goatee') out.push(`<path d="M${fx - 13} ${chin - 18} C${fx - 12} ${chin + 2} ${fx + 12} ${chin + 2} ${fx + 13} ${chin - 18} C${fx + 4} ${chin - 10} ${fx - 4} ${chin - 10} ${fx - 13} ${chin - 18}Z" fill="${bc}" opacity=".85"/>`);
    if (beard !== 'none' && beard !== 'stubble') out.push(`<path d="M${fx - 17} ${mY0 - 3} C${fx - 8} ${mY0 - 11} ${fx + 8} ${mY0 - 11} ${fx + 17} ${mY0 - 3} C${fx + 8} ${mY0 - 6} ${fx - 8} ${mY0 - 6} ${fx - 17} ${mY0 - 3}Z" fill="${bc}" opacity=".9"/>`);
    // eyes: almond shape, lids, lashes, iris with depth, catchlight
    const irisC = pickW(r, [['#3b2414', 5], ['#5a3a1e', 3], ['#2f5f8a', 1.1], ['#4f7a4a', 0.8], ['#7a6a3a', 0.5], ['#1c1c1c', 2]]);
    const lookX = rr(-1.4, 1.4) + yaw * 3;
    [-1, 1].forEach((s) => {
      const g = s < 0 ? gl : gr, k = s < 0 ? 1 + yaw * 0.22 : 1 - yaw * 0.22;
      const ex = fx + s * g, w = eyeW * k, h = eyeH;
      const eye = `M${ex - w} ${eyeY} Q${ex - w * 0.2} ${eyeY - h * 2.1} ${ex + w} ${eyeY - h * 0.2} Q${ex + w * 0.1} ${eyeY + h * 1.5} ${ex - w} ${eyeY}Z`;
      const eyeM = s > 0 ? eye : `M${ex + w} ${eyeY} Q${ex + w * 0.2} ${eyeY - h * 2.1} ${ex - w} ${eyeY - h * 0.2} Q${ex - w * 0.1} ${eyeY + h * 1.5} ${ex + w} ${eyeY}Z`;
      defs.push(`<clipPath id="e${s}"><path d="${eyeM}"/></clipPath>`);
      out.push(`<path d="${eyeM}" fill="#f4efe8"/>`);
      out.push(`<g clip-path="url(#e${s})"><circle cx="${ex + lookX}" cy="${eyeY - h * 0.25}" r="${h * 1.15}" fill="url(#iris)"/><circle cx="${ex + lookX}" cy="${eyeY - h * 0.25}" r="${h * 0.5}" fill="#050505"/><rect x="${ex - w}" y="${eyeY - h * 2.2}" width="${w * 2}" height="${h * 0.9}" fill="${sk.deep}" opacity=".35"/></g>`);
      out.push(`<circle cx="${ex + lookX + 1.5 * L}" cy="${eyeY - h * 0.65}" r="1.1" fill="#fff" opacity=".95"/>`);
      const lid = s > 0 ? `M${ex - w - 1} ${eyeY + 0.5} Q${ex - w * 0.2} ${eyeY - h * 2.3} ${ex + w + 1.5} ${eyeY - h * 0.1}` : `M${ex + w + 1} ${eyeY + 0.5} Q${ex + w * 0.2} ${eyeY - h * 2.3} ${ex - w - 1.5} ${eyeY - h * 0.1}`;
      out.push(`<path d="${lid}" stroke="#1a120d" stroke-width="2" fill="none" stroke-linecap="round"/>`);
      out.push(`<path d="${lid.replace(/(\d+(\.\d+)?) (\d+(\.\d+)?)/g, (m0, a, _b, c) => a + ' ' + (+c - 3.2).toFixed(2))}" stroke="${sk.deep}" stroke-width="1.2" fill="none" opacity=".55"/>`); // crease
      out.push(`<path d="M${ex - w * 0.8} ${eyeY + h * 0.9} Q${ex} ${eyeY + h * 1.6} ${ex + w * 0.8} ${eyeY + h * 0.9}" stroke="${sk.deep}" stroke-width=".9" fill="none" opacity=".4"/>`);
    });
    // brows: tapered and textured
    const bT = rr(2.6, 4.4), arch = rr(3, 7), bcol = /^#(e9|d8|a7)/i.test(hairC) ? '#6e4a2e' : shade(hairC, -0.05);
    [-1, 1].forEach((s) => {
      const g = s < 0 ? gl : gr, ex = fx + s * g, by = eyeY - 13 - rr(0, 2);
      const inner = ex - s * 10, outer = ex + s * 12;
      out.push(`<path d="M${inner} ${by + 1} Q${ex} ${by - arch} ${outer} ${by + 2} Q${ex} ${by - arch + bT} ${inner} ${by + 1 + bT}Z" fill="${bcol}" opacity=".92"/>`);
      for (let i = 0; i < 5; i++) { const t = i / 4, x = inner + (outer - inner) * t; out.push(`<path d="M${x.toFixed(1)} ${(by + bT * 0.6 - Math.sin(t * Math.PI) * arch * 0.8).toFixed(1)} l${(s * 3).toFixed(1)} -2" stroke="${hD}" stroke-width=".7" opacity=".6"/>`); }
    });
    // nose: bridge shadow on the far side, tip highlight, nostrils
    const nY = eyeY + rr(24, 30), nW = rr(7, 11), tip = fx + yaw * 9;
    out.push(`<path d="M${fx - L * 5} ${eyeY + 4} Q${tip - L * 7} ${nY - 10} ${tip - L * 8} ${nY - 2}" stroke="${sk.deep}" stroke-width="3" fill="none" opacity=".35" filter="url(#b2)"/>`);
    out.push(`<ellipse cx="${tip + L * 2}" cy="${nY - 4}" rx="4" ry="3.2" fill="${sk.hi}" opacity=".55" filter="url(#b2)"/>`);
    out.push(`<path d="M${tip - nW} ${nY} Q${tip - nW - 2} ${nY - 7} ${tip - nW + 3} ${nY - 8} M${tip + nW} ${nY} Q${tip + nW + 2} ${nY - 7} ${tip + nW - 3} ${nY - 8}" stroke="${sk.deep}" stroke-width="1.6" fill="none" opacity=".7"/>`);
    [-1, 1].forEach((s) => out.push(`<ellipse cx="${tip + s * nW * 0.45}" cy="${nY + 0.5}" rx="2.6" ry="1.5" fill="${shade(skin, -0.6)}" opacity=".85"/>`));
    out.push(`<path d="M${tip - nW} ${nY + 1} Q${tip} ${nY + 5} ${tip + nW} ${nY + 1}" stroke="${sk.lo}" stroke-width="1.4" fill="none" opacity=".6"/>`);
    // mouth: lips with colour and an expression
    const mx = fx + yaw * 5, mY = mY0, mW = rr(11, 16);
    const expr = pickW(r, [['neutral', 3], ['smile', 2.5], ['grin', 1.2], ['smirk', 1.2], ['focused', 1.2]]);
    const lift = expr === 'smile' ? 3 : expr === 'grin' ? 4 : 0, sm = expr === 'smirk' ? 3 : 0;
    out.push(`<path d="M${mx - 3} ${nY + 5} L${mx - 2} ${mY - 4} M${mx + 3} ${nY + 5} L${mx + 2} ${mY - 4}" stroke="${sk.lo}" stroke-width="1" opacity=".5"/>`); // philtrum
    out.push(`<path d="M${mx - mW} ${mY - lift} Q${mx - mW * 0.5} ${mY - 5} ${mx} ${mY - 3.5} Q${mx + mW * 0.5} ${mY - 5} ${mx + mW} ${mY - lift - sm} Q${mx} ${mY + 1} ${mx - mW} ${mY - lift}Z" fill="${shade(sk.lip, -0.08)}"/>`);
    if (expr === 'grin') out.push(`<path d="M${mx - mW + 2} ${mY - lift + 0.5} Q${mx} ${mY + 9} ${mx + mW - 2} ${mY - lift + 0.5} Q${mx} ${mY + 1.5} ${mx - mW + 2} ${mY - lift + 0.5}Z" fill="#f3efe9"/>`);
    out.push(`<path d="M${mx - mW} ${mY - lift} Q${mx} ${mY + (expr === 'focused' ? -1 : 2 + lift * 0.6)} ${mx + mW} ${mY - lift - sm}" stroke="${shade(sk.lip, -0.45)}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`);
    out.push(`<path d="M${mx - mW * 0.85} ${mY - lift + 1} Q${mx} ${mY + 8 + lift * 0.5} ${mx + mW * 0.85} ${mY - lift - sm + 1} Q${mx} ${mY + 3} ${mx - mW * 0.85} ${mY - lift + 1}Z" fill="${sk.lip}" opacity=".85"/>`);
    out.push(`<ellipse cx="${mx + L * 3}" cy="${mY + 4.5}" rx="4" ry="1.4" fill="#fff" opacity=".18"/>`);
    out.push(`<ellipse cx="${mx}" cy="${mY + 13}" rx="9" ry="3" fill="${sk.deep}" opacity=".35" filter="url(#b2)"/>`);
    if (expr === 'smile' || expr === 'grin') [-1, 1].forEach((s) => out.push(`<path d="M${mx + s * (mW + 4)} ${mY - 10} Q${mx + s * (mW + 8)} ${mY - 2} ${mx + s * (mW + 3)} ${mY + 4}" stroke="${sk.deep}" stroke-width="1.2" fill="none" opacity=".45"/>`));
    // hair: mass shape, then strands, then a shadow along the hairline
    const style = pickW(r, [['textured', 3], ['fringe', 2.4], ['sidepart', 2], ['quiff', 1.6], ['curly', 1.6], ['buzz', 1.4], ['long', 0.9], ['afro', region === 'SSA' ? 2.6 : 0.35], ['locs', region === 'SSA' || region === 'SAM' ? 1 : 0.2], ['bun', 0.4], ['fade', 1], ['bald', 0.2], ['cap', 0.5]]);
    const hairTop = top - rr(14, 26);
    const crown = `M${cx - wl - 3} ${eyeY - 20} C${cx - wl - 6} ${top - 14} ${cx - wl * 0.5} ${hairTop} ${fx + yaw * 6} ${hairTop} C${cx + wr * 0.5} ${hairTop} ${cx + wr + 6} ${top - 14} ${cx + wr + 3} ${eyeY - 20}`;
    const strands = (n, x0, x1, y0, y1, c, len, curl) => { let d = ''; for (let i = 0; i < n; i++) { const x = rr(x0, x1), y = rr(y0, y1); d += `M${x.toFixed(1)} ${y.toFixed(1)} q${(rr(-1, 1) * curl).toFixed(1)} ${(len * 0.5).toFixed(1)} ${(rr(-4, 4) + curl).toFixed(1)} ${len.toFixed(1)} `; } return `<path d="${d}" stroke="${c}" stroke-width=".9" fill="none" opacity=".55" stroke-linecap="round"/>`; };
    const hairline = top + rr(4, 12);
    let mass = '';
    if (style === 'textured' || style === 'fade') mass = `${crown} C${cx + wr - 2} ${top + 4} ${fx + 24} ${hairline - 4} ${fx + 8} ${hairline} C${fx - 8} ${hairline + 3} ${fx - 26} ${hairline - 4} ${cx - wl + 2} ${top + 6}Z`;
    if (style === 'fringe') mass = `${crown} C${cx + wr} ${top + 20} ${fx + 30} ${hairline + 18} ${fx + 18} ${hairline + 16} L${fx + 8} ${hairline + 24} L${fx - 6} ${hairline + 15} L${fx - 18} ${hairline + 26} L${fx - 30} ${hairline + 14} C${cx - wl} ${top + 24} ${cx - wl} ${top + 10} ${cx - wl - 3} ${eyeY - 20}Z`;
    if (style === 'sidepart') mass = `${crown} C${cx + wr} ${top + 10} ${fx + 26} ${hairline + 2} ${fx + 14} ${hairline} C${fx - 6} ${hairline - 10} ${fx - 30} ${hairline + 18} ${cx - wl + 2} ${top + 26}Z`;
    if (style === 'quiff') mass = `M${cx - wl - 3} ${eyeY - 20} C${cx - wl - 6} ${top - 10} ${fx - 30} ${hairTop - 6} ${fx + 4} ${hairTop - 14} C${fx + 34} ${hairTop - 18} ${cx + wr + 8} ${top - 18} ${cx + wr + 3} ${eyeY - 20} C${cx + wr - 4} ${top + 2} ${fx + 20} ${hairline - 2} ${fx} ${hairline} C${fx - 20} ${hairline} ${cx - wl + 4} ${top + 4} ${cx - wl - 3} ${eyeY - 20}Z`;
    if (style === 'long') mass = `M${cx - wl - 9} ${eyeY + 44} C${cx - wl - 18} ${top - 26} ${fx} ${hairTop - 10} ${fx} ${hairTop - 10} C${fx} ${hairTop - 10} ${cx + wr + 18} ${top - 26} ${cx + wr + 9} ${eyeY + 44} L${cx + wr - 4} ${eyeY + 38} C${cx + wr - 4} ${top + 12} ${fx + 18} ${hairline} ${fx + 6} ${hairline + 4} C${fx - 26} ${hairline} ${cx - wl + 2} ${top + 20} ${cx - wl + 4} ${eyeY + 38}Z`;
    if (style === 'buzz' || style === 'bald') mass = `${crown} C${cx + wr - 2} ${top + 8} ${fx + 20} ${hairline} ${fx} ${hairline + 2} C${fx - 20} ${hairline} ${cx - wl + 2} ${top + 8} ${cx - wl - 3} ${eyeY - 20}Z`;
    if (style === 'cap' || style === 'bun' || style === 'curly' || style === 'afro' || style === 'locs') mass = `${crown} C${cx + wr} ${top + 6} ${fx + 20} ${hairline - 2} ${fx} ${hairline} C${fx - 20} ${hairline - 2} ${cx - wl} ${top + 6} ${cx - wl - 3} ${eyeY - 20}Z`;
    if (style === 'afro') { let d = ''; const R = W * 1.32; for (let i = 0; i < 46; i++) { const a = Math.PI * (0.92 + (i / 45) * 1.16), rad = R * rr(0.92, 1.04); d += `M${(fx + Math.cos(a) * rad).toFixed(1)} ${(top + 26 + Math.sin(a) * rad * 0.9).toFixed(1)} m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 `; } out.push(`<path d="${d}" fill="${hairC}"/><ellipse cx="${fx}" cy="${top + 4}" rx="${R * 0.92}" ry="${R * 0.72}" fill="${hairC}"/>`); }
    if (style === 'locs') { for (let i = 0; i < 16; i++) { if (i > 3 && i < 12) continue; const a = 0, x = cx - wl - 6 + i * ((wl + wr + 12) / 15); out.push(`<path d="M${x.toFixed(1)} ${top - 4} Q${(x + rr(-6, 6)).toFixed(1)} ${eyeY + 10} ${(x + (i < 8 ? -8 : 8) + rr(-4, 4)).toFixed(1)} ${eyeY + 40 + rr(0, 26)}" stroke="${i % 2 ? hairC : hD}" stroke-width="6.5" fill="none" stroke-linecap="round"/>`); void a; } }
    if (style === 'bun') out.push(`<ellipse cx="${fx + yaw * 10}" cy="${hairTop - 10}" rx="17" ry="14" fill="${hairC}"/><path d="M${fx - 12} ${hairTop - 8} q12 -12 24 0" stroke="${hL}" stroke-width="1" fill="none" opacity=".5"/>`);
    if (mass && style !== 'bald') out.push(`<path d="${mass}" fill="${hairC}" ${style === 'buzz' ? 'opacity=".55"' : ''}/>`);
    if (style === 'fade') out.push(`<path d="M${cx - wl - 2} ${eyeY - 20} L${cx - wl + 2} ${top + 18} L${cx - wl + 6} ${eyeY - 6}Z M${cx + wr + 2} ${eyeY - 20} L${cx + wr - 2} ${top + 18} L${cx + wr - 6} ${eyeY - 6}Z" fill="${hairC}" opacity=".35"/>`);
    if (style === 'curly') { let d = ''; for (let i = 0; i < 34; i++) { const x = rr(cx - wl - 2, cx + wr + 2), y = rr(hairTop - 2, hairline - 2); d += `M${x.toFixed(1)} ${y.toFixed(1)} m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 `; } out.push(`<path d="${d}" fill="${hairC}"/><path d="${d}" fill="none" stroke="${hL}" stroke-width=".8" opacity=".35"/>`); }
    if (mass) defs.push(`<clipPath id="hm"><path d="${mass}"/></clipPath>`);
    if (['textured', 'fringe', 'sidepart', 'quiff', 'long', 'fade'].includes(style)) { out.push('<g clip-path="url(#hm)">'); out.push(strands(28, cx - wl, cx + wr, hairTop + 2, hairline - 4, hL, rr(7, 12), style === 'quiff' ? -3 : 2)); out.push(strands(16, cx - wl, cx + wr, hairTop + 4, hairline - 2, hD, rr(6, 10), 1)); out.push('</g>'); }
    if (style === 'textured') { let d = ''; for (let i = 0; i < 10; i++) { const x = cx - wl + 6 + i * ((wl + wr - 12) / 9); d += `M${x.toFixed(1)} ${hairTop + 4} l${rr(-5, 5).toFixed(1)} ${rr(-9, -4).toFixed(1)} `; } out.push(`<path d="${d}" stroke="${hairC}" stroke-width="5" stroke-linecap="round"/>`); }
    if (style === 'buzz') for (let i = 0; i < 60; i++) out.push(`<circle cx="${rr(cx - wl, cx + wr).toFixed(1)}" cy="${rr(hairTop + 6, hairline).toFixed(1)}" r=".7" fill="${hD}" opacity=".5"/>`);
    if (style === 'bald') out.push(`<ellipse cx="${fx + L * 10}" cy="${top + 6}" rx="16" ry="8" fill="#fff" opacity=".25" filter="url(#b5)"/>`);
    if (style === 'cap') out.push(`<path d="M${cx - wl - 7} ${top + 22} C${cx - wl - 6} ${hairTop - 12} ${fx} ${hairTop - 16} ${fx} ${hairTop - 16} C${fx} ${hairTop - 16} ${cx + wr + 6} ${hairTop - 12} ${cx + wr + 7} ${top + 22}Z" fill="url(#kit)"/><path d="M${cx - wl - 9} ${top + 22} Q${fx + yaw * 30} ${top + 8} ${cx + wr + 26 * (yaw >= 0 ? 1 : 0.4)} ${top + 18} Q${cx + wr + 26} ${top + 31} ${cx + wr - 8} ${top + 30} Q${fx} ${top + 24} ${cx - wl - 9} ${top + 30}Z" fill="${shade(col, -0.25)}"/><circle cx="${fx}" cy="${hairTop - 14}" r="3.5" fill="${shade(col, 0.4)}"/>`);
    if (style !== 'bald' && style !== 'cap' && style !== 'afro') out.push(`<path d="M${cx - wl + 6} ${hairline + 2} Q${fx} ${hairline + 10} ${cx + wr - 6} ${hairline + 2}" stroke="${sk.deep}" stroke-width="6" fill="none" opacity=".22" filter="url(#b5)"/>`);
    // glasses with a lens reflection
    if (r() < 0.13) {
      const gc = r() < 0.6 ? '#111' : shade(col, -0.2);
      [-1, 1].forEach((s) => { const g = s < 0 ? gl : gr, ex = fx + s * g; out.push(`<rect x="${ex - 13}" y="${eyeY - 9}" width="26" height="18" rx="6" fill="#bcd6ff" fill-opacity=".1" stroke="${gc}" stroke-width="2.4"/><path d="M${ex - 8} ${eyeY - 5} l6 -2" stroke="#fff" stroke-width="1.6" opacity=".5"/>`); });
      out.push(`<path d="M${fx - gl + 13} ${eyeY - 2} Q${fx} ${eyeY - 6} ${fx + gr - 13} ${eyeY - 2} M${cx - wl - 2} ${eyeY - 4} L${fx - gl - 13} ${eyeY - 4} M${cx + wr + 2} ${eyeY - 4} L${fx + gr + 13} ${eyeY - 4}" stroke="${gc}" stroke-width="2" fill="none"/>`);
    }
    // gaming headset, shaded, with a mic boom on one side
    if (r() < 0.6 && style !== 'cap') {
      const hc = r() < 0.5 ? '#15171c' : shade(col, -0.55), ac = r() < 0.5 ? col : '#3a3f4a';
      const band = `M${cx - wl - 11} ${eyeY + 2} C${cx - wl - 16} ${hairTop - 26} ${cx + wr + 16} ${hairTop - 26} ${cx + wr + 11} ${eyeY + 2}`;
      out.push(`<path d="${band}" stroke="${hc}" stroke-width="10" fill="none" stroke-linecap="round"/><path d="${band}" stroke="${shade(hc, 0.3)}" stroke-width="2.5" fill="none" opacity=".6" transform="translate(${L} -2)"/>`);
      [[-1, wl], [1, wr]].forEach(([s, w]) => { const x = cx + s * (w + 5); out.push(`<rect x="${x - 14}" y="${eyeY - 16}" width="28" height="44" rx="12" fill="${hc}"/><rect x="${x - 9}" y="${eyeY - 10}" width="18" height="32" rx="8" fill="${ac}" opacity=".9"/><rect x="${x - 9 + (s === L ? 3 : 0)}" y="${eyeY - 9}" width="5" height="26" rx="2.5" fill="#fff" opacity="${s === L ? 0.22 : 0.06}"/>`); });
      if (r() < 0.7) { const s = r() < 0.5 ? -1 : 1, w = s < 0 ? wl : wr; out.push(`<path d="M${cx + s * (w + 3)} ${eyeY + 22} Q${cx + s * (w - 4)} ${mY + 14} ${mx + s * (mW + 7)} ${mY + 3}" stroke="${hc}" stroke-width="3.4" fill="none" stroke-linecap="round"/><circle cx="${mx + s * (mW + 7)}" cy="${mY + 3}" r="4.6" fill="${hc}"/>`); }
    }
    // rim light on the lit edge in club colour
    out.push('</g>');
    // vignette
    out.push('<rect width="200" height="250" fill="url(#vg)"/>');
    defs.push('<radialGradient id="vg" cx="50%" cy="45%" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>');
    const irisD = shade(irisC, -0.4);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250"><defs>${defs.join('').replace('stop-color="IRIS"', `stop-color="${shade(irisC, 0.25)}"`).replace('stop-color="IRISD"', `stop-color="${irisD}"`).replace(`stop-color="${shade('#000000', 0)}"`, `stop-color="${shade(irisC, 0.45)}"`)}</defs>${out.join('')}</svg>`;
  }
  /** Data URI, cached per seed and colour. The 2D drawing comes back at once; when WebGL is available the
      PS2-style 3D portrait (js/faces3d.js) is rendered in the background, a few per frame, and every <img>
      still showing the 2D version is swapped to it. */
  const cache3d = new Map(), pending = new Map();
  let pumping = false;
  const later = (fn, slow) => (slow ? setTimeout(fn, 120) : global.requestIdleCallback ? global.requestIdleCallback(fn, { timeout: 300 }) : requestAnimationFrame(fn));
  function pump() {
    pumping = false;
    if (!pending.size) return;
    const k = Array.from(pending.keys()).pop(), job = pending.get(k); // newest first: what is on screen now
    pending.delete(k);
    const t0 = performance.now();
    const u = global.RLFaces3D.render(job.o);
    if (!u) { pending.clear(); return; }
    cache3d.set(k, u); if (cache3d.size > 1500) cache3d.delete(cache3d.keys().next().value);
    document.querySelectorAll('img').forEach((img) => { if (img.getAttribute('src') === job.s) img.src = u; });
    // one portrait per idle slot; back off on slow (software-rendered) GPUs so the page stays responsive
    if (pending.size) { pumping = true; later(pump, performance.now() - t0 > 40); }
  }
  function uri(o) {
    const k = o.seed + '|' + (o.color || '') + '|' + (o.age >= 20 ? 'a' : 'y');
    if (cache3d.has(k)) return cache3d.get(k);
    let u = cache.get(k);
    if (!u) { u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(o)); cache.set(k, u); if (cache.size > 3000) cache.delete(cache.keys().next().value); }
    if (global.RLFaces3D && global.RLFaces3D.available() && !pending.has(k)) { pending.set(k, { o, s: u }); if (!pumping) { pumping = true; later(pump, false); } }
    return u;
  }
  global.RLFaces = { svg, uri };
})(window);
