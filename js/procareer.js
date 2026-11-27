/* Player career: create your own pro and play a whole career as one player.
   Runs on top of the neutral-viewer career (every club is AI-run): you control your player's training, contract
   and transfers; the clubs pick the line-ups. Attached by js/career.js with RLPro.attach(core). */
(function (global) {
  'use strict';
  let K = null;
  const C = () => K.C;
  const esc = (s) => K.esc(s);
  const ic = (n) => global.RLIcon(n);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const PR = () => (C() && C().pro && !C().pro.retired ? C().pro : null);
  const me = () => C().players[C().pro.pid];

  const ATTRS = [['shooting', 'Shooting'], ['passing', 'Passing'], ['defending', 'Defending'], ['mechanics', 'Mechanics'], ['sense', 'Game sense'], ['boost', 'Boost control']];
  const POS = {
    striker: { name: 'Striker', blurb: 'First man in, finishes the chances. Strong shooting and mechanics.', plus: ['shooting', 'mechanics'] },
    playmaker: { name: 'Playmaker', blurb: 'Reads the play and sets up goals. Strong passing and game sense.', plus: ['passing', 'sense'] },
    anchor: { name: 'Anchor', blurb: 'Last man back, wins the boost war. Strong defending and boost control.', plus: ['defending', 'boost'] },
  };
  const INTENSITY = { light: ['Light', 0.65, 'Slower growth, better morale'], normal: ['Normal', 1, 'Balanced'], intense: ['Intense', 1.4, 'Faster growth, risk of fatigue'] };
  const MIGRATE = { EU: ['MENA', 'NA'], MENA: ['EU'], NA: ['EU'], SAM: ['NA', 'EU'], OCE: ['NA', 'EU'], APAC: ['OCE', 'MENA'], SSA: ['EU', 'MENA'] };
  const BIG = { major: 1, worlds: 1, ewc: 1, kickoff: 1 };

  const mean = (a) => ATTRS.reduce((s, [k]) => s + a[k], 0) / ATTRS.length;
  /** Rating = the average of the six attributes, never above the potential. */
  function syncRating() {
    const pr = C().pro, p = me();
    let m = mean(pr.attrs);
    if (m > p.pot) { const d = m - p.pot; ATTRS.forEach(([k]) => (pr.attrs[k] -= d)); m = p.pot; }
    ATTRS.forEach(([k]) => (pr.attrs[k] = clamp(pr.attrs[k], 40, 99.4)));
    p.rating = Math.round(mean(pr.attrs));
  }
  const social = () => (K.X() && K.X().social ? K.X().social : null);
  const teamName = (cid) => (C().teams[cid] ? C().teams[cid].name : 'Free agent');

  /* ---------------- creation ---------------- */
  function create(o) {
    const c = C(), pos = POS[o.pos] ? o.pos : 'striker';
    const base = 68;
    const attrs = {};
    ATTRS.forEach(([k]) => (attrs[k] = base - 2.4 + Math.random() * 1.6));
    POS[pos].plus.forEach((k) => (attrs[k] += 6));
    const shift = base + 0.3 - mean(attrs); ATTRS.forEach(([k]) => (attrs[k] += shift));
    const pid = K.addPlayer({ name: o.name, country: o.country, flag: global.RL_DATA.flagFor(o.country) || '', region: o.region, age: 17, ageKnown: true, rating: base, pot: ri(90, 96), curve: 'normal', contract: 0, pro: true });
    c.pro = { pid, pos, attrs, focus: POS[pos].plus[0], intensity: 'normal', fame: 0, morale: 70, earnings: 0, log: [], offers: [], offersKey: '', seasons: [], trophies: [], start: c.season, total: { gp: 0, g: 0, a: 0, sv: 0, score: 0, ev: 0 } };
    c.vreg = o.region;
    syncRating();
    firstOffers();
    K.news('career', `<b>${esc(o.name)}</b>, 17, from ${esc(o.country)} turns pro. Three ${esc(K.api().regions[o.region])} clubs want to sign the ${esc(POS[pos].name.toLowerCase())}.`);
    const S = social(); if (S) S.post(S.itkAcct(), `Hearing three clubs are chasing 17-year-old ${esc(o.name)} ${c.pro && me().flag ? me().flag : ''}. One to watch. 👀`, { kind: 'transfer' });
    K.save();
  }

  /* ---------------- line-ups and offers ---------------- */
  /** The club picks its best three as starters (your form counts a little). */
  function lineup(cid) {
    const t = C().teams[cid]; if (!t) return;
    const pr = C().pro;
    const val = (id) => { const p = C().players[id]; if (!p) return 0; return p.rating + (p.pro ? 0.5 + clamp((avgGrade(3) - 6.5) * 0.8, -1.5, 1.5) + (pr && pr.promise === C().season ? 3 : 0) : 0); };
    t.roster.sort((a, b) => val(b) - val(a));
    if (pr) pr.role = t.roster.indexOf(pr.pid) < 3 ? 'starter' : 'sub';
  }
  function avgGrade(n) {
    const L = (C().pro.log || []).filter((x) => x.gp > 0).slice(0, n);
    return L.length ? L.reduce((s, x) => s + x.grade, 0) / L.length : 6.5;
  }
  const roleIn = (cid) => {
    const t = C().teams[cid], p = me();
    const others = t.roster.filter((id) => id !== p.id).map((id) => C().players[id]).filter(Boolean).sort((a, b) => b.rating - a.rating);
    const kept = others.length >= 4 ? others.slice(0, 3) : others;
    return kept.filter((q) => q.rating > p.rating + 0.5).length < 3 ? 'Starter' : 'Substitute';
  };
  function offerFor(cid, starterOnly, promise) {
    const p = me(), role = promise ? 'Starter' : roleIn(cid);
    if (starterOnly && role !== 'Starter') return null;
    const sal = Math.round((K.salaryFor(p.rating) * rnd(1, 1.3) * (role === 'Starter' ? 1 : 0.8)) / 1000) * 1000;
    const fee = p.team && p.contract > 0 ? Math.round((K.valueFor(p) * rnd(0.95, 1.15)) / 1000) * 1000 : 0;
    return { cid, salary: sal, years: ri(1, 3), fee, role };
  }
  /** Your first contract: three mid-table clubs of your region that regularly reach the Opens, each promising a starting spot. */
  function firstOffers() {
    const c = C(), pr = c.pro;
    const ids = Object.keys(c.teams).filter((id) => c.teams[id].region === c.vreg && c.teams[id].roster.length >= 3).sort((a, b) => K.ovr(b) - K.ovr(a));
    const band = ids.length >= 60 ? ids.slice(7, 20) : ids.slice(3, 10);
    pr.offers = band.sort(() => Math.random() - 0.5).slice(0, 3).sort((a, b) => K.ovr(b) - K.ovr(a)).map((id) => Object.assign(offerFor(id, false, true), { salary: K.salaryFor(me().rating) + ri(0, 3) * 1000 }));
    pr.offersKey = c.season + '|' + c.step;
  }
  /** Offers at each transfer window (and always three when you are a free agent). */
  function genOffers(force) {
    const c = C(), pr = c.pro, p = me();
    const key = c.season + '|' + c.step;
    if (!force && pr.offersKey === key) return;
    pr.offersKey = key;
    pr.offers = (pr.offers || []).filter((o) => o.renewal);
    const free = !p.team;
    const home = p.team ? c.teams[p.team].region : c.vreg;
    const regs = [home].concat(p.rating >= 84 ? MIGRATE[home] || [] : []);
    const curO = p.team ? K.ovr(p.team) : 0;
    const form = avgGrade(4);
    let pool = Object.keys(c.teams).filter((id) => id !== p.team && regs.includes(c.teams[id].region) && c.teams[id].roster.length >= 3)
      .map((id) => ({ id, o: K.ovr(id), role: roleIn(id) }))
      .filter((x) => (free ? true : x.o >= curO - 1) && (x.role === 'Starter' || p.rating >= 84 || p.pot - p.rating >= 10));
    let n;
    if (free) {
      // a free agent always has options: the strongest clubs where you would start
      const st = pool.filter((x) => x.role === 'Starter').sort((a, b) => b.o - a.o);
      pool = st.slice(0, 6).sort(() => Math.random() - 0.5).slice(0, 3);
      if (pool.length < 3) pool = pool.concat(Object.keys(c.teams).filter((id) => c.teams[id].region === home && !pool.some((x) => x.id === id) && id !== p.team).map((id) => ({ id, o: K.ovr(id) })).sort((a, b) => a.o - b.o).slice(0, 3 - pool.length));
      n = 3;
    } else {
      const chance = clamp(0.18 + pr.fame / 400 + (form - 6.5) * 0.18 + (pr.listed ? 0.45 : 0) + (pr.role === 'sub' ? 0.25 : 0), 0.05, 0.95);
      pool = pool.sort((a, b) => b.o - a.o + rnd(-4, 4)).filter(() => Math.random() < chance).slice(0, 3);
      n = pool.length;
    }
    pool.slice(0, n).forEach((x) => { const o = offerFor(x.id); if (o) pr.offers.push(o); });
    if (!free && pr.offers.some((o) => !o.renewal)) K.news('transfer', `${pr.offers.filter((o) => !o.renewal).length === 1 ? 'A club has' : pr.offers.filter((o) => !o.renewal).length + ' clubs have'} made an offer for <b>${esc(p.name)}</b>. Check the Player tab.`, { pid: p.id });
  }
  function accept(i) {
    const c = C(), pr = c.pro, p = me(), o = pr.offers[i];
    if (!o) return;
    if (o.renewal) {
      p.contract = o.years; p.salary = o.salary; pr.expiring = false;
      pr.offers.splice(i, 1);
      K.news('transfer', `<b>${esc(p.name)}</b> signs a new ${o.years}-season deal with ${esc(teamName(p.team))} (${K.money(o.salary)}/yr).`, { pid: p.id });
    } else {
      const from = p.team, t = c.teams[o.cid];
      if (from && o.fee) { t.budget -= o.fee; c.teams[from].budget += o.fee; K.recordDeal(p, from, o.cid, o.fee); }
      if (t.roster.length >= 4) {
        const out = t.roster.map((id) => c.players[id]).filter((q) => q && !q.pro).sort((a, b) => a.rating - b.rating)[0];
        if (out) { K.removeFromTeam(out.id); c.fa.push(out.id); }
      }
      K.joinTeam(p.id, o.cid, o.salary, o.years);
      if (from) K.aiFill(from);
      c.vreg = t.region;
      pr.promise = o.role === 'Starter' ? c.season : null;
      pr.offers = []; pr.listed = false; pr.expiring = false; pr.morale = clamp(pr.morale + 10, 0, 100);
      pr.moves = (pr.moves || []).concat({ season: c.season, from: from ? teamName(from) : null, to: t.name, fee: o.fee });
      K.news('transfer', `${from ? '' : '✍️ '}<b>${esc(p.name)}</b> joins <b>${esc(t.name)}</b>${from ? ` from ${esc(teamName(from))}${o.fee ? ' for ' + K.money(o.fee) : ''}` : ''} on a ${o.years}-season deal (${K.money(o.salary)}/yr).`, { pid: p.id, to: o.cid, from, fee: o.fee });
      const S = social();
      if (S) { S.post(S.clubAcct(o.cid), `Welcome, ${esc(p.name)} ${p.flag || ''}! ✍️ ${o.role === 'Starter' ? 'Straight into the starting three.' : 'A big future here.'}`, { kind: 'transfer', big: o.fee > 100000 }); S.post(S.playerAcct(p), pick(['New chapter. Let\'s get to work. 🖤', 'Proud to sign here. Can\'t wait to play. 🙏', 'Dream move. Thank you for believing in me.']), { kind: 'fan' }); }
    }
    lineup(p.team);
    K.bump(); K.save();
  }

  /* ---------------- events ---------------- */
  /** Match grade: your score per game against the event's average (10 = best on the server), plus a bonus for a deep run. */
  function gradeOf(s, placeBonus, T) {
    if (!s || !s.gp) return null;
    const spg = s.score / s.gp;
    const all = Object.values((T && T.stats) || {}).filter((x) => x && x.gp);
    const avg = all.length ? all.reduce((a, x) => a + x.score / x.gp, 0) / all.length : 400;
    return Math.round(clamp(6.6 + (spg / avg - 1) * 7 + placeBonus, 3, 10) * 10) / 10;
  }
  /** Growth after an event: games played, performance, age, training intensity and how far from your ceiling. */
  function grow(gp, grade, dnq) {
    const pr = C().pro, p = me();
    const age = p.age <= 19 ? 1.25 : p.age <= 22 ? 1 : p.age <= 25 ? 0.6 : p.age <= 28 ? 0.3 : 0.1;
    const room = clamp((p.pot - mean(pr.attrs)) / 10, 0.1, 1);
    const play = gp ? 0.45 + Math.min(gp, 14) * 0.03 + ((grade || 6.5) - 6.5) * 0.18 : dnq ? 0.3 : 0.22;
    let g = Math.max(0.05, play) * age * room * INTENSITY[pr.intensity || 'normal'][1] * 0.6;
    if (pr.morale < 40) g *= 0.7;
    const m0 = mean(pr.attrs);
    ATTRS.forEach(([k]) => (pr.attrs[k] += k === pr.focus ? g * 2 * (pr.attrs[k] - m0 > 7 ? 0.35 : 1) : g * 0.75)); // a focus pays off, with diminishing returns once it stands out
    if (pr.intensity === 'intense' && Math.random() < 0.18) { pr.morale = clamp(pr.morale - 6, 0, 100); pr.tired = true; } else pr.tired = false;
    if (pr.intensity === 'light') pr.morale = clamp(pr.morale + 2, 0, 100);
    const old = p.rating; syncRating();
    if (p.rating > old) K.news('career', `📈 <b>${esc(p.name)}</b> improves to <b>${p.rating}</b> OVR.`, { pid: p.id });
  }
  function record(entry, st, champ) {
    const pr = C().pro, p = me();
    pr.log.unshift(entry); pr.log = pr.log.slice(0, 120);
    ['gp', 'g', 'a', 'sv', 'score'].forEach((k) => (pr.total[k] += entry[k] || 0));
    pr.total.ev++;
    const big = BIG[st.type] ? 2 : 1;
    if (entry.gp) pr.fame = clamp(pr.fame + ((entry.grade - 6.3) * 2.2 + 1) * big, 0, 1000);
    if (champ) { pr.trophies.push({ season: C().season, title: entry.title }); pr.fame = clamp(pr.fame + (st.type === 'worlds' ? 60 : big === 2 ? 25 : 8), 0, 1000); }
    pr.morale = clamp(pr.morale + (entry.gp ? (champ ? 10 : entry.grade >= 7.5 ? 4 : entry.grade < 5.5 ? -4 : 1) : -7), 0, 100);
  }
  function posts(entry, champ, st) {
    const S = social(), p = me(); if (!S) return;
    if (champ && entry.gp) S.post(S.playerAcct(p), pick([`WE DID IT 🏆 ${esc(entry.title)}`, 'Champions. Still can\'t believe it. 🏆', 'Dreamed of this since I was a kid. 🏆❤️']), { kind: 'fan', big: BIG[st.type] });
    else if (entry.gp && entry.grade >= 8.3) S.post(S.statsAcct(), `${esc(p.name)} at the ${esc(st.name)}: ${entry.g} goals, ${entry.a} assists, ${entry.sv} saves in ${entry.gp} games. Match grade ${entry.grade.toFixed(1)}. 📊`, { kind: 'press' });
    else if (entry.gp && entry.grade < 5.2 && Math.random() < 0.6) S.post(S.fanAcct(), pick([`${esc(p.name)} looked lost out there tbh`, `rough event for ${esc(p.name)}. still young though`]), { kind: 'fan' });
    else if (!entry.gp && Math.random() < 0.5) S.post(S.fanAcct(), `why is ${esc(p.name)} on the bench?? play the kid 😤`, { kind: 'fan' });
  }
  /** A 3v3 event finished (from applyEvent): your stats, grade, growth, prize share. */
  function onEvent(T, st, region, title, list, prize) {
    const pr = PR(); if (!pr) return;
    const p = me(); if (!p.team || !T.teams.includes(p.team)) return;
    const row = list.find((x) => x.id === p.team);
    const s = Object.values(T.stats || {}).find((x) => x && x.name === p.name && x.team === p.team);
    const champ = T.champion === p.team;
    const place = row ? row.place : 99;
    const grade = gradeOf(s, champ ? 0.6 : place <= 4 ? 0.3 : place >= 13 ? -0.3 : 0, T);
    const share = Math.round(((prize || 0) * 0.8) / 3);
    pr.earnings += share;
    const entry = { season: C().season, key: st.key, short: st.short, title, team: teamName(p.team), place, label: row ? K.placeLabel(place, list) : '—', gp: s ? s.gp : 0, g: s ? s.g : 0, a: s ? s.a : 0, sv: s ? s.sv : 0, score: s ? s.score : 0, grade: grade || 0, prize: share };
    record(entry, st, champ);
    grow(entry.gp, grade);
    posts(entry, champ, st);
    if (entry.gp && grade >= 8.5) K.news('result', `⭐ <b>${esc(p.name)}</b> is the standout at the ${esc(title)}: grade ${grade.toFixed(1)}, ${entry.g} goals.`, { pid: p.id });
    else if (!entry.gp) K.news('career', `<b>${esc(p.name)}</b> spent the ${esc(title)} on the bench.`, { pid: p.id });
  }
  /** 1v1 / 2v2: you are in if one of the entrants contains your player. */
  function onSide(T, st, region, title, list) {
    const pr = PR(); if (!pr) return;
    const ent = T.teams.find((id) => typeof id === 'string' && id.slice(5).split('.').includes(pr.pid));
    if (!ent) return;
    const row = list.find((x) => x.id === ent), champ = T.champion === ent;
    const entry = { season: C().season, key: st.key, short: st.short, title, team: (st.mode === 1 ? '1v1' : '2v2'), place: row ? row.place : 99, label: row ? K.placeLabel(row.place, list) : '—', gp: 0, g: 0, a: 0, sv: 0, score: 0, grade: 0, side: st.mode };
    pr.log.unshift(entry);
    if (champ) { pr.trophies.push({ season: C().season, title }); pr.fame = clamp(pr.fame + (st.type === 'sidew' ? 30 : 10), 0, 1000); K.news('trophy', `🏆 <b>${esc(me().name)}</b> wins the ${esc(title)}!`, { pid: pr.pid }); }
    else pr.fame = clamp(pr.fame + 2, 0, 1000);
  }
  /** National-team events: called up when you are one of your country's three best players. */
  function onNation(T, st, title, list) {
    const pr = PR(); if (!pr) return;
    const p = me(), id = 'c:~n:' + p.country;
    if (!T.teams.includes(id) || !K.nationPlayers(p.country).slice(0, 3).some((q) => q.id === p.id)) return;
    const row = list.find((x) => x.id === id), champ = T.champion === id;
    const s = Object.values(T.stats || {}).find((x) => x && x.name === p.name);
    const grade = gradeOf(s, champ ? 0.6 : 0, T);
    const entry = { season: C().season, key: st.key, short: st.short, title, team: (p.flag ? p.flag + ' ' : '') + p.country, place: row ? row.place : 99, label: row ? K.placeLabel(row.place, list) : '—', gp: s ? s.gp : 0, g: s ? s.g : 0, a: s ? s.a : 0, sv: s ? s.sv : 0, score: s ? s.score : 0, grade: grade || 0, nation: true };
    pr.caps = (pr.caps || 0) + 1;
    record(entry, st, champ);
    if (champ) K.news('trophy', `🏆 <b>${esc(p.name)}</b> is a national champion with ${esc(p.country)}!`, { pid: p.id });
  }

  /* ---------------- windows, seasons, contracts ---------------- */
  const EVENT_TYPES = { open: 1, kickoff: 1, major: 1, ewc: 1, worlds: 1 };
  function onStep() {
    const pr = PR(); if (!pr) return;
    // the event just played without your club: you train, more slowly than in competition
    const prev = K.SCHEDULE[C().step - 1];
    if (prev && EVENT_TYPES[prev.type] && me().team && !pr.log.some((x) => x.season === C().season && x.key === prev.key && !x.nation && !x.side)) {
      pr.log.unshift({ season: C().season, key: prev.key, short: prev.short, title: prev.name, team: teamName(me().team), place: 99, label: 'DNQ', gp: 0, g: 0, a: 0, sv: 0, score: 0, grade: 0, dnq: true });
      grow(0, null, true);
    }
    if (K.step().type === 'window') genOffers(false);
  }
  function afterWindow() { const pr = PR(); if (pr && me().team) lineup(me().team); }
  /** Called after season development: ageing changes the rating, spread over the attributes. */
  function afterDev() {
    const pr = PR(); if (!pr) return;
    const p = me(), d = p.rating - Math.round(mean(pr.attrs));
    const k = d > 0 ? 0.4 : 1; // young players mostly grow through events and training
    ATTRS.forEach(([a]) => (pr.attrs[a] += d * k));
    syncRating();
  }
  function onReview() {
    const pr = PR(); if (!pr) return;
    const p = me(), L = pr.log.filter((x) => x.season === C().season);
    const played = L.filter((x) => x.gp);
    pr.earnings += p.team ? p.salary : 0;
    pr.seasons.unshift({ season: C().season, team: teamName(p.team), age: p.age, rating: p.rating, gp: L.reduce((s, x) => s + x.gp, 0), g: L.reduce((s, x) => s + x.g, 0), a: L.reduce((s, x) => s + x.a, 0), sv: L.reduce((s, x) => s + x.sv, 0), grade: played.length ? Math.round((played.reduce((s, x) => s + x.grade, 0) / played.length) * 10) / 10 : 0, trophies: pr.trophies.filter((t) => t.season === C().season).length });
  }
  /** Your contract ran out (season review): your club may offer a new one. */
  function onExpire() {
    const pr = PR(); if (!pr) return;
    const p = me(); pr.expiring = true; p.contract = 0;
    const t = C().teams[p.team];
    const want = t && (pr.role === 'starter' || p.pot - p.rating >= 8);
    pr.offers = (pr.offers || []).filter((o) => !o.renewal);
    if (want) pr.offers.unshift({ cid: p.team, renewal: true, salary: Math.round((K.salaryFor(p.rating) * rnd(1.02, 1.2)) / 1000) * 1000, years: ri(1, 3), fee: 0, role: roleIn(p.team) });
    K.news('transfer', `<b>${esc(p.name)}</b>'s contract with ${esc(teamName(p.team))} has run out. ${want ? 'The club has offered a new deal.' : 'The club will not offer a new deal: he leaves when the new season starts.'}`, { pid: p.id });
  }
  function onNewSeason() {
    const pr = PR(); if (!pr) return;
    const p = me();
    if (pr.expiring && p.team) {
      const old = teamName(p.team), tm = p.team;
      K.removeFromTeam(p.id); K.aiFill(tm);
      pr.expiring = false;
      K.news('transfer', `<b>${esc(p.name)}</b> leaves ${esc(old)} as a free agent.`, { pid: p.id });
    }
    pr.offers = (pr.offers || []).filter((o) => !o.renewal);
    genOffers(true);
    if (p.team) lineup(p.team);
  }
  const needsClub = () => !!(PR() && !me().team);
  function retire() {
    const c = C(), pr = c.pro, p = me();
    pr.retired = { season: c.season, age: p.age, rating: p.rating, team: teamName(p.team) };
    if (p.team) { const tm = p.team; K.removeFromTeam(p.id); K.aiFill(tm); }
    p.retiredPro = true;
    K.news('career', `<b>${esc(p.name)}</b> retires at ${p.age} after ${c.season - pr.start + 1} seasons, ${pr.trophies.length} trophies and ${pr.total.g} goals. The career continues as a neutral viewer.`, { pid: p.id });
    const S = social(); if (S) S.post(S.playerAcct(p), 'It\'s time. Thank you to every teammate, coach and fan. This game gave me everything. ❤️', { kind: 'fan', big: true });
    K.bump(); K.save();
  }

  /* ---------------- views ---------------- */
  const gradeCls = (g) => (g >= 8 ? 'hi' : g >= 6.5 ? 'ok' : g > 0 ? 'lo' : 'na');
  const fameLabel = (f) => (f >= 600 ? 'Global superstar' : f >= 350 ? 'Star' : f >= 180 ? 'Established pro' : f >= 80 ? 'Rising talent' : f >= 25 ? 'Known in the region' : 'Unknown');
  const followers = (f) => { const n = Math.round(800 + f * f * 9 + f * 120); return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 100) / 10 + 'K' : String(n); };
  const potLabel = (p) => { const g = p.pot - p.rating; return p.pot >= 94 ? 'World class' : p.pot >= 90 ? 'Elite' : p.pot >= 86 ? 'High' : 'Good'; };
  function offerCard(o, i) {
    const t = K.teamObj(o.cid);
    if (!t) return '';
    return `<div class="pro-offer${o.renewal ? ' renew' : ''}">${K.api().badge(t, 'md')}<div class="pro-offer-t"><b>${esc(t.name)}</b><small>${o.renewal ? 'New contract' : esc(K.api().regions[C().teams[o.cid].region])} · OVR ${t.ovr} · ${esc(o.role)}</small><span>${K.money(o.salary)}/yr · ${o.years} season${o.years === 1 ? '' : 's'}${o.fee ? ' · fee ' + K.money(o.fee) : ''}</span></div>
      <div class="pro-offer-a"><button class="btn primary sm" data-action="pro-accept" data-v="${i}">${o.renewal ? 'Re-sign' : 'Sign'}</button>${me().team ? `<button class="btn sm" data-action="pro-decline" data-v="${i}">Decline</button>` : ''}</div></div>`;
  }
  function offersHTML() {
    const pr = C().pro;
    if (!pr.offers.length) return '';
    return `<div class="pro-offers"><div class="tile-kicker">${me().team ? 'Offers on the table' : 'Choose your club'}</div>${pr.offers.map(offerCard).join('')}</div>`;
  }
  /** The strip at the top of "Next up". */
  function nextHTML() {
    const pr = PR(); if (!pr) return '';
    const p = me();
    if (!p.team) return `<div class="pro-strip need"><b>${esc(p.name)} is a free agent.</b><small>Sign with one of these clubs to start the season.</small></div>${offersHTML()}`;
    const t = K.teamObj(p.team);
    const last = pr.log.find((x) => x.gp);
    return `<div class="pro-strip">${K.api().badge(t, 'sm')}<span><b>${esc(p.name)} · ${pr.role === 'sub' ? 'Substitute' : 'Starter'} at ${esc(t.name)}</b><small>OVR ${p.rating} · training ${esc(ATTRS.find((a) => a[0] === pr.focus)[1].toLowerCase())} (${esc(INTENSITY[pr.intensity][0].toLowerCase())})${last ? ` · last grade <i class="pro-g ${gradeCls(last.grade)}">${last.grade.toFixed(1)}</i>` : ''}</small></span><button class="btn xs" data-action="career-tab" data-v="player">Player</button></div>${pr.offers.length ? `<p class="help"><b>${pr.offers.length} offer${pr.offers.length === 1 ? '' : 's'}</b> waiting in the Player tab.</p>` : ''}`;
  }
  function chipHTML() {
    const pr = C().pro, p = me(), t = p.team ? K.teamObj(p.team) : null;
    return `<button class="fc-club pro-club" data-action="career-tab" data-v="player" title="Your player">${t ? K.api().badge(t, 'sm') : `<span class="pro-ini">${esc(String(p.name).slice(0, 2).toUpperCase())}</span>`}<span class="fc-club-name">${esc(p.name)}</span><span class="vw-sub">${pr.retired ? 'Retired' : t ? esc(t.tag || t.name) + ' · ' + p.rating : 'Free agent · ' + p.rating}</span></button>`;
  }
  function playerHTML() {
    const c = C(), pr = c.pro, p = me();
    const t = p.team ? K.teamObj(p.team) : null;
    const L = pr.log.filter((x) => x.season === c.season);
    const played = L.filter((x) => x.gp);
    const sum = (k) => L.reduce((s, x) => s + (x[k] || 0), 0);
    const avg = played.length ? played.reduce((s, x) => s + x.grade, 0) / played.length : 0;
    const head = `<section class="fc-panel pro-card">
        <div class="pro-id">${K.avatar(p, 'xl')}<div><span class="pro-pos">${esc(POS[pr.pos].name)}</span><h2>${p.flag || ''} ${esc(p.name)}</h2><small>Age ${p.age} · ${esc(p.country)} · ${pr.retired ? 'Retired ' + pr.retired.season : t ? esc(t.name) + ' · ' + (pr.role === 'sub' ? 'Substitute' : 'Starter') : 'Free agent'}</small></div></div>
        <div class="pro-nums"><div class="pro-ovr"><b>${p.rating}</b><small>OVR</small></div><div><b>${esc(potLabel(p))}</b><small>Potential</small></div><div><b>${followers(pr.fame)}</b><small>Followers · ${esc(fameLabel(pr.fame))}</small></div><div><b>${K.money(pr.earnings)}</b><small>Career earnings</small></div><div><b>${pr.morale}</b><small>Morale${pr.tired ? ' · tired' : ''}</small></div></div>
        ${t && !pr.retired ? `<div class="pro-contract">${K.api().badge(t, 'sm')}<span>Contract: <b>${p.contract > 0 ? p.contract + ' season' + (p.contract === 1 ? '' : 's') + ' left' : 'expiring'}</b> · ${K.money(p.salary)}/yr</span><button class="btn xs ${pr.listed ? 'primary' : ''}" data-action="pro-list">${pr.listed ? 'Transfer requested' : 'Request a transfer'}</button></div>` : ''}
      </section>`;
    if (pr.retired) return `<div class="pro">${head}${historyHTML()}</div>`;
    const train = `<section class="fc-panel pro-train"><h3 class="fc-h">Training</h3><p class="help">Pick a focus: that attribute grows fastest after every event. Playing time, good grades and youth speed it all up.</p>
      <div class="pro-attrs">${ATTRS.map(([k, l]) => { const v = pr.attrs[k]; return `<button class="pro-attr ${k === pr.focus ? 'on' : ''}" data-action="pro-focus" data-v="${k}" aria-pressed="${k === pr.focus}"><span>${l}${POS[pr.pos].plus.includes(k) ? ' <i>key</i>' : ''}</span><b>${Math.floor(v)}</b><em style="--w:${clamp((v - 40) / 59, 0, 1) * 100}%"></em></button>`; }).join('')}</div>
      <div class="pro-int"><small>Intensity</small><div class="seg">${Object.entries(INTENSITY).map(([k, [l]]) => `<button class="${k === pr.intensity ? 'active' : ''}" data-action="pro-int" data-v="${k}">${l}</button>`).join('')}</div><small class="muted">${esc(INTENSITY[pr.intensity][2])}</small></div></section>`;
    const season = `<section class="fc-panel pro-season"><h3 class="fc-h">Season ${c.season}</h3>
      <div class="pro-statrow"><div><b>${sum('gp')}</b><small>Games</small></div><div><b>${sum('g')}</b><small>Goals</small></div><div><b>${sum('a')}</b><small>Assists</small></div><div><b>${sum('sv')}</b><small>Saves</small></div><div><b>${avg ? avg.toFixed(1) : '—'}</b><small>Avg grade</small></div></div>
      <div class="tile-kicker" style="margin-top:12px">Recent events</div>
      ${pr.log.slice(0, 8).map((x) => `<div class="pro-log"><span><b>${esc(x.short)}</b><small>${x.season} · ${esc(x.team)}</small></span><span class="pro-place">${esc(x.label)}</span><span class="pro-line">${x.side ? (x.side === 1 ? '1v1' : '2v2') : x.dnq ? 'Did not qualify · training' : x.gp ? `${x.gp} GP · ${x.g}G ${x.a}A ${x.sv}S` : 'Bench'}</span><i class="pro-g ${gradeCls(x.grade)}">${x.grade ? x.grade.toFixed(1) : '—'}</i></div>`).join('') || '<p class="help">No events played yet.</p>'}</section>`;
    const retireBtn = p.age >= 30 ? `<div class="action-row"><button class="btn" data-action="pro-retire">Retire from playing</button></div>` : '';
    return `<div class="pro">${head}${offersHTML() ? `<section class="fc-panel">${offersHTML()}</section>` : ''}<div class="pro-grid">${train}${season}</div>${historyHTML()}${retireBtn}</div>`;
  }
  function historyHTML() {
    const pr = C().pro;
    const tot = pr.total;
    const rows = pr.seasons.map((s) => `<tr><td class="l"><b>${s.season}</b></td><td class="l">${esc(s.team)}</td><td>${s.age}</td><td>${s.rating}</td><td>${s.gp}</td><td>${s.g}</td><td>${s.a}</td><td>${s.sv}</td><td>${s.grade ? s.grade.toFixed(1) : '—'}</td><td>${s.trophies || ''}</td></tr>`).join('');
    return `<section class="fc-panel pro-hist"><h3 class="fc-h">Career</h3>
      <div class="pro-statrow"><div><b>${tot.ev}</b><small>Events</small></div><div><b>${tot.gp}</b><small>Games</small></div><div><b>${tot.g}</b><small>Goals</small></div><div><b>${tot.a}</b><small>Assists</small></div><div><b>${tot.sv}</b><small>Saves</small></div><div><b>${pr.caps || 0}</b><small>Caps</small></div></div>
      ${pr.trophies.length ? `<div class="tile-kicker" style="margin-top:12px">Trophies · ${pr.trophies.length}</div><div class="pro-troph">${pr.trophies.slice().reverse().map((x) => `<span>${ic('trophy')} ${esc(x.title)}</span>`).join('')}</div>` : ''}
      ${rows ? `<div class="table-wrap" style="margin-top:12px"><table class="st"><thead><tr><th class="l">Season</th><th class="l">Club</th><th>Age</th><th>OVR</th><th>GP</th><th>G</th><th>A</th><th>S</th><th>Grade</th><th>Titles</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="help" style="margin-top:10px">Finished seasons appear here.</p>'}
    </section>`;
  }

  /* ---------------- creation screen ---------------- */
  function creatorHTML() {
    const ui = K.api().state.ui, f = ui.proForm || (ui.proForm = { name: '', region: 'EU', country: '', pos: 'striker' });
    const countries = Array.from(new Set(K.ROOKIE_COUNTRIES[f.region] || [])).sort();
    if (!countries.includes(f.country)) f.country = countries[0];
    const flag = global.RL_DATA.flagFor(f.country) || '';
    return `<div class="cs pro-new">
      <div class="cs-title"><button class="btn sm" data-action="pro-cancel">${ic('left')} Back</button><h1>Create your player</h1><span class="muted">Player career · RLCS ${C() ? C().season : 2027}</span></div>
      <div class="pro-new-grid">
        <section class="fc-panel pro-new-form">
          <label class="field"><span class="field-label">Player name</span><input class="input" id="proName" maxlength="16" placeholder="Your gamertag" value="${esc(f.name)}" autocomplete="off" /></label>
          <div class="field"><span class="field-label">Region</span><div class="seg">${K.REGIONS.map((r) => `<button class="${r === f.region ? 'active' : ''}" data-action="pro-form" data-k="region" data-v="${r}" title="${esc(K.api().regions[r])}">${r}</button>`).join('')}</div></div>
          <label class="field"><span class="field-label">Nationality</span><select class="input" id="proCountry">${countries.map((x) => `<option ${x === f.country ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
          <div class="field"><span class="field-label">Position</span><div class="pro-pos-pick">${Object.entries(POS).map(([k, o]) => `<button class="${k === f.pos ? 'on' : ''}" data-action="pro-form" data-k="pos" data-v="${k}" aria-pressed="${k === f.pos}"><b>${o.name}</b><small>${o.blurb}</small></button>`).join('')}</div></div>
        </section>
        <aside class="fc-panel pro-new-card">
          <div class="pro-new-badge"><span class="pro-ini xl">${esc((f.name || '??').slice(0, 2).toUpperCase())}</span></div>
          <h2>${flag} ${esc(f.name || 'Your name')}</h2>
          <p class="muted">17 years old · ${esc(f.country)} · ${esc(POS[f.pos].name)}</p>
          <div class="pro-new-facts"><span><b>68</b><small>Starting OVR</small></span><span><b>90+</b><small>Potential</small></span><span><b>3</b><small>Club offers</small></span></div>
          <p class="help">Start as a 17-year-old free agent with offers from three ${esc(K.api().regions[f.region])} clubs. Train, earn your place in the starting three, move to bigger clubs and chase the world title. Small nations make the national team sooner.</p>
          <button class="btn primary cs-go" data-action="pro-start">Start player career ${ic('right')}</button>
        </aside>
      </div></div>`;
  }
  function bindCreator(app) {
    const ui = K.api().state.ui, f = ui.proForm;
    const n = app.querySelector('#proName'); if (n) n.addEventListener('input', () => { f.name = n.value.replace(/[<>&"]/g, ''); const h = app.querySelector('.pro-new-card h2'); if (h) h.textContent = (global.RL_DATA.flagFor(f.country) || '') + ' ' + (f.name || 'Your name'); const b = app.querySelector('.pro-new-badge .pro-ini'); if (b) b.textContent = (f.name || '??').slice(0, 2).toUpperCase(); });
    const s = app.querySelector('#proCountry'); if (s) s.addEventListener('change', () => { f.country = s.value; K.render(); });
  }

  function onAction(a, el) {
    const v = el.dataset.v, ui = K.api().state.ui;
    switch (a) {
      case 'pro-new': ui.proNew = true; ui.proForm = null; K.render(); window.scrollTo({ top: 0 }); return true;
      case 'pro-cancel': ui.proNew = false; K.render(); return true;
      case 'pro-form': ui.proForm[el.dataset.k] = v; K.render(); return true;
      case 'pro-start': {
        const f = ui.proForm, name = String(f.name || '').trim();
        if (name.length < 2) { K.api().toast('Give your player a name (at least two characters).'); const n = document.getElementById('proName'); if (n) n.focus(); return true; }
        if (Object.values(global.RL_DATA.teams || []).some((t) => (t.players || []).some((p) => p.name.toLowerCase() === name.toLowerCase()))) { K.api().toast('That name belongs to a real pro. Pick another one.'); return true; }
        K.newCareer(null, 'normal', f.region);
        create({ name, country: f.country, region: f.region, pos: f.pos });
        ui.proNew = false; ui.ctab = 'central'; ui.cview = 'next';
        K.api().go('career'); return true;
      }
      case 'pro-accept': accept(+v); K.render(); return true;
      case 'pro-decline': { const pr = C().pro, o = pr.offers[+v]; pr.offers.splice(+v, 1); if (o && o.renewal) K.news('transfer', `<b>${esc(me().name)}</b> turns down a new contract: he will leave ${esc(teamName(me().team))} when the season ends.`, { pid: pr.pid }); K.save(); K.render(); return true; }
      case 'pro-focus': C().pro.focus = v; K.save(); K.render(); return true;
      case 'pro-int': C().pro.intensity = v; K.save(); K.render(); return true;
      case 'pro-list': { const pr = C().pro; pr.listed = !pr.listed; pr.morale = clamp(pr.morale + (pr.listed ? -3 : 2), 0, 100); if (pr.listed) K.news('transfer', `<b>${esc(me().name)}</b> asks ${esc(teamName(me().team))} for a transfer. Clubs will hear about it at the next window.`, { pid: pr.pid }); K.save(); K.render(); return true; }
      case 'pro-retire': {
        K.api().openModal(`<div class="modal-head"><h2>Retire ${esc(me().name)}?</h2></div><div class="modal-body"><p>Your playing career ends here. The season carries on and you keep watching as a neutral viewer; your career record stays in the Player tab.</p></div><div class="modal-foot"><button class="btn" data-action="close-modal">Keep playing</button><button class="btn primary" data-action="pro-retire-ok">Retire</button></div>`);
        return true;
      }
      case 'pro-retire-ok': K.api().closeModal(); retire(); K.render(); return true;
    }
    return false;
  }

  global.RLPro = {
    attach(core) { K = core; },
    active: () => !!PR(), any: () => !!(C() && C().pro), isPro: (p) => !!(p && p.pro && !p.retiredPro),
    onEvent, onSide, onNation, onStep, afterWindow, afterDev, onReview, onExpire, onNewSeason, needsClub, lineup,
    nextHTML, chipHTML, playerHTML, creatorHTML, bindCreator, onAction,
    name: () => (C() && C().pro ? me().name : ''),
  };
})(window);
