/* Stylised 3D layer for the broadcast opener (js/opener.js).
 * One three.js renderer whose canvas moves into the active shot's `.op-gl` slot, so 2D graphics
 * (patterns, type, tickers, captions) sit around real-time 3D models: an extruded city emblem,
 * a turning trophy, a car hitting the ball, a globe flying to the host city and a full arena.
 * Every city gets one of three render looks: cel-shaded with ink outlines, chrome or soft clay.
 * When WebGL is missing, create() returns null and the 2D versions of those shots play instead. */
(function (global) {
  'use strict';

  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const eo3 = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const eob = (x) => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }

  /* Emblem outlines in the SVG emblem's coordinates (viewBox -110..110, y down; radius ~96). */
  function outlinePts(kind) {
    const P = [];
    const poly = (n, rf, off) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + off; const r = rf(i); P.push([r * Math.cos(a), r * Math.sin(a)]); } };
    if (kind === 'circle') poly(72, () => 92, 0);
    else if (kind === 'hex') poly(6, () => 94, -Math.PI / 2);
    else if (kind === 'diamond') poly(4, () => 98, -Math.PI / 2);
    else if (kind === 'star') poly(16, (i) => (i % 2 ? 76 : 96), -Math.PI / 2);
    else {
      const q = (p0, c, p1) => { for (let k = 1; k <= 12; k++) { const t = k / 12, u = 1 - t; P.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]); } };
      P.push([0, -92], [78, -62], [70, 30]); q([70, 30], [58, 72], [0, 96]); q([0, 96], [-58, 72], [-70, 30]); P.push([-78, -62]);
    }
    return P;
  }

  function create(spec, S) {
    const THREE = global.THREE; if (!THREE) return null;
    const canvas = document.createElement('canvas'); canvas.className = 'op-glc';
    let ctx = null, renderer;
    try { ctx = canvas.getContext('webgl2', { alpha: true, antialias: true }) || canvas.getContext('webgl', { alpha: true, antialias: true }); } catch (e) { ctx = null; }
    if (!ctx) return null;
    try { renderer = new THREE.WebGLRenderer({ canvas, context: ctx, antialias: true, alpha: true }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const pal = spec.pal, beat = spec.beat || 0.5, look = spec.look || 'toon';
    const col = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    const mix = (h1, h2, k) => col(h1).lerp(col(h2), k);
    const trash = [];
    const keep = (x) => (trash.push(x), x);
    const font = (getComputedStyle(document.documentElement).getPropertyValue('--display') || '').trim() || 'sans-serif';

    /* ----- environment for chrome / clay: a soft studio with palette-coloured softboxes ----- */
    let env = null;
    if (look !== 'toon') {
      const es = new THREE.Scene();
      const g = keep(new THREE.SphereGeometry(10, 32, 16)), cs = [];
      const top = col('#ffffff'), mid = mix(pal.b, pal.a, 0.45).lerp(col('#8890a0'), 0.35), bot = col('#1a1d26');
      for (let i = 0; i < g.attributes.position.count; i++) { const y = g.attributes.position.getY(i) / 10; const c = y > 0 ? mid.clone().lerp(top, y * 0.6) : mid.clone().lerp(bot, -y); cs.push(c.r, c.g, c.b); }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
      es.add(new THREE.Mesh(g, keep(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }))));
      [[6, 4, 2, '#ffffff', 5], [-6, 2, -3, pal.c, 3], [0, -2, 7, pal.a, 2], [-3, 6, 5, '#ffffff', 3]].forEach(([x, y, z, c, s]) => {
        const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(s, s * 0.6)), keep(new THREE.MeshBasicMaterial({ color: col(c).multiplyScalar(3), side: THREE.DoubleSide })));
        m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m);
      });
      const pm = new THREE.PMREMGenerator(renderer);
      env = keep(pm.fromScene(es, 0.03).texture); pm.dispose();
    }

    /* ----- materials ----- */
    const grad = keep(new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 165, 165, 165, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat));
    grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
    function mat(c, kind) {
      c = typeof c === 'string' ? col(c) : c;
      let m;
      if (kind === 'emit') m = new THREE.MeshBasicMaterial({ color: c });
      else if (look === 'toon') m = new THREE.MeshToonMaterial({ color: c, gradientMap: grad });
      else if (look === 'chrome') m = new THREE.MeshStandardMaterial({ color: c, metalness: kind === 'metal' ? 1 : 0.3, roughness: kind === 'metal' ? 0.14 : 0.22, envMap: env, envMapIntensity: 1.35 });
      else m = new THREE.MeshStandardMaterial({ color: c, metalness: kind === 'metal' ? 0.55 : 0, roughness: kind === 'metal' ? 0.38 : 0.85, envMap: env, envMapIntensity: 0.9 });
      if (kind === 'flat') m.flatShading = true;
      return keep(m);
    }
    /* ink outlines (cel look only): an inverted hull pushed out along smoothed normals */
    const inkCache = {};
    function inkMat(w) {
      if (inkCache[w]) return inkCache[w];
      const m = keep(new THREE.MeshBasicMaterial({ color: 0x07090f, side: THREE.BackSide }));
      m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normal * ' + w.toFixed(4) + ';'); };
      return (inkCache[w] = m);
    }
    function smooth(geo) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.computeVertexNormals();
      const p = g.attributes.position, n = g.attributes.normal, acc = {};
      const key = (i) => Math.round(p.getX(i) * 1000) + ',' + Math.round(p.getY(i) * 1000) + ',' + Math.round(p.getZ(i) * 1000);
      for (let i = 0; i < p.count; i++) { const k = key(i), a = acc[k] || (acc[k] = [0, 0, 0]); a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); }
      for (let i = 0; i < p.count; i++) { const a = acc[key(i)], l = Math.hypot(a[0], a[1], a[2]) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
      return keep(g);
    }
    function mesh(geo, m, w) {
      keep(geo);
      const o = new THREE.Mesh(geo, m);
      if (look === 'toon' && w) o.add(new THREE.Mesh(smooth(geo), inkMat(w)));
      return o;
    }
    let lastStage = null;
    function stage(fog) {
      const s = (lastStage = new THREE.Scene());
      s.add(new THREE.HemisphereLight(0xffffff, col(pal.b), look === 'toon' ? 0.5 : 0.45));
      const k = new THREE.DirectionalLight(0xffffff, look === 'toon' ? 1.05 : 1.6); k.position.set(3, 5, 4); s.add(k);
      const rim = new THREE.DirectionalLight(col(pal.c), look === 'toon' ? 0.6 : 2.2); rim.position.set(-4, 2, -5); s.add(rim);
      const fill = new THREE.DirectionalLight(col(pal.a), 0.5); fill.position.set(-5, -1, 3); s.add(fill);
      if (fog) s.fog = new THREE.Fog(col(pal.b), fog[0], fog[1]);
      return s;
    }
    function canvasTex(w, h, draw) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = keep(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
      return t;
    }
    function shape(pts, s, hole) {
      const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * s, -y * s)));
      if (hole) sh.holes.push(new THREE.Path(pts.map(([x, y]) => new THREE.Vector2(x * hole, -y * hole))));
      return sh;
    }
    function extrude(sh, depth, bevel) {
      const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: 3, curveSegments: 8 });
      g.translate(0, 0, -depth / 2);
      return g;
    }
    /* the emblem artwork (crown, code, season) drawn flat, used on the 3D emblem and the arena screen */
    function emblemArt(withShape) {
      return canvasTex(512, 512, (x, w) => {
        x.scale(w / 220, w / 220); x.translate(110, 110);
        if (withShape) {
          const pts = outlinePts(spec.shape);
          x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath();
          x.fillStyle = '#05070c'; x.fill(); x.lineWidth = 7; x.strokeStyle = pal.a; x.stroke();
        }
        x.lineCap = x.lineJoin = 'round'; x.lineWidth = 5; x.strokeStyle = pal.c;
        x.beginPath(); [[-58, -44], [-30, -56], [-4, -46], [22, -58], [58, -44]].forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke();
        const code = spec.code || 'RL', fs = code.length > 3 ? 40 : code.length === 3 ? 52 : 62;
        x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = `900 ${fs}px ${font}`; x.fillText(code, 0, fs * 0.36 + 4);
        x.fillStyle = pal.c; x.font = `800 11px ${font}`; x.fillText(String(spec.sub || 'RLCS').toUpperCase().split('').join(String.fromCharCode(8202)), 0, 46);
      });
    }
    const pulse = (t) => Math.exp(-((t % beat) / beat) * 5);

    const cam = new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 200);
    const SC = {};

    /* ===== 1. the city emblem, extruded, spinning in over the 2D pattern ===== */
    SC.pat = () => {
      const s = stage(), r = seeded(spec.city + '|3d-emb'), pts = outlinePts(spec.shape), k = 1 / 96;
      const emb = new THREE.Group(); s.add(emb);
      emb.add(mesh(extrude(shape(pts, k), 0.18, 0.04), mat(mix(pal.b, '#000000', 0.35)), 0.02));
      emb.add(mesh(extrude(shape(pts, k * 1.08, k * 0.93), 0.34, 0.03), mat(pal.a, 'metal'), 0.02));
      emb.add(mesh(extrude(shape(pts, k * 0.86, k * 0.81), 0.26, 0.01), mat(pal.c, 'metal')));
      const face = new THREE.Mesh(keep(new THREE.PlaneGeometry(220 / 96, 220 / 96)), keep(new THREE.MeshBasicMaterial({ map: emblemArt(false), transparent: true, toneMapped: false })));
      face.position.z = 0.16; emb.add(face);
      const halo = mesh(new THREE.TorusGeometry(1.55, 0.018, 8, 120), mat(pal.c, 'emit')); halo.rotation.x = 1.25; s.add(halo);
      const halo2 = mesh(new THREE.TorusGeometry(1.85, 0.01, 8, 120), mat(pal.a, 'emit')); halo2.rotation.set(1.1, 0.4, 0); s.add(halo2);
      const geos = [new THREE.TetrahedronGeometry(0.13), new THREE.OctahedronGeometry(0.11), new THREE.BoxGeometry(0.16, 0.16, 0.16)].map(keep);
      const mats = [mat(pal.a, 'flat'), mat(pal.c, 'flat'), mat('#ffffff', 'flat')];
      const bits = Array.from({ length: 26 }, (_, i) => {
        const m = mesh(geos[i % 3], mats[i % 3], 0.02);
        const d = { m, a: r() * Math.PI * 2, rad: 2.1 + r() * 1.4, y: (r() - 0.5) * 2.4, sp: (0.25 + r() * 0.35) * (r() < 0.5 ? -1 : 1), z: -0.4 - r() * 1.2 };
        s.add(m); return d;
      });
      return (t, d) => {
        const p = clamp((t - 0.12) / 0.6);
        emb.position.set(0, 0.12, -14 * (1 - eo3(p)));
        emb.rotation.set(Math.sin(t * 0.8) * 0.1, -Math.PI * 3 * (1 - eo3(p)) + Math.sin(t * 0.9) * 0.3, 0);
        emb.scale.setScalar(1 + 0.05 * pulse(t) * p);
        halo.rotation.z = t * 0.6; halo2.rotation.z = -t * 0.4;
        halo.scale.setScalar(eob((t - 0.3) / 0.5) || 0.001); halo2.scale.setScalar(eob((t - 0.4) / 0.5) || 0.001);
        const burst = eo3((t - 0.35) / 0.7);
        bits.forEach((b) => { const a = b.a + t * b.sp, rr = b.rad * (0.6 + 0.4 * burst); b.m.position.set(Math.cos(a) * rr * 1.25, Math.sin(a) * rr * 0.62 + b.y * 0.25, b.z); b.m.rotation.set(t * 1.7 + b.a, t * 1.3, 0); b.m.scale.setScalar(Math.max(0.001, burst)); });
        cam.position.set(Math.sin(t * 0.3) * 0.4, -0.1, 7.4 - t * 0.25); cam.lookAt(0, -0.2, 0);
      };
    };

    /* ===== 2. the trophy on a turntable, under falling confetti ===== */
    SC.trophy = () => {
      const s = stage(), r = seeded(spec.city + '|3d-cup');
      const gold = mix('#f2c14e', pal.c, 0.3), cup = new THREE.Group(); s.add(cup);
      const prof = [[0, 0], [0.62, 0], [0.64, 0.06], [0.6, 0.14], [0.48, 0.18], [0.4, 0.34], [0.2, 0.42], [0.13, 0.55], [0.11, 0.82], [0.22, 0.9], [0.24, 0.96], [0.12, 1.04], [0.16, 1.14], [0.42, 1.3], [0.6, 1.55], [0.7, 1.85], [0.76, 2.06], [0.8, 2.1], [0.74, 2.1], [0.66, 1.9], [0.5, 1.5], [0, 1.36]].map(([x, y]) => new THREE.Vector2(x, y));
      const bowl = mesh(new THREE.LatheGeometry(prof, 64), mat(gold, 'metal'), 0.025); bowl.material.side = THREE.DoubleSide; cup.add(bowl);
      [-1, 1].forEach((sd) => { const cv = new THREE.CatmullRomCurve3([[0.46, 1.32], [0.86, 1.3], [1.08, 1.62], [0.98, 1.92], [0.72, 1.96]].map(([x, y]) => new THREE.Vector3(sd * x, y, 0))); cup.add(mesh(new THREE.TubeGeometry(cv, 40, 0.055, 10, false), mat(gold, 'metal'), 0.02)); });
      const star = mesh(extrude(shape(outlinePts('star'), 1 / 560), 0.06, 0.01), mat(pal.a, 'metal'), 0.01); star.position.set(0, 1.66, 0.6); star.rotation.x = -0.28; cup.add(star);
      const base = mesh(new THREE.CylinderGeometry(0.78, 0.9, 0.55, 8), mat(mix(pal.b, '#000000', 0.4)), 0.02); base.position.y = -0.28; cup.add(base);
      const band = mesh(new THREE.CylinderGeometry(0.8, 0.84, 0.1, 8), mat(pal.a, 'metal')); band.position.y = -0.2; cup.add(band);
      const shadow = new THREE.Mesh(keep(new THREE.CircleGeometry(2.4, 48)), keep(new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,.65)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }), transparent: true, depthWrite: false })));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.55; s.add(shadow);
      const N = 240, conf = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(0.07, 0.12)), keep(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false })), N);
      const cc = [col(pal.a), col(pal.c), col('#ffffff'), gold];
      const P = Array.from({ length: N }, (_, i) => { conf.setColorAt(i, cc[i % 4]); return { x: (r() - 0.5) * 7, z: (r() - 0.5) * 4, y0: 3.5 + r() * 3, v: 0.9 + r() * 0.9, ph: r() * 6.28, sp: 2 + r() * 5 }; });
      s.add(conf);
      const o = new THREE.Object3D();
      return (t, d) => {
        const rise = eo3(t / 0.7);
        cup.position.y = -3.2 * (1 - rise) - 0.35; cup.rotation.y = t * 0.9 - 1.4 * (1 - rise);
        shadow.material.opacity = rise;
        star.scale.setScalar(1 + 0.15 * pulse(t));
        const ct = Math.max(0, t - 0.4);
        P.forEach((p, i) => { o.position.set(p.x + Math.sin(ct * 2 + p.ph) * 0.25, p.y0 - ct * p.v * 1.6 - (t < 0.4 ? 9 : 0), p.z); o.rotation.set(ct * p.sp, ct * p.sp * 0.7, p.ph); o.updateMatrix(); conf.setMatrixAt(i, o.matrix); });
        conf.instanceMatrix.needsUpdate = true;
        const k = eio(t / d);
        cam.position.set(Math.sin(k * 0.6) * 1.4, 0.9 + k * 0.8, 8.6 - k * 1.1); cam.lookAt(0, 0.55 + k * 0.1, 0);
      };
    };

    /* ===== 3. kickoff: the car boosts in and smashes the ball ===== */
    SC.car = () => {
      const s = stage([8, 24]), r = seeded(spec.city + '|3d-car');
      const P = (pts) => pts.map(([x, y]) => [(x - 120) / 100, (y - 70) / 100]);
      const car = new THREE.Group(); s.add(car);
      const body = new THREE.Group(); car.add(body);
      body.add(mesh(extrude(shape(P([[6, 64], [10, 48], [44, 44], [86, 40], [120, 22], [172, 20], [204, 40], [232, 46], [237, 58], [231, 67]]), 1), 0.86, 0.04), mat(pal.a), 0.018));
      body.add(mesh(extrude(shape(P([[126, 27], [168, 25], [192, 40], [114, 41]]), 1), 0.9, 0.01), mat('#0a0e18')));
      body.add(mesh(extrude(shape(P([[12, 50], [4, 32], [26, 32], [32, 46]]), 1), 0.8, 0.02), mat(pal.c), 0.015));
      const stripe = mesh(new THREE.BoxGeometry(2.16, 0.045, 0.95), mat(pal.c)); stripe.position.set(0.02, 0.13, 0); body.add(stripe);
      const wheels = [];
      [[58, 0.42], [58, -0.42], [190, 0.42], [190, -0.42]].forEach(([px, z]) => {
        const w = new THREE.Group(); w.position.set((px - 120) / 100, -0.02, z);
        const tyre = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.17, 20), mat('#111319'), 0.015); tyre.rotation.x = Math.PI / 2; w.add(tyre);
        const rim = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.18, 6), mat(pal.c, 'metal')); rim.rotation.x = Math.PI / 2; w.add(rim);
        car.add(w); wheels.push(w);
      });
      const NB = 70, boost = new THREE.InstancedMesh(keep(new THREE.IcosahedronGeometry(0.11, 0)), keep(new THREE.MeshBasicMaterial({ color: mix(pal.c, '#ffffff', 0.35), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })), NB);
      s.add(boost);
      const ball = mesh(new THREE.IcosahedronGeometry(0.5, 1), mat('#dfe4ee', 'flat'), 0.03); s.add(ball);
      const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(0.6, 0.05, 8, 48)), keep(new THREE.MeshBasicMaterial({ color: col(pal.c), transparent: true, toneMapped: false }))); s.add(ring);
      const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(80, 30)), keep(new THREE.MeshBasicMaterial({ color: mix(pal.b, '#000000', 0.3) }))); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.21; s.add(floor);
      const grid = new THREE.GridHelper(80, 80, col(pal.c), col(pal.a)); grid.position.y = -0.2; grid.material.transparent = true; grid.material.opacity = 0.45; keep(grid.geometry); keep(grid.material); s.add(grid);
      const lines = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(1, 0.012, 0.012)), keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, toneMapped: false })), 30);
      const L = Array.from({ length: 30 }, () => ({ y: r() * 2.2, z: -3 + r() * 4, len: 1 + r() * 3, off: r() * 20 })); s.add(lines);
      const o = new THREE.Object3D(), hitX = 2.4;
      return (t, d) => {
        const hitT = d * 0.45, v = 7.5;
        const cx = t < hitT ? hitX - 1.75 - v * (hitT - t) : hitX - 1.75 + 3.2 * (1 - Math.exp(-(t - hitT) * 1.6));
        car.position.set(cx, 0.19, 0);
        const after = Math.max(0, t - hitT);
        body.rotation.z = t < hitT ? 0.04 : 0.12 * Math.exp(-after * 3) * Math.sin(after * 12);
        wheels.forEach((w) => { w.rotation.z = -t * 22; });
        if (t < hitT) { ball.position.set(hitX, 0.36 + Math.abs(Math.sin(t * 5)) * 0.08, 0); ball.rotation.set(0, t, 0); }
        else { ball.position.set(hitX + after * 7, 0.36 + after * 5.5 - after * after * 3, after * 3.5); ball.rotation.set(after * 9, after * 6, 0); }
        ring.position.set(hitX - 0.35, 0.4, 0);
        const rk = clamp(after / 0.5); ring.scale.setScalar(0.3 + rk * 3); ring.material.opacity = t < hitT ? 0 : 1 - rk;
        for (let i = 0; i < NB; i++) {
          const age = ((t * 9 + i / NB * 2.2) % 2.2) / 2.2;
          o.position.set(cx - 1.2 - age * 2.4, 0.34 + Math.sin(i * 7.3) * 0.08 * age, Math.cos(i * 3.1) * 0.12 * age);
          o.scale.setScalar(Math.max(0.001, (1 - age) * (0.6 + (i % 3) * 0.3)) * (t < hitT + 0.6 ? 1 : 0.4)); o.updateMatrix(); boost.setMatrixAt(i, o.matrix);
        }
        boost.instanceMatrix.needsUpdate = true;
        L.forEach((l, i) => { o.position.set(cx - ((t * 14 + l.off) % 20) + 8, l.y, l.z); o.scale.set(l.len, 1, 1); o.rotation.set(0, 0, 0); o.updateMatrix(); lines.setMatrixAt(i, o.matrix); });
        lines.instanceMatrix.needsUpdate = true;
        const shake = t > hitT && after < 0.35 ? (0.35 - after) * 0.25 : 0;
        const tx = hitX - 1.6 + eio(t / d) * 1.4; // a low three-quarter front angle that drifts with the play
        cam.position.set(tx + 2.6 + (r() - 0.5) * shake, 0.75 + (r() - 0.5) * shake, 4.3); cam.lookAt(tx, 0.45, 0);
        ring.lookAt(cam.position);
      };
    };

    /* ===== 4. the globe: arcs from around the world converge on the host city ===== */
    SC.map = () => {
      if (spec.lat == null) return null;
      const s = stage(), R = 1, rad = Math.PI / 180;
      const vec = (lat, lon, h) => new THREE.Vector3(Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad), Math.cos(lat * rad) * Math.cos(lon * rad)).multiplyScalar(R * (h || 1));
      const globe = new THREE.Group(); globe.rotation.order = 'XYZ'; s.add(globe);
      globe.add(mesh(new THREE.SphereGeometry(R, 64, 48), mat(mix(pal.b, pal.a, 0.22)), 0.012));
      const gl = [];
      for (let la = -75; la <= 75; la += 15) for (let lo = 0; lo < 360; lo += 4) { const a = vec(la, lo, 1.004), b = vec(la, lo + 4, 1.004); gl.push(a.x, a.y, a.z, b.x, b.y, b.z); }
      for (let lo = 0; lo < 360; lo += 15) for (let la = -88; la < 88; la += 4) { const a = vec(la, lo, 1.004), b = vec(la + 4, lo, 1.004); gl.push(a.x, a.y, a.z, b.x, b.y, b.z); }
      const lg = keep(new THREE.BufferGeometry()); lg.setAttribute('position', new THREE.Float32BufferAttribute(gl, 3));
      globe.add(new THREE.LineSegments(lg, keep(new THREE.LineBasicMaterial({ color: col(pal.a), transparent: true, opacity: 0.35 }))));
      const dots = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(0.012, 6, 4)), keep(new THREE.MeshBasicMaterial({ color: col(pal.c), toneMapped: false })), spec.cities.length);
      const o = new THREE.Object3D();
      spec.cities.forEach(([la, lo], i) => { o.position.copy(vec(la, lo, 1.006)); o.updateMatrix(); dots.setMatrixAt(i, o.matrix); }); globe.add(dots);
      const host = vec(spec.lat, spec.lon, 1);
      const arcs = spec.others.map(([la, lo], k) => {
        const a = vec(la, lo, 1.005), m = a.clone().add(host).normalize().multiplyScalar(1 + 0.25 + a.distanceTo(host) * 0.22);
        const g = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, host.clone().multiplyScalar(1.005)), 48, 0.007, 6, false);
        const t = mesh(g, keep(new THREE.MeshBasicMaterial({ color: col(k % 2 ? pal.c : '#ffffff'), toneMapped: false }))); t.geometry.setDrawRange(0, 0); globe.add(t);
        return { t, n: g.index.count, k };
      });
      const pin = new THREE.Group(); pin.position.copy(host); pin.lookAt(host.clone().multiplyScalar(2)); globe.add(pin);
      const stem = mesh(new THREE.ConeGeometry(0.035, 0.16, 12), mat(pal.a), 0.006); stem.rotation.x = -Math.PI / 2; stem.position.z = 0.08; pin.add(stem);
      const head = mesh(new THREE.SphereGeometry(0.045, 16, 12), mat(pal.a), 0.006); head.position.z = 0.17; pin.add(head);
      const ping = new THREE.Mesh(keep(new THREE.RingGeometry(0.05, 0.065, 40)), keep(new THREE.MeshBasicMaterial({ color: col(pal.c), transparent: true, side: THREE.DoubleSide, toneMapped: false }))); ping.position.z = 0.004; pin.add(ping);
      const atm = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: canvasTex(256, 256, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, w * 0.33, w / 2, w / 2, w / 2); g.addColorStop(0, pal.a); g.addColorStop(0.25, pal.a + '66'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
      atm.scale.setScalar(R * 3); s.add(atm);
      return (t, d) => {
        const k = eio(t / (d * 0.85));
        globe.rotation.set(spec.lat * rad * (0.2 + 0.8 * k), -spec.lon * rad + 2.4 * (1 - k), 0);
        arcs.forEach((a) => { const p = eo3((t - 0.2 - a.k * 0.12) / 0.8); a.t.geometry.setDrawRange(0, Math.round(p * 48) * 36); });
        const pk = (t - d * 0.72) / 0.5; pin.scale.setScalar(Math.max(0.001, eob(pk)));
        const pp = (t % beat) / beat; ping.scale.setScalar(1 + pp * 3); ping.material.opacity = 1 - pp;
        const z = 6.2 - k * 1.7;
        cam.position.set(0, 0.05 * (1 - k), z); cam.lookAt(0, 0, 0);
        atm.material.opacity = 1 - k * 0.5;
      };
    };

    /* ===== 5. the arena: a full bowl, a hanging screen and sweeping lights ===== */
    SC.arena = () => {
      const s = stage([14, 34]), r = seeded(spec.city + '|3d-arena');
      const pitch = new THREE.Mesh(keep(new THREE.PlaneGeometry(8, 5.4)), keep(new THREE.MeshBasicMaterial({ map: canvasTex(1024, 692, (x, w, h) => {
        x.fillStyle = '#0b1220'; x.fillRect(0, 0, w, h);
        x.globalAlpha = 0.35; x.fillStyle = pal.a; x.fillRect(0, 0, w / 2, h); x.fillStyle = pal.c; x.fillRect(w / 2, 0, w / 2, h); x.globalAlpha = 1;
        x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 6; x.strokeRect(20, 20, w - 40, h - 40);
        x.beginPath(); x.moveTo(w / 2, 20); x.lineTo(w / 2, h - 20); x.stroke(); x.beginPath(); x.arc(w / 2, h / 2, 90, 0, Math.PI * 2); x.stroke();
        x.strokeRect(20, h / 2 - 130, 110, 260); x.strokeRect(w - 130, h / 2 - 130, 110, 260);
        x.fillStyle = '#ffd34d'; [[200, 120], [200, h - 120], [w - 200, 120], [w - 200, h - 120], [w / 2, 70], [w / 2, h - 70]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 16, 0, Math.PI * 2); x.fill(); });
      }) })));
      pitch.rotation.x = -Math.PI / 2; s.add(pitch);
      [[-4.25, pal.a], [4.25, pal.c]].forEach(([gx, c]) => {
        const m = mat(c, 'emit'), g = new THREE.Group(); g.position.x = gx;
        [[0, 0.45, 0.8], [0, 0.45, -0.8]].forEach(([x, y, z]) => { const p = mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), m); p.position.set(x, y, z); g.add(p); });
        const bar = mesh(new THREE.BoxGeometry(0.06, 0.06, 1.66), m); bar.position.y = 0.9; g.add(bar); s.add(g);
      });
      const wallM = mat(mix(pal.b, '#000000', 0.3));
      [[0, 2.75, 8.2, 0.05], [0, -2.75, 8.2, 0.05], [4.1, 0, 0.05, 5.5], [-4.1, 0, 0.05, 5.5]].forEach(([x, z, w, dp]) => { const m = mesh(new THREE.BoxGeometry(w, 0.28, dp), wallM); m.position.set(x, 0.14, z); s.add(m); });
      const tier = mesh(new THREE.LatheGeometry([[5.4, 0], [5.5, 0.25], [9.9, 3.2], [10.4, 3.4], [10.4, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 72), mat(mix(pal.b, '#000000', 0.45)));
      tier.scale.z = 0.78; tier.material.side = THREE.DoubleSide; s.add(tier);
      const seats = [];
      for (let row = 0; row < 13; row++) { const R = 5.75 + row * 0.33, n = Math.round((2 * Math.PI * R * 0.9) / 0.2); for (let i = 0; i < n; i++) seats.push([R, (i / n) * Math.PI * 2 + row * 0.07, 0.38 + row * 0.215, row]); }
      const crowd = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(0.12, 0.17, 0.12)), mat('#ffffff'), seats.length);
      const ccol = [col('#20242e'), col('#2c313c'), col('#3a3f4b'), col(pal.a), col(pal.c), col('#ffffff')];
      const ph = seats.map((s2, i) => { const q = r(); crowd.setColorAt(i, ccol[q < 0.62 ? (i % 3) : q < 0.8 ? 3 : q < 0.96 ? 4 : 5]); return r() * 6.28; });
      s.add(crowd);
      const roof = mesh(new THREE.TorusGeometry(10.5, 0.16, 8, 96), mat('#0c0f16')); roof.rotation.x = Math.PI / 2; roof.scale.y = 0.78; roof.position.y = 4.6; s.add(roof);
      const NL = 48, lamps = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(0.09, 8, 6)), keep(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), NL);
      const o = new THREE.Object3D();
      for (let i = 0; i < NL; i++) { const a = (i / NL) * Math.PI * 2; o.position.set(Math.cos(a) * 10.5, 4.45, Math.sin(a) * 10.5 * 0.78); o.updateMatrix(); lamps.setMatrixAt(i, o.matrix); lamps.setColorAt(i, i % 3 ? col('#ffffff') : col(pal.c)); }
      s.add(lamps);
      const scr = new THREE.Group(); scr.position.y = 3.6; s.add(scr);
      const art = emblemArt(true), side = keep(new THREE.MeshBasicMaterial({ map: art, toneMapped: false })), dark = mat('#07090f');
      scr.add(mesh(new THREE.BoxGeometry(1.7, 1.7, 1.7), [side, side, dark, dark, side, side], 0.02));
      const cab = mesh(new THREE.CylinderGeometry(0.02, 0.02, 2, 6), dark); cab.position.y = 1.85; scr.add(cab);
      const beams = [0, 1, 2, 3, 4, 5].map((k) => {
        const g = keep(new THREE.ConeGeometry(0.9, 7, 24, 1, true)); g.translate(0, -3.5, 0);
        const b = new THREE.Mesh(g, keep(new THREE.MeshBasicMaterial({ color: col(k % 2 ? pal.a : pal.c), transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })));
        const a = (k / 6) * Math.PI * 2 + 0.3; b.position.set(Math.cos(a) * 9, 4.5, Math.sin(a) * 9 * 0.78); s.add(b); return { b, a, k };
      });
      return (t, d) => {
        const bp = pulse(t);
        seats.forEach(([R, a, y, row], i) => { const j = Math.max(0, Math.sin(t * Math.PI * 2 / beat + ph[i] * 0.5 + row * 0.4)); o.position.set(Math.cos(a) * R, y + j * 0.07 * (0.5 + bp), Math.sin(a) * R * 0.78); o.rotation.set(0, -a, 0); o.updateMatrix(); crowd.setMatrixAt(i, o.matrix); });
        crowd.instanceMatrix.needsUpdate = true;
        scr.rotation.y = t * 0.5; scr.scale.setScalar(1 + 0.04 * bp);
        beams.forEach(({ b, a, k }) => { const tx = Math.sin(t * 1.3 + k) * 3, tz = Math.cos(t * 1.1 + k * 2) * 2; b.lookAt(tx, -10, tz); b.rotateX(-Math.PI / 2); b.material.opacity = 0.09 + 0.1 * bp; });
        const k = eio(t / d), ang = -0.9 + k * 1.1, R = 8.8 - k * 1.2; // stays inside the roof ring and above the stands
        cam.position.set(Math.sin(ang) * R, 5.6 - k * 1.5, Math.cos(ang) * R * 0.78); cam.lookAt(0, 0.6 + k * 0.4, 0);
      };
    };

    /* ----- player ----- */
    const fit = { pat: 0.62, trophy: 0.62, car: 1.25, map: 0.62, arena: 1.1 };
    const built = {};
    let cur = null, raf = 0, t0 = 0, dur = 1, dead = false, slotEl = null;
    function get(k) {
      if (!(k in built)) {
        built[k] = null;
        if (SC[k]) { try { lastStage = null; const fn = SC[k](); if (fn && lastStage) built[k] = { s: lastStage, fn }; } catch (e) { built[k] = null; } }
      }
      return built[k];
    }
    function size() {
      if (!slotEl) return;
      const w = slotEl.clientWidth || global.innerWidth, h = slotEl.clientHeight || global.innerHeight;
      renderer.setSize(w, h, false); cam.aspect = w / h;
      const need = Math.max(1, (fit[cur && cur.k] || 0.62) / Math.max(0.3, cam.aspect)); cam.fov = (2 * Math.atan(Math.tan(17.5 * Math.PI / 180) * need) * 180) / Math.PI; cam.updateProjectionMatrix();
    }
    function frame(now) {
      if (dead) return;
      if (S && S.dead) { stop(); return; }
      raf = requestAnimationFrame(frame);
      if (!cur) return;
      const t = (now - t0) / 1000;
      try { cur.fn(t, dur); renderer.render(cur.s, cam); } catch (e) { cur = null; }
    }
    /** Show shot k (if it has a 3D scene) inside the shot element; returns true when 3D is on screen. */
    function enter(k, shotEl, d) {
      if (dead) return false;
      const sc = get(k), slot = shotEl && shotEl.querySelector('.op-gl');
      if (!sc || !slot) { cur = null; return false; }
      slot.appendChild(canvas); slotEl = slot;
      cur = { k, s: sc.s, fn: sc.fn }; dur = d; t0 = performance.now();
      size(); cur.fn(0, d); renderer.render(cur.s, cam);
      if (!raf) raf = requestAnimationFrame(frame);
      return true;
    }
    /** Build (and compile) the scenes the plan needs before the opener starts, so cuts don't stutter. */
    function prepare(keys) {
      renderer.setSize(global.innerWidth || 1280, global.innerHeight || 720, false);
      keys.forEach((k) => { const sc = get(k); if (sc) { try { sc.fn(0.6, 2); renderer.compile(sc.s, cam); renderer.render(sc.s, cam); } catch (e) { built[k] = null; } } }); // compile shaders and upload textures up front
      renderer.clear();
      // wait for the GPU to finish compiling and drawing (a 1-pixel read blocks until then), so that work
      // happens now, before the anthem starts, instead of freezing the first shot
      try { const g = renderer.getContext(), px = new Uint8Array(4); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); } catch (e) { /* not fatal */ }
      return keys.filter((k) => built[k]);
    }
    function stop() {
      if (dead) return; dead = true; cur = null;
      if (raf) cancelAnimationFrame(raf);
      Object.keys(built).forEach((k) => { const b = built[k]; if (b) b.s.traverse((o) => { if (o.isInstancedMesh) o.dispose && o.dispose(); }); });
      trash.forEach((x) => { try { x.dispose(); } catch (e) { /* already gone */ } });
      try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) { /* context already lost */ }
      global.removeEventListener('resize', size);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    global.addEventListener('resize', size);
    raf = requestAnimationFrame(frame); // also watches S.dead, so a skipped opener frees the context
    /** Jump the current shot to time t (seconds); used by tests and previews. */
    function seek(t) { if (!cur) return; t0 = performance.now() - t * 1000; cur.fn(t, dur); renderer.render(cur.s, cam); }
    return { enter, prepare, stop, seek, look, canvas, renderer };
  }

  global.RLOp3D = { create, outlinePts };
})(window);
