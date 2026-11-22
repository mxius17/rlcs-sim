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
  global.RLSideIntro = { play, stop, brandKey, palette: (mode, worlds) => BRANDS[brandKey(mode, worlds)], tagline: (mode, worlds) => TAG[mode === 2 ? 2 : 1][worlds ? 1 : 0] };
})(window);
