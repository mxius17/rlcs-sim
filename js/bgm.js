/* RL Esports Simulator — background music: a chill but hype loop for wherever you are.
 *
 * Synthesised with the same instruments as the host-city anthems (js/music.js), on its own bus in js/sfx.js
 * (Settings: Background music on/off and volume). It fades out whenever an intro or a ceremony is on screen
 * (and while an anthem plays) so the two never overlap, and picks up where it left off afterwards.
 *
 * Every context has its own track (js/app.js tells it where you are with RLBgm.setContext):
 *   - every Major host city: a laid-back take on the city's own music, with its regional instruments
 *     (a koto arpeggio and shakuhachi hook in Tokyo, oud and qanun in Riyadh, cavaquinho and samba in Rio …),
 *     composed from its own seed, so it is never the intro anthem itself;
 *   - Worlds Week (orchestral and cinematic), the Esports World Cup (desert future-bass with qanun and oud),
 *     the Esports Nations Cup (a world-music groove), the FIFAe World Cup (stadium house with a whistle hook);
 *   - the regional Opens (Europe: French-touch house, North America: synthwave, South America: bossa nova,
 *     MENA: oud over a maqsum beat, Oceania: ukulele and steel pan, Asia-Pacific: lo-fi koto, Sub-Saharan
 *     Africa: amapiano), the 1v1 Opens (a dark, tense duel techno) and the 2v2 Opens (bouncy future bass);
 *   - everywhere else: the house loop.
 * Each track runs in 32-bar cycles (intro, groove, lift with the hook, a break that builds back in); every
 * cycle moves to a new key, progression and hook. Switching context crossfades to the new track, and each
 * track remembers where it was.
 */
(function (global) {
  'use strict';
  const PROG_MAJ = [[0, 5, 3, 4], [0, 4, 5, 3], [5, 3, 0, 4], [0, 3, 0, 4], [0, 1, 0, 4]];
  const PROG_MIN = [[0, 5, 2, 6], [0, 6, 5, 4], [0, 3, 0, 6], [5, 6, 0, 0], [0, 6, 3, 4]];
  const MINORISH = /minor|dorian|harmonic|hijaz|phryg|minpenta|insen|hungarian|doubleharm|bhairav|pelog|blues/;
  // chimes, mallets and synths sit an octave up; plucked and bowed strings play where the chords are
  const UP = ['bell', 'kalimba', 'carillon', 'ranat', 'kulintang', 'bonang', 'gender', 'epiano', 'synth', 'pluck', 'saw', 'steelpan', 'marimba', 'balafon', 'celesta'];
  /* the tracks: tempo, modes, and which instrument plays the pad, arpeggio, hook (and its answer), bass and drums */
  const T = {
    home: { bpm: 100, scales: ['minor', 'dorian', 'major', 'lydian'], keys: [52, 59], arp: 'pluck', hook: 'bell', hook2: 'epiano', bass: 'sub808', bassPat: 'lofi', drums: 'lofi' },
    major: { bpm: 104, scales: ['major', 'mixo', 'dorian'], keys: [53, 60], arp: 'epiano', hook: 'synth', hook2: 'bell', bass: 'synbass', bassPat: 'eighth', drums: 'lofi' },
    worlds: { bpm: 86, scales: ['minor', 'major', 'dorian'], keys: [53, 60], pad: 'strings', arp: 'piano', hook: 'brass', hook2: 'violin', bass: 'bass', bassPat: 'half', drums: 'epic', drumLvl: 0.45, choir: true, pump: false, verb: 3.0 },
    ewc: { bpm: 104, scales: ['hijaz', 'phrygdom', 'harmonic'], keys: [57, 62], arp: 'qanun', hook: 'saw', hook2: 'oud', bass: 'sub808', bassPat: 'trap', drums: 'khaleeji', drumLvl: 0.6 },
    enc: { bpm: 108, scales: ['major', 'mixo', 'penta'], keys: [55, 62], arp: 'kalimba', hook: 'steelpan', hook2: 'marimba', bass: 'ebass', bassPat: 'tresillo', drums: 'highlife', drumLvl: 0.6 },
    fifae: { bpm: 122, scales: ['major', 'dorian'], keys: [55, 62], arp: 'piano', hook: 'whistle', hook2: 'synth', bass: 'synbass', bassPat: 'eighth', drums: 'four', drumLvl: 0.55, crowd: true },
    'region-eu': { bpm: 118, scales: ['minor', 'dorian'], keys: [53, 60], arp: 'epiano', hook: 'synth', hook2: 'bell', bass: 'synbass', bassPat: 'eighth', drums: 'disco', drumLvl: 0.6 },
    'region-na': { bpm: 100, scales: ['minor', 'dorian'], keys: [52, 59], arp: 'synth', hook: 'saw', hook2: 'gtrlead', bass: 'synbass', bassPat: 'eighth', drums: 'synthwave', drumLvl: 0.6, verb: 2.8 },
    'region-sam': { bpm: 96, scales: ['dorian', 'major', 'lydian'], keys: [52, 59], arp: 'guitar', hook: 'flute', hook2: 'piano', bass: 'upright', bassPat: 'tresillo', drums: 'bossa', drumLvl: 0.7 },
    'region-mena': { bpm: 98, scales: ['hijaz', 'phrygdom'], keys: [57, 62], arp: 'oud', hook: 'ney', hook2: 'kamanja', bass: 'sub808', bassPat: 'trap', drums: 'maqsum', drumLvl: 0.6 },
    'region-oce': { bpm: 104, scales: ['major', 'mixo'], keys: [55, 62], arp: 'ukulele', hook: 'steelpan', hook2: 'whistle', bass: 'ebass', bassPat: 'half', drums: 'aussie', drumLvl: 0.6 },
    'region-apac': { bpm: 84, scales: ['penta', 'yo', 'minpenta'], keys: [57, 64], arp: 'koto', hook: 'dizi', hook2: 'bell', bass: 'sub808', bassPat: 'lofi', drums: 'lofi' },
    'region-ssa': { bpm: 112, scales: ['minor', 'dorian'], keys: [53, 60], arp: 'kalimba', hook: 'epiano', hook2: 'sax', bass: 'logdrum', bassPat: 'log', drums: 'amapiano', drumLvl: 0.7 },
    duel: { bpm: 124, scales: ['phrygian', 'minor'], keys: [50, 57], arp: 'synth', hook: 'bell', hook2: 'saw', bass: 'synbass', bassPat: 'pulse', drums: 'techno', drumLvl: 0.4, acid: true },
    doubles: { bpm: 112, scales: ['major', 'lydian'], keys: [55, 62], arp: 'pluck', hook: 'synth', hook2: 'kalimba', bass: 'synbass', bassPat: 'eighth', drums: 'four', drumLvl: 0.5 },
  };
  /* per-track levels (measured offline) so every track plays at about the same loudness */
  const LEVEL = { 'afrobeat': 1.21, 'afroperu': 0.93, 'alpine': 1.49, 'amapiano': 0.76, 'andes': 0.89, 'aotearoa': 0.86, 'ardah': 0.86, 'aussie': 0.89, 'auvergne': 0.88, 'bavaria': 1.47, 'belgium': 1.51, 'benga': 1.13, 'bluegrass': 1.52, 'blues': 1.47, 'bohemia': 1.39, 'bollywood': 0.91, 'boombap': 1.45, 'bossa': 1.73, 'british': 0.93, 'caipira': 0.94, 'candombe': 0.87, 'canton': 0.97, 'celticpunk': 0.92, 'china': 0.94, 'chopin': 0.95, 'country': 1.57, 'cueca': 0.9, 'cumbia': 0.92, 'dance': 1.24, 'danish': 0.97, 'doubles': 1.3, 'duel': 1.12, 'dutch': 1.43, 'edo': 0.76, 'egypt': 0.93, 'enc': 1.37, 'ewc': 0.7, 'fado': 1.69, 'fifae': 1.07, 'finland': 0.93, 'flamenco': 0.97, 'gamelan': 0.88, 'gnawa': 1.12, 'goema': 1.43, 'goral': 0.98, 'greek': 1.0, 'grunge': 0.96, 'hanse': 1.0, 'hardstyle': 0.82, 'highlife': 1.49, 'home': 0.94, 'hungary': 1.48, 'indiefolk': 0.95, 'irish': 0.88, 'italy': 0.97, 'karneval': 1.4, 'khaleeji': 0.88, 'korea': 0.84, 'kulintang': 1.0, 'levant': 0.83, 'lioncity': 0.93, 'maghreb': 0.97, 'major': 1.09, 'malay': 0.96, 'mariachi': 1.58, 'maskandi': 1.06, 'metal': 1.0, 'musette': 1.5, 'naniwa': 0.74, 'norteno': 1.34, 'norway': 0.91, 'opera': 0.98, 'orchestral': 0.93, 'philly': 1.04, 'provence': 0.91, 'pubrock': 1.01, 'quebec': 1.02, 'reggaeton': 0.69, 'region-apac': 0.96, 'region-eu': 1.14, 'region-mena': 0.73, 'region-na': 1.3, 'region-oce': 1.51, 'region-sam': 1.4, 'region-ssa': 0.68, 'rock': 1.08, 'romania': 1.44, 'rumba': 1.03, 'salsa': 1.06, 'samba': 0.88, 'samul': 0.87, 'scottish': 0.83, 'swedish': 0.94, 'synthwave': 1.45, 'taiwan': 0.85, 'tango': 1.59, 'techno': 0.96, 'thai': 0.9, 'trap': 0.72, 'urban': 0.69, 'valencia': 1.05, 'vienna': 0.96, 'vietnam': 0.86, 'western': 0.95, 'worlds': 0.74 };
  function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
  const pickOf = (r, a) => a[Math.floor(r() * a.length) % a.length];

  /** A host city's track: its anthem style's instruments and rhythm, laid back and composed from its own seed. */
  function cityTrack(city, country) {
    const M = global.RLMusic, P = M.compose(city, country, false), sty = P.sty, A = P.arr;
    const leads = sty.leads.filter((l) => l !== 'vuvuzela');
    return {
      bpm: Math.max(70, Math.min(124, Math.round(P.bpm * 0.92))), S: P.S, scales: sty.scales, keys: sty.key, prog: sty.prog,
      arp: A.ost === 'acid' ? 'synth' : A.ost === 'cello' ? A.ci : A.ost, hook: leads[(leads.indexOf(P.lead) + 1) % leads.length] || P.lead, hook2: leads.length > 1 ? P.lead : A.ci !== A.ost ? A.ci : P.lead,
      bass: A.bass, bassPat: A.bassPat === 'none' ? 'long' : A.bassPat, drums: P.drums, drumLvl: 0.5, style: P.style,
      drone: sty.comp.includes('pipedrone') ? 'pipedrone' : sty.comp.includes('tanpura') ? 'tanpura' : null, didge: !!sty.didge,
    };
  }
  /* where are we? context { key: theme key, name: theme name } → a track id and its settings */
  let ctxNow = { id: 'home' };
  function resolve(c) {
    const key = (c && c.key) || '', name = (c && c.name) || '';
    if (/^side-1v1/.test(key)) return { id: 'duel' };
    if (/^side-2v2/.test(key)) return { id: 'doubles' };
    if (key === 'ewc' || key === 'enc' || key === 'fifae') return { id: key };
    if (/worlds/.test(key)) return { id: 'worlds' };
    if (/^region-/.test(key) && T[key]) return { id: key };
    // a host city: the career host themes ("City, Country") or a real Major named after its city
    const TH = global.RL_EVENT_THEMES || {}, cities = global.RLCutscene && global.RLCutscene.cities ? global.RLCutscene.cities() : [];
    let city = /^host-/.test(key) && name ? name.split(',')[0].trim() : null;
    if (!city) city = cities.filter((x) => name.includes(x)).sort((a, b) => b.length - a.length)[0] || null;
    if (city) {
      const hk = 'host-' + city.toLowerCase().replace(/[^a-z]+/g, '-'), hn = (TH[hk] && TH[hk].name) || '';
      let country = hn.split(',').slice(1).join(',').trim();
      if (city === 'Edinburgh') country = 'Scotland';
      return { id: 'city:' + city, city, country };
    }
    if (/major|^paris$|^boston$/i.test(key)) return { id: 'major' };
    return { id: 'home' };
  }
  const trackOf = (r) => (r.city ? cityTrack(r.city, r.country) : T[r.id] || T.home);

  /* ---------- playing a track ---------- */
  const pos = {}; // each track's bar, so it picks up where it left off
  let cur = null;
  function start() {
    const A = global.RLSfx && global.RLSfx.bgmAudio && global.RLSfx.bgmAudio();
    if (!A || !global.RLMusic || !global.RLMusic.kit) return;
    const M = global.RLMusic, { ctx, out, noise } = A, R = ctxNow, tr = trackOf(R);
    const S = tr.S || 16, st = S === 16 ? 60 / tr.bpm / 4 : 60 / tr.bpm / 3, L = st * S;
    const lvl = LEVEL[tr.style || R.id] || LEVEL[R.id] || 1;
    // master: fade in, a low-pass that opens in the lift sections; pads and arps duck on every beat (side-chain)
    const bus = ctx.createGain(); bus.gain.setValueAtTime(0.0001, ctx.currentTime); bus.gain.exponentialRampToValueAtTime(lvl, ctx.currentTime + 2.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.5; lp.connect(bus); bus.connect(out);
    const pump = ctx.createGain(); pump.connect(lp);
    const dg = ctx.createGain(); dg.gain.value = tr.drumLvl || 1; dg.connect(lp);
    try {
      const n = Math.floor(ctx.sampleRate * (tr.verb || 2.2)), ir = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5); }
      const conv = ctx.createConvolver(); conv.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.28; conv.connect(wet); wet.connect(lp);
      pump.connect(conv);
    } catch (e) { /* no convolver */ }
    const I = M.kit(ctx, lp, noise), Pk = M.kit(ctx, pump, noise), D = M.kit(ctx, dg, noise);
    const id = R.id, st0 = pos[id] || { bar: 0 };
    pos[id] = st0;
    // a cycle: key, mode, progression and hook, all from the track's seed and the cycle number
    const cycleOf = (cy) => {
      const r = seeded(id + '|bgm|' + cy), mode = pickOf(r, tr.scales), sc = M.SC[mode];
      const key = tr.keys[0] + Math.floor(r() * (tr.keys[1] - tr.keys[0] + 1));
      const prog = tr.prog === 'static' ? [0, 0, pickOf(r, [0, 6, 1]), 0] : pickOf(r, MINORISH.test(mode) ? PROG_MIN : PROG_MAJ);
      const RH = S === 16 ? [[0, 3, 6, 10, 12], [0, 2, 6, 8, 12, 14], [0, 4, 7, 10], [2, 6, 8, 11, 14], [0, 6, 8, 12]] : [[0, 3, 6, 9], [0, 2, 3, 6, 9], [0, 4, 6], [2, 3, 6, 8, 9]];
      const rh = pickOf(r, RH);
      let d = 4 + Math.floor(r() * 3);
      const hook = [0, 1, 2, 3].map(() => rh.map((k) => { d = Math.max(2, Math.min(9, d + pickOf(r, [-2, -1, 1, 2, 0, 3, -3]))); return [k, d]; }));
      const note = (x) => key + sc[((x % 7) + 7) % 7] + 12 * Math.floor(x / 7);
      return { key, prog, hook, note };
    };
    let cy = cycleOf(Math.floor(st0.bar / 32));
    const arpUp = UP.includes(tr.arp) ? 12 : 0, hookUp = UP.includes(tr.hook) ? 12 : 0, hook2Up = UP.includes(tr.hook2) ? 12 : 0;
    let next = ctx.currentTime + 0.1;
    const playBar = (t) => {
      const bar = st0.bar, sec = Math.floor((bar % 32) / 8), bi = bar % 8;
      if (bar % 32 === 0) cy = cycleOf(bar / 32);
      const { note, prog, hook, key } = cy, dgg = prog[bi % 4];
      const ch = [note(dgg), note(dgg + 2), note(dgg + 4), note(dgg + 6)];
      const drums = sec === 1 || sec === 2 || (sec === 3 && bi >= 4);
      const q = S / 4;
      if (tr.pump !== false) for (let b = 0; b < 4; b++) { const at = t + b * q * st; pump.gain.setValueAtTime(drums ? 0.4 : 0.85, at); pump.gain.linearRampToValueAtTime(1, at + st * q * 0.65); }
      lp.frequency.setTargetAtTime(sec === 2 ? 5200 : sec === 0 ? 2200 : sec === 3 && bi < 4 ? 1600 : 3000, t, 1.2);
      // pads (and the style's drone), then the arpeggio on the track's own instrument
      Pk[tr.pad || 'pad'](ch.slice(0, tr.pad === 'strings' ? 3 : 4), t, L * 0.98, sec === 0 || sec === 3 ? 2.4 : 1.7, 1400);
      if (tr.choir && sec === 2) Pk.choir(ch.slice(0, 3).map((m) => m + 12), t, L, 1);
      if (tr.drone === 'pipedrone' && bi % 2 === 0) Pk.pipedrone(key, t, L * 2, 0.7);
      if (tr.drone === 'tanpura') Pk.tanpura(key, t, L, 0.8);
      if (tr.didge && bi % 2 === 0) Pk.didge(key - 24, t, L * 2, 0.6);
      if (tr.acid && sec !== 0) { for (let k = 0; k < S; k++) if ((k * 5) % 7 !== 3) Pk.acid(ch[0] - 12 + [0, 12, 0, 7, 0, 12, 3, 0][k % 8], t + k * st, st * 0.9, 0.5); }
      if (sec !== 3 || bi >= 2) { const arp = [0, 2, 1, 3, 2, 1, 3, 2]; for (let k = 0; k < S; k += 2) if (sec || k % q === 0) Pk[tr.arp](ch[arp[(k / 2) % 8]] + arpUp, t + k * st, st * 2, sec === 0 ? 0.8 : 0.7); }
      // bass and drums
      if (drums) {
        if (tr.bassPat === 'lofi') [0, 7, 10].forEach((k, i) => I.sub808(ch[0] - 12 - (ch[0] - 12 > 50 ? 12 : 0), t + k * st, st * (i ? 2 : 4), 0.55));
        else M.BASS[tr.bassPat](I, tr.bass, ch[0], t, L, st, S);
        if (tr.drums === 'lofi') {
          const sw = st * 0.18;
          for (let k = 0; k < S; k++) {
            const at = t + k * st + (k % 2 ? sw : 0);
            if (k === 0 || k === S / 2 || (k === S - 5 && bi % 2)) D.kick(at, 0.75);
            if (k === q || k === 3 * q) { D.clap(at, 0.55); D.snap(at, 0.3); }
            if (k % 2 === 0) D.hat(at, sec === 2 ? 0.55 : 0.4, sec === 2 && k % 4 === 2);
            else if (sec === 2) D.shaker(at, 0.6);
          }
        } else for (let k = 0; k < S; k++) M.DRUMS[tr.drums](D, k, t + k * st, S, bar, (bar % 8), key, st);
        if (tr.crowd && sec === 2 && bi % 4 === 0) I.revcym(t, L * 0.9, 0.4); // the stadium swell
      } else if (sec === 0) for (let k = 2; k < S; k += 4) I.shaker(t + k * st, 0.5);
      // the hook in the lift (answered by the second voice), and a taste of it at the end of the groove
      if (sec === 2) { const h2 = bi >= 4, inst = h2 ? tr.hook2 : tr.hook; hook[bi % 4].forEach(([k, d]) => Pk[inst](note(d) + (h2 ? hook2Up : hookUp), t + k * st, st * 2, 0.7)); }
      if (sec === 1 && bi >= 6) hook[bi % 4].slice(0, 3).forEach(([k, d]) => Pk[tr.hook2](note(d) + hook2Up, t + k * st, st * 2, 0.5));
      if (sec === 3 && bi === 6) I.riser(t, L * 2, 0.45, key);
      if (sec === 3 && bi === 7) I.revcym(t + L * 0.5, L * 0.5, 0.5);
      if (bar % 32 === 8 || bar % 32 === 16) I.crash(t, 0.3);
      st0.bar++;
    };
    const timer = setInterval(() => {
      if (!cur || cur.timer !== timer) return;
      while (next < ctx.currentTime + 0.5) { try { playBar(next); } catch (e) { if (global.__bgmErr) global.__bgmErr.push(String((e && e.stack) || e)); st0.bar++; } next += L; }
    }, 80);
    cur = { timer, bus, ctx, id };
  }
  function stop(fade) {
    if (!cur) return;
    const { timer, bus, ctx } = cur; cur = null;
    clearInterval(timer);
    const f = fade == null ? 1.2 : fade, now = ctx.currentTime;
    try { bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now); bus.gain.exponentialRampToValueAtTime(0.0001, now + f); } catch (e) { /* closed */ }
    setTimeout(() => { try { bus.disconnect(); } catch (e) { /* gone */ } }, f * 1000 + 400);
  }
  /** Should the background music play right now? Not during intros, ceremonies or anthems, nor in a hidden tab. */
  function wanted() {
    if (document.hidden) return false;
    if (document.documentElement.classList.contains('cer-open')) return false; // intros and ceremonies
    if (global.RLMusic && global.RLMusic.playing) return false;
    return !!(global.RLSfx && global.RLSfx.on && global.RLSfx.bgm);
  }
  function sync() {
    const w = wanted();
    if (w && cur && cur.id !== ctxNow.id) stop(1.5); // a new place: crossfade to its track
    if (w && !cur) start();
    else if (!w && cur) stop(document.documentElement.classList.contains('cer-open') || (global.RLMusic && global.RLMusic.playing) ? 0.5 : 1.2);
  }
  /** Where the player is: { key: event theme key, name: its name } (js/app.js calls this on every render). */
  function setContext(c) { const r = resolve(c); if (r.id !== ctxNow.id) { ctxNow = r; sync(); } }
  setInterval(sync, 300);
  document.addEventListener('visibilitychange', sync);
  global.RLBgm = { sync, start, stop, setContext, resolve, trackOf, TRACKS: T, LEVEL, _pos: pos, get context() { return ctxNow.id; }, get playing() { return !!cur; }, get track() { return cur && cur.id; } };
})(window);
