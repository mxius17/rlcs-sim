/* RL Esports Simulator — end-of-tournament ceremony.
 *
 * One ceremony for every tournament, staged in the event's own colours (its branding, or the champion's colour):
 *   1. The final: champion vs runner-up, replayed game by game with the series score counting up, a
 *      championship-point flash, then the loser's side is swept away.
 *   2. (3v3) The tournament MVP under a spotlight, the stats counting up.
 *   3. (3v3) The goal of the tournament, replayed on the top-down pitch (js/pitch.js).
 *   4. The champions: a spotlight, a trophy (3v3) or medal (1v1 / 2v2) dropping in, the name letter by letter,
 *      the players flying in, a champions label and confetti.
 *   5. The road to the title: record, every series played and each player's numbers.
 * 1v1 and 2v2 events add their brand's own decoration (js/sidebrand.js). app.js builds the data; this file only stages it.
 * Next skips a scene, Skip ends the ceremony; Space / → / Enter and Esc do the same.
 *
 * o = { mode: 1|2|3, worlds, single, palette:{a,b,c}, art, kicker, title, label, line, labels:{mvp,goal},
 *       champ:{name, club, badge, players:[{name,flag,photo,g,a,sv}]}, runner:{...}, final:{round, games:[{w,l,ot}]},
 *       path:[{round, opp, w, l}], record:{sw,sl,gw,gl}, next, mvp:{name,flag,photo,team,badge,stats:[[label,value]]}, goal:{...} }
 */
(function (global) {
  'use strict';
  let cur = null;
  const reduce = () => global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = (n) => (String(n).replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || '?').toUpperCase();
  const hexA = (hex, a) => { const h = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#1f8bff'; const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  function stop() {
    if (!cur) return;
    cur.dead = true; cur.timers.forEach(clearTimeout); if (cur.raf) cancelAnimationFrame(cur.raf);
    document.removeEventListener('keydown', cur.onKey, true);
    if (cur.el && cur.el.parentNode) cur.el.parentNode.removeChild(cur.el);
    document.documentElement.classList.remove('cer-open');
    cur = null;
  }
  const face = (p) => `<span class="sc-face">${p && p.photo ? `<img src="${esc(p.photo)}" alt="" onerror="this.remove()" />` : ''}<b>${esc(initials((p && p.name) || '?'))}</b></span>`;
  const sideCard = (e, cls) => `<div class="sc-side ${cls}">${e.badge || ''}<div class="sc-sn">${e.players.length <= 2 ? e.players.map((p) => `<b>${esc(p.flag || '')} ${esc(p.name)}</b>`).join('') : `<b>${esc(e.name)}</b><span class="sc-flags">${e.players.map((p) => esc(p.flag || '')).join('')}</span>`}<small>${esc(e.club || '')}</small></div></div>`;
  function confetti(S, cols) {
    const cv = S.el.querySelector('.sc-confetti'); if (!cv) return;
    const ctx = cv.getContext('2d'); const W = (cv.width = innerWidth), H = (cv.height = innerHeight);
    const N = reduce() ? 40 : 180;
    const ps = Array.from({ length: N }, (_, i) => { const burst = i < N / 3; return { x: burst ? W / 2 + (Math.random() - 0.5) * W * 0.2 : Math.random() * W, y: burst ? H * 0.42 : -20 - Math.random() * H * 0.8, vx: burst ? (Math.random() - 0.5) * 14 : (Math.random() - 0.5) * 2, vy: burst ? -6 - Math.random() * 9 : 2 + Math.random() * 3.5, r: Math.random() * 6, w: 6 + Math.random() * 7, h: 3 + Math.random() * 5, c: cols[Math.floor(Math.random() * cols.length)], s: Math.random() * 0.2 - 0.1 }; });
    const t0 = performance.now();
    const tick = (t) => {
      if (S.dead) return; ctx.clearRect(0, 0, W, H);
      ps.forEach((p) => { p.vy = Math.min(p.vy + 0.25, 4.5); p.vx *= 0.985; p.x += p.vx + Math.sin((t + p.y) / 400) * 0.6; p.y += p.vy; p.r += p.s; if (p.y > H + 20 && t - t0 < 5000) { p.y = -20; p.x = Math.random() * W; p.vy = 2 + Math.random() * 3; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 3))); ctx.restore(); });
      S.raf = requestAnimationFrame(tick);
    };
    S.raf = requestAnimationFrame(tick);
  }
  function countUp(root, S) {
    root.querySelectorAll('[data-to]').forEach((n) => {
      const to = +n.dataset.to, t0 = performance.now(), dur = 900;
      const tick = (now) => { if (S.dead) return; const f = Math.min(1, (now - t0) / dur); n.textContent = Math.round(to * (1 - Math.pow(1 - f, 3))); if (f < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  }
  const TROPHY = `<svg class="sc-medal sc-cup" viewBox="0 0 200 240" aria-hidden="true">
      <path class="cu" d="M50 20 H150 V70 C150 120 125 145 100 150 C75 145 50 120 50 70Z"/>
      <path class="ha" d="M50 34 C18 34 16 84 56 96 M150 34 C182 34 184 84 144 96"/>
      <rect class="cu" x="90" y="150" width="20" height="34"/><path class="cu" d="M60 184 H140 L150 214 H50Z"/>
      <path class="sh" d="M68 32 C66 80 76 112 92 132"/><path class="st" d="M100 52 L108 72 L130 73 L113 86 L119 107 L100 95 L81 107 L87 86 L70 73 L92 72Z"/></svg>`;

  function play(o, done) {
    stop();
    const mode = o.mode === 1 || o.mode === 2 ? o.mode : 3;
    const pal = o.palette || { a: '#1f8bff', b: '#121A2E', c: '#d4a017' };
    const L = o.labels || {};
    const el = document.createElement('div');
    el.className = 'side-cer si-m' + mode + (o.worlds ? ' si-wc' : '');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', (o.label || 'Champions') + ' ceremony');
    el.style.cssText = `--a:${pal.a};--b:${pal.b};--c:${pal.c};--c3:${pal.c}${o.art ? `;--art:url(${o.art})` : ''}`;
    const steps = [['final', o.final && o.runner ? (o.single ? 'The match' : 'The final') : null], ['mvp', o.mvp ? L.mvp || 'MVP' : null], ['goal', o.goal ? L.goal || 'Goal of the tournament' : null],
      ['champ', o.label || 'Champions'], ['road', o.single ? null : 'Road to the title']].filter((x) => x[1]);
    el.innerHTML = `<div class="si-bg" aria-hidden="true"></div>${mode === 3 && o.art ? '<div class="sc-art" aria-hidden="true"></div>' : ''}${mode === 3 ? '<div class="sc-beams" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' : ''}${o.worlds ? '<div class="si-rays" aria-hidden="true"></div>' : ''}
      <div class="sc-stage"></div><canvas class="sc-confetti" aria-hidden="true"></canvas>
      <div class="cer-ui"><div class="cer-steps">${steps.map(([k, l]) => `<span data-k="${k}">${esc(l)}</span>`).join('')}</div>
        <div class="cer-btns"><button class="cer-next" type="button">Next ▸</button><button class="cer-skip" type="button">Skip ceremony</button></div></div>`;
    document.body.appendChild(el);
    document.documentElement.classList.add('cer-open');
    const S = (cur = { el, timers: [], dead: false, raf: 0, advance: null });
    const stage = el.querySelector('.sc-stage');
    const finish = () => { if (S.dead) return; stop(); if (done) done(); };
    const next = () => { if (S.advance) { const f = S.advance; S.advance = null; f(); } };
    el.querySelector('.cer-next').addEventListener('click', next);
    el.querySelector('.cer-skip').addEventListener('click', finish);
    S.onKey = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(); } else if (ev.key === ' ' || ev.key === 'ArrowRight' || ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); next(); } };
    document.addEventListener('keydown', S.onKey, true);
    const wait = (ms) => new Promise((res) => { const t = setTimeout(() => { S.advance = null; res(); }, ms); S.timers.push(t); S.advance = () => { clearTimeout(t); res(); }; });
    const later = (ms, f) => S.timers.push(setTimeout(() => { if (!S.dead) f(); }, ms));
    const mark = (k) => el.querySelectorAll('.cer-steps span').forEach((x) => { x.classList.toggle('on', x.dataset.k === k); if (x.dataset.k === k) x.classList.add('seen'); });
    const C = o.champ, R = o.runner;
    const sfx = (n) => global.RLSfx && global.RLSfx.play(n);
    sfx('whoosh');
    const cols = [pal.a, pal.c, '#ffffff', mode === 2 ? '#5eead4' : mode === 1 ? '#ff6b81' : '#ffd34d'];

    const sceneFinal = async () => {
      mark('final');
      const games = (o.final && o.final.games) || [];
      const deco = mode === 1 ? '<div class="si-split" aria-hidden="true"><i class="l"></i><i class="r"></i><i class="seam"></i></div>'
        : mode === 2 ? '<div class="si-tiles sc-tiles" aria-hidden="true"><i class="t1"></i><i class="t2"></i><i class="t3"></i><i class="t4"></i></div><svg class="si-trails sc-trails" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true"><path class="ta" d="M-60 760 C 420 760, 700 160, 1660 150"/><path class="tb" d="M-60 150 C 640 150, 960 760, 1660 750"/></svg>'
        : '<div class="sc-halves" aria-hidden="true"><i class="l"></i><i class="r"></i></div>';
      stage.innerHTML = `<div class="sc-final">${deco}
        <div class="sc-fhead"><span class="si-kicker">${esc(o.kicker || '')}</span><h2>${esc((o.final && o.final.round) || 'Grand Final')}</h2></div>
        <div class="sc-vs">${sideCard(C, 'w')}<div class="sc-score"><b class="sa">0</b><i>–</i><b class="sb">0</b></div>${sideCard(R, 'l')}</div>
        <div class="sc-games">${games.map((g, i) => `<span class="${g.w > g.l ? 'won' : 'lost'}" style="--i:${i}"><small>G${i + 1}</small>${g.w}–${g.l}${g.ot ? '<em>OT</em>' : ''}</span>`).join('')}</div>
        <div class="sc-point">${o.single ? 'Match point' : 'Championship point'}</div>
      </div>`;
      const sa = stage.querySelector('.sa'), sb = stage.querySelector('.sb'), chips = stage.querySelectorAll('.sc-games span');
      let a = 0, b = 0;
      const step = games.length > 5 ? 430 : 520;
      const bump = (n) => { n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop'); };
      games.forEach((g, i) => later(1100 + i * step, () => { sfx('count'); chips[i].classList.add('on'); if (g.w > g.l) { sa.textContent = ++a; bump(sa); } else { sb.textContent = ++b; bump(sb); } if (i === games.length - 2) stage.querySelector('.sc-point').classList.add('on'); }));
      later(1100 + games.length * step + 200, () => { sfx('impact'); stage.querySelector('.sc-final').classList.add('decided'); });
      await wait(1100 + games.length * step + 2600);
    };
    const sceneMvp = async () => {
      mark('mvp');
      const m = o.mvp;
      let li = 0;
      stage.innerHTML = `<div class="sc-mvp">
        <div class="sc-spot" aria-hidden="true"></div>
        <div class="sc-ghost" aria-hidden="true">${esc(m.name)}</div>
        <div class="sc-mphoto">${m.photo ? `<img src="${esc(m.photo)}" alt="" onerror="this.remove()" />` : ''}<b>${esc(initials(m.name))}</b></div>
        <div class="sc-minfo">
          <span class="si-kicker">${esc(L.mvp || 'Tournament MVP')}</span>
          <h2 class="sc-name sc-mname" aria-label="${esc(m.name)}"><span class="sc-word">${String(m.name).split(' ').map((w) => `<span class="sc-w">${Array.from(w).map((ch) => `<i style="--i:${li++}">${esc(ch)}</i>`).join('')}</span>`).join(' ')}</span></h2>
          <div class="sc-club">${m.badge || ''}<span>${esc(m.flag || '')} ${esc(m.team || '')}</span></div>
          <div class="sc-rec sc-mstats">${(m.stats || []).map(([k, v], i) => `<div style="--i:${i}"><b data-to="${+v || 0}">0</b><small>${esc(k)}</small></div>`).join('')}</div>
        </div></div>`;
      sfx('whoosh');
      later(900, () => countUp(stage, S));
      await wait(6000);
    };
    const sceneGoal = async () => { mark('goal'); await goalScene(stage, o.goal, L, wait, S); };
    const sceneChamp = async () => {
      mark('champ');
      let li = 0;
      const big = (n) => `<span class="sc-word">${String(n).split(' ').map((w) => `<span class="sc-w">${Array.from(w).map((ch) => `<i style="--i:${li++}">${esc(ch)}</i>`).join('')}</span>`).join(' ')}</span>`;
      const medal = mode === 1
        ? `<svg class="sc-medal" viewBox="0 0 200 260" aria-hidden="true"><path d="M70 0 L100 70 L130 0" class="rib"/><circle cx="100" cy="160" r="88" class="m1"/><circle cx="100" cy="160" r="72" class="m2"/><path d="M60 125 L100 205 L140 125" class="mv"/><text x="100" y="172" class="mt">1V1</text></svg>`
        : mode === 2 ? `<svg class="sc-medal" viewBox="0 0 240 260" aria-hidden="true"><path d="M90 0 L120 70 L150 0" class="rib"/><circle cx="92" cy="160" r="70" class="m1 r1"/><circle cx="148" cy="160" r="70" class="m1 r2"/><text x="120" y="172" class="mt">2V2</text></svg>`
        : TROPHY;
      const ps = C.players || [];
      const who = mode === 1 ? `<div class="sc-hero">${face(ps[0])}</div><h1 class="sc-name">${big(ps[0] ? ps[0].name : C.name)}</h1>`
        : mode === 2 ? `<div class="sc-duo"><div class="sc-pl l">${face(ps[0])}<b>${esc((ps[0] || {}).flag || '')} ${esc((ps[0] || {}).name || '')}</b></div><span class="sc-amp">&amp;</span><div class="sc-pl r">${face(ps[1] || ps[0])}<b>${esc((ps[1] || {}).flag || '')} ${esc((ps[1] || {}).name || '')}</b></div><i class="sc-burst" aria-hidden="true"></i></div>`
        : `<div class="sc-crest">${C.badge || ''}</div><h1 class="sc-name sc-tname">${big(C.name)}</h1>
           <div class="sc-trio">${ps.slice(0, 3).map((p, i) => `<div class="sc-pl p${i}">${face(p)}<b>${esc(p.flag || '')} ${esc(p.name)}</b></div>`).join('')}</div>`;
      stage.innerHTML = `<div class="sc-champ">
        <div class="sc-spot" aria-hidden="true"></div>${medal}
        <span class="si-kicker">${esc(o.kicker || '')}</span>
        ${who}
        ${mode === 3 ? '' : `<div class="sc-club">${C.badge || ''}<span>${esc(C.club || '')}</span></div>`}
        <div class="sc-label">${esc(o.label || 'Champions')}</div>
        ${o.line ? `<p class="sc-next">${esc(o.line)}</p>` : ''}${o.next ? `<p class="sc-next">${esc(o.next)}</p>` : ''}
      </div>`;
      later(250, () => sfx('fanfare'));
      later(mode === 3 ? 1150 : mode === 1 ? 1000 : 850, () => confetti(S, cols));
      await wait(o.single ? 60000 : 7500);
    };
    const sceneRoad = async () => {
      mark('road'); sfx('tab');
      const r = o.record || {}, ps = C.players || [];
      const tiles = [['Series', (r.sw || 0) + '–' + (r.sl || 0)], ['Games', (r.gw || 0) + '–' + (r.gl || 0)], ['Goals', ps.reduce((x, p) => x + (p.g || 0), 0)], ['Saves', ps.reduce((x, p) => x + (p.sv || 0), 0)]];
      stage.innerHTML = `<div class="sc-road">
        <h2>Road to the title</h2><p class="sc-sub">${esc(o.title || '')}</p>
        <div class="sc-rec">${tiles.map(([k, v], i) => `<div style="--i:${i}"><b>${esc(v)}</b><small>${k}</small></div>`).join('')}</div>
        <div class="sc-path">${(o.path || []).slice(-8).map((m, i) => `<div class="sc-pm${m.w > m.l ? '' : ' lost'}" style="--i:${i}"><small>${esc(m.round)}</small><b>${esc(m.opp)}</b><span>${m.w}–${m.l}</span></div>`).join('')}</div>
        ${ps.length > 1 ? `<div class="sc-pstats${ps.length > 2 ? ' three' : ''}">${ps.slice(0, 3).map((p) => `<div><b>${esc(p.flag || '')} ${esc(p.name)}</b><span>${p.g || 0} G · ${p.a || 0} A · ${p.sv || 0} Sv</span></div>`).join('')}</div>` : ''}
        ${o.next ? `<p class="sc-next">${esc(o.next)}</p>` : ''}
        <button class="sc-done" type="button">Continue →</button>
      </div>`;
      stage.querySelector('.sc-done').addEventListener('click', finish);
      el.querySelector('.cer-next').textContent = 'Finish ▸';
      later(1100, () => { const bt = stage.querySelector('.sc-done'); if (bt) bt.focus({ preventScroll: true }); });
      await wait(120000);
    };
    (async () => {
      if (o.final && o.runner) { await sceneFinal(); if (S.dead) return; }
      if (o.mvp) { await sceneMvp(); if (S.dead) return; }
      if (o.goal) { await sceneGoal(); if (S.dead) return; }
      await sceneChamp(); if (S.dead) return;
      if (!o.single) { await sceneRoad(); if (S.dead) return; }
      finish();
    })();
  }

  /* ---------- goal of the tournament: replay on the pitch ---------- */
  async function goalScene(stage, g, L, wait, S) {
    const e = g.event;
    stage.innerHTML = `<div class="cer-scene cer-goal-title sc-goal">
        <div class="sc-spot" aria-hidden="true"></div>
        <span class="si-kicker">${esc(L.goal || 'Goal of the tournament')}</span>
        <h2>${esc(e.scorer)}</h2>
        <p>${esc(g.A.name)} vs ${esc(g.B.name)} · ${esc(g.label)}</p>
        <div class="cer-chips"><span>${esc(g.clock)}</span><span>${e.speed} km/h</span>${e.assist ? `<span>Assist: ${esc(e.assist)}</span>` : '<span>Solo goal</span>'}${e.ot ? '<span class="hot">Overtime winner</span>' : ''}</div>
      </div>`;
    await wait(2600);
    if (S.dead) return;
    if (!global.RLPitch) return;
    const before = [e.score[0] - (e.side === 'A' ? 1 : 0), e.score[1] - (e.side === 'B' ? 1 : 0)];
    const atk = e.side === 'A' ? g.A : g.B;
    stage.innerHTML = `<div class="cer-scene cer-replay">
        <div class="cer-rp-top"><span class="cer-rec"><i></i>Replay</span>
          <span class="cer-board"><b style="--c:#1f8bff">${esc(g.A.tag || g.A.name)}</b><em>${before[0]}</em><span>–</span><em>${before[1]}</em><b style="--c:#f2542d">${esc(g.B.tag || g.B.name)}</b></span>
          <span class="cer-rp-clock">${esc(g.clock)}</span></div>
        <div class="cer-pitch ${e.side === 'A' ? 'to-r' : 'to-l'}"><canvas width="1100" height="820" aria-label="Replay of the goal on a top-down pitch"></canvas><span class="cer-slow">Slow motion</span></div>
        <div class="cer-rp-cap"><b>${esc(e.scorer)}</b> <span>${esc(atk.name)} · ${e.speed} km/h${e.assist ? ' · assist ' + esc(e.assist) : ''}</span></div>
      </div>`;
    const cv = stage.querySelector('canvas'), wrap = stage.querySelector('.cer-pitch');
    let pitch;
    try { pitch = new global.RLPitch(cv, g.A, g.B); pitch.theme = g.theme || null; pitch.newGame(); } catch (err) { return; }
    const GT = 8.8; // the goal lands 8.8 s after kickoff: enough for the director to build it up
    const game = { events: [Object.assign({}, e, { t: GT, ot: false })], ot: false };
    let t = 0, last = performance.now(), fired = 0;
    const startedAt = last;
    await new Promise((res) => {
      S.advance = res;
      const frame = (now) => {
        if (S.dead) return res();
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (now - startedAt < 900) { pitch.render(dt, now - startedAt < 450 ? '3' : 'GO!'); S.raf = requestAnimationFrame(frame); return; }
        const slow = !fired && GT - t < 1.4;
        wrap.classList.toggle('slow', slow);
        if (GT - t < 3.2) wrap.classList.add('zoom');
        const rate = fired ? 0.5 : slow ? 0.35 : 1.25;
        const t0 = t; t += dt * rate;
        try {
          pitch.update(t, t - t0, game, false);
          if (!fired && t >= GT) { fired = now; pitch.goal(e.side); stage.querySelector('.cer-replay').classList.add('scored'); const em = stage.querySelectorAll('.cer-board em'); em[0].textContent = e.score[0]; em[1].textContent = e.score[1]; }
          pitch.render(dt, null);
        } catch (err) { return res(); }
        if (fired && now - fired > 3200) return res();
        if (now - startedAt > 26000) return res(); // safety net
        S.raf = requestAnimationFrame(frame);
      };
      S.raf = requestAnimationFrame(frame);
    });
    S.advance = null;
    if (S.raf) cancelAnimationFrame(S.raf);
  }

  global.RLCeremony = { play, stop, hexA };
})(window);
