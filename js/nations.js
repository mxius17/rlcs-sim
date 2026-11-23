/* RL Esports Simulator — national-team intros (career off-season).
 *
 *   Esports Nations Cup: a globe of orbit rings with every nation's flag circling it, the title, then the
 *     favourites and a wall of all the other flags.
 *   FIFAe World Cup: a floodlit football pitch, the nations' flags marching out like a team walkout, the title,
 *     then the two groups of eight.
 * The hosts rotate every year: the intro names the host city and plays its anthem (js/music.js).
 * o = { kind: 'enc'|'fifae', palette:{a,b,c}, city, country, hostFlag, kicker, title, nations:[{flag,name,ovr,players,mine}], groups:[[...],[...]], holder, note }
 */
(function (global) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let cur = null;
  function stop() {
    if (!cur) return;
    cur.dead = true; cur.timers.forEach(clearTimeout);
    document.removeEventListener('keydown', cur.onKey, true);
    if (cur.el.parentNode) cur.el.parentNode.removeChild(cur.el);
    document.documentElement.classList.remove('cer-open');
    cur = null;
    if (global.RLMusic) global.RLMusic.stop();
  }
  const TAG = { enc: (n) => `${n} nations. Three players each. One flag on top.`, fifae: () => 'Sixteen nations. Two groups. One world cup.' };
  function play(o, done) {
    stop();
    const fifa = o.kind === 'fifae';
    const pal = o.palette || { a: '#2148FF', b: '#080C26', c: '#F2C14E' };
    const N = o.nations || [];
    const el = document.createElement('div');
    el.className = 'ni ni-' + (fifa ? 'fifae' : 'enc');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', (o.title || 'National teams') + ' intro');
    el.style.cssText = `--a:${pal.a};--b:${pal.b};--c:${pal.c}`;
    let li = 0;
    const title = String(o.title || '').split(' ').map((w) => `<span class="ni-w">${Array.from(w).map((ch) => `<i style="--i:${li++}">${esc(ch)}</i>`).join('')}</span>`).join(' ');
    const art = fifa
      ? `<div class="ni-lights" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
         <svg class="ni-pitch" viewBox="0 0 1000 600" aria-hidden="true"><rect x="20" y="20" width="960" height="560" rx="6"/><line x1="500" y1="20" x2="500" y2="580"/><circle cx="500" cy="300" r="90"/><circle cx="500" cy="300" r="5" class="dot"/>
           <rect x="20" y="170" width="150" height="260"/><rect x="830" y="170" width="150" height="260"/><rect x="20" y="240" width="55" height="120"/><rect x="925" y="240" width="55" height="120"/></svg>
         <div class="ni-march" aria-hidden="true">${N.slice(0, 16).map((n, i) => `<span style="--i:${i}">${esc(n.flag)}</span>`).join('')}</div>`
      : `<div class="ni-globe" aria-hidden="true"><i class="core"></i>${[0, 1, 2].map((r) => `<div class="ni-orbit o${r}">${N.filter((_, i) => i % 3 === r).slice(0, 16).map((n, k, arr) => `<span style="--k:${k};--n:${arr.length}">${esc(n.flag)}</span>`).join('')}</div>`).join('')}</div>`;
    const card = (n, k) => `<div class="ni-card${n.mine ? ' mine' : ''}" style="--k:${k}"><span class="ni-flag">${esc(n.flag)}</span><div><b>${esc(n.name)}</b><small>${esc(n.players.join(' · '))}</small></div><span class="ni-ovr">${n.ovr}</span></div>`;
    const stage = fifa && o.groups
      ? `<div class="ni-groups">${o.groups.map((g, gi) => `<div class="ni-group"><span class="ni-gh">Group ${'AB'[gi]}</span>${g.map((n, k) => `<div class="ni-row${n.mine ? ' mine' : ''}" style="--k:${k + gi * 8}"><span>${esc(n.flag)}</span><b>${esc(n.name)}</b><i>${n.ovr}</i></div>`).join('')}</div>`).join('')}</div>`
      : `<span class="ni-sh">The favourites</span><div class="ni-favs">${N.slice(0, 4).map(card).join('')}</div>
         <div class="ni-wall">${N.slice(4).map((n, k) => `<span class="${n.mine ? 'mine' : ''}" title="${esc(n.name)}" style="--k:${k}">${esc(n.flag)}</span>`).join('')}</div>`;
    el.innerHTML = `<div class="ni-bg" aria-hidden="true"></div>${art}
      <div class="ni-text">
        <span class="ni-chip">${fifa ? 'National teams · FIFAe' : 'National teams · ENC'}</span>
        <span class="ni-kicker">${esc(o.kicker || '')}</span>
        <h1 class="ni-title" aria-label="${esc(o.title || '')}">${title}</h1>
        <span class="ni-tag">${esc((TAG[o.kind] || TAG.enc)(N.length))}</span>
        ${o.city ? `<span class="ni-holder ni-host">Hosted in <b>${esc(o.hostFlag || '')} ${esc(o.city)}</b></span>` : ''}
        ${o.holder ? `<span class="ni-holder">🏆 Holders: <b>${esc(o.holder)}</b></span>` : ''}
      </div>
      <div class="ni-stage">${stage}${o.note ? `<p class="ni-note">${esc(o.note)}</p>` : ''}</div>
      <div class="cut-ui"><button class="cut-skip" type="button">Skip intro</button><button class="cut-go" type="button">Let’s go →</button></div>`;
    document.body.appendChild(el);
    document.documentElement.classList.add('cer-open');
    const S = (cur = { el, timers: [], dead: false });
    const finish = () => { if (S.dead) return; stop(); if (done) done(); };
    el.querySelector('.cut-skip').addEventListener('click', finish);
    el.querySelector('.cut-go').addEventListener('click', finish);
    S.onKey = (ev) => { if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); finish(); } };
    document.addEventListener('keydown', S.onKey, true);
    const sfx = (n) => global.RLSfx && global.RLSfx.play(n);
    sfx('whoosh');
    if (o.city && global.RLMusic) global.RLMusic.start({ city: o.city, country: o.country || '' }); // the host city's anthem
    S.timers.push(setTimeout(() => { if (!S.dead) sfx('impact'); }, 1050));
    S.timers.push(setTimeout(() => { if (!S.dead) sfx('whoosh'); }, 4550));
    S.timers.push(setTimeout(() => { if (!S.dead) el.classList.add('beat2'); }, 4600));
    S.timers.push(setTimeout(() => { const g = el.querySelector('.cut-go'); if (g && !S.dead) { g.classList.add('on'); g.focus({ preventScroll: true }); } }, 6600));
  }
  global.RLNationsIntro = { play, stop };
})(window);
