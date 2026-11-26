/* Career mode extras (loaded before js/career.js, which hands over its internals with RLCareerX.attach):
 *  - player personalities and morale          - an advanced tactical system (tab "Tactics")
 *  - multi-round transfer negotiations, incoming bids, release clauses
 *  - manager career progression (levels, reputation, achievements, job offers)
 *  - Hall of Fame                              - annual awards ceremony at the end of every season
 *  - regional power shifts (Major/Worlds slots move between regions)
 *  - dynamic esports news                      - a simulated social media feed
 *  - ranked talent scouting with a scouting network
 *  - an all-time record book
 * Everything lives in the career save (C.x…, p.pers, p.morale, p.cr) so older saves are upgraded in place by migrate().
 */
(function (global) {
  'use strict';
  let K = null; // career internals: K.C, K.news, K.teamObj, …
  const C = () => K.C;
  const esc = (s) => K.esc(s);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
  const tname = (id) => (C().teams[id] ? C().teams[id].name : '—');
  const mine = () => !K.V() && C().user;

  /* ======================= personalities & morale ======================= */
  const PERS = {
    leader: { n: 'Leader', i: '👑', d: 'Lifts the whole squad. Teammates\' morale holds up better, and the team plays a little stronger with them on the field.' },
    professional: { n: 'Professional', i: '🎯', d: 'Steady. Morale swings are halved and they develop slightly faster.' },
    ambitious: { n: 'Ambitious', i: '🚀', d: 'Wants trophies and a starting spot. Hates the bench and losing; asks more from smaller clubs.' },
    loyal: { n: 'Loyal', i: '🤝', d: 'Re-signs for less and rarely gets unsettled.' },
    hothead: { n: 'Hothead', i: '🔥', d: 'Big form swings and more demos. Reacts badly to being criticised.' },
    showman: { n: 'Showman', i: '✨', d: 'Raises their game on the big stage: Majors, the EWC and Worlds. Fans love them.' },
    mercenary: { n: 'Mercenary', i: '💰', d: 'Follows the money: asks for a bigger salary and may push for a move.' },
    quiet: { n: 'Quiet worker', i: '🧘', d: 'Low-maintenance. Barely affected by the bench and adds a little chemistry.' },
    joker: { n: 'Joker', i: '😄', d: 'Keeps the mood light: adds chemistry and cushions bad results for everyone.' },
  };
  const PKEYS = Object.keys(PERS);
  function persOf(p) {
    if (!p.pers) { const h = hash(p.name + '|' + (p.country || '')); p.pers = PKEYS[Math.floor(h * PKEYS.length)]; }
    if (p.morale == null) p.morale = 62 + Math.round(hash(p.name + 'm') * 14);
    return p.pers;
  }
  const moodLabel = (m) => (m >= 80 ? ['Delighted', 'm-top'] : m >= 64 ? ['Happy', 'm-good'] : m >= 45 ? ['Content', 'm-ok'] : m >= 28 ? ['Unhappy', 'm-low'] : ['Furious', 'm-bad']);
  function moraleBar(p) { const [l, c] = moodLabel(p.morale); return `<span class="x-mood ${c}" title="Morale ${Math.round(p.morale)}"><i style="width:${Math.round(p.morale)}%"></i></span><small class="x-mood-l ${c}">${l}</small>`; }
  function persChip(p) { const k = persOf(p), P = PERS[k]; return `<span class="x-pers" title="${esc(P.d)}">${P.i} ${esc(P.n)}</span>`; }
  /** Change a player's morale, shaped by their personality. */
  function moodShift(p, d, why) {
    persOf(p);
    const k = p.pers;
    if (k === 'professional') d *= 0.5;
    if (k === 'hothead') d *= 1.5;
    if (k === 'quiet' && d < 0 && why === 'bench') d *= 0.3;
    if (k === 'ambitious' && d < 0 && (why === 'bench' || why === 'result')) d *= 1.6;
    if (k === 'loyal' && d < 0) d *= 0.7;
    p.morale = clamp((p.morale || 65) + d, 0, 100);
  }
  /** Squad effects for the managed team: morale, leaders, chemistry. Returns strength points (roughly -2.5 … +2.5). */
  function squadBoost(stage) {
    if (!mine()) return { str: 0, parts: [] };
    const ro = K.userTeam().roster.map((id) => C().players[id]).filter(Boolean), st = ro.slice(0, 3);
    if (!st.length) return { str: 0, parts: [] };
    st.forEach(persOf);
    const avg = st.reduce((s, p) => s + p.morale, 0) / st.length;
    const parts = [['Morale', clamp((avg - 60) / 14, -1.6, 1.4)]];
    if (st.some((p) => p.pers === 'leader')) parts.push(['Leader on the field', 0.5]);
    const chem = st.filter((p) => p.pers === 'joker' || p.pers === 'quiet').length * 0.2 + (C().x.chem || 0) * 0.1;
    if (chem) parts.push(['Chemistry', +chem.toFixed(2)]);
    if (stage && st.some((p) => p.pers === 'showman')) parts.push(['Showman on the big stage', 0.6]);
    if (st.some((p) => p.pers === 'hothead')) parts.push(['Hothead (unpredictable)', +rnd(-0.8, 0.8).toFixed(2)]);
    return { str: parts.reduce((s, x) => s + x[1], 0), parts };
  }
  /** After each event: results, bench time and trophies move morale. */
  function moodAfterEvent(place, won, big) {
    if (!mine()) return;
    const ro = K.userTeam().roster.map((id) => C().players[id]).filter(Boolean);
    const res = won ? (big ? 16 : 11) : place <= 2 ? 6 : place <= 4 ? 3 : place <= 8 ? -1 : -6;
    const joker = ro.some((p) => persOf(p) === 'joker');
    ro.forEach((p, i) => {
      moodShift(p, res + (res < 0 && joker ? 2 : 0), 'result');
      if (i >= 3) moodShift(p, -5, 'bench');
      if (i >= 3 && p.promise === 'starter') { moodShift(p, -8, 'bench'); if (!p.promiseBroken) { p.promiseBroken = true; K.news('info', `<b>${esc(p.name)}</b> reminds you of the starting spot promised in the contract talks. ${persOf(p) === 'loyal' ? 'For now they stay patient.' : 'The mood is souring.'}`, { pid: p.id }); } }
    });
    const leader = ro.slice(0, 3).some((p) => p.pers === 'leader');
    if (leader) ro.forEach((p) => { if (p.morale < 50) p.morale += 3; });
  }
  /** Each step: morale drifts back towards normal; an unhappy ambitious player or mercenary may want out. */
  function moodDrift() {
    if (!mine()) return;
    K.userTeam().roster.forEach((id) => {
      const p = C().players[id]; if (!p) return; persOf(p);
      p.morale += (65 - p.morale) * 0.12;
      if (p.morale < 28 && (p.pers === 'ambitious' || p.pers === 'mercenary' || p.pers === 'hothead') && !p.wantsOut && Math.random() < 0.5) {
        p.wantsOut = true;
        K.news('rumour', `<span class="tag-hot">Unsettled</span> <b>${esc(p.name)}</b> has told the club he wants to leave. A transfer request is on the table.`, { pid: p.id });
        post(playerAcct(p), pick(['Need a change of scenery. 🤐', 'Some things need to be said. Not today.', '...', 'Grateful for everything. Time to think about my future.']), { kind: 'player', mood: 'bad' });
      }
      if (p.wantsOut && p.morale > 55) p.wantsOut = false;
    });
  }
  /** Team talk (once per step) in the Tactics tab. */
  function teamTalk(kind) {
    const ro = K.userTeam().roster.map((id) => C().players[id]).filter(Boolean);
    const lines = [];
    ro.forEach((p) => {
      const k = persOf(p);
      let d = 0;
      if (kind === 'encourage') d = k === 'hothead' || k === 'joker' ? 6 : k === 'ambitious' ? 3 : 4;
      else if (kind === 'demand') d = k === 'ambitious' || k === 'professional' || k === 'leader' ? 7 : k === 'hothead' ? -9 : k === 'loyal' ? 2 : -3;
      else d = k === 'hothead' ? 8 : k === 'quiet' || k === 'professional' ? 4 : 2; // calm
      d *= p.morale > 80 && d > 0 ? 0.4 : 1;
      moodShift(p, d, 'talk');
      lines.push(`${esc(p.name)} ${d >= 4 ? '▲▲' : d > 0 ? '▲' : d < -4 ? '▼▼' : d < 0 ? '▼' : '='}`);
    });
    C().x.talk = C().season + '|' + C().step;
    K.save();
    K.api().toast('Team talk: ' + lines.join(' · ').replace(/<[^>]+>/g, ''));
  }

  /* ======================= tactics ======================= */
  const TAC = {
    tempo: { l: 'Tempo', o: { slow: ['Slow build-up', { atk: 0.92, def: 0.88 }], normal: ['Balanced', {}], fast: ['Fast, direct', { atk: 1.12, def: 1.1 }] } },
    press: { l: 'Pressing', o: { low: ['Sit back', { def: 0.92, str: -0.2 }], mid: ['Mid block', {}], high: ['High press', { atk: 1.06, def: 1.05, str: 0.35 }] } },
    rot: { l: 'Rotation', o: { strict: ['Strict 3-man', { str: 0.25 }], fluid: ['Fluid', { str: 0.15, chem: true }], twoup: ['Two-man up', { atk: 1.1, def: 1.1 }] } },
    kick: { l: 'Kickoffs', o: { standard: ['Standard', {}], speedflip: ['Speedflip', { kick: true }], fake: ['Fake & cheat', { fake: true }] } },
    focus: { l: 'Attack focus', o: { spread: ['Spread it', { str: 0.1 }], star: ['Feed the star', { star: true }] } },
    demo: { l: 'Demos', o: { off: ['Clean play', { def: 0.97 }], some: ['Opportunistic', { demo: 1.4 }], heavy: ['Bump everything', { demo: 2.2, atk: 1.04 }] } },
  };
  const DEF_TAC = { tempo: 'normal', press: 'mid', rot: 'strict', kick: 'standard', focus: 'spread', demo: 'some' };
  const STYLES = {
    aggressive: { n: 'Aggressive', d: 'Fast and high pressing.' },
    possession: { n: 'Possession', d: 'Patient, controls the ball.' },
    counter: { n: 'Counter-attack', d: 'Sits back, punishes mistakes.' },
    demo: { n: 'Demolition', d: 'Physical, bumps everything.' },
    balanced: { n: 'Balanced', d: 'No clear identity.' },
  };
  // rock-paper-scissors between identities: key beats each listed style
  // a fair cycle: each identity beats one and loses to one; Balanced is neutral to all of them
  const BEATS = { aggressive: ['possession'], possession: ['demo'], demo: ['counter'], counter: ['aggressive'], balanced: [] };
  function identity(t) {
    if (t.demo === 'heavy') return 'demo';
    if ((t.tempo === 'fast' && t.press !== 'low') || (t.press === 'high' && t.tempo !== 'slow')) return 'aggressive';
    if (t.tempo === 'slow' && t.press !== 'high') return t.press === 'low' ? 'counter' : 'possession';
    if (t.press === 'low') return 'counter';
    return 'balanced';
  }
  const tac = () => Object.assign({}, DEF_TAC, C().x.tac || {});
  function aiStyle(id) {
    const t = C().teams[id]; if (!t) return 'balanced';
    if (!t.style) { const ks = Object.keys(STYLES); t.style = ks[Math.floor(hash(t.name + 'style') * ks.length)]; }
    return t.style;
  }
  /** The engine's tactic object for the user's team (see withTactic in js/engine.js). */
  function tacticFor(stageType) {
    if (!mine()) return {};
    const t = tac(), me = K.teamObj(C().user), ps = (me.players || []).slice(0, 3);
    let atk = 1, def = 1, str = 0, demo = 1;
    Object.keys(TAC).forEach((k) => { const e = TAC[k].o[t[k]] ? TAC[k].o[t[k]][1] : {}; atk *= e.atk || 1; def *= e.def || 1; str += e.str || 0; if (e.demo) demo = e.demo; });
    const top = ps.slice().sort((a, b) => b.rating - a.rating)[0], avg = ps.reduce((s, p) => s + p.rating, 0) / Math.max(1, ps.length);
    if (t.kick === 'speedflip') str += top && top.rating >= 86 ? 0.35 : 0.1;
    if (t.focus === 'star' && top) str += clamp((top.rating - avg) / 6, -0.3, 0.9);
    if (t.rot === 'fluid') str += (C().x.chem || 0) * 0.1;
    str += ((C().x.fam || 0) / 100) * 0.8; // familiarity: tactics you keep get better
    const big = ['major', 'worlds', 'ewc'].includes(stageType);
    str += squadBoost(big).str;
    const me1 = identity(t), counters = {};
    Object.keys(STYLES).forEach((s) => { counters[s] = BEATS[me1].includes(s) ? 0.6 : BEATS[s].includes(me1) ? -0.6 : 0; if (t.kick === 'fake' && s === 'aggressive') counters[s] += 0.25; });
    const oppStyle = {}; Object.keys(C().teams).forEach((id) => { if (id !== C().user) oppStyle[id] = aiStyle(id); });
    return { tactic: { atk: +atk.toFixed(3), def: +def.toFixed(3), str: +str.toFixed(2), demo, counters }, oppStyle };
  }
  function setTac(k, v) {
    const cur = tac(); if (cur[k] === v) return;
    cur[k] = v; C().x.tac = cur;
    C().x.fam = Math.max(0, (C().x.fam || 0) - 25); // new instructions take time to sink in
    K.save(); K.render();
  }

  /* ======================= social media ======================= */
  const PRESS = [['RL Insider', 'rlinsider', '#1f8bff'], ['Boost Breaking', 'boostbreaking', '#f2542d'], ['Shift Scoop', 'shiftscoop', '#a855f7'], ['Aerial Analytics', 'aerialstats', '#22c55e'], ['Kickoff Daily', 'kickoffdaily', '#d4a017']];
  const FAN_PRE = ['rl', 'boost', 'flip', 'aerial', 'goal', 'demo', 'ceiling', 'musty', 'wavedash', 'pinch', 'zero', 'backboard', 'kickoff', 'redirect'];
  const FAN_SUF = ['fan', 'enjoyer', 'merchant', 'god', 'andy', 'stan', 'watcher', 'head', 'enthusiast', 'goblin', 'lover', 'warrior'];
  const fanAcct = () => { const h = pick(FAN_PRE) + '_' + pick(FAN_SUF) + ri(1, 99); return { n: h.replace(/_/g, ' '), h, c: pick(['#64748b', '#0ea5e9', '#f97316', '#84cc16', '#ec4899', '#14b8a6']) }; };
  const playerAcct = (p) => ({ n: p.name, h: String(p.name).replace(/[^A-Za-z0-9_]/g, '') || 'player', c: p.team && C().teams[p.team] ? C().teams[p.team].color : '#475569', v: p.rating >= 80, flag: p.flag, pid: p.id, club: p.team || null });
  const clubAcct = (id) => { const t = C().teams[id]; return { n: t.name, h: String(t.name).replace(/[^A-Za-z0-9]/g, ''), c: t.color, v: true, club: id }; };
  const pressAcct = () => { const x = pick(PRESS); return { n: x[0], h: x[1], c: x[2], v: true, press: true }; };
  function post(acct, text, o) {
    o = o || {};
    const x = C().x; x.social = x.social || [];
    const base = (acct.v ? 900 : 40) * (o.big ? 6 : 1);
    x.sid = (x.sid || 0) + 1;
    x.social.unshift({ id: x.sid, a: acct, t: text, poll: o.poll || null, votes: o.votes || 0, k: o.kind || 'fan', mood: o.mood || '', likes: Math.round(base * rnd(0.4, 2.6)), rts: Math.round(base * rnd(0.05, 0.4)), when: C().season + ' · ' + K.step().short, tag: o.tag || '' });
    x.social = x.social.slice(0, 220);
  }
  const hashTag = (s) => '#' + String(s).replace(/[^A-Za-z0-9]/g, '');
  /* ---- more voices: casters, a memes page, a stats page, a transfer insider, streamers, national federations ---- */
  const CASTERS = [['Vox · caster', 'voxcasts', '#f59e0b'], ['Mira Lane', 'miralane_cast', '#ec4899'], ['Coach Dex', 'coachdex', '#0ea5e9'], ['The Desk', 'thedesk_rl', '#64748b']];
  const casterAcct = () => { const x = pick(CASTERS); return { n: x[0], h: x[1], c: x[2], v: true, press: true }; };
  const memeAcct = () => ({ n: 'RL Memes Daily', h: 'rlmemesdaily', c: '#a3e635', v: false });
  const statsAcct = () => ({ n: 'Aerial Analytics', h: 'aerialstats', c: '#22c55e', v: true, press: true });
  const itkAcct = () => ({ n: 'TransferTalk RL', h: 'transfertalkrl', c: '#8b5cf6', v: false });
  const streamAcct = () => { const x = pick([['boostedTV', '#ef4444'], ['flipresetFM', '#14b8a6'], ['ceilingshot_live', '#f97316'], ['grandchampgrind', '#6366f1']]); return { n: x[0], h: x[0], c: x[1], v: true }; };
  const fedAcct = (country, flag) => ({ n: (flag ? flag + ' ' : '') + country + ' Esports', h: String(country).replace(/[^A-Za-z]/g, '') + 'Esports', c: '#2563eb', v: true });
  /** A poll post: options with made-up but plausible vote shares. */
  function pollPost(acct, q, opts, o) {
    const w = opts.map((x, i) => (x.w || 1) * rnd(0.6, 1.4) + (i === 0 ? 0.3 : 0));
    const tot = w.reduce((a, b) => a + b, 0);
    let left = 100; const poll = opts.map((x, i) => { const v = i === opts.length - 1 ? left : Math.round((w[i] / tot) * 100); left -= v; return [x.l, Math.max(0, v)]; });
    post(acct, q, Object.assign({ kind: 'press', poll, votes: ri(2000, 40000) }, o || {}));
  }
  const MEME = {
    upset: ['{l} fans logging off for the week 💀', 'nobody:\n{w}: *wins the series anyway*', 'the bracket predictions after {w} beat {l}: 📉📉📉', '{l} really said "we\'ll win this easy" huh', 'POV: you had {l} winning it all in your pick\'em'],
    champ: ['{w} lifting another trophy, starter pack: 🏆 🎉 😴 (the rest of the region)', 'me pretending I didn\'t say {w} would flop this season', 'the {w} trophy cabinet needs an extension 🔨', '{w} fans when they see a bracket: 😌'],
    market: ['transfer window open, every fan is a GM now 🧠', 'me refreshing for transfer news every 4 seconds', 'my club\'s transfer strategy: vibes', 'that fee could buy me 400,000 boost pads'],
    side: ['1v1 players walking into the arena knowing it\'s just them and their thoughts', 'the 2v2 duo synergy is unreal, they share one brain cell and it\'s cracked', 'solo queue warriors finally getting their moment 🗡️'],
    nation: ['national team week = everyone suddenly patriotic 🫡', 'I don\'t watch football but I\'m screaming at FIFAe right now', 'my country losing in groups again: a tradition 🥲'],
  };
  const fill = (t, m) => String(t).replace(/\{(\w+)\}/g, (_, k) => esc(m[k] == null ? '' : m[k]));

  /* ---- comments under a post: generated the first time a thread is opened (older posts included), more on demand ---- */
  const CM = {
    good: ['LETS GOOOO 🔥🔥', 'deserved. no debate.', 'goosebumps watching that', 'best team in the world rn', 'told everyone in my discord this would happen', 'I need this on a t-shirt', 'crying real tears ngl', 'what a time to be a fan 🙌', 'that final will live in my head rent free', 'proud of you guys ❤️', 'the clutch gene is real', 'W', 'absolute cinema 🎬', 'running it back next event 😤'],
    bad: ['unacceptable tbh', 'something has to change', 'we\'re better than this', 'the rotation was a mess all event', 'not even mad, just disappointed', 'bench the whole roster 💀', 'manager out? genuinely asking', 'pain. just pain.', 'how do you lose that series', 'I believed... I really did', 'L', 'back to the drawing board'],
    neutral: ['big if true 👀', 'interesting times', 'source?', 'can\'t wait for the next event', 'this scene never sleeps', 'thoughts? 🤔', 'bookmarking this', 'the timeline is going crazy today', 'who else is watching live?', 'make it make sense'],
    rival: ['enjoy it while it lasts 😏', 'see you in the final 👋', 'carried by the bracket ngl', 'ok but wait till the Major', 'lucky. next.', 'still think we\'re better', 'calm down it\'s just one event'],
    press: ['Full breakdown of the stats in our next piece.', 'Remarkable numbers this season. We\'ll have analysis tomorrow.', 'One of the storylines of the year.', 'Our sources say there\'s more to come.'],
    transfer: ['massive signing', 'overpaid imo', 'that roster is scary now', 'welcome!! 🙌', 'the fee is wild', 'bold move, let\'s see', 'he\'s going to cook there', 'didn\'t see that coming at all'],
    mate: ['my brother 🤝', 'built different 🐐', 'couldn\'t do it without you', 'love this team ❤️', 'that save in game 5 though 😮‍💨', 'next one is ours too'],
    cryptic: ['you good? 👀', 'what does this mean...', 'uh oh', 'don\'t leave us 😭', 'the club needs to sort this out', 'stay strong', 'he\'s gone isn\'t he'],
  };
  function makeComment(sp) {
    const x = C().x, kind = sp.k, mood = sp.mood, txt = String(sp.t);
    const r = Math.random();
    // a teammate or the club answers a player's post, a player answers his club's post
    if (sp.a.pid && sp.a.club && C().teams[sp.a.club] && r < 0.25) {
      const mates = C().teams[sp.a.club].roster.filter((id) => id !== sp.a.pid).map((id) => C().players[id]).filter(Boolean);
      const m = pick(mates);
      if (m) return { a: playerAcct(m), t: mood === 'bad' ? pick(['talk to me bro 🙏', 'we got you', 'head up, we go again']) : pick(CM.mate) };
    }
    if (sp.a.club && !sp.a.pid && C().teams[sp.a.club] && r < 0.2) {
      const m = pick(C().teams[sp.a.club].roster.map((id) => C().players[id]).filter(Boolean));
      if (m) return { a: playerAcct(m), t: pick(CM.mate) };
    }
    if (r < 0.32 && kind !== 'press') return { a: pressAcct(), t: pick(CM.press) };
    // rival fans show up under celebrations
    if (mood === 'good' && r < 0.5) { const rv = pick(Object.keys(C().teams).filter((id) => id !== sp.a.club && K.tierOf(id) >= 3)); if (rv) { const f = fanAcct(); f.n = f.n + ' · ' + (C().teams[rv].tag || C().teams[rv].name); return { a: f, t: pick(CM.rival), rival: true }; } }
    const pool = mood === 'bad' ? (/\.\.\.|scenery|future|Not today/.test(txt) ? CM.cryptic : CM.bad) : mood === 'good' ? CM.good : /Welcome|signs|bid|offer|monitoring|move|fee/i.test(txt) ? CM.transfer : CM.neutral;
    return { a: fanAcct(), t: pick(pool) };
  }
  function ensureComments(sp, more) {
    sp.c = sp.c || [];
    const n = more ? 4 : Math.max(0, ri(3, 5) - sp.c.length);
    for (let i = 0; i < n && sp.c.length < 24; i++) {
      // no repeated lines or repeated authors in one thread
      let c = null; for (let t = 0; t < 8; t++) { const y = makeComment(sp); if (!sp.c.some((z) => z.t === y.t || (z.a.pid && z.a.pid === y.a.pid) || z.a.h === y.a.h)) { c = y; break; } }
      if (!c) break; c.likes = Math.round((sp.likes || 50) * rnd(0.005, 0.12) * (c.a.v ? 3 : 1)); c.ago = ri(1, 59) + 'm'; sp.c.push(c); }
    sp.c.sort((a, b) => b.likes - a.likes);
    sp.cn = Math.max(sp.cn || 0, Math.round((sp.rts || 10) * rnd(0.4, 0.9)), sp.c.length);
  }

  /* ======================= news helpers ======================= */
  const KIND_LABEL = { interview: 'Interview', rankings: 'Rankings', analysis: 'Analysis', stat: 'Stat of the week', opinion: 'Opinion', throwback: 'Throwback', contract: 'Contract watch', board: 'Boardroom', sacked: 'Manager news', trophy: 'Trophy', result: 'Result', transfer: 'Transfer', academy: 'Academy', career: 'Club', info: 'Club', upset: 'Upset', rumour: 'Rumour', feature: 'Feature', milestone: 'Milestone', award: 'Awards', hof: 'Hall of Fame', power: 'Power shift', preview: 'Preview', record: 'Record' };

  /** pick() that avoids lines used recently in this career (so stories don't repeat word for word) */
  function fresh(pool) {
    const x = C().x; x.used = x.used || [];
    const left = pool.filter((t) => !x.used.includes(t));
    const t = pick(left.length ? left : pool);
    x.used.push(t); x.used = x.used.slice(-60);
    return t;
  }
  /* news categories for the filter chips on the News view */
  const NEWS_CATS = [['all', 'All'], ['results', 'Results'], ['transfers', 'Transfers'], ['features', 'Features'], ['club', 'Your club']];
  const CAT_OF = { trophy: 'results', result: 'results', upset: 'results', rankings: 'results', preview: 'results', transfer: 'transfers', rumour: 'transfers', contract: 'transfers',
    feature: 'features', interview: 'features', analysis: 'features', stat: 'features', opinion: 'features', throwback: 'features', milestone: 'features', record: 'features', hof: 'features', award: 'features', power: 'features', sacked: 'features',
    career: 'club', info: 'club', academy: 'club', board: 'club' };
  const newsIn = (kind, cat) => !cat || cat === 'all' || (CAT_OF[kind] || 'club') === cat;

  /* ======================= varied news stories ======================= */
  const Q = {
    win: ['"We worked so hard for this. Every scrim, every late night: it was all for moments like this."', '"Honestly I still can\'t believe it. Ask me tomorrow."', '"People doubted us after the last event. This is the answer."', '"The crowd carried us in the final. That noise was unreal."', '"We didn\'t play our best and still won. That\'s what scares me about this team."', '"Our coach called the adjustments perfectly. Credit to the whole staff."'],
    lose: ['"It stings. We were one goal away from a different story."', '"Credit to them, they were better on the day. We\'ll learn from it."', '"We\'ll watch the VODs, fix it, and come back."', '"Second place means nothing to us. We want the trophy."'],
    side: ['"In a 1v1 there\'s nowhere to hide. I trusted my mechanics and it paid off."', '"My duo and I barely need to talk anymore. We just know."', '"This means as much to me as any 3v3 title."'],
    nation: ['"Wearing the flag is different. You play for millions of people back home."', '"We\'re rivals all year, but this week we were brothers."', '"My family was watching. This one is for them."'],
  };
  /** Power rankings: the top 6 clubs worldwide (season points + rating), with movement since the last edition. */
  function rankingsStory(after) {
    const x = C().x, ids = Object.keys(C().teams);
    const score = (id) => (C().points[id] ? C().points[id].season : 0) * 1.2 + K.ovr(id) * 2;
    const top = ids.sort((a, b) => score(b) - score(a)).slice(0, 6);
    const prev = x.lastRank || [];
    const rows = top.map((id, i) => { const was = prev.indexOf(id); const mv = was < 0 ? '<i class="nr-new">NEW</i>' : was > i ? `<i class="nr-up">▲${was - i}</i>` : was < i ? `<i class="nr-dn">▼${i - was}</i>` : '<i class="nr-eq">–</i>'; return `<li><b>${esc(tname(id))}</b> ${mv}<small>${C().points[id] ? C().points[id].season : 0} pts · OVR ${K.ovr(id)}${id === C().user ? ' · you' : ''}</small></li>`; }).join('');
    x.lastRank = top;
    K.news('rankings', `<b>Power rankings after the ${esc(after)}</b><ol class="nlist">${rows}</ol>`, { champ: top[0] });
  }
  function interview(p, title, mood, pool) {
    if (!p) return;
    K.news('interview', `<b>${esc(p.name)}</b> (${esc(p.team && C().teams[p.team] ? tname(p.team) : p.country || '')}) after the ${esc(title)}:<blockquote class="nq">${fresh(pool || Q[mood])}</blockquote>`, { pid: p.id });
  }
  function fiveThings(title, T, list, champ) {
    const items = [];
    items.push(`<b>${esc(tname(champ))}</b> are the team to beat: ${C().trophies && champ === C().user ? 'and they\'re yours' : 'their rotations held up under pressure'}.`);
    const rows = Object.values(T.stats || {}).filter((s) => s && s.name && s.gp >= 3).sort((a, b) => b.score / b.gp - a.score / a.gp);
    if (rows[0]) items.push(`<b>${esc(rows[0].name)}</b> is in the form of their life (${Math.round(rows[0].score / rows[0].gp)} avg score).`);
    const reg = {}; list.slice(0, 8).forEach(({ id }) => { const t = C().teams[id]; if (t) reg[t.region] = (reg[t.region] || 0) + 1; });
    const best = Object.entries(reg).sort((a, b) => b[1] - a[1])[0];
    if (best) items.push(`<b>${esc(K.api().regions[best[0]])}</b> put ${best[1]} teams in the top eight. Respect the region.`);
    const flop = list.filter(({ id }) => C().teams[id] && K.tierOf(id) >= 4).sort((a, b) => b.place - a.place)[0];
    if (flop && flop.place > 6) items.push(`<b>${esc(tname(flop.id))}</b> have questions to answer after finishing ${E_ord(flop.place)}.`);
    const goals = Object.values(T.stats || {}).reduce((s, x) => s + (x && x.g ? x.g : 0), 0);
    items.push(`${goals} goals in the event. ${goals > 400 ? 'Defence optional.' : 'Tight, tactical Rocket League.'}`);
    if (mine()) { const me = list.find((y) => y.id === C().user); if (me) items.push(`Your <b>${esc(K.userTeam().name)}</b> finished ${E_ord(me.place)}. ${me.place <= 2 ? 'Contenders.' : me.place <= 4 ? 'Close.' : 'Work to do.'}`); }
    K.news('analysis', `<b>Five things we learned at the ${esc(title)}</b><ol class="nlist">${items.slice(0, 5).map((t) => `<li>${t}</li>`).join('')}</ol>`, { champ });
  }
  const E_ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 >> 3) ^ 1 && n % 10] || 'th');
  /** Extra stories after every 3v3 event. */
  function eventNews(T, st, region, title, list, big) {
    const champ = T.champion; if (!champ || !C().teams[champ]) return;
    const home = big || region === K.homeReg();
    if (!home) return;
    const star = C().teams[champ].roster.slice(0, 3).map((id) => C().players[id]).filter(Boolean).sort((a, b) => b.rating - a.rating)[0];
    if (Math.random() < (big ? 0.9 : 0.5)) interview(star, title, 'win');
    if (T.runnerUp && C().teams[T.runnerUp] && Math.random() < (big ? 0.6 : 0.25)) interview(C().teams[T.runnerUp].roster.map((id) => C().players[id]).filter(Boolean).sort((a, b) => b.rating - a.rating)[0], title, 'lose');
    if (big) { fiveThings(title, T, list, champ); rankingsStory(title); }
    else if (st.key === 'o3' || st.key === 'o6') rankingsStory(st.name);
    // tactics: what the champions' style says about the meta
    if (Math.random() < (big ? 0.7 : 0.25)) { const sty = aiStyle(champ), S = STYLES[sty]; if (champ !== C().user) K.news('analysis', `<b>Tactics board:</b> ${esc(tname(champ))}'s ${esc(S.n.toLowerCase())} approach (${esc(S.d.toLowerCase())}) won the ${esc(title)}. ${fresh(['Expect copycats next event.', 'Is this the new meta?', 'Coaches will be studying the VODs all week.', 'The counter is out there, but nobody found it yet.'])}`, { champ }); }
    // rival managers under pressure
    const flop = list.filter(({ id }) => id !== C().user && C().teams[id] && K.tierOf(id) >= 4).sort((a, b) => b.place - a.place)[0];
    if (big && flop && flop.place >= 9 && Math.random() < 0.35) { K.news('sacked', `<b>${esc(tname(flop.id))}</b> part ways with their manager after a ${E_ord(flop.place)}-place finish at the ${esc(title)}. ${pick(['The search for a replacement starts now.', 'Players are said to be shocked.', 'The board wanted a trophy this season.'])}`, { champ: flop.id }); post(pressAcct(), `BREAKING: ${esc(tname(flop.id))} have sacked their manager. 🚪`, { kind: 'press', big: true }); }
  }
  /** Stories between events: stat of the week, opinion, throwbacks, contract watch, the boardroom. */
  function stepNews(st) {
    const x = C().x;
    const ps = Object.values(C().players).filter((p) => p.team && p.stats && p.stats.gp >= 6);
    if (ps.length && Math.random() < 0.6) {
      const k = pick([['g', 'goals'], ['a', 'assists'], ['sv', 'saves']]), top = ps.sort((a, b) => b.stats[k[0]] - a.stats[k[0]])[0];
      K.news('stat', `📊 <b>${esc(top.name)}</b> (${esc(tname(top.team))}) leads the circuit with <b>${top.stats[k[0]]} ${k[1]}</b> this season${pick([', and it isn\'t close.', '. Nobody else is near.', ' in ' + top.stats.gp + ' games.'])}`, { pid: top.id });
    }
    if (Math.random() < 0.35) {
      const pw = (x.power || []).slice(-1)[0], reg = K.homeReg(), rn = K.api().regions[reg];
      K.news('opinion', fresh([
        `<b>Opinion:</b> ${esc(rn)} ${pw && Object.entries(pw.idx).sort((a, b) => b[1] - a[1])[0][0] === reg ? 'is the strongest region in the world, and it\'s time we said it out loud.' : 'is closing the gap on the best regions faster than anyone expected.'}`,
        `<b>Opinion:</b> the Swiss format rewards consistency over brilliance, and we should talk about that.`,
        `<b>Opinion:</b> young players are being thrown in too early. Let the academies do their job.`,
        `<b>Opinion:</b> the 1v1 and 2v2 titles deserve the same respect as the 3v3 circuit.`,
        `<b>Opinion:</b> transfer fees have gone mad. Who is paying for all of this?`]));
    }
    const H = C().history.filter((h) => h.season < C().season);
    if (H.length && Math.random() < 0.3) { const h = pick(H); K.news('throwback', `⏪ <b>Throwback, ${h.season}:</b> ${esc(h.champion || '—')} were crowned world champions${h.mvp && h.mvp !== '—' ? `, with ${esc(h.mvp)} the season MVP` : ''}.`); }
    if (st.type === 'window') {
      const exp = Object.values(C().players).filter((p) => p.team && p.team !== C().user && p.contract <= 1 && p.rating >= 82).sort((a, b) => b.rating - a.rating).slice(0, 4);
      if (exp.length) K.news('contract', `<b>Contract watch:</b> stars out of contract at the end of this season<ul class="nlist">${exp.map((p) => `<li><b>${esc(p.name)}</b> <small>${esc(tname(p.team))} · OVR ${p.rating} · age ${p.age}</small></li>`).join('')}</ul>`);
    }
    if (mine()) {
      const b = C().board, last = x.boardSaid || 0;
      if (b < 35 && last !== -1) { x.boardSaid = -1; K.news('board', `🏢 <b>Boardroom:</b> the ${esc(K.userTeam().name)} board "expects an immediate improvement in results". Confidence is at ${b}%.`); }
      else if (b >= 80 && last !== 1) { x.boardSaid = 1; K.news('board', `🏢 <b>Boardroom:</b> the board gives the manager its "full backing" and talks about a long-term project. Confidence ${b}%.`); }
      else if (b >= 35 && b < 80 && last) x.boardSaid = 0;
    }
  }

  /* ======================= records ======================= */
  function rec() { const x = C().x; x.rec = x.rec || { titles: {}, season: {}, fees: [], upsets: [], youngest: null, oldest: null, teamPts: null, peak: null, career: {} }; return x.rec; }
  function careerOf(p) { p.cr = p.cr || { t: 0, maj: 0, w: 0, aw: 0, mvp: 0, s: 0, g: 0, a: 0, sv: 0, peak: p.rating, clubs: [] }; return p.cr; }
  function bumpRecord(key, val, who, better) {
    const r = rec().season; const cur = r[key];
    if (!cur || (better ? better(val, cur.v) : val > cur.v)) { const broke = !!cur; r[key] = Object.assign({ v: val, season: C().season }, who); return broke; }
    return false;
  }

  /* ======================= events ======================= */
  function onEvent(T, st, region, title, list) {
    const x = C().x, kind = st.type, champ = T.champion;
    const big = kind === 'major' || kind === 'worlds' || kind === 'ewc';
    // titles for the record book (club + players)
    if (champ && C().teams[champ]) {
      const R = rec(), nm = C().teams[champ].name;
      const tr = R.titles[nm] = R.titles[nm] || { total: 0, worlds: 0, majors: 0, opens: 0, ewc: 0 };
      tr.total++; if (kind === 'worlds') tr.worlds++; else if (kind === 'major') tr.majors++; else if (kind === 'ewc') tr.ewc++; else tr.opens++;
      const ps = C().teams[champ].roster.slice(0, 3).map((id) => C().players[id]).filter(Boolean);
      ps.forEach((p) => { const cr = careerOf(p); cr.t++; if (kind === 'major') cr.maj++; if (kind === 'worlds') cr.w++; });
      if (big) ps.forEach((p) => {
        if (!R.youngest || p.age < R.youngest.v) R.youngest = { v: p.age, name: p.name, title, season: C().season };
        if (!R.oldest || p.age > R.oldest.v) R.oldest = { v: p.age, name: p.name, title, season: C().season };
      });
      // social: the champions celebrate
      if (big || champ === C().user || (kind === 'open' && region === K.homeReg())) {
        post(clubAcct(champ), `${kind === 'worlds' ? 'WORLD CHAMPIONS. 🌍🏆' : pick(['CHAMPIONS 🏆', 'WE WIN 🏆', 'TROPHY SECURED 🏆', 'SILVERWARE 🏆'])} ${esc(title)}. ${pick(['What a team.', 'We never stopped believing.', 'This one is for the fans.', 'History made.', 'Back where we belong.', 'Every single one of you got us here.', 'Nobody believed. We did.'])} ${hashTag(C().teams[champ].tag || nm)}`, { kind: 'club', big, mood: 'good' });
        const star = ps.slice().sort((a, b) => b.rating - a.rating)[0];
        if (star) post(playerAcct(star), pick(['NO WORDS 😭🏆', 'we did it. WE DID IT.', 'Dreamt of this since I was a kid. Thank you all ❤️', 'Told you. 😤', 'Trophy #' + careerOf(star).t + ' 🏆']), { kind: 'player', big, mood: 'good' });
        post(fanAcct(), pick([`${esc(nm)} are just built different`, `${esc(nm)} deserved that so much`, `crying at work rn ${hashTag(nm)}`, `that final was insane, ${esc(nm)} 🐐`]), { kind: 'fan', mood: 'good' });
      }
    }
    // upsets: the biggest rating gap overturned in this event
    let up = null;
    Object.values(T.matches).forEach((m) => {
      if (!m.result || m.result.bye || !C().teams[m.result.winner] || !C().teams[m.result.loser]) return;
      const gap = K.ovr(m.result.loser) - K.ovr(m.result.winner);
      if (gap >= 6 && (!up || gap > up.gap)) up = { gap, w: m.result.winner, l: m.result.loser, sc: Math.max(m.result.sa, m.result.sb) + '-' + Math.min(m.result.sa, m.result.sb) };
    });
    if (up && (big || region === K.homeReg() || up.w === C().user || up.l === C().user)) {
      K.news('upset', `<span class="tag-hot">Upset</span> Shock at the ${esc(title)}: <b>${esc(tname(up.w))}</b> (OVR ${K.ovr(up.w)}) beat <b>${esc(tname(up.l))}</b> (OVR ${K.ovr(up.l)}) ${up.sc}.`, { champ: up.w });
      post(pressAcct(), `UPSET 🚨 ${esc(tname(up.w))} take down ${esc(tname(up.l))} ${up.sc} at the ${esc(title)}. Nobody saw that coming. ${hashTag(title)}`, { kind: 'press', big: true });
      const R = rec(); R.upsets.push({ gap: up.gap, w: tname(up.w), l: tname(up.l), title, season: C().season }); R.upsets.sort((a, b) => b.gap - a.gap); R.upsets = R.upsets.slice(0, 10);
    }
    // player of the tournament
    const rows = Object.values(T.stats || {}).filter((s) => s && s.name && s.gp >= 3);
    const potm = rows.sort((a, b) => b.score / b.gp - a.score / a.gp)[0];
    if (potm && (big || region === K.homeReg())) K.news('feature', `<b>${esc(potm.name)}</b> (${esc(tname(potm.team))}) was the standout player of the ${esc(title)}: ${potm.g} goals, ${potm.a} assists and ${potm.sv} saves in ${potm.gp} games.`, { champ: potm.team });
    // dynasties: back-to-back wins
    if (champ && (big || kind === 'open')) {
      x.streak = x.streak || {};
      const key = kind === 'open' ? 'open:' + region : 'intl';
      const s = x.streak[key] && x.streak[key].id === champ ? x.streak[key].n + 1 : 1;
      x.streak[key] = { id: champ, n: s };
      if (s >= 2 && (big || region === K.homeReg())) K.news('feature', `${s === 2 ? 'Back-to-back' : s + ' in a row'}: <b>${esc(tname(champ))}</b> ${s >= 3 ? 'are building a dynasty. Can anyone stop them?' : 'win again. Is a dynasty forming?'}`, { champ });
    }
    // manager: series won and lost, achievements
    if (mine()) {
      const m = mgr();
      let giant = false;
      Object.values(T.matches).forEach((mm) => {
        if (!mm.result || mm.result.bye) return;
        if (mm.result.winner === C().user) { m.w++; addXp(10); if (K.ovr(mm.result.loser) - K.ovr(C().user) >= 7) giant = true; }
        else if (mm.result.loser === C().user) m.l++;
      });
      if (m.w >= 1) ach('first_win');
      if (giant) ach('giant');
      const me = list.find((y) => y.id === C().user);
      if (champ === C().user) {
        addXp(kind === 'worlds' ? 700 : big ? 350 : 150); m.titles++;
        ach('first_title'); if (kind === 'major') ach('major'); if (kind === 'worlds') ach('worlds');
        const lost = Object.values(T.matches).some((mm) => mm.result && mm.result.loser === C().user);
        if (!lost) ach('unbeaten');
        if (C().trophies.filter((t) => t.season === C().season).length >= 3) ach('treble');
      }
      if (me) {
        moodAfterEvent(me.place, champ === C().user, big);
        const exp = x.expect || 8;
        if (me.place >= 9 && exp <= 4 && (big || kind === 'open')) post(fanAcct(), pick([`${esc(K.userTeam().name)} need a rethink. That was not good enough.`, `manager out?? 😬 ${hashTag(K.userTeam().name)}`, `what was that ${esc(K.userTeam().name)}...`]), { kind: 'fan', mood: 'bad' });
        else if (me.place <= 2) post(fanAcct(), pick([`${esc(K.userTeam().name)} are cooking 🔥`, `this ${esc(K.userTeam().name)} roster is special`, `the manager deserves a raise ${hashTag(K.userTeam().name)}`]), { kind: 'fan', mood: 'good' });
      }
      if (['open', 'major', 'worlds', 'ewc'].includes(kind) && me) C().x.fam = Math.min(100, (C().x.fam || 0) + 20); // tactics bed in with games
    }
    eventChatter(T, st, region, title, list, big);
    eventNews(T, st, region, title, list, big);
    // power index: international results by region
    if (big) {
      x.intl = x.intl || {};
      list.slice(0, 8).forEach(({ id, place }) => { const t = C().teams[id]; if (!t) return; const pts = place === 1 ? 10 : place === 2 ? 7 : place <= 4 ? 5 : 2; x.intl[t.region] = (x.intl[t.region] || 0) + pts * (kind === 'ewc' ? 0.5 : 1); });
    }
  }

  /** Extra voices after every 3v3 event: the runner-up, casters, stats, memes, a world roundup. */
  function eventChatter(T, st, region, title, list, big) {
    const champ = T.champion, ru = T.runnerUp, home = region === K.homeReg() || big;
    if (!champ || !C().teams[champ]) return;
    const w = tname(champ), l = ru && C().teams[ru] ? tname(ru) : '';
    if (!home) { if (Math.random() < 0.35) post(pressAcct(), `🌍 Around the world: ${esc(w)} win the ${esc(title)}${l ? `, beating ${esc(l)} in the final` : ''}.`, { kind: 'press' }); return; }
    // the runner-up
    if (ru && C().teams[ru]) {
      const rp = C().teams[ru].roster.slice(0, 3).map((id) => C().players[id]).filter(Boolean).sort((a, b) => b.rating - a.rating)[0];
      if (rp) post(playerAcct(rp), pick(['so close. we\'ll be back. 🫡', 'hurts. proud of the boys though.', 'congrats ' + esc(w) + ', deserved. see you next time.', 'not the ending we wanted. back to work tomorrow.', 'second place is the first loser. we go again.']), { kind: 'player', mood: 'bad' });
    }
    // a caster's call of the final
    post(casterAcct(), pick([`Called the final for ${esc(title)}. ${esc(w)} were simply on another level. 🎙️`, `What a series. ${esc(w)} vs ${esc(l || 'the field')} will be talked about for years.`, `My voice is gone. ${esc(w)}, you absolute legends. 🎙️🔥`, `Final thoughts on ${esc(title)}: ${esc(w)}'s rotations were textbook. Clip it.`]), { kind: 'press' });
    // a stats post about the standout player
    const rows = Object.values(T.stats || {}).filter((x) => x && x.name && x.gp >= 3).sort((a, b) => b.score / b.gp - a.score / a.gp);
    const top = rows[0];
    if (top && Math.random() < 0.8) post(statsAcct(), `📊 ${esc(title)} in numbers: ${esc(top.name)} (${esc(tname(top.team))}) led the event with ${top.g} goals, ${top.a} assists and ${top.sv} saves in ${top.gp} games (${Math.round(top.score / top.gp)} avg score).`, { kind: 'press' });
    // memes
    if (Math.random() < 0.55) post(memeAcct(), fill(pick(MEME.champ), { w }), { kind: 'fan' });
    // a streamer watching along
    if (Math.random() < 0.4) post(streamAcct(), pick([`watch party for ${esc(title)} was INSANE, 12k of you in chat 🙏`, `clipping the best moments from ${esc(title)} live right now`, `${esc(w)} winning means I owe chat a 24h stream 💀`]), { kind: 'fan' });
    // your club reacts to its own result
    if (mine()) {
      const me = list.find((y) => y.id === C().user);
      if (me && champ !== C().user) post(clubAcct(C().user), me.place <= 2 ? pick(['So close. Proud of this team. 💪', 'Runners-up. We\'ll be back stronger.']) : me.place <= 4 ? pick(['Top 4. Good, not good enough. Back to work.', 'Semi-finals. We keep building.']) : pick(['Not our weekend. We\'ll regroup.', 'Tough one. Heads up, back to the drawing board.', 'Thank you for the support, we owe you a better showing.']), { kind: 'club', mood: me.place <= 4 ? '' : 'bad' });
    }
  }
  /** 1v1 and 2v2 Opens and World Championships. */
  function onSide(T, st, region, title, e) {
    const ch = e.champ || [], ru = e.runner || [];
    if (!ch.length) return;
    const names = ch.map((p) => p.name).join(' & '), solo = e.mode === 1;
    const home = e.world || region === K.homeReg() || (mine() && ch.some((p) => p.team === C().user));
    if (home && Math.random() < (e.world ? 0.9 : 0.5)) interview(ch[0], title, 'side');
    if (e.world) K.news('feature', solo ? `<b>Profile:</b> ${esc(names)}, the best 1v1 player on the planet. ${pick(['Calm, clinical, unbreakable.', 'A mechanical freak with a chess player\'s brain.', 'Nobody reads the ball earlier.'])}` : `<b>Profile:</b> ${esc(names)}, ${pick(['the duo nobody can solve.', 'two players, one plan.', 'the best partnership in Rocket League.'])}`);
    if (!home) { if (Math.random() < 0.3) post(pressAcct(), `🌍 ${esc(names)} ${solo ? 'wins' : 'win'} the ${esc(title)}.`, { kind: 'press' }); return; }
    post(playerAcct(ch[0]), solo ? pick(['just me and the ball. 1v1 CHAMPION 🗡️', 'nobody to blame, nobody to share it with. ' + (e.world ? 'WORLD CHAMPION 🌍' : 'CHAMPION 🏆'), 'the solo grind paid off 😤', '1v1 is the purest test. passed. ✅']) : pick([`me and ${esc(ch[1] ? ch[1].name : 'my duo')} are ${e.world ? 'WORLD CHAMPIONS 🌍' : 'champions 🏆'}`, 'best duo in the world? you tell me 😏', 'two players, one brain cell, one trophy 🏆', 'GG. duo of the year incoming.']), { kind: 'player', big: !!e.world, mood: 'good' });
    if (!solo && ch[1]) post(playerAcct(ch[1]), pick([`@${esc(ch[0].name)} told you we'd do it 🤝`, 'couldn\'t ask for a better partner 🤝', 'trophy #' + careerOf(ch[1]).t + '? who\'s counting 😌']), { kind: 'player', mood: 'good' });
    if (ru.length) post(playerAcct(ru[0]), pick(['the 1v1 bracket is cruel. gg.', 'second. not bad, not enough.', 'gg ' + esc(names) + ', you were better today.']), { kind: 'player', mood: 'bad' });
    post(casterAcct(), solo ? pick([`1v1s are the most stressful thing I've ever called. ${esc(names)} was ice cold. 🧊`, `Nowhere to hide in a 1v1. ${esc(names)} didn't need to. 🎙️`]) : pick([`The 2v2 chemistry from ${esc(names)} was unreal. 🎙️`, `${esc(names)} played like one player with four hands.`]), { kind: 'press' });
    if (Math.random() < 0.6) post(memeAcct(), pick(MEME.side), { kind: 'fan' });
    if (e.world) pollPost(pressAcct(), `Was ${esc(names)}'s ${solo ? '1v1' : '2v2'} title the most impressive of the season?`, [{ l: 'Yes, clearly', w: 1.3 }, { l: 'Close second', w: 1 }, { l: 'Nah, the 3v3 Worlds', w: 0.8 }]);
    post(fanAcct(), pick([`${esc(names)} ${solo ? 'is' : 'are'} so underrated it's crazy`, `the ${solo ? '1v1' : '2v2'} scene deserves more love after that`, `who else stayed up for the ${esc(title)} final 🙋`]), { kind: 'fan', mood: 'good' });
    if (mine() && e.mine) post(clubAcct(C().user), `${esc(e.mine.name)} finished ${esc(e.mine.label)} at the ${esc(title)}. ${e.mine.place === 1 ? 'CHAMPION! 🏆' : 'Proud of you. 💪'}`, { kind: 'club', mood: e.mine.place === 1 ? 'good' : '' });
  }
  /** National-team tournaments: federations, players on duty, patriotic fans. */
  function onNation(T, st, title, e) {
    if (!e.champ) return;
    interview((e.champPs || [])[0], title, 'nation');
    K.news('feature', `${e.champFlag || ''} <b>${esc(e.champ)}</b>: ${fresh(['a golden generation, finally rewarded.', 'how a nation of club rivals became one team.', 'the ' + esc(title) + ' winners nobody predicted.', 'the deepest pool of talent in the world, and now the trophy to prove it.'])}`);
    post(fedAcct(e.champ, e.champFlag), `${e.champFlag || ''} ${pick(['CHAMPIONS OF THE WORLD', 'WE DID IT', 'FOR OUR COUNTRY'])}! ${esc(title)} 🏆 ${pick(['A whole nation is proud.', 'Written in history.', 'Thank you for the support from home.'])} ${hashTag(e.champ)}`, { kind: 'club', big: true, mood: 'good' });
    const star = (e.champPs || [])[0];
    if (star) post(playerAcct(star), pick([`representing ${esc(e.champ)} is the biggest honour 🫡 ${e.champFlag || ''}`, `${e.champFlag || ''} national champions. for my family, for my country.`, 'club trophies are great. this one hits different. 🏆']), { kind: 'player', big: true, mood: 'good' });
    if (e.runner) post(fedAcct(e.runner, e.runnerFlag), `${e.runnerFlag || ''} Runners-up at the ${esc(title)}. Heads high, we go again. ${hashTag(e.runner)}`, { kind: 'club', mood: 'bad' });
    post(fanAcct(), pick([`${e.champFlag || ''}${e.champFlag || ''}${e.champFlag || ''} LETS GOOOO`, `crying in the club rn ${e.champFlag || ''}`, `the whole country watching esports today, love to see it`, `${esc(e.champ)} deserved that. what a final`]), { kind: 'fan', mood: 'good' });
    if (e.runner) post(fanAcct(), pick([`${e.runnerFlag || ''} we were robbed honestly`, `next time ${e.runnerFlag || ''} next time`, 'national team curse continues 🥲']), { kind: 'fan', mood: 'bad' });
    post(casterAcct(), pick([`Nothing beats national team week. ${esc(e.champ)} take the ${esc(title)}! 🎙️`, `The anthems, the flags, the noise. ${esc(title)} delivered.`]), { kind: 'press' });
    if (Math.random() < 0.6) post(memeAcct(), pick(MEME.nation), { kind: 'fan' });
    if (mine() && (e.mine || []).length) post(clubAcct(C().user), `Our players on international duty: ${(e.mine || []).map((p) => esc(p.name) + ' ' + (p.flag || '')).join(', ')}. ${(e.won || []).length ? 'And one of them is a national champion! 🏆' : 'Welcome back, back to club work. 💪'}`, { kind: 'club' });
  }

  /* ======================= manager career ======================= */
  const ACH = {
    first_win: ['First blood', 'Win your first series.'],
    first_title: ['Silverware', 'Win your first trophy.'],
    major: ['Major champion', 'Win a Major.'],
    worlds: ['World champion', 'Win the World Championship.'],
    treble: ['Treble', 'Win three trophies in one season.'],
    unbeaten: ['Invincible', 'Win an event without losing a series.'],
    giant: ['Giant killer', 'Beat a team rated 7+ higher in a series.'],
    big_buy: ['Statement signing', 'Pay a $1M+ transfer fee.'],
    bargain: ['Bargain hunter', 'Sign a free agent who reaches 88 OVR.'],
    academy: ['Youth whisperer', 'Have an academy graduate reach 85 OVR.'],
    award: ['Manager of the Year', 'Win Manager of the Year.'],
    survivor: ['Great escape', 'Meet both objectives with board confidence under 30%.'],
    decade: ['Institution', 'Complete 10 seasons.'],
    hof: ['Legend maker', 'See one of your players inducted into the Hall of Fame.'],
  };
  function mgr() {
    const x = C().x;
    if (!x.mgr) { const tier = K.tierOf(C().user) || 2; x.mgr = { xp: 0, rep: 20 + tier * 8, w: 0, l: 0, titles: 0, seasons: 0, ach: [], clubs: [C().teams[C().user] ? C().teams[C().user].name : '—'], log: [] }; }
    return x.mgr;
  }
  const lvlOf = (xp) => Math.min(40, Math.floor(Math.sqrt(xp / 120)) + 1);
  const xpFor = (lvl) => (lvl - 1) * (lvl - 1) * 120;
  const RANKS = [[1, 'Rookie manager'], [4, 'Up-and-comer'], [8, 'Established manager'], [13, 'Respected tactician'], [19, 'Elite manager'], [26, 'Mastermind'], [34, 'Legend of the game']];
  const rankOf = (lvl) => RANKS.filter((r) => lvl >= r[0]).pop()[1];
  function addXp(n) {
    if (!mine()) return;
    const m = mgr(), before = lvlOf(m.xp); m.xp += Math.round(n * (K.diff().name === 'Hard' ? 1.25 : 1));
    const after = lvlOf(m.xp);
    if (after > before) { K.news('career', `📈 Manager level ${after}: you are now ${/^[AEIOU]/.test(rankOf(after)) ? 'an' : 'a'} <b>${esc(rankOf(after))}</b>.`); if (rankOf(after) !== rankOf(before)) post(pressAcct(), `The rise of the manager at ${esc(K.userTeam().name)} continues. ${esc(rankOf(after))} status confirmed.`, { kind: 'press' }); }
  }
  function ach(k) {
    if (!mine() || !ACH[k]) return;
    const m = mgr(); if (m.ach.includes(k)) return;
    m.ach.push(k); addXp(120);
    K.news('career', `🏅 Achievement unlocked: <b>${esc(ACH[k][0])}</b> · ${esc(ACH[k][1])}`);
  }

  /* ======================= season review: awards, Hall of Fame, power, progression ======================= */
  function onReview(info) {
    info = info || {};
    const x = C().x, season = C().season;
    if (x.reviewed === season) return; x.reviewed = season;
    const all = Object.values(C().players).filter((p) => p.team && C().teams[p.team] && p.stats.gp >= 12);
    all.forEach(persOf);
    const per = (p) => p.stats.score / Math.max(1, p.stats.gp);
    const byPer = all.slice().sort((a, b) => per(b) - per(a));
    const who = (p) => ({ pid: p.id, name: p.name, flag: p.flag || '', team: p.team, teamName: tname(p.team), color: C().teams[p.team].color });
    const nom = (list, stat) => list.slice(0, 3).map((p) => Object.assign(who(p), { stat: stat(p) }));
    const awards = [];
    const add = (key, title, list, stat, blurb) => { if (!list.length) return; awards.push({ key, title, blurb, nominees: nom(list, stat), winner: Object.assign(who(list[0]), { stat: stat(list[0]) }) }); };
    add('mvp', 'Most Valuable Player', byPer, (p) => Math.round(per(p)) + ' avg score', 'The best player of the season.');
    add('young', 'Young Player of the Year', byPer.filter((p) => p.age <= 21), (p) => 'age ' + p.age + ' · ' + Math.round(per(p)) + ' avg', 'The best player aged 21 or under.');
    add('scorer', 'Golden Boost (top scorer)', all.slice().sort((a, b) => b.stats.g - a.stats.g), (p) => p.stats.g + ' goals', 'Most goals across the season.');
    add('play', 'Playmaker of the Year', all.slice().sort((a, b) => b.stats.a - a.stats.a), (p) => p.stats.a + ' assists', 'Most assists across the season.');
    add('wall', 'The Wall', all.slice().sort((a, b) => b.stats.sv - a.stats.sv), (p) => p.stats.sv + ' saves', 'Most saves across the season.');
    const gain = (p) => p.rating - (p.r0 != null ? p.r0 : p.rating);
    add('break', 'Breakout Star', all.filter((p) => gain(p) > 0).sort((a, b) => gain(b) - gain(a) || per(b) - per(a)), (p) => '+' + gain(p) + ' OVR', 'Biggest step forward this season.');
    // Team of the Year: the three best by average score from different clubs where possible
    const toty = []; byPer.forEach((p) => { if (toty.length < 3 && !toty.some((q) => q.team === p.team)) toty.push(p); });
    if (toty.length === 3) awards.push({ key: 'toty', title: 'Team of the Year', blurb: 'The three standout players of the season.', team: toty.map((p) => Object.assign(who(p), { stat: Math.round(per(p)) + ' avg' })) });
    // Manager & Club of the Year: points against pre-season expectation
    const pts = (id) => (C().points[id] ? C().points[id].season : 0);
    const clubs = Object.keys(C().teams).filter((id) => pts(id) > 0);
    const exp = x.expPts || {};
    const over = (id) => pts(id) - (exp[id] || 0) + C().trophies.filter((t) => t.season === season && id === C().user).length * 6;
    const mot = clubs.slice().sort((a, b) => over(b) - over(a)).slice(0, 3);
    if (mot.length) awards.push({ key: 'mgr', title: 'Manager of the Year', blurb: 'Did the most with what they had.', nominees: mot.map((id) => ({ name: id === C().user ? 'You' : 'Manager of ' + tname(id), teamName: tname(id), team: id, color: C().teams[id].color, stat: '+' + Math.round(over(id)) + ' pts over expectation' })), winner: { name: mot[0] === C().user ? 'You' : 'Manager of ' + tname(mot[0]), teamName: tname(mot[0]), team: mot[0], color: C().teams[mot[0]].color, stat: '+' + Math.round(over(mot[0])) + ' pts over expectation' } });
    const coty = clubs.slice().sort((a, b) => pts(b) - pts(a)).slice(0, 3);
    if (coty.length) awards.push({ key: 'club', title: 'Club of the Year', blurb: 'Most circuit points this season.', nominees: coty.map((id) => ({ name: tname(id), teamName: K.api().regions[C().teams[id].region], team: id, color: C().teams[id].color, stat: pts(id) + ' pts' })), winner: { name: tname(coty[0]), teamName: K.api().regions[C().teams[coty[0]].region], team: coty[0], color: C().teams[coty[0]].color, stat: pts(coty[0]) + ' pts' } });
    x.awards = x.awards || {}; x.awards[season] = awards;
    // award counts on players' careers
    awards.forEach((a) => { const ws = a.team || (a.winner && a.winner.pid ? [a.winner] : []); ws.forEach((w) => { const p = C().players[w.pid]; if (p) { const cr = careerOf(p); cr.aw++; if (a.key === 'mvp') cr.mvp++; } }); });
    const mvpA = awards.find((a) => a.key === 'mvp');
    const thanked = new Set();
    awards.forEach((a) => {
      if (a.team) { post(pressAcct(), `⭐ Team of the Year ${season}: ${a.team.map((w) => esc(w.name)).join(', ')}.`, { kind: 'press', big: true }); return; }
      const wp = a.winner && a.winner.pid && C().players[a.winner.pid];
      if (wp && !thanked.has(wp.id) && thanked.add(wp.id) && (a.key === 'mvp' || a.key === 'young' || Math.random() < 0.5)) post(playerAcct(wp), pick([`${esc(a.title)}? 🥹 thank you all.`, `blessed. ${esc(a.title)} ${season} 🏅`, `none of this without my teammates. 🏅`]), { kind: 'player', big: a.key === 'mvp', mood: 'good' });
    });
    if (mvpA) pollPost(pressAcct(), `🗳️ Did the right player win MVP ${season}?`, [{ l: mvpA.winner.name, w: 1.3 }].concat((mvpA.nominees || []).filter((n) => n.name !== mvpA.winner.name).slice(0, 2).map((n) => ({ l: n.name }))));
    if (mvpA) K.news('award', `🏅 <b>${esc(mvpA.winner.name)}</b> (${esc(mvpA.winner.teamName)}) is the ${season} MVP. The full awards ceremony is in the season review.`);
    if (mine()) {
      const won = awards.filter((a) => (a.winner && (a.winner.team === C().user || a.winner.name === 'You')) || (a.team || []).some((w) => w.team === C().user));
      if (won.length) addXp(150 * won.length);
      if (awards.some((a) => a.key === 'mgr' && a.winner.team === C().user)) ach('award');
    }
    // season records and career totals (milestones are gathered into one story per landmark)
    const miles = {};
    all.forEach((p) => {
      const cr = careerOf(p); cr.s++; cr.g += p.stats.g; cr.a += p.stats.a; cr.sv += p.stats.sv; cr.peak = Math.max(cr.peak || 0, p.rating);
      const club = tname(p.team); if (!cr.clubs.includes(club)) cr.clubs.push(club);
      const w = { name: p.name, team: club };
      if (bumpRecord('goals', p.stats.g, w)) K.news('record', `📕 Record! <b>${esc(p.name)}</b>'s ${p.stats.g} goals are the most ever in one season.`);
      bumpRecord('assists', p.stats.a, w); bumpRecord('saves', p.stats.sv, w); bumpRecord('avg', Math.round(per(p)), w);
      [250, 500, 1000].forEach((ms) => { if (cr.g >= ms && cr.g - p.stats.g < ms) (miles[ms] = miles[ms] || []).push(p.name); });
    });
    Object.entries(miles).forEach(([ms, names]) => K.news('milestone', `🎯 <b>${ms} career goals:</b> ${names.slice(0, 6).map(esc).join(', ')}${names.length > 6 ? ` and ${names.length - 6} more` : ''} passed the mark this season.`));
    const R = rec();
    Object.keys(C().teams).forEach((id) => { if (pts(id)) bumpRecord('teamPts', pts(id), { name: tname(id), team: tname(id) }); });
    Object.values(C().players).forEach((p) => { if (!R.peak || p.rating > R.peak.v) R.peak = { v: p.rating, name: p.name, season }; });
    // regional power: team strength + international results; the strongest region over its slots takes a slot from the weakest
    const REG = K.REGIONS, idx = {};
    REG.forEach((r) => { const ids = Object.keys(C().teams).filter((id) => C().teams[id].region === r).map((id) => K.ovr(id)).sort((a, b) => b - a).slice(0, 8); idx[r] = Math.round((ids.reduce((s, v) => s + v, 0) / Math.max(1, ids.length) + (x.intl && x.intl[r] ? x.intl[r] : 0) / 3) * 10) / 10; });
    x.power = x.power || []; const prev = x.power[x.power.length - 1];
    x.power.push({ season, idx, intl: Object.assign({}, x.intl || {}) });
    x.power = x.power.slice(-20);
    if (prev) {
      const ch = REG.map((r) => [r, idx[r] - (prev.idx[r] || idx[r])]).sort((a, b) => b[1] - a[1]);
      if (ch[0][1] >= 1.5) K.news('power', `📈 Power shift: <b>${esc(K.api().regions[ch[0][0]])}</b> is on the rise (power index ${idx[ch[0][0]]}, +${ch[0][1].toFixed(1)}).`);
      const lo = ch[ch.length - 1]; if (lo[1] <= -1.5) K.news('power', `📉 <b>${esc(K.api().regions[lo[0]])}</b> is slipping (power index ${idx[lo[0]]}, ${lo[1].toFixed(1)}).`);
    }
    const sm = Object.assign({}, K.slots().major), sw = Object.assign({}, K.slots().worlds);
    const ratio = (r) => ((x.intl && x.intl[r]) || 0) / Math.max(1, sm[r]);
    const order = REG.slice().sort((a, b) => ratio(b) - ratio(a));
    const up = order[0], down = order.slice().reverse().find((r) => sm[r] > 1 && r !== up);
    if (up && down && ratio(up) - ratio(down) >= 6 && sm[up] < 6) {
      sm[up]++; sm[down]--; sw[up]++; sw[down] = Math.max(1, sw[down] - 1);
      if (Object.values(sw).reduce((s, v) => s + v, 0) > 20) sw[up]--;
      x.slotsNext = { major: sm, worlds: sw };
      K.news('power', `🌍 <b>Regional power shift.</b> After their international results, <b>${esc(K.api().regions[up])}</b> gain a Major slot (now ${sm[up]}) and <b>${esc(K.api().regions[down])}</b> lose one (now ${sm[down]}) from next season.`);
      post(pressAcct(), `BREAKING: slot allocation changes for next season. ${esc(K.api().regions[up])} +1, ${esc(K.api().regions[down])} -1. The power balance of RLCS is moving. 🌍`, { kind: 'press', big: true });
    }
    x.intl = {};
    if (mine()) { const up = K.REGIONS.reduce((s, r) => s + (scoutNet()[r] || 0), 0) * 10000; if (up) { K.userTeam().budget -= up; K.news('career', `🔭 Scouting network upkeep: ${K.money(up)} for the season.`); } }
    // manager season: reputation, level, job offers
    if (mine()) {
      const m = mgr(); m.seasons++; if (m.seasons >= 10) ach('decade');
      const objs = info.objOk || 0;
      addXp(objs * 100 + 60);
      if (objs === 2 && (x.lowBoard || C().board) < 30) ach('survivor');
      const titles = C().trophies.filter((t) => t.season === season).length;
      m.rep = clamp(m.rep + objs * 4 - (2 - objs) * 5 + titles * 6 + (info.worlds ? 3 : 0), 0, 100);
      m.log.unshift({ season, club: K.userTeam().name, rank: info.regRank || null, titles, rep: m.rep }); m.log = m.log.slice(0, 30);
      // job offers from bigger clubs when your name is big enough
      const myTier = K.tierOf(C().user), myO = K.ovr(C().user);
      const cands = Object.keys(C().teams).filter((id) => id !== C().user && (K.tierOf(id) > myTier || K.ovr(id) >= myO + 4) && m.rep >= 35 + K.tierOf(id) * 9).sort((a, b) => K.ovr(b) - K.ovr(a));
      x.offers = cands.slice(0, 1 + Math.floor(Math.random() * 2)).filter(() => Math.random() < 0.6 + m.rep / 250);
      if (x.offers.length) { K.news('career', `📨 Your reputation is growing: <b>${x.offers.map((id) => esc(tname(id))).join('</b> and <b>')}</b> ${x.offers.length > 1 ? 'have' : 'has'} asked about your availability. See the season review.`); post(pressAcct(), `Sources: ${esc(tname(x.offers[0]))} are interested in the ${esc(K.userTeam().name)} manager. 👀`, { kind: 'press' }); }
      // squad: an academy graduate or a free signing who became a star
      K.userTeam().roster.forEach((id) => { const p = C().players[id]; if (!p) return; if (p.fromAcademy && p.rating >= 85) ach('academy'); if (p.freeSigned && p.rating >= 88) ach('bargain'); });
    }
    K.save();
  }
  /** Before retired players are removed: Hall of Fame inductions (and keep their career totals for the record book). */
  function onRetire(list) {
    const x = C().x; x.hof = x.hof || [];
    const R = rec();
    list.forEach((p) => {
      const cr = careerOf(p);
      const score = hofScore(p);
      R.career[p.name] = { g: cr.g, a: cr.a, sv: cr.sv, t: cr.t, mvp: cr.mvp, peak: cr.peak };
      if (score >= HOF_BAR && !x.hof.some((h) => h.name === p.name)) {
        x.hof.unshift({ name: p.name, flag: p.flag || '', country: p.country || '', season: C().season, score: Math.round(score), peak: cr.peak, t: cr.t, w: cr.w, maj: cr.maj, mvp: cr.mvp, aw: cr.aw, g: cr.g, clubs: cr.clubs.slice(-4), pers: p.pers });
        K.news('hof', `🏛️ <b>${esc(p.name)}</b> retires and is inducted into the <b>Hall of Fame</b>: ${cr.t} titles${cr.w ? ', ' + cr.w + ' World Championship' + (cr.w > 1 ? 's' : '') : ''}${cr.mvp ? ', ' + cr.mvp + ' MVP award' + (cr.mvp > 1 ? 's' : '') : ''}, peak rating ${cr.peak}.`);
        post(pressAcct(), `A legend hangs up the controller. ${esc(p.name)} enters the Hall of Fame. 🏛️ Thank you for everything. ${hashTag(p.name + 'HOF')}`, { kind: 'press', big: true });
        if (p.team === C().user || cr.clubs.includes(K.userTeam && !K.V() ? K.userTeam().name : '')) ach('hof');
      }
    });
    // trim the career archive to the leaders
    const keep = new Set();
    ['g', 'a', 'sv', 't'].forEach((k) => Object.entries(R.career).sort((a, b) => b[1][k] - a[1][k]).slice(0, 15).forEach(([n]) => keep.add(n)));
    Object.keys(R.career).forEach((n) => { if (!keep.has(n)) delete R.career[n]; });
  }
  const HOF_BAR = 110; // roughly: several seasons of titles, a World Championship or MVPs, and a high peak
  function hofScore(p) {
    const cr = careerOf(p);
    return cr.t * 2 + cr.maj * 5 + cr.w * 12 + cr.aw * 4 + cr.mvp * 8 + Math.max(0, (cr.peak || 0) - 85) * 2 + cr.s * 1.5 + cr.g / 80;
  }

  /* ======================= steps & seasons ======================= */
  function onStep() {
    const x = C().x, st = K.step();
    moodDrift();
    if (C().board < (x.lowBoard || 100)) x.lowBoard = C().board;
    // scouting: knowledge grows in the regions you cover
    const net = scoutNet();
    Object.values(C().players).forEach((p) => {
      if (p.age > 23 || p.team === C().user) return;
      const r = p.region || (p.team && C().teams[p.team] ? C().teams[p.team].region : null);
      const lv = net[r] || 0; if (!lv) return;
      const kn = x.know[p.id] || 0; if (kn < 100) x.know[p.id] = Math.min(100, kn + lv * 9 + (p.age <= 19 ? 3 : 0));
    });
    // previews before the big events
    if ((st.type === 'major' || st.type === 'worlds' || st.type === 'ewc') && x.previewed !== C().season + st.key) {
      x.previewed = C().season + st.key;
      const fav = Object.keys(C().teams).sort((a, b) => K.ovr(b) - K.ovr(a)).slice(0, 2);
      const dark = Object.keys(C().teams).filter((id) => K.ovr(id) >= K.ovr(fav[1]) - 6 && !fav.includes(id)).sort(() => Math.random() - 0.5)[0];
      K.news('preview', `🔎 Preview: <b>${esc(tname(fav[0]))}</b> and <b>${esc(tname(fav[1]))}</b> start as favourites for the ${esc(st.name)}${dark ? `; analysts tip <b>${esc(tname(dark))}</b> as the dark horse` : ''}.`, { champ: fav[0] });
      post(pressAcct(), `${esc(st.name)} week is here. Our pick: ${esc(tname(fav[0]))}. Fight us. ${hashTag(st.name)}`, { kind: 'press' });
      const cand = Object.keys(C().teams).sort((a, b) => K.ovr(b) - K.ovr(a)).slice(0, 4);
      pollPost(pressAcct(), `🗳️ Who wins ${/^Major/.test(st.name) ? '' : 'the '}${esc(st.name)}?`, cand.map((id, i) => ({ l: tname(id), w: 1.4 - i * 0.2 })));
      post(streamAcct(), `${esc(st.name)} watch party all week, every series live with chat 📺`, { kind: 'fan' });
    }
    stepNews(st);
    // build-up to Opens in your region, and the 1v1 / 2v2 and national events
    if (st.type === 'open' && Math.random() < 0.7) post(pick([fanAcct(), casterAcct(), streamAcct()]), pick([`${esc(st.name)} starts today. who's your dark horse? 👀`, `Swiss stage chaos incoming. ${esc(st.name)} let's go 🍿`, `${esc(st.name)} pick'em locked in. ${esc(tname(Object.keys(C().teams).filter((id) => C().teams[id].region === K.homeReg()).sort((a, b) => K.ovr(b) - K.ovr(a))[0]))} to win it.`]), { kind: 'fan' });
    if ((st.type === 'side' || st.type === 'sidew') && Math.random() < 0.8) post(casterAcct(), `${st.mode === 1 ? '1v1' : '2v2'} week! ${st.type === 'sidew' ? 'The World Championship: four entrants, one title.' : 'Regional Opens, winners go to the World Championship.'} 🎙️`, { kind: 'press' });
    if (st.type === 'nation') { post(pressAcct(), `🌍 ${esc(st.name)} week: national teams take over. Club rivals become teammates.`, { kind: 'press' }); const by = {}; Object.values(C().players).forEach((p) => { if (p.team && p.country) (by[p.country] = by[p.country] || []).push(p.rating); });
      const fav = Object.entries(by).filter(([, r]) => r.length >= 3).map(([c, r]) => [c, r.sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0)]).sort((a, b) => b[1] - a[1]).slice(0, 4);
      if (fav.length >= 2) pollPost(pressAcct(), `🗳️ Who wins the ${esc(st.name)}?`, fav.map(([c], i) => ({ l: c, w: 1.4 - i * 0.2 }))); }
    if (st.type === 'window') {
      post(itkAcct(), pick(['👀 Big names on the move this window. Stay tuned.', 'Hearing a top club is ready to break the transfer record. More soon. 🧵', 'Three clubs are in talks for the same player. Expect movement this week.', 'Agents are busy. This could be the wildest window yet. 📞']), { kind: 'fan' });
      if (Math.random() < 0.7) post(memeAcct(), pick(MEME.market), { kind: 'fan' });
    }
    // transfer windows: rumours (some about your players) and incoming bids
    if (st.type === 'window' && x.bidsKey !== C().season + '|' + C().step && mine()) {
      x.bidsKey = C().season + '|' + C().step; x.bids = [];
      const ro = K.userTeam().roster.map((id) => C().players[id]).filter((p) => p && p.rating >= 74);
      ro.forEach((p) => {
        const chance = 0.18 + (p.wantsOut ? 0.35 : 0) + (p.rating >= 86 ? 0.12 : 0);
        if (Math.random() > chance || x.bids.length >= 2) return;
        const value = K.valueFor(p);
        const buyers = Object.keys(C().teams).filter((id) => id !== C().user && C().teams[id].budget > value * 1.1 && K.tierOf(id) >= K.tierOf(C().user) - 1).sort(() => Math.random() - 0.5);
        if (!buyers.length) return;
        const b = buyers[0], fee = Math.round((value * rnd(0.82, 1.15)) / 1000) * 1000;
        x.bids.push({ pid: p.id, from: b, fee, max: Math.round(value * rnd(1.08, 1.35)), round: 0 });
        K.news('rumour', `💬 Rumour: <b>${esc(tname(b))}</b> want <b>${esc(p.name)}</b>. A ${K.money(fee)} bid has landed on your desk (Transfers tab).`, { pid: p.id });
        post(pressAcct(), `${esc(tname(b))} have made an offer for ${esc(K.userTeam().name)}'s ${esc(p.name)}. Talks expected this week. 📝`, { kind: 'press' });
      });
      // a couple of rumours about the wider market
      for (let i = 0; i < 2; i++) {
        const stars = Object.values(C().players).filter((p) => p.team && p.team !== C().user && p.rating >= 84);
        const p = pick(stars); if (!p) break;
        const club = pick(Object.keys(C().teams).filter((id) => id !== p.team && id !== C().user && K.tierOf(id) >= 3));
        if (!club) break;
        K.news('rumour', `💬 Rumour: <b>${esc(tname(club))}</b> are said to be monitoring <b>${esc(p.name)}</b> (${esc(tname(p.team))}).`, { pid: p.id });
      }
    }
    K.save();
  }
  function onNewSeason() {
    const x = C().x;
    if (x.slotsNext) { x.slotsM = x.slotsNext.major; x.slotsW = x.slotsNext.worlds; x.slotsNext = null; }
    Object.values(C().players).forEach((p) => { p.r0 = p.rating; if (p.team === C().user) p.promiseBroken = false; });
    expectations();
    x.offers = []; x.lowBoard = C().board;
    if (mine()) post(clubAcct(C().user), `New season. Same hunger. 💪 ${hashTag('RLCS' + C().season)}`, { kind: 'club' });
  }
  /** Pre-season points expectation for each club (rank by OVR within the region), used by Manager of the Year. */
  function expectations() {
    const x = C().x; x.expPts = {};
    K.REGIONS.forEach((r) => {
      const ids = Object.keys(C().teams).filter((id) => C().teams[id].region === r).sort((a, b) => K.ovr(b) - K.ovr(a));
      ids.forEach((id, i) => (x.expPts[id] = Math.max(0, 90 - i * 9)));
    });
    if (mine()) { const ids = Object.keys(C().teams).filter((id) => C().teams[id].region === K.userTeam().region).sort((a, b) => K.ovr(b) - K.ovr(a)); x.expect = ids.indexOf(C().user) + 1; }
  }
  function onDeal(p, from, to, fee) {
    const R = rec();
    R.fees.push({ fee, name: p.name, from: tname(from), to: tname(to), season: C().season }); R.fees.sort((a, b) => b.fee - a.fee); R.fees = R.fees.slice(0, 10);
    if (R.fees[0].name === p.name && R.fees[0].fee === fee && fee >= 400000 && R.fees.length > 1) K.news('record', `📕 Record fee: <b>${esc(p.name)}</b> moves for ${K.money(fee)}, the most ever paid.`);
    if (fee >= 150000) post(clubAcct(to), `Welcome, ${esc(p.name)}! ✍️ ${pick(['The next chapter starts now.', 'Let\'s get to work.', 'Big things ahead.'])}`, { kind: 'club', big: fee >= 600000 });
    if (fee >= 300000) post(fanAcct(), pick([`${K.money(fee)} for ${esc(p.name)}?? market is insane`, `${esc(p.name)} to ${esc(tname(to))} is a scary roster ngl`, `${esc(tname(from))} fans in shambles rn`]), { kind: 'fan' });
    const cr = careerOf(p); const c = tname(to); if (!cr.clubs.includes(c)) cr.clubs.push(c);
  }
  function migrate() {
    const c = C(); if (!c) return;
    c.x = c.x || {};
    const x = c.x;
    x.know = x.know || {}; x.social = x.social || []; x.scout = x.scout || null;
    Object.values(c.players).forEach((p) => { persOf(p); if (p.r0 == null) p.r0 = p.rating; });
    if (!x.expPts) expectations();
    if (!x.scout) {
      x.scout = {}; K.REGIONS.forEach((r) => (x.scout[r] = 0)); x.scout[K.homeReg()] = 1;
      Object.values(c.players).forEach((p) => { const r = p.region || (p.team && c.teams[p.team] ? c.teams[p.team].region : null); if (p.age <= 23 && r === K.homeReg()) x.know[p.id] = 20 + Math.round(hash(p.id + 'k') * 25); });
    }
    if (mine()) mgr();
  }
  function onNew() {
    migrate();
    const x = C().x;
    if (mine()) post(pressAcct(), `OFFICIAL: ${esc(K.userTeam().name)} appoint a new manager ahead of RLCS ${C().season}. ✍️`, { kind: 'press', big: true });
    else post(pressAcct(), `RLCS ${C().season} is almost here. Who's lifting the trophy in the end? 👀`, { kind: 'press' });
    x.lowBoard = C().board;
  }

  /* ======================= scouting ======================= */
  const scoutNet = () => (C().x.scout || {});
  const SCOUT_COST = [0, 25000, 60000, 110000];
  function knowOf(p) { if (K.V()) return 100; return p.team === C().user ? 100 : Math.max(C().x.know[p.id] || 0, p.age > 23 ? 70 : 0); }
  /** Estimated potential range: narrows as your scouts learn about the player. */
  function potEst(p) {
    const kn = knowOf(p), w = Math.round(12 * (1 - kn / 100));
    const off = Math.round((hash(p.id + 'pe') - 0.5) * w);
    const mid = clamp(p.pot + off, p.rating, 99);
    return { lo: clamp(mid - w, p.rating, 99), hi: clamp(mid + w, p.rating, 99), mid, kn };
  }
  const stars = (v) => { const n = v >= 92 ? 5 : v >= 87 ? 4.5 : v >= 83 ? 4 : v >= 79 ? 3.5 : v >= 75 ? 3 : v >= 71 ? 2.5 : v >= 67 ? 2 : 1.5; return `<span class="x-stars" aria-label="${n} stars">${'★'.repeat(Math.floor(n))}${n % 1 ? '<i>★</i>' : ''}<em>${'★'.repeat(5 - Math.ceil(n))}</em></span>`; };
  function talentHTML() {
    const ui = K.api().state.ui, net = scoutNet(), reg = ui.trReg || 'all';
    const covered = K.V() ? K.REGIONS : K.REGIONS.filter((r) => net[r] > 0);
    const pool = Object.values(C().players).filter((p) => p.age <= 21 && p.team !== C().user && !(p.academy && p.academy === C().user)).filter((p) => { const r = p.region || (p.team && C().teams[p.team] ? C().teams[p.team].region : null); return covered.includes(r) && (reg === 'all' || r === reg); });
    const ranked = pool.map((p) => ({ p, e: potEst(p) })).filter((x) => x.e.kn >= 15 || K.V()).sort((a, b) => b.e.mid - a.e.mid || b.p.rating - a.p.rating).slice(0, 40);
    const sl = new Set(C().shortlist || []);
    const rows = ranked.map(({ p, e }, i) => {
      const club = p.team && C().teams[p.team] ? `${K.api().badge(K.teamObj(p.team), 'sm')}<span>${esc(tname(p.team))}</span>` : p.academy ? '<span>Academy prospect</span>' : '<span>Free agent</span>';
      return `<div class="x-tr-row${i < 3 ? ' top' : ''}"><span class="x-rk">${i + 1}</span>${K.avatar(p, 'sm')}<span class="x-tr-who"><b>${p.flag || ''} ${esc(p.name)}${p.wonder && e.kn >= 60 ? ' <span class="tag-hot">Wonderkid</span>' : ''}</b><small class="tcell">${club}</small></span>
        <span class="x-c">${p.age}</span><span class="x-c">${stars(p.rating)}<small>${p.rating}</small></span><span class="x-c">${stars(e.mid)}<small>${e.lo === e.hi ? e.lo : e.lo + '–' + e.hi}</small></span>
        <span class="x-kn" title="Scouting knowledge ${e.kn}%"><i style="width:${e.kn}%"></i></span>
        <span class="x-tr-act"><button class="btn sm" data-action="th-star" data-id="${p.id}" aria-pressed="${sl.has(p.id)}">${sl.has(p.id) ? '★' : '☆'}</button>${p.team || p.academy ? `<button class="btn sm" data-action="th-pick" data-v="scout" data-id="${p.id}">View</button>` : `<button class="btn sm" data-action="th-pick" data-v="fa" data-id="${p.id}">View</button>`}</span></div>`;
    }).join('');
    const netHtml = K.V() ? '' : `<section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Scouting network</h3><p class="help">Scouts watch players aged 23 or under in their region. Each level speeds up how fast they learn a player's true potential (the ranges narrow). Upkeep is $10k per level, paid at the end of the season.</p>
      <div class="x-net">${K.REGIONS.map((r) => { const lv = net[r] || 0; return `<div class="x-net-r"><b>${r}</b><span class="x-lv">${[1, 2, 3].map((n) => `<i class="${n <= lv ? 'f' : ''}"></i>`).join('')}</span><small>${lv ? ['', 'Part-time scout', 'Scouting team', 'Full network'][lv] : 'Not covered'}</small>${lv < 3 ? `<button class="btn sm" data-action="x-scout" data-v="${r}" ${K.userTeam().budget >= SCOUT_COST[lv + 1] ? '' : 'disabled'}>${lv ? 'Upgrade' : 'Hire'} · ${K.money(SCOUT_COST[lv + 1])}</button>` : '<span class="pill gold">Max</span>'}</div>`; }).join('')}</div></div></section>`;
    return `<div class="x-talent"><section class="fc-panel"><div class="fc-panel-body">
        <div class="sq-head"><h3 class="fc-h">Talent rankings</h3><span class="sq-meta">Top prospects aged 21 or under in the regions you scout · ranked by estimated potential</span></div>
        <div class="seg x-tr-reg">${[['all', 'All covered'], ...covered.map((r) => [r, r])].map(([k, v]) => `<button class="${k === reg ? 'active' : ''}" data-action="x-trreg" data-v="${k}">${v}</button>`).join('')}</div>
        ${covered.length ? `<div class="x-tr-row x-tr-head" aria-hidden="true"><span>#</span><span></span><span>Prospect</span><span class="x-c">Age</span><span class="x-c">Now</span><span class="x-c">Potential</span><span>Known</span><span></span></div>${rows || '<p class="muted">Your scouts are still compiling reports. Check back after the next event.</p>'}` : '<p class="muted">You have no scouts yet. Hire one below.</p>'}
      </div></section>${netHtml}</div>`;
  }

  /* ======================= negotiations ======================= */
  let NEG = null;
  function persAskMult(p) { const k = persOf(p); return k === 'mercenary' ? 1.22 : k === 'loyal' && p.team === C().user ? 0.88 : k === 'ambitious' && K.tierOf(C().user) <= 2 ? 1.12 : 1; }
  function startNeg(pid) {
    const p = C().players[pid], fa = !p.team;
    const seller = fa ? null : C().teams[p.team];
    const best = seller && seller.roster.map((id) => C().players[id]).filter(Boolean).sort((a, b) => b.rating - a.rating)[0];
    const need = fa ? 0 : Math.round(K.valueFor(p) * (best && best.id === p.id ? 1.25 : 1) * rnd(0.94, 1.12) * (p.contract <= 1 ? 0.85 : 1) / 1000) * 1000;
    const ask0 = K.askingSalary(p, C().user);
    const gap = K.minTierFor(p) - K.tierOf(C().user);
    const rel = (p.rating >= 85 && K.ovr(C().user) < (p.team ? K.ovr(p.team) : 80) - 8 ? 1.5 : 1) * (gap > 0 ? 1 + gap * K.diff().gap : 1);
    const want = Math.round(ask0 * rel * persAskMult(p) / 1000) * 1000;
    NEG = { pid, stage: fa ? 'player' : 'club', need, clubPat: 100, agentPat: 100, fee: fa ? 0 : Math.round(K.valueFor(p) / 1000) * 1000, counter: null, want, prefYears: p.age <= 21 ? 3 : p.age >= 27 ? 2 : 2, log: [] };
    drawNeg();
  }
  function drawNeg() {
    const n = NEG, p = C().players[n.pid], me = K.userTeam(), api = K.api();
    const k = persOf(p), P = PERS[k];
    const pat = (v) => `<span class="x-pat"><i style="width:${v}%" class="${v < 35 ? 'low' : ''}"></i></span>`;
    const log = n.log.map((l) => `<div class="x-neg-l ${l.c || ''}"><b>${esc(l.who)}</b> ${l.t}</div>`).join('');
    let body;
    if (n.stage === 'club') {
      body = `<div class="x-neg-step"><span class="on">1 · Club</span><span>2 · Player</span><span>3 · Done</span></div>
        <div class="x-neg-who">${api.badge(K.teamObj(p.team), 'md')}<div><b>${esc(tname(p.team))}</b><small>Patience</small>${pat(n.clubPat)}</div></div>
        <div class="field"><label for="ngFee">Your transfer fee offer</label><input class="input" type="number" id="ngFee" min="0" step="5000" value="${n.counter || n.fee}" /><p class="help">Market value about ${K.money(K.valueFor(p))}. ${p.contract <= 1 ? 'Contract ends this season: they may take less.' : ''} Lowballing costs patience; when it runs out they end the talks.</p></div>
        <div class="field"><label for="ngSellOn">Sell-on clause for ${esc(tname(p.team))}</label><select class="select" id="ngSellOn"><option value="0">None</option><option value="10">10% of a future sale</option><option value="20">20% of a future sale</option></select><p class="help">Sweetens the deal: each 10% is worth about 5% of the fee to them.</p></div>`;
    } else if (n.stage === 'player') {
      body = `<div class="x-neg-step"><span class="ok">1 · Club ✓</span><span class="on">2 · Player</span><span>3 · Done</span></div>
        <div class="x-neg-who">${K.avatar(p)}<div><b>${esc(p.name)}'s agent</b><small>${P.i} ${esc(P.n)} · ${esc(P.d)}</small><small>Patience</small>${pat(n.agentPat)}</div></div>
        <div class="form-grid">
          <div class="field"><label for="ngSal">Salary per season</label><input class="input" type="number" id="ngSal" min="0" step="1000" value="${n.counter ? n.counter.sal : Math.round(n.want * 0.95 / 1000) * 1000}" /></div>
          <div class="field"><label for="ngYears">Contract length</label><select class="select" id="ngYears">${[1, 2, 3].map((y) => `<option value="${y}" ${y === (n.counter ? n.counter.years : n.prefYears) ? 'selected' : ''}>${y} season${y > 1 ? 's' : ''}</option>`).join('')}</select></div>
          <div class="field"><label for="ngBonus">Signing bonus (one-off)</label><input class="input" type="number" id="ngBonus" min="0" step="5000" value="${n.counter ? n.counter.bonus : 0}" /></div>
          <div class="field"><label for="ngRole">Role promise</label><select class="select" id="ngRole"><option value="none">No promise</option><option value="starter" ${n.counter && n.counter.role === 'starter' ? 'selected' : ''}>Guaranteed starter</option></select></div>
          <div class="field"><label for="ngClause">Release clause</label><select class="select" id="ngClause"><option value="0">None</option><option value="1.5">1.5× value</option><option value="2.5">2.5× value</option></select></div>
        </div>
        <p class="help">The agent hints at about <b>${K.money(n.want)}</b> a season${n.prefYears === 3 ? ' and likes a longer deal' : ''}. A signing bonus counts for a lot. ${k === 'ambitious' ? 'A starting-spot promise matters to this player.' : ''}${k === 'mercenary' || k === 'ambitious' ? ' A release clause would appeal.' : ''} Break a promise later and morale suffers.</p>`;
    } else {
      body = `<div class="x-neg-step"><span class="ok">1 · Club ✓</span><span class="ok">2 · Player ✓</span><span class="on">3 · Done</span></div><p><b>${esc(p.name)}</b> has signed for ${esc(me.name)}. Welcome aboard! ✍️</p>`;
    }
    const foot = n.stage === 'done' ? `<button class="btn primary" data-action="career-market">To the transfer hub</button>`
      : `<button class="btn" data-action="career-market">Walk away</button>${n.counter && n.stage === 'club' ? `<button class="btn" data-action="x-neg-acc">Accept ${K.money(n.counter)}</button>` : ''}${n.counter && n.stage === 'player' ? `<button class="btn" data-action="x-neg-acc">Accept their terms</button>` : ''}<button class="btn primary" data-action="x-neg-go">${n.stage === 'club' ? 'Make offer' : 'Offer contract'}</button>`;
    api.openModal(`${api.modalHead('Negotiate: ' + p.name, `${p.flag || ''} ${esc(p.country || '')} · age ${K.ageLabel(p)} · OVR ${p.rating} · ${p.team ? esc(tname(p.team)) : 'free agent'} · your budget ${K.money(me.budget)}`)}
      <div class="modal-body x-neg">${body}${log ? `<div class="x-neg-log">${log}</div>` : ''}</div><div class="modal-foot">${foot}</div>`, { size: 'md', onClose: K.render });
  }
  function negGo(accept) {
    const n = NEG; if (!n) return;
    const p = C().players[n.pid], me = K.userTeam(), api = K.api();
    if (n.stage === 'club') {
      const fee = accept ? n.counter : Math.max(0, +document.getElementById('ngFee').value || 0);
      const sellOn = accept ? n.sellOn || 0 : +document.getElementById('ngSellOn').value;
      if (fee > me.budget) return api.toast('Not enough budget for that fee.');
      const eff = accept ? n.need : fee * (1 + sellOn / 200); // accepting their own counter always closes the club side
      n.fee = fee; n.sellOn = sellOn;
      if (eff >= n.need) { n.log.push({ who: tname(p.team) + ':', t: `“${K.money(fee)}${sellOn ? ' plus ' + sellOn + '% sell-on' : ''}. We have a deal. Talk to the player.”`, c: 'ok' }); n.stage = 'player'; n.counter = null; return drawNeg(); }
      const ratio = eff / n.need;
      n.clubPat -= ratio < 0.7 ? 45 : ratio < 0.85 ? 25 : 12;
      if (n.clubPat <= 0) { n.log.push({ who: tname(p.team) + ':', t: '“We are done here. He is not for sale to you.”', c: 'bad' }); C().x.negBlock = C().x.negBlock || {}; C().x.negBlock[n.pid] = C().season + '|' + C().step; K.save(); drawNeg(); setTimeout(() => { api.toast(tname(p.team) + ' ended the talks.'); K.openMarket(); }, 1200); return; }
      n.counter = Math.round(Math.max(n.need, (n.need * 1.12 + eff) / 2) / 1000) * 1000; // never below what they would accept
      n.log.push({ who: tname(p.team) + ':', t: ratio < 0.7 ? `“That is not a serious offer. We want ${K.money(n.counter)}.”` : `“Not enough. Make it ${K.money(n.counter)} and we can talk.”`, c: 'warn' });
      return drawNeg();
    }
    if (n.stage === 'player') {
      const t = accept ? n.counter : { sal: Math.max(0, +document.getElementById('ngSal').value || 0), years: +document.getElementById('ngYears').value, bonus: Math.max(0, +document.getElementById('ngBonus').value || 0), role: document.getElementById('ngRole').value, clause: +document.getElementById('ngClause').value };
      if (me.roster.length >= 4) return api.toast('Your roster is full (4).');
      if (n.fee + t.bonus + t.sal > me.budget) return api.toast('Not enough budget for the fee, bonus and first season of salary.');
      const k = persOf(p);
      let value = t.sal + (t.bonus / Math.max(1, t.years)) * 1.4;
      if (t.role === 'starter') value *= k === 'ambitious' ? 1.14 : k === 'showman' ? 1.08 : 1.04;
      if (t.clause) value *= k === 'mercenary' || k === 'ambitious' ? 1.07 : 1.02;
      if (t.years === n.prefYears) value *= 1.03;
      if (accept || value >= n.want * 0.97) return finishNeg(t);
      const ratio = value / n.want;
      n.agentPat -= ratio < 0.75 ? 40 : ratio < 0.9 ? 22 : 10;
      if (n.agentPat <= 0) { n.log.push({ who: 'Agent:', t: '“My client has other options. We are walking away.”', c: 'bad' }); C().x.negBlock = C().x.negBlock || {}; C().x.negBlock[n.pid] = C().season + '|' + C().step; K.save(); drawNeg(); setTimeout(() => { api.toast(p.name + ' turned you down.'); K.openMarket(); }, 1200); return; }
      const csal = Math.round(Math.max(t.sal, (n.want - (t.bonus / Math.max(1, t.years)) * 1.4) * (ratio < 0.85 ? 1.04 : 1)) / 1000) * 1000;
      n.counter = { sal: csal, years: t.years, bonus: t.bonus, role: t.role === 'starter' || k === 'ambitious' ? 'starter' : t.role, clause: t.clause || (k === 'mercenary' ? 1.5 : 0) };
      n.log.push({ who: 'Agent:', t: `“${ratio < 0.8 ? 'That is well below what my client is worth.' : 'We are close.'} ${K.money(csal)} a season${n.counter.role === 'starter' ? ', a starting spot' : ''}${n.counter.clause ? ', a release clause' : ''} and it is done.”`, c: 'warn' });
      return drawNeg();
    }
  }
  function finishNeg(t) {
    const n = NEG, p = C().players[n.pid], me = K.userTeam(), from = p.team;
    me.budget -= n.fee + t.bonus; C().seasonFin.transfers += n.fee + t.bonus;
    if (from) { C().teams[from].budget += n.fee; K.recordDeal(p, from, C().user, n.fee); }
    K.joinTeam(n.pid, C().user, t.sal, t.years);
    if (from) K.aiFill(from);
    p.promise = t.role === 'starter' ? 'starter' : null; p.promiseBroken = false;
    p.clause = t.clause ? Math.round(K.valueFor(p) * t.clause / 1000) * 1000 : 0;
    if (n.sellOn) p.sellOn = { club: from, pct: n.sellOn };
    if (!from) p.freeSigned = true;
    p.morale = Math.max(p.morale || 65, 74); p.wantsOut = false;
    if (n.fee >= 1000000) ach('big_buy');
    K.news('transfer', `<b>${esc(p.name)}</b> signs for ${esc(me.name)}${from ? ` from ${esc(tname(from))} for ${K.money(n.fee)}` : ' as a free agent'} · ${t.years}-year deal, ${K.money(t.sal)} a season${t.bonus ? ', ' + K.money(t.bonus) + ' signing bonus' : ''}${p.clause ? ', release clause ' + K.money(p.clause) : ''}${p.promise ? ', promised a starting spot' : ''}.`, { pid: p.id, from: from || null, to: C().user, fee: n.fee });
    post(playerAcct(p), pick(['New home. 🏠 Let\'s get to work.', 'Excited for this new chapter ✍️', 'Here to win. 🏆']), { kind: 'player', mood: 'good' });
    if (!from || n.fee < 150000) post(clubAcct(C().user), `Welcome, ${esc(p.name)}! ✍️`, { kind: 'club' });
    n.stage = 'done'; K.bump(); K.save();
    K.api().state.ui.thTab = 'squad'; K.api().state.ui.thSel = p.id;
    drawNeg();
  }
  /** Incoming bids for your players, shown at the top of the transfer hub during a window. */
  function bidsHTML() {
    if (!mine() || !K.isWindow()) return '';
    const bids = (C().x.bids || []).filter((b) => C().players[b.pid] && C().players[b.pid].team === C().user && C().teams[b.from]);
    if (!bids.length) return '';
    return `<section class="fc-panel x-bids"><div class="fc-panel-body"><h3 class="fc-h">Incoming offers <span class="pill warn">${bids.length}</span></h3>${bids.map((b) => { const p = C().players[b.pid]; return `<div class="x-bid">${K.avatar(p, 'sm')}<span><b>${esc(tname(b.from))}</b> offer <b>${K.money(b.fee)}</b> for ${esc(p.name)} <small>(value ${K.money(K.valueFor(p))}${p.wantsOut ? ' · wants to leave' : ''}${p.sellOn ? ' · ' + p.sellOn.pct + '% sell-on owed' : ''})</small></span>
      <span class="x-bid-act"><button class="btn sm primary" data-action="x-bid" data-v="acc" data-id="${b.pid}">Accept</button><button class="btn sm" data-action="x-bid" data-v="ctr" data-id="${b.pid}">Counter +15%</button><button class="btn sm" data-action="x-bid" data-v="rej" data-id="${b.pid}">Reject</button></span></div>`; }).join('')}</div></section>`;
  }
  function bidAct(pid, v) {
    const x = C().x, b = (x.bids || []).find((y) => y.pid === pid); if (!b) return;
    const p = C().players[pid], api = K.api();
    const drop = () => { x.bids = x.bids.filter((y) => y !== b); };
    if (v === 'rej') { drop(); moodShift(p, p.wantsOut ? -12 : 2, 'talk'); K.news('transfer', `You turn down ${esc(tname(b.from))}'s ${K.money(b.fee)} bid for <b>${esc(p.name)}</b>.`, { pid }); K.save(); return K.render(); }
    if (v === 'ctr') {
      const ask = Math.round(b.fee * 1.15 / 1000) * 1000;
      if (ask <= b.max && C().teams[b.from].budget >= ask) { b.fee = ask; api.toast(`${tname(b.from)} accept ${K.money(ask)}.`); v = 'acc'; }
      else { drop(); api.toast(`${tname(b.from)} walk away from the talks.`); K.news('transfer', `${esc(tname(b.from))} pull out of the race for <b>${esc(p.name)}</b> after your counter-offer.`, { pid }); K.save(); return K.render(); }
    }
    if (v === 'acc') {
      const me = K.userTeam(), bt = C().teams[b.from];
      let fee = b.fee; const owed = p.sellOn ? Math.round(fee * p.sellOn.pct / 100) : 0;
      if (owed && C().teams[p.sellOn.club]) C().teams[p.sellOn.club].budget += owed;
      me.budget += fee - owed; bt.budget -= fee;
      K.recordDeal(p, C().user, b.from, fee);
      K.joinTeam(pid, b.from, K.salaryFor(p.rating), ri(2, 3));
      p.promise = null; p.wantsOut = false; p.sellOn = null; p.clause = 0;
      drop();
      K.news('transfer', `<b>${esc(p.name)}</b> leaves for ${esc(tname(b.from))} for ${K.money(fee)}${owed ? ` (${K.money(owed)} sell-on paid)` : ''}.`, { pid, from: C().user, to: b.from, fee });
      K.bump(); K.save(); K.render();
    }
  }
  /** Release clauses: AI clubs trigger them when a player is worth much more. Runs when the window closes. */
  function onWindow() {
    if (!mine()) return;
    K.userTeam().roster.slice().forEach((pid) => {
      const p = C().players[pid]; if (!p || !p.clause) return;
      if (p.clause > K.valueFor(p) * 1.05 || Math.random() > 0.55) return;
      const buyer = Object.keys(C().teams).filter((id) => id !== C().user && C().teams[id].budget >= p.clause && K.tierOf(id) >= 3).sort((a, b) => K.ovr(b) - K.ovr(a))[0];
      if (!buyer) return;
      C().teams[buyer].budget -= p.clause; K.userTeam().budget += p.clause;
      K.recordDeal(p, C().user, buyer, p.clause);
      K.joinTeam(pid, buyer, K.salaryFor(p.rating), 3);
      K.news('transfer', `<span class="tag-hot">Release clause</span> ${esc(tname(buyer))} trigger <b>${esc(p.name)}</b>'s ${K.money(p.clause)} release clause. He is gone.`, { pid, from: C().user, to: buyer, fee: p.clause });
      p.clause = 0;
    });
    C().x.bids = [];
  }

  /* ======================= views ======================= */
  function tacticsHTML() {
    const t = tac(), me = K.userTeam(), x = C().x, api = K.api();
    const ro = me.roster.map((id) => C().players[id]).filter(Boolean);
    const id1 = identity(t), sb = squadBoost(false), tf = tacticFor('open').tactic;
    const pct = (v) => (v >= 1 ? '+' : '') + Math.round((v - 1) * 100) + '%';
    const setting = (k) => `<div class="x-set"><small>${TAC[k].l}</small><div class="seg">${Object.entries(TAC[k].o).map(([v, o]) => `<button class="${t[k] === v ? 'active' : ''}" data-action="x-tac" data-v="${k}|${v}">${esc(o[0])}</button>`).join('')}</div></div>`;
    const rivals = Object.keys(C().teams).filter((id) => id !== C().user && C().teams[id].region === me.region).sort((a, b) => K.ovr(b) - K.ovr(a)).slice(0, 8);
    const vs = (s) => (BEATS[id1].includes(s) ? ['Advantage', 'good'] : BEATS[s].includes(id1) ? ['Countered', 'bad'] : ['Even', '']);
    const talked = x.talk === C().season + '|' + C().step;
    const cards = ro.map((p, i) => `<div class="x-pl">${K.avatar(p)}<div class="x-pl-i"><b>${esc(p.name)}</b><small>${i < 3 ? 'Starter' : 'Sub'} · OVR ${p.rating}${p.promise ? ' · promised start' : ''}${p.wantsOut ? ' · <span class="x-out">wants out</span>' : ''}</small>${persChip(p)}<div class="x-pl-m">${moraleBar(p)}</div></div></div>`).join('');
    return `<div class="fc-grid2 x-tac">
      <section class="fc-panel"><div class="fc-panel-body">
        <div class="sq-head"><h3 class="fc-h">Tactics</h3><span class="x-ident">${esc(STYLES[id1].n)}</span></div>
        <p class="help">Your instructions apply in every event your team plays, live or simulated. Changing them costs familiarity, which builds back up with every event you play.</p>
        ${Object.keys(TAC).map(setting).join('')}
        <div class="x-fam"><small>Familiarity</small><span class="x-bar"><i style="width:${x.fam || 0}%"></i></span><b>${x.fam || 0}%</b></div>
        <div class="fc-stats x-eff"><div><small>Attack</small><b>${pct(tf.atk)}</b><span>chances created</span></div><div><small>Defence</small><b>${pct(2 - tf.def)}</b><span>chances conceded</span></div><div><small>Edge</small><b>${tf.str >= 0 ? '+' : ''}${tf.str.toFixed(1)}</b><span>team rating</span></div><div><small>Demos</small><b>×${tf.demo}</b><span>per game</span></div></div>
      </div></section>
      <section class="fc-panel"><div class="fc-panel-body">
        <h3 class="fc-h">Matchups</h3><p class="help">Each club has its own identity. ${esc(STYLES[id1].n)} beats ${BEATS[id1].map((s) => STYLES[s].n).join(' and ') || 'nobody in particular'}.</p>
        <div class="x-mu">${rivals.map((id) => { const s = aiStyle(id), [l, c] = vs(s); return `<div class="x-mu-r">${api.badge(K.teamObj(id), 'sm')}<span><b>${esc(tname(id))}</b><small>${esc(STYLES[s].n)} · OVR ${K.ovr(id)}</small></span><em class="${c}">${l}</em></div>`; }).join('')}</div>
      </div></section>
    </div>
    <section class="fc-panel"><div class="fc-panel-body">
      <div class="sq-head"><h3 class="fc-h">Dressing room</h3><span class="sq-meta">Squad effect ${sb.str >= 0 ? '+' : ''}${sb.str.toFixed(1)} · ${sb.parts.map(([l, v]) => esc(l) + ' ' + (v >= 0 ? '+' : '') + v.toFixed(1)).join(' · ') || 'no players'}</span></div>
      <div class="x-pls">${cards}</div>
      <div class="x-talk"><b>Team talk</b><small>${talked ? 'You have spoken to the squad. Next talk after the next event or window.' : 'Once per step. How each player reacts depends on their personality.'}</small>
        <div class="action-row">${[['encourage', 'Encourage'], ['demand', 'Demand more'], ['calm', 'Keep calm']].map(([k, l]) => `<button class="btn" data-action="x-talk" data-v="${k}" ${talked ? 'disabled' : ''}>${l}</button>`).join('')}</div></div>
    </div></section>`;
  }
  function managerHTML() {
    const m = mgr(), lvl = lvlOf(m.xp), next = xpFor(lvl + 1), cur = xpFor(lvl), f = Math.round(((m.xp - cur) / Math.max(1, next - cur)) * 100);
    const wr = m.w + m.l ? Math.round((m.w / (m.w + m.l)) * 100) : 0;
    return `<section class="fc-panel x-mgr"><div class="fc-panel-body">
      <div class="sq-head"><h3 class="fc-h">Manager career</h3><span class="x-ident">${esc(rankOf(lvl))}</span></div>
      <div class="x-mgr-top"><div class="x-lvl"><b>${lvl}</b><small>Level</small></div><div class="x-mgr-xp"><small>${m.xp} XP · ${next - m.xp} to level ${lvl + 1}</small><span class="x-bar"><i style="width:${f}%"></i></span>
        <small>Reputation</small><span class="x-bar rep"><i style="width:${m.rep}%"></i></span><small>${m.rep}/100 · ${m.rep >= 75 ? 'one of the most wanted managers in the world' : m.rep >= 55 ? 'big clubs know your name' : m.rep >= 35 ? 'a growing name' : 'still proving yourself'}</small></div></div>
      <div class="fc-stats"><div><small>Seasons</small><b>${m.seasons}</b></div><div><small>Series won</small><b>${m.w}</b><span>${wr}% win rate</span></div><div><small>Trophies</small><b>${m.titles}</b></div><div><small>Clubs</small><b>${m.clubs.length}</b><span>${m.clubs.map(esc).join(', ')}</span></div></div>
      <div class="tile-kicker" style="margin-top:14px">Achievements · ${m.ach.length}/${Object.keys(ACH).length}</div>
      <div class="x-ach">${Object.entries(ACH).map(([k, [n, d]]) => `<span class="x-a ${m.ach.includes(k) ? 'on' : ''}" title="${esc(d)}"><b>${m.ach.includes(k) ? '🏅' : '🔒'} ${esc(n)}</b><small>${esc(d)}</small></span>`).join('')}</div>
    </div></section>`;
  }
  function offersHTML() {
    const x = C().x; if (!mine() || !(x.offers || []).length || C().sacked) return '';
    return `<div class="tile-kicker" style="margin-top:12px">Job offers</div><p class="help">Your reputation (${mgr().rep}/100) has attracted interest. Taking a job moves you to the new club; your history and trophies stay with you.</p>
      <div class="team-grid">${x.offers.filter((id) => C().teams[id]).map((id) => { const tt = K.teamObj(id); return `<button class="browse-item" data-action="x-job" data-id="${id}">${K.api().badge(tt)}<span class="meta"><b>${esc(tt.name)}</b><small>${esc(K.api().regions[tt.region])} · OVR ${tt.ovr} · ${esc(K.tierName(K.tierOf(id)))}</small></span></button>`; }).join('')}</div>`;
  }
  function awardsButton() { const a = (C().x.awards || {})[C().season]; return a && a.length ? `<button class="fc-intro" data-action="x-awards" data-v="${C().season}">🏅 Watch the ${C().season} awards ceremony</button>` : ''; }
  function historyExtras() {
    const x = C().x, R = rec(), api = K.api();
    const hof = (x.hof || []);
    const onTrack = Object.values(C().players).filter((p) => p.cr && p.cr.s >= 1).map((p) => ({ p, s: hofScore(p) })).sort((a, b) => b.s - a.s).slice(0, 6);
    const hofHtml = `<section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">🏛️ Hall of Fame <span class="pill gold">${hof.length}</span></h3>
      ${hof.length ? `<div class="x-hof">${hof.map((h) => `<div class="x-hof-c"><span class="x-hof-p">${h.flag || ''}</span><b>${esc(h.name)}</b><small>Inducted ${h.season} · peak ${h.peak}</small><span class="x-hof-s">${h.t} titles${h.w ? ' · ' + h.w + '× world champ' : ''}${h.mvp ? ' · ' + h.mvp + '× MVP' : ''} · ${h.g} goals</span><small>${h.clubs.map(esc).join(' › ')}</small></div>`).join('')}</div>` : '<p class="muted" style="font-size:13px">No inductees yet. Great players are inducted when they retire.</p>'}
      ${onTrack.length ? `<div class="tile-kicker" style="margin-top:14px">On course for the Hall of Fame</div>${onTrack.map(({ p, s }) => `<div class="x-track"><span>${esc(p.name)} <small>${esc(p.team ? tname(p.team) : 'free agent')} · age ${p.age}</small></span><span class="x-bar"><i style="width:${Math.min(100, Math.round(s / HOF_BAR * 100))}%"></i></span><b>${Math.min(100, Math.round(s / HOF_BAR * 100))}%</b></div>`).join('')}` : ''}
    </div></section>`;
    const seasons = Object.keys(x.awards || {}).sort((a, b) => b - a);
    const awHtml = `<section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">🏅 Annual awards</h3>${seasons.length ? `<div class="table-wrap"><table class="st"><thead><tr><th class="l">Season</th><th class="l">MVP</th><th class="l">Young player</th><th class="l">Golden Boost</th><th class="l">Manager</th><th></th></tr></thead><tbody>${seasons.map((s) => { const a = x.awards[s], g = (k) => { const w = a.find((y) => y.key === k); return w ? esc(w.winner.name) + (w.winner.teamName && k !== 'mgr' ? ' <small>' + esc(w.winner.teamName) + '</small>' : k === 'mgr' ? ' <small>' + esc(w.winner.teamName) + '</small>' : '') : '—'; }; return `<tr><td class="l">${s}</td><td class="l">${g('mvp')}</td><td class="l">${g('young')}</td><td class="l">${g('scorer')}</td><td class="l">${g('mgr')}</td><td><button class="btn sm" data-action="x-awards" data-v="${s}">Ceremony</button></td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted" style="font-size:13px">The first awards are handed out at the end of this season.</p>'}</div></section>`;
    const t = Object.entries(R.titles).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
    const tw = Object.entries(R.titles).filter(([, v]) => v.worlds).sort((a, b) => b[1].worlds - a[1].worlds).slice(0, 5);
    const S = R.season;
    const row = (l, v) => `<div class="kv"><span>${l}</span><b>${v}</b></div>`;
    const sr = (k, unit) => (S[k] ? `${S[k].v} ${unit} · ${esc(S[k].name)}${S[k].team && S[k].team !== S[k].name ? ' (' + esc(S[k].team) + ')' : ''}, ${S[k].season}` : '—');
    const live = Object.values(C().players).filter((p) => p.cr).map((p) => [p.name, p.cr]);
    const careerAll = Object.entries(R.career).concat(live);
    const lead = (k) => { const b = careerAll.slice().sort((a, b) => (b[1][k] || 0) - (a[1][k] || 0))[0]; return b && b[1][k] ? `${b[1][k]} · ${esc(b[0])}` : '—'; };
    const recHtml = `<section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">📕 Record book</h3>
      <div class="fc-grid2 x-rec"><div><div class="tile-kicker">Most titles (this career)</div>${t.length ? t.map(([n, v], i) => row(`${i + 1}. ${esc(n)}`, `${v.total} <small>${v.worlds ? v.worlds + 'W · ' : ''}${v.majors ? v.majors + 'M · ' : ''}${v.opens} Opens</small>`)).join('') : '<p class="muted" style="font-size:13px">No titles yet.</p>'}
        ${tw.length ? `<div class="tile-kicker" style="margin-top:12px">World Championships</div>${tw.map(([n, v]) => row(esc(n), v.worlds + '×')).join('')}` : ''}</div>
        <div><div class="tile-kicker">Single season</div>${row('Most goals', sr('goals', 'goals'))}${row('Most assists', sr('assists', 'assists'))}${row('Most saves', sr('saves', 'saves'))}${row('Best average score', sr('avg', ''))}${row('Most circuit points', sr('teamPts', 'pts'))}
        <div class="tile-kicker" style="margin-top:12px">All time</div>${row('Career goals', lead('g'))}${row('Career titles', lead('t'))}${row('MVP awards', lead('mvp'))}${row('Highest rating', R.peak ? R.peak.v + ' · ' + esc(R.peak.name) + ', ' + R.peak.season : '—')}
        ${row('Youngest Major/Worlds champion', R.youngest ? R.youngest.v + ' · ' + esc(R.youngest.name) + ', ' + esc(R.youngest.title) : '—')}${row('Oldest Major/Worlds champion', R.oldest ? R.oldest.v + ' · ' + esc(R.oldest.name) : '—')}
        ${row('Record transfer', R.fees[0] ? K.money(R.fees[0].fee) + ' · ' + esc(R.fees[0].name) + ' to ' + esc(R.fees[0].to) + ', ' + R.fees[0].season : '—')}${row('Biggest upset', R.upsets[0] ? esc(R.upsets[0].w) + ' over ' + esc(R.upsets[0].l) + ' (' + R.upsets[0].gap + ' OVR), ' + esc(R.upsets[0].title) : '—')}</div></div>
    </div></section>`;
    return hofHtml + awHtml + recHtml;
  }
  function powerHTML() {
    const x = C().x, api = K.api(), REG = K.REGIONS, sm = K.slots().major, sw = K.slots().worlds;
    const last = (x.power || []).slice(-1)[0], prev = (x.power || []).slice(-2)[0];
    const live = {}; REG.forEach((r) => { const ids = Object.keys(C().teams).filter((id) => C().teams[id].region === r).map((id) => K.ovr(id)).sort((a, b) => b - a).slice(0, 8); live[r] = Math.round(ids.reduce((s, v) => s + v, 0) / Math.max(1, ids.length) * 10) / 10; });
    const order = REG.slice().sort((a, b) => live[b] - live[a]);
    const max = Math.max(...REG.map((r) => live[r])), min = Math.min(...REG.map((r) => live[r]));
    const hist = (x.power || []).slice(-8);
    return `<section class="fc-panel x-pow"><div class="fc-panel-body"><div class="sq-head"><h3 class="fc-h">Regional power</h3><span class="sq-meta">Top-8 team strength now · international results move Major and Worlds slots between regions at the end of each season</span></div>
      ${order.map((r, i) => { const tr = last && prev && last !== prev ? last.idx[r] - prev.idx[r] : 0; return `<div class="x-pow-r"><span class="x-rk">${i + 1}</span><b>${esc(api.regions[r])}</b><span class="x-bar"><i style="width:${Math.round(((live[r] - min + 2) / (max - min + 2)) * 100)}%"></i></span><span class="x-c">${live[r]}</span><span class="x-c ${tr > 0.4 ? 'up' : tr < -0.4 ? 'dn' : ''}">${tr > 0.4 ? '▲' : tr < -0.4 ? '▼' : '–'}</span><small>${sm[r]} Major · ${sw[r]} Worlds${x.slotsNext && x.slotsNext.major[r] !== sm[r] ? ` → <b>${x.slotsNext.major[r]}</b> next season` : ''}</small></div>`; }).join('')}
      ${hist.length > 1 ? `<div class="tile-kicker" style="margin-top:12px">Power index by season</div><div class="table-wrap"><table class="st"><thead><tr><th class="l">Region</th>${hist.map((h) => `<th>${h.season}</th>`).join('')}</tr></thead><tbody>${REG.map((r) => `<tr><td class="l">${r}</td>${hist.map((h) => `<td>${h.idx[r] != null ? h.idx[r] : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
    </div></section>`;
  }
  function thread(s) {
    const k = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n);
    return `<div class="x-thread">${(s.c || []).map((c) => `<div class="x-cmt${c.rival ? ' rival' : ''}"><span class="x-av sm" style="--c:${esc(c.a.c || '#475569')}">${esc((c.a.n || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 1).toUpperCase() || '?')}</span><div><header><b>${esc(c.a.n)}</b>${c.a.v ? '<i class="x-ver" title="Verified">✔</i>' : ''}<small>@${esc(c.a.h)} · ${esc(c.ago || '')}</small></header><small class="x-rep">Replying to @${esc(s.a.h)}</small><p>${esc(c.t)}</p><footer><span>♥ ${k(c.likes || 0)}</span></footer></div></div>`).join('')}
      <div class="x-thread-f"><small>Showing ${(s.c || []).length} of ${k(s.cn || (s.c || []).length)} comments · top first</small>${(s.c || []).length < 24 ? `<button class="btn sm" data-action="x-cmt-more" data-v="${s.id}">More comments</button>` : ''}</div></div>`;
  }
  function socialHTML() {
    const S = C().x.social || [];
    const ui = K.api().state.ui, open = new Set(ui.xOpen || []);
    let fix = false; S.forEach((s) => { if (!s.id) { C().x.sid = (C().x.sid || 0) + 1; s.id = C().x.sid; fix = true; } }); if (fix) K.save();
    const tags = {}; S.slice(0, 60).forEach((s) => (String(s.t).match(/#\w+/g) || []).forEach((h) => (tags[h] = (tags[h] || 0) + 1)));
    const trend = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const k = (n) => (n >= 10000 ? (n / 1000).toFixed(0) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n);
    return `<div class="fc-panel-body x-soc"><h3 class="fc-h">Social</h3>
      ${trend.length ? `<div class="x-trend"><small>Trending</small>${trend.map(([h, n]) => `<span>${esc(h)} <i>${n}</i></span>`).join('')}</div>` : ''}
      <div class="x-feed">${S.slice(0, 40).map((s) => `<article class="x-post ${s.mood || ''}"><span class="x-av" style="--c:${esc(s.a.c || '#475569')}">${esc((s.a.n || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 1).toUpperCase() || '?')}</span><div><header><b>${esc(s.a.n)}</b>${s.a.v ? '<i class="x-ver" title="Verified">✔</i>' : ''}<small>@${esc(s.a.h)} · ${esc(s.when)}</small></header><p>${s.t}</p>${s.poll ? `<div class="x-poll">${s.poll.map(([l, v], i) => `<div class="x-opt${i === s.poll.reduce((bi, x, j, a) => (x[1] > a[bi][1] ? j : bi), 0) ? ' top' : ''}"><i style="width:${v}%"></i><span>${esc(l)}</span><b>${v}%</b></div>`).join('')}<small>${k(s.votes || 0)} votes · final results</small></div>` : ''}<footer><button class="x-cbtn${open.has(s.id) ? ' on' : ''}" data-action="x-cmt" data-v="${s.id}" aria-expanded="${open.has(s.id)}">💬 ${k(s.cn || Math.round(s.rts * 0.6))}</button><span>🔁 ${k(s.rts)}</span><span>♥ ${k(s.likes)}</span></footer>${open.has(s.id) ? thread(s) : ''}</div></article>`).join('') || '<p class="muted">Nothing posted yet. Play an event to get people talking.</p>'}</div></div>`;
  }

  /* ======================= awards ceremony ======================= */
  let AW = null;
  const AW_META = { mvp: ['🏆', 'MVP'], young: ['🌱', 'Young player'], scorer: ['⚽', 'Golden Boost'], play: ['🎯', 'Playmaker'], wall: ['🧱', 'The Wall'], break: ['🚀', 'Breakout'], toty: ['⭐', 'Team of the Year'], mgr: ['📋', 'Manager'], club: ['🏟️', 'Club'] };
  /** Awards night, staged like the trophy ceremonies (js/ceremony.js); the old pop-up stays as a fallback. */
  function openAwards(season) {
    const list = (C().x.awards || {})[season]; if (!list || !list.length) return;
    if (global.RLCeremony && global.RLCeremony.awards) {
      const api = K.api();
      const person = (w, crest) => {
        const p = w.pid && C().players[w.pid];
        const t = w.team && C().teams[w.team] ? K.teamObj(w.team) : null;
        return { name: w.name, flag: w.flag || '', photo: p && K.photoOf ? K.photoOf(p) : null, badge: t ? api.badge(t, crest ? 'xl' : 'sm') : '', teamName: w.teamName || (t ? t.name : ''), stat: String(w.stat || ''), crest: !!crest, you: !K.V() && w.team === C().user };
      };
      const awards = list.map((a) => {
        const crest = a.key === 'mgr' || a.key === 'club', m = AW_META[a.key] || ['🏅', a.title];
        return { key: a.key, title: a.title, short: m[1], icon: m[0], blurb: a.blurb, nominees: (a.nominees || []).map((n) => person(n, crest)), winner: a.winner ? person(a.winner, crest) : null, team: a.team ? a.team.map((n) => person(n)) : null };
      });
      const mineCol = !K.V() && C().teams[C().user] ? C().teams[C().user].color : null;
      global.RLCeremony.awards({ season, kicker: 'RLCS ' + season + ' · Season awards', palette: { a: '#d4a017', b: '#0b0f22', c: '#fcd34d' }, mine: mineCol, awards }, () => K.render());
      return;
    }
    AW = { season, i: 0, shown: false, list };
    drawAwards();
  }
  function drawAwards() {
    const a = AW.list[AW.i], api = K.api(), last = AW.i === AW.list.length - 1;
    const card = (w, win) => `<div class="x-aw-n${win ? ' win' : ''}" style="--tc:${esc(w.color || '#1f8bff')}"><span class="x-aw-b">${w.team && C().teams[w.team] ? api.badge(K.teamObj(w.team), 'md') : ''}</span><b>${w.flag || ''} ${esc(w.name)}</b><small>${esc(w.teamName || '')}</small><em>${esc(String(w.stat || ''))}</em></div>`;
    let inner;
    if (a.team) inner = `<div class="x-aw-row toty">${a.team.map((w) => card(w, true)).join('')}</div>`;
    else inner = AW.shown ? `<div class="x-aw-win">${card(a.winner, true)}</div><div class="x-aw-row small">${a.nominees.filter((n) => n.name !== a.winner.name).map((w) => card(w)).join('')}</div>` : `<p class="x-aw-nom">The nominees are…</p><div class="x-aw-row">${a.nominees.map((w) => card(w)).join('')}</div>`;
    const reveal = !a.team && !AW.shown;
    api.openModal(`<div class="x-aw"><div class="x-aw-top"><span>RLCS ${AW.season} · Awards night</span><span>${AW.i + 1} / ${AW.list.length}</span></div>
      <h2 class="x-aw-t">${esc(a.title)}</h2><p class="x-aw-d">${esc(a.blurb || '')}</p>${inner}
      <div class="x-aw-foot"><button class="btn" data-action="close-modal">Close</button>${reveal ? '<button class="btn primary" data-action="x-aw-next">And the winner is… →</button>' : last ? '<button class="btn primary" data-action="close-modal">Finish</button>' : '<button class="btn primary" data-action="x-aw-next">Next award →</button>'}</div></div>`, { size: 'md', cls: 'x-aw-modal' });
    if (window.RLSfx) window.RLSfx.play(AW.shown ? 'goal' : 'hover');
  }
  function awNext() { const a = AW.list[AW.i]; if (!a.team && !AW.shown) { AW.shown = true; } else { AW.i++; AW.shown = false; } if (AW.i >= AW.list.length) { K.api().closeModal(); return; } drawAwards(); }

  /* ======================= actions ======================= */
  function onAction(a, el) {
    const v = el.dataset.v, id = el.dataset.id;
    switch (a) {
      case 'x-tac': { const [k, val] = v.split('|'); setTac(k, val); return true; }
      case 'x-talk': teamTalk(v); K.render(); return true;
      case 'x-scout': { const lv = (scoutNet()[v] || 0) + 1, cost = SCOUT_COST[lv]; if (K.userTeam().budget < cost) return true; K.userTeam().budget -= cost; C().x.scout[v] = lv; K.news('career', `🔭 Scouting: you ${lv === 1 ? 'hire a scout in' : 'expand your network in'} ${esc(K.api().regions[v])} (level ${lv}).`); K.save(); K.render(); return true; }
      case 'x-trreg': K.api().state.ui.trReg = v; K.render(); return true;
      case 'x-newscat': K.api().state.ui.newsCat = v; K.render(); return true;
      case 'x-cmt': case 'x-cmt-more': {
        const ui = K.api().state.ui, sid = +v, sp = (C().x.social || []).find((y) => y.id === sid); if (!sp) return true;
        const open = new Set(ui.xOpen || []);
        if (a === 'x-cmt-more') ensureComments(sp, true);
        else if (open.has(sid)) open.delete(sid); else { open.add(sid); ensureComments(sp); }
        ui.xOpen = [...open]; K.save();
        const y = window.scrollY, feed = document.querySelector('.x-feed'), fy = feed ? feed.scrollTop : 0;
        K.render();
        window.scrollTo({ top: y }); const f2 = document.querySelector('.x-feed'); if (f2) f2.scrollTop = fy;
        return true;
      }
      case 'x-neg-go': negGo(false); return true;
      case 'x-neg-acc': negGo(true); return true;
      case 'x-bid': bidAct(id, v); return true;
      case 'x-awards': openAwards(+v); return true;
      case 'x-aw-next': awNext(); return true;
      case 'x-job': { const old = K.userTeam().name; C().user = id; C().sacked = false; C().board = 55; C().x.offers = []; mgr().clubs.push(C().teams[id].name); mgr().rep = clamp(mgr().rep + 3, 0, 100); K.bump(); K.setObjectives(); K.news('career', `✍️ You leave ${esc(old)} and take over <b>${esc(C().teams[id].name)}</b>.`); post(pressAcct(), `OFFICIAL: ${esc(C().teams[id].name)} appoint the former ${esc(old)} manager. Big move. ✍️`, { kind: 'press', big: true }); expectations(); K.save(); K.render(); window.scrollTo({ top: 0 }); return true; }
    }
    return false;
  }

  global.RLCareerX = {
    attach(core) { K = core; },
    migrate, onNew, onEvent, onSide, onNation, onReview, onRetire, onStep, onNewSeason, onDeal, onWindow,
    tacticFor, negotiate: (pid) => {
      const b = C().x.negBlock && C().x.negBlock[pid];
      if (b && b === C().season + '|' + C().step) { K.api().toast('They are not willing to talk again during this window.'); return; }
      startNeg(pid);
    },
    blocked: (pid) => { const b = C().x && C().x.negBlock && C().x.negBlock[pid]; return !!(b && b === C().season + '|' + C().step); },
    persChip, moraleBar, persOf, potEst, knowOf,
    tacticsHTML, managerHTML, offersHTML, awardsButton, historyExtras, powerHTML, socialHTML, talentHTML, bidsHTML,
    kindLabel: (k) => KIND_LABEL[k] || 'News',
    newsCats: () => NEWS_CATS, newsIn,
    hasAwards: () => { const a = (C().x.awards || {})[C().season]; return !!(a && a.length); },
    awardsSeen: () => (C().x.awSeen || 0) >= C().season, markAwards: () => { C().x.awSeen = C().season; K.save(); }, openAwards,
    onAction,
  };
})(window);
