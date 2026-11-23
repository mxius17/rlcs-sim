/* RL Esports Simulator — a unique anthem for every host city (Major, Esports World Cup and Worlds Week intros).
 *
 * Synthesised live with the Web Audio API (no audio files), on the music bus of js/sfx.js.
 *
 * Every host city has a STYLE drawn from its own musical culture, with that culture's instruments:
 *   plucked strings are physically modelled (Karplus-Strong, rendered once per note): koto, shamisen, guzheng,
 *   gayageum, pipa, sitar, oud, qanun, saz, bouzouki, flamenco and Portuguese guitar, charango, cavaquinho, kora,
 *   banjo, cimbalom, kantele, viola caipira, highlife guitar …; winds, reeds and bows are shaped with breath noise,
 *   formants, scoops and ornaments: shakuhachi, shinobue, dizi, daegeum, bansuri, ney, quena, panpipes, bagpipes and
 *   uilleann pipes with grace notes, shehnai, zurna, dolçaina, bandoneon, accordion, harmonica, hurdy-gurdy,
 *   alphorn, erhu, nyckelharpa, hardanger fiddle, mariachi trumpets, vuvuzela, didgeridoo …; and percussion from taiko
 *   and janggu to dhol, darbuka and riq, qraqeb, surdo with cuíca and apito, cajón, talking drum, the amapiano log drum.
 * Each style also has its own rhythm, its own way of "hitting" the big moments (taiko, a Chinese opera gong, an
 * ardah drum line, a pipe band, an 808, a vuvuzela blast …) and a signature intro played by its most iconic
 * instrument (a shakuhachi call, a guzheng glissando, a sitar meend over the tanpura, the pipes and drones starting up).
 * The CITY seeds everything else: key, tempo, mode, chord progression, the composed theme and its answer, and which
 * of its style's instruments lead, answer, accompany and drive the ostinato.
 * Form: a one-bar signature intro building into a drop (in time with the opener's first cut, js/opener.js), then
 * the theme (4 bars) and its answer (4 bars, ending on the tonic), looping, with a build into every new phrase.
 * RLMusic.start({ city, country, worlds }) fades in; RLMusic.stop() fades out; RLMusic.hit(kind) lands a hit.
 */
(function (global) {
  'use strict';
  const SC = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11], hijaz: [0, 1, 4, 5, 7, 8, 10], phrygdom: [0, 1, 4, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
    phrygian: [0, 1, 3, 5, 7, 8, 10], hungarian: [0, 2, 3, 6, 7, 8, 11], doubleharm: [0, 1, 4, 5, 7, 8, 11], bhairav: [0, 1, 4, 5, 7, 8, 11],
    // pentatonic modes written as 7-step ladders (repeating at the octave above) so melodies stay in the mode
    penta: [0, 2, 4, 7, 9, 12, 14], minpenta: [0, 3, 5, 7, 10, 12, 15], insen: [0, 1, 5, 7, 10, 12, 13], yo: [0, 2, 5, 7, 9, 12, 14],
    pelog: [0, 1, 3, 7, 8, 12, 13], slendro: [0, 2, 5, 7, 9, 12, 14], blues: [0, 3, 5, 6, 7, 10, 12],
  };
  const MINORISH = { minor: 1, dorian: 1, harmonic: 1, hijaz: 1, phrygdom: 1, minpenta: 1, insen: 1, phrygian: 1, hungarian: 1, doubleharm: 1, bhairav: 1, pelog: 1, blues: 1 };
  const PROG_MAJ = [[0, 4, 5, 3], [0, 3, 4, 0], [0, 5, 3, 4], [0, 3, 0, 4], [0, 1, 3, 4], [0, 4, 3, 4], [0, 5, 1, 4], [0, 2, 3, 4], [0, 3, 5, 4]];
  const PROG_MIN = [[0, 5, 6, 0], [0, 3, 4, 0], [0, 5, 2, 6], [0, 6, 5, 4], [0, 3, 6, 4], [0, 0, 5, 6], [0, 5, 3, 4], [0, 6, 3, 4]];
  const PROG_STATIC = [[0, 0, 0, 0], [0, 0, 6, 0], [0, 6, 0, 0], [0, 0, 1, 0]]; // modal music that stays on its drone
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
  const pickOf = (rnd, a) => a[Math.floor(rnd() * a.length) % a.length];

  /* =====================================================================================================
     INSTRUMENTS. Every melodic voice is (midi, time, duration, level); percussion is (time, level, ...).
     ===================================================================================================== */
  function kit(ctx, bus, noiseBuf) {
    const sr = ctx.sampleRate;
    const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    /* a sustained voice: oscillators → (formants, filters) → envelope with attack, hold, release */
    function voice(f, t, d, peak, o) {
      o = o || {};
      const a = o.a || 0.02, r = o.r || 0.08, hold = Math.max(0.02, d - a), P = Math.max(0.0002, peak);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(P, t + a);
      const S2 = Math.max(0.0002, P * (o.swell || o.sus || 1));
      if (o.swell) g.gain.exponentialRampToValueAtTime(S2, t + a + hold); else g.gain.setValueAtTime(S2, t + a + hold * 0.3);
      g.gain.setValueAtTime(S2, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
      let head = g;
      if (o.trem) { const tg = ctx.createGain(); tg.gain.value = 1 - o.trem[1]; const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.trem[0]; lg.gain.value = o.trem[1]; l.connect(lg); lg.connect(tg.gain); tg.connect(head); head = tg; l.start(t); l.stop(t + a + hold + r + 0.05); }
      (o.formants || []).forEach(([ff, gain, q]) => { const fl = ctx.createBiquadFilter(); fl.type = 'peaking'; fl.frequency.value = ff; fl.gain.value = gain; fl.Q.value = q || 2; fl.connect(head); head = fl; });
      if (o.lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, t); if (o.lp2) fl.frequency.exponentialRampToValueAtTime(o.lp2, t + Math.min(Math.max(d, 0.1), 0.6)); fl.Q.value = o.q || 0.7; fl.connect(head); head = fl; }
      g.connect(bus);
      const end = t + a + hold + r + 0.05;
      (o.waves || [[o.wave || 'sawtooth', 1, 1]]).forEach(([type, mult, lvl, det]) => {
        const s = ctx.createOscillator(); s.type = type; const fq = f * mult;
        if (o.scoop) { s.frequency.setValueAtTime(fq * o.scoop, t); s.frequency.exponentialRampToValueAtTime(fq, t + (o.scoopT || 0.08)); } else s.frequency.setValueAtTime(fq, t);
        if (o.bend && d > 0.25) { const bt = t + Math.max(o.scoopT || 0.08, d * (o.bendAt || 0.6)); s.frequency.setValueAtTime(fq, bt); s.frequency.exponentialRampToValueAtTime(fq * o.bend, bt + (o.bendT || 0.12)); }
        if (det) s.detune.value = det;
        if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib[0]; lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + (o.vib[2] || 0.15)); lg.gain.linearRampToValueAtTime(fq * (Math.pow(2, o.vib[1] / 1200) - 1), t + (o.vib[2] || 0.15) + 0.2); l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(end); }
        const sg = ctx.createGain(); sg.gain.value = lvl; s.connect(sg); sg.connect(head);
        s.start(t); s.stop(end);
      });
      if (o.breath) { // breath noise tuned to the note: the air in a flute, the chiff at its start
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f * (o.breathMul || 1); fl.Q.value = o.breathQ || 6;
        const bp = Math.max(0.0002, P * o.breath), bg = ctx.createGain(); bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(bp * 2.2, t + 0.02); bg.gain.exponentialRampToValueAtTime(bp, t + 0.12); bg.gain.setValueAtTime(bp, t + a + hold); bg.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
        s.connect(fl); fl.connect(bg); bg.connect(bus); s.start(t, Math.random() * 0.5); s.stop(end);
      }
    }
    function noise(t, a, d, peak, type, f, f2, q) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.setValueAtTime(f || 1000, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + d); fl.Q.value = q || 1;
      const g = ctx.createGain(); env(g, t, peak, a, d);
      s.connect(fl); fl.connect(g); g.connect(bus);
      s.start(t, Math.random() * 0.5); s.stop(t + a + d + 0.05);
    }
    function tone(type, f, t, a, d, peak, o) { // a decaying tone (drums, mallets, partials)
      o = o || {};
      const s = ctx.createOscillator(), g = ctx.createGain();
      s.type = type; s.frequency.setValueAtTime(f * (o.from || 1), t);
      if (o.from) s.frequency.exponentialRampToValueAtTime(f, t + (o.fromT || 0.05));
      if (o.bend) s.frequency.exponentialRampToValueAtTime(f * o.bend, t + (o.bendT || 0.1));
      if (o.bend2) s.frequency.exponentialRampToValueAtTime(f * o.bend2, t + (o.bend2T || 0.3));
      if (o.wob) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.wob[0]; lg.gain.value = f * o.wob[1]; l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(t + a + d + 0.05); }
      let n = s;
      if (o.lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, t); if (o.lp2) fl.frequency.exponentialRampToValueAtTime(o.lp2, t + a + d); fl.Q.value = o.q || 0.7; s.connect(fl); n = fl; }
      env(g, t, peak, a, d); n.connect(g); g.connect(bus);
      s.start(t); s.stop(t + a + d + 0.05);
    }
    /* struck bars and metal: a sum of partials [ratio, level, decay] */
    const strike = (f, t, p, parts, a) => parts.forEach(([r, l, dcy, type]) => tone(type || 'sine', f * r, t, a || 0.002, dcy, p * l));

    /* ---------- Karplus-Strong plucked strings, rendered into buffers and cached per note ---------- */
    const ksCache = new Map();
    function ksBuf(f, o) {
      const s = o.damp == null ? 0.5 : o.damp, N = Math.max(2, Math.floor(sr / f - s)), key = o.id + '|' + N;
      let e = ksCache.get(key); if (e) return e;
      if (ksCache.size > 260) ksCache.clear();
      const len = Math.floor(sr * o.dur), buf = ctx.createBuffer(1, len, sr), out = buf.getChannelData(0), dl = new Float32Array(N);
      let lp = 0; for (let i = 0; i < N; i++) { lp += (Math.random() * 2 - 1 - lp) * o.bright; dl[i] = lp; }
      if (o.pick) { const Pk = Math.max(1, Math.round(N * o.pick)), c = dl.slice(); for (let i = 0; i < N; i++) dl[i] = c[i] - 0.9 * c[(i + Pk) % N]; }
      const g = Math.pow(0.001, 1 / (o.t60 * f));
      let idx = 0, pk = 1e-6;
      for (let n = 0; n < len; n++) { const nx = idx + 1 === N ? 0 : idx + 1, v = dl[idx]; dl[idx] = (v * (1 - s) + dl[nx] * s) * g; out[n] = v; idx = nx; }
      if (o.buzz) for (let n = 0; n < len; n++) out[n] += o.buzz * Math.tanh(out[n] * 9) * 0.35; // a jawari / sawari bridge
      for (let n = 0; n < len; n++) pk = Math.max(pk, Math.abs(out[n]));
      const fade = Math.floor(sr * 0.02); for (let n = 0; n < len; n++) out[n] = (out[n] / pk) * 0.9 * (n > len - fade ? (len - n) / fade : 1);
      e = { buf, rate0: (N + s) / sr }; ksCache.set(key, e); return e;
    }
    function ks(m, t, d, p, o) {
      const f = hz(m), e = ksBuf(f, o), src = ctx.createBufferSource(); src.buffer = e.buf;
      const rate = f * e.rate0;
      src.playbackRate.setValueAtTime(rate * (o.scoop || 1), t);
      if (o.scoop) src.playbackRate.exponentialRampToValueAtTime(rate, t + (o.scoopT || 0.08));
      if (o.bend && d > 0.3) { src.playbackRate.setValueAtTime(rate, t + d * 0.45); src.playbackRate.exponentialRampToValueAtTime(rate * o.bend, t + d * 0.45 + 0.12); }
      if (o.vib && d > 0.3) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib[0]; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(rate * (Math.pow(2, o.vib[1] / 1200) - 1), t + 0.3); l.connect(lg); lg.connect(src.playbackRate); l.start(t); l.stop(t + o.dur); }
      const g = ctx.createGain(); g.gain.value = p;
      const end = o.mute ? Math.min(o.dur, Math.max(0.12, d * 1.1)) : o.dur;
      if (o.mute) { g.gain.setValueAtTime(p, t + end - 0.05); g.gain.linearRampToValueAtTime(0, t + end); }
      let head = src;
      if (o.body) { const fl = ctx.createBiquadFilter(); fl.type = 'peaking'; fl.frequency.value = o.body[0]; fl.gain.value = o.body[1]; fl.Q.value = o.body[2] || 1.5; src.connect(fl); head = fl; }
      head.connect(g); g.connect(bus); src.start(t); src.stop(t + end + 0.02);
      if (o.click) noise(t, 0.001, 0.012, p * o.click, 'highpass', 3000, 0, 0.7);
    }
    // a plucked string, plus tremolo (rapid re-plucks) on long notes and doubled courses where the instrument has them
    const pl = (o) => (m, t, d, p) => {
      const Pv = p * (o.lvl || 0.22);
      if (o.trem && d > o.trem * 3) { const n = Math.floor(d / o.trem); for (let k = 0; k < n; k++) { ks(m, t + k * o.trem, o.trem, Pv * (k ? 0.7 : 1), o); if (o.course != null) ks(m + o.course, t + k * o.trem + 0.004, o.trem, Pv * 0.45 * (k ? 0.7 : 1), o); } return; }
      ks(m, t, d, Pv, o); if (o.course != null) ks(m + o.course, t + 0.006, d, Pv * 0.5, o);
    };
    const KSI = {
      koto: { id: 'koto', dur: 1.8, t60: 1.6, bright: 0.55, damp: 0.5, pick: 0.13, body: [700, 4], bend: 1.06, lvl: 0.24, click: 0.15 },
      shamisen: { id: 'sham', dur: 0.9, t60: 0.55, bright: 0.95, damp: 0.42, buzz: 0.55, pick: 0.08, body: [1400, 5, 2], lvl: 0.2, click: 0.5, scoop: 0.985, scoopT: 0.03 },
      guzheng: { id: 'guz', dur: 2.0, t60: 1.8, bright: 0.6, damp: 0.48, pick: 0.15, body: [500, 3], vib: [5.5, 30], lvl: 0.22 },
      gayageum: { id: 'gay', dur: 1.6, t60: 1.2, bright: 0.45, damp: 0.5, pick: 0.2, body: [350, 4], vib: [4.2, 45], bend: 0.97, lvl: 0.26 },
      pipa: { id: 'pipa', dur: 0.8, t60: 0.6, bright: 0.85, damp: 0.45, pick: 0.1, body: [900, 4], trem: 0.05, lvl: 0.2, click: 0.25 },
      sitar: { id: 'sitar', dur: 2.2, t60: 2.4, bright: 0.9, damp: 0.46, buzz: 0.75, pick: 0.05, body: [1100, 6, 1.2], scoop: 0.94, scoopT: 0.14, lvl: 0.17 },
      oud: { id: 'oud', dur: 0.8, t60: 0.5, bright: 0.65, damp: 0.5, pick: 0.12, body: [300, 6], scoop: 0.985, scoopT: 0.04, course: 0.06, lvl: 0.22 },
      qanun: { id: 'qanun', dur: 1.3, t60: 1.0, bright: 0.9, damp: 0.45, pick: 0.1, body: [1200, 3], trem: 0.06, course: 12, lvl: 0.17 },
      saz: { id: 'saz', dur: 1.0, t60: 0.75, bright: 0.9, damp: 0.45, buzz: 0.25, pick: 0.09, body: [800, 5], trem: 0.07, course: 12, lvl: 0.17 },
      bouzouki: { id: 'bouz', dur: 1.0, t60: 0.85, bright: 0.92, damp: 0.44, pick: 0.08, body: [1000, 4], trem: 0.055, course: 12, lvl: 0.16 },
      guitar: { id: 'gtr', dur: 1.5, t60: 1.3, bright: 0.6, damp: 0.5, pick: 0.15, body: [180, 6, 1], lvl: 0.24 },
      flamenco: { id: 'flam', dur: 1.0, t60: 0.8, bright: 0.85, damp: 0.46, pick: 0.1, body: [220, 6, 1], lvl: 0.22, click: 0.3 },
      pguitar: { id: 'pgtr', dur: 1.4, t60: 1.2, bright: 0.85, damp: 0.45, pick: 0.09, body: [1100, 4], trem: 0.055, course: 0.08, lvl: 0.17 },
      mandolin: { id: 'mand', dur: 0.8, t60: 0.6, bright: 0.85, damp: 0.46, pick: 0.1, body: [1200, 3], trem: 0.055, course: 0.1, lvl: 0.17 },
      cavaquinho: { id: 'cav', dur: 0.6, t60: 0.4, bright: 0.95, damp: 0.45, pick: 0.1, body: [1300, 4], lvl: 0.2, mute: true },
      charango: { id: 'char', dur: 0.8, t60: 0.6, bright: 1, damp: 0.44, pick: 0.07, body: [1500, 4], course: 12, lvl: 0.16 },
      harp: { id: 'harp', dur: 2.4, t60: 2.4, bright: 0.35, damp: 0.5, pick: 0.25, lvl: 0.26 },
      kora: { id: 'kora', dur: 1.6, t60: 1.4, bright: 0.5, damp: 0.5, buzz: 0.12, pick: 0.2, body: [450, 4], lvl: 0.24 },
      banjo: { id: 'banjo', dur: 0.6, t60: 0.38, bright: 1, damp: 0.43, pick: 0.07, body: [1800, 7, 1.5], lvl: 0.2, click: 0.4 },
      guembri: { id: 'gmb', dur: 0.7, t60: 0.5, bright: 0.4, damp: 0.5, buzz: 0.6, pick: 0.2, body: [200, 6], lvl: 0.32, click: 0.5 },
      ukulele: { id: 'uke', dur: 0.8, t60: 0.6, bright: 0.7, damp: 0.48, pick: 0.15, body: [600, 4], lvl: 0.22 },
      cimbalom: { id: 'cimb', dur: 1.6, t60: 1.4, bright: 0.95, damp: 0.44, pick: 0.12, course: 0.12, trem: 0.06, lvl: 0.15, click: 0.3 },
      kantele: { id: 'kant', dur: 2.4, t60: 2.4, bright: 0.45, damp: 0.5, pick: 0.2, body: [600, 3], lvl: 0.24 },
      zither: { id: 'zith', dur: 1.8, t60: 1.6, bright: 0.75, damp: 0.47, pick: 0.1, course: 0.1, lvl: 0.17 },
      viola: { id: 'viola', dur: 1.2, t60: 1.0, bright: 0.85, damp: 0.46, pick: 0.1, course: 12, body: [700, 4], lvl: 0.16 },
      highlife: { id: 'hl', dur: 0.8, t60: 0.6, bright: 0.75, damp: 0.47, pick: 0.15, body: [900, 3], lvl: 0.2 },
      tres: { id: 'tres', dur: 0.8, t60: 0.6, bright: 0.9, damp: 0.45, pick: 0.1, course: 12, body: [1000, 4], lvl: 0.16 },
      dantranh: { id: 'dtr', dur: 1.8, t60: 1.6, bright: 0.6, damp: 0.48, pick: 0.14, vib: [5, 40], bend: 1.05, lvl: 0.22 },
      gambus: { id: 'gmbs', dur: 0.8, t60: 0.5, bright: 0.7, damp: 0.48, pick: 0.12, body: [400, 5], lvl: 0.24 },
      electric: { id: 'elec', dur: 1.0, t60: 1.0, bright: 0.8, damp: 0.47, buzz: 1.2, pick: 0.12, body: [800, 6], lvl: 0.14 },
    };
    const I = {};
    Object.keys(KSI).forEach((k) => (I[k] = pl(KSI[k])));

    /* ---------- winds: breath, chiff, scoops; Japanese and Korean flutes bend into notes ---------- */
    const W = (o) => (m, t, d, p) => voice(hz(m + (o.oct || 0)), t, Math.max(0.12, d), p * (o.lvl || 0.1), o);
    Object.assign(I, {
      shakuhachi: W({ waves: [['sine', 1, 1], ['triangle', 2, 0.18]], a: 0.09, r: 0.18, breath: 0.6, breathQ: 4, scoop: 0.93, scoopT: 0.16, vib: [5.5, 28, 0.45], lvl: 0.13, swell: 1.25 }),
      shinobue: W({ waves: [['sine', 1, 1], ['sine', 2, 0.25]], oct: 12, a: 0.025, r: 0.08, breath: 0.35, vib: [6.5, 22, 0.25], lvl: 0.085 }),
      dizi: W({ waves: [['triangle', 1, 1], ['sawtooth', 1, 0.08]], oct: 12, a: 0.03, r: 0.09, breath: 0.25, breathMul: 2, breathQ: 14, vib: [6, 26, 0.2], scoop: 0.97, lvl: 0.08 }),
      daegeum: W({ waves: [['sine', 1, 1], ['sawtooth', 1, 0.06]], a: 0.08, r: 0.2, breath: 0.4, breathMul: 3, breathQ: 10, vib: [3.8, 55, 0.4], scoop: 0.95, scoopT: 0.15, lvl: 0.12, swell: 1.2 }),
      bansuri: W({ waves: [['sine', 1, 1], ['sine', 2, 0.12]], a: 0.05, r: 0.15, breath: 0.4, scoop: 0.96, scoopT: 0.1, vib: [5.5, 20, 0.3], lvl: 0.12 }),
      ney: W({ waves: [['sine', 1, 1], ['triangle', 3, 0.08]], a: 0.1, r: 0.2, breath: 0.95, breathQ: 3, vib: [5, 22, 0.35], scoop: 0.97, lvl: 0.12, swell: 1.15 }),
      quena: W({ waves: [['sine', 1, 1], ['triangle', 2, 0.15]], oct: 12, a: 0.04, r: 0.1, breath: 0.45, vib: [6, 24, 0.25], lvl: 0.085 }),
      panpipe: W({ waves: [['sine', 1, 1], ['sine', 3, 0.06]], oct: 12, a: 0.02, r: 0.15, breath: 0.7, breathQ: 5, vib: [5.5, 15, 0.3], lvl: 0.09 }),
      suling: W({ waves: [['sine', 1, 1], ['sine', 2, 0.1]], oct: 12, a: 0.04, r: 0.12, breath: 0.4, vib: [5, 18, 0.25], lvl: 0.08 }),
      khlui: W({ waves: [['sine', 1, 1], ['triangle', 2, 0.1]], oct: 12, a: 0.03, r: 0.1, breath: 0.35, vib: [7, 30, 0.15], lvl: 0.08 }),
      whistle: W({ waves: [['sine', 1, 1], ['sine', 2, 0.05]], oct: 12, a: 0.015, r: 0.06, breath: 0.2, vib: [6, 14, 0.2], scoop: 0.98, scoopT: 0.03, lvl: 0.085 }),
      fife: W({ waves: [['triangle', 1, 1], ['sine', 2, 0.2]], oct: 12, a: 0.015, r: 0.05, breath: 0.25, vib: [6.5, 18, 0.15], lvl: 0.08 }),
      koauau: W({ waves: [['sine', 1, 1]], a: 0.1, r: 0.2, breath: 1.1, breathQ: 3, vib: [4.5, 25, 0.3], scoop: 0.95, lvl: 0.12 }),
      flute: W({ waves: [['sine', 1, 1], ['triangle', 2, 0.1]], oct: 12, a: 0.05, r: 0.1, breath: 0.15, vib: [5, 16, 0.2], lvl: 0.085 }),
      gaita: W({ waves: [['triangle', 1, 1], ['sawtooth', 1, 0.15]], oct: 12, a: 0.03, r: 0.08, breath: 0.5, breathQ: 5, vib: [5, 20, 0.2], lvl: 0.08 }),
    });
    /* reeds: a nasal buzz shaped by formants */
    const R = (o) => (m, t, d, p) => voice(hz(m + (o.oct || 0)), t, Math.max(0.1, d), p * (o.lvl || 0.05), o);
    Object.assign(I, {
      shehnai: R({ waves: [['sawtooth', 1, 1], ['square', 1, 0.4]], a: 0.03, r: 0.1, formants: [[1250, 14, 3], [2600, 8, 3]], lp: 4200, vib: [6, 35, 0.15], scoop: 0.95, scoopT: 0.07, lvl: 0.035 }),
      zurna: R({ waves: [['sawtooth', 1, 1], ['square', 2, 0.3]], a: 0.015, r: 0.05, formants: [[1500, 16, 2.5], [3000, 10, 3]], lp: 5500, vib: [6.5, 25, 0.15], lvl: 0.03 }),
      clarinet: R({ waves: [['square', 1, 1], ['sine', 1, 0.4]], a: 0.04, r: 0.1, formants: [[1500, 6, 2]], lp: 2600, vib: [5.5, 25, 0.25], scoop: 0.97, lvl: 0.045 }),
      mijwiz: R({ waves: [['square', 1, 1, -12], ['square', 1, 1, 12]], a: 0.02, r: 0.05, formants: [[1800, 12, 3]], lp: 4200, vib: [6, 20, 0.15], lvl: 0.03 }),
      accordion: R({ waves: [['square', 1, 1, -11], ['square', 1, 1, 11], ['sawtooth', 2, 0.3]], a: 0.04, r: 0.08, formants: [[1100, 6, 1.5]], lp: 2400, lvl: 0.028 }),
      bandoneon: R({ waves: [['square', 1, 1, -5], ['sawtooth', 1, 0.6, 5], ['square', 2, 0.4]], a: 0.05, r: 0.12, formants: [[700, 8, 1.5], [1800, 4, 2]], lp: 2000, swell: 1.4, lvl: 0.03 }),
      concertina: R({ waves: [['square', 1, 1, -8], ['square', 1, 0.8, 8]], a: 0.02, r: 0.05, formants: [[1300, 6, 2]], lp: 3000, lvl: 0.028 }),
      harmonica: R({ waves: [['square', 1, 1], ['sawtooth', 1, 0.4]], a: 0.03, r: 0.08, formants: [[1600, 12, 2.5]], lp: 3200, scoop: 0.94, scoopT: 0.12, trem: [6, 0.2], lvl: 0.035 }),
      sax: R({ waves: [['sawtooth', 1, 1], ['square', 1, 0.3]], a: 0.04, r: 0.1, formants: [[600, 9, 1.5], [1500, 5, 2]], lp: 2800, scoop: 0.96, vib: [5, 25, 0.3], lvl: 0.04 }),
      streetorgan: R({ waves: [['square', 1, 0.7], ['sine', 2, 0.6], ['square', 4, 0.15], ['sine', 0.5, 0.4]], a: 0.01, r: 0.05, lp: 3500, trem: [7, 0.25], lvl: 0.035 }),
      organ: R({ waves: [['sine', 1, 1], ['sine', 2, 0.7], ['sine', 3, 0.4], ['sine', 4, 0.25], ['sine', 0.5, 0.6]], a: 0.01, r: 0.08, vib: [6.5, 12, 0.05], lvl: 0.045 }),
      hurdygurdy: R({ waves: [['sawtooth', 1, 1, -4], ['sawtooth', 1, 0.8, 4]], a: 0.03, r: 0.08, formants: [[900, 8, 2], [2500, 6, 3]], lp: 3800, trem: [11, 0.1], lvl: 0.035 }),
      dolcaina: R({ waves: [['sawtooth', 1, 1], ['square', 1, 0.5]], oct: 12, a: 0.02, r: 0.05, formants: [[1400, 14, 2.5]], lp: 5200, vib: [6, 20, 0.15], lvl: 0.026 }),
      serunai: R({ waves: [['sawtooth', 1, 1], ['square', 1, 0.5]], a: 0.02, r: 0.06, formants: [[1600, 14, 2.5]], lp: 5000, vib: [6, 40, 0.1], scoop: 0.96, lvl: 0.03 }),
    });
    // bagpipes: a chanter with the pipe-band grace note (a quick high G) before each note, over the drones
    const chanterV = R({ waves: [['sawtooth', 1, 1], ['square', 1, 0.5]], oct: 12, a: 0.008, r: 0.04, formants: [[1300, 10, 2], [2900, 8, 3]], lp: 5000, lvl: 0.035 });
    I.pipes = (m, t, d, p) => { const g = d > 0.14; if (g) chanterV(m + 7, t, 0.035, p * 0.9); chanterV(m, t + (g ? 0.035 : 0), Math.max(0.08, d - 0.035), p); };
    const uilleannV = R({ waves: [['sawtooth', 1, 0.8], ['sine', 1, 0.6]], oct: 12, a: 0.02, r: 0.05, formants: [[1100, 7, 2]], lp: 3200, vib: [5.5, 10, 0.25], lvl: 0.035 });
    I.uilleann = (m, t, d, p) => { const g = d > 0.2; if (g) uilleannV(m + 4, t, 0.04, p * 0.7); uilleannV(m, t + (g ? 0.04 : 0), Math.max(0.08, d - 0.04), p); };
    I.whistleCut = (m, t, d, p) => { const g = d > 0.2; if (g) I.whistle(m + 3, t, 0.03, p * 0.7); I.whistle(m, t + (g ? 0.03 : 0), Math.max(0.08, d - 0.03), p); };
    /* bows */
    const B = (o) => (m, t, d, p) => voice(hz(m + (o.oct || 0)), t, Math.max(0.12, d), p * (o.lvl || 0.05), o);
    Object.assign(I, {
      erhu: B({ waves: [['sawtooth', 1, 1]], a: 0.07, r: 0.12, formants: [[950, 12, 2.2], [2200, 6, 3]], lp: 3400, scoop: 0.93, scoopT: 0.12, vib: [5.5, 35, 0.15], lvl: 0.04 }),
      haegeum: B({ waves: [['sawtooth', 1, 1]], a: 0.05, r: 0.1, formants: [[1200, 14, 2.5]], lp: 3600, scoop: 0.92, scoopT: 0.14, vib: [4.5, 50, 0.2], lvl: 0.035 }),
      fiddle: B({ waves: [['sawtooth', 1, 1]], a: 0.03, r: 0.07, formants: [[500, 6, 1.5], [2800, 5, 2]], lp: 4200, vib: [6, 15, 0.12], lvl: 0.042 }),
      violin: B({ waves: [['sawtooth', 1, 1, -4], ['sawtooth', 1, 0.7, 5]], a: 0.07, r: 0.15, formants: [[450, 6, 1.5], [2600, 5, 2]], lp: 4500, vib: [5.5, 20, 0.2], lvl: 0.035 }),
      kamanja: B({ waves: [['sawtooth', 1, 1]], a: 0.06, r: 0.12, formants: [[700, 7, 1.5]], lp: 3800, scoop: 0.95, scoopT: 0.1, vib: [6, 30, 0.15], lvl: 0.04 }),
      cello: B({ waves: [['sawtooth', 1, 1]], a: 0.03, r: 0.1, formants: [[250, 6, 1.2]], lp: 1800, lvl: 0.055 }),
    });
    I.hardanger = (m, t, d, p) => { I.fiddle(m, t, d, p); voice(hz(m + 7), t, Math.max(0.2, d * 1.3), p * 0.012, { waves: [['sine', 1, 1], ['sine', 2, 0.5]], a: 0.15, r: 0.5 }); };
    const nyckO = { id: 'nyck', dur: 1.6, t60: 1.6, bright: 0.3, damp: 0.5 };
    I.nyckelharpa = (m, t, d, p) => { I.fiddle(m, t, d, p * 0.9); ks(m + 12, t, d, p * 0.05, nyckO); ks(m + 19, t + 0.01, d, p * 0.035, nyckO); };
    /* brass and horns */
    Object.assign(I, {
      brass: (m, t, d, p) => voice(hz(m), t, Math.max(0.15, d), p * 0.055, { waves: [['sawtooth', 1, 1]], a: 0.05, r: 0.12, lp: 900, lp2: 2600, vib: [5, 12, 0.25] }),
      trumpet: (m, t, d, p) => voice(hz(m), t, Math.max(0.12, d), p * 0.045, { waves: [['sawtooth', 1, 1]], a: 0.03, r: 0.08, lp: 1800, lp2: 3400, formants: [[1300, 5, 2]], vib: [5.5, 15, 0.2] }),
      mtrumpet: (m, t, d, p) => voice(hz(m), t, Math.max(0.12, d), p * 0.045, { waves: [['sawtooth', 1, 1]], a: 0.02, r: 0.08, lp: 2600, lp2: 4200, formants: [[1400, 7, 2]], vib: [6.5, 28, 0.08] }),
      alphorn: (m, t, d, p) => voice(hz(m - 12), t, Math.max(0.3, d), p * 0.08, { waves: [['sine', 1, 1], ['triangle', 2, 0.35], ['sine', 3, 0.2]], a: 0.12, r: 0.3, scoop: 0.97, scoopT: 0.12, lp: 1400, swell: 1.2 }),
      tuba: (m, t, d, p) => voice(hz(m), t, Math.max(0.12, d), p * 0.07, { waves: [['sawtooth', 1, 1]], a: 0.03, r: 0.06, lp: 500 }),
      conch: (m, t, d, p) => voice(hz(m - 12), t, Math.max(0.4, d), p * 0.06, { waves: [['sawtooth', 1, 0.7], ['sine', 1, 1]], a: 0.15, r: 0.25, scoop: 0.88, scoopT: 0.25, lp: 1200, breath: 0.4, vib: [4, 20, 0.3] }),
      vuvuzela: (m, t, d, p) => voice(hz(46), t, Math.max(0.3, d), p * 0.04, { waves: [['sawtooth', 1, 1], ['square', 1, 0.5]], a: 0.04, r: 0.12, formants: [[600, 10, 2], [1300, 8, 2]], lp: 3000, scoop: 0.92, scoopT: 0.08, vib: [4, 15, 0.1] }),
      didge: (m, t, d, p) => voice(hz(m), t, d, p * 0.07, { waves: [['sawtooth', 1, 1]], a: 0.15, r: 0.2, lp: 320, q: 6, formants: [[450, 12, 4], [900, 6, 4]], trem: [2.2, 0.3] }),
      horns: (ns, t, d, p) => ns.forEach((m) => voice(hz(m), t, Math.max(0.1, d), ((p * 0.05) / ns.length) * 2, { waves: [['sawtooth', 1, 1]], a: 0.02, r: 0.08, lp: 2200, lp2: 1200 })),
    });
    I.danbau = (m, t, d, p) => voice(hz(m + 12), t, Math.max(0.2, d), p * 0.1, { waves: [['sine', 1, 1], ['triangle', 2, 0.1]], a: 0.01, r: 0.25, scoop: 0.89, scoopT: 0.22, vib: [5, 45, 0.25], sus: 0.6, bend: 0.94, bendAt: 0.7, bendT: 0.2 });
    I.pedalsteel = (m, t, d, p) => voice(hz(m), t, Math.max(0.2, d), p * 0.05, { waves: [['sawtooth', 1, 0.6], ['sine', 1, 1]], a: 0.04, r: 0.3, scoop: 0.89, scoopT: 0.22, lp: 2600, vib: [5, 12, 0.3] });
    I.synth = (m, t, d, p) => voice(hz(m), t, Math.max(0.1, d), p * 0.03, { waves: [['square', 1, 1], ['sawtooth', 1, 0.6, 9]], a: 0.01, r: 0.08, lp: 2600, lp2: 1400 });
    I.saw = (m, t, d, p) => voice(hz(m), t, Math.max(0.1, d), p * 0.026, { waves: [['sawtooth', 1, 1, -12], ['sawtooth', 1, 1, 12], ['sawtooth', 2, 0.3]], a: 0.02, r: 0.2, lp: 3200, vib: [5, 10, 0.3] });
    I.acid = (m, t, d, p) => tone('sawtooth', hz(m), t, 0.004, Math.max(0.1, d), p * 0.06, { lp: 3800, lp2: 300, q: 14 });
    I.gtrlead = (m, t, d, p) => { ks(m, t, d, p * 0.13, KSI.electric); voice(hz(m), t, Math.max(0.15, d), p * 0.018, { waves: [['sawtooth', 1, 1]], a: 0.08, r: 0.2, lp: 2200, vib: [5.5, 25, 0.25] }); };
    /* mallets and metal */
    const pnoO = { id: 'pno', dur: 1.8, t60: 1.6, bright: 0.4, damp: 0.5, pick: 0.12 }, plkO = { id: 'pluck', dur: 0.7, t60: 0.5, bright: 0.7, damp: 0.5 };
    Object.assign(I, {
      marimba: (m, t, d, p) => strike(hz(m), t, p * 0.12, [[1, 1, 0.45], [4, 0.1, 0.06]]),
      balafon: (m, t, d, p) => { strike(hz(m), t, p * 0.12, [[1, 1, 0.3], [3.9, 0.15, 0.05]]); noise(t, 0.003, 0.25, p * 0.012, 'bandpass', hz(m) * 2, 0, 12); },
      gender: (m, t, d, p) => { strike(hz(m), t, p * 0.06, [[1, 1, 1.4], [2.76, 0.12, 0.3]]); strike(hz(m) * 1.012, t, p * 0.05, [[1, 1, 1.4]]); },
      bonang: (m, t, d, p) => strike(hz(m), t, p * 0.07, [[1, 1, 0.8], [1.52, 0.25, 0.4], [3.1, 0.1, 0.15]]),
      kulintang: (m, t, d, p) => strike(hz(m), t, p * 0.08, [[1, 1, 0.6], [2.08, 0.3, 0.3], [3.9, 0.08, 0.1]]),
      ranat: (m, t, d, p) => { const n = d > 0.3 ? Math.floor(d / 0.07) : 1; for (let k = 0; k < n; k++) strike(hz(m), t + k * 0.07, p * 0.08 * (k ? 0.7 : 1), [[1, 1, 0.2], [3.2, 0.2, 0.04]]); },
      steelpan: (m, t, d, p) => strike(hz(m), t, p * 0.07, [[1, 1, 0.8], [2, 0.45, 0.4], [3, 0.2, 0.2], [2.01, 0.2, 0.6]], 0.006),
      kalimba: (m, t, d, p) => { strike(hz(m), t, p * 0.1, [[1, 1, 0.6], [4.2, 0.12, 0.06]]); noise(t, 0.002, 0.15, p * 0.006, 'bandpass', 3000, 0, 4); },
      bell: (m, t, d, p) => strike(hz(m), t, p * 0.045, [[1, 1, 1.1], [2.76, 0.1, 0.25]]),
      carillon: (m, t, d, p) => strike(hz(m), t, p * 0.035, [[1, 1, 1.4], [2.4, 0.12, 0.5], [0.5, 0.3, 1.6]]),
      piano: (m, t, d, p) => { ks(m, t, d, p * 0.12, pnoO); tone('sine', hz(m), t, 0.003, 0.8, p * 0.03); },
      epiano: (m, t, d, p) => strike(hz(m), t, p * 0.08, [[1, 1, 1.0], [2, 0.1, 0.4], [7, 0.04, 0.05]]),
      pluck: (m, t, d, p) => ks(m, t, d, p * 0.2, plkO),
    });
    /* chord voices */
    const tanpO = { id: 'tanp', dur: 2.6, t60: 3.0, bright: 0.7, damp: 0.48, buzz: 0.9, pick: 0.05 };
    Object.assign(I, {
      pad: (ns, t, d, p, lp) => ns.forEach((m) => [-7, 7].forEach((dt) => voice(hz(m), t, d, (p * 0.03) / ns.length, { waves: [['sawtooth', 1, 1, dt]], a: Math.min(0.5, d * 0.3), r: 0.3, lp: lp || 1100 }))),
      strings: (ns, t, d, p) => ns.forEach((m) => voice(hz(m), t, d, (p * 0.045) / ns.length, { waves: [['sawtooth', 1, 1, -6], ['sawtooth', 1, 1, 6]], a: Math.min(0.4, d * 0.25), r: 0.3, lp: 1500, vib: [5, 8, 0.3] })),
      choir: (ns, t, d, p) => ns.forEach((m) => voice(hz(m), t, d, (p * 0.06) / ns.length, { waves: [['triangle', 1, 1], ['sawtooth', 1, 0.15]], a: Math.min(0.6, d * 0.35), r: 0.3, formants: [[700, 8, 2], [1150, 6, 2]], lp: 2200, vib: [4.5, 9, 0.3] })),
      tanpura: (m, t, d, p) => [7, 12, 12, 0].forEach((o, i) => ks(m + o - 12, t + i * (d / 4), d, p * 0.08, tanpO)),
      drone: (ns, t, d, p) => ns.forEach((m) => voice(hz(m), t, d, (p * 0.035) / ns.length, { waves: [['sawtooth', 1, 1]], a: 0.3, r: 0.3, lp: 700 })),
      pipedrone: (m, t, d, p) => [-12, -24, -24].forEach((o, i) => voice(hz(m + o), t, d, p * 0.014, { waves: [['sawtooth', 1, 1, i * 4]], a: 0.2, r: 0.2, formants: [[700, 6, 2]], lp: 2400 })),
      power: (ns, t, d, p) => [ns[0] - 12, ns[0] - 5, ns[0]].forEach((m) => ks(m, t, d, p * 0.08, KSI.electric)),
      organchord: (ns, t, d, p) => ns.forEach((m) => I.organ(m, t, d, p * 0.5)),
    });
    /* basses */
    Object.assign(I, {
      bass: (m, t, d, p) => voice(hz(m), t, Math.max(0.12, d), p * 0.11, { waves: [['triangle', 1, 1]], a: 0.01, r: 0.08, lp: 700 }),
      ebass: (m, t, d, p) => ks(m, t, d, p * 0.32, { id: 'ebass', dur: 1.0, t60: 1.0, bright: 0.35, damp: 0.5, pick: 0.2, mute: true }),
      upright: (m, t, d, p) => ks(m, t, d, p * 0.36, { id: 'upr', dur: 0.9, t60: 0.6, bright: 0.25, damp: 0.5, pick: 0.25, mute: true }),
      guitarron: (m, t, d, p) => ks(m, t, d, p * 0.36, { id: 'gtrn', dur: 0.9, t60: 0.7, bright: 0.5, damp: 0.48, pick: 0.15, body: [140, 6] }),
      synbass: (m, t, d, p) => tone('sawtooth', hz(m), t, 0.005, Math.max(0.1, d), p * 0.075, { lp: 900, lp2: 250, q: 4 }),
      sub808: (m, t, d, p) => tone('sine', hz(m), t, 0.004, Math.max(0.4, d * 1.4), p * 0.38, { from: 1.6, fromT: 0.04 }),
      logdrum: (m, t, d, p) => { tone('sine', hz(m), t, 0.003, 0.5, p * 0.4, { from: 1.5, fromT: 0.03, bend2: 0.92, bend2T: 0.45 }); tone('triangle', hz(m) * 2, t, 0.002, 0.08, p * 0.08); },
    });

    /* ---------- percussion ---------- */
    Object.assign(I, {
      kick: (t, p) => tone('sine', 120, t, 0.002, 0.28, p * 0.5, { bend: 0.35, bendT: 0.12 }),
      kick808: (t, p) => tone('sine', 60, t, 0.002, 0.7, p * 0.6, { from: 2.2, fromT: 0.05 }),
      hardkick: (t, p) => { tone('sine', 55, t, 0.001, 0.4, p * 0.6, { from: 4, fromT: 0.06 }); noise(t, 0.001, 0.05, p * 0.2, 'bandpass', 2500, 0, 1); },
      snare: (t, p) => { noise(t, 0.002, 0.16, p * 0.17, 'bandpass', 1800, 1200, 0.8); tone('triangle', 190, t, 0.002, 0.08, p * 0.08); },
      pipesnare: (t, p) => { noise(t, 0.001, 0.07, p * 0.2, 'highpass', 2500, 0, 0.8); tone('triangle', 330, t, 0.001, 0.04, p * 0.06); },
      roll: (t, p, len, n) => { n = n || 8; for (let k = 0; k < n; k++) noise(t + (k * len) / n, 0.001, 0.05, p * 0.05 * (0.5 + k / n), 'bandpass', 2000, 0, 0.8); },
      clap: (t, p) => [0, 0.012, 0.024].forEach((o, i) => noise(t + o, 0.001, i === 2 ? 0.14 : 0.02, p * 0.15, 'bandpass', 1500, 1300, 1.2)),
      snap: (t, p) => noise(t, 0.001, 0.05, p * 0.18, 'bandpass', 2600, 0, 2),
      palmas: (t, p) => [0, 0.008].forEach((o) => noise(t + o, 0.001, 0.05, p * 0.13, 'bandpass', 1900, 0, 1.6)),
      hat: (t, p, open) => noise(t, 0.001, open ? 0.18 : 0.04, p * 0.045, 'highpass', 8000, 0, 0.7),
      crash: (t, p) => noise(t, 0.003, 1.4, p * 0.07, 'highpass', 5000, 3000, 0.5),
      shaker: (t, p) => noise(t, 0.008, 0.05, p * 0.03, 'highpass', 6000, 0, 0.6),
      shekere: (t, p) => noise(t, 0.01, 0.07, p * 0.035, 'bandpass', 5000, 0, 1.2),
      rim: (t, p) => { tone('triangle', 1700, t, 0.001, 0.03, p * 0.06); noise(t, 0.001, 0.02, p * 0.04, 'bandpass', 3000, 0, 3); },
      wood: (t, p, f) => tone('sine', f || 900, t, 0.001, 0.06, p * 0.12),
      clack: (t, p) => { tone('square', 2100, t, 0.001, 0.02, p * 0.05); noise(t, 0.001, 0.03, p * 0.1, 'bandpass', 2400, 0, 5); }, // hyoshigi clappers
      clave: (t, p) => tone('sine', 2500, t, 0.001, 0.05, p * 0.1),
      cowbell: (t, p, hi) => { tone('square', hi ? 800 : 560, t, 0.001, 0.12, p * 0.03, { lp: 3000 }); tone('square', (hi ? 800 : 560) * 1.48, t, 0.001, 0.1, p * 0.02, { lp: 3000 }); },
      alpbell: (t, p) => strike(620, t, p * 0.04, [[1, 1, 0.5], [2.4, 0.4, 0.3], [3.7, 0.2, 0.2]]),
      tom: (t, p, f) => tone('sine', f || 100, t, 0.002, 0.45, p * 0.32, { bend: 0.55, bendT: 0.25 }),
      taiko: (t, p, f) => { tone('sine', f || 62, t, 0.002, 0.7, p * 0.5, { from: 1.4, fromT: 0.03, bend2: 0.8, bend2T: 0.5 }); noise(t, 0.001, 0.12, p * 0.1, 'lowpass', 900, 200, 0.7); },
      shime: (t, p) => { tone('sine', 520, t, 0.001, 0.08, p * 0.1); noise(t, 0.001, 0.04, p * 0.08, 'bandpass', 2500, 0, 2); },
      kane: (t, p) => strike(1300, t, p * 0.035, [[1, 1, 0.25], [1.7, 0.6, 0.2], [2.9, 0.4, 0.15]]),
      timpani: (t, p, m) => tone('sine', hz(m), t, 0.004, 1.1, p * 0.3, { bend: 0.97, bendT: 0.5 }),
      gong: (t, p) => { tone('sine', 98, t, 0.01, 3, p * 0.12, { wob: [3.5, 0.01] }); tone('sine', 147, t, 0.01, 2.2, p * 0.05); noise(t, 0.01, 1.5, p * 0.02, 'bandpass', 600, 300, 1); },
      operagong: (t, p) => { tone('triangle', 330, t, 0.002, 0.9, p * 0.07, { bend: 1.22, bendT: 0.35 }); tone('sine', 495, t, 0.002, 0.7, p * 0.04, { bend: 1.22, bendT: 0.35 }); noise(t, 0.002, 0.5, p * 0.03, 'bandpass', 3000, 0, 1); },
      jing: (t, p) => { tone('sine', 110, t, 0.02, 3, p * 0.14, { wob: [5, 0.015] }); tone('sine', 165, t, 0.02, 2.2, p * 0.05, { wob: [5, 0.015] }); },
      kkwaenggwari: (t, p) => strike(1650, t, p * 0.05, [[1, 1, 0.18], [1.48, 0.6, 0.14], [2.3, 0.4, 0.1]]),
      bo: (t, p) => noise(t, 0.002, 0.7, p * 0.09, 'bandpass', 4200, 2800, 0.7),
      ching: (t, p, open) => strike(2600, t, p * 0.04, [[1, 1, open ? 0.6 : 0.08], [1.9, 0.5, open ? 0.4 : 0.06]]),
      tanggu: (t, p) => tone('sine', 140, t, 0.002, 0.3, p * 0.3, { bend: 0.8, bendT: 0.15 }),
      janggu: (t, p, hi) => (hi ? noise(t, 0.001, 0.06, p * 0.14, 'bandpass', 2200, 0, 2) : tone('sine', 120, t, 0.002, 0.35, p * 0.32, { from: 1.3, fromT: 0.03 })),
      kendang: (t, p, hi) => (hi ? noise(t, 0.001, 0.05, p * 0.12, 'bandpass', 1800, 0, 2.5) : tone('sine', 95, t, 0.002, 0.35, p * 0.3, { bend: 1.3, bendT: 0.12 })),
      kompang: (t, p) => { tone('sine', 230, t, 0.001, 0.12, p * 0.15); noise(t, 0.001, 0.06, p * 0.12, 'bandpass', 1700, 0, 1.5); },
      dhol: (t, p, hi) => (hi ? noise(t, 0.001, 0.05, p * 0.16, 'bandpass', 3000, 0, 2) : tone('sine', 75, t, 0.002, 0.4, p * 0.45, { from: 1.3, fromT: 0.03 })),
      tabla: (t, p, hi) => (hi ? strike(560, t, p * 0.11, [[1, 1, 0.3], [2, 0.5, 0.2], [3, 0.3, 0.1]]) : tone('sine', 98, t, 0.002, 0.45, p * 0.28, { bend: 1.4, bendT: 0.25 })),
      doum: (t, p) => tone('sine', 95, t, 0.002, 0.35, p * 0.32, { bend: 0.7, bendT: 0.2 }),
      tek: (t, p) => { noise(t, 0.001, 0.05, p * 0.08, 'bandpass', 3200, 0, 2); tone('sine', 620, t, 0.001, 0.04, p * 0.05); },
      riq: (t, p) => { noise(t, 0.002, 0.09, p * 0.05, 'bandpass', 7500, 0, 3); tone('sine', 400, t, 0.001, 0.05, p * 0.04); },
      tabl: (t, p) => { tone('sine', 62, t, 0.002, 0.6, p * 0.5, { from: 1.3, fromT: 0.03 }); noise(t, 0.001, 0.08, p * 0.1, 'lowpass', 1200, 0, 0.7); },
      tar: (t, p) => { tone('sine', 85, t, 0.002, 0.5, p * 0.38); noise(t, 0.002, 0.12, p * 0.08, 'bandpass', 900, 0, 1); },
      qraqeb: (t, p) => [0, 0.018].forEach((o) => { noise(t + o, 0.001, 0.04, p * 0.1, 'bandpass', 5200, 0, 6); tone('square', 3100, t + o, 0.001, 0.02, p * 0.02); }),
      davul: (t, p, hi) => (hi ? noise(t, 0.001, 0.04, p * 0.12, 'bandpass', 2500, 0, 2) : tone('sine', 68, t, 0.002, 0.5, p * 0.48, { from: 1.4, fromT: 0.03 })),
      cajon: (t, p, hi) => (hi ? noise(t, 0.001, 0.1, p * 0.15, 'bandpass', 1500, 900, 1) : tone('sine', 85, t, 0.002, 0.25, p * 0.4, { from: 1.4, fromT: 0.02 })),
      quijada: (t, p) => { for (let k = 0; k < 7; k++) noise(t + k * 0.022, 0.001, 0.03, p * 0.06 * (1 - k / 9), 'bandpass', 3800, 0, 8); },
      castanets: (t, p) => [0, 0.025].forEach((o) => noise(t + o, 0.001, 0.025, p * 0.07, 'bandpass', 2600, 0, 4)),
      surdo: (t, p) => tone('sine', 68, t, 0.002, 0.5, p * 0.4, { bend: 0.8, bendT: 0.3 }),
      tamborim: (t, p) => { tone('sine', 900, t, 0.001, 0.05, p * 0.08); noise(t, 0.001, 0.03, p * 0.08, 'bandpass', 3500, 0, 2); },
      cuica: (t, p, up) => tone('sine', up ? 520 : 700, t, 0.01, 0.18, p * 0.09, { bend: up ? 1.7 : 0.6, bendT: 0.09, bend2: up ? 1.1 : 0.9, bend2T: 0.18 }),
      apito: (t, p, len) => { const n = Math.max(2, Math.round((len || 0.3) / 0.05)); for (let k = 0; k < n; k++) tone('sine', k % 2 ? 2400 : 2150, t + k * 0.05, 0.004, 0.045, p * 0.04); },
      agogo: (t, p, high) => strike(high ? 1320 : 990, t, p * 0.05, [[1, 1, 0.12], [2.6, 0.3, 0.05]]),
      bombo: (t, p, rim) => (rim ? noise(t, 0.001, 0.03, p * 0.1, 'bandpass', 2000, 0, 3) : tone('sine', 70, t, 0.002, 0.45, p * 0.42, { from: 1.2, fromT: 0.03 })),
      guacharaca: (t, p, len) => { const n = Math.max(2, Math.round((len || 0.12) / 0.012)); for (let k = 0; k < n; k++) noise(t + k * 0.012, 0.001, 0.008, p * 0.05, 'bandpass', 4500, 0, 4); },
      tambora: (t, p, hi) => (hi ? noise(t, 0.001, 0.03, p * 0.1, 'bandpass', 2200, 0, 3) : tone('sine', 90, t, 0.002, 0.3, p * 0.34)),
      conga: (t, p, hi) => tone('sine', hi ? 330 : 220, t, 0.002, 0.18, p * 0.2, { from: 1.1, fromT: 0.02 }),
      timbale: (t, p) => { tone('sine', 520, t, 0.001, 0.15, p * 0.12); noise(t, 0.001, 0.06, p * 0.06, 'bandpass', 3000, 0, 2); },
      talking: (t, p, dir) => tone('sine', 190, t, 0.003, 0.3, p * 0.3, { from: dir > 0 ? 0.8 : 1.3, fromT: 0.12, bend2: dir > 0 ? 1.15 : 0.85, bend2T: 0.25 }),
      djembe: (t, p, slap) => (slap ? noise(t, 0.001, 0.07, p * 0.12, 'bandpass', 1400, 0, 1.5) : tone('sine', 180, t, 0.002, 0.22, p * 0.22, { bend: 0.75, bendT: 0.1 })),
      clapsticks: (t, p) => { tone('sine', 1900, t, 0.001, 0.04, p * 0.1); tone('sine', 2700, t, 0.001, 0.03, p * 0.05); },
      stomp: (t, p) => { tone('sine', 55, t, 0.002, 0.25, p * 0.45, { from: 1.8, fromT: 0.03 }); noise(t, 0.002, 0.08, p * 0.1, 'lowpass', 600, 0, 0.7); },
      spoons: (t, p) => [0, 0.02].forEach((o) => noise(t + o, 0.001, 0.02, p * 0.09, 'bandpass', 3200, 0, 3)),
      bodhran: (t, p, f) => { tone('sine', f || 110, t, 0.002, 0.3, p * 0.3, { bend: 0.85, bendT: 0.15 }); noise(t, 0.001, 0.03, p * 0.05, 'bandpass', 1200, 0, 1.5); },
      brush: (t, p) => noise(t, 0.02, 0.1, p * 0.05, 'bandpass', 4000, 2500, 0.8),
      whip: (t, p) => noise(t, 0.001, 0.08, p * 0.2, 'highpass', 3000, 0, 0.7),
      jingle: (t, p) => [0, 0.015, 0.03].forEach((o) => noise(t + o, 0.001, 0.06, p * 0.025, 'bandpass', 9000, 0, 6)),
      footstamp: (t, p) => { tone('sine', 90, t, 0.002, 0.12, p * 0.3); noise(t, 0.001, 0.04, p * 0.08, 'bandpass', 700, 0, 1.2); },
      /* cinematic */
      boom: (t, p, m) => { tone('sine', hz(m || 33) * 2.6, t, 0.003, 1.5, p * 0.5, { bend: 0.36, bendT: 0.35 }); noise(t, 0.002, 0.6, p * 0.14, 'lowpass', 900, 120, 0.7); },
      braam: (ns, t, d, p) => ns.forEach((m) => [-14, 0, 14].forEach((dt) => voice(hz(m), t, d, (p * 0.06) / ns.length, { waves: [['sawtooth', 1, 1, dt]], a: 0.07, r: 0.3, lp: 600, q: 2 }))),
      riser: (t, d, p, m) => { noise(t, d, 0.04, p * 0.07, 'bandpass', 250, 7000, 1.2); tone('sawtooth', hz(m), t, d, 0.04, p * 0.02, { from: 0.5, fromT: d, lp: 1800 }); },
      revcym: (t, d, p) => noise(t, d, 0.03, p * 0.08, 'highpass', 4500, 7000, 0.6),
    });
    return I;
  }

  /* =====================================================================================================
     RHYTHMS: (I, step k of S, time, S, bar, phrase bar, key, step length)
     ===================================================================================================== */
  const DRUMS = {
    matsuri: (I, k, at, S, b, pb) => { if ([0, 6, 8, 11].includes(k)) I.taiko(at, k ? 0.7 : 1); if (k % 2 === 0) I.shime(at, k % 4 ? 0.5 : 0.8); if (k % 4 === 0) I.kane(at, 0.8); if (pb % 4 === 3 && k === 12) I.clack(at, 1); },
    taikoEns: (I, k, at, S, b, pb) => { if ([0, 3, 8, 10, 11].includes(k)) I.taiko(at, k === 0 ? 1.1 : 0.75, k === 0 ? 58 : 75); if (k % 4 === 2) I.shime(at, 0.6); if (pb % 4 === 3 && k >= 12) I.taiko(at, 0.6, 90); if (k === 14 && pb % 2) I.clack(at, 0.9); },
    janggu: (I, k, at) => { if ([0, 6].includes(k)) I.janggu(at, 1, false); if ([3, 4, 10, 12, 14].includes(k)) I.janggu(at, k === 12 ? 1 : 0.7, true); if (k === 8) I.janggu(at, 0.7, false); },
    samul: (I, k, at, S, b, pb) => { I.kkwaenggwari(at, k % 4 === 0 ? 1 : 0.45); if (k % 4 === 0) I.janggu(at, 0.9, false); if (k % 2) I.janggu(at, 0.5, true); if (k === 0 || k === 8) I.tanggu(at, 1); if (k === 0 && pb % 2 === 0) I.jing(at, 0.7); },
    tanggu: (I, k, at, S, b, pb) => { if ([0, 6, 8, 12].includes(k)) I.tanggu(at, k ? 0.7 : 1); if (k % 4 === 2) I.wood(at, 0.8, 1200); if (k === 0 && pb % 2 === 0) I.bo(at, 0.8); if (pb % 4 === 3 && k >= 12) I.tanggu(at, 0.6); },
    liondance: (I, k, at, S, b, pb) => { if ([0, 3, 6, 8, 10, 12].includes(k)) I.tanggu(at, k % 8 === 0 ? 1.2 : 0.8); if (k % 4 === 0) I.bo(at, 0.6); if (k === 8 || (k === 0 && pb % 2 === 0)) I.operagong(at, 0.8); },
    thai: (I, k, at) => { if (k % 4 === 0) I.ching(at, 1, k % 8 === 0); else if (k % 2 === 0) I.ching(at, 0.6, false); if ([0, 7, 10].includes(k)) I.tom(at, 0.6, 130); if ([4, 12].includes(k)) I.tom(at, 0.5, 200); },
    kendang: (I, k, at, S, b, pb) => { if ([0, 7, 10].includes(k)) I.kendang(at, 1, false); if ([3, 5, 12, 14].includes(k)) I.kendang(at, 0.8, true); if (k === 0 && pb % 2 === 0) I.gong(at, 0.6); },
    kompang: (I, k, at) => { if ([0, 3, 6, 8, 11, 14].includes(k)) I.kompang(at, k % 8 === 0 ? 1 : 0.7); if ([4, 12].includes(k)) I.tabla(at, 0.6, false); },
    dabakan: (I, k, at) => { if ([0, 3, 6, 10, 12].includes(k)) I.tom(at, k % 6 === 0 ? 0.7 : 0.45, 160); if (k % 4 === 2) I.ching(at, 0.4); },
    dhol: (I, k, at) => { if ([0, 3, 6, 8, 11, 14].includes(k)) I.dhol(at, 1, false); if ([2, 4, 7, 10, 12, 15].includes(k)) I.dhol(at, 0.8, true); },
    tabla: (I, k, at) => { if (k === 0 || k === 7 || k === 10) I.tabla(at, 1, false); if ([2, 4, 6, 9, 12, 14].includes(k)) I.tabla(at, 0.8, true); if (k === 13) I.tabla(at, 0.5, true); },
    khaleeji: (I, k, at) => { if ([0, 7, 10].includes(k)) I.tabl(at, 0.9); if ([4, 12].includes(k)) { I.clap(at, 1); I.tek(at, 0.8); } if ([3, 6, 14].includes(k)) I.tek(at, 0.6); if (k % 2 === 0) I.riq(at, 0.6); },
    ardah: (I, k, at) => { if ([0, 4, 8, 12].includes(k)) I.tar(at, 1); if ([6, 14].includes(k)) I.tabl(at, 0.8); if (k % 4 === 2) I.riq(at, 0.5); },
    maqsum: (I, k, at) => { if (k === 0 || k === 6 || k === 10) I.doum(at, 1); if (k === 4 || k === 12 || k === 14) I.tek(at, 1.1); if (k === 2 || k === 8) I.tek(at, 0.45); if (k % 2 === 0) I.riq(at, 0.5); },
    dabke: (I, k, at) => { if ([0, 3, 6, 8, 11].includes(k)) I.tabl(at, k % 8 === 0 ? 1 : 0.7); if ([4, 12].includes(k)) I.clap(at, 0.8); if (k % 2 === 0) I.tek(at, 0.4); },
    gnawa: (I, k, at, S) => { const p = S === 12 ? [0, 2, 3, 5, 6, 8, 9, 11] : [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]; if (p.includes(k)) I.qraqeb(at, k % (S / 4) === 0 ? 1 : 0.6); if (k === 0 || k === S / 2) I.tabl(at, 0.6); },
    davul: (I, k, at) => { if ([0, 6, 10].includes(k)) I.davul(at, 1, false); if ([4, 12, 14].includes(k)) I.davul(at, 0.8, true); if (k % 4 === 2) I.tek(at, 0.5); },
    syrtaki: (I, k, at) => { if (k % 4 === 0) I.bombo(at, k % 8 === 0 ? 0.8 : 0.5); if (k % 4 === 2) I.tamborim(at, 0.6); },
    flamenco: (I, k, at) => { if ([0, 3, 6, 8, 10, 12, 14].includes(k)) I.palmas(at, [0, 3, 6, 10].includes(k) ? 1 : 0.55); if ([0, 6, 10].includes(k)) I.cajon(at, 0.9, false); if ([3, 12].includes(k)) I.cajon(at, 0.8, true); if ([0, 3, 6, 10].includes(k)) I.castanets(at, 0.8); },
    rumba: (I, k, at) => { if ([0, 3, 6, 8, 11, 14].includes(k)) I.palmas(at, 0.9); if ([0, 8].includes(k)) I.cajon(at, 0.8, false); if ([4, 12].includes(k)) I.cajon(at, 0.9, true); },
    tabalet: (I, k, at) => { if (k % 4 === 0) I.snare(at, 0.6); if (k % 2 === 1) I.snare(at, 0.2); if (k === 0 || k === 8) I.bombo(at, 0.7); },
    tarantella: (I, k, at) => { I.jingle(at, k % 3 === 0 ? 1.2 : 0.6); if (k % 6 === 0) I.tom(at, 0.4, 160); },
    march: (I, k, at, S, b, pb) => { const q = S / 4; if (k % q === 0) I.kick(at, k ? 0.5 : 0.8); if (k % 2 === 0) I.snare(at, k % q === 0 ? 0.5 : 0.22); if (pb === 0 && k === 0) I.crash(at, 0.8); },
    anthem: (I, k, at, S, b, pb, key) => { const q = S / 4; if (k === 0 || k === 2 * q) I.kick(at, 0.9); if (k === q || k === 3 * q) I.snare(at, 0.9); if (k === 0 && pb % 2 === 0) I.timpani(at, 0.8, key - 24); if (pb % 4 === 3 && k >= 3 * q) I.tom(at, 0.7, 140 - (k - 3 * q) * 12); },
    oompah: (I, k, at, S, b, pb) => { const q = S / 4; if (k % q === 0) I.kick(at, k % (2 * q) ? 0.4 : 0.8); if (k % q === q / 2) I.snare(at, 0.35); if (k === 0 && pb === 0) I.crash(at, 0.8); },
    techno: (I, k, at) => { if (k % 4 === 0) I.hardkick(at, 1); if (k % 4 === 2) I.hat(at, 1.3, true); if (k === 4 || k === 12) I.clap(at, 0.8); I.hat(at, 0.4); },
    shanty: (I, k, at) => { if (k === 0 || k === 8) I.footstamp(at, 1); if (k === 4 || k === 12) I.clap(at, 0.9); },
    classical: (I, k, at, S, b, pb, key) => { if (k === 0) I.timpani(at, 0.7, key - 24); if (k === 8 && pb % 2) I.timpani(at, 0.5, key - 17); if (pb % 4 === 3 && k >= 12) I.timpani(at, 0.3 + (k - 12) * 0.1, key - 24); },
    alpine: (I, k, at, S) => { if (k % (S / 4) === 0) I.kick(at, 0.5); if (k % (S / 2) === S / 4) I.alpbell(at, 0.9); if (k % 2 === 1) I.shaker(at, 0.5); },
    polka: (I, k, at) => { if (k % 4 === 0) I.kick(at, 0.7); if (k % 4 === 2) { I.snare(at, 0.4); I.hat(at, 0.6); } },
    hora: (I, k, at) => { if ([0, 3, 6, 8].includes(k)) I.tom(at, 0.6, 120); if ([4, 12, 14].includes(k)) I.snare(at, 0.4); I.shaker(at, k % 2 ? 0.5 : 0.8); },
    pipeband: (I, k, at, S, b, pb) => { const q = S / 4; if (k % q === 0) I.tom(at, k ? 0.6 : 1, 70); I.pipesnare(at, k % q === 0 ? 0.9 : k % 2 ? 0.3 : 0.5); if (pb % 4 === 3 && k === 3 * q) I.roll(at, 1.2, 0.2, 8); },
    bodhran: (I, k, at) => { if (k % 3 === 0) I.bodhran(at, k % 6 === 0 ? 0.7 : 0.45, 110); else I.bodhran(at, 0.22, 170); },
    nordic: (I, k, at, S) => { if (k % (S / 4) === 0) I.footstamp(at, k ? 0.6 : 0.9); if (k % (S / 2) === S / 4) I.tom(at, 0.4, 150); },
    rock: (I, k, at, S, b, pb) => { const q = S / 4; if (k === 0 || k === q + q / 2 || k === 2 * q) I.kick(at, 1); if (k === q || k === 3 * q) I.snare(at, 1.1); if (k % (q / 2) === 0) I.hat(at, 0.8); if (pb % 4 === 0 && k === 0) I.crash(at, 1); },
    heavy: (I, k, at, S) => { const q = S / 4; if (k % 2 === 0 && k !== q && k !== 3 * q) I.kick(at, 1); if (k === q || k === 3 * q) I.snare(at, 1.2); if (k % q === 0) I.crash(at, 0.4); },
    trap: (I, k, at, S, b, pb) => { if ([0, 7, 10].includes(k)) I.kick808(at, 1); if (k === 8) { I.clap(at, 1); I.snap(at, 0.6); } I.hat(at, 0.6); if (pb % 2 === 1 && k >= 12) { I.hat(at + 0.03, 0.4); I.hat(at + 0.06, 0.3); } },
    boombap: (I, k, at) => { if ([0, 7, 10].includes(k)) I.kick(at, 1); if (k === 4 || k === 12) I.snare(at, 1.1); if (k % 2 === 0) I.hat(at, k % 4 ? 0.5 : 0.8); },
    blues: (I, k, at, S) => { const q = S / 4; if (k === 0 || k === 2 * q) I.kick(at, 0.8); if (k === q || k === 3 * q) I.snare(at, 0.8); if (k % 3 !== 1) I.hat(at, k % 3 ? 0.4 : 0.8); },
    disco: (I, k, at) => { if (k % 4 === 0) I.kick(at, 0.9); if (k === 4 || k === 12) I.snare(at, 0.8); if (k % 4 === 2) I.hat(at, 1.1, true); else I.hat(at, 0.4); },
    synthwave: (I, k, at) => { if (k === 0 || k === 8 || k === 10) I.kick(at, 0.9); if (k === 4 || k === 12) { I.snare(at, 1.2); I.clap(at, 0.4); } if (k % 2 === 0) I.hat(at, 0.5); },
    four: (I, k, at, S, b, pb) => { const q = S / 4; if (k % q === 0) I.kick(at, 1); if (k === q || k === 3 * q) I.clap(at, 1); if (k % q === q / 2) I.hat(at, 1.2, true); if (pb === 0 && k === 0) I.crash(at, 0.8); },
    hardstyle: (I, k, at) => { if (k % 4 === 0) I.hardkick(at, 1.2); if (k % 4 === 2) I.hat(at, 1, true); if (k === 4 || k === 12) I.clap(at, 0.6); },
    salsa: (I, k, at) => { if ([0, 3, 6, 10, 12].includes(k)) I.clave(at, 1); if ([4, 12].includes(k)) I.conga(at, 1, false); if ([6, 7, 14, 15].includes(k)) I.conga(at, 0.8, true); if (k % 2 === 0) I.cowbell(at, k % 4 ? 0.5 : 0.9, true); },
    western: (I, k, at) => { if (k === 0 || k === 8) I.kick(at, 0.6); if (k % 2 === 0) I.brush(at, k % 4 ? 0.6 : 1); if (k === 12) I.whip(at, 0.3); },
    train: (I, k, at, S) => { if (k === 0 || k === S / 2) I.kick(at, 0.8); if (k === S / 4 || k === (3 * S) / 4) I.snare(at, 0.7); I.brush(at, k % 2 ? 0.6 : 1); },
    quebec: (I, k, at, S) => { if (k % (S / 4) === 0) I.footstamp(at, 1); if (k % (S / 4) === S / 8) I.footstamp(at, 0.5); if (k % 2 === 1) I.spoons(at, 0.6); },
    six8: (I, k, at, S, b, pb) => { if (k === 0 || k === 6) I.kick(at, 0.8); if (k === 3 || k === 9) I.snare(at, 0.6); I.shaker(at, k % 3 === 0 ? 1 : 0.6); if (pb === 0 && k === 0) I.crash(at, 0.7); },
    norteno: (I, k, at) => { if (k % 4 === 0) I.kick(at, 0.8); if (k % 4 === 2) I.snare(at, 0.5); I.hat(at, 0.3); },
    cumbia: (I, k, at) => { if (k % 4 === 0) I.tambora(at, 0.9, false); if ([2, 6, 7, 10, 14, 15].includes(k)) I.tambora(at, 0.5, true); if (k % 2 === 0) I.guacharaca(at, k % 4 ? 0.6 : 1, 0.12); },
    dembow: (I, k, at) => { if (k % 4 === 0) I.kick808(at, 1); if ([3, 6, 11, 14].includes(k)) I.snare(at, 0.9); I.hat(at, 0.3); },
    afroperu: (I, k, at, S) => { const q = S / 4; if (k === 0 || k === 2 * q) I.cajon(at, 1, false); if (k % q === q - 1 || k === q + 1) I.cajon(at, 0.8, true); if (k === q) I.quijada(at, 0.9); },
    andes: (I, k, at, S) => { if (k === 0 || k === S / 2) I.bombo(at, 1, false); if (k === S / 4 + 2 || k === (3 * S) / 4) I.bombo(at, 0.7, true); I.shaker(at, k % 2 ? 0.4 : 0.7); },
    cueca: (I, k, at) => { if (k % 3 === 0) I.bombo(at, k % 6 === 0 ? 0.9 : 0.5, k % 6 !== 0); if (k % 6 === 3) I.palmas(at, 0.8); },
    samba: (I, k, at, S, b, pb) => { if (k === 4 || k === 12) I.surdo(at, 1); if (k === 0 || k === 8) I.surdo(at, 0.45); if ([0, 3, 6, 8, 11, 14].includes(k)) I.tamborim(at, 0.9); I.shaker(at, k % 2 ? 0.8 : 1.2); if ([2, 10].includes(k)) I.cuica(at, 0.8, true); if (k === 6 && pb % 2) I.cuica(at, 0.7, false); if (k % 4 === 0) I.agogo(at, 1, (k / 4) % 2 === 0); },
    bossa: (I, k, at) => { I.shaker(at, k % 2 ? 0.7 : 1.1); if ([0, 3, 6, 10, 12].includes(k)) I.rim(at, 1); if (k === 0 || k === 8) I.kick(at, 0.45); },
    forro: (I, k, at) => { if ([0, 6, 8].includes(k)) I.surdo(at, 0.7); if ([4, 12].includes(k)) I.rim(at, 0.6); I.agogo(at, k % 2 ? 0.25 : 0.5, true); },
    tango: (I, k, at, S) => { const q = S / 4; if (k === 0) I.kick(at, 0.5); if (k === 3 * q + 2) I.rim(at, 0.8); },
    candombe: (I, k, at) => { if ([0, 3, 4, 8, 11].includes(k)) I.tom(at, k % 4 === 0 ? 0.6 : 0.4, 120); if ([2, 6, 10, 14].includes(k)) I.tom(at, 0.4, 260); if ([3, 7].includes(k)) I.surdo(at, 0.8); if (k % 2 === 0) I.rim(at, 0.35); },
    afrobeat: (I, k, at) => { if ([0, 7, 10].includes(k)) I.kick(at, 0.9); if ([4, 12].includes(k)) I.snare(at, 0.7); I.shekere(at, k % 2 ? 0.6 : 1); if ([2, 6, 14].includes(k)) I.talking(at, 0.8, k === 6 ? -1 : 1); if (k % 4 === 2) I.cowbell(at, 0.5, true); },
    highlife: (I, k, at) => { if ([0, 3, 8, 11].includes(k)) I.djembe(at, 1, false); if ([4, 12, 14].includes(k)) I.djembe(at, 0.9, true); if ([0, 3, 6, 10, 12].includes(k)) I.agogo(at, 0.7, k % 2 === 0); I.shaker(at, 0.5); },
    benga: (I, k, at) => { if (k % 4 === 0) I.kick(at, 0.8); if (k % 4 === 2) I.snare(at, 0.5); I.hat(at, k % 2 ? 0.3 : 0.6); },
    amapiano: (I, k, at) => { if (k % 4 === 0) I.kick(at, 0.8); if ([4, 12].includes(k)) I.clap(at, 0.6); I.shaker(at, k % 2 ? 0.6 : 1); if ([6, 14].includes(k)) I.snap(at, 0.4); },
    maskandi: (I, k, at) => { if (k % 4 === 0) I.kick(at, 0.8); if (k % 4 === 2) I.snare(at, 0.6); I.hat(at, 0.4); },
    goema: (I, k, at) => { if ([0, 3, 6, 10].includes(k)) I.djembe(at, 0.9, k === 3 || k === 10); if ([4, 12].includes(k)) I.snare(at, 0.5); I.shaker(at, 0.6); },
    aussie: (I, k, at) => { if (k % 2 === 0) I.clapsticks(at, k % 4 ? 0.5 : 1); if (k === 0 || k === 10) I.kick(at, 0.7); if (k === 4 || k === 12) I.snare(at, 0.6); },
    haka: (I, k, at, S, b, pb) => { if ([0, 4, 8, 12].includes(k)) I.stomp(at, k % 8 === 0 ? 1 : 0.7); if ([4, 12].includes(k)) I.clap(at, 1); if (pb % 2 === 1 && k === 14) I.stomp(at, 0.8); },
    epic: (I, k, at, S, b, pb, key, st) => { const q = S / 4; if (k === 0 || k === q + q / 2 || k === 2 * q) I.kick(at, 1.1); if (k === q || k === 3 * q) { I.snare(at, 1); I.tom(at, 0.5, 90); } if (k === 0 && pb % 2 === 0) I.timpani(at, 1, key - 24); if (pb === 0 && k === 0) I.crash(at, 1.1); if (pb % 4 === 3 && k === 3 * q) I.roll(at, 1, q * st); },
    none: () => {},
  };

  /* =====================================================================================================
     ACCOMPANIMENT: (I, chord, root, time, bar length, step, S, chord instrument, key)
     ===================================================================================================== */
  const COMP = {
    arp: (I, ch, r, t, L, st, S, ci) => { for (let k = 0; k < S; k += 2) I[ci]([ch[0], ch[1], ch[2], ch[1] + 12][(k / 2) % 4], t + k * st, st * 2, 0.5); },
    cascade: (I, ch, r, t, L, st, S, ci) => { const ns = [ch[0], ch[1], ch[2], ch[0] + 12, ch[2], ch[1]]; for (let k = 0; k < S; k++) if (k % 3 !== 2) I[ci](ns[k % 6] + (k > S / 2 ? 12 : 0), t + k * st, st * 2, 0.42); },
    strum: (I, ch, r, t, L, st, S, ci) => { const pat = S === 12 ? [0, 3, 6, 9] : [0, 3, 6, 8, 11, 14]; pat.forEach((k, i) => (i % 2 ? ch : [ch[0] - 12, ...ch]).forEach((m, j) => I[ci](m, t + k * st + j * 0.012, st * 2, 0.36))); },
    rasgueado: (I, ch, r, t, L, st, S, ci) => { [0, 3, 6, 10, 12].forEach((k, i) => [ch[0] - 12, ch[0], ch[1], ch[2], ch[0] + 12].forEach((m, j) => I[ci](m, t + k * st + j * (i === 0 ? 0.022 : 0.01), st * 2, i === 0 ? 0.5 : 0.32))); },
    pompe: (I, ch, r, t, L, st, S, ci) => { for (let b = 0; b < 4; b++) (b % 2 ? ch : [ch[0] - 12]).forEach((m) => I[ci](m, t + b * (S / 4) * st, st * 1.5, b % 2 ? 0.4 : 0.6)); },
    montuno: (I, ch, r, t, L, st, S, ci) => { [0, 3, 4, 7, 8, 11, 12, 14].forEach((k, i) => I[ci](i % 2 ? ch[1] + 12 : ch[0] + 12, t + k * st, st, 0.45)); },
    tremolo: (I, ch, r, t, L, st, S, ci) => { for (let k = 0; k < S; k += S / 4) I[ci](ch[(k / (S / 4)) % 3], t + k * st, st * (S / 4) * 0.9, 0.4); },
    banjoroll: (I, ch, r, t, L, st, S, ci) => { const ns = [ch[0], ch[1], ch[2] + 12, ch[0] + 12, ch[1], ch[2] + 12, ch[0] + 12, ch[2]]; for (let k = 0; k < S; k++) I[ci](ns[k % 8], t + k * st, st, 0.36); },
    kora: (I, ch, r, t, L, st, S, ci) => { const ns = [ch[0] - 12, ch[2], ch[0], ch[1] + 12, ch[2], ch[0] + 12]; for (let k = 0; k < S; k++) if (k % 4 !== 3) I[ci](ns[k % 6], t + k * st, st * 2, 0.4); },
    interlock: (I, ch, r, t, L, st, S, ci) => { const ns = [ch[0], ch[1], ch[0], ch[2], ch[1], ch[2]]; for (let k = 0; k < S; k++) I[ci](ns[k % 6] + 12, t + k * st, st, k % 2 ? 0.3 : 0.48); },
    pad: (I, ch, r, t, L) => I.pad(ch, t, L, 0.9),
    strings: (I, ch, r, t, L) => I.strings(ch, t, L, 1.1),
    choir: (I, ch, r, t, L) => { I.choir(ch.map((m) => m + 12), t, L, 1); I.strings(ch, t, L, 0.7); },
    organ: (I, ch, r, t, L) => { I.organchord(ch, t, L * 0.48, 0.6); I.organchord(ch, t + L / 2, L * 0.45, 0.5); },
    tanpura: (I, ch, r, t, L, st, S, ci, key) => I.tanpura(key, t, L, 1),
    drone: (I, ch, r, t, L, st, S, ci, key) => I.drone([key - 12, key - 5], t, L * 1.02, 1),
    pipedrone: (I, ch, r, t, L, st, S, ci, key) => I.pipedrone(key, t, L * 1.02, 1),
    hurdy: (I, ch, r, t, L, st, S, ci, key) => { I.drone([key - 12, key - 5], t, L * 1.02, 0.9); for (let k = 2; k < S; k += 4) I.clack(t + k * st, 0.25); },
    oompah: (I, ch, r, t, L, st, S) => { const q = S / 4; [q, 3 * q].forEach((k) => I.horns(ch, t + k * st, st * q * 0.6, 0.8)); },
    tango: (I, ch, r, t, L, st, S) => { const q = S / 4; for (let b = 0; b < 4; b++) ch.forEach((m) => I.bandoneon(m, t + b * q * st, st * 1.5, b % 2 ? 0.25 : 0.4)); [0, 3, 6].forEach((k) => I.piano(r - 12, t + k * st, st, 0.5)); },
    stabs: (I, ch, r, t, L, st) => [0, 3, 6].forEach((k) => ch.forEach((m) => I.synth(m + 12, t + k * st, st * 1.5, 0.35))),
    power: (I, ch, r, t, L, st) => [0, 6, 8].forEach((k, i) => I.power(ch, t + k * st, st * (i === 0 ? 6 : 2), 1)),
    horns: (I, ch, r, t, L, st) => [2, 6, 10].forEach((k) => I.horns(ch.map((m) => m + 12), t + k * st, st * 1.2, 0.7)),
    piano: (I, ch, r, t, L, st) => [0, 6, 8, 14].forEach((k, i) => ch.forEach((m) => I.piano(m + (i % 2 ? 12 : 0), t + k * st, st * 2, 0.32))),
    amapiano: (I, ch, r, t, L, st) => [0, 3, 8, 11].forEach((k) => ch.forEach((m) => I.epiano(m + 12, t + k * st, st * 2, 0.4))),
    gamelan: (I, ch, r, t, L, st, S) => { for (let k = 0; k < S; k += 2) I.gender([ch[0], ch[1], ch[2], ch[1]][(k / 2) % 4] + 12, t + k * st, st, 0.8); },
    mariachi: (I, ch, r, t, L, st, S, ci) => { [0, 3, 6, 9].forEach((k, i) => (i % 2 ? ch : [ch[0] - 12, ...ch]).forEach((m, j) => I[ci](m, t + k * st + j * 0.01, st * 2, 0.36))); },
    acid: (I, ch, r, t, L, st, S) => { for (let k = 0; k < S; k++) if ((k * 5) % 7 !== 3) I.acid(r - 12 + [0, 12, 0, 7, 0, 12, 3, 0][k % 8], t + k * st, st * 0.9, 0.7); },
    none: () => {},
  };
  /* basslines: (I, instrument, root, time, bar length, step, S) */
  const BASS = {
    long: (I, bi, r, t, L) => I[bi](r - 12, t, L * 0.9, 0.8),
    half: (I, bi, r, t, L) => { I[bi](r - 12, t, L * 0.45, 0.8); I[bi](r - 5, t + L / 2, L * 0.45, 0.6); },
    pulse: (I, bi, r, t, L, st, S) => { for (let k = 0; k < S; k += S / 4) I[bi](r - 12, t + k * st, st * (S / 4) * 0.8, k ? 0.6 : 0.8); },
    walk: (I, bi, r, t, L, st, S) => [0, 4, 7, 9].forEach((o, i) => I[bi](r - 12 + o, t + i * (S / 4) * st, st * (S / 4) * 0.9, 0.7)),
    tresillo: (I, bi, r, t, L, st, S) => [0, 0.375, 0.625].forEach((f, i) => I[bi](r - 12 + (i === 2 ? 7 : 0), t + f * L, L * 0.2, 0.8)),
    eighth: (I, bi, r, t, L, st, S) => { for (let k = 0; k < S; k += 2) I[bi](r - 12 + (k % 8 === 6 ? 12 : 0), t + k * st, st * 1.6, 0.7); },
    oompah: (I, bi, r, t, L, st, S) => { const q = S / 4; I[bi](r - 12, t, st * q * 0.9, 0.9); I[bi](r - 5, t + 2 * q * st, st * q * 0.9, 0.8); },
    log: (I, bi, r, t, L, st) => [0, 3, 7, 10, 12].forEach((k, i) => I[bi](r - 12 + (i === 3 ? 7 : 0), t + k * st, st * 2, i ? 0.7 : 0.9)),
    trap: (I, bi, r, t, L, st) => [0, 7, 10].forEach((k) => I[bi](r - 12, t + k * st, st * 3, 0.9)),
    none: () => {},
  };

  /* =====================================================================================================
     STYLES: one per musical culture. fam = the visual family used by the opener's patterns (js/opener.js).
     leads, ost (the driving ostinato) and ci (the chord instrument) are instrument names;
     sig = the signature intro [kind, instrument]; hit = how the big moments land.
     ===================================================================================================== */
  const S_ = (fam, o) => Object.assign({ fam, key: [57, 64], bpm: [96, 112], bass: ['bass'], bassPat: ['long'], verb: [1.6, 2.4], wet: [0.14, 0.22] }, o);
  const STYLE = {
    edo: S_('japan', { scales: ['insen', 'yo', 'minor'], bpm: [76, 92], key: [60, 66], leads: ['shakuhachi', 'shinobue', 'koto'], ost: ['koto', 'shamisen'], comp: ['arp', 'none'], ci: ['koto'], drums: ['taikoEns', 'matsuri'], hit: 'taiko', sig: ['call', 'shakuhachi'], bassPat: ['none'] }),
    naniwa: S_('japan', { scales: ['yo', 'insen'], bpm: [92, 108], key: [60, 66], leads: ['shamisen', 'shinobue'], ost: ['koto', 'shamisen'], comp: ['arp', 'tremolo'], ci: ['koto'], drums: ['matsuri'], hit: 'taiko', sig: ['motif', 'shamisen'], bassPat: ['none'] }),
    korea: S_('eastasia', { scales: ['penta', 'yo', 'minpenta'], bpm: [84, 100], key: [60, 66], leads: ['daegeum', 'haegeum', 'gayageum'], ost: ['gayageum'], comp: ['arp', 'cascade'], ci: ['gayageum'], drums: ['janggu'], hit: 'jing', sig: ['call', 'daegeum'], bassPat: ['half'] }),
    samul: S_('eastasia', { scales: ['minpenta', 'penta'], bpm: [100, 116], key: [60, 66], leads: ['haegeum', 'gayageum', 'zurna'], ost: ['gayageum'], comp: ['arp'], ci: ['gayageum'], drums: ['samul'], hit: 'jing', sig: ['roll', 'kkwaenggwari'], bassPat: ['pulse'] }),
    china: S_('eastasia', { scales: ['penta', 'yo'], bpm: [84, 100], key: [60, 67], leads: ['erhu', 'dizi', 'pipa'], ost: ['guzheng', 'pipa'], comp: ['cascade', 'arp'], ci: ['guzheng'], drums: ['tanggu'], hit: 'operagong', sig: ['gliss', 'guzheng'], bassPat: ['half'] }),
    canton: S_('eastasia', { scales: ['penta', 'minpenta'], bpm: [100, 116], key: [60, 66], leads: ['erhu', 'pipa', 'dizi'], ost: ['pipa'], comp: ['arp'], ci: ['guzheng'], drums: ['liondance'], hit: 'operagong', sig: ['roll', 'liondance'], bassPat: ['pulse'] }),
    taiwan: S_('eastasia', { scales: ['penta', 'yo', 'major'], bpm: [88, 104], key: [60, 67], leads: ['dizi', 'erhu', 'guzheng'], ost: ['guzheng'], comp: ['cascade'], ci: ['guzheng'], drums: ['tanggu'], hit: 'operagong', sig: ['gliss', 'guzheng'], bassPat: ['long'] }),
    thai: S_('sea', { scales: ['penta', 'minpenta'], bpm: [96, 112], key: [60, 66], leads: ['khlui', 'ranat'], ost: ['ranat'], comp: ['interlock'], ci: ['ranat'], drums: ['thai'], hit: 'thaigong', sig: ['motif', 'ranat'], bassPat: ['half'] }),
    gamelan: S_('sea', { scales: ['pelog', 'slendro'], bpm: [88, 104], key: [60, 64], prog: 'static', leads: ['suling', 'gender'], ost: ['bonang'], comp: ['gamelan', 'interlock'], ci: ['bonang'], drums: ['kendang'], hit: 'gong', sig: ['roll', 'gong'], bassPat: ['none'] }),
    malay: S_('sea', { scales: ['harmonic', 'minor'], bpm: [96, 112], key: [60, 64], leads: ['serunai', 'gambus', 'violin'], ost: ['gambus'], comp: ['arp'], ci: ['gambus'], drums: ['kompang'], hit: 'kompang', sig: ['call', 'serunai'], bassPat: ['half'] }),
    kulintang: S_('sea', { scales: ['penta', 'minpenta'], bpm: [100, 116], key: [60, 66], leads: ['kulintang', 'mandolin', 'whistle'], ost: ['kulintang'], comp: ['interlock'], ci: ['kulintang'], drums: ['dabakan'], hit: 'agung', sig: ['motif', 'kulintang'], bassPat: ['pulse'] }),
    vietnam: S_('sea', { scales: ['penta', 'minpenta'], bpm: [78, 94], key: [60, 66], leads: ['danbau', 'dizi'], ost: ['dantranh'], comp: ['cascade'], ci: ['dantranh'], drums: ['tanggu'], hit: 'operagong', sig: ['call', 'danbau'], bassPat: ['long'] }),
    lioncity: S_('sea', { scales: ['penta', 'major'], bpm: [96, 112], key: [60, 66], leads: ['erhu', 'suling', 'dizi'], ost: ['guzheng', 'gender'], comp: ['cascade'], ci: ['guzheng'], drums: ['liondance'], hit: 'operagong', sig: ['gliss', 'guzheng'], bassPat: ['pulse'] }),
    bollywood: S_('india', { scales: ['bhairav', 'phrygdom', 'mixo'], bpm: [92, 108], key: [60, 64], leads: ['sitar', 'shehnai', 'bansuri'], ost: ['sitar'], comp: ['tanpura'], ci: ['sitar'], drums: ['dhol', 'tabla'], hit: 'dhol', sig: ['meend', 'sitar'], bassPat: ['half'], strings: true }),
    khaleeji: S_('arab', { scales: ['hijaz', 'phrygdom', 'harmonic'], bpm: [92, 108], key: [60, 64], leads: ['oud', 'qanun', 'ney', 'kamanja'], ost: ['oud', 'qanun'], comp: ['arp', 'drone'], ci: ['qanun'], drums: ['khaleeji'], hit: 'tabl', sig: ['gliss', 'qanun'], bassPat: ['tresillo'] }),
    ardah: S_('arab', { scales: ['hijaz', 'phrygdom'], bpm: [88, 100], key: [58, 63], leads: ['oud', 'ney', 'mijwiz'], ost: ['oud'], comp: ['drone'], ci: ['oud'], drums: ['ardah'], hit: 'ardah', sig: ['call', 'ney'], bassPat: ['pulse'] }),
    egypt: S_('arab', { scales: ['hijaz', 'doubleharm', 'harmonic'], bpm: [96, 112], key: [60, 64], leads: ['ney', 'qanun', 'kamanja', 'oud'], ost: ['qanun', 'oud'], comp: ['arp'], ci: ['qanun'], drums: ['maqsum'], hit: 'tabl', sig: ['call', 'ney'], bassPat: ['tresillo'], strings: true }),
    levant: S_('arab', { scales: ['hijaz', 'phrygdom'], bpm: [104, 118], key: [60, 64], leads: ['mijwiz', 'oud'], ost: ['oud'], comp: ['drone'], ci: ['oud'], drums: ['dabke'], hit: 'tabl', sig: ['call', 'mijwiz'], bassPat: ['pulse'] }),
    gnawa: S_('arab', { scales: ['minpenta', 'phrygdom'], six8: true, bpm: [100, 116], key: [52, 57], prog: 'static', leads: ['zurna', 'oud'], ost: ['guembri'], comp: ['none'], ci: ['oud'], drums: ['gnawa'], hit: 'qraqeb', sig: ['call', 'zurna'], bass: ['guembri'], bassPat: ['tresillo'] }),
    maghreb: S_('arab', { scales: ['hijaz', 'harmonic'], bpm: [100, 116], key: [60, 64], leads: ['kamanja', 'oud', 'ney'], ost: ['oud', 'qanun'], comp: ['arp'], ci: ['oud'], drums: ['maqsum'], hit: 'tabl', sig: ['call', 'kamanja'], bassPat: ['tresillo'] }),
    turkey: S_('balkan', { scales: ['hijaz', 'phrygian', 'harmonic'], bpm: [96, 112], key: [60, 64], leads: ['ney', 'clarinet', 'saz'], ost: ['saz', 'qanun'], comp: ['arp'], ci: ['saz'], drums: ['davul', 'maqsum'], hit: 'davul', sig: ['call', 'ney'], bassPat: ['tresillo'] }),
    greek: S_('balkan', { scales: ['harmonic', 'hijaz', 'minor'], bpm: [104, 120], key: [60, 64], leads: ['bouzouki', 'clarinet'], ost: ['bouzouki'], comp: ['strum'], ci: ['bouzouki'], drums: ['syrtaki'], hit: 'timpani', sig: ['trem', 'bouzouki'], bassPat: ['oompah'] }),
    flamenco: S_('spain', { scales: ['phrygdom', 'phrygian'], bpm: [100, 116], key: [57, 64], leads: ['flamenco', 'trumpet'], ost: ['flamenco'], comp: ['rasgueado'], ci: ['flamenco'], drums: ['flamenco'], hit: 'cajon', sig: ['rasg', 'flamenco'], bassPat: ['half'] }),
    rumba: S_('spain', { scales: ['phrygdom', 'minor'], bpm: [108, 120], key: [57, 64], leads: ['flamenco', 'trumpet'], ost: ['flamenco'], comp: ['rasgueado'], ci: ['flamenco'], drums: ['rumba'], hit: 'cajon', sig: ['rasg', 'flamenco'], bassPat: ['tresillo'] }),
    valencia: S_('spain', { scales: ['major', 'mixo'], bpm: [104, 118], key: [60, 64], leads: ['dolcaina'], ost: ['guitar'], comp: ['strum'], ci: ['guitar'], drums: ['tabalet'], hit: 'timpani', sig: ['call', 'dolcaina'], bassPat: ['oompah'] }),
    fado: S_('spain', { scales: ['minor', 'harmonic'], bpm: [76, 90], key: [57, 64], leads: ['pguitar', 'violin'], ost: ['pguitar'], comp: ['arp'], ci: ['guitar'], drums: ['none', 'classical'], hit: 'timpani', sig: ['trem', 'pguitar'], bassPat: ['half'], bass: ['upright'] }),
    italy: S_('italy', { scales: ['major', 'harmonic'], six8: true, bpm: [116, 132], key: [60, 67], leads: ['mandolin', 'accordion'], ost: ['mandolin'], comp: ['strum'], ci: ['guitar'], drums: ['tarantella'], hit: 'timpani', sig: ['trem', 'mandolin'], bassPat: ['half'] }),
    opera: S_('italy', { scales: ['major', 'harmonic'], bpm: [80, 94], key: [58, 65], leads: ['violin', 'brass'], ost: ['cello'], comp: ['strings', 'choir'], ci: ['piano'], drums: ['classical'], hit: 'orchestra', sig: ['swell', 'strings'], bassPat: ['half'], verb: [2.6, 3.2], wet: [0.24, 0.3] }),
    musette: S_('musette', { scales: ['major', 'harmonic'], six8: true, bpm: [126, 144], key: [60, 67], leads: ['accordion'], ost: ['guitar'], comp: ['pompe'], ci: ['guitar'], drums: ['six8'], hit: 'timpani', sig: ['motif', 'accordion'], bassPat: ['half'], bass: ['upright'] }),
    provence: S_('musette', { scales: ['major', 'mixo'], bpm: [104, 118], key: [62, 67], leads: ['fife'], ost: ['guitar'], comp: ['strum'], ci: ['guitar'], drums: ['tabalet'], hit: 'timpani', sig: ['call', 'fife'], bassPat: ['half'] }),
    auvergne: S_('musette', { scales: ['dorian', 'mixo'], bpm: [104, 118], key: [57, 62], leads: ['hurdygurdy'], ost: ['guitar'], comp: ['hurdy'], ci: ['guitar'], drums: ['nordic'], hit: 'timpani', sig: ['drone', 'hurdygurdy'], bassPat: ['none'] }),
    belgium: S_('musette', { scales: ['major', 'mixo'], bpm: [100, 116], key: [60, 66], leads: ['accordion', 'trumpet'], ost: ['carillon'], comp: ['pompe'], ci: ['guitar'], drums: ['march'], hit: 'timpani', sig: ['motif', 'carillon'], bassPat: ['oompah'], bass: ['tuba'] }),
    bavaria: S_('brass', { scales: ['major'], bpm: [104, 118], key: [58, 65], leads: ['trumpet', 'clarinet', 'zither'], ost: ['zither'], comp: ['oompah'], ci: ['zither'], drums: ['oompah'], hit: 'brassband', sig: ['motif', 'zither'], bassPat: ['oompah'], bass: ['tuba'] }),
    techno: S_('brass', { scales: ['minor', 'phrygian'], bpm: [124, 132], key: [57, 62], leads: ['synth', 'saw'], ost: ['acid'], comp: ['acid'], ci: ['synth'], drums: ['techno'], hit: 'dance', sig: ['acid', 'acid'], bassPat: ['eighth'], bass: ['synbass'], verb: [1.0, 1.4] }),
    hanse: S_('brass', { scales: ['dorian', 'minor', 'mixo'], bpm: [100, 114], key: [57, 64], leads: ['concertina', 'fiddle'], ost: ['guitar'], comp: ['strum'], ci: ['guitar'], drums: ['shanty'], hit: 'stomp', sig: ['motif', 'concertina'], bassPat: ['half'] }),
    karneval: S_('brass', { scales: ['major'], six8: true, bpm: [118, 132], key: [58, 65], leads: ['trumpet', 'accordion'], ost: ['guitar'], comp: ['oompah'], ci: ['guitar'], drums: ['six8'], hit: 'brassband', sig: ['motif', 'trumpet'], bassPat: ['oompah'], bass: ['tuba'] }),
    vienna: S_('brass', { scales: ['major', 'harmonic'], bpm: [84, 100], key: [58, 65], leads: ['violin', 'piano'], ost: ['cello'], comp: ['strings'], ci: ['piano'], drums: ['classical'], hit: 'orchestra', sig: ['swell', 'strings'], bassPat: ['half'], verb: [2.6, 3.2], wet: [0.24, 0.3] }),
    alpine: S_('brass', { scales: ['major'], bpm: [96, 110], key: [58, 63], leads: ['alphorn', 'accordion'], ost: ['zither'], comp: ['oompah'], ci: ['zither'], drums: ['alpine'], hit: 'timpani', sig: ['call', 'alphorn'], bassPat: ['oompah'], bass: ['tuba'], verb: [2.8, 3.4], wet: [0.26, 0.32] }),
    dutch: S_('brass', { scales: ['major'], bpm: [100, 116], key: [60, 66], leads: ['streetorgan'], ost: ['guitar'], comp: ['oompah'], ci: ['guitar'], drums: ['polka'], hit: 'brassband', sig: ['motif', 'streetorgan'], bassPat: ['oompah'], bass: ['tuba'] }),
    hardstyle: S_('dance', { scales: ['minor', 'harmonic'], bpm: [130, 140], key: [57, 62], leads: ['saw'], ost: ['saw'], comp: ['stabs'], ci: ['synth'], drums: ['hardstyle'], hit: 'dance', sig: ['acid', 'saw'], bassPat: ['pulse'], bass: ['synbass'], verb: [1.2, 1.6] }),
    chopin: S_('brass', { scales: ['minor', 'harmonic'], bpm: [84, 98], key: [58, 65], leads: ['piano', 'violin'], ost: ['piano'], comp: ['strings'], ci: ['piano'], drums: ['classical'], hit: 'timpani', sig: ['motif', 'piano'], bassPat: ['half'], verb: [2.4, 3.0] }),
    goral: S_('brass', { scales: ['lydian', 'major'], bpm: [112, 126], key: [60, 67], leads: ['fiddle'], ost: ['fiddle'], comp: ['strum'], ci: ['guitar'], drums: ['polka'], hit: 'stomp', sig: ['motif', 'fiddle'], bassPat: ['oompah'] }),
    bohemia: S_('brass', { scales: ['major'], bpm: [112, 126], key: [58, 65], leads: ['clarinet', 'trumpet', 'accordion'], ost: ['guitar'], comp: ['oompah'], ci: ['guitar'], drums: ['polka'], hit: 'brassband', sig: ['motif', 'clarinet'], bassPat: ['oompah'], bass: ['tuba'] }),
    hungary: S_('balkan', { scales: ['hungarian', 'harmonic'], bpm: [104, 120], key: [57, 64], leads: ['violin', 'cimbalom', 'clarinet'], ost: ['cimbalom'], comp: ['arp'], ci: ['cimbalom'], drums: ['hora'], hit: 'timpani', sig: ['trem', 'cimbalom'], bassPat: ['oompah'], bass: ['upright'] }),
    romania: S_('balkan', { scales: ['doubleharm', 'harmonic', 'hijaz'], bpm: [112, 128], key: [57, 64], leads: ['panpipe', 'violin', 'cimbalom'], ost: ['cimbalom'], comp: ['arp'], ci: ['cimbalom'], drums: ['hora'], hit: 'timpani', sig: ['call', 'panpipe'], bassPat: ['oompah'], bass: ['upright'] }),
    british: S_('british', { scales: ['major', 'mixo'], bpm: [80, 96], key: [58, 65], leads: ['brass', 'trumpet'], ost: ['cello'], comp: ['strings', 'choir'], ci: ['piano'], drums: ['anthem', 'march'], hit: 'orchestra', sig: ['swell', 'strings'], bassPat: ['half'], verb: [2.4, 3.0], wet: [0.22, 0.28] }),
    metal: S_('british', { scales: ['phrygian', 'minor', 'blues'], bpm: [96, 112], key: [52, 57], leads: ['gtrlead'], ost: ['electric'], comp: ['power'], ci: ['electric'], drums: ['heavy'], hit: 'rock', sig: ['power', 'electric'], bassPat: ['eighth'], bass: ['ebass'], verb: [1.2, 1.6] }),
    scottish: S_('scottish', { scales: ['mixo'], bpm: [84, 100], key: [57, 60], leads: ['pipes'], ost: ['fiddle'], comp: ['pipedrone'], ci: ['guitar'], drums: ['pipeband'], hit: 'pipeband', sig: ['drone', 'pipes'], bassPat: ['none'], verb: [2.0, 2.6] }),
    irish: S_('irish', { scales: ['dorian', 'mixo', 'major'], six8: true, bpm: [112, 128], key: [60, 67], leads: ['uilleann', 'whistleCut', 'fiddle'], ost: ['harp', 'guitar'], comp: ['strum'], ci: ['guitar'], drums: ['bodhran'], hit: 'bodhran', sig: ['gliss', 'harp'], bassPat: ['half'] }),
    danish: S_('nordic', { scales: ['dorian', 'major'], bpm: [100, 116], key: [57, 64], leads: ['fiddle', 'accordion'], ost: ['guitar'], comp: ['strum'], ci: ['guitar'], drums: ['nordic'], hit: 'timpani', sig: ['motif', 'fiddle'], bassPat: ['half'] }),
    swedish: S_('nordic', { scales: ['dorian', 'minor'], bpm: [92, 106], key: [57, 64], leads: ['nyckelharpa', 'fiddle'], ost: ['nyckelharpa'], comp: ['drone', 'strings'], ci: ['guitar'], drums: ['nordic'], hit: 'timpani', sig: ['drone', 'nyckelharpa'], bassPat: ['half'] }),
    norway: S_('nordic', { scales: ['lydian', 'dorian'], bpm: [92, 106], key: [57, 64], leads: ['hardanger'], ost: ['harp'], comp: ['drone'], ci: ['harp'], drums: ['nordic'], hit: 'timpani', sig: ['drone', 'hardanger'], bassPat: ['half'], verb: [2.6, 3.2] }),
    finland: S_('nordic', { scales: ['minor', 'dorian'], bpm: [84, 98], key: [57, 64], leads: ['kantele', 'fiddle', 'accordion'], ost: ['kantele'], comp: ['cascade'], ci: ['kantele'], drums: ['nordic'], hit: 'timpani', sig: ['gliss', 'kantele'], bassPat: ['half'], verb: [2.4, 3.0] }),
    country: S_('usa', { scales: ['major', 'mixo'], bpm: [104, 120], key: [60, 67], leads: ['pedalsteel', 'fiddle', 'banjo'], ost: ['banjo'], comp: ['banjoroll', 'strum'], ci: ['banjo'], drums: ['train'], hit: 'rock', sig: ['roll', 'banjo'], bassPat: ['oompah'], bass: ['upright'] }),
    bluegrass: S_('usa', { scales: ['major', 'mixo'], bpm: [120, 132], key: [60, 67], leads: ['fiddle', 'mandolin', 'banjo'], ost: ['banjo'], comp: ['banjoroll'], ci: ['banjo'], drums: ['train'], hit: 'stomp', sig: ['roll', 'banjo'], bassPat: ['oompah'], bass: ['upright'] }),
    western: S_('usa', { scales: ['minor', 'dorian'], bpm: [88, 100], key: [57, 62], leads: ['whistle', 'gtrlead', 'mtrumpet'], ost: ['guitar'], comp: ['arp'], ci: ['guitar'], drums: ['western'], hit: 'whip', sig: ['call', 'whistle'], bassPat: ['half'], verb: [2.6, 3.2], wet: [0.26, 0.3] }),
    trap: S_('usa', { scales: ['minor', 'harmonic'], bpm: [70, 76], key: [55, 62], leads: ['bell', 'saw', 'violin'], ost: ['bell'], comp: ['pad'], ci: ['piano'], drums: ['trap'], hit: 'trap', sig: ['motif', 'bell'], bassPat: ['trap'], bass: ['sub808'] }),
    boombap: S_('usa', { scales: ['minor', 'dorian'], bpm: [88, 96], key: [55, 62], leads: ['sax', 'piano'], ost: ['piano'], comp: ['horns'], ci: ['piano'], drums: ['boombap'], hit: 'brassband', sig: ['motif', 'sax'], bassPat: ['walk'], bass: ['upright'] }),
    blues: S_('usa', { scales: ['blues', 'mixo'], six8: true, bpm: [88, 100], key: [52, 57], leads: ['harmonica', 'gtrlead'], ost: ['electric'], comp: ['organ'], ci: ['electric'], drums: ['blues'], hit: 'rock', sig: ['call', 'harmonica'], bassPat: ['walk'], bass: ['ebass'] }),
    philly: S_('usa', { scales: ['major', 'dorian'], bpm: [108, 120], key: [58, 65], leads: ['violin', 'brass'], ost: ['ebass'], comp: ['strings', 'horns'], ci: ['electric'], drums: ['disco'], hit: 'brassband', sig: ['swell', 'strings'], bassPat: ['eighth'], bass: ['ebass'] }),
    celticpunk: S_('irish', { scales: ['mixo', 'dorian'], bpm: [124, 136], key: [57, 64], leads: ['whistleCut', 'pipes'], ost: ['electric'], comp: ['power'], ci: ['electric'], drums: ['rock'], hit: 'rock', sig: ['drone', 'pipes'], bassPat: ['eighth'], bass: ['ebass'] }),
    grunge: S_('usa', { scales: ['minor', 'phrygian'], bpm: [96, 110], key: [52, 57], leads: ['gtrlead'], ost: ['electric'], comp: ['power'], ci: ['electric'], drums: ['heavy'], hit: 'rock', sig: ['power', 'electric'], bassPat: ['eighth'], bass: ['ebass'] }),
    rock: S_('usa', { scales: ['major', 'mixo'], bpm: [108, 124], key: [57, 64], leads: ['gtrlead', 'synth'], ost: ['electric'], comp: ['power'], ci: ['electric'], drums: ['rock'], hit: 'rock', sig: ['power', 'electric'], bassPat: ['eighth'], bass: ['ebass'] }),
    synthwave: S_('dance', { scales: ['minor', 'dorian'], bpm: [96, 108], key: [57, 62], leads: ['saw', 'synth'], ost: ['synth'], comp: ['pad'], ci: ['synth'], drums: ['synthwave'], hit: 'dance', sig: ['swell', 'pad'], bassPat: ['eighth'], bass: ['synbass'], verb: [2.6, 3.2] }),
    dance: S_('dance', { scales: ['major', 'minor'], bpm: [120, 128], key: [57, 64], leads: ['saw', 'synth'], ost: ['synth'], comp: ['stabs'], ci: ['synth'], drums: ['four'], hit: 'dance', sig: ['acid', 'saw'], bassPat: ['eighth'], bass: ['synbass'], verb: [1.4, 2.0] }),
    salsa: S_('dance', { scales: ['minor', 'dorian', 'major'], bpm: [100, 116], key: [57, 64], leads: ['trumpet', 'steelpan', 'tres'], ost: ['tres', 'piano'], comp: ['montuno'], ci: ['piano'], drums: ['salsa'], hit: 'salsa', sig: ['roll', 'timbale'], bassPat: ['tresillo'] }),
    orchestral: S_('usa', { scales: ['major', 'lydian'], bpm: [88, 100], key: [58, 65], leads: ['brass', 'flute', 'violin'], ost: ['cello'], comp: ['strings', 'choir'], ci: ['piano'], drums: ['anthem'], hit: 'orchestra', sig: ['swell', 'strings'], bassPat: ['half'], verb: [2.6, 3.2], wet: [0.24, 0.3] }),
    quebec: S_('canada', { scales: ['major', 'mixo'], bpm: [112, 126], key: [60, 67], leads: ['fiddle', 'accordion'], ost: ['guitar'], comp: ['strum'], ci: ['guitar'], drums: ['quebec'], hit: 'stomp', sig: ['motif', 'fiddle'], bassPat: ['oompah'] }),
    indiefolk: S_('canada', { scales: ['major', 'mixo'], bpm: [96, 112], key: [57, 64], leads: ['whistle', 'banjo', 'piano'], ost: ['guitar'], comp: ['strum'], ci: ['guitar'], drums: ['shanty'], hit: 'stomp', sig: ['motif', 'guitar'], bassPat: ['half'] }),
    urban: S_('canada', { scales: ['minor', 'dorian'], bpm: [80, 92], key: [55, 62], leads: ['epiano', 'saw'], ost: ['epiano'], comp: ['pad'], ci: ['epiano'], drums: ['trap'], hit: 'trap', sig: ['swell', 'pad'], bassPat: ['trap'], bass: ['sub808'] }),
    mariachi: S_('mariachi', { scales: ['major'], six8: true, bpm: [120, 138], key: [60, 65], leads: ['mtrumpet', 'violin'], harmony: true, ost: ['guitar'], comp: ['mariachi'], ci: ['guitar'], drums: ['six8'], hit: 'mariachi', sig: ['call', 'mtrumpet'], bassPat: ['half'], bass: ['guitarron'] }),
    norteno: S_('mariachi', { scales: ['major'], bpm: [112, 126], key: [58, 65], leads: ['accordion'], ost: ['viola'], comp: ['strum'], ci: ['viola'], drums: ['norteno'], hit: 'mariachi', sig: ['motif', 'accordion'], bassPat: ['oompah'], bass: ['upright'] }),
    cumbia: S_('andes', { scales: ['minor', 'dorian', 'major'], bpm: [96, 108], key: [57, 64], leads: ['gaita', 'accordion'], ost: ['guitar'], comp: ['strum'], ci: ['guitar'], drums: ['cumbia'], hit: 'cumbia', sig: ['call', 'gaita'], bassPat: ['half'] }),
    reggaeton: S_('dance', { scales: ['minor', 'dorian'], bpm: [90, 98], key: [55, 62], leads: ['synth', 'pluck', 'guitar'], ost: ['pluck'], comp: ['pad'], ci: ['pluck'], drums: ['dembow'], hit: 'trap', sig: ['motif', 'pluck'], bassPat: ['tresillo'], bass: ['sub808'] }),
    afroperu: S_('andes', { scales: ['minor', 'harmonic'], six8: true, bpm: [104, 116], key: [57, 64], leads: ['guitar', 'quena'], ost: ['guitar'], comp: ['strum'], ci: ['guitar'], drums: ['afroperu'], hit: 'cajon', sig: ['roll', 'quijada'], bassPat: ['half'] }),
    andes: S_('andes', { scales: ['minpenta', 'minor', 'dorian'], bpm: [96, 110], key: [57, 64], leads: ['quena', 'panpipe'], ost: ['charango'], comp: ['strum'], ci: ['charango'], drums: ['andes'], hit: 'bombo', sig: ['call', 'panpipe'], bassPat: ['half'] }),
    cueca: S_('andes', { scales: ['major', 'minor'], six8: true, bpm: [104, 118], key: [57, 64], leads: ['harp', 'accordion', 'guitar'], ost: ['guitar'], comp: ['strum'], ci: ['guitar'], drums: ['cueca'], hit: 'bombo', sig: ['gliss', 'harp'], bassPat: ['half'] }),
    samba: S_('brazil', { scales: ['major', 'mixo'], bpm: [100, 112], key: [60, 67], leads: ['cavaquinho', 'trumpet', 'flute'], ost: ['cavaquinho'], comp: ['strum'], ci: ['cavaquinho'], drums: ['samba'], hit: 'surdo', sig: ['roll', 'apito'], bassPat: ['half'] }),
    bossa: S_('brazil', { scales: ['major', 'dorian', 'lydian'], bpm: [92, 104], key: [57, 64], leads: ['flute', 'guitar', 'piano'], ost: ['guitar'], comp: ['arp'], ci: ['guitar'], drums: ['bossa'], hit: 'surdo', sig: ['motif', 'guitar'], bassPat: ['tresillo'], bass: ['upright'] }),
    caipira: S_('brazil', { scales: ['mixo', 'major'], bpm: [104, 116], key: [60, 66], leads: ['viola', 'accordion'], ost: ['viola'], comp: ['strum'], ci: ['viola'], drums: ['forro'], hit: 'surdo', sig: ['motif', 'viola'], bassPat: ['half'] }),
    tango: S_('tango', { scales: ['harmonic', 'minor'], bpm: [108, 120], key: [57, 64], leads: ['bandoneon', 'violin'], ost: ['piano'], comp: ['tango'], ci: ['piano'], drums: ['tango'], hit: 'tango', sig: ['motif', 'bandoneon'], bassPat: ['pulse'], bass: ['upright'] }),
    candombe: S_('tango', { scales: ['minor', 'dorian'], bpm: [104, 116], key: [57, 64], leads: ['bandoneon', 'guitar'], ost: ['guitar'], comp: ['strum'], ci: ['guitar'], drums: ['candombe'], hit: 'candombe', sig: ['roll', 'candombe'], bassPat: ['tresillo'] }),
    afrobeat: S_('africa', { scales: ['dorian', 'minpenta'], bpm: [104, 116], key: [57, 62], prog: 'static', leads: ['sax', 'trumpet', 'organ'], ost: ['highlife'], comp: ['horns'], ci: ['highlife'], drums: ['afrobeat'], hit: 'talking', sig: ['roll', 'talking'], bassPat: ['tresillo'], bass: ['ebass'] }),
    highlife: S_('africa', { scales: ['major', 'penta'], bpm: [112, 124], key: [60, 66], leads: ['highlife', 'trumpet', 'balafon'], ost: ['highlife'], comp: ['kora'], ci: ['highlife'], drums: ['highlife'], hit: 'talking', sig: ['motif', 'balafon'], bassPat: ['tresillo'], bass: ['ebass'] }),
    benga: S_('africa', { scales: ['major', 'mixo'], bpm: [120, 132], key: [60, 66], leads: ['highlife', 'kalimba'], ost: ['highlife'], comp: ['interlock'], ci: ['highlife'], drums: ['benga'], hit: 'djembe', sig: ['motif', 'kalimba'], bassPat: ['eighth'], bass: ['ebass'] }),
    amapiano: S_('africa', { scales: ['minor', 'dorian'], bpm: [108, 114], key: [55, 62], leads: ['epiano', 'sax'], ost: ['kalimba'], comp: ['amapiano'], ci: ['epiano'], drums: ['amapiano'], hit: 'vuvuzela', sig: ['call', 'vuvuzela'], bassPat: ['log'], bass: ['logdrum'] }),
    maskandi: S_('africa', { scales: ['major', 'mixo'], bpm: [120, 132], key: [60, 66], leads: ['concertina', 'highlife'], ost: ['highlife'], comp: ['interlock'], ci: ['highlife'], drums: ['maskandi'], hit: 'vuvuzela', sig: ['motif', 'concertina'], bassPat: ['eighth'], bass: ['ebass'] }),
    goema: S_('africa', { scales: ['major', 'dorian'], bpm: [100, 112], key: [57, 64], leads: ['sax', 'piano', 'kora'], ost: ['kora'], comp: ['piano'], ci: ['piano'], drums: ['goema'], hit: 'djembe', sig: ['gliss', 'kora'], bassPat: ['walk'], bass: ['upright'] }),
    aussie: S_('oceania', { scales: ['major', 'mixo'], bpm: [100, 116], key: [57, 62], leads: ['gtrlead', 'whistle'], ost: ['guitar'], comp: ['strum'], ci: ['guitar'], drums: ['aussie'], hit: 'didge', sig: ['drone', 'didge'], bassPat: ['half'], didge: true }),
    pubrock: S_('oceania', { scales: ['mixo', 'major'], bpm: [116, 128], key: [57, 62], leads: ['gtrlead'], ost: ['electric'], comp: ['power'], ci: ['electric'], drums: ['rock'], hit: 'didge', sig: ['drone', 'didge'], bassPat: ['eighth'], bass: ['ebass'], didge: true }),
    aotearoa: S_('oceania', { scales: ['major', 'penta'], bpm: [92, 106], key: [57, 64], leads: ['koauau', 'ukulele', 'whistle'], ost: ['ukulele'], comp: ['strum'], ci: ['ukulele'], drums: ['haka'], hit: 'haka', sig: ['call', 'conch'], bassPat: ['half'] }),
    worlds: S_('worlds', { scales: ['minor', 'major', 'dorian'], bpm: [84, 96], key: [55, 62], leads: ['brass', 'trumpet'], harmony: true, ost: ['cello'], comp: ['choir', 'strings'], ci: ['piano'], drums: ['epic'], hit: 'orchestra', sig: ['swell', 'strings'], bassPat: ['half'], verb: [3.0, 3.4], wet: [0.28, 0.32], choir: true }),
  };
  /* host country → default style, and city → its own style */
  const COUNTRY = {
    Japan: 'edo', 'South Korea': 'korea', China: 'china', 'Hong Kong': 'canton', Taiwan: 'taiwan', Thailand: 'thai', Indonesia: 'gamelan', Malaysia: 'malay', Philippines: 'kulintang', Vietnam: 'vietnam', Singapore: 'lioncity', India: 'bollywood',
    'Saudi Arabia': 'khaleeji', 'United Arab Emirates': 'khaleeji', Qatar: 'khaleeji', Kuwait: 'khaleeji', Oman: 'khaleeji', Jordan: 'levant', Egypt: 'egypt', Morocco: 'gnawa', Tunisia: 'maghreb', Turkey: 'turkey', Greece: 'greek',
    Brazil: 'samba', Argentina: 'tango', Uruguay: 'candombe', Mexico: 'mariachi', Colombia: 'cumbia', Peru: 'andes', Chile: 'cueca', Ecuador: 'andes',
    Spain: 'flamenco', Portugal: 'fado', Italy: 'italy', France: 'musette', Belgium: 'belgium', Switzerland: 'alpine', Germany: 'bavaria', Austria: 'vienna', Netherlands: 'dutch', Poland: 'chopin', Czechia: 'bohemia', Hungary: 'hungary', Romania: 'romania',
    'United Kingdom': 'british', England: 'british', Scotland: 'scottish', Wales: 'british', Ireland: 'irish', Denmark: 'danish', Sweden: 'swedish', Norway: 'norway', Finland: 'finland',
    'United States': 'rock', Canada: 'indiefolk', Australia: 'aussie', 'New Zealand': 'aotearoa', 'South Africa': 'amapiano', Nigeria: 'afrobeat', Kenya: 'benga', Ghana: 'highlife',
  };
  const CITY = {
    Tokyo: 'edo', Osaka: 'naniwa', Seoul: 'korea', Busan: 'samul', Shanghai: 'china', Riyadh: 'ardah', Jeddah: 'khaleeji', Doha: 'khaleeji', Dubai: 'khaleeji', 'Abu Dhabi': 'khaleeji', 'Kuwait City': 'khaleeji', Muscat: 'khaleeji',
    Marrakech: 'gnawa', Casablanca: 'maghreb', Madrid: 'flamenco', Barcelona: 'rumba', Valencia: 'valencia', Lisbon: 'fado', Porto: 'fado', Rome: 'italy', Milan: 'opera',
    Paris: 'musette', Marseille: 'provence', Lyon: 'auvergne', Munich: 'bavaria', Berlin: 'techno', Hamburg: 'hanse', Cologne: 'karneval', Vienna: 'vienna', Zurich: 'alpine', Amsterdam: 'dutch', Rotterdam: 'hardstyle',
    Warsaw: 'chopin', 'Kraków': 'goral', Katowice: 'techno', London: 'british', Birmingham: 'metal', Edinburgh: 'scottish', Dublin: 'irish',
    Nashville: 'country', Austin: 'country', Dallas: 'western', 'Fort Worth': 'western', Houston: 'trap', Atlanta: 'trap', 'New York': 'boombap', Chicago: 'blues', Philadelphia: 'philly', Boston: 'celticpunk',
    Seattle: 'grunge', 'San Francisco': 'rock', 'Los Angeles': 'synthwave', 'Las Vegas': 'dance', Miami: 'salsa', Orlando: 'orchestral', Phoenix: 'western', Denver: 'bluegrass', Raleigh: 'bluegrass',
    Toronto: 'urban', 'Montréal': 'quebec', Vancouver: 'indiefolk', Calgary: 'country', 'Mexico City': 'mariachi', Guadalajara: 'mariachi', Monterrey: 'norteno',
    'Bogotá': 'cumbia', 'Medellín': 'reggaeton', Lima: 'afroperu', Quito: 'andes', Santiago: 'cueca', 'Rio de Janeiro': 'samba', 'São Paulo': 'bossa', 'Belo Horizonte': 'caipira',
    'Buenos Aires': 'tango', Montevideo: 'candombe', Lagos: 'afrobeat', Accra: 'highlife', Nairobi: 'benga', Johannesburg: 'amapiano', Durban: 'maskandi', 'Cape Town': 'goema',
    Sydney: 'aussie', Perth: 'aussie', Brisbane: 'aussie', Melbourne: 'pubrock', Auckland: 'aotearoa', Wellington: 'aotearoa',
  };

  /** Compose a city's anthem. Every choice comes from the city's own seed, so the same city always gets the same anthem. */
  function compose(city, country, worlds) {
    const sname = worlds ? 'worlds' : CITY[city] || COUNTRY[country] || 'rock';
    const sty = STYLE[sname], fname = sty.fam;
    const rnd = seeded((worlds ? 'worlds|' : '') + city + '|' + country + '|anthem');
    const scaleName = pickOf(rnd, sty.scales), sc = SC[scaleName];
    let prog = pickOf(rnd, MINORISH[scaleName] ? PROG_MIN : PROG_MAJ);
    if (sty.prog === 'static') prog = pickOf(rnd, PROG_STATIC);
    const S = sty.six8 ? 12 : 16;
    const bpm = sty.bpm[0] + Math.round(rnd() * (sty.bpm[1] - sty.bpm[0]));
    const key = sty.key[0] + Math.floor(rnd() * (sty.key[1] - sty.key[0] + 1));
    const lead = pickOf(rnd, sty.leads), drums = pickOf(rnd, sty.drums), comp = pickOf(rnd, sty.comp);
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
        if (bar === 7) deg = 7;
        else if (strong) { const tones = [0, 2, 4].map((x) => chordDeg + x).flatMap((x) => [x, x + 7, x - 7]); deg = tones.reduce((a, c) => (Math.abs(c - deg) < Math.abs(a - deg) ? c : a), tones[0]); }
        else deg += pickOf(rnd, [-2, -1, -1, 1, 1, 1, 2, -3, 3]);
        deg = Math.max(3, Math.min(13, deg));
        const nextK = r[i + 1] != null ? r[i + 1] : S;
        melody.push({ bar, k, deg, len: Math.min(nextK - k, S / 2) });
      });
    });
    const n = sc.length;
    const note = (d, oct) => key + sc[((d % n) + n) % n] + 12 * (Math.floor(d / n) + (oct || 0));
    // the city's own arrangement within its style
    const dr = seeded((worlds ? 'worlds|' : '') + city + '|' + country + '|drama');
    const OST = S === 16
      ? [[0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 6, 8, 11, 14], [0, 2, 3, 6, 8, 10, 11, 14], [0, 4, 6, 8, 12, 14], [0, 3, 4, 7, 8, 11, 12, 15], [0, 2, 4, 5, 8, 10, 12, 13]]
      : [[0, 3, 6, 9], [0, 2, 3, 5, 6, 8, 9, 11], [0, 1, 2, 6, 7, 8], [0, 3, 5, 6, 9, 11]];
    const others = sty.leads.filter((l) => l !== lead);
    const arr = {
      ost: pickOf(dr, sty.ost), ostPat: pickOf(dr, OST), ostShape: pickOf(dr, [[0, 2, 4, 2], [0, 4, 2, 7], [0, 2, 4, 7], [4, 2, 0, 2], [0, 7, 4, 2]]),
      ci: pickOf(dr, sty.ci), bass: pickOf(dr, sty.bass), bassPat: pickOf(dr, sty.bassPat),
      second: others.length && dr() < 0.75 ? pickOf(dr, others) : null, // a second voice answers in the second half
      verb: sty.verb[0] + dr() * (sty.verb[1] - sty.verb[0]), wet: sty.wet[0] + dr() * (sty.wet[1] - sty.wet[0]),
      boom: 30 + Math.floor(dr() * 8),
    };
    return { fname, style: sname, sty, scaleName, prog, S, bpm, key, lead, drums, comp, melody, note, arr };
  }

  /* the big moments, per style */
  function makeHit(I, P) {
    const k = P.key, ch = [P.note(0), P.note(2), P.note(4)];
    const H = {
      taiko: (t, p) => { I.taiko(t, p * 1.3, 52); I.taiko(t + 0.003, p * 0.8, 70); I.clack(t, p); },
      jing: (t, p) => { I.jing(t, p); I.janggu(t, p, false); I.kkwaenggwari(t, p * 0.6); },
      operagong: (t, p) => { I.operagong(t, p); I.tanggu(t, p * 1.2); I.bo(t, p); },
      thaigong: (t, p) => { I.gong(t, p * 0.8); I.ching(t, p, true); I.tom(t, p, 120); },
      gong: (t, p) => { I.gong(t, p * 1.2); I.kendang(t, p, false); },
      agung: (t, p) => { I.gong(t, p); I.kulintang(k, t, 0.3, p); },
      kompang: (t, p) => { [0, 0.01, 0.02].forEach((o) => I.kompang(t + o, p)); I.tabl(t, p * 0.7); },
      dhol: (t, p) => { I.dhol(t, p * 1.2, false); I.dhol(t + 0.06, p, true); I.dhol(t + 0.12, p, false); },
      tabl: (t, p) => { I.tabl(t, p * 1.2); I.riq(t, p); I.riq(t + 0.05, p * 0.7); },
      ardah: (t, p) => { [0, 0.012, 0.02].forEach((o) => I.tar(t + o, p)); I.tabl(t, p); },
      qraqeb: (t, p) => { for (let i = 0; i < 6; i++) I.qraqeb(t + i * 0.06, p * (1 - i * 0.1)); I.tabl(t, p); },
      davul: (t, p) => { I.davul(t, p * 1.2, false); I.zurna(k + 12, t, 0.6, p * 0.8); },
      cajon: (t, p) => { I.cajon(t, p * 1.2, false); I.palmas(t, p); I.palmas(t + 0.05, p * 0.7); },
      surdo: (t, p) => { I.surdo(t, p * 1.3); I.apito(t, p, 0.3); },
      bombo: (t, p) => { I.bombo(t, p * 1.3, false); I.bombo(t + 0.1, p * 0.7, true); },
      cumbia: (t, p) => { I.tambora(t, p * 1.2, false); I.guacharaca(t, p, 0.3); },
      candombe: (t, p) => { [0, 0.05, 0.1].forEach((o, i) => I.tom(t + o, p, [120, 160, 260][i])); },
      tango: (t, p) => { ch.forEach((m) => I.bandoneon(m, t, 0.5, p * 0.6)); I.piano(k - 24, t, 0.6, p); },
      mariachi: (t, p) => { I.guitarron(k - 12, t, 0.4, p); ch.forEach((m) => I.mtrumpet(m + 12, t, 0.5, p * 0.4)); },
      salsa: (t, p) => { I.timbale(t, p); I.timbale(t + 0.06, p * 0.8); I.cowbell(t, p, true); I.horns(ch.map((m) => m + 12), t, 0.3, p); },
      brassband: (t, p) => { I.kick(t, p); I.crash(t, p * 0.8); I.horns(ch, t, 0.4, p); },
      timpani: (t, p) => { I.timpani(t, p * 1.2, k - 24); I.crash(t, p * 0.6); },
      orchestra: (t, p) => { I.timpani(t, p * 1.2, k - 24); I.crash(t, p); I.braam([k - 24, k - 12, k - 5], t, 1.2, p * 0.9); },
      pipeband: (t, p) => { I.tom(t, p * 1.2, 65); I.roll(Math.max(0, t - 0.15), p * 1.4, 0.15, 6); I.pipesnare(t, p); },
      bodhran: (t, p) => { I.bodhran(t, p * 1.3, 90); I.bodhran(t + 0.08, p * 0.8, 130); },
      stomp: (t, p) => { I.stomp(t, p * 1.2); I.clap(t, p); },
      rock: (t, p) => { I.kick(t, p); I.crash(t, p); I.power(ch, t, 0.8, p); },
      trap: (t, p) => { I.sub808(k - 24, t, 0.8, p); I.clap(t, p); },
      dance: (t, p) => { I.hardkick(t, p); I.crash(t, p * 0.8); },
      whip: (t, p) => { I.whip(t, p); I.timpani(t, p, k - 24); },
      talking: (t, p) => { I.talking(t, p, 1); I.talking(t + 0.12, p, -1); I.shekere(t, p); },
      djembe: (t, p) => { I.djembe(t, p * 1.2, false); I.djembe(t + 0.05, p, true); },
      vuvuzela: (t, p) => { I.vuvuzela(0, t, 0.6, p); I.kick(t, p); },
      didge: (t, p) => { I.didge(k - 24, t, 0.6, p * 1.3); I.clapsticks(t, p); I.clapsticks(t + 0.1, p * 0.7); },
      haka: (t, p) => { I.stomp(t, p * 1.3); I.stomp(t + 0.01, p); I.clap(t, p); },
    };
    return H[P.sty.hit] || H.timpani;
  }

  /* the signature intro: the style's iconic instrument, over a build into the drop */
  function signature(I, P, t, L, st) {
    const [kind, inst] = P.sty.sig, k = P.key, n = (d) => P.note(d);
    if (kind === 'call') { I[inst](n(4), t, L * 0.35, 1.1); I[inst](n(7), t + L * 0.4, L * 0.55, 1.2); }
    else if (kind === 'gliss') { for (let i = 0; i < 12; i++) I[inst](n(i), t + (i * L * 0.5) / 12, L * 0.3, 0.7); I[inst](n(14), t + L * 0.55, L * 0.4, 0.8); }
    else if (kind === 'meend') { I.tanpura(k, t, L, 1); I[inst](n(4), t + L * 0.1, L * 0.35, 1.2); I[inst](n(5), t + L * 0.5, L * 0.45, 1.2); }
    else if (kind === 'trem') { I[inst](n(7), t, L * 0.45, 1); I[inst](n(9), t + L * 0.5, L * 0.45, 1); }
    else if (kind === 'motif') { [0, 2, 4, 7].forEach((d, i) => I[inst](n(d + 7), t + i * L * 0.18, L * 0.18, 0.9)); I[inst](n(11), t + L * 0.72, L * 0.25, 1); }
    else if (kind === 'rasg') COMP.rasgueado(I, [n(0), n(2), n(4)], n(0), t, L, st, P.S, inst);
    else if (kind === 'drone') {
      if (inst === 'pipes') { I.pipedrone(k, t, L, 1.2); I.pipes(n(7), t + L * 0.5, L * 0.45, 1); }
      else if (inst === 'didge') { I.didge(k - 24, t, L, 1.4); for (let i = 0; i < P.S; i += 2) I.clapsticks(t + i * st, 0.6); }
      else { I.drone([k - 12, k - 5], t, L, 1); I[inst](n(7), t + L * 0.5, L * 0.45, 1); }
    }
    else if (kind === 'swell') { if (inst === 'pad') I.pad([n(0), n(2), n(4)], t, L, 1.2); else I.strings([n(0), n(2), n(4), n(7)], t, L, 1.4); }
    else if (kind === 'power') { I.power([n(0)], t, L * 0.5, 1); I.power([n(0)], t + L * 0.5, L * 0.45, 1); }
    else if (kind === 'acid') COMP.acid(I, [n(0)], n(0), t, L, st, P.S);
    else if (kind === 'roll') {
      if (inst === 'kkwaenggwari') for (let i = 0; i < P.S; i++) I.kkwaenggwari(t + i * st, 0.4 + i / P.S);
      else if (inst === 'liondance') for (let i = 0; i < P.S; i++) { I.tanggu(t + i * st, 0.4 + i / P.S); if (i % 4 === 0) I.bo(t + i * st, 0.6); }
      else if (inst === 'gong') { I.gong(t, 1.2); for (let i = 0; i < P.S; i += 2) I.bonang(n(i % 5) + 12, t + i * st, st, 0.8); }
      else if (inst === 'apito') { I.apito(t, 1.2, L * 0.4); I.apito(t + L * 0.5, 1.2, L * 0.3); for (let i = P.S / 2; i < P.S; i++) I.surdo(t + i * st, 0.3 + i / P.S / 2); }
      else if (inst === 'banjo') COMP.banjoroll(I, [n(0), n(2), n(4)], n(0), t, L, st, P.S, 'banjo');
      else if (inst === 'timbale') for (let i = P.S / 2; i < P.S; i++) I.timbale(t + i * st, 0.4 + i / P.S);
      else if (inst === 'quijada') { I.quijada(t, 1.2); I.quijada(t + L * 0.5, 1.2); for (let i = P.S / 2; i < P.S; i++) I.cajon(t + i * st, 0.5, i % 2 === 1); }
      else if (inst === 'talking') [0, 3, 6, 8, 10, 12, 14].forEach((i, j) => I.talking(t + i * st, 1, j % 2 ? -1 : 1));
      else if (inst === 'candombe') for (let i = 0; i < P.S; i++) I.tom(t + i * st, 0.3 + i / P.S / 2, [120, 260, 160][i % 3]);
    }
  }

  /* per-style levels (measured offline) so every anthem plays at about the same loudness */
  const LEVEL = {afrobeat: 0.96, afroperu: 0.8, alpine: 0.91, amapiano: 0.81, andes: 0.75, aotearoa: 0.68, ardah: 0.56, aussie: 1.0, auvergne: 1.49, bavaria: 0.94, belgium: 1.04, benga: 1.05, bluegrass: 1.43, blues: 1.31, bohemia: 1.16, bollywood: 1.0, boombap: 1.17, bossa: 1.8, british: 0.95, caipira: 0.89, candombe: 0.87, canton: 0.92, celticpunk: 0.6, china: 0.87, chopin: 1.15, country: 1.15, cueca: 0.87, cumbia: 0.88, dance: 0.93, danish: 0.97, dutch: 1.22, edo: 0.79, egypt: 0.63, fado: 1.51, finland: 1.04, flamenco: 0.97, gamelan: 1.16, gnawa: 1.06, goema: 0.99, goral: 0.96, greek: 0.98, grunge: 0.75, hanse: 1.06, hardstyle: 0.54, highlife: 1.61, hungary: 1.4, indiefolk: 1.24, irish: 1.05, italy: 1.13, karneval: 1.18, khaleeji: 0.8, korea: 0.6, kulintang: 1.13, levant: 0.72, lioncity: 0.93, maghreb: 0.81, malay: 1.14, mariachi: 1.25, maskandi: 0.84, metal: 0.8, musette: 0.89, naniwa: 0.7, norteno: 0.92, norway: 1.02, opera: 0.82, orchestral: 0.94, philly: 0.89, provence: 0.89, pubrock: 0.85, quebec: 1.07, reggaeton: 0.56, rock: 0.9, romania: 0.88, rumba: 1.11, salsa: 1.21, samba: 0.73, samul: 0.8, scottish: 0.86, swedish: 1.06, synthwave: 1.25, taiwan: 1.06, tango: 0.87, techno: 0.65, thai: 1.12, trap: 0.61, urban: 0.64, valencia: 0.86, vienna: 1.1, western: 1.0, worlds: 0.71};
  const HIGH = ['bell', 'kalimba', 'carillon', 'ranat', 'kulintang', 'bonang', 'gender', 'epiano', 'synth', 'pluck', 'saw'];
  let cur = null;
  function start(o, seed) {
    stop(0.2);
    const A = global.RLSfx && global.RLSfx.audio && global.RLSfx.audio();
    if (!A) return;
    if (typeof o === 'string') o = { city: seed || o, country: '' };
    const P = compose(o.city || 'City', o.country || '', !!o.worlds);
    const { ctx, out, noise } = A;
    const bus = ctx.createGain(); bus.gain.setValueAtTime(0.0001, ctx.currentTime); bus.gain.exponentialRampToValueAtTime(LEVEL[P.style] || 1, ctx.currentTime + 0.4); bus.connect(out);
    const pre = ctx.createGain(); pre.connect(bus);
    try { // a hall sized per city
      const n = Math.floor(ctx.sampleRate * P.arr.verb), ir = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
      const conv = ctx.createConvolver(); conv.buffer = ir; const wet = ctx.createGain(); wet.gain.value = P.arr.wet;
      pre.connect(conv); conv.connect(wet); wet.connect(bus);
    } catch (e) { /* no convolver */ }
    const I = kit(ctx, pre, noise), A2 = P.arr, sty = P.sty;
    const st = P.S === 16 ? 60 / P.bpm / 4 : 60 / P.bpm / 3, L = st * P.S;
    const bigHit = makeHit(I, P);
    const ostUp = HIGH.includes(A2.ost) ? 12 : A2.ost === 'cello' ? 0 : -12;
    let next = ctx.currentTime + 0.08, b = 0;
    const T0 = next;
    const playBar = (t, bar) => {
      if (bar === 0) { // the signature intro over a build: a riser and the style's drums swelling into the drop
        signature(I, P, t, L, st);
        I.riser(t + L * 0.3, L * 0.7, 0.8, P.key); I.revcym(t + L * 0.5, L * 0.5, 1);
        for (let k = (3 * P.S) / 4; k < P.S; k++) DRUMS[P.drums](I, k, t + k * st, P.S, 0, 7, P.key, st);
        return;
      }
      const pb = (bar - 1) % 8, d = P.prog[pb % 4], loop = Math.floor((bar - 1) / 8);
      const ch = [P.note(d), P.note(d + 2), P.note(d + 4)];
      if (pb === 0) { bigHit(t, 1.1); I.boom(t, 0.7, A2.boom); }
      if (pb === 4) bigHit(t, 0.7);
      COMP[P.comp](I, ch, P.note(d), t, L, st, P.S, A2.ci, P.key);
      BASS[A2.bassPat](I, A2.bass, P.note(d), t, L, st, P.S);
      if (sty.strings && pb % 2 === 0) I.strings(ch, t, L * 2, 0.6);
      if (sty.didge && pb % 2 === 0) I.didge(P.key - 24, t, L * 2, 0.8);
      if (sty.choir) I.choir(ch.map((m) => m + 12), t, L, 0.9);
      // the driving ostinato on the style's own instrument, through the chord
      if (A2.ost !== 'acid') A2.ostPat.forEach((k, i) => I[A2.ost](P.note(d + A2.ostShape[i % 4]) + ostUp, t + k * st, st * 2, k % (P.S / 4) === 0 ? 0.55 : 0.38));
      for (let k = 0; k < P.S; k++) DRUMS[P.drums](I, k, t + k * st, P.S, bar, pb, P.key, st);
      if (pb === 7) { I.riser(t + L * 0.5, L * 0.5, 0.7, P.key + 12); I.revcym(t + L * 0.5, L * 0.5, 0.8); }
      const voice = A2.second && pb >= 4 && pb < 7 && loop % 2 === 0 ? A2.second : P.lead; // a second instrument answers
      P.melody.forEach((x) => {
        if (x.bar !== pb) return;
        const m = P.note(x.deg), at = t + x.k * st, len = x.len * st;
        I[voice](m, at, len, 1);
        if (sty.harmony) I[voice](P.note(x.deg - 2), at, len, 0.55);
      });
    };
    const timer = setInterval(() => {
      if (!cur || cur.timer !== timer) return;
      while (next < ctx.currentTime + 0.45) { try { playBar(next, b); } catch (e) { if (global.__musErr) global.__musErr.push(String((e && e.stack) || e)); } next += L; b++; }
    }, 70);
    const hit = (kind) => { // on the opener's cuts (js/opener.js), snapped to the beat
      const now = ctx.currentTime, beat = st * (P.S / 4), q = Math.max(0, Math.round((now - T0) / beat) * beat + T0 - now);
      const t = now + (q < 0.09 ? q : 0.01);
      try { bigHit(t, kind === 'big' ? 1.2 : 0.75); if (kind === 'big') I.boom(t, 0.8, A2.boom); } catch (e) { /* audio node limits */ }
    };
    cur = { timer, bus, ctx, hit, info: { city: o.city, style: P.style, flavour: P.fname, scale: P.scaleName, bpm: P.bpm, key: P.key, lead: P.lead, second: A2.second, ost: A2.ost, drums: P.drums, comp: P.comp, hit: sty.hit, sig: sty.sig.join(':') } };
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
  global.RLMusic = { start, stop, compose, kit, LEVEL, STYLE, CITY, hit: (k) => cur && cur.hit && cur.hit(k), get playing() { return !!cur; }, get info() { return cur && cur.info; } };
})(window);
