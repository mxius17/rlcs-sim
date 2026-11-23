/* RL Esports Simulator — themed background music for the Major, EWC and Worlds Week intros.
 *
 * Synthesised live with the Web Audio API (no audio files), on the music bus of js/sfx.js. Each intro atmosphere
 * has its own style; the host city's name seeds the melody, tempo and key, so every city sounds a little different:
 *   neon synthwave · aurora ambient bells · desert oud and darbuka · golden-hour guitar · fog piano in the rain ·
 *   tropical bossa nova · fireworks dance · storm taiko · blossom koto · snow celesta and sleigh bells ·
 *   anthem (Worlds Week) brass and big drums.
 * RLMusic.start(theme, seed) fades in and loops a four-bar progression; RLMusic.stop() fades out.
 */
(function (global) {
  'use strict';
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
    hijaz: [0, 1, 4, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }

  /* ---------- instruments: each schedules sound at absolute time t ---------- */
  function kit(ctx, bus, noiseBuf) {
    const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    function osc(type, f, t, a, d, peak, o) {
      o = o || {};
      const s = ctx.createOscillator(), g = ctx.createGain();
      s.type = type; s.frequency.setValueAtTime(f, t);
      if (o.bend) s.frequency.exponentialRampToValueAtTime(f * o.bend, t + (o.bendT || 0.08));
      if (o.detune) s.detune.value = o.detune;
      let n = s;
      if (o.lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, t); if (o.lp2) fl.frequency.exponentialRampToValueAtTime(o.lp2, t + a + d); fl.Q.value = o.q || 0.7; s.connect(fl); n = fl; }
      env(g, t, peak, a, d); n.connect(g); g.connect(bus);
      s.start(t); s.stop(t + a + d + 0.05);
    }
    function noise(t, a, d, peak, type, f, f2, q) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.setValueAtTime(f || 1000, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + d); fl.Q.value = q || 1;
      const g = ctx.createGain(); env(g, t, peak, a, d);
      s.connect(fl); fl.connect(g); g.connect(bus);
      s.start(t, Math.random() * 0.5); s.stop(t + a + d + 0.05);
    }
    return {
      pad: (notes, t, dur, peak, lp) => notes.forEach((m) => [-7, 7].forEach((dt) => osc('sawtooth', hz(m), t, Math.min(0.6, dur * 0.3), dur, (peak || 0.05) / notes.length, { detune: dt, lp: lp || 1100 }))),
      warm: (notes, t, dur, peak) => notes.forEach((m) => osc('triangle', hz(m), t, Math.min(0.5, dur * 0.3), dur, (peak || 0.08) / notes.length)),
      pluck: (m, t, peak, d) => osc('triangle', hz(m), t, 0.004, d || 0.45, peak || 0.1, { lp: 4000, lp2: 700 }),
      oud: (m, t, peak) => { osc('sawtooth', hz(m) * 1.02, t, 0.003, 0.32, peak || 0.07, { bend: 1 / 1.02, bendT: 0.04, lp: 2200, lp2: 500 }); },
      koto: (m, t, peak) => { osc('triangle', hz(m), t, 0.002, 0.6, peak || 0.1, { lp: 5000, lp2: 900 }); osc('sine', hz(m) * 2, t, 0.002, 0.25, (peak || 0.1) * 0.3); },
      bell: (m, t, peak, d) => { osc('sine', hz(m), t, 0.003, d || 1.4, peak || 0.07); osc('sine', hz(m) * 2.76, t, 0.003, (d || 1.4) * 0.4, (peak || 0.07) * 0.35); },
      piano: (m, t, peak) => { osc('triangle', hz(m), t, 0.004, 1.3, peak || 0.09, { lp: 2600, lp2: 900 }); osc('sine', hz(m) * 2, t, 0.004, 0.6, (peak || 0.09) * 0.25); },
      bass: (m, t, dur, peak) => osc('triangle', hz(m), t, 0.01, dur, peak || 0.16, { lp: 700 }),
      synbass: (m, t, dur, peak) => osc('sawtooth', hz(m), t, 0.005, dur, peak || 0.08, { lp: 900, lp2: 250, q: 4 }),
      lead: (m, t, dur, peak) => osc('square', hz(m), t, 0.01, dur, peak || 0.04, { lp: 2400, lp2: 1200 }),
      brass: (notes, t, dur, peak) => notes.forEach((m) => osc('sawtooth', hz(m), t, 0.06, dur, (peak || 0.07) / notes.length, { lp: 700, lp2: 2600 })),
      kick: (t, peak) => { osc('sine', 120, t, 0.002, 0.28, peak || 0.5, { bend: 0.35, bendT: 0.12 }); },
      snare: (t, peak) => { noise(t, 0.002, 0.16, peak || 0.18, 'bandpass', 1800, 1200, 0.8); osc('triangle', 190, t, 0.002, 0.08, (peak || 0.18) * 0.5); },
      clap: (t, peak) => [0, 0.012, 0.024].forEach((o, i) => noise(t + o, 0.001, i === 2 ? 0.14 : 0.02, peak || 0.16, 'bandpass', 1500, 1300, 1.2)),
      hat: (t, peak, open) => noise(t, 0.001, open ? 0.18 : 0.04, peak || 0.05, 'highpass', 8000, 0, 0.7),
      shaker: (t, peak) => noise(t, 0.008, 0.05, peak || 0.035, 'highpass', 6000, 0, 0.6),
      rim: (t, peak) => { osc('triangle', 1700, t, 0.001, 0.03, peak || 0.07); noise(t, 0.001, 0.02, (peak || 0.07) * 0.6, 'bandpass', 3000, 0, 3); },
      tom: (t, f, peak) => osc('sine', f, t, 0.002, 0.45, peak || 0.35, { bend: 0.55, bendT: 0.25 }),
      doum: (t, peak) => osc('sine', 95, t, 0.002, 0.35, peak || 0.35, { bend: 0.7, bendT: 0.2 }),
      tek: (t, peak) => { noise(t, 0.001, 0.05, peak || 0.09, 'bandpass', 3200, 0, 2); osc('sine', 620, t, 0.001, 0.04, (peak || 0.09) * 0.6); },
      jingle: (t, peak) => [0, 0.015, 0.03].forEach((o) => noise(t + o, 0.001, 0.06, (peak || 0.03), 'bandpass', 9000, 0, 6)),
      thunder: (t, peak) => noise(t, 0.3, 2.4, peak || 0.12, 'lowpass', 400, 80, 0.5),
      /** continuous rain: returns the source so it can be stopped */
      rain: (t, peak) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 2500; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak || 0.03, t + 1.2); s.connect(fl); fl.connect(g); g.connect(bus); s.start(t); return s; },
    };
  }

  /* ---------- the styles ----------
     bar(I, b, t, s): schedule bar number b starting at time t. s = { step, chord(octave) → midi[], root(octave),
     deg(d, octave) → midi in the scale relative to the bar's chord, mel: [16] melody degrees or null, rnd } */
  const THEMES = {
    neon: { gain: 0.8, bpm: 108, root: 57, scale: 'minor', prog: [0, 5, 3, 4], bar(I, b, t, s) {
      s.each(16, (k, at) => { if (k % 4 === 0) I.kick(at, 0.45); if (k === 4 || k === 12) { I.snare(at, 0.2); I.clap(at, 0.08); } if (k % 2 === 1) I.hat(at, 0.035); });
      s.each(8, (k, at) => I.synbass(s.root(-1) + (k % 2 ? 12 : 0), at, s.step * 1.6, 0.09));
      const ch = s.chord(1); s.each(16, (k, at) => I.lead(ch[[0, 1, 2, 1][k % 4]] + (k >= 8 ? 12 : 0), at, s.step * 0.9, 0.022));
      I.pad(s.chord(0), t, s.bar, 0.05, 1400);
      s.melody((m, at, len) => I.lead(m + 12, at, len, 0.03));
    } },
    aurora: { gain: 2.3, bpm: 64, root: 62, scale: 'lydian', prog: [0, 4, 5, 1], bar(I, b, t, s) {
      I.pad(s.chord(0), t, s.bar * 1.05, 0.06, 900);
      I.bass(s.root(-1), t, s.bar, 0.08);
      s.melody((m, at) => I.bell(m + 12, at, 0.05, 2.2), 0.45);
      if (s.rnd() < 0.7) I.bell(s.chord(2)[Math.floor(s.rnd() * 3)], t + s.step * (6 + Math.floor(s.rnd() * 8)), 0.025, 2.5);
    } },
    desert: { gain: 1.2, bpm: 100, root: 62, scale: 'hijaz', prog: [0, 0, 6, 0], bar(I, b, t, s) {
      s.each(16, (k, at) => { if (k === 0 || k === 6 || k === 10) I.doum(at, 0.32); if (k === 4 || k === 12 || k === 14) I.tek(at, 0.1); if (k === 2 || k === 8) I.tek(at, 0.04); });
      I.warm([s.root(-1), s.root(-1) + 7], t, s.bar, 0.08);
      s.melody((m, at) => { I.oud(m, at, 0.08); if (s.rnd() < 0.25) I.oud(m + 1, at - 0.04, 0.03); }, 0.7);
    } },
    golden: { gain: 1.3, bpm: 92, root: 60, scale: 'major', prog: [0, 5, 3, 4], bar(I, b, t, s) {
      const ch = s.chord(0); s.each(8, (k, at) => I.pluck([ch[0], ch[2], ch[1] + 12, ch[2]][k % 4], at, 0.08, 0.6));
      s.each(16, (k, at) => { if (k === 0 || k === 8) I.kick(at, 0.25); if (k === 4 || k === 12) I.rim(at, 0.06); I.shaker(at, k % 2 ? 0.02 : 0.03); });
      I.bass(s.root(-1), t, s.step * 7, 0.12); I.bass(s.root(-1) + 7, t + s.step * 8, s.step * 7, 0.1);
      I.pad(s.chord(0), t, s.bar, 0.035, 900);
      s.melody((m, at) => I.pluck(m + 12, at, 0.07, 0.7), 0.5);
    } },
    fog: { gain: 1.8, bpm: 72, root: 57, scale: 'minor', prog: [0, 5, 2, 6], rain: true, bar(I, b, t, s) {
      const ch = s.chord(0); I.piano(ch[0] - 12, t, 0.08); ch.forEach((m, i) => I.piano(m, t + 0.02 * i, 0.05));
      s.melody((m, at) => I.piano(m + 12, at, 0.07), 0.4);
      I.pad(s.chord(0), t, s.bar, 0.025, 600);
      if (b % 2 === 0) I.kick(t, 0.12);
    } },
    tropic: { gain: 1.5, bpm: 104, root: 62, scale: 'major', prog: [0, 3, 1, 4], bar(I, b, t, s) {
      s.each(16, (k, at) => { I.shaker(at, k % 2 ? 0.025 : 0.04); if ([0, 3, 6, 10, 12].includes(k)) I.rim(at, 0.07); if (k === 0 || k === 8) I.kick(at, 0.22); });
      [[0, 0], [6, 7], [8, 0], [14, 7]].forEach(([k, o]) => I.bass(s.root(-1) + o, t + k * s.step, s.step * 2, 0.13));
      const ch = s.chord(0); [2, 6, 9, 12].forEach((k) => ch.forEach((m) => I.pluck(m, t + k * s.step, 0.04, 0.3)));
      s.melody((m, at) => I.pluck(m + 12, at, 0.07, 0.5), 0.45);
    } },
    fireworks: { gain: 0.75, bpm: 124, root: 60, scale: 'major', prog: [0, 4, 5, 3], bar(I, b, t, s) {
      s.each(16, (k, at) => { if (k % 4 === 0) I.kick(at, 0.5); if (k === 4 || k === 12) I.clap(at, 0.18); if (k % 4 === 2) I.hat(at, 0.06, true); else I.hat(at, 0.025); });
      s.each(8, (k, at) => I.synbass(s.root(-1) + (k % 2 ? 0 : -12) + 12, at + s.step, s.step * 1.2, 0.08));
      [0, 3, 6].forEach((k) => I.brass(s.chord(1), t + k * s.step, s.step * 2, 0.08));
      s.melody((m, at, len) => I.lead(m + 12, at, len, 0.035), 0.6);
    } },
    storm: { gain: 0.8, bpm: 84, root: 50, scale: 'minor', prog: [0, 0, 5, 6], bar(I, b, t, s) {
      [0, 3, 8, 10, 11].forEach((k) => I.tom(t + k * s.step, k === 0 ? 70 : 95, k === 0 ? 0.5 : 0.3));
      if (b % 4 === 3) s.each(16, (k, at) => { if (k >= 12) I.snare(at, 0.05 + (k - 12) * 0.03); });
      s.each(16, (k, at) => { if (k % 2 === 0) I.synbass(s.root(-1), at, s.step * 0.7, 0.06); });
      I.pad(s.chord(-1), t, s.bar, 0.07, 700);
      if (b % 2 === 1) I.thunder(t + s.step * 4, 0.12);
      s.melody((m, at, len) => I.brass([m], at, len * 1.5, 0.06), 0.3);
    } },
    blossom: { gain: 2.3, bpm: 78, root: 62, scale: 'major', penta: true, prog: [0, 3, 4, 0], bar(I, b, t, s) {
      I.pad(s.chord(0), t, s.bar, 0.035, 800);
      I.bass(s.root(-1), t, s.bar * 0.9, 0.07);
      s.melody((m, at) => I.koto(m + 12, at, 0.09), 0.6);
      if (s.rnd() < 0.6) I.bell(s.root(2) + [0, 4, 7][Math.floor(s.rnd() * 3)], t + s.step * Math.floor(s.rnd() * 16), 0.02, 2);
    } },
    snow: { gain: 2.0, bpm: 70, root: 64, scale: 'major', prog: [0, 3, 5, 4], bar(I, b, t, s) {
      const ch = s.chord(1); s.each(8, (k, at) => I.bell([ch[0], ch[1], ch[2], ch[1] + 12][k % 4], at, 0.035, 1.2));
      s.each(8, (k, at) => I.jingle(at, k % 2 ? 0.02 : 0.03));
      I.pad(s.chord(0), t, s.bar, 0.04, 800); I.bass(s.root(-1), t, s.bar * 0.9, 0.08);
      s.melody((m, at) => I.bell(m + 12, at, 0.05, 1.6), 0.4);
    } },
    anthem: { gain: 0.68, bpm: 88, root: 55, scale: 'minor', prog: [0, 5, 3, 4], bar(I, b, t, s) {
      [0, 6, 8].forEach((k) => { I.kick(t + k * s.step, 0.5); I.tom(t + k * s.step, 80, 0.3); });
      [4, 12].forEach((k) => I.snare(t + k * s.step, 0.2));
      if (b % 4 === 3) [12, 13, 14, 15].forEach((k) => I.tom(t + k * s.step, 110 - (k - 12) * 8, 0.25));
      I.brass(s.chord(0), t, s.bar * 0.95, 0.12); I.pad(s.chord(1), t, s.bar, 0.04, 2000);
      I.bass(s.root(-1), t, s.bar * 0.9, 0.14);
      s.melody((m, at, len) => I.brass([m + 12], at, len * 1.4, 0.08), 0.35);
    } },
  };

  let cur = null;
  function start(theme, seed) {
    stop(0.2);
    const A = global.RLSfx && global.RLSfx.audio && global.RLSfx.audio();
    const T = THEMES[theme] || THEMES.golden;
    if (!A) return;
    const { ctx, out, noise } = A;
    const bus = ctx.createGain(); bus.gain.setValueAtTime(0.0001, ctx.currentTime); bus.gain.exponentialRampToValueAtTime(T.gain || 1, ctx.currentTime + 1.2); bus.connect(out); // per-style level, so every style is about as loud
    const I = kit(ctx, bus, noise);
    const rnd = seeded(String(seed || theme) + '|music');
    // each city: its own tempo (±6 bpm), key (±3 semitones) and melody
    const bpm = T.bpm + Math.round((rnd() - 0.5) * 12), key = T.root + Math.round((rnd() - 0.5) * 6);
    const step = 60 / bpm / 4, barLen = step * 16;
    const sc = SCALES[T.scale], n = sc.length;
    const note = (d, oct) => key + sc[((d % n) + n) % n] + 12 * (Math.floor(d / n) + (oct || 0));
    const pent = [0, 1, 2, 4, 5];
    const motif = (density) => Array.from({ length: 16 }, (_, k) => (rnd() < (k % 4 === 0 ? density + 0.25 : k % 2 === 0 ? density : density * 0.35) ? (T.penta ? pent[Math.floor(rnd() * 5)] : Math.floor(rnd() * 6) - 1) : null));
    const motifs = [motif(0.5), motif(0.5)];
    const extras = [];
    if (T.rain) extras.push(I.rain(ctx.currentTime + 0.05, 0.03));
    let next = ctx.currentTime + 0.08, b = 0;
    const timer = setInterval(() => {
      if (!cur || cur.timer !== timer) return;
      while (next < ctx.currentTime + 0.45) {
        const d = T.prog[b % T.prog.length];
        const s = {
          step, bar: barLen, rnd,
          root: (oct) => note(d, oct || 0),
          chord: (oct) => [note(d, oct), note(d + 2, oct), note(d + 4, oct)],
          each: (count, f) => { for (let k = 0; k < count; k++) f(k, next + k * (barLen / count)); },
          /** the city's melody over this bar's chord: f(midi, time, length); density thins it out */
          melody: (f, density) => {
            const mo = motifs[Math.floor(b / 2) % 2];
            mo.forEach((x, k) => { if (x == null || rnd() > (density == null ? 1 : density + 0.3)) return; let len = 1; while (k + len < 16 && mo[k + len] == null && len < 4) len++; f(note(d + x, 0), next + k * step, len * step); });
          },
        };
        try { T.bar(I, b, next, s); } catch (e) { /* audio node limits */ }
        next += barLen; b++;
      }
    }, 70);
    cur = { timer, bus, ctx, extras };
  }
  function stop(fade) {
    if (!cur) return;
    const { timer, bus, ctx, extras } = cur; cur = null;
    clearInterval(timer);
    const f = fade == null ? 0.9 : fade, now = ctx.currentTime;
    try { bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now); bus.gain.exponentialRampToValueAtTime(0.0001, now + f); } catch (e) { /* closed */ }
    extras.forEach((x) => { try { x.stop(now + f + 0.05); } catch (e) { /* stopped */ } });
    setTimeout(() => { try { bus.disconnect(); } catch (e) { /* gone */ } }, f * 1000 + 300);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(0.3); });
  global.RLMusic = { start, stop, themes: Object.keys(THEMES), get playing() { return !!cur; } };
})(window);
