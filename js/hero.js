/* RL Esports Simulator — 3D hero (intro) screen.
 * A stylised silver championship cup on a plinth, the RLCS 2027 partner teams' logos orbiting it,
 * drifting boost sparks and the title. "Click to play" (or Enter/Space) opens the menu.
 * Palette: Midnight Ink #121A2E · Azure Blue #1F8BFF · Vermilion Orange #F2542D.
 * Uses three.js r128 (js/vendor/three.min.js). Without WebGL it falls back to a 2D version of the same screen.
 */
(function () {
  'use strict';
  const hero = document.getElementById('hero');
  if (!hero) return;
  if (window.__RLSIM_NO_HERO) { hero.remove(); return; } // used by automated tests only
  const INK = 0x121a2e, AZURE = 0x1f8bff, VERMILION = 0xf2542d;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, renderer = null, running = true;
  document.body.classList.add('hero-open');

  /* ---------- logos for the orbit: RLCS 2027 partner teams that have a logo ---------- */
  function heroTeams() {
    const L = window.RL_LOGOS || {};
    const d27 = (window.RL_DATA27 && window.RL_DATA27.teams) || [];
    let names = d27.filter((t) => t.partner && L[t.name]).map((t) => t.name);
    if (names.length < 12) names = names.concat(((window.RL_DATA && window.RL_DATA.teams) || []).map((t) => t.name).filter((n) => L[n] && !names.includes(n)));
    return names.slice(0, 18).map((n) => ({ name: n, src: L[n] }));
  }
  const teams = heroTeams();

  /* ---------- enter the app ---------- */
  function play() {
    if (!running) return;
    running = false;
    hero.classList.add('hero-leave');
    document.body.classList.remove('hero-open');
    const main = document.getElementById('app');
    setTimeout(() => {
      cancelAnimationFrame(raf);
      if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); }
      hero.remove();
      window.scrollTo({ top: 0 });
      const first = document.querySelector('.topnav button.active') || main;
      if (first && first.focus) first.focus({ preventScroll: true });
    }, reduceMotion ? 50 : 650);
  }
  hero.querySelector('[data-hero-play]').addEventListener('click', play);
  document.addEventListener('keydown', function onKey(e) {
    if (!running) { document.removeEventListener('keydown', onKey); return; }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); play(); }
  });
  setTimeout(() => { const b = hero.querySelector('[data-hero-play]'); if (b) b.focus({ preventScroll: true }); }, 100);

  /* ---------- 2D fallback (no WebGL / three.js) ---------- */
  function fallback() {
    hero.classList.add('hero-2d');
    const ring = document.createElement('div');
    ring.className = 'hero-orbit2d';
    teams.slice(0, 12).forEach((t, i) => {
      const img = document.createElement('img');
      img.src = t.src; img.alt = '';
      img.style.setProperty('--i', i); img.style.setProperty('--n', Math.min(12, teams.length));
      ring.appendChild(img);
    });
    hero.querySelector('.hero-stage').appendChild(ring);
  }

  const canvas = document.getElementById('heroCanvas');
  const T = window.THREE;
  let gl = null;
  try { gl = canvas.getContext('webgl2') || canvas.getContext('webgl'); } catch (e) { gl = null; }
  if (!T || !gl) { fallback(); return; }

  /* ================= three.js scene ================= */
  renderer = new T.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(INK, 1);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new T.Scene();
  scene.fog = new T.Fog(INK, 14, 34);
  const camera = new T.PerspectiveCamera(36, 1, 0.1, 100);

  /* Studio reflections from a painted environment: ink room, azure and vermilion light strips, soft white key */
  function envTexture() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 512);
    bg.addColorStop(0, '#8d99b3'); bg.addColorStop(0.35, '#3b4866'); bg.addColorStop(0.7, '#1a2440'); bg.addColorStop(1, '#121a2e');
    g.fillStyle = bg; g.fillRect(0, 0, 1024, 512);
    const strip = (x, w, col, a) => { const s = g.createLinearGradient(x, 0, x + w, 0); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.5, col.replace('A', a)); s.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = s; g.fillRect(x, 60, w, 330); };
    strip(40, 260, 'rgba(255,255,255,A)', 1);
    strip(330, 150, 'rgba(31,139,255,A)', 1);
    strip(520, 200, 'rgba(255,255,255,A)', 0.8);
    strip(700, 170, 'rgba(242,84,45,A)', 1);
    strip(880, 140, 'rgba(255,255,255,A)', 0.9);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, 0, 1024, 26);
    const tex = new T.CanvasTexture(c);
    tex.mapping = T.EquirectangularReflectionMapping;
    tex.encoding = T.sRGBEncoding;
    const pm = new T.PMREMGenerator(renderer);
    const env = pm.fromEquirectangular(tex).texture;
    tex.dispose(); pm.dispose();
    return env;
  }
  scene.environment = envTexture();

  scene.add(new T.HemisphereLight(0xdfe9ff, INK, 0.35));
  const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(4, 8, 6); scene.add(key);
  const rimA = new T.PointLight(AZURE, 2.2, 18); rimA.position.set(-4.5, 3.5, -2); scene.add(rimA);
  const rimV = new T.PointLight(VERMILION, 2.0, 18); rimV.position.set(4.5, 2.5, -2.5); scene.add(rimV);

  const world = new T.Group(); scene.add(world);

  /* ---------- the cup ---------- */
  const silver = new T.MeshStandardMaterial({ color: 0xeef2f8, metalness: 1, roughness: 0.13, envMapIntensity: 1.8 });
  const satin = new T.MeshStandardMaterial({ color: 0xd6dde8, metalness: 1, roughness: 0.32, envMapIntensity: 1.5 });
  const inkMetal = new T.MeshStandardMaterial({ color: 0x1a2440, metalness: 0.6, roughness: 0.35 });
  const azureGlow = new T.MeshStandardMaterial({ color: AZURE, emissive: AZURE, emissiveIntensity: 1.4, metalness: 0.2, roughness: 0.4 });
  const vermGlow = new T.MeshStandardMaterial({ color: VERMILION, emissive: VERMILION, emissiveIntensity: 1.2, metalness: 0.2, roughness: 0.4 });

  const cup = new T.Group();
  // plinth: two octagonal tiers in ink metal, light bands in azure and vermilion
  const p1 = new T.Mesh(new T.CylinderGeometry(1.15, 1.3, 0.42, 8), inkMetal); p1.position.y = 0.21; cup.add(p1);
  const band1 = new T.Mesh(new T.CylinderGeometry(1.155, 1.205, 0.045, 8, 1, true), azureGlow); band1.position.y = 0.3; cup.add(band1);
  const p2 = new T.Mesh(new T.CylinderGeometry(0.86, 0.98, 0.3, 8), inkMetal); p2.position.y = 0.57; cup.add(p2);
  const band2 = new T.Mesh(new T.CylinderGeometry(0.865, 0.9, 0.035, 8, 1, true), vermGlow); band2.position.y = 0.64; cup.add(band2);
  // body: lathe profile (foot → stem → knot → bowl → lip)
  const prof = [[0.0, 0.72], [0.62, 0.72], [0.6, 0.8], [0.38, 0.92], [0.24, 1.08], [0.19, 1.3], [0.3, 1.42], [0.31, 1.5], [0.2, 1.62], [0.22, 1.78],
    [0.42, 1.96], [0.72, 2.25], [0.93, 2.6], [1.02, 2.95], [1.04, 3.18], [1.1, 3.26], [1.1, 3.31], [1.0, 3.31], [0.96, 3.2], [0.0, 3.2]];
  const body = new T.Mesh(new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(r, y)), 96), silver);
  cup.add(body);
  // engraved ring and the ink interior
  const ring = new T.Mesh(new T.TorusGeometry(0.985, 0.02, 12, 96), satin); ring.rotation.x = Math.PI / 2; ring.position.y = 2.8; cup.add(ring);
  const inner = new T.Mesh(new T.CircleGeometry(0.96, 64), new T.MeshStandardMaterial({ color: 0x0c1222, metalness: 0.9, roughness: 0.25 })); inner.rotation.x = -Math.PI / 2; inner.position.y = 3.2; cup.add(inner);
  // handles
  [-1, 1].forEach((s) => {
    const curve = new T.CatmullRomCurve3([new T.Vector3(s * 0.86, 3.02, 0), new T.Vector3(s * 1.42, 3.0, 0), new T.Vector3(s * 1.56, 2.62, 0), new T.Vector3(s * 1.26, 2.2, 0), new T.Vector3(s * 0.82, 2.18, 0)]);
    const h = new T.Mesh(new T.TubeGeometry(curve, 48, 0.07, 14, false), silver); cup.add(h);
  });
  // a ball hovering over the cup, a nod to the Rocket League ball
  const ball = new T.Group();
  const ballCore = new T.Mesh(new T.SphereGeometry(0.42, 48, 32), satin); ball.add(ballCore);
  const ballCage = new T.LineSegments(new T.EdgesGeometry(new T.IcosahedronGeometry(0.435, 1)), new T.LineBasicMaterial({ color: AZURE, transparent: true, opacity: 0.85 }));
  ball.add(ballCage);
  ball.position.y = 3.95; cup.add(ball);
  world.add(cup);

  // glow pool under the trophy
  function glowTexture(rgb) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, `rgba(${rgb},0.55)`); r.addColorStop(0.45, `rgba(${rgb},0.16)`); r.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    return new T.CanvasTexture(c);
  }
  const pool = new T.Mesh(new T.PlaneGeometry(7, 7), new T.MeshBasicMaterial({ map: glowTexture('31,139,255'), transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.01; world.add(pool);
  const floorRing = new T.Mesh(new T.RingGeometry(2.6, 2.63, 128), new T.MeshBasicMaterial({ color: AZURE, transparent: true, opacity: 0.35 }));
  floorRing.rotation.x = -Math.PI / 2; floorRing.position.y = 0.02; world.add(floorRing);
  const floorRing2 = new T.Mesh(new T.RingGeometry(3.7, 3.72, 128), new T.MeshBasicMaterial({ color: VERMILION, transparent: true, opacity: 0.22 }));
  floorRing2.rotation.x = -Math.PI / 2; floorRing2.position.y = 0.02; world.add(floorRing2);

  /* ---------- orbiting team logos (sprites built from the bundled Liquipedia logos) ---------- */
  const logoGroup = new T.Group(); world.add(logoGroup);
  const sprites = [];
  function logoSprite(t, i) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding;
    const draw = (img) => {
      g.clearRect(0, 0, 256, 256);
      g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.fillStyle = 'rgba(18,26,46,0.92)'; g.fill();
      g.lineWidth = 5; g.strokeStyle = i % 3 === 0 ? 'rgba(242,84,45,0.9)' : 'rgba(31,139,255,0.9)'; g.stroke();
      if (img) { const s = 150, r = Math.min(s / img.width, s / img.height); const w = img.width * r, h = img.height * r; g.drawImage(img, 128 - w / 2, 128 - h / 2, w, h); }
      tex.needsUpdate = true;
    };
    draw(null);
    const img = new Image(); img.onload = () => draw(img); img.src = t.src;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(0.95, 0.95, 1);
    logoGroup.add(sp);
    return sp;
  }
  teams.forEach((t, i) => {
    const n = teams.length;
    const tier = i % 2; // two orbits at different heights and radii
    sprites.push({ sp: logoSprite(t, i), a: (i / n) * Math.PI * 2, r: tier ? 3.55 : 2.75, y: tier ? 3.35 : 1.45, sp0: tier ? -0.11 : 0.15, bob: Math.random() * 6, delay: 0.5 + i * 0.07 });
  });

  /* ---------- drifting sparks ---------- */
  const N = reduceMotion ? 120 : 420;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N);
  const cA = new T.Color(AZURE), cV = new T.Color(VERMILION), cW = new T.Color(0xffffff);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 26; pos[i * 3 + 1] = Math.random() * 12 - 1; pos[i * 3 + 2] = (Math.random() - 0.5) * 18 - 3;
    const c = Math.random() < 0.45 ? cA : Math.random() < 0.5 ? cV : cW;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; vel[i] = 0.15 + Math.random() * 0.45;
  }
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3)); pg.setAttribute('color', new T.BufferAttribute(col, 3));
  const sparks = new T.Points(pg, new T.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending }));
  scene.add(sparks);

  /* ---------- layout: trophy beside the title on wide screens, above it on narrow ones ---------- */
  let wide = true;
  function resize() {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    wide = w / h > 1.05;
    camera.fov = wide ? 34 : 46;
    camera.updateProjectionMatrix();
    world.position.set(wide ? 4.0 : 0, wide ? 0.2 : 3.1, 0);
    world.scale.setScalar(wide ? 0.88 : 0.8);
  }
  window.addEventListener('resize', resize);
  resize();

  let mx = 0, my = 0;
  hero.addEventListener('pointermove', (e) => { mx = (e.clientX / window.innerWidth - 0.5) * 2; my = (e.clientY / window.innerHeight - 0.5) * 2; });

  const tmp = new T.Vector3();
  const ui = hero.querySelector('.hero-ui');
  let edgeCache = -0.2, edgeAt = 0;
  function titleEdge() {
    // right edge of the text column in normalised device coordinates (-1 … 1)
    const now = performance.now();
    if (now - edgeAt > 500) { const r = ui.getBoundingClientRect(); edgeCache = ((r.left + Math.min(r.width, 520)) / window.innerWidth) * 2 - 1; edgeAt = now; }
    return edgeCache;
  }

  /* ---------- animation ---------- */
  const t0 = performance.now();
  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  function frame(now) {
    const t = (now - t0) / 1000;
    const speed = reduceMotion ? 0.25 : 1;
    // camera: slow drift with a little parallax from the pointer
    const camX = (wide ? 2.2 : 0) + mx * 0.6, camY = (wide ? 3.3 : 4.6) - my * 0.35 + Math.sin(t * 0.3 * speed) * 0.08;
    camera.position.set(camX, camY, wide ? 11.5 : 14);
    camera.lookAt(wide ? 2.4 : 0, wide ? 2.2 : 3.2, 0);
    // trophy rises in, then turns slowly
    const rise = reduceMotion ? 1 : ease(t / 1.6);
    cup.position.y = (1 - rise) * -2.2;
    cup.rotation.y = t * 0.35 * speed;
    ball.rotation.y = -t * 0.9 * speed; ball.rotation.x = t * 0.4 * speed;
    ball.position.y = 3.95 + Math.sin(t * 1.6 * speed) * 0.08;
    azureGlow.emissiveIntensity = 1.2 + Math.sin(t * 2 * speed) * 0.3;
    // logos fly in to their orbits, then circle and bob, nearest ones larger
    sprites.forEach((o) => {
      const k = reduceMotion ? 1 : ease((t - o.delay) / 1.2);
      const a = o.a + t * o.sp0 * speed;
      const r = o.r + (1 - k) * 9;
      o.sp.position.set(Math.cos(a) * r, o.y + Math.sin(t * 0.9 + o.bob) * 0.18 + (1 - k) * 3, Math.sin(a) * r);
      const depth = (Math.sin(a) + 1) / 2; // 0 = back, 1 = front
      const s = (0.5 + depth * 0.32) * k;
      o.sp.scale.set(s, s, 1);
      let fade = 1;
      if (wide) {
        // fade logos out as they pass behind the title column (left ~40% of the screen)
        tmp.copy(o.sp.position); o.sp.parent.localToWorld(tmp); tmp.project(camera);
        const edge = titleEdge();
        fade = Math.min(1, Math.max(0, (tmp.x - edge) / 0.18));
      }
      o.sp.material.opacity = (0.45 + depth * 0.55) * k * fade;
    });
    floorRing.rotation.z = t * 0.05; floorRing2.rotation.z = -t * 0.03;
    // sparks rise like boost particles
    const p = pg.attributes.position.array;
    for (let i = 0; i < N; i++) { p[i * 3 + 1] += vel[i] * 0.016 * speed; if (p[i * 3 + 1] > 11) p[i * 3 + 1] = -1; }
    pg.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (!running) return; cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(frame); });
  raf = requestAnimationFrame(frame);
})();
