/* RL Esports Simulator — background music: a chill but hype loop that plays while you browse.
 *
 * Synthesised with the same instruments as the host-city anthems (js/music.js), on its own bus in js/sfx.js
 * (Settings: Background music on/off and volume). It fades out whenever an intro or a ceremony is on screen
 * (and while an anthem plays) so the two never overlap, and picks up where it left off afterwards.
 *
 * The track: about 100 BPM, side-chained chord pads and a plucked arpeggio, a soft kick, clap and swung hats,
 * a sub bass and a hook. It runs in 32-bar cycles (intro, groove, lift with the hook, a break that builds back
 * in) and every cycle moves to a new key, chord progression and hook, so it never sounds like one short loop.
 */
(function (global) {
  'use strict';
  const BPM = 100, S = 16, st = 60 / BPM / 4, L = st * S;
  const SC = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11] };
  // [key (MIDI), mode, progression of scale degrees]
  const CYCLES = [
    [57, 'minor', [0, 5, 2, 6]], [53, 'major', [5, 3, 0, 4]], [55, 'dorian', [0, 3, 0, 6]], [52, 'minor', [0, 6, 5, 4]],
    [58, 'major', [0, 4, 5, 3]], [56, 'minor', [5, 6, 0, 0]], [54, 'lydian', [0, 1, 0, 4]], [59, 'dorian', [0, 6, 3, 4]],
  ];
  const LEVEL = 1.1;
  function seeded(n) { let h = 2166136261 ^ n; return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }

  let cur = null, bar = 0, cycle = Math.floor(Math.random() * CYCLES.length);
  const hookOf = (c) => { const r = seeded(c * 7919 + 1), rh = [[0, 3, 6, 10, 12], [0, 2, 6, 8, 12, 14], [0, 4, 7, 10], [2, 6, 8, 11, 14]][c % 4]; let d = 4 + Math.floor(r() * 3); return [0, 1, 2, 3].map(() => rh.map((k) => { d = Math.max(2, Math.min(9, d + [-2, -1, 1, 2, 0, 3, -3][Math.floor(r() * 7)])); return [k, d]; })); };
  let hook = hookOf(cycle);

  function start() {
    const A = global.RLSfx && global.RLSfx.bgmAudio && global.RLSfx.bgmAudio();
    if (!A || !global.RLMusic || !global.RLMusic.kit) return;
    const { ctx, out, noise } = A;
    // master: fade in, a low-pass that opens in the lift sections; pads and arps duck on every beat (side-chain)
    const bus = ctx.createGain(); bus.gain.setValueAtTime(0.0001, ctx.currentTime); bus.gain.exponentialRampToValueAtTime(LEVEL, ctx.currentTime + 2.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.5; lp.connect(bus); bus.connect(out);
    const pump = ctx.createGain(); pump.connect(lp);
    try {
      const n = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5); }
      const conv = ctx.createConvolver(); conv.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.28; conv.connect(wet); wet.connect(lp);
      pump.connect(conv);
    } catch (e) { /* no convolver */ }
    const I = global.RLMusic.kit(ctx, lp, noise), P = global.RLMusic.kit(ctx, pump, noise);
    let next = ctx.currentTime + 0.1;
    const playBar = (t) => {
      const sec = Math.floor((bar % 32) / 8), bi = bar % 8, [key, mode, prog] = CYCLES[cycle % CYCLES.length], sc = SC[mode];
      const note = (d) => key + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
      const dg = prog[bi % 4], ch = [note(dg), note(dg + 2), note(dg + 4), note(dg + 6)];
      const drums = sec === 1 || sec === 2 || (sec === 3 && bi >= 4);
      // side-chain pump on the beat while the drums play
      for (let q = 0; q < 4; q++) { const at = t + q * 4 * st; pump.gain.setValueAtTime(drums ? 0.35 : 0.85, at); pump.gain.linearRampToValueAtTime(1, at + st * 2.6); }
      lp.frequency.setTargetAtTime(sec === 2 ? 5200 : sec === 0 ? 2200 : sec === 3 && bi < 4 ? 1600 : 3000, t, 1.2);
      // chords and the arpeggio
      P.pad(ch, t, L * 0.98, sec === 0 || sec === 3 ? 2.6 : 1.8, 1400);
      if (sec !== 3 || bi >= 2) { const arp = [0, 2, 1, 3, 2, 1, 3, 2]; for (let k = 0; k < S; k += 2) if (sec || k % 4 === 0) P.pluck(ch[arp[(k / 2) % 8]] + 12, t + k * st, st * 2, sec === 0 ? 0.9 : 0.8); }
      if (sec === 2 && bi % 2 === 1) P.epiano(ch[1] + 12, t + 10 * st, st * 4, 0.35);
      // bass and drums
      if (drums) {
        [0, 7, 10].forEach((k, i) => I.sub808(ch[0] - 12 - (ch[0] - 12 > 50 ? 12 : 0), t + k * st, st * (i ? 2 : 4), 0.55));
        const sw = st * 0.18; // a little swing on the off-beat hats
        for (let k = 0; k < S; k++) {
          const at = t + k * st + (k % 2 ? sw : 0);
          if (k === 0 || k === 8 || (k === 11 && bi % 2)) I.kick(at, 0.75);
          if (k === 4 || k === 12) { I.clap(at, 0.55); I.snap(at, 0.3); }
          if (k % 2 === 0) I.hat(at, sec === 2 ? 0.55 : 0.4, sec === 2 && k % 4 === 2);
          else if (sec === 2) I.shaker(at, 0.6);
        }
        if (bi === 7) for (let k = 12; k < S; k++) I.hat(t + k * st + st / 2, 0.25);
      } else if (sec === 0) for (let k = 2; k < S; k += 4) I.shaker(t + k * st, 0.5);
      // the hook in the lift
      if (sec === 2) hook[bi % 4].forEach(([k, d]) => I.bell(note(d) + 12, t + k * st, st * 2, 0.6));
      // build back in at the end of the break, then a soft crash and the next cycle
      if (sec === 3 && bi === 6) I.riser(t, L * 2, 0.5, key);
      if (sec === 3 && bi === 7) I.revcym(t + L * 0.5, L * 0.5, 0.6);
      if (bar % 32 === 8 || bar % 32 === 16) I.crash(t, 0.35);
      bar++;
      if (bar % 32 === 0) { cycle++; hook = hookOf(cycle); }
    };
    const timer = setInterval(() => {
      if (!cur || cur.timer !== timer) return;
      while (next < ctx.currentTime + 0.5) { try { playBar(next); } catch (e) { /* audio node limits */ } next += L; }
    }, 80);
    cur = { timer, bus, ctx };
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
    if (w && !cur) start();
    else if (!w && cur) stop(document.documentElement.classList.contains('cer-open') || (global.RLMusic && global.RLMusic.playing) ? 0.5 : 1.2);
  }
  setInterval(sync, 300);
  document.addEventListener('visibilitychange', sync);
  global.RLBgm = { sync, start, stop, get playing() { return !!cur; }, get bar() { return bar; }, get cycle() { return cycle; } };
})(window);
