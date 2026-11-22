/* RL Esports Simulator — 1v1 & 2v2 Championship branding and intros.
 *
 * Two brands of their own, separate from the 3v3 RLCS events:
 *   1v1 "Duel"    — crimson, ink and bone: one blade-cut, two chevrons facing off. Nobody to rotate with.
 *   2v2 "Doubles" — teal and violet on deep indigo: two pairs of interlocking tiles and crossing passing lanes.
 * Each has a World Championship edition with a gold accent. The key art is generated SVG (no external images).
 * RLSideIntro.play(o, done) runs the mode's own intro: o = { mode: 1|2, worlds, kicker, title, tagline, field: [...], note }.
 */
(function (global) {
  'use strict';
  const T = (global.RL_EVENT_THEMES = global.RL_EVENT_THEMES || {});
  const svgUrl = (s) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.replace(/\s+/g, ' ')).replace(/[()']/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()); // safe inside an unquoted CSS url()

  /* ---------- key art (1600 x 600) ---------- */
  function duelArt(gold) {
    const acc = gold ? '#D4A017' : '#F5F0E6';
    let lines = '';
    for (let i = 0; i < 14; i++) { const y = 70 + i * 34, w = 80 + ((i * 53) % 170); lines += `<rect x="${60 + ((i * 37) % 90)}" y="${y}" width="${w}" height="3" fill="#fff" fill-opacity=".07"/><rect x="${1540 - w - ((i * 41) % 90)}" y="${y + 14}" width="${w}" height="3" fill="#fff" fill-opacity=".07"/>`; }
    const stars = gold ? [[300, 110], [1290, 500], [1380, 120], [210, 480]].map(([x, y]) => `<path d="M${x} ${y - 16} L${x + 5} ${y - 5} L${x + 16} ${y} L${x + 5} ${y + 5} L${x} ${y + 16} L${x - 5} ${y + 5} L${x - 16} ${y} L${x - 5} ${y - 5}Z" fill="#D4A017"/>`).join('') : '';
    return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 600" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a0716"/><stop offset=".55" stop-color="#0A0A12"/><stop offset="1" stop-color="#14060c"/></linearGradient>
      <pattern id="d" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.6" fill="#fff" fill-opacity=".07"/></pattern>
      <radialGradient id="h" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#E11D48" stop-opacity=".55"/><stop offset="1" stop-color="#E11D48" stop-opacity="0"/></radialGradient></defs>
      <rect width="1600" height="600" fill="url(#g)"/><rect width="1600" height="600" fill="url(#d)"/>
      <ellipse cx="800" cy="300" rx="520" ry="300" fill="url(#h)"/>${lines}
      <path d="M600 600 L900 0 L1030 0 L730 600Z" fill="#E11D48"/>
      <path d="M752 600 L1052 0 L1072 0 L772 600Z" fill="${acc}"/>
      <path d="M560 300 L330 120 L270 168 L440 300 L270 432 L330 480Z" fill="#E11D48"/>
      <path d="M1040 300 L1270 120 L1330 168 L1160 300 L1330 432 L1270 480Z" fill="${acc}"/>${stars}
    </svg>`);
  }
  function doublesArt(gold) {
    const acc = gold ? '#D4A017' : '#A78BFA';
    const tile = (x, y, fill, op) => `<path d="M${x} ${y} L${x + 150} ${y} L${x + 110} ${y + 110} L${x - 40} ${y + 110}Z" fill="${fill}" fill-opacity="${op}"/>`;
    return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 600" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0c2f3a"/><stop offset=".5" stop-color="#160F3A"/><stop offset="1" stop-color="#22104a"/></linearGradient>
      <pattern id="d" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M11 7v8M7 11h8" stroke="#fff" stroke-opacity=".06" stroke-width="1.5"/></pattern></defs>
      <rect width="1600" height="600" fill="url(#g)"/><rect width="1600" height="600" fill="url(#d)"/>
      <path d="M-40 520 C 400 520, 620 80, 1640 90" stroke="#14B8A6" stroke-width="16" fill="none" stroke-opacity=".85"/>
      <path d="M-40 90 C 600 90, 900 520, 1640 510" stroke="${acc}" stroke-width="16" fill="none" stroke-opacity=".85"/>
      <path d="M-40 560 C 420 560, 640 120, 1640 130" stroke="#14B8A6" stroke-width="3" fill="none" stroke-opacity=".4"/>
      <path d="M-40 50 C 620 50, 920 480, 1640 470" stroke="${acc}" stroke-width="3" fill="none" stroke-opacity=".4"/>
      ${tile(620, 170, '#14B8A6', 1)}${tile(780, 170, acc, 1)}${tile(580, 290, acc, 0.9)}${tile(740, 290, '#14B8A6', 0.9)}
      <circle cx="430" cy="440" r="9" fill="#fff"/><circle cx="1170" cy="400" r="9" fill="#fff"/>
    </svg>`);
  }
  const BRANDS = {
    'side-1v1': { name: '1v1 Championship · Duel', a: '#E11D48', b: '#0A0A12', c: '#F5F0E6', on: '#fff', art: duelArt(false) },
    'side-1v1-wc': { name: '1v1 World Championship', a: '#E11D48', b: '#0A0A12', c: '#D4A017', on: '#fff', art: duelArt(true) },
    'side-2v2': { name: '2v2 Championship · Doubles', a: '#14B8A6', b: '#160F3A', c: '#A78BFA', on: '#06201d', art: doublesArt(false) },
    'side-2v2-wc': { name: '2v2 World Championship', a: '#14B8A6', b: '#160F3A', c: '#D4A017', on: '#06201d', art: doublesArt(true) },
  };
  Object.assign(T, BRANDS);
  const brandKey = (mode, worlds) => 'side-' + mode + 'v' + mode + (worlds ? '-wc' : '');

  /* ---------- intros ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let cur = null;
  function stop() {
    if (!cur) return;
    cur.dead = true; cur.timers.forEach(clearTimeout);
    document.removeEventListener('keydown', cur.onKey, true);
    if (cur.el.parentNode) cur.el.parentNode.removeChild(cur.el);
    document.documentElement.classList.remove('cer-open');
    cur = null;
  }
  /** One entrant card: seed, club badge, player name(s), club and rating. */
  function card(e, cls) {
    const names = e.players && e.players.length > 1 ? e.players.map((p) => `<b>${esc(p.flag || '')} ${esc(p.name)}</b>`).join('') : `<b>${esc((e.players && e.players[0] && e.players[0].flag) || '')} ${esc(e.name)}</b>`;
    return `<div class="si-card ${cls || ''}${e.mine ? ' mine' : ''}"><span class="si-seed">${e.region && cls === 'wc' ? esc(e.region) : '#' + e.seed}</span>${e.badge || ''}<div class="si-cn">${names}<small>${esc(e.club || '')}${e.ovr ? ' · ' + e.ovr : ''}</small></div></div>`;
  }
  function stage(o) {
    const f = (o.field || []).map((e, i) => Object.assign({ seed: i + 1 }, e));
    if (!f.length) return '';
    if (o.worlds) {
      const pair = (x, y, k) => (x && y ? `<div class="si-semi" style="--k:${k}"><span class="si-sl">Semi-final ${k + 1}</span>${card(x, 'wc')}<span class="si-vs">VS</span>${card(y, 'wc')}</div>` : '');
      return `<div class="si-bracket">${pair(f[0], f[3], 0)}${pair(f[1], f[2], 1)}<div class="si-final"><span>Grand Final</span><b>?</b><small>Best of seven</small></div></div>`;
    }
    const rest = f.slice(2);
    return `<div class="si-faceoff"><span class="si-sl">Top seeds</span>${card(f[0], 'big l')}<span class="si-vs">VS</span>${f[1] ? card(f[1], 'big r') : ''}</div>
      <div class="si-field">${rest.map((e, i) => `<span class="si-chip${e.mine ? ' mine' : ''}" style="--i:${i}"><i>${e.seed}</i>${e.players && e.players.length > 1 ? e.players.map((p) => esc(p.name)).join(' <em>&amp;</em> ') : esc(e.name)}</span>`).join('')}</div>`;
  }
  function play(o, done) {
    stop();
    const mode = o.mode === 2 ? 2 : 1;
    const th = BRANDS[brandKey(mode, o.worlds)];
    const el = document.createElement('div');
    el.className = 'si si-m' + mode + (o.worlds ? ' si-wc' : '');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', (o.title || mode + 'v' + mode) + ' intro');
    el.style.cssText = `--a:${th.a};--b:${th.b};--c:${th.c}`;
    const art = mode === 1
      ? `<div class="si-line" aria-hidden="true"></div><div class="si-split" aria-hidden="true"><i class="l"></i><i class="r"></i><i class="seam"></i></div>
         <div class="si-speed" aria-hidden="true">${Array.from({ length: 12 }, (_, k) => `<i style="--k:${k}"></i>`).join('')}</div>
         <div class="si-glyph" aria-hidden="true"><b class="g1">1</b><svg class="gv" viewBox="0 0 100 100"><path d="M8 6 L50 94 L92 6"/></svg><b class="g2">1</b></div>`
      : `<div class="si-tiles" aria-hidden="true"><i class="t1"></i><i class="t2"></i><i class="t3"></i><i class="t4"></i></div>
         <svg class="si-trails" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
           <path id="siA" class="ta" d="M-60 760 C 420 760, 700 160, 1660 150"/><path id="siB" class="tb" d="M-60 150 C 640 150, 960 760, 1660 750"/>
           <circle r="12" class="ca"><animateMotion dur="1.3s" begin="0.9s" fill="freeze" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".5 0 .3 1"><mpath href="#siA"/></animateMotion></circle>
           <circle r="12" class="cb"><animateMotion dur="1.3s" begin="1.05s" fill="freeze" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".5 0 .3 1"><mpath href="#siB"/></animateMotion></circle>
         </svg>
         <div class="si-glyph" aria-hidden="true"><b class="g1">2</b><svg class="gv" viewBox="0 0 100 100"><path d="M8 6 L50 94 L92 6"/><path class="gv2" d="M26 6 L50 58 L74 6"/></svg><b class="g2">2</b></div>`;
    el.innerHTML = `<div class="si-bg" aria-hidden="true"></div>${o.worlds ? '<div class="si-rays" aria-hidden="true"></div>' : ''}${art}
      <div class="si-flash" aria-hidden="true"></div><div class="si-ring" aria-hidden="true"></div>
      <div class="si-text">
        <span class="si-kicker">${esc(o.kicker || '')}</span>
        <h1 class="si-title">${esc(o.title || '').split(' ').map((w, i) => `<span style="--i:${i}">${esc(w)}</span>`).join(' ')}</h1>
        <span class="si-tag">${esc(o.tagline || '')}</span>
      </div>
      <div class="si-stage">${stage(o)}${o.note ? `<p class="si-note">${esc(o.note)}</p>` : ''}</div>
      <div class="cut-ui"><button class="cut-skip" type="button">Skip intro</button><button class="cut-go" type="button">Let’s go →</button></div>`;
    document.body.appendChild(el);
    document.documentElement.classList.add('cer-open');
    const S = (cur = { el, timers: [], dead: false });
    const finish = () => { if (S.dead) return; stop(); if (done) done(); };
    el.querySelector('.cut-skip').addEventListener('click', finish);
    el.querySelector('.cut-go').addEventListener('click', finish);
    S.onKey = (ev) => { if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); finish(); } };
    document.addEventListener('keydown', S.onKey, true);
    const b2 = mode === 1 ? 4000 : 4400;
    S.timers.push(setTimeout(() => { if (!S.dead) el.classList.add('beat2'); }, b2));
    S.timers.push(setTimeout(() => { const g = el.querySelector('.cut-go'); if (g && !S.dead) { g.classList.add('on'); g.focus({ preventScroll: true }); } }, b2 + 1900));
  }
  /** Taglines: each Open and World Championship gets its own line. */
  const TAG = {
    1: ['One car. No teammates. No excuses.', 'Four regions. Four duellists. One world champion.'],
    2: ['Two players. One rotation. Zero hiding.', 'Four duos, one title: the best partnership in the world.'],
  };
  /* ---------- champion ceremony ----------
     Three scenes in the mode's brand:
       1. The final: champion vs runner-up, the series replayed game by game until the decider, then the
          loser's side is swept away (1v1: the blade-cut screen; 2v2: the tiles and passing lanes).
       2. The champion: 1v1 — a spotlight, a swinging Duel medal and the name letter by letter.
                        2v2 — the two players fly in from either side and meet in the middle; a double-ring medal.
       3. The road to the title: every series, the record and each player's numbers.
     o = { mode, worlds, kicker, title, label, champ:{name, players:[{name,flag,photo,g,a,sv}], club, badge}, runner:{...},
           final:{round, games:[{w,l,ot}]}, path:[{round, opp, w, l}], record:{sw,sl,gw,gl}, next } */
  let cc = null;
  function ccStop() {
    if (!cc) return;
    cc.dead = true; cc.timers.forEach(clearTimeout); if (cc.raf) cancelAnimationFrame(cc.raf);
    document.removeEventListener('keydown', cc.onKey, true);
    if (cc.el.parentNode) cc.el.parentNode.removeChild(cc.el);
    document.documentElement.classList.remove('cer-open');
    cc = null;
  }
  const ini = (n) => (String(n).replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || '?').toUpperCase();
  const face = (p) => `<span class="sc-face">${p.photo ? `<img src="${esc(p.photo)}" alt="" />` : `<b>${esc(ini(p.name))}</b>`}</span>`;
  const side = (e, cls) => `<div class="sc-side ${cls}">${e.badge || ''}<div class="sc-sn">${e.players.map((p) => `<b>${esc(p.flag || '')} ${esc(p.name)}</b>`).join('')}<small>${esc(e.club || '')}</small></div></div>`;
  function confetti(S, cols) {
    const cv = S.el.querySelector('.sc-confetti'); if (!cv) return;
    const ctx = cv.getContext('2d'); const W = (cv.width = innerWidth), H = (cv.height = innerHeight);
    const N = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 40 : 170;
    const ps = Array.from({ length: N }, () => ({ x: Math.random() * W, y: -20 - Math.random() * H * 0.8, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3.5, r: Math.random() * 6, w: 6 + Math.random() * 7, h: 3 + Math.random() * 5, c: cols[Math.floor(Math.random() * cols.length)], s: Math.random() * 0.2 - 0.1 }));
    const t0 = performance.now();
    const tick = (t) => {
      if (S.dead) return; ctx.clearRect(0, 0, W, H);
      ps.forEach((p) => { p.x += p.vx + Math.sin((t + p.y) / 400); p.y += p.vy; p.r += p.s; if (p.y > H + 20 && t - t0 < 4500) { p.y = -20; p.x = Math.random() * W; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 3))); ctx.restore(); });
      S.raf = requestAnimationFrame(tick);
    };
    S.raf = requestAnimationFrame(tick);
  }
  function ceremony(o, done) {
    ccStop(); stop();
    const mode = o.mode === 2 ? 2 : 1, th = BRANDS[brandKey(mode, o.worlds)];
    const el = document.createElement('div');
    el.className = 'side-cer si-m' + mode + (o.worlds ? ' si-wc' : '');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', (o.label || 'Champion') + ' ceremony');
    el.style.cssText = `--a:${th.a};--b:${th.b};--c:${th.c};--c3:${th.c}`;
    const steps = [['final', o.final && o.runner ? 'The final' : null], ['champ', o.label || 'Champion'], ['road', 'Road to the title']].filter((x) => x[1]);
    el.innerHTML = `<div class="si-bg" aria-hidden="true"></div>${o.worlds ? '<div class="si-rays" aria-hidden="true"></div>' : ''}<div class="sc-stage"></div><canvas class="sc-confetti" aria-hidden="true"></canvas>
      <div class="cer-ui"><div class="cer-steps">${steps.map(([k, l]) => `<span data-k="${k}">${esc(l)}</span>`).join('')}</div>
        <div class="cer-btns"><button class="cer-next" type="button">Next ▸</button><button class="cer-skip" type="button">Skip ceremony</button></div></div>`;
    document.body.appendChild(el);
    document.documentElement.classList.add('cer-open');
    const S = (cc = { el, timers: [], dead: false, raf: 0, advance: null });
    const stage = el.querySelector('.sc-stage');
    const finish = () => { if (S.dead) return; ccStop(); if (done) done(); };
    const next = () => { if (S.advance) { const f = S.advance; S.advance = null; f(); } };
    el.querySelector('.cer-next').addEventListener('click', next);
    el.querySelector('.cer-skip').addEventListener('click', finish);
    S.onKey = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(); } else if (ev.key === ' ' || ev.key === 'ArrowRight' || ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); next(); } };
    document.addEventListener('keydown', S.onKey, true);
    const wait = (ms) => new Promise((res) => { const t = setTimeout(() => { S.advance = null; res(); }, ms); S.timers.push(t); S.advance = () => { clearTimeout(t); res(); }; });
    const later = (ms, f) => S.timers.push(setTimeout(() => { if (!S.dead) f(); }, ms));
    const mark = (k) => el.querySelectorAll('.cer-steps span').forEach((x) => { x.classList.toggle('on', x.dataset.k === k); if (x.dataset.k === k) x.classList.add('seen'); });
    const C = o.champ, R = o.runner, plural = C.players.length > 1;

    const sceneFinal = async () => {
      mark('final');
      const games = (o.final && o.final.games) || [];
      stage.innerHTML = `<div class="sc-final">
        ${mode === 1 ? '<div class="si-split" aria-hidden="true"><i class="l"></i><i class="r"></i><i class="seam"></i></div>'
          : '<div class="si-tiles sc-tiles" aria-hidden="true"><i class="t1"></i><i class="t2"></i><i class="t3"></i><i class="t4"></i></div><svg class="si-trails sc-trails" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true"><path class="ta" d="M-60 760 C 420 760, 700 160, 1660 150"/><path class="tb" d="M-60 150 C 640 150, 960 760, 1660 750"/></svg>'}
        <div class="sc-fhead"><span class="si-kicker">${esc(o.kicker || '')}</span><h2>${esc((o.final && o.final.round) || 'Grand Final')}</h2></div>
        <div class="sc-vs">${side(C, 'w')}<div class="sc-score"><b class="sa">0</b><i>–</i><b class="sb">0</b></div>${side(R, 'l')}</div>
        <div class="sc-games">${games.map((g, i) => `<span class="${g.w > g.l ? 'won' : 'lost'}" style="--i:${i}"><small>G${i + 1}</small>${g.w}–${g.l}${g.ot ? '<em>OT</em>' : ''}</span>`).join('')}</div>
        <div class="sc-point">Championship point</div>
      </div>`;
      const sa = stage.querySelector('.sa'), sb = stage.querySelector('.sb'), chips = stage.querySelectorAll('.sc-games span');
      let a = 0, b = 0;
      games.forEach((g, i) => later(1100 + i * 520, () => { chips[i].classList.add('on'); if (g.w > g.l) { a++; sa.textContent = a; sa.classList.remove('pop'); void sa.offsetWidth; sa.classList.add('pop'); } else { b++; sb.textContent = b; sb.classList.remove('pop'); void sb.offsetWidth; sb.classList.add('pop'); } if (i === games.length - 2) stage.querySelector('.sc-point').classList.add('on'); }));
      later(1100 + games.length * 520 + 200, () => stage.querySelector('.sc-final').classList.add('decided'));
      await wait(1100 + games.length * 520 + 2600);
    };
    const sceneChamp = async () => {
      mark('champ');
      let li = 0;
      const big = (n) => `<span class="sc-word">${Array.from(n).map((ch) => `<i style="--i:${li++}">${esc(ch)}</i>`).join('')}</span>`;
      const medal = mode === 1
        ? `<svg class="sc-medal" viewBox="0 0 200 260" aria-hidden="true"><path d="M70 0 L100 70 L130 0" class="rib"/><circle cx="100" cy="160" r="88" class="m1"/><circle cx="100" cy="160" r="72" class="m2"/><path d="M60 125 L100 205 L140 125" class="mv"/><text x="100" y="172" class="mt">1V1</text></svg>`
        : `<svg class="sc-medal" viewBox="0 0 240 260" aria-hidden="true"><path d="M90 0 L120 70 L150 0" class="rib"/><circle cx="92" cy="160" r="70" class="m1 r1"/><circle cx="148" cy="160" r="70" class="m1 r2"/><text x="120" y="172" class="mt">2V2</text></svg>`;
      stage.innerHTML = `<div class="sc-champ">
        <div class="sc-spot" aria-hidden="true"></div>${medal}
        <span class="si-kicker">${esc(o.kicker || '')}</span>
        ${mode === 1 ? `<div class="sc-hero">${face(C.players[0])}</div><h1 class="sc-name">${big(C.players[0].name)}</h1>`
          : `<div class="sc-duo"><div class="sc-pl l">${face(C.players[0])}<b>${esc(C.players[0].flag || '')} ${esc(C.players[0].name)}</b></div><span class="sc-amp">&amp;</span><div class="sc-pl r">${face(C.players[1] || C.players[0])}<b>${esc((C.players[1] || {}).flag || '')} ${esc((C.players[1] || {}).name || '')}</b></div><i class="sc-burst" aria-hidden="true"></i></div>`}
        <div class="sc-club">${C.badge || ''}<span>${esc(C.club || '')}</span></div>
        <div class="sc-label">${esc(o.label || '')}</div>
        ${o.next ? `<p class="sc-next">${esc(o.next)}</p>` : ''}
      </div>`;
      later(mode === 1 ? 1000 : 850, () => confetti(S, mode === 1 ? [th.a, th.c, '#ffffff', '#ff6b81'] : [th.a, th.c, '#ffffff', '#5eead4']));
      await wait(7000);
    };
    const sceneRoad = async () => {
      mark('road');
      const r = o.record || {};
      const tiles = [['Series', (r.sw || 0) + '–' + (r.sl || 0)], ['Games', (r.gw || 0) + '–' + (r.gl || 0)], ['Goals', C.players.reduce((x, p) => x + (p.g || 0), 0)], ['Saves', C.players.reduce((x, p) => x + (p.sv || 0), 0)]];
      stage.innerHTML = `<div class="sc-road">
        <h2>Road to the title</h2><p class="sc-sub">${esc(o.title || '')}</p>
        <div class="sc-rec">${tiles.map(([k, v], i) => `<div style="--i:${i}"><b>${esc(v)}</b><small>${k}</small></div>`).join('')}</div>
        <div class="sc-path">${(o.path || []).map((m, i) => `<div class="sc-pm" style="--i:${i}"><small>${esc(m.round)}</small><b>${esc(m.opp)}</b><span>${m.w}–${m.l}</span></div>`).join('')}</div>
        ${plural ? `<div class="sc-pstats">${C.players.map((p) => `<div><b>${esc(p.flag || '')} ${esc(p.name)}</b><span>${p.g || 0} G · ${p.a || 0} A · ${p.sv || 0} Sv</span></div>`).join('')}</div>` : ''}
        ${o.next ? `<p class="sc-next">${esc(o.next)}</p>` : ''}
        <button class="sc-done" type="button">Continue →</button>
      </div>`;
      stage.querySelector('.sc-done').addEventListener('click', finish);
      el.querySelector('.cer-next').textContent = 'Finish ▸';
      await wait(60000);
    };
    (async () => {
      if (o.final && o.runner) await sceneFinal();
      if (S.dead) return; await sceneChamp();
      if (S.dead) return; await sceneRoad();
      finish();
    })();
  }

  global.RLSideIntro = { play, stop, brandKey, ceremony, tagline: (mode, worlds) => TAG[mode === 2 ? 2 : 1][worlds ? 1 : 0] };
})(window);
