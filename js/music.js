/* RL Esports Simulator — a unique anthem for every host city (Major, Esports World Cup and Worlds Week intros).
 *
 * Synthesised live with the Web Audio API (no audio files), on the music bus of js/sfx.js.
 * The host COUNTRY sets the flavour: its instruments, percussion, accompaniment and the modes it draws from
 * (koto and taiko for Japan, oud and darbuka for the Gulf, samba for Brazil, tango for Argentina, mariachi for Mexico,
 * bagpipes for Scotland, a jig for Ireland, oompah brass for Germany, a rock anthem for the USA, didgeridoo for
 * Australia, kalimba and djembe for Africa, sitar and tabla for India, an orchestral epic for Worlds Week...).
 * The CITY seeds everything else, so every host city gets its own anthem: key, tempo, mode, chord progression,
 * a composed theme and answering phrase, the lead instrument and the accompaniment pattern.
 * Form: a one-bar intro swell, then the theme (4 bars) and its answer (4 bars, ending on the tonic), looping.
 * RLMusic.start({ city, country, worlds }) fades in; RLMusic.stop() fades out.
 */
(function (global) {
  'use strict';
  const SC = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11], hijaz: [0, 1, 4, 5, 7, 8, 10], phrygdom: [0, 1, 4, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
    // pentatonic modes written as 7-step ladders (repeating at the octave above) so melodies stay in the mode
    penta: [0, 2, 4, 7, 9, 12, 14], minpenta: [0, 3, 5, 7, 10, 12, 15], insen: [0, 1, 5, 7, 10, 12, 13], yo: [0, 2, 5, 7, 9, 12, 14],
  };
  const MINORISH = { minor: 1, dorian: 1, harmonic: 1, hijaz: 1, phrygdom: 1, minpenta: 1, insen: 1 };
  const PROG_MAJ = [[0, 4, 5, 3], [0, 3, 4, 0], [0, 5, 3, 4], [0, 3, 0, 4], [0, 1, 3, 4], [0, 4, 3, 4], [0, 5, 1, 4], [0, 2, 3, 4], [0, 3, 5, 4]];
  const PROG_MIN = [[0, 5, 6, 0], [0, 3, 4, 0], [0, 5, 2, 6], [0, 6, 5, 4], [0, 3, 6, 4], [0, 0, 5, 6], [0, 5, 3, 4], [0, 6, 3, 4]];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
  const pickOf = (rnd, a) => a[Math.floor(rnd() * a.length)];

  /* ---------- instruments: each schedules a sound at absolute time t ---------- */
  function kit(ctx, bus, noiseBuf) {
    const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    function osc(type, f, t, a, d, peak, o) {
      o = o || {};
      const s = ctx.createOscillator(), g = ctx.createGain();
      s.type = type; s.frequency.setValueAtTime(o.from ? f * o.from : f, t);
      if (o.from) s.frequency.exponentialRampToValueAtTime(f, t + (o.fromT || 0.06));
      if (o.bend) s.frequency.exponentialRampToValueAtTime(f * o.bend, t + (o.bendT || 0.08));
      if (o.detune) s.detune.value = o.detune;
      if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib[0]; lg.gain.value = f * (Math.pow(2, o.vib[1] / 1200) - 1); l.connect(lg); lg.connect(s.frequency); l.start(t + (o.vibDelay || 0.12)); l.stop(t + a + d + 0.05); }
      let n = s;
      if (o.lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, t); if (o.lp2) fl.frequency.exponentialRampToValueAtTime(o.lp2, t + a + d); fl.Q.value = o.q || 0.7; s.connect(fl); n = fl; }
      if (o.lfoLp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lfoLp[0]; fl.Q.value = 6; const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.lfoLp[2]; lg.gain.value = o.lfoLp[1]; l.connect(lg); lg.connect(fl.frequency); l.start(t); l.stop(t + a + d + 0.05); n.connect(fl); n = fl; }
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
      /* leads: (midi, t, duration, level) */
      brass: (m, t, d, p) => osc('sawtooth', hz(m), t, 0.05, Math.max(0.15, d), p * 0.09, { lp: 900, lp2: 2600, vib: [5, 12], vibDelay: 0.25 }),
      trumpet: (m, t, d, p) => osc('sawtooth', hz(m), t, 0.03, Math.max(0.12, d), p * 0.07, { lp: 1800, lp2: 3200, vib: [5.5, 18], vibDelay: 0.2 }),
      synth: (m, t, d, p) => osc('square', hz(m), t, 0.01, Math.max(0.1, d), p * 0.045, { lp: 2600, lp2: 1300 }),
      flute: (m, t, d, p) => { osc('sine', hz(m), t, 0.06, Math.max(0.15, d), p * 0.11, { vib: [5, 16], vibDelay: 0.18 }); noise(t, 0.03, 0.12, p * 0.012, 'bandpass', hz(m) * 2, 0, 2); },
      whistle: (m, t, d, p) => osc('sine', hz(m + 12), t, 0.02, Math.max(0.1, d), p * 0.08, { vib: [6, 14], vibDelay: 0.15, from: 0.97, fromT: 0.04 }),
      koto: (m, t, d, p) => { osc('triangle', hz(m), t, 0.002, 0.55, p * 0.1, { lp: 4500, lp2: 900 }); osc('sine', hz(m) * 2, t, 0.002, 0.2, p * 0.02); },
      oud: (m, t, d, p) => osc('sawtooth', hz(m), t, 0.003, 0.34, p * 0.075, { from: 1.025, fromT: 0.04, lp: 2200, lp2: 500 }),
      sitar: (m, t, d, p) => { osc('sawtooth', hz(m), t, 0.002, 0.7, p * 0.06, { from: 0.97, fromT: 0.09, lp: 3500, lp2: 700, q: 5 }); osc('sawtooth', hz(m) * 2.005, t, 0.002, 0.4, p * 0.015, { lp: 4000 }); },
      erhu: (m, t, d, p) => osc('sawtooth', hz(m), t, 0.07, Math.max(0.15, d), p * 0.05, { from: 0.945, fromT: 0.09, lp: 1700, vib: [5.5, 22], vibDelay: 0.15 }),
      fiddle: (m, t, d, p) => osc('sawtooth', hz(m), t, 0.03, Math.max(0.12, d), p * 0.05, { lp: 2400, vib: [6, 16], vibDelay: 0.12 }),
      accordion: (m, t, d, p) => [-9, 9].forEach((dt) => osc('square', hz(m), t, 0.03, Math.max(0.12, d), p * 0.03, { detune: dt, lp: 2100 })),
      chanter: (m, t, d, p) => osc('sawtooth', hz(m + 12), t, 0.01, Math.max(0.1, d), p * 0.045, { lp: 3200, q: 3 }),
      mandolin: (m, t, d, p) => { const n = Math.max(2, Math.round(Math.max(0.12, d) / 0.055)); for (let k = 0; k < n; k++) osc('triangle', hz(m), t + k * 0.055, 0.002, 0.09, p * (k ? 0.045 : 0.07), { lp: 3500 }); },
      pluck: (m, t, d, p) => osc('triangle', hz(m), t, 0.004, 0.5, p * 0.1, { lp: 4000, lp2: 700 }),
      kalimba: (m, t, d, p) => { osc('sine', hz(m), t, 0.002, 0.5, p * 0.1); osc('sine', hz(m) * 4.2, t, 0.002, 0.06, p * 0.012); },
      marimba: (m, t, d, p) => { osc('sine', hz(m), t, 0.002, 0.35, p * 0.11); osc('sine', hz(m) * 4, t, 0.002, 0.05, p * 0.012); },
      // soft bells: a quiet, short overtone so they never ring harshly
      bell: (m, t, d, p) => { osc('sine', hz(m), t, 0.004, 1.1, p * 0.045); osc('sine', hz(m) * 2.76, t, 0.004, 0.25, p * 0.005); },
      piano: (m, t, d, p) => { osc('triangle', hz(m), t, 0.004, 1.2, p * 0.09, { lp: 2600, lp2: 900 }); osc('sine', hz(m) * 2, t, 0.004, 0.5, p * 0.02); },
      guitar: (m, t, d, p) => osc('triangle', hz(m), t, 0.003, 0.7, p * 0.09, { lp: 3000, lp2: 800 }),
      /* chords and beds */
      pad: (ns, t, d, p, lp) => ns.forEach((m) => [-7, 7].forEach((dt) => osc('sawtooth', hz(m), t, Math.min(0.5, d * 0.3), d, (p * 0.045) / ns.length, { detune: dt, lp: lp || 1100 }))),
      choir: (ns, t, d, p) => ns.forEach((m) => osc('triangle', hz(m), t, Math.min(0.6, d * 0.35), d, (p * 0.09) / ns.length, { lp: 1500, vib: [4.5, 9], vibDelay: 0.3 })),
      strum: (ns, t, d, p) => ns.forEach((m, i) => osc('triangle', hz(m), t + i * 0.014, 0.003, Math.min(0.7, d + 0.2), p * 0.05, { lp: 2800, lp2: 900 })),
      stab: (ns, t, d, p) => ns.forEach((m) => osc('sawtooth', hz(m), t, 0.01, Math.min(0.22, d), (p * 0.08) / ns.length, { lp: 1600, lp2: 700 })),
      drone: (ns, t, d, p) => ns.forEach((m) => osc('sawtooth', hz(m), t, 0.3, d, (p * 0.05) / ns.length, { lp: 700 })),
      didge: (m, t, d, p) => osc('sawtooth', hz(m), t, 0.15, d, p * 0.08, { lp: 300, lfoLp: [450, 300, 2.2] }),
      bass: (m, t, d, p) => osc('triangle', hz(m), t, 0.01, Math.max(0.12, d), p * 0.16, { lp: 700 }),
      tuba: (m, t, d, p) => osc('sawtooth', hz(m), t, 0.02, Math.max(0.15, d), p * 0.09, { lp: 500 }),
      synbass: (m, t, d, p) => osc('sawtooth', hz(m), t, 0.005, Math.max(0.1, d), p * 0.08, { lp: 900, lp2: 250, q: 4 }),
      /* percussion: (t, level) */
      kick: (t, p) => osc('sine', 120, t, 0.002, 0.28, p * 0.5, { bend: 0.35, bendT: 0.12 }),
      snare: (t, p) => { noise(t, 0.002, 0.16, p * 0.17, 'bandpass', 1800, 1200, 0.8); osc('triangle', 190, t, 0.002, 0.08, p * 0.08); },
      roll: (t, p, len) => { for (let k = 0; k < 8; k++) noise(t + (k * len) / 8, 0.001, 0.05, p * 0.05 * (0.5 + k / 8), 'bandpass', 2000, 0, 0.8); },
      clap: (t, p) => [0, 0.012, 0.024].forEach((o, i) => noise(t + o, 0.001, i === 2 ? 0.14 : 0.02, p * 0.15, 'bandpass', 1500, 1300, 1.2)),
      hat: (t, p, open) => noise(t, 0.001, open ? 0.18 : 0.04, p * 0.045, 'highpass', 8000, 0, 0.7),
      crash: (t, p) => noise(t, 0.003, 1.4, p * 0.07, 'highpass', 5000, 3000, 0.5),
      shaker: (t, p) => noise(t, 0.008, 0.05, p * 0.03, 'highpass', 6000, 0, 0.6),
      rim: (t, p) => { osc('triangle', 1700, t, 0.001, 0.03, p * 0.06); noise(t, 0.001, 0.02, p * 0.04, 'bandpass', 3000, 0, 3); },
      tom: (t, p, f) => osc('sine', f || 100, t, 0.002, 0.45, p * 0.32, { bend: 0.55, bendT: 0.25 }),
      timpani: (t, p, m) => osc('sine', hz(m), t, 0.004, 1.1, p * 0.3, { bend: 0.97, bendT: 0.5 }),
      gong: (t, p) => { osc('sine', 98, t, 0.01, 3, p * 0.12); osc('sine', 147, t, 0.01, 2.2, p * 0.05); noise(t, 0.01, 1.5, p * 0.02, 'bandpass', 600, 300, 1); },
      doum: (t, p) => osc('sine', 95, t, 0.002, 0.35, p * 0.32, { bend: 0.7, bendT: 0.2 }),
      tek: (t, p) => { noise(t, 0.001, 0.05, p * 0.08, 'bandpass', 3200, 0, 2); osc('sine', 620, t, 0.001, 0.04, p * 0.05); },
      tabla: (t, p, high) => (high ? osc('sine', 520, t, 0.001, 0.12, p * 0.1, { bend: 1.04, bendT: 0.06 }) : osc('sine', 110, t, 0.002, 0.3, p * 0.25, { bend: 1.35, bendT: 0.15 })),
      surdo: (t, p) => osc('sine', 68, t, 0.002, 0.5, p * 0.4, { bend: 0.8, bendT: 0.3 }),
      agogo: (t, p, high) => osc('sine', high ? 1320 : 990, t, 0.001, 0.12, p * 0.05),
      castanets: (t, p) => [0, 0.025].forEach((o) => noise(t + o, 0.001, 0.025, p * 0.07, 'bandpass', 2600, 0, 4)),
      jingle: (t, p) => [0, 0.015, 0.03].forEach((o) => noise(t + o, 0.001, 0.06, p * 0.025, 'bandpass', 9000, 0, 6)),
      djembe: (t, p, slap) => (slap ? noise(t, 0.001, 0.07, p * 0.12, 'bandpass', 1400, 0, 1.5) : osc('sine', 180, t, 0.002, 0.22, p * 0.22, { bend: 0.75, bendT: 0.1 })),
    };
  }

  /* ---------- percussion styles: (I, step k of S, time, S, bar, phrase bar, key) ---------- */
  const DRUMS = {
    anthem: (I, k, at, S, b, pb) => { const q = S / 4; if (k === 0 || k === 2 * q) I.kick(at, 0.9); if (k === q || k === 3 * q) I.snare(at, 0.9); if (pb === 0 && k === 0) I.crash(at, 1); if (pb % 4 === 3 && k >= 3 * q) I.tom(at, 0.7, 140 - (k - 3 * q) * 12); },
    march: (I, k, at, S, b, pb) => { const q = S / 4; if (k % q === 0) I.kick(at, k ? 0.5 : 0.8); if (k % 2 === 0) I.snare(at, k % q === 0 ? 0.5 : 0.22); if (pb === 0 && k === 0) I.crash(at, 0.8); },
    rock: (I, k, at, S, b, pb) => { const q = S / 4; if (k === 0 || k === q + q / 2 || k === 2 * q) I.kick(at, 1); if (k === q || k === 3 * q) I.snare(at, 1.1); if (k % (q / 2) === 0) I.hat(at, 0.8); if (pb % 4 === 0 && k === 0) I.crash(at, 1); },
    four: (I, k, at, S, b, pb) => { const q = S / 4; if (k % q === 0) I.kick(at, 1); if (k === q || k === 3 * q) I.clap(at, 1); if (k % q === q / 2) I.hat(at, 1.2, true); if (pb === 0 && k === 0) I.crash(at, 0.8); },
    taiko: (I, k, at, S, b, pb) => { if ([0, 3, 8, 10, 11].includes(k)) I.tom(at, k === 0 ? 1.2 : 0.8, k === 0 ? 70 : 95); if (pb % 4 === 3 && k >= 12) I.tom(at, 0.6, 120); if (pb === 0 && k === 0) I.gong(at, 0.6); },
    darbuka: (I, k, at) => { if (k === 0 || k === 6 || k === 10) I.doum(at, 1); if (k === 4 || k === 12 || k === 14) I.tek(at, 1.1); if (k === 2 || k === 8) I.tek(at, 0.45); },
    tabla: (I, k, at) => { if (k === 0 || k === 7 || k === 10) I.tabla(at, 1, false); if ([2, 4, 6, 9, 12, 14].includes(k)) I.tabla(at, 0.8, true); },
    samba: (I, k, at) => { if (k === 4 || k === 12) I.surdo(at, 1); if (k === 0 || k === 8) I.surdo(at, 0.45); if ([0, 3, 6, 8, 11, 14].includes(k)) I.rim(at, 0.9); I.shaker(at, k % 2 ? 0.8 : 1.2); if (k % 4 === 0) I.agogo(at, 1, (k / 4) % 2 === 0); },
    bossa: (I, k, at) => { I.shaker(at, k % 2 ? 0.7 : 1.1); if ([0, 3, 6, 10, 12].includes(k)) I.rim(at, 1); if (k === 0 || k === 8) I.kick(at, 0.45); },
    six8: (I, k, at, S, b, pb) => { if (k === 0 || k === 6) I.kick(at, 0.8); if (k === 3 || k === 9) I.snare(at, 0.6); I.shaker(at, k % 3 === 0 ? 1 : 0.6); if (pb === 0 && k === 0) I.crash(at, 0.7); },
    bodhran: (I, k, at) => { if (k % 3 === 0) I.tom(at, k % 6 === 0 ? 0.55 : 0.35, 130); else I.tom(at, 0.18, 170); },
    djembe: (I, k, at) => { if ([0, 6, 10].includes(k)) I.djembe(at, 1, false); if ([3, 4, 12, 14].includes(k)) I.djembe(at, 1, true); I.shaker(at, k % 2 ? 0.6 : 1); },
    folk: (I, k, at, S) => { const q = S / 4; if (k === 0 || k === 2 * q) I.kick(at, 0.6); if (k % q === q / 2) I.jingle(at, 1.2); },
    gamelan: (I, k, at, S, b, pb) => { if (pb % 2 === 0 && k === 0) I.gong(at, 0.7); if ([4, 10, 12].includes(k)) I.tom(at, 0.35, 160); if (k % 2 === 0) I.rim(at, 0.35); },
    tango: (I, k, at, S) => { const q = S / 4; if (k === 0) I.kick(at, 0.5); if (k === 3 * q + 2) I.rim(at, 0.8); },
    epic: (I, k, at, S, b, pb, key, st) => { const q = S / 4; if (k === 0 || k === q + q / 2 || k === 2 * q) I.kick(at, 1.1); if (k === q || k === 3 * q) { I.snare(at, 1); I.tom(at, 0.5, 90); } if (k === 0 && pb % 2 === 0) I.timpani(at, 1, key - 24); if (pb === 0 && k === 0) I.crash(at, 1.1); if (pb % 4 === 3 && k === 3 * q) I.roll(at, 1, q * st); },
  };
  /* ---------- accompaniment: (I, chord, root, time, bar length, step, S, arp instrument) ---------- */
  const COMP = {
    pad: (I, ch, r, t, L) => { I.pad(ch, t, L, 1); I.bass(r - 12, t, L * 0.9, 0.8); },
    strings: (I, ch, r, t, L) => { I.pad(ch, t, L, 1.2, 1500); I.bass(r - 12, t, L * 0.45, 0.8); I.bass(r - 12 + 7, t + L / 2, L * 0.45, 0.6); },
    choir: (I, ch, r, t, L) => { I.choir(ch.map((m) => m + 12), t, L, 1); I.pad(ch, t, L, 0.8, 900); I.bass(r - 12, t, L * 0.9, 0.9); },
    arp: (I, ch, r, t, L, st, S, inst) => { for (let k = 0; k < S; k += 2) I[inst || 'pluck']([ch[0], ch[1], ch[2], ch[1] + 12][(k / 2) % 4], t + k * st, st * 2, 0.7); I.bass(r - 12, t, L * 0.9, 0.7); },
    strum: (I, ch, r, t, L, st, S) => { const pat = S === 12 ? [0, 3, 6, 9] : [0, 3, 6, 8, 11, 14]; pat.forEach((k, i) => I.strum(i % 2 ? ch : [ch[0] - 12, ...ch], t + k * st, st * 2, 1)); I.bass(r - 12, t, L / 2, 0.7); I.bass(r - 5, t + L / 2, L / 2, 0.6); },
    oompah: (I, ch, r, t, L, st, S) => { const q = S / 4; I.tuba(r - 12, t, st * q * 0.9, 1); I.tuba(r - 5, t + 2 * q * st, st * q * 0.9, 0.9); [q, 3 * q].forEach((k) => I.stab(ch, t + k * st, st * q * 0.6, 1)); },
    tango: (I, ch, r, t, L, st, S) => { const q = S / 4; for (let b = 0; b < 4; b++) { I.stab(ch, t + b * q * st, st * 1.5, b % 2 ? 0.7 : 1.1); I.bass(r - 12, t + b * q * st, st * 1.5, b % 2 ? 0.5 : 1); } I.bass(r - 12 + 7, t + (3 * q + 2) * st, st, 0.8); },
    tremolo: (I, ch, r, t, L, st, S) => { for (let k = 0; k < S; k += 4) I.mandolin(ch[(k / 4) % 3], t + k * st, st * 3, 0.6); I.bass(r - 12, t, L * 0.9, 0.7); },
    drone: (I, ch, r, t, L) => I.drone([r - 12, r - 5], t, L * 1.02, 1),
    stabs: (I, ch, r, t, L, st, S) => { [0, 3, 6].forEach((k) => I.stab(ch.map((m) => m + 12), t + k * st, st * 2, 1)); for (let k = 0; k < S; k += 2) I.synbass(r - 12 + (k % 4 ? 12 : 0), t + k * st, st * 1.5, 0.9); },
    power: (I, ch, r, t, L, st, S) => { for (let k = 0; k < S; k += 2) I.synbass(r - 12, t + k * st, st * 1.6, 1); I.pad([ch[0], ch[0] + 7, ch[0] + 12], t, L, 1.1, 1800); },
    marimba: (I, ch, r, t, L, st, S) => { for (let k = 0; k < S; k += 2) if ((k * 7) % 5 !== 1) I.marimba([ch[0], ch[2], ch[1], ch[2] + 12][(k / 2) % 4] + 12, t + k * st, st, 0.6); I.bass(r - 12, t, L * 0.45, 0.8); I.bass(r - 12, t + L * 0.75, L * 0.25, 0.6); },
    gamelan: (I, ch, r, t, L, st, S) => { for (let k = 0; k < S; k += 2) I.bell([ch[0], ch[1], ch[2], ch[1]][(k / 2) % 4] + 12, t + k * st, st, 0.8); I.drone([r - 12], t, L, 0.6); },
  };

  /* ---------- flavours by host country ---------- */
  const F = {
    japan: { scales: ['insen', 'yo', 'minor'], bpm: [76, 96], leads: ['koto', 'flute'], drums: ['taiko'], comp: ['pad', 'gamelan'], key: [60, 66] },
    eastasia: { scales: ['penta', 'yo', 'major'], bpm: [88, 108], leads: ['erhu', 'flute', 'synth'], drums: ['anthem', 'gamelan'], comp: ['arp', 'pad'], key: [60, 67] },
    sea: { scales: ['penta', 'minpenta'], bpm: [90, 108], leads: ['bell', 'flute', 'pluck'], drums: ['gamelan', 'folk'], comp: ['gamelan', 'arp'], key: [60, 66] },
    india: { scales: ['phrygdom', 'harmonic', 'mixo'], bpm: [88, 108], leads: ['sitar', 'flute'], drums: ['tabla'], comp: ['drone'], key: [60, 64] },
    arab: { scales: ['hijaz', 'harmonic', 'phrygdom'], bpm: [92, 112], leads: ['oud', 'flute'], drums: ['darbuka'], comp: ['drone', 'pad'], key: [60, 64] },
    brazil: { scales: ['major', 'mixo'], bpm: [100, 116], leads: ['whistle', 'pluck', 'trumpet'], drums: ['samba', 'bossa'], comp: ['strum', 'arp'], key: [60, 67] },
    tango: { scales: ['harmonic', 'minor'], bpm: [108, 120], leads: ['accordion', 'fiddle'], drums: ['tango'], comp: ['tango'], key: [57, 64] },
    mariachi: { scales: ['major'], bpm: [120, 140], six8: true, leads: ['trumpet'], harmony: true, drums: ['six8'], comp: ['strum'], key: [60, 65] },
    andes: { scales: ['minpenta', 'minor', 'dorian'], bpm: [94, 110], leads: ['flute'], drums: ['folk'], comp: ['strum', 'arp'], key: [57, 64] },
    spain: { scales: ['phrygdom', 'harmonic', 'minor'], bpm: [100, 120], leads: ['guitar', 'trumpet'], drums: ['folk'], castanets: true, comp: ['strum'], key: [57, 64] },
    italy: { scales: ['major', 'harmonic'], bpm: [96, 112], leads: ['mandolin', 'fiddle'], drums: ['folk', 'march'], comp: ['tremolo', 'strings'], key: [60, 67] },
    balkan: { scales: ['harmonic', 'hijaz'], bpm: [104, 120], leads: ['mandolin', 'accordion'], drums: ['darbuka', 'folk'], comp: ['tremolo', 'strum'], key: [57, 64] },
    musette: { scales: ['major', 'harmonic'], bpm: [126, 144], six8: true, leads: ['accordion'], drums: ['six8'], comp: ['strum'], key: [60, 67] },
    brass: { scales: ['major'], bpm: [100, 118], leads: ['trumpet', 'brass'], drums: ['march'], comp: ['oompah'], key: [58, 65] },
    british: { scales: ['major', 'mixo'], bpm: [80, 96], leads: ['brass', 'trumpet'], drums: ['march', 'anthem'], comp: ['strings', 'choir'], key: [58, 65], timpani: true },
    scottish: { scales: ['mixo'], bpm: [84, 100], leads: ['chanter'], drums: ['march'], comp: ['drone'], key: [57, 60] },
    irish: { scales: ['dorian', 'mixo', 'major'], bpm: [112, 128], six8: true, leads: ['whistle', 'fiddle'], drums: ['bodhran'], comp: ['strum'], key: [60, 67] },
    nordic: { scales: ['dorian', 'minor'], bpm: [86, 104], leads: ['fiddle', 'flute'], drums: ['folk', 'anthem'], comp: ['strings', 'drone'], key: [57, 64] },
    usa: { scales: ['major', 'mixo'], bpm: [104, 124], leads: ['synth', 'trumpet'], drums: ['rock'], comp: ['power', 'stabs'], key: [57, 64] },
    canada: { scales: ['major', 'mixo'], bpm: [96, 116], leads: ['fiddle', 'whistle'], drums: ['rock', 'folk'], comp: ['strum', 'power'], key: [60, 67] },
    oceania: { scales: ['major', 'mixo'], bpm: [100, 116], leads: ['pluck', 'whistle'], drums: ['rock', 'folk'], comp: ['strum'], didge: true, key: [57, 62] },
    africa: { scales: ['penta', 'major'], bpm: [100, 118], leads: ['kalimba', 'marimba', 'whistle'], drums: ['djembe'], comp: ['marimba'], key: [60, 67] },
    dance: { scales: ['major', 'minor'], bpm: [118, 128], leads: ['synth'], drums: ['four'], comp: ['stabs'], key: [57, 64] },
    worlds: { scales: ['minor', 'major', 'dorian'], bpm: [84, 96], leads: ['brass', 'trumpet'], drums: ['epic'], comp: ['choir', 'strings'], key: [55, 62], timpani: true, harmony: true },
  };
  const COUNTRY = {
    Japan: 'japan', China: 'eastasia', 'Hong Kong': 'eastasia', Taiwan: 'eastasia', 'South Korea': 'eastasia', Singapore: 'sea', Thailand: 'sea', Indonesia: 'sea', Malaysia: 'sea', Philippines: 'sea', Vietnam: 'sea', India: 'india',
    'Saudi Arabia': 'arab', 'United Arab Emirates': 'arab', Qatar: 'arab', Kuwait: 'arab', Oman: 'arab', Jordan: 'arab', Egypt: 'arab', Morocco: 'arab', Tunisia: 'arab', Turkey: 'balkan', Greece: 'balkan',
    Brazil: 'brazil', Argentina: 'tango', Uruguay: 'tango', Mexico: 'mariachi', Colombia: 'andes', Peru: 'andes', Chile: 'andes', Ecuador: 'andes',
    Spain: 'spain', Portugal: 'spain', Italy: 'italy', France: 'musette', Belgium: 'musette', Switzerland: 'brass',
    Germany: 'brass', Austria: 'brass', Netherlands: 'brass', Poland: 'brass', Czechia: 'brass', Hungary: 'balkan', Romania: 'balkan',
    'United Kingdom': 'british', England: 'british', Scotland: 'scottish', Wales: 'british', Ireland: 'irish',
    Denmark: 'nordic', Sweden: 'nordic', Norway: 'nordic', Finland: 'nordic',
    'United States': 'usa', Canada: 'canada', Australia: 'oceania', 'New Zealand': 'oceania',
    'South Africa': 'africa', Nigeria: 'africa', Kenya: 'africa', Ghana: 'africa',
  };
  const CITY_FLAVOUR = { Edinburgh: 'scottish', 'Las Vegas': 'dance', Miami: 'dance' };

  /** Compose a city's anthem. Every choice comes from the city's own seed, so the same city always gets the same anthem. */
  function compose(city, country, worlds) {
    const fname = worlds ? 'worlds' : CITY_FLAVOUR[city] || COUNTRY[country] || 'usa';
    const fl = F[fname], rnd = seeded((worlds ? 'worlds|' : '') + city + '|' + country + '|anthem');
    const scaleName = pickOf(rnd, fl.scales), sc = SC[scaleName];
    const prog = pickOf(rnd, MINORISH[scaleName] ? PROG_MIN : PROG_MAJ);
    const S = fl.six8 ? 12 : 16;
    const bpm = fl.bpm[0] + Math.round(rnd() * (fl.bpm[1] - fl.bpm[0]));
    const key = fl.key[0] + Math.floor(rnd() * (fl.key[1] - fl.key[0] + 1));
    const lead = pickOf(rnd, fl.leads), drums = pickOf(rnd, fl.drums), comp = pickOf(rnd, fl.comp);
    const arpInst = pickOf(rnd, ['pluck', 'guitar', 'kalimba', 'piano']);
    // the theme: bar rhythms from an anthem-like library (A B A C), then an answer (A B D) ending on a long tonic
    const RH = S === 16
      ? [[0, 4, 8, 12], [0, 6, 8, 12], [0, 4, 6, 8, 12], [0, 2, 4, 8, 12], [0, 3, 4, 8, 10, 12], [0, 8, 12], [0, 4, 8], [0, 6, 12], [0, 2, 4, 6, 8, 12, 14], [0, 4, 10, 12], [0, 3, 6, 8, 12], [0, 12]]
      : [[0, 3, 6, 9], [0, 2, 3, 6, 8, 9], [0, 6, 9], [0, 3, 4, 5, 6, 9], [0, 2, 3, 5, 6, 9], [0, 6], [0, 3, 6]];
    const rA = pickOf(rnd, RH), rB = pickOf(rnd, RH), rC = pickOf(rnd, RH), rD = pickOf(rnd, RH.filter((r) => r.length <= 4));
    const rhythms = [rA, rB, rA, rC, rA, rB, rD, [0]];
    let deg = pickOf(rnd, [0, 2, 4]) + 7;
    const melody = [];
    rhythms.forEach((r, bar) => {
      const chordDeg = prog[bar % 4];
      r.forEach((k, i) => {
        const strong = k === 0 || k === S / 2;
        if (bar === 7) deg = 7; // final cadence on the tonic
        else if (strong) { const tones = [0, 2, 4].map((x) => chordDeg + x).flatMap((x) => [x, x + 7, x - 7]); deg = tones.reduce((a, c) => (Math.abs(c - deg) < Math.abs(a - deg) ? c : a), tones[0]); }
        else deg += pickOf(rnd, [-2, -1, -1, 1, 1, 1, 2, -3, 3]);
        deg = Math.max(3, Math.min(13, deg));
        const nextK = r[i + 1] != null ? r[i + 1] : S;
        melody.push({ bar, k, deg, len: Math.min(nextK - k, S / 2) });
      });
    });
    const n = sc.length;
    const note = (d, oct) => key + sc[((d % n) + n) % n] + 12 * (Math.floor(d / n) + (oct || 0));
    return { fname, fl, scaleName, prog, S, bpm, key, lead, drums, comp, arpInst, melody, note };
  }

  /* per-flavour levels (measured offline) so every anthem plays at about the same loudness */
  const LEVEL = {japan: 0.85, eastasia: 0.98, sea: 1.21, india: 1.59, arab: 1.09, brazil: 1.26, tango: 1.69, mariachi: 0.95, andes: 1.07, spain: 1.08, italy: 0.97, balkan: 0.9, musette: 0.95, brass: 1.05, british: 0.88, scottish: 1.31, irish: 1.11, nordic: 1.03, usa: 0.77, dance: 0.65, canada: 1.06, oceania: 0.69, africa: 1.11, worlds: 0.6};
  let cur = null;
  function start(o, seed) {
    stop(0.2);
    const A = global.RLSfx && global.RLSfx.audio && global.RLSfx.audio();
    if (!A) return;
    if (typeof o === 'string') o = { city: seed || o, country: '' };
    const P = compose(o.city || 'City', o.country || '', !!o.worlds);
    const { ctx, out, noise } = A;
    const bus = ctx.createGain(); bus.gain.setValueAtTime(0.0001, ctx.currentTime); bus.gain.exponentialRampToValueAtTime(LEVEL[P.fname] || 1, ctx.currentTime + 1.2); bus.connect(out);
    const I = kit(ctx, bus, noise);
    const st = P.S === 16 ? 60 / P.bpm / 4 : 60 / P.bpm / 3, L = st * P.S;
    let next = ctx.currentTime + 0.08, b = 0;
    const playBar = (t, bar) => {
      if (bar === 0) { // intro: a swell on the tonic chord, then a fill into the theme
        I.pad([P.note(0), P.note(2), P.note(4)], t, L, 0.9, 900); I.bass(P.key - 12, t, L, 0.6);
        if (P.fl.timpani) for (let k = 0; k < 8; k++) I.timpani(t + L * 0.5 + k * (L / 16), 0.25 + k * 0.06, P.key - 24);
        else I.crash(t + L * 0.25, 0.4);
        if (P.fl.didge) I.didge(P.key - 24, t, L * 1.05, 1);
        return;
      }
      const pb = (bar - 1) % 8, d = P.prog[pb % 4];
      const ch = [P.note(d), P.note(d + 2), P.note(d + 4)];
      COMP[P.comp](I, ch, P.note(d), t, L, st, P.S, P.arpInst);
      for (let k = 0; k < P.S; k++) DRUMS[P.drums](I, k, t + k * st, P.S, bar, pb, P.key, st);
      if (P.fl.castanets) [0, 3, 6, 10].forEach((k) => I.castanets(t + k * st, 0.9));
      if (P.fl.didge && pb % 2 === 0) I.didge(P.key - 24, t, L * 2, 0.8);
      if (P.fl.timpani && pb === 7) I.timpani(t, 0.8, P.key - 24);
      P.melody.forEach((x) => {
        if (x.bar !== pb) return;
        const m = P.note(x.deg), at = t + x.k * st, len = x.len * st;
        I[P.lead](m, at, len, 1);
        if (P.fl.harmony) I[P.lead](P.note(x.deg - 2), at, len, 0.55); // second voice a third below (mariachi trumpets, Worlds brass)
      });
    };
    const timer = setInterval(() => {
      if (!cur || cur.timer !== timer) return;
      while (next < ctx.currentTime + 0.45) { try { playBar(next, b); } catch (e) { /* audio node limits */ } next += L; b++; }
    }, 70);
    cur = { timer, bus, ctx, info: { city: o.city, flavour: P.fname, scale: P.scaleName, bpm: P.bpm, key: P.key, lead: P.lead, drums: P.drums, comp: P.comp } };
  }
  function stop(fade) {
    if (!cur) return;
    const { timer, bus, ctx } = cur; cur = null;
    clearInterval(timer);
    const f = fade == null ? 0.9 : fade, now = ctx.currentTime;
    try { bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now); bus.gain.exponentialRampToValueAtTime(0.0001, now + f); } catch (e) { /* closed */ }
    setTimeout(() => { try { bus.disconnect(); } catch (e) { /* gone */ } }, f * 1000 + 300);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(0.3); });
  global.RLMusic = { start, stop, compose, LEVEL, get playing() { return !!cur; }, get info() { return cur && cur.info; } };
})(window);
