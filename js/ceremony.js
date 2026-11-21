/* RL Esports Simulator — end-of-tournament ceremony.
 *
 * Three scenes play full screen in the event's colours once a tournament is decided:
 *   1. the tournament MVP,
 *   2. a replay of the goal of the tournament on the top-down pitch (js/pitch.js),
 *   3. the champions, with confetti.
 * app.js picks the MVP and the goal and passes everything in; this file only stages it.
 * Next skips a scene, Skip ends the ceremony; Space / → and Esc do the same.
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
    cur.dead = true;
    cur.timers.forEach(clearTimeout);
    if (cur.raf) cancelAnimationFrame(cur.raf);
    document.removeEventListener('keydown', cur.onKey, true);
    if (cur.el && cur.el.parentNode) cur.el.parentNode.removeChild(cur.el);
    document.documentElement.classList.remove('cer-open');
    cur = null;
  }

  /** o: { title, kicker, vars, mvp, goal, champ, labels } — see app.js openChampion() */
  function play(o, done) {
    stop();
    const el = document.createElement('div');
    el.className = 'cer';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Tournament ceremony');
    el.setAttribute('style', o.vars || '');
    const L = o.labels || {};
    const steps = [['mvp', L.mvp || 'MVP'], ['goal', L.goal || 'Goal of the tournament'], ['champ', L.champ || 'Champions']].filter(([k]) => o[k]);
    el.innerHTML = `<div class="cer-bg" aria-hidden="true"></div><div class="cer-stage"></div>
      <div class="cer-ui"><div class="cer-steps">${steps.map(([k, l]) => `<span data-k="${k}">${esc(l)}</span>`).join('')}</div>
        <div class="cer-btns"><button class="cer-next" type="button">Next ▸</button><button class="cer-skip" type="button">Skip ceremony</button></div></div>`;
    document.body.appendChild(el);
    document.documentElement.classList.add('cer-open');
    const S = (cur = { el, timers: [], dead: false, raf: 0, advance: null });
    const stage = el.querySelector('.cer-stage');
    const finish = () => { if (S.dead) return; stop(); if (done) done(); };
    const next = () => { if (S.advance) { const f = S.advance; S.advance = null; f(); } };
    el.querySelector('.cer-next').addEventListener('click', next);
    el.querySelector('.cer-skip').addEventListener('click', finish);
    S.onKey = (ev) => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(); }
      else if (ev.key === ' ' || ev.key === 'ArrowRight' || ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); next(); }
    };
    document.addEventListener('keydown', S.onKey, true);
    /** Resolves after ms, or as soon as the viewer presses Next. */
    const wait = (ms) => new Promise((res) => { const t = setTimeout(() => { S.advance = null; res(); }, ms); S.timers.push(t); S.advance = () => { clearTimeout(t); res(); }; });
    const mark = (k) => el.querySelectorAll('.cer-steps span').forEach((s) => { s.classList.toggle('on', s.dataset.k === k); if (s.dataset.k === k) s.classList.add('seen'); });
    const scale = reduce() ? 0.6 : 1;

    (async () => {
      // a short opener while the photos load
      stage.innerHTML = `<div class="cer-scene cer-open-card"><small>${esc(o.kicker || 'Tournament complete')}</small><h1>${esc(o.title || '')}</h1></div>`;
      await wait(1500 * scale); if (S.dead) return;
      if (o.mvp) { mark('mvp'); await sceneMvp(stage, o.mvp, L, wait, S, scale); if (S.dead) return; }
      if (o.goal) { mark('goal'); await sceneGoal(stage, o.goal, L, wait, S, el); if (S.dead) return; }
      if (o.champ) { mark('champ'); await sceneChamp(stage, o.champ, L, S); if (S.dead) return; }
      finish();
    })();
  }

  function photoHtml(p, cls) {
    return `<div class="${cls}">${p.photo ? `<img src="${esc(p.photo)}" alt="" onerror="this.remove()">` : ''}<span>${esc(initials(p.name))}</span></div>`;
  }
  function countUp(root, S) {
    root.querySelectorAll('[data-to]').forEach((n) => {
      const to = +n.dataset.to, t0 = performance.now(), dur = 900;
      const tick = (now) => { if (S.dead) return; const f = Math.min(1, (now - t0) / dur); n.textContent = Math.round(to * (1 - Math.pow(1 - f, 3))); if (f < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  }

  /* ---------- 1. MVP ---------- */
  async function sceneMvp(stage, m, L, wait, S, scale) {
    const letters = esc(m.name).split('').map((c, i) => `<i style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</i>`).join('');
    stage.innerHTML = `<div class="cer-scene cer-mvp" style="--tc:${esc(m.color || '#1f8bff')}">
        <div class="cer-sweep" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="cer-ghost" aria-hidden="true">${esc(m.name)}</div>
        ${photoHtml(m, 'cer-photo')}
        <div class="cer-mvp-info">
          <span class="cer-kicker">${esc(L.mvp || 'Tournament MVP')}</span>
          <h2 class="cer-name" aria-label="${esc(m.name)}">${letters}</h2>
          <div class="cer-team">${m.badge || ''}<span>${m.flag || ''} ${esc(m.team)}</span></div>
          <div class="cer-stats">${m.stats.map(([l, v]) => `<span><b data-to="${+v || 0}">0</b><small>${esc(l)}</small></span>`).join('')}</div>
        </div></div>`;
    S.timers.push(setTimeout(() => { if (!S.dead) countUp(stage, S); }, 1100 * scale));
    await wait(6200 * scale);
  }

  /* ---------- 2. goal of the tournament: replay on the pitch ---------- */
  async function sceneGoal(stage, g, L, wait, S, el) {
    const e = g.event;
    stage.innerHTML = `<div class="cer-scene cer-goal-title">
        <span class="cer-kicker">${esc(L.goal || 'Goal of the tournament')}</span>
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

  /* ---------- 3. champions ---------- */
  function sceneChamp(stage, c, L, S) {
    const word = esc(L.champ || 'Champions').split('').map((ch, i) => `<i style="--i:${i}">${ch}</i>`).join('');
    stage.innerHTML = `<div class="cer-scene cer-champ" style="--tc:${esc(c.color || '#d4a017')}">
        <canvas class="cer-confetti" aria-hidden="true"></canvas>
        <div class="cer-rays" aria-hidden="true"></div>
        <div class="cer-cup" aria-hidden="true">🏆</div>
        <div class="cer-badge">${c.badge || ''}</div>
        <h2 class="cer-word" aria-label="${esc(L.champ || 'Champions')}">${word}</h2>
        <div class="cer-tname">${esc(c.name)}</div>
        <p class="cer-final">${esc(c.line || '')}</p>
        <div class="cer-roster">${(c.players || []).map((p, i) => `<div class="cer-pl" style="--i:${i}">${photoHtml(p, 'cer-pph')}<b>${p.flag || ''} ${esc(p.name)}</b></div>`).join('')}</div>
        <button class="btn primary cer-continue" type="button">Continue →</button>
      </div>`;
    confetti(stage.querySelector('.cer-confetti'), [c.color || '#d4a017', '#ffffff', c.color2 || '#d4a017', '#ffd34d'], S);
    return new Promise((res) => {
      S.advance = res;
      stage.querySelector('.cer-continue').addEventListener('click', () => res());
      S.timers.push(setTimeout(() => { const b = stage.querySelector('.cer-continue'); if (b && !S.dead) b.focus({ preventScroll: true }); }, 2600));
    });
  }

  function confetti(cv, colors, S) {
    if (!cv || reduce()) return;
    const ctx = cv.getContext('2d');
    const fit = () => { cv.width = cv.clientWidth; cv.height = cv.clientHeight; };
    fit();
    const N = Math.min(220, Math.round(cv.width / 6));
    const bits = [];
    const spawn = (burst) => {
      const x = burst ? cv.width * (0.5 + (Math.random() - 0.5) * 0.3) : Math.random() * cv.width;
      bits.push({ x, y: burst ? cv.height * 0.42 : -20, vx: burst ? (Math.random() - 0.5) * 900 : (Math.random() - 0.5) * 60, vy: burst ? -300 - Math.random() * 700 : 60 + Math.random() * 120,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 10, w: 6 + Math.random() * 7, h: 9 + Math.random() * 10, c: colors[Math.floor(Math.random() * colors.length)] });
    };
    let last = performance.now(), age = 0;
    const frame = (now) => {
      if (S.dead || !cv.isConnected) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; age += dt;
      if (cv.width !== cv.clientWidth) fit();
      if (age < 0.25) for (let i = 0; i < N / 6; i++) spawn(true);
      else if (bits.length < N && age < 12) spawn(false);
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.vy += 520 * dt; b.vx *= 1 - 1.2 * dt; b.vy = Math.min(b.vy, 260 + b.w * 8);
        b.x += (b.vx + Math.sin(age * 3 + i) * 30) * dt; b.y += b.vy * dt; b.r += b.vr * dt;
        if (b.y > cv.height + 30) { bits.splice(i, 1); continue; }
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.scale(1, Math.abs(Math.cos(b.r * 1.7)) + 0.15);
        ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  global.RLCeremony = { play, stop, hexA };
})(window);
