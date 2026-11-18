/* RL Esports Simulator — Career mode.
 * You run one organisation through RLCS-style seasons:
 *   Pre-season window → Opens 1-3 → Major 1 → Mid-season window → Opens 4-6 → Major 2 → World Championship → Season review.
 * Every region plays every Open; circuit points decide Major and Worlds slots; events pay prize money.
 * Rosters, ratings, ages, contracts and budgets live in the career save (separate from the library).
 */
(function (global) {
  'use strict';
  const KEY = 'rlsim.career.v1';
  let api, E, C = null, teamCache = {}, cacheVer = 0;

  const REGIONS = ['EU', 'NA', 'SAM', 'MENA', 'OCE', 'APAC', 'SSA'];
  const MAJOR_SLOTS = { EU: 5, NA: 4, SAM: 2, MENA: 2, OCE: 1, APAC: 1, SSA: 1 };
  const WORLDS_SLOTS = { EU: 6, NA: 5, SAM: 3, MENA: 3, OCE: 1, APAC: 1, SSA: 1 };
  const CITIES = ['Copenhagen', 'Sydney', 'Riyadh', 'Los Angeles', 'London', 'Rio de Janeiro', 'Berlin', 'Tokyo', 'Dallas', 'Madrid', 'Toronto', 'Stockholm', 'Seoul', 'Mexico City'];
  const WORLDS_CITIES = ['Fort Worth', 'Paris', 'Lyon', 'Boston', 'Riyadh', 'London', 'Sydney', 'Las Vegas'];
  const SCHEDULE = [
    { key: 'pre', type: 'window', name: 'Pre-season transfer window', short: 'Window' },
    { key: 'o1', type: 'open', name: 'Open 1', split: 1, short: 'Open 1' },
    { key: 'o2', type: 'open', name: 'Open 2', split: 1, short: 'Open 2' },
    { key: 'o3', type: 'open', name: 'Open 3', split: 1, short: 'Open 3' },
    { key: 'm1', type: 'major', name: 'Major 1', split: 1, short: 'Major 1' },
    { key: 'mid', type: 'window', name: 'Mid-season transfer window', short: 'Window' },
    { key: 'o4', type: 'open', name: 'Open 4', split: 2, short: 'Open 4' },
    { key: 'o5', type: 'open', name: 'Open 5', split: 2, short: 'Open 5' },
    { key: 'o6', type: 'open', name: 'Open 6', split: 2, short: 'Open 6' },
    { key: 'm2', type: 'major', name: 'Major 2', split: 2, short: 'Major 2' },
    { key: 'w', type: 'worlds', name: 'World Championship', short: 'Worlds' },
    { key: 'review', type: 'review', name: 'Season review', short: 'Review' },
  ];
  const POINTS = {
    open: [12, 10, 8, 8, 6, 6, 6, 6, 3, 3, 3, 3, 1, 1, 1, 1],
    major: [30, 24, 18, 18, 12, 12, 8, 8, 5, 5, 5, 5, 3, 3, 3, 3],
  };
  const PRIZE = {
    open: [30000, 18000, 10000, 10000, 5000, 5000, 5000, 5000, 1500, 1500, 1500, 1500, 500, 500, 500, 500],
    major: [150000, 80000, 50000, 50000, 30000, 30000, 20000, 20000, 10000, 10000, 10000, 10000, 5000, 5000, 5000, 5000],
    worlds: [300000, 153000, 99000, 99000, 84000, 84000, 66000, 66000, 37500, 37500, 37500, 37500, 17250, 17250, 17250, 17250, 9000, 9000, 6000, 6000],
  };
  const ROOKIE_COUNTRIES = { EU: ['France', 'Spain', 'England', 'Germany', 'Netherlands', 'Belgium', 'Denmark', 'Poland', 'Portugal', 'Italy'], NA: ['United States', 'Canada', 'Mexico'], SAM: ['Brazil', 'Argentina', 'Chile', 'Uruguay'], MENA: ['Saudi Arabia', 'Morocco', 'Kuwait', 'Egypt', 'United Arab Emirates'], OCE: ['Australia', 'New Zealand'], APAC: ['Japan', 'South Korea', 'Thailand', 'Singapore', 'Malaysia'], SSA: ['South Africa', 'Namibia'] };
  const SYL1 = ['Ze', 'Ka', 'Vo', 'Ry', 'Ni', 'Lu', 'Ax', 'Bre', 'Ce', 'Da', 'Fi', 'Jo', 'Ky', 'Mi', 'No', 'Py', 'Sa', 'Ty', 'Va', 'Xe', 'Ko', 'Ar', 'El', 'Gu', 'Ha', 'Ji', 'Re', 'Sk', 'Tr', 'Wy'];
  const SYL2 = ['r', 'n', 'l', 'x', 'z', 'k', 'v', 'th', 'sh', '', 'dr', 'mm', 'ss'];
  const SYL3 = ['o', 'a', 'ix', 'en', 'ar', 'us', 'yn', 'ie', 'eo', 'an', 'ex', 'y', 'i', 'el', 'ox'];

  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
  /* ---------- real ages (birth dates from Liquipedia player pages, js/births.js) ---------- */
  const SNAP = { y: 2026, m: 11, d: 18 }; // ages are as of the 2027 season start (data snapshot)
  function bornOf(name, country) { const B = global.RL_BIRTHS || {}; return B[name + '|' + (country || '')] || null; }
  function ageFromBorn(born) {
    const [y, m, d] = born.split('-').map((x) => parseInt(x, 10));
    if (!y) return null;
    if (!m) return SNAP.y - y; // year only: best estimate
    return SNAP.y - y - (m > SNAP.m || (m === SNAP.m && (d || 1) > SNAP.d) ? 1 : 0);
  }
  /** "22" for real or generated players, "~22" when the age is an estimate (no birth date on Liquipedia) */
  const ageLabel = (p) => (p.ageKnown === false ? '~' : '') + p.age;
  const money = (n) => (n < 0 ? '-' : '') + '$' + (Math.abs(n) >= 1e6 ? (Math.abs(n) / 1e6).toFixed(2) + 'M' : Math.abs(n) >= 1000 ? Math.round(Math.abs(n) / 1000) + 'k' : Math.round(Math.abs(n)));
  const salaryFor = (r) => Math.max(5000, Math.round((Math.pow(Math.max(0, r - 55), 2) * 60) / 1000) * 1000);
  function valueFor(p) {
    const ageF = p.age <= 20 ? 1.5 : p.age <= 23 ? 1.25 : p.age <= 26 ? 1 : p.age <= 28 ? 0.75 : 0.5;
    return Math.max(2000, Math.round((salaryFor(p.rating) * 2.2 * ageF + Math.max(0, p.pot - p.rating) * 3000) / 1000) * 1000);
  }

  /* ---------------- persistence ---------------- */
  function load() { try { const raw = localStorage.getItem(KEY); C = raw ? JSON.parse(raw) : null; } catch (e) { C = null; } fixAges(); bump(); }
  /** Older saves used generated ages: replace them with real ones, rolled forward by the seasons already played. */
  function fixAges() {
    if (!C || C.agesV2) return;
    const lib = new Set((((global.RL_DATA || {}).teams) || []).concat(((global.RL_DATA27 || {}).teams) || []).flatMap((t) => t.players.map((p) => p.name + '|' + (p.country || ''))));
    Object.values(C.players).forEach((p) => {
      const born = bornOf(p.name, p.country);
      const a = born ? ageFromBorn(born) : null;
      if (a != null) { p.age = a + (C.season - 2027); p.born = born; p.ageKnown = true; }
      else if (lib.has(p.name + '|' + (p.country || ''))) p.ageKnown = false;
    });
    C.agesV2 = true;
    save();
  }
  function save() { try { if (C) localStorage.setItem(KEY, JSON.stringify(C)); else localStorage.removeItem(KEY); } catch (e) { /* storage full or blocked */ } }
  function bump() { cacheVer++; teamCache = {}; }

  /* ---------------- teams & players ---------------- */
  function teamObj(cid) {
    if (!C || !C.teams[cid]) return null;
    if (teamCache[cid]) return teamCache[cid];
    const t = C.teams[cid];
    const players = t.roster.map((pid) => C.players[pid]).filter(Boolean).map((p) => ({ name: p.name, country: p.country, flag: p.flag, rating: p.rating, pid: p.id }));
    while (players.length < 3) players.push({ name: 'Stand-in ' + (players.length + 1), rating: 55, flag: '' });
    const obj = { id: cid, name: t.name, tag: t.tag, region: t.region, color: t.color, players, career: true };
    obj.ovr = Math.round(E.teamStrength(obj));
    teamCache[cid] = obj;
    return obj;
  }
  const ovr = (cid) => (teamObj(cid) ? teamObj(cid).ovr : 0);
  const userTeam = () => C.teams[C.user];
  const regionTeams = (reg) => Object.keys(C.teams).filter((id) => C.teams[id].region === reg);
  const step = () => SCHEDULE[C.step];
  const isWindow = () => step().type === 'window';

  function newName() {
    for (let i = 0; i < 50; i++) {
      const n = pick(SYL1) + pick(SYL2) + pick(SYL3);
      if (!Object.values(C.players).some((p) => p.name.toLowerCase() === n.toLowerCase())) return n;
    }
    return 'Rookie' + ri(10, 99);
  }
  function addPlayer(p) {
    const id = 'p' + (C.nextPid++);
    const full = Object.assign({ id, team: null, contract: ri(1, 3), stats: { gp: 0, g: 0, a: 0, sv: 0, score: 0 }, form: 0 }, p);
    full.salary = full.salary || salaryFor(full.rating);
    C.players[id] = full;
    return id;
  }
  function makeRookie(region) {
    const country = pick(ROOKIE_COUNTRIES[region]);
    const age = ri(16, 20);
    const rating = ri(58, 74);
    return addPlayer({ name: newName(), country, flag: global.RL_DATA.flagFor(country), region, age, rating, pot: clamp(rating + ri(6, 22), rating, 97) });
  }

  /* ---------------- new career ---------------- */
  function newCareer(teamId) {
    const lib = api.libraryTeams();
    C = { v: 1, agesV2: true, season: 2027, step: 0, user: 'c:' + teamId, teams: {}, players: {}, nextPid: 1, points: {}, results: {}, news: [], history: [], trophies: [], fa: [], seasonFin: { prize: 0, sponsor: 0, salaries: 0, transfers: 0 }, objectives: [], board: 60, stepNews: [] };
    lib.forEach((t) => {
      const cid = 'c:' + t.id;
      const roster = t.players.slice(0, 4).map((p, i) => {
        const born = bornOf(p.name, p.country);
        const known = born ? ageFromBorn(born) : null;
        const age = known != null ? known : 17 + Math.floor(hash(t.id + p.name) * 10);
        const pot = clamp(p.rating + Math.max(0, 23 - age) * (1 + hash(p.name) * 1.4), p.rating, 97);
        return addPlayer({ name: p.name, country: p.country, flag: p.flag, region: t.region, age, born: born || undefined, ageKnown: known != null, rating: p.rating, pot: Math.round(pot), team: cid, contract: 1 + Math.floor(hash(p.name + 'c') * 3), sub: i >= 3 });
      });
      const base = E.teamStrength(t);
      C.teams[cid] = { id: cid, name: t.name, tag: t.tag, region: t.region, color: t.color, roster, budget: Math.round((120000 + Math.max(0, base - 60) * 14000) / 1000) * 1000 };
    });
    REGIONS.forEach((r) => { for (let i = 0; i < 6; i++) C.fa.push(makeRookie(r)); });
    resetPoints();
    bump();
    setObjectives();
    news('career', `You take charge of <b>${esc(userTeam().name)}</b> for the ${C.season} RLCS season.`);
    save();
  }
  function resetPoints() { C.points = {}; Object.keys(C.teams).forEach((id) => (C.points[id] = { s1: 0, s2: 0, season: 0 })); C.results = {}; C.seasonFin = { prize: 0, sponsor: 0, salaries: 0, transfers: 0 }; Object.values(C.players).forEach((p) => (p.stats = { gp: 0, g: 0, a: 0, sv: 0, score: 0 })); }
  const esc = (s) => api.esc(s);
  function news(kind, html) { C.news.unshift({ kind, html, when: C.season + ' · ' + step().short }); C.news = C.news.slice(0, 80); }

  function regionRankOfUser() {
    const reg = userTeam().region;
    return regionTeams(reg).sort((a, b) => ovr(b) - ovr(a)).indexOf(C.user) + 1;
  }
  function setObjectives() {
    const r = regionRankOfUser();
    const reg = userTeam().region;
    const big = reg === 'EU' || reg === 'NA';
    let obj;
    if (r <= (big ? 2 : 1)) obj = [{ k: 'worlds_top4', t: 'Finish top 4 at Worlds' }, { k: 'win_event', t: 'Win an Open or a Major' }];
    else if (r <= (big ? 5 : 2)) obj = [{ k: 'worlds', t: 'Qualify for the World Championship' }, { k: 'majors2', t: 'Qualify for both Majors' }];
    else if (r <= (big ? 10 : 5)) obj = [{ k: 'major1', t: 'Qualify for at least one Major' }, { k: 'open_top4', t: 'Reach an Open top 4' }];
    else obj = [{ k: 'open_top8', t: 'Reach an Open top 8' }, { k: 'region_top12', t: 'Finish top 12 in ' + api.regions[reg] + ' points' }];
    C.objectives = obj;
  }

  /* ---------------- standings & fields ---------------- */
  function standings(reg, key) {
    return regionTeams(reg).sort((a, b) => (C.points[b][key] - C.points[a][key]) || (ovr(b) - ovr(a)));
  }
  function snake(ids, groupSize) {
    const G = ids.length / groupSize;
    const groups = Array.from({ length: G }, () => []);
    ids.forEach((id, k) => { const row = Math.floor(k / G); const col = row % 2 === 0 ? k % G : G - 1 - (k % G); groups[col].push(id); });
    return groups.flat();
  }
  function quickSeries(a, b, bo) {
    const T = { settings: { simStyle: 'standard', goalLevel: 'normal' }, overrides: {}, managed: null, playstyle: 'balanced' };
    return E.simSeries(T, { id: 'q', a, b, bo: bo || 5 }, api.getTeam);
  }
  /** Open field: top 12 by split points (then rating) + 4 from a knockout qualifier. */
  function openField(reg, splitKey) {
    const st = standings(reg, splitKey === 's1' && C.step <= 1 ? 'season' : splitKey);
    const direct = st.slice(0, 12);
    let pool = st.slice(12, 28);
    const log = [];
    while (pool.length > 4) {
      const excess = pool.length - 4;
      const n = Math.min(Math.floor(pool.length / 2), excess);
      const keep = pool.slice(0, pool.length - 2 * n);
      const playing = pool.slice(pool.length - 2 * n);
      const winners = [];
      for (let i = 0; i < n; i++) { const a = playing[i], b = playing[playing.length - 1 - i]; const r = quickSeries(a, b, 5); winners.push(r.winner); log.push([a, b, r.winner]); }
      pool = keep.concat(winners);
    }
    return { field: direct.concat(pool), qualifier: log };
  }
  function majorField(splitKey) {
    let ids = [];
    REGIONS.forEach((r) => (ids = ids.concat(standings(r, splitKey).slice(0, MAJOR_SLOTS[r]))));
    return ids.sort((a, b) => (C.points[b][splitKey] - C.points[a][splitKey]) || ovr(b) - ovr(a));
  }
  function worldsField() {
    let ids = [];
    REGIONS.forEach((r) => (ids = ids.concat(standings(r, 'season').slice(0, WORLDS_SLOTS[r]))));
    return ids.sort((a, b) => (C.points[b].season - C.points[a].season) || ovr(b) - ovr(a));
  }
  function eventCfg(st, region) {
    const base = { simStyle: 'standard', goalLevel: 'normal', seriesBo: 'default', finalBo: 'default', matchType: 'full', thirdPlace: false, overrides: {}, legs: 1 };
    if (st.type === 'open') { const f = openField(region, 's' + st.split); return { cfg: Object.assign(base, { format: 'swiss', size: 16, teams: f.field }), qualifier: f.qualifier }; }
    if (st.type === 'major') { const ids = majorField('s' + st.split); return { cfg: Object.assign(base, { format: 'major', size: 16, teams: snake(ids, 4) }) }; }
    const ids = worldsField(); return { cfg: Object.assign(base, { format: 'groups', size: 20, groupSize: 5, advance: 2, teams: snake(ids, 5) }) };
  }
  function eventTitle(st, region) {
    if (st.type === 'open') return 'RLCS ' + C.season + ' · ' + api.regions[region] + ' ' + st.name;
    if (st.type === 'major') return 'RLCS ' + C.season + ' · ' + majorCity(st) + ' Major';
    return 'RLCS ' + C.season + ' World Championship · ' + worldsCity();
  }
  const majorCity = (st) => CITIES[(C.season * 2 + (st.split - 1)) % CITIES.length];
  const worldsCity = () => WORLDS_CITIES[C.season % WORLDS_CITIES.length];

  /* ---------------- results ---------------- */
  function placements(T) {
    const score = {};
    T.teams.forEach((id) => (score[id] = 0));
    const first = T.stages[0];
    if (first.type === 'swiss') first.teams.forEach((id) => { const r = first.records[id]; score[id] = r.w * 10 - r.l * 3 + r.gd * 0.1; });
    else if (first.groups) first.groups.forEach((g, gi) => E.groupTable(T, first.id, gi).forEach((row, pos) => (score[row.id] = (10 - pos) * 10 + row.w * 2 + row.gd * 0.1)));
    const br = T.stages.filter((s) => s.type === 'bracket').pop();
    if (br) {
      const ms = Object.values(T.matches).filter((m) => m.stage === br.id && m.result);
      const lastLoss = {};
      ms.forEach((m) => {
        if (m.result.bye) return;
        [m.a, m.b].forEach((id) => { if (id && id !== 'BYE' && score[id] < 1000) score[id] = 1000; });
        const l = m.result.loser;
        lastLoss[l] = Math.max(lastLoss[l] == null ? -1 : lastLoss[l], m.day + (m.section === 'third' ? 0.5 : 0));
      });
      Object.keys(lastLoss).forEach((id) => (score[id] = 1000 + lastLoss[id] * 10));
      if (T.champion) score[T.champion] = 99999;
    }
    const ids = T.teams.slice().sort((a, b) => score[b] - score[a]);
    return ids.map((id) => ({ id, place: 1 + ids.filter((x) => score[x] > score[id]).length }));
  }
  function placeLabel(place, list) {
    const same = list.filter((x) => x.place === place).length;
    return same > 1 ? place + '-' + (place + same - 1) : E.ordinal(place);
  }
  function simInstant(cfg) {
    const T = E.buildTournament(cfg, api.getTeam);
    E.refresh(T);
    let guard = 0;
    while (guard++ < 5000) {
      const r = E.readyMatches(T);
      if (!r.length) break;
      r.forEach((m) => { if (E.isReady(m)) E.commitResult(T, m, E.simSeries(T, m, api.getTeam)); });
    }
    return T;
  }
  /** Apply a finished event: points, prize money, player stats, news. */
  function applyEvent(T, st, region, title) {
    const list = placements(T);
    const kind = st.type;
    const pts = POINTS[kind === 'worlds' ? 'major' : kind];
    list.forEach(({ id, place }) => {
      const t = C.teams[id];
      if (!t) return;
      const prize = (PRIZE[kind] || [])[place - 1] || 0;
      t.budget += prize;
      if (id === C.user) C.seasonFin.prize += prize;
      if (kind !== 'worlds') {
        const p = pts[place - 1] || 0;
        C.points[id]['s' + st.split] += p; C.points[id].season += p;
      }
    });
    // player stats
    Object.values(T.stats).forEach((s) => {
      if (!s || !s.name || !C.teams[s.team]) return;
      const pid = C.teams[s.team].roster.find((x) => C.players[x] && C.players[x].name === s.name);
      if (!pid) return;
      const ps = C.players[pid].stats;
      ps.gp += s.gp; ps.g += s.g; ps.a += s.a; ps.sv += s.sv; ps.score += s.score;
    });
    const champ = T.champion;
    const me = list.find((x) => x.id === C.user);
    const entry = { title, champion: champ, runnerUp: T.runnerUp, top: list.slice(0, 8), me: me ? { place: me.place, label: placeLabel(me.place, list) } : null };
    if (kind === 'open') { C.results[st.key] = C.results[st.key] || {}; C.results[st.key][region] = entry; }
    else C.results[st.key] = entry;
    if (champ === C.user) { C.trophies.push({ season: C.season, title }); news('trophy', `🏆 <b>${esc(userTeam().name)}</b> win the ${esc(title)}!`); }
    else if (kind !== 'open' || region === userTeam().region) news('result', `<b>${esc(C.teams[champ].name)}</b> win the ${esc(title)}${me ? ` · you finished <b>${placeLabel(me.place, list)}</b>` : ''}.`);
  }

  function runStep(userT) {
    const st = step();
    const myReg = userTeam().region;
    if (st.type === 'open') {
      REGIONS.forEach((r) => {
        const title = eventTitle(st, r);
        if (r === myReg && userT) { applyEvent(userT, st, r, title); return; }
        const ev = eventCfg(st, r);
        if (r === myReg) noteQualifier(ev, title);
        applyEvent(simInstant(ev.cfg), st, r, title);
      });
    } else {
      const title = eventTitle(st);
      if (userT) applyEvent(userT, st, null, title);
      else { const ev = eventCfg(st); if (!ev.cfg.teams.includes(C.user)) news('info', `${esc(userTeam().name)} did not qualify for the ${esc(title)}.`); applyEvent(simInstant(ev.cfg), st, null, title); }
    }
    advance();
  }
  function noteQualifier(ev, title) {
    const q = ev.qualifier.find((x) => x[0] === C.user || x[1] === C.user);
    if (!q) return;
    if (ev.cfg.teams.includes(C.user)) news('info', `${esc(userTeam().name)} came through the qualifier for the ${esc(title)}.`);
    else news('info', `${esc(userTeam().name)} were knocked out of the ${esc(title)} qualifier by ${esc(C.teams[q[2]].name)}.`);
  }

  function advance() {
    C.step++;
    if (C.step >= SCHEDULE.length) C.step = SCHEDULE.length - 1;
    bump(); save();
  }

  /* ---------------- transfers ---------------- */
  function askingSalary(p, cid) {
    let s = salaryFor(p.rating);
    if (cid && p.team && ovr(cid) < ovr(p.team) - 4) s *= 1.25;
    return Math.round(s / 1000) * 1000;
  }
  function freeRosterSpot(cid) { return C.teams[cid].roster.length < 4; }
  function removeFromTeam(pid) {
    const p = C.players[pid];
    if (p.team && C.teams[p.team]) C.teams[p.team].roster = C.teams[p.team].roster.filter((x) => x !== pid);
    p.team = null;
  }
  function joinTeam(pid, cid, salary, years) {
    removeFromTeam(pid);
    C.fa = C.fa.filter((x) => x !== pid);
    const p = C.players[pid];
    p.team = cid; p.salary = salary; p.contract = years;
    C.teams[cid].roster.push(pid);
  }
  /** AI team needs at least three players: sign the best affordable free agent from its region (or anywhere). */
  function aiFill(cid) {
    const t = C.teams[cid];
    while (t.roster.length < 3) {
      const pool = C.fa.map((id) => C.players[id]).sort((a, b) => (b.region === t.region) - (a.region === t.region) || b.rating - a.rating);
      const p = pool[0] || C.players[makeRookie(t.region)];
      joinTeam(p.id, cid, salaryFor(p.rating), ri(1, 2));
    }
  }
  function aiWindow() {
    const ai = Object.keys(C.teams).filter((id) => id !== C.user);
    let moves = 0;
    for (let tries = 0; tries < 220 && moves < 14; tries++) {
      const buyer = pick(ai);
      const bt = C.teams[buyer];
      const starters = bt.roster.slice(0, 3).map((id) => C.players[id]);
      const weakest = starters.sort((a, b) => a.rating - b.rating)[0];
      if (!weakest) continue;
      // targets: free agents, or better players on clearly weaker teams in the same region
      const cands = C.fa.map((id) => C.players[id]).concat(Object.values(C.players).filter((p) => p.team && p.team !== buyer && p.team !== C.user && C.teams[p.team].region === bt.region && ovr(p.team) < ovr(buyer) - 3))
        .filter((p) => p.rating >= weakest.rating + 3 && p.rating <= weakest.rating + 12);
      if (!cands.length) continue;
      const p = pick(cands.sort((a, b) => b.rating - a.rating).slice(0, 5));
      const fee = p.team ? valueFor(p) : 0;
      if (bt.budget < fee + salaryFor(p.rating)) continue;
      const from = p.team;
      bt.budget -= fee;
      if (from) C.teams[from].budget += fee;
      // the replaced starter leaves (released)
      removeFromTeam(weakest.id); C.fa.push(weakest.id);
      joinTeam(p.id, buyer, salaryFor(p.rating), ri(1, 3));
      if (from) aiFill(from);
      moves++;
      news('transfer', `<b>${esc(p.name)}</b> joins ${esc(bt.name)}${from ? ` from ${esc(C.teams[from].name)} (${money(fee)})` : ' as a free agent'}; ${esc(weakest.name)} released.`);
    }
    ai.forEach(aiFill);
    bump();
  }

  /* ---------------- season review ---------------- */
  function seasonReview() {
    const me = userTeam();
    const lines = [];
    // objectives
    const majors = ['m1', 'm2'].filter((k) => C.results[k] && C.results[k].me).length;
    const worlds = C.results.w && C.results.w.me;
    const bestOpen = Math.min(...['o1', 'o2', 'o3', 'o4', 'o5', 'o6'].map((k) => (C.results[k] && C.results[k][me.region] && C.results[k][me.region].me ? C.results[k][me.region].me.place : 99)));
    const wonEvent = C.trophies.some((t) => t.season === C.season);
    const regRank = standings(me.region, 'season').indexOf(C.user) + 1;
    const met = (k) => ({ worlds_top4: worlds && worlds.place <= 4, win_event: wonEvent, worlds: !!worlds, majors2: majors >= 2, major1: majors >= 1, open_top4: bestOpen <= 4, open_top8: bestOpen <= 8, region_top12: regRank <= 12 }[k]);
    const objRes = C.objectives.map((o) => ({ t: o.t, ok: !!met(o.k) }));
    const okN = objRes.filter((o) => o.ok).length;
    C.board = clamp(C.board + (okN === 2 ? 20 : okN === 1 ? 2 : -25), 0, 100);
    if (C.board <= 0) {
      C.sacked = true;
      const myO = ovr(C.user);
      C.jobs = Object.keys(C.teams).filter((id) => id !== C.user && ovr(id) <= myO + 3 && ovr(id) >= myO - 12).sort(() => Math.random() - 0.5).slice(0, 3);
    }
    // finances: salaries out, sponsorship in
    const salaries = me.roster.reduce((s, id) => s + C.players[id].salary, 0);
    const sponsor = Math.round((60000 + Math.max(0, ovr(C.user) - 60) * 7000 + C.trophies.filter((t) => t.season === C.season).length * 60000 + (worlds ? 80000 : 0)) / 1000) * 1000;
    me.budget += sponsor - salaries;
    C.seasonFin.salaries = salaries; C.seasonFin.sponsor = sponsor;
    Object.values(C.teams).forEach((t) => { if (t.id !== C.user) t.budget = Math.max(60000, t.budget + 80000 + Math.max(0, ovr(t.id) - 60) * 6000 - t.roster.reduce((s, id) => s + C.players[id].salary, 0) * 0.6); });
    // awards
    const all = Object.values(C.players).filter((p) => p.team && p.stats.gp > 20);
    const mvp = all.slice().sort((a, b) => b.stats.score / b.stats.gp - a.stats.score / a.stats.gp)[0];
    const topG = all.slice().sort((a, b) => b.stats.g - a.stats.g)[0];
    // player development, ageing, contracts, retirements
    const devLines = [];
    Object.values(C.players).forEach((p) => {
      const old = p.rating;
      let d;
      if (p.age <= 20) d = rnd(1, 5); else if (p.age <= 23) d = rnd(0, 3); else if (p.age <= 26) d = rnd(-1, 1.5); else if (p.age <= 28) d = rnd(-3, 0.5); else d = rnd(-5, -1);
      if (p.rating + d > p.pot) d = Math.min(d, Math.max(0, p.pot - p.rating)) + (d < 0 ? d : 0);
      if (p.stats.gp > 30) d += clamp((p.stats.score / p.stats.gp - 380) / 120, -1, 1.5);
      p.rating = clamp(Math.round(p.rating + d), 45, 99);
      p.age++;
      if (p.team === C.user && p.rating !== old) devLines.push(`${esc(p.name)} ${p.rating > old ? '▲' : '▼'} ${old} → ${p.rating}`);
    });
    const retired = [];
    Object.values(C.players).forEach((p) => {
      if (p.age >= 29 && Math.random() < (p.age - 27) * 0.18 && !(p.team === C.user && p.rating >= 85)) retired.push(p);
    });
    retired.forEach((p) => { removeFromTeam(p.id); C.fa = C.fa.filter((x) => x !== p.id); delete C.players[p.id]; if (p.rating >= 82) news('info', `${esc(p.name)} retires.`); });
    const expiring = [];
    Object.values(C.players).forEach((p) => {
      if (!p.team) return;
      p.contract--;
      if (p.contract <= 0) {
        if (p.team === C.user) expiring.push(p.id);
        else if (Math.random() < 0.8) { p.contract = ri(1, 3); p.salary = salaryFor(p.rating); }
        else { const tm = p.team; removeFromTeam(p.id); C.fa.push(p.id); aiFill(tm); }
      }
    });
    REGIONS.forEach((r) => { for (let i = 0; i < 5; i++) C.fa.push(makeRookie(r)); });
    C.fa = C.fa.filter((id) => C.players[id]);
    Object.keys(C.teams).forEach((id) => { if (id !== C.user) aiFill(id); });
    const champion = C.results.w && C.results.w.champion;
    C.history.unshift({ season: C.season, worlds: worlds ? worlds.label : 'DNQ', majors, bestOpen: bestOpen < 99 ? E.ordinal(bestOpen) : '—', regRank, objectives: objRes, champion: champion && C.teams[champion] ? C.teams[champion].name : '—', mvp: mvp ? mvp.name : '—', points: C.points[C.user].season });
    C.review = { objRes, salaries, sponsor, mvp: mvp && { name: mvp.name, team: mvp.team }, topG: topG && { name: topG.name, g: topG.stats.g }, devLines, retired: retired.filter((p) => p.team === C.user || p.rating >= 80).map((p) => p.name), expiring, champion, regRank };
    bump();
  }
  function startNextSeason() {
    // any expiring contract not handled leaves
    (C.review && C.review.expiring || []).forEach((pid) => {
      const p = C.players[pid];
      if (!p || p.team !== C.user || p.contract > 0) return;
      const sal = salaryFor(p.rating);
      if (!(C.review.letGo || []).includes(pid) && userTeam().budget >= sal) { p.contract = 2; p.salary = sal; news('transfer', `${esc(p.name)} re-signs for two seasons (${money(sal)}/yr).`); }
      else { removeFromTeam(pid); C.fa.push(pid); news('transfer', `${esc(p.name)} leaves as a free agent.`); }
    });
    C.season++;
    C.step = 0;
    C.review = null;
    resetPoints();
    bump();
    setObjectives();
    news('career', `The ${C.season} season begins. The pre-season transfer window is open.`);
    save();
  }

  /* ================= UI ================= */
  function teamCard(cid, extra) {
    const t = teamObj(cid);
    return `<div class="team-chip">${api.badge(t)}<div class="meta"><div class="name">${esc(t.name)}</div><div class="sub">${extra || 'OVR ' + t.ovr}</div></div></div>`;
  }

  function renderStart(app) {
    const q = (api.state.ui.careerQ || '').toLowerCase();
    const reg = api.state.ui.careerReg || 'all';
    const lib = api.libraryTeams().sort((a, b) => b.ovr - a.ovr).filter((t) => (reg === 'all' || t.region === reg) && (!q || t.name.toLowerCase().includes(q)));
    app.innerHTML = `
      <div class="page-head"><button class="btn sm" data-action="nav" data-v="home">← Back to modes</button><h1>Career mode</h1></div>
      <div class="bento">
        <section class="tile c-8 career-hero"><div class="tile-kicker">New career · ${2027} season</div><h2 class="career-hero-title">Build a dynasty on the RLCS circuit</h2>
          <p>Pick an organisation and run it season after season. Play six regional Opens, two Majors and the World Championship. Earn circuit points and prize money, sign players in two transfer windows, manage contracts and a budget, and watch your roster develop, age and retire.</p>
          <div class="career-steps">${SCHEDULE.slice(0, 11).map((s) => `<span class="pill ${s.type === 'major' ? 'gold' : s.type === 'worlds' ? 'good' : ''}">${s.short}</span>`).join('')}</div>
        </section>
        <section class="tile c-4 stat-tile accent-orange" style="justify-content:flex-start;gap:12px"><div class="tile-kicker">How you win</div><div class="sub" style="font-size:14px;line-height:1.55">Top 12 in your region's points go straight into each Open; the rest fight through a qualifier. ${Object.entries(MAJOR_SLOTS).map(([k, v]) => k + ' ' + v).join(' · ')} teams reach each Major. The season's best ${Object.values(WORLDS_SLOTS).reduce((a, b) => a + b, 0)} go to Worlds.</div></section>
        <section class="tile c-12">
          <div class="tile-head"><div><h2>Choose your team</h2><p>Stronger teams start with bigger budgets and bigger expectations.</p></div>
            <div class="toolbar"><div class="search"><input class="input" id="careerQ" placeholder="Search teams" value="${esc(api.state.ui.careerQ || '')}" aria-label="Search teams" /></div></div></div>
          <div class="seg" style="margin-bottom:12px">${[['all', 'All'], ...REGIONS.map((k) => [k, k])].map(([k, v]) => `<button class="${k === reg ? 'active' : ''}" data-action="career-reg" data-v="${k}">${v}</button>`).join('')}</div>
          <div class="browse-list">${lib.slice(0, 120).map((t) => `<button class="browse-item" data-action="career-pick" data-id="${esc(t.id)}">${api.badge(t)}<span class="meta"><b>${esc(t.name)}</b><small>${esc(api.regions[t.region])} · ${esc(t.players.slice(0, 3).map((p) => p.name).join(' · '))}</small></span><span class="rt">${t.ovr}</span></button>`).join('')}</div>
        </section>
      </div>`;
    const inp = app.querySelector('#careerQ');
    if (inp) inp.addEventListener('input', () => { api.state.ui.careerQ = inp.value; const pos = inp.selectionStart; renderStart(app); const n = app.querySelector('#careerQ'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function myEventStatus(st) {
    const reg = userTeam().region;
    if (st.type === 'open') { const r = C.results[st.key] && C.results[st.key][reg]; return r ? (r.me ? r.me.label : 'DNQ') : null; }
    const r = C.results[st.key];
    return r ? (r.me ? r.me.label : 'DNQ') : null;
  }

  function renderHub(app) {
    const st = step();
    const me = userTeam();
    const t = teamObj(C.user);
    const reg = me.region;
    const splitKey = st.split ? 's' + st.split : (C.step <= 5 ? 's1' : 's2');
    const table = standings(reg, st.type === 'worlds' || st.type === 'review' ? 'season' : splitKey);
    const slots = st.type === 'worlds' || st.type === 'review' ? WORLDS_SLOTS[reg] : MAJOR_SLOTS[reg];
    const T = api.state.T;
    const activeEvent = T && T.career && T.career.season === C.season && T.career.step === C.step && !T.career.recorded;
    let next = '';
    if (st.type === 'window') {
      next = `<p>The transfer window is open. Sign players, extend contracts or sell, then close the window to start ${C.step === 0 ? 'Open 1' : 'Open 4'}. AI teams make their moves when the window closes.</p>
        <div class="action-row"><button class="btn primary" data-action="career-market">Open transfer market</button><button class="btn" data-action="career-close-window">Close window →</button></div>`;
    } else if (st.type === 'review') {
      if (!C.review) { seasonReview(); save(); }
      const R = C.review;
      if (C.sacked) {
        next = `<p><b>The board has run out of patience — you have been sacked.</b> Your history and trophies stay with you. Pick your next job:</p>
          <div class="team-grid">${(C.jobs || []).map((id) => { const tt = teamObj(id); return `<button class="browse-item" data-action="career-job" data-id="${id}">${api.badge(tt)}<span class="meta"><b>${esc(tt.name)}</b><small>${esc(api.regions[tt.region])} · OVR ${tt.ovr}</small></span></button>`; }).join('')}</div>
          <p class="help">After you choose, start the next season from the new club.</p>`;
      } else next = `<p>Season ${C.season} is over. ${R.champion ? `<b>${esc(C.teams[R.champion].name)}</b> are world champions.` : ''}</p>
        <div class="kv"><span>Sponsorship</span><b>+${money(R.sponsor)}</b></div><div class="kv"><span>Salaries paid</span><b>-${money(R.salaries)}</b></div>
        <div class="kv"><span>Season MVP</span><span>${R.mvp ? esc(R.mvp.name) + ' · ' + esc(C.teams[R.mvp.team] ? C.teams[R.mvp.team].name : '') : '—'}</span></div>
        <div class="kv"><span>Top scorer</span><span>${R.topG ? esc(R.topG.name) + ' · ' + R.topG.g + ' goals' : '—'}</span></div>
        ${R.devLines.length ? `<div class="tile-kicker" style="margin-top:12px">Your players</div><p class="help">${R.devLines.join(' · ')}</p>` : ''}
        ${R.expiring.filter((pid) => C.players[pid] && C.players[pid].contract <= 0).length ? `<div class="tile-kicker" style="margin-top:12px">Expiring contracts</div>${R.expiring.filter((pid) => C.players[pid] && C.players[pid].contract <= 0).map((pid) => { const p = C.players[pid]; const go = (R.letGo || []).includes(pid); return `<div class="kv"><span>${esc(p.name)} · ${p.rating} · age ${ageLabel(p)}</span><span class="toolbar"><span class="pill ${go ? 'bad' : 'good'}">${go ? 'Leaving' : 'Re-signs 2y · ' + money(salaryFor(p.rating)) + '/yr'}</span><button class="btn xs" data-action="career-letgo" data-id="${pid}">${go ? 'Keep' : 'Let go'}</button></span></div>`; }).join('')}<p class="help">Players marked to re-sign get a new two-season deal when the next season starts, if the budget allows.</p>` : ''}
        <div class="action-row"><button class="btn primary" data-action="career-next-season">Start ${C.season + 1} season →</button></div>`;
    } else {
      const ev = st.type === 'open' ? null : eventCfg(st);
      const inIt = st.type === 'open' ? true : ev.cfg.teams.includes(C.user);
      const title = eventTitle(st, reg);
      next = `<p><b>${esc(title)}</b> · ${st.type === 'open' ? '16 teams · Swiss stage, then an eight-team playoff' : st.type === 'major' ? '16 teams · groups, then the Final Eight' : '20 teams · four groups of five, then an eight-team knockout'}.</p>
        ${st.type === 'open' ? '<p class="help">The top 12 in your region\'s points go straight in; teams ranked 13th–28th play a knockout qualifier for the last four places.</p>' : inIt ? `<p class="help">You have qualified. Every other region's teams are in the field as well.</p>` : `<p class="help">You did not qualify for this event. You can still simulate it and follow the results.</p>`}
        <div class="action-row">
          ${activeEvent ? `<button class="btn primary" data-action="resume">Resume event →</button><button class="btn" data-action="career-sim-rest">Simulate the rest</button>` : `${inIt ? '<button class="btn primary" data-action="career-play">▶ Play event</button>' : ''}<button class="btn ${inIt ? '' : 'primary'}" data-action="career-sim">Simulate event</button>`}
        </div>`;
    }
    const roster = me.roster.map((id) => C.players[id]);
    const salaries = roster.reduce((s, p) => s + p.salary, 0);
    app.innerHTML = `
      <div class="page-head"><button class="btn sm" data-action="nav" data-v="home">← Back to modes</button>
        <h1 style="display:flex;align-items:center;gap:12px">${api.badge(t, 'lg')}<span>${esc(t.name)}<span class="muted" style="display:block;font-size:.45em;font-family:var(--font);font-weight:500">${esc(api.regions[reg])} · RLCS ${C.season} · ${esc(st.name)}</span></span></h1>
        <div class="head-actions"><button class="btn sm" data-action="career-market">Transfer market</button><button class="btn sm danger" data-action="career-quit">End career</button></div></div>
      <div class="bento">
        <section class="tile stat-tile accent-blue c-3"><div class="tile-kicker">Team rating</div><div class="big">${t.ovr}</div><div class="sub">${regionRankLabel()} in ${esc(api.regions[reg])}</div></section>
        <section class="tile stat-tile accent-orange c-3"><div class="tile-kicker">Budget</div><div class="big">${money(me.budget)}</div><div class="sub">${money(salaries)} salaries per season</div></section>
        <section class="tile stat-tile accent-violet c-3"><div class="tile-kicker">Circuit points</div><div class="big">${C.points[C.user].season}</div><div class="sub">Split 1: ${C.points[C.user].s1} · Split 2: ${C.points[C.user].s2}</div></section>
        <section class="tile stat-tile c-3"><div class="tile-kicker">Board confidence</div><div class="big">${C.board}%</div><div class="progress" style="margin-top:4px"><i style="width:${C.board}%"></i></div></section>

        <div class="stack c-8 col-main">
          <section class="tile"><div class="tile-head"><div><div class="tile-kicker">Next up</div><h2>${esc(st.name)}</h2></div><span class="pill ${st.type === 'window' ? 'good' : ''}">${C.step + 1} / ${SCHEDULE.length}</span></div>${next}</section>
          <section class="tile"><div class="tile-head"><h2>Season ${C.season}</h2></div>
            <div class="timeline">${SCHEDULE.map((s, i) => { const res = myEventStatus(s); return `<div class="tl ${i < C.step ? 'done' : i === C.step ? 'now' : ''} ${s.type}"><b>${s.short}</b><small>${i < C.step ? (res || (s.type === 'window' ? 'Closed' : '✓')) : i === C.step ? 'Now' : s.type === 'major' ? esc(majorCity(s)) : s.type === 'worlds' ? esc(worldsCity()) : ''}</small></div>`; }).join('')}</div>
          </section>
          <section class="tile"><div class="tile-head"><div><h2>${esc(api.regions[reg])} standings</h2><p>${st.type === 'worlds' || st.type === 'review' ? 'Season points · top ' + slots + ' reach Worlds' : 'Split ' + (splitKey === 's1' ? 1 : 2) + ' points · top ' + slots + ' reach the Major'}</p></div></div>
            <div class="table-wrap"><table class="st"><thead><tr><th>#</th><th class="l">Team</th><th>OVR</th><th>Split 1</th><th>Split 2</th><th>Season</th></tr></thead><tbody>
            ${table.slice(0, 16).map((id, i) => { const tt = teamObj(id); return `<tr class="${i < slots ? 'q' : ''} ${id === C.user ? 'hl' : ''}"><td class="pos">${i + 1}</td><td class="l"><div class="tcell">${api.badge(tt, 'sm')}<span>${esc(tt.name)}</span></div></td><td>${tt.ovr}</td><td>${C.points[id].s1}</td><td>${C.points[id].s2}</td><td><b>${C.points[id].season}</b></td></tr>`; }).join('')}
            </tbody></table></div></section>
        </div>
        <div class="stack c-4 col-info">
          <section class="tile"><div class="tile-head"><h2>Squad</h2><button class="btn xs" data-action="career-market">Manage</button></div>
            <div class="leader-list">${roster.map((p, i) => `<div class="leader"><span class="rk">${i < 3 ? 'ST' : 'SUB'}</span><span class="who"><b>${p.flag || ''} ${esc(p.name)}</b><small>Age ${ageLabel(p)} · ${p.contract}y · ${money(p.salary)}/yr${p.stats.gp ? ' · ' + p.stats.g + 'G ' + p.stats.sv + 'Sv' : ''}</small></span><span class="val">${p.rating}</span></div>`).join('')}</div></section>
          <section class="tile"><div class="tile-head"><h2>Objectives</h2></div>${C.objectives.map((o) => `<div class="kv"><span>${esc(o.t)}</span><span class="pill">${C.season}</span></div>`).join('')}</section>
          <section class="tile"><div class="tile-head"><h2>Trophy cabinet</h2><span class="pill gold">${C.trophies.length}</span></div>${C.trophies.length ? C.trophies.slice().reverse().slice(0, 8).map((x) => `<div class="kv"><span>🏆 ${esc(x.title)}</span></div>`).join('') : '<p class="muted" style="font-size:13px">No trophies yet.</p>'}</section>
          <section class="tile grow"><div class="tile-head"><h2>News</h2></div><div class="pulse">${C.news.slice(0, 30).map((n) => `<div class="story ${n.kind === 'trophy' ? 'win' : n.kind === 'transfer' ? 'upset' : ''}"><small>${esc(n.when)}</small>${n.html}</div>`).join('')}</div></section>
        </div>
        ${C.history.length ? `<section class="tile c-12"><div class="tile-head"><h2>Career history</h2></div><div class="table-wrap"><table class="st"><thead><tr><th class="l">Season</th><th>Points</th><th>Region</th><th>Best Open</th><th>Majors</th><th>Worlds</th><th class="l">World champion</th><th class="l">Objectives</th></tr></thead><tbody>
          ${C.history.map((h) => `<tr><td class="l">${h.season}</td><td>${h.points}</td><td>${E.ordinal(h.regRank)}</td><td>${h.bestOpen}</td><td>${h.majors}/2</td><td>${esc(h.worlds)}</td><td class="l">${esc(h.champion)}</td><td class="l">${h.objectives.map((o) => (o.ok ? '✓ ' : '✗ ') + esc(o.t)).join(' · ')}</td></tr>`).join('')}
        </tbody></table></div></section>` : ''}
      </div>`;
  }
  function regionRankLabel() { return E.ordinal(regionRankOfUser()); }

  /* ---------------- transfer market ---------------- */
  function openMarket() {
    const ui = api.state.ui;
    const open = isWindow();
    const me = userTeam();
    const q = (ui.mkQ || '').toLowerCase();
    const reg = ui.mkReg || me.region;
    const tab = ui.mkTab || 'squad';
    let body = '';
    if (tab === 'squad') {
      body = `<div class="leader-list">${me.roster.map((pid, i) => { const p = C.players[pid]; return `<div class="leader"><span class="rk">${i < 3 ? 'ST' : 'SUB'}</span><span class="who"><b>${p.flag || ''} ${esc(p.name)} · ${p.rating}</b><small>Age ${ageLabel(p)} · potential ~${p.pot - 2}-${p.pot + 2} · ${p.contract}y left · ${money(p.salary)}/yr · value ${money(valueFor(p))}</small></span>
        <span class="toolbar">${i >= 3 ? `<button class="btn xs" data-action="mk-promote" data-id="${pid}">Make starter</button>` : ''}${open ? `<button class="btn xs" data-action="mk-extend" data-id="${pid}">Extend</button><button class="btn xs" data-action="mk-sell" data-id="${pid}">Sell</button><button class="btn xs danger" data-action="mk-release" data-id="${pid}">Release</button>` : ''}</span></div>`; }).join('')}</div>
        <p class="help">The first three players start. Rosters hold up to four. ${open ? 'Releasing a player costs half a season of their salary.' : 'Signings, sales and releases open in the next transfer window.'}</p>`;
    } else {
      const pool = tab === 'fa' ? C.fa.map((id) => C.players[id]) : Object.values(C.players).filter((p) => p.team && p.team !== C.user && (reg === 'all' || C.teams[p.team].region === reg));
      const list = pool.filter((p) => p && (!q || p.name.toLowerCase().includes(q) || (p.team && C.teams[p.team].name.toLowerCase().includes(q)))).sort((a, b) => b.rating - a.rating).slice(0, 80);
      body = `<div class="modal-toolbar"><div class="search"><input class="input" id="mkQ" placeholder="Search players or teams" value="${esc(ui.mkQ || '')}" aria-label="Search players or teams" /></div>
        ${tab === 'players' ? `<div class="seg">${[['all', 'All'], ...REGIONS.map((k) => [k, k])].map(([k, v]) => `<button class="${k === reg ? 'active' : ''}" data-action="mk-reg" data-v="${k}">${v}</button>`).join('')}</div>` : ''}</div>
        <div class="table-wrap"><table class="st"><thead><tr><th class="l">Player</th><th class="l hide-sm">Team</th><th>Age</th><th>OVR</th><th class="hide-sm">Pot.</th><th>${tab === 'fa' ? 'Asks' : 'Value'}</th><th></th></tr></thead><tbody>
        ${list.map((p) => `<tr><td class="l">${p.flag || ''} <b>${esc(p.name)}</b></td><td class="l hide-sm muted">${p.team ? esc(C.teams[p.team].name) : 'Free agent'}</td><td>${ageLabel(p)}</td><td><b>${p.rating}</b></td><td class="hide-sm">~${p.pot}</td><td>${money(tab === 'fa' ? askingSalary(p, C.user) : valueFor(p))}</td><td>${open ? `<button class="btn xs" data-action="mk-offer" data-id="${p.id}">${tab === 'fa' ? 'Sign' : 'Bid'}</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="l muted">No players match.</td></tr>'}
        </tbody></table></div>`;
    }
    api.openModal(`${api.modalHead('Transfer market', open ? `Window open · budget ${money(me.budget)}` : 'Window closed · you can browse, but deals wait for the next window')}
      <div class="modal-body">
        <div class="tabs" style="margin-bottom:12px">${[['squad', 'Your squad'], ['players', 'Players'], ['fa', 'Free agents · ' + C.fa.length]].map(([k, v]) => `<button class="${k === tab ? 'active' : ''}" data-action="mk-tab" data-v="${k}">${v}</button>`).join('')}</div>
        ${body}
      </div>
      <div class="modal-foot"><span class="count-pill" style="margin-right:auto">Roster ${me.roster.length}/4 · OVR ${ovr(C.user)}</span><button class="btn primary" data-action="close-modal">Done</button></div>`, { onClose: api.render, focus: false });
    const inp = document.getElementById('mkQ');
    if (inp) inp.addEventListener('input', () => { ui.mkQ = inp.value; const pos = inp.selectionStart; openMarket(); const n = document.getElementById('mkQ'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function openOffer(pid) {
    const p = C.players[pid];
    const me = userTeam();
    const fa = !p.team;
    const fee = fa ? 0 : valueFor(p);
    const ask = askingSalary(p, C.user);
    api.openModal(`${api.modalHead(fa ? 'Sign ' + p.name : 'Bid for ' + p.name, `${p.flag || ''} ${esc(p.country || '')} · age ${ageLabel(p)} · OVR ${p.rating} · ${fa ? 'free agent' : esc(C.teams[p.team].name)}`)}
      <div class="modal-body">
        ${fa ? '' : `<div class="field"><label for="ofFee">Transfer fee to ${esc(C.teams[p.team].name)}</label><input class="input" type="number" id="ofFee" min="0" step="1000" value="${fee}" /><p class="help">Estimated value ${money(fee)}. Clubs rarely sell their best player for less than ~25% over value.</p></div>`}
        <div class="field"><label for="ofSal">Salary per season</label><input class="input" type="number" id="ofSal" min="0" step="1000" value="${ask}" /><p class="help">${esc(p.name)} is asking for about ${money(ask)}.</p></div>
        <div class="field"><label for="ofYears">Contract length</label><select class="select" id="ofYears"><option value="1">1 season</option><option value="2" selected>2 seasons</option><option value="3">3 seasons</option></select></div>
        <p class="help">Budget ${money(me.budget)} · roster ${me.roster.length}/4${me.roster.length >= 4 ? ' · release or sell a player first' : ''}.</p>
      </div>
      <div class="modal-foot"><button class="btn" data-action="career-market">Back</button><button class="btn primary" data-action="mk-submit" data-id="${pid}" ${me.roster.length >= 4 ? 'disabled' : ''}>${fa ? 'Offer contract' : 'Submit bid'}</button></div>`, { size: 'sm', onClose: api.render });
  }
  function submitOffer(pid) {
    const p = C.players[pid];
    const me = userTeam();
    const fa = !p.team;
    const fee = fa ? 0 : Math.max(0, +document.getElementById('ofFee').value || 0);
    const sal = Math.max(0, +document.getElementById('ofSal').value || 0);
    const years = +document.getElementById('ofYears').value;
    if (me.roster.length >= 4) return api.toast('Your roster is full (4).');
    if (fee + sal > me.budget) return api.toast('Not enough budget for the fee plus the first season of salary.');
    const ask = askingSalary(p, C.user);
    if (!fa) {
      const seller = C.teams[p.team];
      const best = seller.roster.map((id) => C.players[id]).sort((a, b) => b.rating - a.rating)[0];
      const need = valueFor(p) * (best && best.id === p.id ? 1.25 : 1) * rnd(0.92, 1.12);
      if (fee < need) { api.toast(`${seller.name} rejected ${money(fee)}.`); return; }
    }
    const reluctance = p.rating >= 85 && ovr(C.user) < (p.team ? ovr(p.team) : 80) - 8 ? 1.5 : 1;
    if (sal < ask * 0.92 * reluctance) { api.toast(`${p.name} turned down ${money(sal)} a season.`); return; }
    const from = p.team;
    me.budget -= fee; C.seasonFin.transfers += fee;
    if (from) { C.teams[from].budget += fee; }
    joinTeam(pid, C.user, sal, years);
    if (from) aiFill(from);
    news('transfer', `<b>${esc(p.name)}</b> signs for ${esc(me.name)}${from ? ` from ${esc(C.teams[from].name)} for ${money(fee)}` : ' as a free agent'}.`);
    bump(); save();
    api.toast(`${p.name} signed!`);
    api.state.ui.mkTab = 'squad';
    openMarket();
  }

  /* ---------------- event flow ---------------- */
  function playEvent() {
    const st = step();
    const reg = userTeam().region;
    const ev = eventCfg(st, reg);
    if (st.type === 'open') noteQualifier(ev, eventTitle(st, reg));
    if (!ev.cfg.teams.includes(C.user)) { save(); api.toast('You did not make it into this event — simulate it instead.'); api.render(); return; }
    ev.cfg.managed = C.user;
    save();
    api.launch(ev.cfg, eventTitle(st, reg), { career: { season: C.season, step: C.step } });
  }
  function recordFromT(T) {
    if (!C || !T.career || T.career.recorded || T.career.season !== C.season || T.career.step !== C.step) return;
    T.career.recorded = true;
    runStep(T);
  }
  function simRest(T) {
    let guard = 0;
    while (guard++ < 5000) {
      const r = E.readyMatches(T);
      if (!r.length) break;
      r.forEach((m) => { if (E.isReady(m)) E.commitResult(T, m, E.simSeries(T, m, api.getTeam)); });
    }
    recordFromT(T);
  }

  function onAction(a, el) {
    const id = el.dataset.id, v = el.dataset.v;
    if (['career-play', 'career-sim', 'career-close-window', 'career-next-season'].includes(a) && C && userTeam().roster.length < 3) { api.toast('You need at least three players. Sign someone in the transfer market.'); return true; }
    switch (a) {
      case 'career-pick': newCareer(id); api.go('career'); return true;
      case 'career-reg': api.state.ui.careerReg = v; api.render(); return true;
      case 'career-quit':
        api.openModal(`${api.modalHead('End this career?', 'Your save for this career will be deleted. This cannot be undone.')}<div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn danger" data-action="career-quit-confirm">End career</button></div>`, { size: 'sm' });
        return true;
      case 'career-quit-confirm': C = null; save(); api.closeModal(); api.render(); return true;
      case 'career-play': playEvent(); return true;
      case 'career-sim': { const b = el; b.disabled = true; b.textContent = 'Simulating…'; setTimeout(() => { runStep(null); api.render(); }, 30); return true; }
      case 'career-sim-rest': { const T = api.state.T; simRest(T); api.render(); return true; }
      case 'career-close-window': aiWindow(); advance(); news('career', 'The transfer window is closed.'); save(); api.render(); return true;
      case 'career-next-season': startNextSeason(); api.render(); window.scrollTo({ top: 0 }); return true;
      case 'career-letgo': { const R = C.review; R.letGo = R.letGo || []; R.letGo = R.letGo.includes(id) ? R.letGo.filter((x) => x !== id) : R.letGo.concat(id); save(); api.render(); return true; }
      case 'career-job': {
        const old = userTeam().name; C.user = id; C.sacked = false; C.board = 55; bump(); setObjectives();
        news('career', `After leaving ${esc(old)}, you take over <b>${esc(C.teams[id].name)}</b>.`); save(); api.render(); window.scrollTo({ top: 0 }); return true;
      }
      case 'career-resign': { const p = C.players[id]; const sal = salaryFor(p.rating); if (userTeam().budget < sal) { api.toast('Not enough budget.'); return true; } p.contract = 2; p.salary = sal; news('transfer', `${esc(p.name)} signs a new two-season deal.`); save(); api.render(); return true; }
      case 'career-market': api.state.ui.mkTab = api.state.ui.mkTab || 'squad'; openMarket(); return true;
      case 'mk-tab': api.state.ui.mkTab = v; openMarket(); return true;
      case 'mk-reg': api.state.ui.mkReg = v; openMarket(); return true;
      case 'mk-offer': openOffer(id); return true;
      case 'mk-submit': submitOffer(id); return true;
      case 'mk-promote': { const r = userTeam().roster; const i = r.indexOf(id); const weakest = r.slice(0, 3).sort((x, y) => C.players[x].rating - C.players[y].rating)[0]; const j = r.indexOf(weakest); [r[i], r[j]] = [r[j], r[i]]; bump(); save(); openMarket(); return true; }
      case 'mk-release': { const me = userTeam(); if (me.roster.length <= 3 && C.fa.length === 0) return true; const p = C.players[id]; const cost = Math.round(p.salary / 2); me.budget -= cost; removeFromTeam(id); C.fa.push(id); news('transfer', `${esc(me.name)} release ${esc(p.name)}.`); if (me.roster.length < 3) api.toast('You need three players before the next event — sign someone.'); bump(); save(); openMarket(); return true; }
      case 'mk-extend': { const p = C.players[id]; const sal = Math.round(salaryFor(p.rating) * 1.05 / 1000) * 1000; p.contract = Math.min(3, p.contract + 1); p.salary = Math.max(p.salary, sal); news('transfer', `${esc(p.name)} extends (${p.contract}y, ${money(p.salary)}/yr).`); save(); openMarket(); return true; }
      case 'mk-sell': {
        const p = C.players[id]; const me = userTeam();
        const buyers = Object.keys(C.teams).filter((x) => x !== C.user && C.teams[x].region === me.region && C.teams[x].budget > valueFor(p));
        if (!buyers.length) { api.toast('No club can afford ' + p.name + ' right now.'); return true; }
        const buyer = pick(buyers); const fee = Math.round(valueFor(p) * rnd(0.8, 1.1) / 1000) * 1000;
        api.openModal(`${api.modalHead('Offer for ' + p.name, `${esc(C.teams[buyer].name)} offer ${money(fee)}`)}<div class="modal-body"><p>Accept and ${esc(p.name)} leaves immediately. You'll need three players before the next event.</p></div><div class="modal-foot"><button class="btn" data-action="career-market">Decline</button><button class="btn primary" data-action="mk-sell-ok" data-id="${id}" data-v="${buyer}|${fee}">Accept ${money(fee)}</button></div>`, { size: 'sm', onClose: api.render });
        return true;
      }
      case 'mk-sell-ok': { const [buyer, fee] = v.split('|'); const p = C.players[id]; const me = userTeam(); const bt = C.teams[buyer]; me.budget += +fee; bt.budget -= +fee; joinTeam(id, buyer, salaryFor(p.rating), 2); const out = bt.roster.length > 4 ? bt.roster.slice(0, 3).map((x) => C.players[x]).sort((x, y) => x.rating - y.rating)[0] : null; if (out) { removeFromTeam(out.id); C.fa.push(out.id); } news('transfer', `<b>${esc(p.name)}</b> sold to ${esc(bt.name)} for ${money(+fee)}.`); bump(); save(); openMarket(); return true; }
    }
    return false;
  }

  function render(app) {
    if (!C) renderStart(app); else renderHub(app);
  }
  function canAdvanceCheck() { return !C || userTeam().roster.length >= 3; }

  global.RLCareer = {
    init(a) { api = a; E = a.E; load(); },
    render, onAction, recordFromT, simRest,
    has: () => !!C,
    teamObj: (id) => (C ? teamObj(id) : null),
    summary: () => (C ? { team: teamObj(C.user), season: C.season, step: SCHEDULE[C.step].name } : null),
    canAdvance: canAdvanceCheck,
    money,
  };
})(window);
