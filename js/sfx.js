/* RL Esports Simulator — UI sound effects.
 *
 * Everything is synthesised with the Web Audio API (no sound files): hover ticks, clicks, tab switches, dialogs,
 * toasts, start and simulate cues, a denied buzz, intro whooshes and impacts, a goal horn with crowd, and a fanfare
 * for champions. Audio starts on the first click or key press (browsers require a gesture). The settings are kept
 * per browser: on/off and volume (Settings, or the speaker button in the top bar).
 */
(function (global) {
  'use strict';
  const KEY = 'rlsim.sfx';
  let cfg = { on: true, vol: 0.55 };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage blocked */ }
  const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* storage blocked */ } };
  let ctx = null, master = null, noiseBuf = null;
  function init() {
    if (ctx) return ctx;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = cfg.vol;
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  const unlock = () => { if (!cfg.on) return; init(); if (ctx && ctx.state === 'suspended') ctx.resume(); };
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => global.addEventListener(ev, unlock, { capture: true, passive: true }));

  /* ---------- building blocks ---------- */
  function tone(f0, f1, dur, o) {
    o = o || {};
    const t = ctx.currentTime + (o.at || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const peak = o.gain || 0.2, a = o.attack || 0.004;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dur, o) {
    o = o || {};
    const t = ctx.currentTime + (o.at || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    const g = ctx.createGain(), peak = o.gain || 0.15;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + (o.attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }
  const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note → Hz

  /* ---------- the sounds ---------- */
  const SOUNDS = {
    hover: () => tone(2600, 2400, 0.03, { gain: 0.025 }),
    click: () => { tone(720, 520, 0.06, { type: 'triangle', gain: 0.16 }); noise(0.025, { f0: 3500, q: 2, gain: 0.05 }); },
    tab: () => { tone(560, 560, 0.05, { type: 'triangle', gain: 0.12 }); tone(840, 840, 0.06, { type: 'triangle', gain: 0.1, at: 0.045 }); },
    open: () => { tone(380, 880, 0.14, { type: 'sine', gain: 0.14 }); tone(1320, 1760, 0.12, { gain: 0.04, at: 0.06 }); },
    close: () => tone(820, 360, 0.11, { type: 'sine', gain: 0.12 }),
    toast: () => { tone(880, 880, 0.08, { gain: 0.12 }); tone(1320, 1320, 0.12, { gain: 0.09, at: 0.06 }); },
    confirm: () => [72, 76, 79, 84].forEach((n, i) => tone(N(n), N(n), 0.18, { type: 'square', lp: 2400, gain: 0.07, at: i * 0.055 })),
    sim: () => { tone(160, 1100, 0.32, { type: 'sawtooth', lp: 1800, gain: 0.07 }); noise(0.3, { f0: 600, f1: 4000, q: 3, gain: 0.05 }); tone(N(84), N(84), 0.14, { gain: 0.08, at: 0.3 }); },
    deny: () => { tone(190, 170, 0.09, { type: 'square', lp: 900, gain: 0.09 }); tone(190, 160, 0.11, { type: 'square', lp: 900, gain: 0.09, at: 0.11 }); },
    whoosh: () => noise(0.7, { f0: 300, f1: 3200, q: 0.8, gain: 0.16, attack: 0.25 }),
    impact: () => { tone(110, 38, 0.45, { gain: 0.45 }); noise(0.25, { filter: 'lowpass', f0: 1800, f1: 200, gain: 0.22 }); },
    count: () => tone(1500, 1500, 0.05, { type: 'triangle', gain: 0.07 }),
    goal: () => {
      [N(57), N(61), N(64)].forEach((f) => tone(f, f, 0.9, { type: 'sawtooth', lp: 1400, gain: 0.07, attack: 0.03 }));
      noise(1.6, { f0: 900, q: 0.5, gain: 0.12, attack: 0.15 }); // crowd
      tone(90, 45, 0.3, { gain: 0.3 });
    },
    fanfare: () => {
      const seq = [[60, 64, 67], [65, 69, 72], [67, 71, 74, 79]];
      seq.forEach((ch, i) => ch.forEach((n) => tone(N(n), N(n), i === 2 ? 1.1 : 0.26, { type: 'sawtooth', lp: 2200, gain: 0.05, attack: 0.02, at: i * 0.22 })));
      noise(1.8, { f0: 5000, q: 0.6, gain: 0.04, at: 0.44, attack: 0.1 }); // shimmer
    },
  };
  let lastAt = {};
  function play(name) {
    if (!cfg.on || !SOUNDS[name]) return;
    if (!init()) return;
    if (ctx.state === 'suspended') return; // no gesture yet
    const now = performance.now(), gap = name === 'hover' ? 60 : name === 'goal' ? 1200 : 35;
    if (lastAt[name] && now - lastAt[name] < gap) return;
    lastAt[name] = now;
    if (global.__sfxLog) global.__sfxLog.push(name); // test hook
    try { SOUNDS[name](); } catch (e) { /* audio node limits */ }
  }

  /* ---------- wiring: clicks, hovers, dialogs, toasts ---------- */
  const TAB = /^(nav|career-tab|career-view|stage-tab|th-tab|leader-tab|view-mode|archive|rank-region|browse-region|draw-tab|career-reg|career-vpick|set-season|live-speed|playstyle|format|side-mode)$/;
  const START = /^(start|comp-start|side-start|career-play|career-pick|career-viewer|career-go|play-live|custom-match-start|region-league|mega|build-league|resume|career-next-season|home-career-new-ok|career-job)$/;
  const SIM = /^(sim-all|sim-day|sim-one|career-sim|career-sim-rest|career-out-sim|career-close-window|live-reveal)$/;
  const CLOSE = /^(close-modal|cut-skip)$/;
  function kind(el) {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return 'deny';
    const a = el.dataset && el.dataset.action;
    if (!a) return el.classList.contains('cut-skip') || el.classList.contains('cer-skip') || el.classList.contains('close-x') ? 'close' : 'click';
    if (CLOSE.test(a)) return 'close';
    if (SIM.test(a)) return 'sim';
    if (START.test(a)) return 'confirm';
    if (TAB.test(a)) return 'tab';
    return 'click';
  }
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest && ev.target.closest('button, [data-action], a.btn, .cs-item, summary');
    if (el) play(kind(el));
  }, true);
  // a disabled button swallows clicks: catch the press instead
  document.addEventListener('pointerdown', (ev) => { const el = ev.target.closest && ev.target.closest('button[disabled]'); if (el) play('deny'); }, true);
  let lastHover = null;
  document.addEventListener('pointerover', (ev) => {
    if (ev.pointerType && ev.pointerType !== 'mouse') return;
    const el = ev.target.closest && ev.target.closest('button:not([disabled]), [data-action], .cs-item');
    if (el && el !== lastHover) { lastHover = el; play('hover'); } else if (!el) lastHover = null;
  }, true);
  function watch() {
    const modal = document.getElementById('modalRoot'), toasts = document.getElementById('toastRoot');
    let hadModal = !!(modal && modal.firstElementChild);
    if (modal) new MutationObserver(() => { const has = !!modal.firstElementChild; if (has && !hadModal) play('open'); hadModal = has; }).observe(modal, { childList: true });
    if (toasts) new MutationObserver((m) => { if (m.some((x) => x.addedNodes.length)) play('toast'); }).observe(toasts, { childList: true });
    // goals on the live pitch and in ceremony replays
    if (global.RLPitch && !global.RLPitch.prototype.__sfx) {
      const g = global.RLPitch.prototype.goal;
      global.RLPitch.prototype.goal = function () { play('goal'); return g.apply(this, arguments); };
      global.RLPitch.prototype.__sfx = true;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();

  global.RLSfx = {
    play,
    get on() { return cfg.on; },
    get volume() { return cfg.vol; },
    set(o) { Object.assign(cfg, o); if (master) master.gain.value = cfg.vol; if (cfg.on) unlock(); saveCfg(); },
    toggle() { this.set({ on: !cfg.on }); if (cfg.on) setTimeout(() => play('confirm'), 30); return cfg.on; },
  };
})(window);
