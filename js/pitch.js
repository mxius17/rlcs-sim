/* RL Esports Simulator — top-down 2D match renderer.
 *
 * Geometry, speeds and handling use Rocket League's own numbers (unreal units, uu):
 *   field 10240 x 8192 with cut corners, goals 1786 wide / 642 high / 880 deep, ceiling 2044,
 *   ball radius 93, gravity 650 uu/s², car top speed 1410 (2300 supersonic on boost),
 *   boost 33.3/s, big pads 100 (10 s respawn), small pads 12 (4 s respawn), RLCS kickoff spawns.
 * Team A (blue) defends -x, Team B (orange) defends +x.
 *
 * The match engine has already decided every goal, shot, save and demo. This file stages them:
 * a "director" builds each one up (carry, pass/centre, shot) so it lands at its exact game time,
 * while the rest of the time the cars play free-form: first man challenges, second man supports,
 * third man sits back, players rotate out after a touch and collect boost.
 */
(function (global) {
  'use strict';
  const L = 5120, W = 4096, GW = 893, GH = 642, GD = 880, C = 1152, BR = 93, CEIL = 2044, G = 650;
  const K = L + W - C; // corner cut line |x| + |y| = K
  const TOUCH = 250; // contact distance: cars and ball are drawn larger than life so they read on screen
  const VW = 1100, VH = 820;
  const S = Math.min((VW - 40) / (2 * (L + GD)), (VH - 96) / (2 * W));
  const BLUE = '#1f8bff', ORANGE = '#f2542d'; // Azure Blue / Vermilion Orange
  // RLCS kickoff spawns for blue (orange mirrors): diagonals, off-centres, back centre
  const SPAWNS = [[-2560, -2048], [-2560, 2048], [-3840, -256], [-3840, 256], [-4608, 0]];
  const SMALL_PADS = [[0, -4240], [-1792, -4184], [1792, -4184], [-940, -3308], [940, -3308], [0, -2816], [-3584, -2484], [3584, -2484], [-1788, -2300], [1788, -2300], [-2048, -1036], [0, -1024], [2048, -1036], [-1024, 0], [1024, 0], [-2048, 1036], [0, 1024], [2048, 1036], [-1788, 2300], [1788, 2300], [-3584, 2484], [3584, 2484], [0, 2816], [-940, 3310], [940, 3308], [-1792, 4184], [1792, 4184], [0, 4240]].map(([x, y]) => [y, x]);
  const BIG_PADS = [[0, -3584], [0, 3584], [-4096, -3072], [-4096, 3072], [4096, -3072], [4096, 3072]];
  // turning curvature by speed (RL's steering table): tighter at low speed
  const CURV = [[0, 0.0069], [500, 0.00398], [1000, 0.00235], [1500, 0.001375], [1750, 0.0011], [2300, 0.00088]];

  const rnd = (a, b) => a + Math.random() * (b - a);
  const len = (x, y) => Math.hypot(x, y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const sgn = (v) => (v < 0 ? -1 : 1);
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const d3 = (b, p) => Math.hypot(p[0] - b.x, p[1] - b.y, (p[2] == null ? b.z : p[2]) - b.z);
  function curvature(v) {
    for (let i = 1; i < CURV.length; i++) if (v <= CURV[i][0]) { const [a, ca] = CURV[i - 1], [b, cb] = CURV[i]; return ca + ((v - a) / (b - a)) * (cb - ca); }
    return CURV[CURV.length - 1][1];
  }
  const throttleAccel = (v) => (v < 1400 ? 1600 - v * (1440 / 1400) : v < 1410 ? 160 : 0);

  function Pitch(canvas, teamA, teamB) {
    this.attach(canvas);
    this.teams = [teamA, teamB];
    this.cars = [];
    [teamA, teamB].forEach((team, ti) => {
      team.players.slice(0, 3).forEach((p, i) => {
        this.cars.push({ side: ti ? 'B' : 'A', s: ti ? -1 : 1, i, name: p.name, x: 0, y: 0, z: 17, vz: 0, hd: 0, v: 0, boost: 33, boosting: false, dead: 0, cd: 0, rotT: 0, dribbles: 0, air: false });
      });
    });
    this.ball = { x: 0, y: 0, z: BR, vx: 0, vy: 0, vz: 0, trail: [] };
    this.pads = SMALL_PADS.map(([x, y]) => ({ x, y, big: false, t: 0 })).concat(BIG_PADS.map(([x, y]) => ({ x, y, big: true, t: 0 })));
    this.fx = [];
    this.newGame();
  }

  Pitch.prototype.attach = function (canvas) {
    this.cv = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1) || 1;
    canvas.width = VW * dpr; canvas.height = VH * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  Pitch.prototype.newGame = function () {
    this.handled = new Set();
    this.fx = [];
    this.pads.forEach((p) => (p.t = 0));
    this.cars.forEach((c) => (c.boost = 33));
    this.kickoff();
  };

  /** Line both teams up on random mirrored RLCS spawns. */
  Pitch.prototype.kickoff = function () {
    const b = this.ball;
    Object.assign(b, { x: 0, y: 0, z: BR, vx: 0, vy: 0, vz: 0, trail: [] });
    this.hidden = false; this.inGoal = 0; this.pendingGoal = null; this.cur = null; this.flight = null; this.lastTouch = null; this.kicked = false;
    const pick = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 3).sort((p, q) => p - q);
    // the car on the nearest spawn takes the kickoff ("left goes" on double diagonals)
    this.cars.forEach((c) => {
      const sp = SPAWNS[pick[c.i]];
      const m = c.side === 'A' ? 1 : -1;
      Object.assign(c, { x: sp[0] * m, y: sp[1] * m, z: 17, vz: 0, v: 0, dead: 0, cd: 0, rotT: 0, dribbles: 0, air: false, boost: 33, boosting: false, kick: null, flip: null, flipCd: 0, wall: false, kickFlip: false, hasFlip: false, roll: 0, rollDir: 0 });
      c.hd = Math.atan2(-c.y, -c.x);
    });
    ['A', 'B'].forEach((side) => {
      const team = this.cars.filter((k) => k.side === side).sort((p, q) => len(p.x, p.y) - len(q.x, q.y) || p.y - q.y);
      team[0].kick = 'go';
      if (team.length === 2) team[1].kick = 'boost';
      else if (team[1]) { team[1].kick = 'cheat'; if (team[2]) team[2].kick = 'boost'; }
    });
    this.kickT = 0;
  };

  /* ================= simulation ================= */
  Pitch.prototype.update = function (t, dt, game, frozen) {
    if (dt <= 0) return;
    const n = Math.min(240, Math.ceil(dt / (1 / 90)));
    const h = dt / n;
    for (let k = 0; k < n; k++) {
      const tt = t - dt + h * (k + 1);
      if (frozen) { this.coast(h); continue; }
      this.kickT += h;
      if (this.pendingGoal) { this.pendingT += h; if (this.inGoal || this.pendingT > 1.5) this.explode(this.pendingGoal); }
      this.direct(tt, game, h);
      this.stepCars(h, tt);
      this.stepBall(h);
      this.stepPads(h);
    }
  };

  /** During goal celebrations: everything glides to a stop. */
  Pitch.prototype.coast = function (h) {
    if (this.pendingGoal) {
      this.pendingT += h; this.stepBall(h);
      if (this.inGoal || this.pendingT > 1.5) this.explode(this.pendingGoal);
    }
    this.cars.forEach((k) => {
      k.v *= Math.max(0, 1 - 2 * h);
      k.x = clamp(k.x + Math.cos(k.hd) * k.v * h, -L + 80, L - 80); k.y = clamp(k.y + Math.sin(k.hd) * k.v * h, -W + 80, W - 80);
      if (k.z > 17) { k.vz -= G * h; k.z = Math.max(17, k.z + k.vz * h); }
      k.boosting = false;
    });
  };

  Pitch.prototype.carFor = function (side, name) {
    return this.cars.find((c) => c.side === side && c.name === name) || this.cars.find((c) => c.side === side && !c.dead) || this.cars.find((c) => c.side === side);
  };

  /* ---------- ballistic helper: hit the ball from where it is to (x,y,z) in T seconds ---------- */
  function launch(b, x, y, z, T) {
    b.vx = (x - b.x) / T; b.vy = (y - b.y) / T; b.vz = (z - b.z + 0.5 * G * T * T) / T;
  }
  /** Keep free-play balls under ~1300 uu: RLCS play is mostly low and mid-height. */
  function capLift(b) { const vmax = Math.sqrt(Math.max(0, 2 * G * (1300 - b.z))); if (b.vz > vmax) b.vz = vmax; }

  /* ================= director: stage the engine's events ================= */
  Pitch.prototype.direct = function (t, game, h) {
    h = h || 1 / 90;
    const evs = game.events;
    // demos: the attacker boosts into the victim
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      if (e.type !== 'demo' || this.handled.has(i)) continue;
      if (e.t - t > 2.2) break;
      const atk = this.carFor(e.side, e.who), vic = this.carFor(e.side === 'A' ? 'B' : 'A', e.victim);
      if (t >= e.t) {
        this.handled.add(i); atk.demoOn = null;
        if (!vic.dead && !atk.dead) {
          vic.dead = 3; vic.hasFlip = false; // RL respawn time
          this.burst(vic.x, vic.y, vic.side === 'A' ? BLUE : ORANGE, 30); this.ring(vic.x, vic.y, '#ffffff', 900);
        }
      } else if (!atk.dead && !vic.dead && !this.isActor(atk)) {
        atk.demoOn = vic;
        this.hurry(atk, vic.x, vic.y, null, e.t - t, h, 150);
      }
    }
    if (this.cur && this.cur.done) this.cur = null;
    if (!this.cur) {
      for (let i = 0; i < evs.length; i++) {
        const e = evs[i];
        if (this.handled.has(i) || e.type === 'demo') continue;
        if (e.t < t - 0.05) { this.handled.add(i); continue; }
        if (e.t - t > 5.5) break;
        this.handled.add(i);
        this.stage(e, t);
        break;
      }
    }
    const c = this.cur;
    if (!c) return;
    const b = this.ball;
    this.marks(c, t, h);
    // look ahead: whoever takes the next shot starts closing in on the play while this one finishes
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      if (this.handled.has(i) || e.type === 'demo' || e.t < t) continue;
      if (e.t - t > 4) break;
      const nk = this.carFor(e.side, e.shooter || e.scorer);
      if (nk && !this.isActor(nk) && nk.dead <= 0) { const sx = e.side === 'A' ? 1 : -1; this.hurry(nk, clamp(b.x - sx * 700, -L + 600, L - 600), clamp(b.y, -W + 600, W - 600), null, Math.max(0.6, e.t - t - 0.8), h, 900); }
      break;
    }
    if (c.phase === 'carry') {
      // carry the ball to where the play is made (a dribble down the wing or into the slot)
      const [ox, oy] = c.carryTo;
      const remain = Math.max(0.15, c.tPass - t);
      const d = len(ox - b.x, oy - b.y);
      const sp = Math.min(1900, d / remain + 200);
      const [ux, uy] = norm(ox - b.x, oy - b.y);
      const k = 0.05;
      b.vx += (ux * sp - b.vx) * k; b.vy += (uy * sp - b.vy) * k;
      const carrier = c.passer || c.shooter;
      if (c.hood && carrier && !carrier.dead && len(carrier.x - b.x, carrier.y - b.y) < 360) {
        // ball balanced on the hood: it rides at roof height until the flick
        b.z += (175 - b.z) * 0.12; b.vz = 0; c.onHood = true;
      } else if (b.z > BR + 5) b.vz -= 200 * k; // settle it down
      if (c.airDrib && t >= c.tLift && t < c.tShot) {
        c.phase = 'air'; c.a0 = [b.x, b.y, Math.max(b.z, BR)]; c.aT0 = t; c.taps = 0;
        const k0 = c.shooter; if (k0 && !k0.dead) { k0.flip = null; this.ring(b.x, b.y, 'rgba(255,255,255,0.6)', 300); }
      } else if (t >= c.tPass) {
        const hitter = c.passer || c.shooter;
        // the hit waits for the car to actually be on the ball, up to a deadline that still lets the ball arrive in time
        const dl = c.kind === 'doubletap' ? c.tBB - Math.max(0.3, d3(b, c.bb) / 5000) : c.passer ? c.tShot - Math.max(0.45, d3(b, [c.spot[0], c.spot[1], c.spotZ]) / 4500) : 0;
        const ready = this.near(hitter) || t >= dl;
        if (!ready) { /* still on the way */ }
        else if (c.kind === 'doubletap') {
          launch(b, c.bb[0], c.bb[1], c.bb[2], Math.max(0.3, c.tBB - t));
          this.strike(c.shooter, b);
          c.phase = 'bb'; this.flight = c;
        } else if (c.passer) {
          // centre / pass into the shooting spot
          launch(b, c.spot[0], c.spot[1], c.spotZ, Math.max(0.45, c.tShot - t));
          this.strike(hitter, b);
          c.phase = 'pass'; this.flight = c;
        } else {
          c.phase = 'shoot';
        }
      }
    }
    if (c.phase === 'air') {
      // ball and car fly the path together: the car stays just under and behind the ball, tapping it along
      const D = Math.max(0.3, c.tShot - c.aT0), u = clamp((t - c.aT0) / D, 0, 1);
      const e3 = (q) => q * q * (3 - 2 * q);
      const [x0, y0, z0] = c.a0, [x1, y1] = c.spot, z1 = c.spotZ;
      const nTaps = Math.max(2, Math.round(D / 0.42));
      const CZ = CEIL - 150;
      const pos = c.ceil
        // up the wall with the ball, across the ceiling, drop off and meet it in the air
        ? (q) => [x0 + (x1 - x0) * q, q < 0.38 ? y0 : y0 + (y1 - y0) * e3((q - 0.38) / 0.62),
          q < 0.38 ? z0 + (CZ - z0) * Math.sin((q / 0.38) * Math.PI / 2) : CZ + (z1 - CZ) * Math.pow((q - 0.38) / 0.62, 1.6)]
        : (q) => [x0 + (x1 - x0) * q, y0 + (y1 - y0) * e3(q), z0 + (z1 - z0) * Math.sin(Math.min(1, q * 1.35) * Math.PI / 2) + 45 * Math.abs(Math.sin(q * nTaps * Math.PI))];
      const p0 = pos(u), p1 = pos(Math.min(1, u + 0.01));
      b.x = p0[0]; b.y = p0[1]; b.z = Math.max(BR, p0[2]);
      b.vx = (p1[0] - p0[0]) / (0.01 * D); b.vy = (p1[1] - p0[1]) / (0.01 * D); b.vz = (p1[2] - p0[2]) / (0.01 * D) + G / 90;
      const tap = Math.floor(u * nTaps);
      if (tap > c.taps && !c.ceil) { c.taps = tap; this.ring(b.x, b.y, 'rgba(255,255,255,0.45)', 160); }
      const k = c.shooter;
      if (k && !k.dead && !k.pinned) {
        const [ux, uy] = norm(b.vx || c.s, b.vy);
        const wallRide = c.ceil && u < 0.38; // ceiling shot: ride up the wall under the ball
        const gx = b.x - ux * 150, gy = wallRide ? c.a0[1] - sgn(c.a0[1]) * 60 : b.y - uy * 150, gz = Math.max(17, b.z - (wallRide ? 140 : 105));
        const gd = Math.hypot(gx - k.x, gy - k.y, gz - k.z), mx = 3400 * h;
        const f = gd > mx ? mx / gd : 1;
        k.x += (gx - k.x) * f; k.y += (gy - k.y) * f; k.z += (gz - k.z) * f; k.vz = 0; k.air = true; k.wall = false;
        k.hd = Math.atan2(uy, ux); k.v = len(b.vx, b.vy); k.boosting = true; k.boost = Math.max(0, k.boost - 20 / 90); k.pinned = true; k.flip = null;
        if (c.ceil) {
          // on the wall the car rides at the ball's height; on the ceiling it's upside down; dropping off gives a flip
          if (u < 0.38) k.boosting = u > 0.15;
          const onCeil = u > 0.3 && u < 0.55;
          k.rollDir = 0; k.roll = onCeil ? Math.PI : u >= 0.55 ? Math.PI * Math.max(0, 1 - (u - 0.55) / 0.12) : 0;
          if (u >= 0.55 && !c.didCeil) { c.didCeil = true; k.hasFlip = true; this.fx.push({ k: 'txt', car: k, text: 'CEILING', life: 0, max: 1, delay: 0 }); }
        }
        if (c.reset) {
          // flip reset: roll wheels-up into the ball, all four wheels touch it, roll back upright holding the flip
          const ru = c.resetU, w = u < ru - 0.18 ? 0 : u < ru ? (u - (ru - 0.18)) / 0.18 : u < ru + 0.14 ? 1 - (u - ru) / 0.14 : 0;
          k.rollDir = 0; k.roll = Math.PI * (w * w * (3 - 2 * w));
          if (u >= ru && !c.didReset) { c.didReset = true; this.flipReset(k); }
        }
      }
      if (t >= c.tShot) c.phase = 'shoot';
    }
    if (c.phase === 'bb' && t >= c.tBB) {
      // off the backboard and back out to where the second touch is made
      launch(b, c.spot[0], c.spot[1], c.spotZ, Math.max(0.3, c.tShot - t));
      this.ring(b.x, b.y, 'rgba(255,255,255,0.7)', 380); this.flight = c;
      c.phase = 'rebound';
    }
    if ((c.phase === 'pass' || c.phase === 'rebound' || c.phase === 'bb') && c.spotZ > 250) {
      // aerial to meet it: take off in time, boost up the line of the shot
      const k = c.shooter, tUp = clamp(c.spotZ / 750, 0.5, 1.35), rem = c.tShot - t;
      if (k && !k.dead && rem < tUp) {
        if (!c.up) c.up = [k.x, k.y, k.z];
        const q = clamp(1 - rem / tUp, 0, 1);
        const [ux, uy] = norm(c.target[0] - c.spot[0], c.target[1] - c.spot[1]);
        const ex = c.spot[0] - ux * 170, ey = c.spot[1] - uy * 170, ez = Math.max(17, c.spotZ - 90);
        const nx = c.up[0] + (ex - c.up[0]) * q, ny = c.up[1] + (ey - c.up[1]) * q, nz = c.up[2] + (ez - c.up[2]) * (q * (2 - q));
        k.hd = Math.atan2(ny - k.y, nx - k.x) || k.hd;
        // follow the take-off path, but never faster than a boosting car can fly
        const md = Math.hypot(nx - k.x, ny - k.y, nz - k.z), mx = 3400 * h, f = md > mx ? mx / md : 1;
        k.x += (nx - k.x) * f; k.y += (ny - k.y) * f; k.z += (nz - k.z) * f;
        k.vz = 0; k.air = true; k.wall = false; k.flip = null; k.boosting = true; k.boost = Math.max(0, k.boost - 25 / 90); k.v = 1400; k.pinned = true;
      }
    }
    if ((c.phase === 'pass' || c.phase === 'rebound') && t >= c.tShot) { c.phase = 'shoot'; this.flight = null; }
    if (c.phase === 'shoot' && (c.kind === 'airdribble' || (this.near(c.shooter) && (!c.mate || this.near(c.mate))) || t >= this.shotDeadline(c))) {
      // a struck shot never crawls: at least ~65 km/h (it simply arrives a touch early if the ball is already close)
      { const sd = d3(b, c.target); launch(b, c.target[0], c.target[1], c.target[2], Math.max(sd / 6000, clamp(sd / 1800, 0.12, Math.max(0.12, c.e.t - t)))); } // 65–215 km/h
      this.strike(c.shooter, b);
      if (c.onHood && !c.passer) this.burst(b.x, b.y, 'rgba(255,255,255,0.7)', 6); // the flick
      const sk = c.shooter;
      if (c.flick && sk && !sk.dead && c.onHood) {
        // flick variants: musty (backflip off the hood), 180 (turn around and flick), breezi (spinning flick)
        sk.flip = { kind: c.flick === 'musty' ? 'back' : c.flick === 'r180' ? 'r180' : 'spin', t: 0, dur: c.flick === 'breezi' ? 0.75 : 0.6, side: sgn(rnd(-1, 1)), hd0: sk.hd };
        this.burst(b.x, b.y, '#ffffff', 12);
      }
      if (c.mate && !c.mate.dead) {
        // team pinch: both teammates hit it at the same instant
        this.strike(c.mate, b); this.burst(b.x, b.y, '#ffffff', 26); this.ring(b.x, b.y, '#ffffff', 1100); this.shake = Math.max(this.shake || 0, 0.25);
      }
      if (c.kuxir) { this.burst(b.x, b.y, '#ffffff', 30); this.ring(b.x, b.y, c.e.side === 'A' ? BLUE : ORANGE, 1200); this.shake = Math.max(this.shake || 0, 0.25); }
      if (sk && sk.hasFlip && !sk.dead) {
        // the reset is used: a dodge in mid-air straight into the ball
        sk.hasFlip = false; sk.flip = { kind: this.flipKind(sk, b), t: 0, dur: 0.5, side: this.flipSide(sk, b), hd0: sk.hd };
        this.burst(b.x, b.y, '#ffffff', 16); this.ring(b.x, b.y, c.e.side === 'A' ? BLUE : ORANGE, 700);
      }
      const kmhNow = Math.round(Math.hypot(b.vx, b.vy, b.vz) * 0.036);
      const fl0 = c.flick && c.onHood ? { musty: 'Musty flick', r180: '180 flick', breezi: 'Breezi flick' }[c.flick] : null;
      const special = fl0 || (c.mate ? 'Team pinch' : c.kuxir ? 'Kuxir pinch' : c.ceil ? 'Ceiling shot' : null);
      const label = special || { pinch: 'Pinch', doubletap: 'Double tap', redirect: c.spotZ > 250 ? 'Aerial redirect' : 'Redirect', pass: 'One-timer', chip: 'Chip', airdribble: c.didReset ? 'Flip reset' : 'Air dribble', power: c.spotZ > 200 ? 'Half-volley' : 'Power shot' }[c.kind] || 'Shot';
      if (c.kind === 'pinch') { this.burst(b.x, b.y, '#ffffff', 22); this.ring(b.x, b.y, '#ffffff', 900); this.shake = Math.max(this.shake || 0, 0.18); }
      if (c.kind === 'redirect' || c.kind === 'doubletap') this.burst(b.x, b.y, c.e.side === 'A' ? BLUE : ORANGE, 10);
      this.fx.push({ k: 'txt', x: b.x, y: b.y, z: b.z, text: label.toUpperCase() + ' · ' + kmhNow + ' KM/H', life: 0, max: 1.6, delay: 0 });
      this.ring(b.x, b.y, 'rgba(255,255,255,0.9)', 420);
      c.phase = 'flight';
      this.flight = c;
    }
    if (c.phase === 'flight' && t >= c.e.t) {
      if (c.e.type === 'save') {
        const sv = c.saver;
        b.vx = -b.vx * rnd(0.25, 0.45); b.vy = b.vy * 0.3 + rnd(-1400, 1400); b.vz = rnd(300, 800);
        if (sv && !sv.dead) { sv.vz = Math.max(sv.vz, 300); sv.air = sv.z > 20 || sv.air; sv.v = 600; sv.rotT = 1.5; }
        this.ring(b.x, b.y, '#ffffff', 600); this.burst(b.x, b.y, '#ffffff', 12);
        this.lastTouch = sv;
      }
      this.flight = null;
      c.done = true; // goals keep flying into the net; misses carry on into the post/backboard
      if (c.e.type === 'goal') this.flight = c;
    }
  };

  /** Get a car to (x, y[, z]) within tLeft seconds. If its own driving won't make it, it is flown there on
   *  a hard boost (visibly, never more than 3400 uu/s): cars move continuously and never jump across the pitch. */
  Pitch.prototype.hurry = function (k, x, y, z, tLeft, h, slack, force) {
    if (!k || k.dead > 0 || k.pinned) return false; // one move per step
    const dx = x - k.x, dy = y - k.y, dz = z == null ? 0 : z - k.z, d = Math.hypot(dx, dy, dz);
    if (d <= (slack || 120)) return false;
    const need = d / Math.max(0.08, tLeft);
    const facing = Math.abs(wrap(Math.atan2(dy, dx) - k.hd)) < 0.5;
    if (!force && need < 1100 && (facing || tLeft > 1.2)) return false; // its own driving gets there
    const sp = clamp(Math.max(need * 1.05, k.v), 1400, 3400), step = Math.min(d, sp * h);
    k.x += (dx / d) * step; k.y += (dy / d) * step; k.z = Math.max(17, k.z + (dz / d) * step);
    k.hd = wrap(k.hd + clamp(wrap(Math.atan2(dy, dx) - k.hd), -9 * h, 9 * h));
    k.v = sp; k.boosting = k.boost > 0; k.boost = Math.max(0, k.boost - 33.3 * h); k.pinned = true; k.flip = null;
    if (k.z > 22) { k.air = true; k.vz = 0; }
    return true;
  };

  /** Keep the play's actors on schedule: carrier on the ball, shooter at the shooting spot, keeper on the line. */
  Pitch.prototype.marks = function (c, t, h) {
    const b = this.ball;
    const carrier = c.passer || c.shooter;
    if (c.phase === 'carry' && carrier) {
      const [ux, uy] = norm(b.vx || c.s, b.vy);
      const gx = b.x - ux * 200, gy = b.y - uy * 200, gd = len(gx - carrier.x, gy - carrier.y);
      if (gd < 1000) this.hurry(carrier, gx, gy, null, gd / (len(b.vx, b.vy) + 2.5 * gd + 1), h, 60, true); // on the ball: stay on it
      else this.hurry(carrier, gx, gy, null, Math.max(0.35, (c.tPass - t) * 0.5), h, 260);
    }
    if (c.passer && (c.phase === 'carry' || c.phase === 'pass') && !(c.spotZ > 250 && c.tShot - t < clamp(c.spotZ / 750, 0.5, 1.35)))
      this.hurry(c.shooter, c.spot[0] - c.s * 220, c.spot[1], null, c.tShot - t, h, 260);
    if ((c.phase === 'bb' || c.phase === 'rebound') && c.tShot - t > clamp(c.spotZ / 750, 0.5, 1.35))
      this.hurry(c.shooter, c.spot[0] - c.s * 400, c.spot[1], null, c.tShot - t - 0.4, h, 300);
    if (c.mate && !c.mate.dead && (c.phase === 'shoot' || c.tShot - t < 1.4)) {
      const [vx, vy] = norm(c.target[0] - b.x, c.target[1] - b.y);
      this.hurry(c.mate, b.x - vx * 170 - vy * 140, b.y - vy * 170 + vx * 140, null, Math.max(0.1, (c.phase === 'shoot' ? this.shotDeadline(c) : c.tShot) - t), h, 100, true);
    }
    if (c.phase === 'shoot' && c.kind !== 'airdribble') {
      const [ux, uy] = norm(c.target[0] - b.x, c.target[1] - b.y);
      this.hurry(c.shooter, b.x - ux * 170, b.y - uy * 170, b.z > 220 ? b.z - 80 : null, Math.max(0.1, this.shotDeadline(c) - t), h, 100, true);
    }
    const sv = c.saver;
    if (sv && !sv.dead && c.e.type === 'save') {
      // be where the shot arrives, a car length off the line, at its height
      const tz = c.target[2] > 200 ? c.target[2] - 60 : 17;
      this.hurry(sv, c.target[0] - c.s * 180, c.target[1], c.phase === 'flight' && c.e.t - t < 0.6 ? tz : null, c.e.t - t, h, 220);
    }
  };

  Pitch.prototype.near = function (k) { const b = this.ball; return !!k && k.dead <= 0 && Math.hypot(k.x - b.x, k.y - b.y, k.z + 40 - b.z) < 330; };
  /** Latest moment a shot can still be struck and reach its target at a believable speed (≤ ~215 km/h). */
  Pitch.prototype.shotDeadline = function (c) { return c.e.t - Math.max(0.25, d3(this.ball, c.target) / 6000); };

  Pitch.prototype.isActor = function (k) { const c = this.cur; return !!c && (k === c.shooter || k === c.passer || k === c.saver); };

  /** A car strikes the ball: put it on the ball for the hit, facing where the ball goes. */
  Pitch.prototype.strike = function (k, b) {
    if (!k || k.dead) return;
    const [hx, hy] = norm(b.vx, b.vy);
    k.v = Math.max(k.v, 1500);
    if (b.z > 260 && k.z > 40) { k.vz = 200; k.air = true; }
    k.rotT = rnd(2.5, 3.8); k.cd = 0.8; k.dribbles = 0;
    if (k.z < 40) this.dodge(k, this.flipKind(k, b), this.flipSide(k, b));
    this.lastTouch = k;
  };

  /** Leaving the ground: dust puff, a little stretch, maybe an air roll, and a second-jump puff on aerials. */
  Pitch.prototype.takeoff = function (k) {
    k.jumpT = 0.16; k.roll = 0;
    const r = Math.random();
    k.rollDir = r < 0.4 ? 0 : (r < 0.7 ? 1 : -1) * rnd(0.6, 1.1);
    k.tornado = !k.pinned && k.vz > 600 && Math.random() < 0.008; k.spin = 0;
    this.fx.push({ k: 'ring', x: k.x, y: k.y, z: 0, color: 'rgba(255,255,255,0.45)', r: 300, life: 0, max: 0.4, delay: 0 });
    if (k.vz > 700 || k.pinned) k.dj = 0.14;
  };

  /** All four wheels on the ball in mid-air: the car gets its flip back. */
  Pitch.prototype.flipReset = function (k) {
    k.hasFlip = true;
    this.fx.push({ k: 'wh', car: k, life: 0, max: 0.55, delay: 0 });
    this.fx.push({ k: 'txt', car: k, text: 'FLIP RESET', life: 0, max: 1.3, delay: 0 });
    this.ring(k.x, k.y, '#ffffff', 420);
  };

  /** Front flip when the ball goes where the car points, side/diagonal flip when it goes off at an angle. */
  Pitch.prototype.flipKind = function (k, b) { const a = Math.abs(wrap(Math.atan2(b.vy, b.vx) - k.hd)); return a < 0.35 ? 'front' : a < 1.1 ? 'diag' : 'side'; };
  Pitch.prototype.flipSide = function (k, b) { return sgn(wrap(Math.atan2(b.vy, b.vx) - k.hd)); };

  /** Dodges: front/diagonal/side flips (+500 uu/s), speed flips and half-flips (180° turn-around). */
  Pitch.prototype.dodge = function (k, kind, side) {
    if (k.flip || k.dead > 0 || k.wall) return;
    const dur = kind === 'half' ? 0.7 : kind === 'speed' ? 0.5 : kind === 'wave' ? 0.28 : 0.62;
    if (kind === 'wave') this.fx.push({ k: 'ring', x: k.x, y: k.y, z: 0, color: 'rgba(255,255,255,0.5)', r: 260, life: 0, max: 0.35, delay: 0 });
    k.flip = { kind, t: 0, dur, side: side || (Math.random() < 0.5 ? -1 : 1), hd0: k.hd };
    k.flipCd = kind === 'half' ? 1.1 : kind === 'wave' ? 0.05 : 1.5;
    if (kind === 'half') { k.hd = wrap(k.hd + Math.PI); k.v = 350; }
    else k.v = Math.min(2300, k.v + (kind === 'speed' ? 600 : kind === 'side' ? 380 : kind === 'wave' ? 480 : 500));
  };

  /** Both first men arrive together: the ball squirts out of the 50/50 and both cars bounce off. */
  Pitch.prototype.fifty = function (a, o) {
    const b = this.ball;
    const [ux, uy] = norm(o.x - a.x, o.y - a.y);
    const win = Math.random() < 0.5 ? 1 : -1, lat = Math.random() < 0.5 ? 1 : -1;
    const sp = rnd(500, 1400), fw = rnd(200, 1000);
    b.vx = -uy * sp * lat + ux * fw * win; b.vy = ux * sp * lat + uy * fw * win; b.vz = rnd(250, 950); capLift(b);
    [a, o].forEach((k) => { this.dodge(k, 'front'); k.v = rnd(150, 450); k.cd = 0.6; k.rotT = rnd(0.6, 1.6); k.dribbles = 0; });
    this.ring(b.x, b.y, '#ffffff', 700); this.burst(b.x, b.y, '#ffffff', 10);
    this.lastTouch = Math.random() < 0.5 ? a : o;
  };

  Pitch.prototype.stage = function (e, t) {
    const s = e.side === 'A' ? 1 : -1; // attacking direction
    const b = this.ball;
    const kmh = e.speed || rnd(80, 120);
    let v = clamp(kmh / 0.036, 1900, 5000);
    const avail = e.t - t;
    const alive = (k, side) => (k && k.dead <= 0 ? k : this.cars.filter((q) => q.side === side && q.dead <= 0).sort((p, q) => len(p.x - b.x, p.y - b.y) - len(q.x - b.x, q.y - b.y))[0] || k);
    const shooter = alive(this.carFor(e.side, e.shooter || e.scorer), e.side);
    const mates = this.cars.filter((k) => k.side === e.side && k !== shooter);
    let passer = null;
    if (e.assist) passer = this.carFor(e.side, e.assist);
    else if (Math.random() < 0.4) passer = mates[Math.floor(Math.random() * mates.length)];
    if (passer && passer.dead > 0) passer = null;
    if (passer === shooter) passer = null;
    // outcome target
    let target;
    if (e.type === 'goal') target = [s * (L + BR + 120), rnd(-GW * 0.78, GW * 0.78), rnd(BR, GH - 140)];
    else if (e.type === 'save') target = [s * (L - 40), rnd(-GW * 0.75, GW * 0.75), rnd(BR, GH - 160)];
    else if (Math.random() < 0.5) target = [s * (L - BR), rnd(-GW, GW), rnd(GH + 150, GH + 600)]; // off the backboard
    else target = [s * (L - BR), sgn(rnd(-1, 1)) * rnd(GW + 120, GW + 900), rnd(BR, 500)]; // wide of the post
    // how the shot is made
    // rare mechanics: a ceiling shot is a long wall-to-ceiling air play
    const ceiling = Math.random() < 0.1;
    const airDur = ceiling ? rnd(2.3, 2.9) : rnd(1.1, 2.0);
    let kind;
    const r = Math.random();
    if ((!passer || (!e.assist && Math.random() < 0.5)) && avail > airDur + 1.2 && Math.random() < (e.type === 'goal' ? 0.3 : 0.22)) { kind = 'airdribble'; passer = null; }
    else if (passer) kind = r < 0.015 && avail > 2.5 ? 'teampinch' : r < 0.42 ? 'redirect' : 'pass';
    else kind = r < 0.2 ? 'pinch' : r < 0.36 ? 'doubletap' : r < 0.5 ? 'chip' : 'power';
    const wing = sgn(b.y || rnd(-1, 1));
    let spot = [s * rnd(L - 3000, L - 1300), rnd(-1500, 1500)], spotZ = BR;
    let kuxir = false, mate = null;
    if (kind === 'teampinch') { mate = passer; passer = null; kind = 'pass'; v = rnd(5200, 6000); spot = [s * rnd(L - 3200, L - 1800), rnd(-1500, 1500)]; } // two teammates hit it at once
    if (kind === 'pinch') { kuxir = Math.random() < 0.15; spot = [s * rnd(L - 2700, L - 1300), wing * (W - BR - 20)]; spotZ = kuxir ? rnd(250, 450) : rnd(BR, 260); v = kuxir ? rnd(5400, 6000) : rnd(4400, 5600); }
    else if (kind === 'doubletap') { spot = [s * rnd(L - 1500, L - 950), rnd(-650, 650)]; spotZ = rnd(380, 820); v = clamp(v, 2600, 4600); }
    else if (kind === 'redirect') { spot = [s * rnd(L - 2200, L - 1000), rnd(-1200, 1200)]; spotZ = rnd(320, 1000); v = clamp(v * 1.1, 2700, 5200); }
    else if (kind === 'chip') { spot = [s * rnd(L - 3700, L - 2500), rnd(-1800, 1800)]; v = rnd(1500, 2100); if (e.type !== 'shot') target[2] = Math.max(target[2], rnd(380, GH - 120)); }
    else if (kind === 'airdribble') spotZ = rnd(450, 1050);
    else if (kind === 'power' && Math.random() < 0.3) spotZ = rnd(220, 480); // half-volley off a bounce
    const defSide = e.side === 'A' ? 'B' : 'A';
    const saver = e.type === 'save' ? alive(this.carFor(defSide, e.saver), defSide) : null;
    let shooterV = shooter; // the car that is shown taking the shot
    let flightT, tShot, tPass, tBB, bb, carryTo, wall;
    const build = () => {
      flightT = len(target[0] - spot[0], target[1] - spot[1]) / v;
      // not enough time to build the play: fall back to a quick shot / rebound
      if ((passer && avail < flightT + 1.6) || (kind === 'doubletap' && avail < flightT + 2.4)) { passer = null; if (kind !== 'airdribble') { kind = 'power'; spotZ = Math.min(spotZ, 480); } }
      if (kind === 'airdribble' && avail < flightT + airDur + 0.6) { kind = 'power'; spotZ = BR; }
      tShot = e.t - flightT;
      tPass = passer ? tShot - rnd(0.9, 1.4) : tShot; tBB = 0; bb = null;
      if (kind === 'doubletap') {
        // first hit onto the backboard, it comes back off the wall, second touch redirects it in
        tBB = tShot - rnd(0.55, 0.8); tPass = tBB - rnd(0.7, 0.95);
        bb = [s * (L - BR - 5), clamp(spot[1] * 1.3 + rnd(-300, 300), -1500, 1500), rnd(GH + 180, GH + 650)];
      }
      carryTo = passer ? [s * rnd(L - 3200, L - 1600), wing * rnd(2300, 3300)] : spot;
      if (kind === 'doubletap') carryTo = [s * rnd(L - 3300, L - 2400), rnd(-1200, 1200)];
      wall = false;
      if (kind === 'airdribble') {
        wall = Math.random() < 0.4;
        const back = airDur * rnd(1000, 1250);
        carryTo = wall ? [s * clamp(spot[0] * s - back * 0.8, -L + 1500, L - 1600), sgn(spot[1] || b.y || 1) * (W - 260)]
          : [s * clamp(spot[0] * s - back, -L + 1500, L - 1600), clamp(spot[1] * 0.6 + rnd(-500, 500), -2600, 2600)];
      }
      // when the ball's first toucher must be on it, and where the ball is heading meanwhile
      const tFirst = (kind === 'airdribble' ? tShot - airDur : tPass) - t;
      return tFirst;
    };
    // can the cars actually get there? (a boosting car covers ~2600 uu/s with turns; the ball also comes toward them)
    const REACH = 2600;
    const tTo = (k, x, y) => (k ? len(k.x - x, k.y - y) / REACH : 99);
    const nearest = (ex) => mates.concat([shooter]).filter((k) => k.dead <= 0 && !ex.includes(k)).sort((p, q) => tTo(p, b.x, b.y) - tTo(q, b.x, b.y))[0];
    let tFirst = build();
    const first = () => passer || shooterV;
    if (tTo(first(), b.x, b.y) > tFirst + 0.15) {
      if (passer) {
        const n = nearest([shooterV]);
        if (n && tTo(n, b.x, b.y) <= tFirst + 0.15) passer = n; else { passer = null; kind = 'power'; spotZ = Math.min(spotZ, 480); }
      } else {
        const n = nearest([shooterV]);
        if (n && tTo(n, b.x, b.y) <= tFirst + 0.6 && avail > 2.2) { passer = n; kind = 'pass'; spotZ = BR; } // a teammate on the ball sets the shooter up
      }
      tFirst = build();
      if (tTo(first(), b.x, b.y) > tFirst + 0.15) { const n = nearest([]); if (n) { if (passer && n !== shooterV) passer = n; else { shooterV = n; passer = null; } } tFirst = build(); }
    }
    // the receiver of a pass must reach the shooting spot: bring the spot to them if needed
    if (passer && tTo(shooterV, spot[0], spot[1]) > tShot - t - 0.2) {
      spot = [clamp(shooterV.x + s * 700, -L + 900, L - 900), clamp(shooterV.y * 0.85, -W + 900, W - 900)];
      tFirst = build();
      if (passer && tTo(passer, b.x, b.y) > tFirst + 0.3) passer = null, kind = 'power', build();
    }
    const hood = (kind === 'power' || kind === 'chip') && tShot - t > 1.6 && Math.random() < 0.35;
    const isCeil = kind === 'airdribble' && ceiling;
    if (isCeil) { wall = true; carryTo = [s * clamp(spot[0] * s - 2200, -L + 1500, L - 2600), wing * (W - 260)]; }
    const reset = kind === 'airdribble' && !isCeil && airDur > 1.3 && Math.random() < 0.18;
    // flick off a hood dribble: mostly a plain flick, now and then a musty / 180 / breezi
    const fr = Math.random();
    const flick = hood ? (fr < 0.08 ? 'musty' : fr < 0.14 ? 'r180' : fr < 0.21 ? 'breezi' : null) : null;
    if (mate && mate.dead > 0) mate = null;
    this.cur = { e, s, kind, spot, spotZ, target, shooter: shooterV, passer, saver, tShot, tPass, tBB, bb, carryTo, phase: tShot - t < 0.25 ? 'shoot' : 'carry', hood, airDrib: kind === 'airdribble', airDur, wall, tLift: tShot - airDur, reset, resetU: rnd(0.4, 0.6), ceil: isCeil, flick, kuxir, mate };
  };

  /* ================= free play: where each car wants to be ================= */
  Pitch.prototype.plan = function (t) {
    const b = this.ball, c = this.cur;
    const out = new Map();
    const reach = (k) => {
      // time-ish to the ball, punishing cars on the wrong side of it and cars rotating out
      const s = k.s;
      return len(b.x - k.x, b.y - k.y) / 1500 + (s * (k.x - b.x) > 200 ? 1.1 : 0) + (k.rotT > 0 ? 3 : 0) + (k.dead > 0 ? 9 : 0);
    };
    const first = {};
    ['A', 'B'].forEach((side) => {
      const team = this.cars.filter((k) => k.side === side);
      const order = team.slice().sort((p, q) => reach(p) - reach(q));
      // hysteresis: keep the current first man unless a teammate is clearly better placed
      const prev = this['first' + side];
      let f = order[0];
      if (prev && !prev.dead && prev.rotT <= 0 && reach(prev) < reach(f) + 0.35) f = prev;
      this['first' + side] = f;
      first[side] = { f, order, r: reach(f) };
    });
    ['A', 'B'].forEach((side) => {
      const s = side === 'A' ? 1 : -1;
      const own = -s * L, opp = s * L;
      const F = first[side], O = first[side === 'A' ? 'B' : 'A'];
      const depth = s * b.x; // >0: ball in the opponent half
      const atk = c && c.e.side === side, def = c && c.e.side !== side;
      const f = F.f;
      // challenge, or shadow (stay goal-side) when the opponent will clearly get there first
      if (!def && (atk || F.r < O.r + 0.45 || depth > 2000)) {
        const lead = clamp(len(b.x - f.x, b.y - f.y) / 1800, 0, 1.2);
        const px = clamp(b.x + b.vx * lead, -L + 200, L - 200), py = clamp(b.y + b.vy * lead, -W + 200, W - 200);
        const [ax, ay] = norm(opp - px, -py * 0.5);
        const behind = s * (f.x - px) < -120;
        out.set(f, behind ? { x: px + ax * 300, y: py + ay * 300, boost: len(px - f.x, py - f.y) > 900 || depth < 0, role: 1 }
          : { x: px - ax * 700 + -ay * 500 * sgn(f.y - py), y: py - ay * 700 + ax * 500 * sgn(f.y - py), boost: true, role: 1 });
      } else {
        const [gx, gy] = norm(own - b.x, -b.y);
        out.set(f, { x: b.x + gx * 1500, y: b.y + gy * 1500, boost: false, role: 1 });
      }
      const rest = F.order.filter((k) => k !== f);
      rest.forEach((k, j) => {
        if (k.dead > 0) return;
        if (k.rotT > 0) {
          // rotate out: back-post side, through the boost on the way
          const far = -sgn(b.y || 1);
          const pad = this.pads.find((p) => p.big && p.t <= 0 && s * p.x < 0 && sgn(p.y) === far);
          if (k.boost < 45 && pad) out.set(k, { x: pad.x, y: pad.y, boost: false, role: 4 });
          else out.set(k, { x: clamp(b.x - s * 3200, -L + 1300, L - 1300), y: far * 2600, boost: false, role: 4 });
          return;
        }
        if (k.boost < 22) {
          const pads = this.pads.filter((p) => p.big && p.t <= 0 && s * (p.x - k.x) < 800);
          if (pads.length) { const p = pads.sort((p1, p2) => len(p1.x - k.x, p1.y - k.y) - len(p2.x - k.x, p2.y - k.y))[0]; out.set(k, { x: p.x, y: p.y, boost: false, role: 5 }); return; }
        }
        if (j === 0) {
          // second man: ready for the next touch, a little behind and to the other side of the ball
          const sx = depth > 0 ? b.x - s * 2000 : b.x - s * 2500;
          out.set(k, { x: clamp(sx, -L + 1500, L - 1500), y: clamp(-b.y * 0.45, -2600, 2600), boost: false, role: 2 });
        } else {
          // third man: last back, between the ball and the net (never parked in it)
          let tx = b.x - s * 4200;
          if (s * (tx - own) < 1400) tx = own + s * 1400;
          let ty = clamp(b.y * 0.3, -1500, 1500);
          if (depth < -(L - 2400)) { tx = own + s * 650; ty = -sgn(b.y || 1) * 600; } // ball in our corner: back post
          out.set(k, { x: clamp(tx, -L + 600, L - 600), y: ty, boost: false, role: 3 });
        }
      });
    });
    // directed plays override the free-play plan
    if (c) {
      const b2 = this.ball;
      const sh = c.shooter, ps = c.passer, sv = c.saver;
      if (c.phase === 'carry') {
        const carrier = ps || sh;
        const [ux, uy] = norm(b2.vx || c.s, b2.vy);
        const off = c.onHood ? 30 : 200; // under the ball when it sits on the hood
        out.set(carrier, { x: b2.x - ux * off, y: b2.y - uy * off, boost: true, role: 1, carry: true });
        if (ps) out.set(sh, { x: c.spot[0] - c.s * 900, y: c.spot[1] * 0.7, boost: true, role: 2 });
      } else if (c.phase === 'pass' || c.phase === 'bb' || c.phase === 'rebound') {
        out.set(sh, { x: c.spot[0] - c.s * 220, y: c.spot[1], boost: true, role: 1, arriveBy: c.tShot });
      }
      if (sv && !sv.dead && c.e.type === 'save') {
        const own = c.s * L;
        const gy = clamp(c.phase === 'flight' ? b2.y + (b2.vy / (Math.abs(b2.vx) || 1)) * Math.abs(own - b2.x) : b2.y * 0.25, -GW + 100, GW - 100);
        out.set(sv, { x: own - c.s * 250, y: gy, boost: true, role: 6 });
      }
      // the defending team's challenger steps up and gets beaten
      const dside = c.e.side === 'A' ? 'B' : 'A';
      const dfirst = this['first' + dside];
      if (dfirst && dfirst !== sv && c.phase !== 'flight') {
        const carrier = c.phase === 'carry' ? (ps || sh) : sh;
        out.set(dfirst, { x: carrier.x + c.s * 500, y: carrier.y + (carrier.y > 0 ? -300 : 300), boost: true, role: 1 });
      }
    }
    // kickoff routes
    if (this.kickT < 2.5) {
      this.cars.forEach((k) => {
        if (k.kick === 'go' && this.kickT < 2.5 && !this.kicked) out.set(k, { x: 0, y: 0, boost: true, role: 1 });
        else if (k.kick === 'cheat' && this.kickT < 2.5) out.set(k, { x: -k.s * 2000, y: k.y * 0.3, boost: true, role: 2 });
        else if (k.kick === 'boost' && this.kickT < 2.5) { const p = this.pads.find((p) => p.big && sgn(p.x) === -k.s && sgn(p.y) === sgn(k.y || 1)); if (p) out.set(k, { x: p.x, y: p.y, boost: true, role: 5 }); }
      });
    }
    return out;
  };

  /* ---------- car physics: throttle, boost, RL turning radius, powerslides ---------- */
  Pitch.prototype.drive = function (k, tg, h) {
    let tx = tg ? tg.x : k.x + Math.cos(k.hd) * 400, ty = tg ? tg.y : k.y + Math.sin(k.hd) * 400;
    if (k.demoOn && !k.demoOn.dead) { tx = k.demoOn.x; ty = k.demoOn.y; tg = { boost: true }; }
    const dx = tx - k.x, dy = ty - k.y, d = len(dx, dy);
    const err = wrap(Math.atan2(dy, dx) - k.hd);
    let want = 1410;
    const canBoost = tg && tg.boost && k.boost > 0;
    if (canBoost) want = 2300;
    if (!tg) want = 0;
    if (d < 700 && !(tg && tg.carry)) want = Math.min(want, d * 1.8 + (tg && tg.role === 1 ? 600 : 0));
    if (tg && tg.carry) want = Math.min(want, len(this.ball.vx, this.ball.vy) + 250);
    if (Math.abs(err) > 1.25 && d < 2600) want = Math.min(want, 650 + d * 0.15);
    // dodges: half-flip to turn around, speed-flip on the kickoff, front flips for speed on long runs without boost
    if (!k.flip && k.z <= 18 && !k.air && !k.wall && k.flipCd <= 0 && tg) {
      const bd = len(this.ball.x - k.x, this.ball.y - k.y);
      if (k.kick === 'go' && !k.kickFlip && bd < 1900 && k.v > 1000) { k.kickFlip = true; this.dodge(k, 'speed', sgn(k.y || 1)); }
      else if (Math.abs(err) > 2.5 && k.v < 800 && d > 1100) this.dodge(k, 'half');
      else if (!tg.carry && d > 1500 && Math.abs(err) < 0.2 && k.v > 500 && k.v < 1300 && Math.random() < h * 0.01) { this.dodge(k, 'wave'); if (Math.random() < 0.3) k.zap = 2; } // wavedash (sometimes a zap dash chain)
      else if (!tg.carry && d > 2600 && Math.abs(err) < 0.15 && k.v > 1050 && k.v < 2000 && !(canBoost && k.boost > 12) && Math.random() < h * 0.5) this.dodge(k, 'front');
    }
    const fl = k.flip, locked = fl && (fl.kind !== 'half' || fl.t < 0.45);
    // steering
    const slide = Math.abs(err) > 1.0 && k.v > 500;
    const maxW = Math.max(k.v, 380) * curvature(k.v) * (slide ? 1.7 : 1);
    const w = clamp(err * 5, -maxW, maxW);
    if (!locked) k.hd = wrap(k.hd + w * h);
    k.slide = slide && !fl;
    // speed
    const aligned = Math.abs(err) < 0.45;
    k.boosting = false;
    if (k.v < want - 20) {
      let a = throttleAccel(k.v);
      if (canBoost && aligned && (want > 1410 || k.v < 1300)) { a += 991.7; k.boosting = true; k.boost = Math.max(0, k.boost - 33.3 * h); }
      if (k.v >= 1410 && !k.boosting) a = 0;
      k.v = Math.min(k.v + a * h, k.boosting ? 2300 : Math.max(k.v, 1410));
    } else {
      const over = k.v - want;
      // holding throttle above 1410 keeps the speed (flip and supersonic momentum carries); otherwise coast/brake
      const dec = want >= 1410 || fl ? 40 : over > 400 ? 3500 : 525;
      k.v = Math.max(0, k.v - dec * h * (slide ? 1.3 : 1));
    }
    if (slide) k.v *= 1 - 0.25 * h;
    k.x += Math.cos(k.hd) * k.v * h; k.y += Math.sin(k.hd) * k.v * h;
    if (fl && (fl.kind === 'side' || fl.kind === 'diag' || fl.kind === 'speed')) {
      // side and diagonal dodges carry the car sideways as it rolls over
      const lat = (fl.kind === 'side' ? 650 : 300) * (1 - fl.t / fl.dur) * fl.side;
      k.x += -Math.sin(k.hd) * lat * h; k.y += Math.cos(k.hd) * lat * h;
    }
    // stay on the field (cars ride the walls in RL; here they skim along them)
    k.x = clamp(k.x, -L + 80, L - 80); k.y = clamp(k.y, -W + 80, W - 80);
    const m = Math.abs(k.x) + Math.abs(k.y);
    if (m > K - 100) { const ex = (m - (K - 100)) / 2; k.x -= sgn(k.x) * ex; k.y -= sgn(k.y) * ex; }
  };

  Pitch.prototype.stepCars = function (h, t) {
    const plan = this.plan(t);
    const b = this.ball;
    this.cars.forEach((k) => {
      k.cd = Math.max(0, k.cd - h); k.rotT = Math.max(0, k.rotT - h);
      if (k.dead > 0) {
        k.dead -= h;
        if (k.dead <= 0) { // respawn behind own goal, facing upfield, with 33 boost
          const s = k.s;
          Object.assign(k, { x: -s * (L - 600), y: (k.i - 1) * 1200, z: 17, vz: 0, v: 500, hd: s > 0 ? 0 : Math.PI, boost: 33, rotT: 0, dead: 0 });
          this.ring(k.x, k.y, k.side === 'A' ? BLUE : ORANGE, 400);
        }
        return;
      }
      k.flipCd = Math.max(0, (k.flipCd || 0) - h);
      if (k.flip) { k.flip.t += h; if (k.flip.t >= k.flip.dur) { const was = k.flip.kind; k.flip = null; if (was === 'wave' && k.zap > 0 && k.z <= 18) { k.zap--; k.flipCd = 0; this.dodge(k, 'wave'); } } }
      const tg = plan.get(k);
      // airborne body language: takeoff (jump + second jump), air roll, landing on the wheels
      const up = k.z > 22;
      if (up && !k.wasUp && !k.wall) this.takeoff(k);
      if (!up && k.wasUp) { if (!k.wall) k.landT = 0.18; k.roll = 0; k.hasFlip = false; }
      k.wasUp = up;
      k.jumpT = Math.max(0, (k.jumpT || 0) - h); k.landT = Math.max(0, (k.landT || 0) - h);
      if (k.dj > 0) { k.dj -= h; if (k.dj <= 0) this.fx.push({ k: 'ring', x: k.x, y: k.y, z: k.z, color: 'rgba(255,255,255,0.6)', r: 240, life: 0, max: 0.35, delay: 0 }); }
      if (up && k.tornado) k.spin = (k.spin || 0) + 13 * h; else if (!up) { k.tornado = false; k.spin = 0; }
      if (up && !k.flip && !k.wall) {
        const r0 = k.roll || 0;
        if (k.z < 280 && k.vz < 0 && !k.pinned) k.roll = r0 + (Math.round(r0 / (2 * Math.PI)) * 2 * Math.PI - r0) * Math.min(1, 7 * h); // straighten up to land
        else k.roll = r0 + (k.rollDir || 0) * 5.5 * h;
      }
      if (k.pinned) { k.pinned = false; return; } // flown by the director (air dribble)
      this.drive(k, tg, h);
      const role1 = tg && tg.role === 1;
      // wall rides: the first man follows a ball up the side wall
      const onWall = role1 && !k.flip && Math.abs(k.y) > W - 300 && Math.abs(b.y) > W - 900 && sgn(b.y) === sgn(k.y) && b.z > 260 && !this.flight;
      if (onWall) { k.wall = true; k.air = false; k.vz = 0; k.z += (Math.min(b.z - 40, 1700) - k.z) * Math.min(1, 2.5 * h); k.z = Math.max(17, k.z); }
      else if (k.wall) { k.wall = false; if (k.z > 30) { k.air = true; k.vz = -100; } }
      // jumping / aerials
      if (!k.wall && (k.z > 17 || k.air)) {
        k.vz -= G * h; k.z += k.vz * h;
        if (k.z > CEIL - 40) { k.z = CEIL - 40; k.vz = Math.min(0, k.vz); } // ceiling
        if (k.z <= 17) {
          // landing: wheels first and keep the momentum (wavedash-style recovery)
          if (k.vz < -450) { k.v = Math.min(2300, k.v + 250); this.burst(k.x, k.y, 'rgba(255,255,255,0.45)', 5); }
          k.z = 17; k.vz = 0; k.air = false;
        }
      }
      const hd = len(b.x - k.x, b.y - k.y);
      k.airCd = Math.max(0, (k.airCd || 0) - h);
      if (role1 && !this.flight && b.z > 330 && b.z < 1400 && b.vz < 350 && hd < 900 && k.z < 40 && k.airCd <= 0 && (k.boost > 25 || b.z < 450) && k.cd <= 0) {
        k.airCd = rnd(3, 6);
        // go up for it: jump + boost toward the ball's height
        const tUp = clamp(hd / Math.max(800, k.v), 0.35, 1.3);
        k.vz = Math.min(1250, (b.z + b.vz * tUp - k.z + 0.5 * G * tUp * tUp) / tUp); k.air = true; k.boost = Math.max(0, k.boost - 10);
      }
    });
    // spacing: cars bump rather than overlap
    for (let i = 0; i < this.cars.length; i++) for (let j = i + 1; j < this.cars.length; j++) {
      const p = this.cars[i], q = this.cars[j];
      if (p.dead > 0 || q.dead > 0) continue;
      const dx = q.x - p.x, dy = q.y - p.y, d = len(dx, dy);
      if (d < 230 && d > 0) { const push = (230 - d) / 2; p.x -= (dx / d) * push; p.y -= (dy / d) * push; q.x += (dx / d) * push; q.y += (dy / d) * push; }
    }
    if (this.cur && this.cur.phase !== 'flight') return; // the director owns the ball during a build-up
    if (this.flight || this.inGoal || this.hidden) return;
    // free-play touches
    this.cars.forEach((k) => {
      if (k.dead > 0 || k.cd > 0) return;
      const dx = b.x - k.x, dy = b.y - k.y, dz = b.z - (k.z + 40), d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > TOUCH) return;
      if (this.cur || this.kickT < 3) { this.touch(k, plan.get(k)); return; }
      const o = this.cars.find((q) => q.side !== k.side && q.dead <= 0 && q.cd <= 0 && len(b.x - q.x, b.y - q.y) < TOUCH + 520 && Math.abs(b.z - q.z) < 300 && Math.cos(Math.atan2(b.y - q.y, b.x - q.x) - q.hd) > 0.5 && q.v > 600);
      if (o && Math.random() < 0.85) this.fifty(k, o);
      else this.touch(k, plan.get(k));
    });
  };

  /** What a player does with a free touch, by where it happens. */
  Pitch.prototype.touch = function (k, tg) {
    const b = this.ball, s = k.s;
    const depth = s * b.x;
    const carSp = Math.max(600, k.v);
    let tx, ty, tz, T;
    const r = Math.random();
    if (this.kickT < 3 && len(b.x, b.y) < 300) {
      // kickoff 50/50: the ball pops loose
      const a = rnd(-Math.PI, Math.PI);
      b.vx = Math.cos(a) * rnd(500, 1300); b.vy = Math.sin(a) * rnd(500, 1300); b.vz = rnd(200, 550);
      this.kicked = true;
      this.cars.forEach((c) => { if (c.kick === 'go') { c.cd = 0.6; c.rotT = rnd(1, 2); } c.kick = null; });
      this.ring(b.x, b.y, '#ffffff', 600);
      this.lastTouch = k;
      return;
    }
    if (depth < -L / 3) {
      // own third: clear it high toward the opponent's corner
      tx = s * rnd(L * 0.25, L * 0.85); ty = sgn(b.y || rnd(-1, 1)) * rnd(2200, 3600); tz = rnd(150, 700); T = rnd(1.2, 1.8);
    } else if (depth < L / 3) {
      if (k.dribbles >= 2 && b.z < 260 && Math.random() < 0.55) {
        // flick off the dribble toward goal
        launch(b, s * rnd(L - 1600, L - 400), rnd(-1400, 1400), rnd(250, 750), rnd(0.8, 1.2)); capLift(b);
        this.dodge(k, 'diag', sgn(rnd(-1, 1))); k.cd = 0.9; k.rotT = rnd(2, 3); k.dribbles = 0; this.lastTouch = k;
        this.burst(b.x, b.y, 'rgba(255,255,255,0.7)', 6);
        return;
      }
      if (r < 0.45 && k.dribbles < 3 && b.z < 200) {
        // dribble: soft touch ahead, stay on it
        const [ux, uy] = norm(Math.cos(k.hd) + s * 0.3, Math.sin(k.hd));
        b.vx = ux * (carSp + 250); b.vy = uy * (carSp + 250); b.vz = rnd(0, 250);
        k.cd = 0.35; k.dribbles++; this.lastTouch = k;
        return;
      }
      if (r < 0.8) {
        // pass into space ahead of a teammate
        const mate = this.cars.filter((m) => m.side === k.side && m !== k && !m.dead).sort((p, q) => s * q.x - s * p.x)[0];
        tx = mate ? clamp(mate.x + s * 1400, -L + 600, L - 600) : s * L * 0.5; ty = mate ? clamp(mate.y * 0.7, -3000, 3000) : rnd(-2500, 2500); tz = rnd(BR, 450); T = rnd(1, 1.6);
      } else { tx = s * rnd(L * 0.5, L * 0.9); ty = sgn(rnd(-1, 1)) * rnd(1500, 3600); tz = rnd(BR, 700); T = rnd(1.1, 1.8); }
    } else {
      if (Math.abs(b.y) > 2300 && depth > L - 2400 && r < 0.3) {
        // pinched against the corner/side wall: it shoots out across the face of goal
        launch(b, s * rnd(L - 2400, L - 900), -sgn(b.y) * rnd(0, 1600), rnd(150, 650), rnd(0.4, 0.6)); capLift(b);
        k.cd = 0.9; k.rotT = rnd(2.2, 3.4); k.dribbles = 0; this.lastTouch = k;
        this.burst(b.x, b.y, '#ffffff', 14); this.ring(b.x, b.y, '#ffffff', 600);
        return;
      }
      if (r < 0.5) { tx = s * rnd(L - 2200, L - 1200); ty = rnd(-1000, 1000); tz = rnd(250, 950); T = rnd(0.9, 1.4); } // centre
      else if (r < 0.8) { tx = s * (L - BR); ty = rnd(-GW, GW); tz = rnd(GH + 200, GH + 700); T = rnd(0.7, 1.1); } // backboard read
      else { tx = s * rnd(L * 0.4, L * 0.75); ty = sgn(b.y || 1) * rnd(2600, 3600); tz = rnd(BR, 400); T = rnd(0.8, 1.3); } // reset to the corner
    }
    launch(b, tx, ty, tz, T);
    capLift(b);
    const spd = len(b.vx, b.vy);
    if (spd > 4200) { b.vx *= 4200 / spd; b.vy *= 4200 / spd; }
    k.cd = 0.9; k.rotT = rnd(2.2, 3.4); k.dribbles = 0;
    if (k.z < 40 && b.z < 260 && Math.random() < 0.75) this.dodge(k, this.flipKind(k, b), this.flipSide(k, b));
    this.lastTouch = k;
    this.ring(b.x, b.y, 'rgba(255,255,255,0.3)', 200);
  };

  /* ---------- ball physics ---------- */
  Pitch.prototype.stepBall = function (h) {
    const b = this.ball;
    if (this.hidden) return;
    const fl = this.flight;
    b.vz -= G * h;
    b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
    if (this.inGoal) { // settles in the net
      const s = this.inGoal;
      b.vx *= Math.max(0, 1 - 3 * h); b.vy *= Math.max(0, 1 - 3 * h);
      b.x = clamp(Math.abs(b.x), L + BR, L + GD - BR) * s; b.y = clamp(b.y, -GW + BR, GW - BR);
      if (b.z < BR) { b.z = BR; b.vz = -b.vz * 0.5; }
      b.z = Math.min(b.z, GH - BR);
      return;
    }
    if (fl && fl.e.type === 'goal') {
      if (Math.abs(b.x) > L + BR && Math.abs(b.y) < GW) { this.inGoal = sgn(b.x); }
      if (b.z < BR) { b.z = BR; b.vz = Math.abs(b.vz) * 0.4; }
      return;
    }
    if (fl) {
      // scripted shot or pass: it follows its arc; only the floor applies
      if (b.z < BR) { b.z = BR; b.vz = Math.abs(b.vz) * 0.5; }
      if (fl.phase === 'flight' && fl.done) this.flight = null;
      return;
    }
    const sp = len(b.vx, b.vy);
    // drag and rolling resistance
    const drag = b.z <= BR + 2 ? 0.06 + 230 / Math.max(200, sp) * 0.25 : 0.03;
    b.vx *= Math.max(0, 1 - drag * h); b.vy *= Math.max(0, 1 - drag * h);
    if (sp > 6000) { b.vx *= 6000 / sp; b.vy *= 6000 / sp; }
    // floor and ceiling
    if (b.z < BR) { b.z = BR; b.vz = b.vz < -150 ? -b.vz * 0.6 : 0; }
    if (b.z > CEIL - BR) { b.z = CEIL - BR; b.vz = -Math.abs(b.vz) * 0.6; }
    // side walls: the ball rides up a little as it bounces off
    if (Math.abs(b.y) > W - BR) { const v = Math.abs(b.vy); b.y = sgn(b.y) * (W - BR); b.vy = -b.vy * 0.6; b.vz += v * 0.18; capLift(b); }
    // back walls and the goal mouth (an unstaged ball into the mouth is kept out: blocked on the line)
    if (Math.abs(b.x) > L - BR) {
      const v = Math.abs(b.vx);
      b.x = sgn(b.x) * (L - BR); b.vx = -b.vx * 0.6;
      if (!(Math.abs(b.y) < GW && b.z < GH)) { b.vz += v * 0.15; capLift(b); }
    }
    const m = Math.abs(b.x) + Math.abs(b.y);
    if (m > K - BR * 1.41) {
      const nx = sgn(b.x) / Math.SQRT2, ny = sgn(b.y) / Math.SQRT2;
      const vn = b.vx * nx + b.vy * ny;
      if (vn > 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; b.vz += vn * 0.15; capLift(b); }
      const ex = (m - (K - BR * 1.41)) / 2; b.x -= sgn(b.x) * ex; b.y -= sgn(b.y) * ex;
    }
  };

  Pitch.prototype.stepPads = function (h) {
    this.pads.forEach((p) => {
      if (p.t > 0) { p.t -= h; return; }
      for (const k of this.cars) {
        if (k.dead > 0 || k.z > 60 || k.boost >= 100) continue;
        if (len(k.x - p.x, k.y - p.y) < (p.big ? 208 : 144)) { k.boost = Math.min(100, k.boost + (p.big ? 100 : 12)); p.t = p.big ? 10 : 4; break; }
      }
    });
  };

  /** Called by the app when a goal event is shown: the ball explodes in the net. */
  Pitch.prototype.goal = function (side) {
    const s = side === 'A' ? 1 : -1;
    const b = this.ball;
    // the shot is still on its way in: let it finish its flight and explode when it crosses the line
    if (!this.inGoal && this.flight && this.flight.e.type === 'goal' && this.flight.e.side === side && sgn(b.vx) === s && !this.hidden) { this.pendingGoal = side; this.pendingT = 0; return; }
    this.explode(side);
  };

  Pitch.prototype.explode = function (side) {
    const s = side === 'A' ? 1 : -1;
    const b = this.ball;
    this.pendingGoal = null;
    if (!this.inGoal) { b.x = s * (L + BR + 60); b.y = clamp(b.y, -GW + BR, GW - BR); }
    const col = side === 'A' ? BLUE : ORANGE;
    for (let i = 0; i < 3; i++) this.ring(b.x, b.y, col, 1800 + i * 1000, i * 0.1);
    this.burst(b.x, b.y, col, 70); this.burst(b.x, b.y, '#ffffff', 25);
    // the explosion knocks nearby cars away
    this.cars.forEach((k) => { const d = len(k.x - b.x, k.y - b.y); if (d < 2200) { k.hd = Math.atan2(k.y - b.y, k.x - b.x); k.v = 1800 * (1 - d / 2200) + 300; if (d < 1400) { k.vz = 500; k.z = Math.max(k.z, 18); k.air = true; } } });
    this.hidden = true; this.flight = null; this.cur = null; this.inGoal = s;
    this.shake = 0.5;
  };

  /* ---------- effects (real time) ---------- */
  Pitch.prototype.ring = function (x, y, color, r, delay) { this.fx.push({ k: 'ring', x, y, color, r, life: 0, max: 0.7, delay: delay || 0 }); };
  Pitch.prototype.burst = function (x, y, color, n) {
    for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), v = rnd(400, 3000); this.fx.push({ k: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color, life: 0, max: rnd(0.5, 1.2) }); }
  };

  /* ================= rendering ================= */
  const CY = 40 + W * S; // field centre (leaves room for the boost HUD underneath)
  const X = (x) => VW / 2 + x * S, Y = (y) => CY + y * S;
  const LIFT = 0.32; // screen offset per uu of height (light 3/4 view so aerials read)

  function fieldPath(ctx) {
    const pts = [[-L + C, -W], [L - C, -W], [L, -W + C], [L, -GW], [L + GD, -GW], [L + GD, GW], [L, GW], [L, W - C], [L - C, W], [-L + C, W], [-L, W - C], [-L, GW], [-L - GD, GW], [-L - GD, -GW], [-L, -GW], [-L, -W + C]];
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.closePath();
  }

  Pitch.prototype.render = function (dtReal, countdown) {
    const ctx = this.ctx;
    if (!ctx) return;
    this._dt = dtReal;
    ctx.save();
    ctx.clearRect(0, 0, VW, VH);
    if (this.shake > 0) { this.shake -= dtReal; const m = this.shake * 10; ctx.translate(rnd(-m, m), rnd(-m, m)); }
    ctx.fillStyle = '#121A2E'; ctx.fillRect(-20, -20, VW + 40, VH + 40); // Midnight Ink
    const th = this.theme;
    if (th) { // event branding: the arena glows in the event's colours
      const gl = ctx.createRadialGradient(VW / 2, CY, 120, VW / 2, CY, VW * 0.62);
      gl.addColorStop(0, 'rgba(0,0,0,0)'); gl.addColorStop(1, rgba(th.a, 0.22)); ctx.fillStyle = gl; ctx.fillRect(0, 0, VW, VH);
    }
    // turf with mowing stripes and team-tinted halves
    ctx.save(); fieldPath(ctx); ctx.clip();
    // pitch: Midnight Ink, lifted slightly, with Azure (blue half) and Vermilion (orange half) tints
    ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(0, 0, VW, VH);
    const g = ctx.createLinearGradient(X(-L), 0, X(L), 0);
    g.addColorStop(0, 'rgba(31,139,255,0.20)'); g.addColorStop(0.45, 'rgba(31,139,255,0.03)'); g.addColorStop(0.55, 'rgba(242,84,45,0.03)'); g.addColorStop(1, 'rgba(242,84,45,0.20)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    for (let k = -5; k < 5; k++) if (k % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(X(k * 1024), 0, 1024 * S, VH); }
    ctx.fillStyle = 'rgba(31,139,255,0.32)'; ctx.fillRect(X(-L - GD), Y(-GW), GD * S, 2 * GW * S);
    ctx.fillStyle = 'rgba(242,84,45,0.32)'; ctx.fillRect(X(L), Y(-GW), GD * S, 2 * GW * S);
    ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 1;
    for (let k = 1; k < 7; k++) [-1, 1].forEach((s) => { ctx.beginPath(); ctx.moveTo(X(s * (L + (GD * k) / 7)), Y(-GW)); ctx.lineTo(X(s * (L + (GD * k) / 7)), Y(GW)); ctx.stroke(); });
    for (let k = -3; k <= 3; k++) [-1, 1].forEach((s) => { ctx.beginPath(); ctx.moveTo(X(s * L), Y((GW * k) / 4)); ctx.lineTo(X(s * (L + GD)), Y((GW * k) / 4)); ctx.stroke(); });
    ctx.restore();
    // markings
    ctx.strokeStyle = th ? rgba(th.b, 0.55) : 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(0), Y(-W)); ctx.lineTo(X(0), Y(W)); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(0), Y(0), 1000 * S, 0, Math.PI * 2); ctx.stroke();
    if (th) { ctx.strokeStyle = rgba(th.c, 0.5); ctx.beginPath(); ctx.arc(X(0), Y(0), 1000 * S - 5, 0, Math.PI * 2); ctx.stroke(); }
    [-1, 1].forEach((s) => {
      ctx.strokeStyle = s < 0 ? 'rgba(31,139,255,0.45)' : 'rgba(242,84,45,0.45)';
      ctx.beginPath(); ctx.moveTo(X(s * L), Y(-1800)); ctx.lineTo(X(s * (L - 1300)), Y(-1800)); ctx.lineTo(X(s * (L - 1300)), Y(1800)); ctx.lineTo(X(s * L), Y(1800)); ctx.stroke();
    });
    // boost pads (dim while respawning)
    this.pads.forEach((p) => {
      const on = p.t <= 0;
      if (p.big) {
        ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 11, 0, Math.PI * 2); ctx.fillStyle = on ? 'rgba(242,84,45,0.25)' : 'rgba(255,255,255,0.04)'; ctx.fill();
        ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 6.5, 0, Math.PI * 2); ctx.fillStyle = on ? '#F2542D' : 'rgba(255,255,255,0.12)'; ctx.fill();
      } else { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 3.6, 0, Math.PI * 2); ctx.fillStyle = on ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)'; ctx.fill(); }
    });
    fieldPath(ctx); ctx.strokeStyle = th ? rgba(th.a, 0.95) : 'rgba(210,225,255,0.75)'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = BLUE; ctx.beginPath(); ctx.moveTo(X(-L), Y(-GW)); ctx.lineTo(X(-L), Y(GW)); ctx.stroke();
    ctx.strokeStyle = ORANGE; ctx.beginPath(); ctx.moveTo(X(L), Y(-GW)); ctx.lineTo(X(L), Y(GW)); ctx.stroke();

    const b = this.ball;
    // shadows first
    this.cars.forEach((k) => { if (k.dead > 0) return; const hz = Math.max(0, k.z - 17), q = 1 - Math.min(0.55, hz / 1400); ctx.beginPath(); ctx.ellipse(X(k.x), Y(k.y) + 2, 13 * q, 9 * q, k.hd, 0, Math.PI * 2); ctx.fillStyle = `rgba(0,0,0,${0.32 * (1 - Math.min(0.6, hz / 1500))})`; ctx.fill(); });
    if (!this.hidden) { ctx.beginPath(); ctx.ellipse(X(b.x), Y(b.y) + 2, 11 * (1 - Math.min(0.4, b.z / 4000)), 8 * (1 - Math.min(0.4, b.z / 4000)), 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); }
    // draw order by height so aerials sit on top
    const items = this.cars.filter((k) => k.dead <= 0).map((k) => ({ k, z: k.z }));
    if (!this.hidden) items.push({ ball: true, z: b.z });
    items.sort((p, q) => p.z - q.z).forEach((it) => (it.ball ? this.drawBall(ctx) : this.drawCar(ctx, it.k)));
    // effects
    this.fx = this.fx.filter((f) => {
      if (f.delay > 0) { f.delay -= dtReal; return true; }
      f.life += dtReal;
      const p = f.life / f.max;
      if (p >= 1) return false;
      if (f.k === 'txt') {
        ctx.font = '700 12px "Inter Tight", Inter, sans-serif'; ctx.textAlign = 'center';
        const fc = f.car;
        const tx = clamp(fc ? X(fc.x) : X(f.x), 90, VW - 90);
        const ty = clamp(fc ? Y(fc.y) - (fc.z - 17) * S * LIFT - 32 * (1 + Math.min(0.6, (fc.z - 17) / 1600)) - p * 8 : Y(f.y) - (f.z - BR) * S * LIFT - 22 - p * 14, 20, VH - 70);
        ctx.globalAlpha = p < 0.75 ? 1 : (1 - p) * 4;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(f.text, tx + 1, ty + 1); ctx.fillStyle = '#ffffff'; ctx.fillText(f.text, tx, ty);
        ctx.globalAlpha = 1;
      } else if (f.k === 'wh') {
        // the four wheels light up where they touched the ball
        const fc = f.car, wsc = 1 + Math.min(0.6, (fc.z - 17) / 1600);
        ctx.save(); ctx.translate(X(fc.x), Y(fc.y) - (fc.z - 17) * S * LIFT); ctx.rotate(fc.hd); ctx.scale(wsc, wsc);
        [[-8, -9], [-8, 9], [9, -9], [9, 9]].forEach(([wx, wy]) => {
          ctx.beginPath(); ctx.arc(wx, wy, 2.5 + 4 * p, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - p)})`; ctx.fill();
          ctx.beginPath(); ctx.arc(wx, wy, 2.2, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 1 - p; ctx.fill(); ctx.globalAlpha = 1;
        });
        ctx.restore();
      } else if (f.k === 'skid') {
        ctx.fillStyle = `rgba(255,255,255,${0.14 * (1 - p)})`; ctx.fillRect(X(f.x) - 1.5, Y(f.y) - 1.5, 3, 3);
      } else if (f.k === 'ring') {
        ctx.beginPath(); ctx.arc(X(f.x), Y(f.y) - (f.z || 0) * S * LIFT, f.r * S * p + 4, 0, Math.PI * 2);
        ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - p; ctx.lineWidth = 4 * (1 - p) + 1; ctx.stroke(); ctx.globalAlpha = 1;
      } else {
        f.x += f.vx * dtReal; f.y += f.vy * dtReal; f.vx *= 0.93; f.vy *= 0.93;
        ctx.beginPath(); ctx.arc(X(f.x), Y(f.y) - (f.z || 0) * S * LIFT, 3.4 * (1 - p) + 1, 0, Math.PI * 2);
        ctx.fillStyle = f.color; ctx.globalAlpha = 1 - p; ctx.fill(); ctx.globalAlpha = 1;
      }
      return true;
    });
    this.drawHud(ctx);
    if (countdown) {
      ctx.font = '700 84px "Inter Tight", Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(countdown, VW / 2 + 3, CY + 3);
      ctx.fillStyle = '#ffffff'; ctx.fillText(countdown, VW / 2, CY);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  };

  Pitch.prototype.drawBall = function (ctx) {
    const b = this.ball;
    const sc = 1 + Math.min(0.9, (b.z - BR) / 1500);
    const px = X(b.x), py = Y(b.y) - (b.z - BR) * S * LIFT;
    b.trail.push([px, py]); if (b.trail.length > 12) b.trail.shift();
    if (len(b.vx, b.vy) > 1800 && b.trail.length > 2) {
      ctx.lineCap = 'round';
      for (let i = 1; i < b.trail.length; i++) {
        ctx.strokeStyle = `rgba(255,255,255,${(i / b.trail.length) * 0.32})`; ctx.lineWidth = (i / b.trail.length) * 11 * sc;
        ctx.beginPath(); ctx.moveTo(b.trail[i - 1][0], b.trail[i - 1][1]); ctx.lineTo(b.trail[i][0], b.trail[i][1]); ctx.stroke();
      }
    }
    const r = 10.5 * sc;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
    const bg = ctx.createRadialGradient(px - r * 0.3, py - r * 0.35, 1, px, py, r);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, 'rgba(255,255,255,0.72)'); ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = 'rgba(18,26,46,0.75)'; ctx.lineWidth = 1.4; ctx.stroke();
    // panel lines so it reads as the RL ball
    ctx.strokeStyle = 'rgba(18,26,46,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, py, r * 0.45, 0, Math.PI * 2); ctx.stroke();
  };

  Pitch.prototype.drawCar = function (ctx, k) {
    const col = k.side === 'A' ? BLUE : ORANGE;
    const fl = k.flip, fp = fl ? fl.t / fl.dur : 0;
    const hop = fl ? Math.sin(Math.PI * fp) * (fl.kind === 'half' || fl.kind === 'back' ? 70 : fl.kind === 'wave' ? 14 : 55) : 0;
    const lift = (k.z - 17 + hop) * S * LIFT;
    const sc = 1 + Math.min(0.6, (k.z - 17) / 1600);
    const px = X(k.x), py = Y(k.y) - lift;
    const c = Math.cos(k.hd), s = Math.sin(k.hd);
    if (k.hasFlip) {
      // holding a reset flip: a pulsing ring of the four wheel lights
      const pu = 0.55 + 0.45 * Math.sin(performance.now() / 90);
      ctx.beginPath(); ctx.arc(px, py, 19 * sc, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.4 * pu})`; ctx.lineWidth = 2; ctx.stroke();
      for (let q = 0; q < 4; q++) { const a = k.hd + Math.PI / 4 + (q * Math.PI) / 2; ctx.beginPath(); ctx.arc(px + Math.cos(a) * 19 * sc, py + Math.sin(a) * 19 * sc, 2.4, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); }
    }
    if (k.wall) { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, Y(k.y)); ctx.stroke(); }
    // supersonic trail / boost flame
    if (k.v > 2200) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      [-5, 5].forEach((o) => { ctx.beginPath(); ctx.moveTo(px - c * 14 - s * o, py - s * 14 + c * o); ctx.lineTo(px - c * 46 - s * o, py - s * 46 + c * o); ctx.stroke(); });
    }
    if (k.boosting) {
      for (let j = 0; j < 5; j++) {
        const d = 15 + j * 6 + rnd(0, 3);
        ctx.beginPath(); ctx.arc(px - c * d * sc, py - s * d * sc, (5 - j * 0.8) * sc, 0, Math.PI * 2);
        ctx.fillStyle = j < 2 ? 'rgba(255,255,255,0.85)' : 'rgba(242,84,45,0.6)'; ctx.fill();
      }
    }
    if (this._dt > 0) {
      if (k.slide && k.z < 30) [-1, 1].forEach((o) => this.fx.push({ k: 'skid', x: k.x - c * 110 - s * 70 * o, y: k.y - s * 110 + c * 70 * o, life: 0, max: 0.8, delay: 0 })); // tyre marks
      if (k.boosting && k.z > 40) this.fx.push({ k: 'p', x: k.x - c * 130, y: k.y - s * 130, z: k.z - 17, vx: -c * 260 + rnd(-60, 60), vy: -s * 260 + rnd(-60, 60), color: 'rgba(242,84,45,0.85)', life: 0, max: 0.4, delay: 0 }); // boost trail hangs in the air
    }
    // flip rotation seen from above: the body foreshortens (and shows its dark underside) as it rolls
    let ang = k.hd, fx = 1, fy = 1, under = false;
    if (fl) {
      const rot = Math.cos(2 * Math.PI * Math.min(1, fp * 1.15));
      if (fl.kind === 'front') fx = rot;
      else if (fl.kind === 'side') fy = rot;
      else if (fl.kind === 'diag' || fl.kind === 'speed') { fx = 0.5 + 0.5 * rot; fy = rot; ang += fl.side * 0.35 * Math.sin(Math.PI * fp); }
      else if (fl.kind === 'back') { fx = Math.cos(2 * Math.PI * Math.min(1, fp * 1.15)); ang += 0.25 * fl.side * Math.sin(Math.PI * fp); } // musty: backflip off the hood
      else if (fl.kind === 'wave') { fx = 1.12 - 0.2 * Math.sin(Math.PI * fp); fy = 0.95; }
      else if (fl.kind === 'spin') { ang += 4 * Math.PI * fp; fy = Math.cos(2 * Math.PI * fp); }
      else if (fl.kind === 'r180') { const q = fp < 0.45 ? fp / 0.45 : fp > 0.7 ? 1 - (fp - 0.7) / 0.3 : 1; ang += Math.PI * (q * q * (3 - 2 * q)); fx = fp > 0.4 && fp < 0.75 ? Math.cos(2 * Math.PI * (fp - 0.4) / 0.35) : 1; }
      else if (fl.kind === 'half') { const q = Math.min(1, fp / 0.65); ang = fl.hd0 + Math.PI * (q * q * (3 - 2 * q)); fx = q < 0.5 ? Math.cos(Math.PI * q) : 1; }
    } else if (k.z > 22 && !k.wall) {
      fy = Math.cos(k.roll || 0); // air roll
      if (k.tornado) { ang += k.spin; fy = Math.cos(k.spin * 0.5); } // tornado spin
      if (k.vz > 150 || k.boosting) fx = 0.82; // nose up while climbing
    }
    under = fx < 0 || fy < 0; fx = Math.max(0.28, Math.abs(fx)); fy = Math.max(0.3, Math.abs(fy));
    if (k.jumpT > 0) { fx *= 1.08; fy *= 0.9; } // stretch on takeoff
    if (k.landT > 0) { const q = k.landT / 0.18; fx *= 1 - 0.1 * q; fy *= 1 + 0.14 * q; } // squash on landing
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.scale(sc * fx, sc * fy);
    const WH = [[-11, -10.5], [-11, 7], [6, -10.5], [6, 7]];
    const wheels = (inset, colr) => { ctx.fillStyle = colr; WH.forEach(([wx, wy]) => { rr(ctx, wx, wy + (wy < 0 ? inset : -inset), 6.5, 3.5, 1.2); ctx.fill(); }); };
    if (!under) wheels(0, '#0b1020');
    ctx.fillStyle = col; rr(ctx, -14, -8.5, 29, 17, 5); ctx.fill();
    if (under) { ctx.fillStyle = 'rgba(18,26,46,0.55)'; rr(ctx, -14, -8.5, 29, 17, 5); ctx.fill(); wheels(3, 'rgba(11,16,32,0.95)'); ctx.restore(); ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.scale(sc * fx, sc * fy); ctx.globalAlpha = 0; }
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, -12, -6.5, 10, 13, 3); ctx.fill();
    ctx.fillStyle = 'rgba(18,26,46,0.9)'; rr(ctx, 1, -6, 8, 12, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(12, -6.5, 2.5, 3.5); ctx.fillRect(12, 3, 2.5, 3.5);
    ctx.restore();
    ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
    const ly = clamp(py - 15 * sc, 12, VH - 60), lx = clamp(px, 40, VW - 40);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(k.name, lx + 1, ly + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillText(k.name, lx, ly);
  };

  /** Broadcast-style boost meters along the bottom. */
  Pitch.prototype.drawHud = function (ctx) {
    const y0 = VH - 34;
    ['A', 'B'].forEach((side) => {
      const team = this.cars.filter((k) => k.side === side);
      team.forEach((k, i) => {
        const w = 160, gap = 12;
        const x0 = side === 'A' ? 24 + i * (w + gap) : VW - 24 - (3 - i) * (w + gap) + gap;
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, x0, y0, w, 26, 6); ctx.fill();
        ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'left';
        ctx.fillStyle = k.dead > 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.9)';
        ctx.fillText(k.name.length > 13 ? k.name.slice(0, 12) + '…' : k.name, x0 + 8, y0 + 12);
        ctx.textAlign = 'right'; ctx.font = '700 11px "Inter Tight", Inter, sans-serif';
        ctx.fillText(k.dead > 0 ? 'DEMO' : String(Math.round(k.boost)), x0 + w - 8, y0 + 12);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x0 + 8, y0 + 17, w - 16, 4);
        ctx.fillStyle = side === 'A' ? BLUE : ORANGE; ctx.fillRect(x0 + 8, y0 + 17, ((w - 16) * k.boost) / 100, 4);
      });
    });
  };

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  Pitch.VW = VW; Pitch.VH = VH;
  global.RLPitch = Pitch;
})(window);
