/* RL Esports Simulator — PS2-style 3D portraits for generated players.
 *
 * A low-poly head is sculpted from a coarse sphere (jaw, chin, cheekbones, brow), given a small painted face
 * texture (eyes, brows, lips, stubble — like the 128px face maps of PS2-era sports games), chunky hair geometry,
 * ears, a nose, and optional headset / glasses / cap, on a jersey torso in club colours. It is lit with Gouraud
 * (per-vertex) lighting plus a coloured rim light, rendered at low resolution and cached as an image.
 * js/faces.js calls RLFaces3D.render() and falls back to its 2D drawing when WebGL is not available.
 */
(function (global) {
  'use strict';
  const T = global.THREE;
  const RW = 136, RH = 170; // low render resolution: the image is scaled up on screen
  let ctx3 = null, failed = false;

  function rng(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; }; }
  const pickW = (r, list) => { const tot = list.reduce((s, x) => s + x[1], 0); let v = r() * tot; for (const x of list) { v -= x[1]; if (v <= 0) return x[0]; } return list[0][0]; };
  const SKIN = ['#f3d2bd', '#e9bb9b', '#dba683', '#c48a62', '#a46c48', '#855334', '#663d25', '#472918'];
  const SKIN_W = { EU: [3, 4, 3, 1.5, 0.6, 0.4, 0.3, 0.2], NA: [2, 3, 2.5, 2, 1.2, 1, 0.8, 0.5], SAM: [0.8, 2, 3, 3, 2, 1.2, 0.6, 0.3], MENA: [0.3, 1.5, 3, 3.5, 2, 0.8, 0.3, 0.1], OCE: [2.5, 3, 2, 1.5, 1, 0.6, 0.4, 0.2], APAC: [1.5, 3.5, 3, 2, 1, 0.4, 0.1, 0], SSA: [0.4, 0.6, 0.8, 1, 1.5, 2.5, 3, 2.5] };
  const COUNTRY_REGION = { Nigeria: 'SSA', Kenya: 'SSA', Ghana: 'SSA', Zimbabwe: 'SSA', Botswana: 'SSA', Namibia: 'SSA', 'South Africa': 'SSA', Mauritius: 'SSA', Japan: 'APAC', 'South Korea': 'APAC', China: 'APAC', Taiwan: 'APAC', 'Hong Kong': 'APAC', Thailand: 'APAC', Vietnam: 'APAC', Philippines: 'APAC', Indonesia: 'APAC', Malaysia: 'APAC', Singapore: 'APAC', India: 'MENA' };
  const HAIR_C = [['#17120e', 6], ['#2e1f15', 5], ['#4d3220', 3], ['#714b2c', 2], ['#a87b48', 1.2], ['#d8b86e', 1], ['#8e3c1c', 0.5], ['#e6e1d8', 0.25], ['#2f5fd0', 0.15], ['#d24a8a', 0.12]];
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)))); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };

  function init() {
    if (ctx3 || failed) return ctx3;
    try {
      if (!T) throw new Error('no three');
      const canvas = document.createElement('canvas'); canvas.width = RW; canvas.height = RH;
      const renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false });
      renderer.setPixelRatio(1); renderer.setSize(RW, RH, false);
      const camera = new T.PerspectiveCamera(26, RW / RH, 0.1, 60);
      ctx3 = { canvas, renderer, camera };
    } catch (e) { failed = true; ctx3 = null; }
    return ctx3;
  }

  /* ---------- the painted face texture (256 x 128, sphere UVs: the front of the face is at x = 64) ---------- */
  function faceTexture(p) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = p.skin; g.fillRect(0, 0, 256, 128);
    // gentle painted shading: cheek hollows, under-brow, chin
    const sh = (x, y, rx, ry, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry)); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = a; g.fillStyle = gr; g.save(); g.translate(x, y); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y); g.beginPath(); g.arc(x, y, Math.max(rx, ry), 0, 7); g.fill(); g.restore(); g.globalAlpha = 1; };
    const F = 64, EY = 61, EX = 12.5;
    [-1, 1].forEach((s) => { sh(F + s * 22, 78, 9, 12, p.skinD, 0.35); sh(F + s * EX, EY - 2, 8, 5, p.skinD, 0.45); sh(F + s * 15, 76, 6, 4, p.blush, 0.25); });
    sh(F, 104, 10, 6, p.skinD, 0.3); sh(F, 44, 16, 8, p.skinL, 0.35);
    // hairline painted onto the scalp so it sits under the hair mesh
    if (p.scalp) { g.fillStyle = p.hair; g.globalAlpha = p.scalp; g.fillRect(0, 0, 256, p.hairline); g.globalAlpha = 1; for (let x = 0; x < 256; x += 2) { g.fillStyle = p.hair; g.globalAlpha = p.scalp * 0.6; g.fillRect(x, p.hairline, 2, (p.r() * 4) | 0); } g.globalAlpha = 1; }
    // stubble / beard
    if (p.beard !== 'none') {
      g.fillStyle = p.beardC; g.globalAlpha = p.beard === 'beard' ? 0.9 : p.beard === 'stubble' ? 0.28 : 0.85;
      g.beginPath();
      g.globalAlpha *= p.beard === 'beard' ? 0.72 : 1; g.filter = 'blur(0.6px)';
      if (p.beard === 'goatee') g.ellipse(F, 94, 5, 6, 0, 0, 7); else { g.moveTo(F - 27, 74); g.quadraticCurveTo(F - 26, 106, F, 112); g.quadraticCurveTo(F + 26, 106, F + 27, 74); g.lineTo(F + 22, 76); g.quadraticCurveTo(F + 16, 89, F + 8, 89); g.lineTo(F - 8, 89); g.quadraticCurveTo(F - 16, 89, F - 22, 76); g.closePath(); }
      g.fill();
      if (p.beard === 'beard') { g.globalAlpha = 0.35; g.fillStyle = shade(p.beardC, 0.3); for (let i = 0; i < 40; i++) g.fillRect(F - 26 + p.r() * 52, 92 + p.r() * 22, 1, 2); }
      if (p.beard !== 'stubble') { g.fillRect(F - 8, 80, 16, 2.4); }
      g.globalAlpha = 1; g.filter = 'none';
    }
    // brows
    g.fillStyle = p.brow;
    [-1, 1].forEach((s) => { g.save(); g.translate(F + s * EX, EY - 7 - p.browUp); g.rotate(s * p.browTilt); g.fillRect(-6, -1.2, 12, p.browT); g.restore(); });
    // eyes: white, iris, pupil, lid line, a 1px highlight
    [-1, 1].forEach((s) => {
      const x = F + s * EX;
      g.fillStyle = '#efe9e2'; g.beginPath(); g.ellipse(x, EY, 5, 2.4, 0, 0, 7); g.fill();
      g.fillStyle = p.iris; g.beginPath(); g.arc(x + p.look, EY, 2.2, 0, 7); g.fill();
      g.fillStyle = '#080808'; g.beginPath(); g.arc(x + p.look, EY, 1.1, 0, 7); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(x + p.look + 0.6, EY - 1.4, 1, 1);
      g.strokeStyle = '#1b130e'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(x, EY + 0.6, 5.4, 2.8, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      g.strokeStyle = p.skinD; g.lineWidth = 0.8; g.beginPath(); g.ellipse(x, EY - 0.6, 5.6, 3.8, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    });
    // nose shadow and nostrils (the nose itself is geometry)
    g.fillStyle = p.skinD; g.globalAlpha = 0.6; g.fillRect(F - 3, 75, 2, 1.4); g.fillRect(F + 1, 75, 2, 1.4); g.globalAlpha = 1;
    // mouth with an expression
    const mY = 84 - (p.beard === 'beard' ? 0 : 0);
    g.fillStyle = p.lip; g.beginPath(); g.ellipse(F, mY + 1.2, 7, 2.2, 0, 0, 7); g.fill();
    g.strokeStyle = shade(p.lip, -0.5); g.lineWidth = 1.2; g.beginPath();
    if (p.expr === 'smile') { g.moveTo(F - 7, mY - 1); g.quadraticCurveTo(F, mY + 3, F + 7, mY - 1); }
    else if (p.expr === 'grin') { g.fillStyle = '#efe9e2'; g.fillRect(F - 5, mY - 0.5, 10, 2); g.moveTo(F - 7, mY - 1.5); g.quadraticCurveTo(F, mY + 3.5, F + 7, mY - 1.5); }
    else if (p.expr === 'smirk') { g.moveTo(F - 7, mY + 0.5); g.quadraticCurveTo(F, mY + 1.5, F + 7, mY - 1.5); }
    else { g.moveTo(F - 7, mY); g.lineTo(F + 7, mY); }
    g.stroke();
    const tex = new T.CanvasTexture(c);
    tex.magFilter = T.LinearFilter; tex.minFilter = T.LinearFilter; tex.generateMipmaps = false;
    return tex;
  }

  /** Low-poly head: a coarse sphere pushed into a head shape. */
  function headGeometry(p) {
    const geo = new T.SphereGeometry(1, 12, 10);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      y *= 1.24;
      if (y < -0.15) { const t = Math.min(1, (-0.15 - y) / 1.0); x *= 1 - t * (1 - p.jaw); z *= 1 - t * 0.12; if (z > 0) z += t * 0.08 * p.chinOut; }
      if (y > -0.2 && y < 0.35 && z > 0) x *= p.cheek;
      if (z < 0) z *= 0.92; // flatter back of the head
      if (y > 0.25 && y < 0.55 && z > 0.6) z += 0.05; // brow ridge
      x *= p.width;
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function render(o) {
    const C3 = init();
    if (!C3) return null;
    const r = rng(String(o.seed));
    const rr = (a, b) => a + r() * (b - a);
    const region = COUNTRY_REGION[o.country] || o.region || 'EU';
    const skin = SKIN[pickW(r, (SKIN_W[region] || SKIN_W.EU).map((w, i) => [i, w]))];
    let hair = pickW(r, HAIR_C);
    if ((region === 'APAC' || region === 'SSA' || region === 'MENA') && r() < 0.75) hair = r() < 0.7 ? '#17120e' : '#2e1f15';
    const col = /^#[0-9a-f]{6}$/i.test(o.color || '') ? o.color : '#1f5bff';
    const age = o.age || 18;
    const style = pickW(r, [['crop', 3], ['fringe', 2.2], ['spiky', 1.6], ['quiff', 1.4], ['curly', 1.4], ['buzz', 1.6], ['long', 0.8], ['afro', region === 'SSA' ? 2.5 : 0.35], ['bun', 0.4], ['mohawk', 0.35], ['bald', 0.2], ['cap', 0.5]]);
    const beard = age >= 20 ? pickW(r, [['none', 3.5], ['stubble', 3], ['beard', 1.1], ['goatee', 0.8]]) : age >= 18 && r() < 0.25 ? 'stubble' : 'none';
    const P = {
      r, skin, skinD: shade(skin, -0.3), skinL: shade(skin, 0.2), blush: '#d06a5c', hair, brow: /^#(e6|d8|a8)/i.test(hair) ? '#6e4a2e' : shade(hair, -0.1),
      iris: pickW(r, [['#3b2414', 5], ['#5a3a1e', 3], ['#2f5f8a', 1.1], ['#4f7a4a', 0.8], ['#1c1c1c', 2]]), look: rr(-1, 1),
      browT: rr(2, 3.4), browUp: rr(0, 2), browTilt: rr(-0.18, 0.12), expr: pickW(r, [['neutral', 3], ['smile', 2.5], ['grin', 1], ['smirk', 1.2]]),
      lip: shade(skin, -0.25), beard, beardC: /^#(e6|2f|d2)/i.test(hair) ? '#2e1f15' : hair,
      scalp: style === 'buzz' ? 0.7 : style === 'bald' ? 0 : 1, hairline: style === 'buzz' ? 36 : 34,
      jaw: rr(0.62, 0.86), cheek: rr(0.98, 1.06), width: rr(0.86, 0.96), chinOut: rr(0, 1),
    };
    const { renderer, camera } = C3;
    const scene = new T.Scene();
    const bg = new T.Color(shade(col, -0.72));
    scene.background = bg;
    scene.fog = new T.Fog(bg, 9, 16);
    // backdrop: a low-res stadium gradient with a couple of blurry lights
    const bc = document.createElement('canvas'); bc.width = 32; bc.height = 40; const bx = bc.getContext('2d');
    const gr = bx.createRadialGradient(16 + rr(-6, 6), 12, 2, 16, 18, 30); gr.addColorStop(0, shade(col, -0.15)); gr.addColorStop(1, shade(col, -0.82)); bx.fillStyle = gr; bx.fillRect(0, 0, 32, 40);
    for (let i = 0; i < 6; i++) { bx.fillStyle = `rgba(255,255,255,${rr(0.05, 0.2).toFixed(2)})`; bx.fillRect((r() * 32) | 0, (r() * 22) | 0, 2, 2); }
    const bt = new T.CanvasTexture(bc); bt.magFilter = T.LinearFilter;
    const back = new T.Mesh(new T.PlaneGeometry(9, 11), new T.MeshBasicMaterial({ map: bt, fog: false }));
    back.position.set(0, 0.5, -4); scene.add(back);
    // lights: soft ambient, a key light from one side, a club-coloured rim from behind
    const L = r() < 0.5 ? -1 : 1;
    scene.add(new T.AmbientLight(0xffffff, 0.48));
    const key = new T.DirectionalLight(0xfff3e6, 0.85); key.position.set(L * 3, 2.5, 4); scene.add(key);
    const rim = new T.DirectionalLight(new T.Color(shade(col, 0.35)), 0.9); rim.position.set(-L * 3, 1.5, -3); scene.add(rim);
    const fill = new T.DirectionalLight(0x8aa0ff, 0.15); fill.position.set(-L * 2, -1, 3); scene.add(fill);
    const lam = (c, flat) => (flat ? new T.MeshPhongMaterial({ color: new T.Color(c), flatShading: true, shininess: 6, specular: 0x111111 }) : new T.MeshLambertMaterial({ color: new T.Color(c) }));
    // torso and shoulders (jersey)
    const torso = new T.Mesh(new T.CylinderGeometry(1.3, 1.95, 1.9, 8, 2), lam(col, true));
    { const tp = torso.geometry.attributes.position; for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); if (y > 0.5) tp.setY(i, y - Math.abs(tp.getX(i)) * 0.35); } torso.geometry.computeVertexNormals(); } // sloped shoulders
    torso.position.set(0, -2.45, -0.25); torso.scale.z = 0.55; scene.add(torso);
    const collar = new T.Mesh(new T.CylinderGeometry(0.46, 0.5, 0.18, 8), lam(shade(col, -0.45)));
    collar.position.set(0, -1.5, -0.02); collar.scale.z = 0.8; scene.add(collar);
    if (r() < 0.6) { const stripe = new T.Mesh(new T.BoxGeometry(0.14, 1.2, 0.02), lam(shade(col, 0.45))); stripe.position.set(L * 0.7, -2.2, 0.5); stripe.rotation.z = L * 0.35; scene.add(stripe); }
    const neck = new T.Mesh(new T.CylinderGeometry(0.47, 0.55, 0.7, 8), lam(shade(skin, -0.15)));
    neck.position.set(0, -1.18, -0.05); scene.add(neck);
    // head group (pose)
    const head = new T.Group();
    head.position.set(0, 0, 0);
    head.rotation.set(rr(-0.08, 0.1), rr(-0.38, 0.38), rr(-0.08, 0.08));
    scene.add(head);
    const faceTex = faceTexture(P);
    const skull = new T.Mesh(headGeometry(P), new T.MeshLambertMaterial({ map: faceTex }));
    head.add(skull);
    // nose: a small low-poly wedge
    const nose = new T.Mesh(new T.SphereGeometry(0.17, 5, 4), lam(shade(skin, 0.04), true));
    nose.position.set(0, -0.1, 0.93); nose.scale.set(rr(0.75, 1.05), 1.35, rr(0.95, 1.3)); head.add(nose);
    // ears
    [-1, 1].forEach((s) => { const ear = new T.Mesh(new T.SphereGeometry(0.2, 5, 4), lam(shade(skin, -0.08), true)); ear.scale.set(0.45, 1, 0.75); ear.position.set(s * P.width * 0.98, 0.0, -0.05); head.add(ear); });
    // hair
    const hm = lam(hair, true);
    const capGeo = (rad, thetaLen) => new T.SphereGeometry(rad, 10, 6, 0, Math.PI * 2, 0, thetaLen);
    const addCap = (rad, thetaLen, tiltX) => { const m = new T.Mesh(capGeo(rad, thetaLen), hm); m.scale.set(P.width * 1.03, 1.26, 1.02); m.position.set(0, 0.02, -0.02); m.rotation.x = tiltX; head.add(m); return m; };
    if (['crop', 'quiff', 'spiky', 'long', 'bun', 'mohawk', 'curly', 'fringe'].includes(style)) {
      addCap(1.06, 1.05, -0.32); // front hairline
      addCap(1.07, 1.5, -0.95); // sides and back down to the ears
      if (style === 'fringe') addCap(1.075, 1.0, 0.18); // hair falling onto the forehead
    }
    if (style === 'quiff') { const q = new T.Mesh(new T.SphereGeometry(0.42, 6, 4), hm); q.scale.set(1.5, 0.8, 1.1); q.position.set(0.1, 1.28, 0.5); q.rotation.z = -0.2; head.add(q); }
    if (style === 'spiky') for (let i = 0; i < 9; i++) { const sp = new T.Mesh(new T.ConeGeometry(0.16, 0.5, 4), hm); const a = (i / 8) * Math.PI - Math.PI / 2; sp.position.set(Math.sin(a) * 0.62, 1.3 - Math.abs(Math.sin(a)) * 0.25, 0.1 + Math.cos(a) * 0.35); sp.rotation.set(rr(-0.4, 0.2), 0, -Math.sin(a) * 0.6); head.add(sp); }
    if (style === 'mohawk') { const mo = new T.Mesh(new T.BoxGeometry(0.22, 0.55, 1.6), hm); mo.position.set(0, 1.3, -0.1); head.add(mo); }
    if (style === 'long') { const lg = new T.Mesh(new T.CylinderGeometry(1.06, 1.14, 1.6, 12, 1, true, Math.PI * 0.3, Math.PI * 1.4), new T.MeshPhongMaterial({ color: new T.Color(hair), flatShading: true, shininess: 6, side: T.DoubleSide })); lg.position.set(0, -0.35, -0.08); lg.scale.x = P.width * 1.02; head.add(lg); }
    if (style === 'bun') { const bn = new T.Mesh(new T.SphereGeometry(0.32, 6, 5), hm); bn.position.set(0, 1.25, -0.6); head.add(bn); }
    if (style === 'curly') for (let i = 0; i < 16; i++) { const cu = new T.Mesh(new T.IcosahedronGeometry(0.2, 0), hm); const a = r() * Math.PI * 2, b = rr(0.1, 1.0); cu.position.set(Math.cos(a) * Math.sin(b) * 1.0 * P.width, 0.35 + Math.cos(b) * 1.05, Math.sin(a) * Math.sin(b) * 0.95 - 0.05); head.add(cu); }
    if (style === 'afro') { const af = new T.Mesh(new T.IcosahedronGeometry(1.42, 1), hm); af.scale.set(1.05, 0.95, 1); af.position.set(0, 0.62, -0.25); head.add(af); }
    if (style === 'cap') { const cm = lam(col, true); const cp = new T.Mesh(capGeo(1.1, 1.2), cm); cp.scale.set(P.width * 1.03, 1.12, 1.02); cp.position.set(0, 0.15, -0.04); cp.rotation.x = -0.3; head.add(cp); const brim = new T.Mesh(new T.CylinderGeometry(0.85, 0.85, 0.06, 10, 1, false, -Math.PI / 2 - 0.9, 1.8), lam(shade(col, -0.25), true)); brim.position.set(0, 0.72, 0.62); brim.rotation.x = 0.18; head.add(brim); }
    // glasses
    if (r() < 0.13) { const gm = lam(r() < 0.6 ? '#141414' : shade(col, -0.2)); [-1, 1].forEach((s) => { const ring = new T.Mesh(new T.TorusGeometry(0.17, 0.03, 3, 8), gm); ring.position.set(s * 0.33 * P.width, 0.13, 0.95); ring.scale.y = 0.75; head.add(ring); }); const br = new T.Mesh(new T.BoxGeometry(0.3, 0.04, 0.04), gm); br.position.set(0, 0.16, 0.99); br.scale.x = 0.7; head.add(br); }
    // gaming headset
    if (r() < 0.6 && style !== 'cap') {
      const hcol = r() < 0.5 ? '#16181d' : shade(col, -0.55), acc = r() < 0.5 ? col : '#3c414c';
      const band = new T.Mesh(new T.TorusGeometry(1.2, 0.07, 4, 14, Math.PI), lam(hcol, true));
      band.scale.set(P.width * 1.02, 1.15, 1); band.position.set(0, 0.05, -0.05); head.add(band);
      [-1, 1].forEach((s) => { const cup = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.22, 8), lam(hcol, true)); cup.rotation.z = Math.PI / 2; cup.position.set(s * (P.width * 1.04 + 0.08), 0.02, -0.02); head.add(cup); const pad = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.04, 8), lam(acc)); pad.rotation.z = Math.PI / 2; pad.position.set(s * (P.width * 1.04 + 0.2), 0.02, -0.02); head.add(pad); });
      if (r() < 0.7) { const s = r() < 0.5 ? -1 : 1; const a = new T.Vector3(s * (P.width + 0.12), -0.12, 0.05), b = new T.Vector3(s * 0.3, -0.62, 0.92); const d = b.clone().sub(a); const boom = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, d.length(), 4), lam(hcol)); boom.position.copy(a.clone().add(b).multiplyScalar(0.5)); boom.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); head.add(boom); const mic = new T.Mesh(new T.SphereGeometry(0.075, 5, 4), lam(hcol)); mic.position.copy(b); head.add(mic); }
    }
    // camera: a slight angle, framing head and shoulders
    camera.position.set(rr(-0.4, 0.4), 0.35, 10.2); camera.lookAt(0, -0.38, 0);
    renderer.render(scene, camera);
    const url = C3.canvas.toDataURL('image/jpeg', 0.86);
    // clean up GPU resources
    scene.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } });
    return url;
  }

  global.RLFaces3D = { render, available: () => !!init() };
})(window);
