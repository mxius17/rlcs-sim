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
  /* Host-city palettes for career Majors and Worlds: flag / city colours of the host.
     a = main colour, b = deep second colour, c = highlight; on = text on a. */
  const HOST_PAL = {
    'Copenhagen': ['Denmark', '#C8102E', '#1D4E89', '#F4C430'], 'Sydney': ['Australia', '#00843D', '#0057B8', '#FFCD00'],
    'Riyadh': ['Saudi Arabia', '#006C35', '#0B3D2E', '#C9A227'], 'Los Angeles': ['United States', '#7B2CBF', '#FF7A00', '#FDB927'],
    'London': ['United Kingdom', '#C8102E', '#012169', '#FFFFFF'], 'Rio de Janeiro': ['Brazil', '#009C3B', '#002776', '#FFDF00'],
    'Berlin': ['Germany', '#DD0000', '#1A1A1A', '#FFCE00'], 'Tokyo': ['Japan', '#BC002D', '#1B1F3B', '#F5A3B7'],
    'Dallas': ['United States', '#1747A6', '#BF0A30', '#C0C5CE'], 'Madrid': ['Spain', '#AA151B', '#6B0E12', '#F1BF00'],
    'Toronto': ['Canada', '#D80621', '#0B3D91', '#FFFFFF'], 'Stockholm': ['Sweden', '#006AA7', '#00395F', '#FECC00'],
    'Seoul': ['South Korea', '#0F4FA8', '#C60C30', '#E8E8E8'], 'Mexico City': ['Mexico', '#006847', '#CE1126', '#E4B83F'],
    'Fort Worth': ['United States', '#1747A6', '#BF0A30', '#C0C5CE'], 'Paris': ['France', '#0055A4', '#EF4135', '#FFFFFF'],
    'Lyon': ['France', '#D6001C', '#1F2A6B', '#F5F5F5'], 'Boston': ['United States', '#1A4E9C', '#C8102E', '#D4B483'],
    'Las Vegas': ['United States', '#E10098', '#1C0F45', '#FFD100'],
  };
  const hostKey = (city) => 'host-' + city.toLowerCase().replace(/[^a-z]+/g, '-');
  (function registerHostThemes() {
    const T = (window.RL_EVENT_THEMES = window.RL_EVENT_THEMES || {});
    Object.keys(HOST_PAL).forEach((city) => { const [country, a, b, c] = HOST_PAL[city]; T[hostKey(city)] = { name: city + ', ' + country, a, b, c, on: '#fff' }; });
  })();
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
  const hostCity = (st) => (st.type === 'major' ? majorCity(st) : st.type === 'worlds' ? worldsCity() : null);
  const hostTheme = (st) => { const c = hostCity(st); return c && HOST_PAL[c] ? window.RL_EVENT_THEMES[hostKey(c)] : null; };
  const hostVars = (th) => (th ? `--e1:${th.a};--e2:${th.b};--e3:${th.c};--e-on:${th.on}` : '');

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

  /* ---------- motion: entrance animations replay only when the view actually changes ---------- */
  let lastHubKey = null, lastPick = null, lastPickIdx = 0;
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function countUp(root) {
    if (reduceMotion()) return;
    root.querySelectorAll('[data-count]').forEach((el) => {
      const to = +el.dataset.count, fmt = el.dataset.fmt, suf = el.dataset.suf || '';
      const show = (v) => (fmt === 'money' ? money(Math.round(v / 1000) * 1000) : Math.round(v)) + suf;
      const t0 = performance.now(), dur = 900;
      const step = (now) => { const q = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - q, 3); el.textContent = show(to * e); if (q < 1) requestAnimationFrame(step); };
      el.textContent = show(0); requestAnimationFrame(step);
    });
  }

  // club selection: console-style "choose your club" card (design only — same teams, same start)
  const REG_COL = { EU: '#1F8BFF', NA: '#F2542D', SAM: '#2fbf71', MENA: '#d4a017', OCE: '#22b8cf', APAC: '#e11d48', SSA: '#a855f7' };
  const LEVELS = [null, ['Critical', 'crit'], ['Very high', 'vhigh'], ['High', 'high'], ['Medium', 'med'], ['Low', 'low'], ['Very low', 'vlow']];
  function previewObjectives(rank, reg) {
    const big = reg === 'EU' || reg === 'NA';
    if (rank <= (big ? 2 : 1)) return ['Finish top 4 at Worlds', 'Win an Open or a Major'];
    if (rank <= (big ? 5 : 2)) return ['Qualify for the World Championship', 'Qualify for both Majors'];
    if (rank <= (big ? 10 : 5)) return ['Qualify for at least one Major', 'Reach an Open top 4'];
    return ['Reach an Open top 8', 'Finish top 12 in ' + api.regions[reg] + ' points'];
  }
  function renderStart(app) {
    const ui = api.state.ui;
    const q = (ui.careerQ || '').toLowerCase();
    const reg = ui.careerReg || 'all';
    const all = api.libraryTeams();
    const lib = all.slice().sort((a, b) => b.ovr - a.ovr).filter((t) => (reg === 'all' || t.region === reg) && (!q || t.name.toLowerCase().includes(q)));
    let t = lib.find((x) => x.id === ui.cpick) || lib[0];
    const list = `<div class="cs-browse">
        <div class="cs-filters"><div class="seg">${[['all', 'All'], ...REGIONS.map((k) => [k, k])].map(([k, v]) => `<button class="${k === reg ? 'active' : ''}" data-action="career-reg" data-v="${k}">${v}</button>`).join('')}</div>
          <div class="search"><input class="input" id="careerQ" placeholder="Search teams" value="${esc(ui.careerQ || '')}" aria-label="Search teams" /></div></div>
        <div class="cs-list">${lib.slice(0, 120).map((x) => `<button class="cs-item ${t && x.id === t.id ? 'on' : ''}" data-action="career-preview" data-id="${esc(x.id)}">${api.badge(x, 'sm')}<span><b>${esc(x.name)}</b><small>${esc(x.region)} · ${x.ovr}</small></span></button>`).join('') || '<p class="muted">No teams match.</p>'}</div>
      </div>`;
    if (!t) { app.innerHTML = `<div class="cs"><div class="cs-title"><button class="btn sm" data-action="nav" data-v="home">← Back to modes</button><h1>Choose your club</h1></div>${list}</div>`; bindQ(app); return; }
    const idx = lib.indexOf(t);
    const prev = lib[(idx - 1 + lib.length) % lib.length], next = lib[(idx + 1) % lib.length];
    const motion = lastPick === null ? 'cs-enter' : lastPick !== t.id ? (idx >= lastPickIdx ? 'cs-swap cs-from-r' : 'cs-swap cs-from-l') : '';
    lastPick = t.id; lastPickIdx = idx;
    const regTeams = all.filter((x) => x.region === t.region).sort((a, b) => b.ovr - a.ovr);
    const rank = regTeams.findIndex((x) => x.id === t.id) + 1;
    const big = t.region === 'EU' || t.region === 'NA';
    const tier = rank <= (big ? 2 : 1) ? 1 : rank <= (big ? 5 : 2) ? 2 : rank <= (big ? 10 : 5) ? 3 : 4; // same tiers as the board's objectives
    const budget = Math.round((120000 + Math.max(0, E.teamStrength(t) - 60) * 14000) / 1000) * 1000; // same formula as a new career
    const stars = t.ovr >= 90 ? 5 : t.ovr >= 86 ? 4.5 : t.ovr >= 82 ? 4 : t.ovr >= 78 ? 3.5 : t.ovr >= 74 ? 3 : t.ovr >= 70 ? 2.5 : 2;
    const starHtml = [1, 2, 3, 4, 5].map((n) => `<i class="${stars >= n ? 'f' : stars >= n - 0.5 ? 'h' : ''}">★</i>`).join('');
    const ages = t.players.slice(0, 4).map((p) => { const b = bornOf(p.name, p.country); return b ? ageFromBorn(b) : null; }).filter((a) => a != null);
    const avgAge = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 21;
    const exp = [
      ['Regional success', tier === 1 ? 1 : tier === 2 ? 2 : tier === 3 ? 3 : 4],
      ['International success', tier === 1 ? 1 : tier === 2 ? 2 : tier === 3 ? 4 : 6],
      ['Brand exposure', t.ovr >= 88 ? 2 : t.ovr >= 82 ? 3 : t.ovr >= 76 ? 4 : 5],
      ['Financial', budget >= 400000 ? 5 : budget >= 250000 ? 4 : 3],
      ['Youth development', avgAge < 20 ? 2 : avgAge < 22 ? 4 : 5],
    ];
    const lineup = t.players.slice(0, 4);
    const desc = `${esc(t.name)} ${rank === 1 ? 'are the highest-rated team' : 'are ranked ' + E.ordinal(rank) + ' of ' + regTeams.length} in ${esc(api.regions[t.region])} going into the 2027 RLCS season, with a team rating of ${t.ovr}. The roster is led by ${esc(lineup.slice().sort((a, b) => b.rating - a.rating)[0].name)} (${lineup.slice().sort((a, b) => b.rating - a.rating)[0].rating})${lineup.length > 3 ? `, with ${esc(lineup[3].name)} as the substitute` : ''}.`;
    app.innerHTML = `
      <div class="cs ${motion}">
        <div class="cs-title"><button class="btn sm" data-action="nav" data-v="home">← Back to modes</button><h1>Choose your club</h1><span class="muted">${lib.length} teams · RLCS 2027</span></div>
        <div class="cs-card">
          <div class="cs-left">
            <div class="cs-box"><b>${esc(api.regions[t.region])}</b><span class="cs-region" style="--rc:${REG_COL[t.region] || 'var(--azure)'}">${esc(t.region)}</span></div>
            <div class="cs-club">
              <h2>${esc(t.name)}</h2>
              <div class="cs-crest"><button class="cs-nav" data-action="career-preview" data-id="${esc(prev.id)}" aria-label="Previous club">◀</button>${api.badge(t, 'xl')}<button class="cs-nav" data-action="career-preview" data-id="${esc(next.id)}" aria-label="Next club">▶</button></div>
              <div class="cs-stars" aria-label="${stars} stars">${starHtml}</div>
            </div>
            <div class="cs-box"><b>RLCS 2027</b><span class="cs-league">Club Championship</span></div>
          </div>
          <div class="cs-mid">
            <h3>Board<br>expectations</h3>
            ${exp.map(([l, n]) => `<div class="cs-exp"><b>${l}</b><span class="lv ${LEVELS[Math.min(6, n)][1]}"><i>${Math.min(6, n)}</i>${LEVELS[Math.min(6, n)][0]}</span></div>`).join('')}
            <div class="cs-obj"><small>Season objectives</small>${previewObjectives(rank, t.region).map((o) => `<span>${esc(o)}</span>`).join('')}</div>
          </div>
          <div class="cs-right">
            <div class="cs-about"><small>${esc(t.name)}</small><b>RLCS ${esc(t.region)} · ${E.ordinal(rank)} seed</b><p>${desc}</p></div>
            <div class="cs-money"><div><small>Transfer budget</small><b data-count="${budget}" data-fmt="money">${money(budget)}</b></div><span class="cs-coin" aria-hidden="true">$</span><div><small>Team rating</small><b data-count="${t.ovr}" data-suf=" OVR">${t.ovr} OVR</b></div></div>
            <div class="cs-bottom">
              <div class="cs-lineup">${lineup.map((p, k) => `<div class="cs-player"><span class="cs-shirt" style="--tc:${t.color || 'var(--azure)'}">${p.rating}</span><b>${p.flag || ''} ${esc(p.name)}</b><small>${k < 3 ? 'Starter' : 'Sub'}</small></div>`).join('')}</div>
              <div class="cs-home"><span class="cs-arena" aria-hidden="true"></span><small>Home region</small><b>${esc(api.regions[t.region])}</b></div>
            </div>
          </div>
        </div>
        <div class="cs-legend"><button class="cs-key" data-action="career-pick" data-id="${esc(t.id)}"><kbd>↵</kbd> Advance</button><button class="cs-key" data-action="nav" data-v="home"><kbd>Esc</kbd> Back</button><span class="cs-key"><kbd>←</kbd><kbd>→</kbd> Swap teams</span><button class="btn primary cs-go" data-action="career-pick" data-id="${esc(t.id)}">Start career with ${esc(t.name)} →</button></div>
        ${list}
      </div>`;
    bindQ(app);
    if (motion) countUp(app);
  }
  function bindQ(app) {
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
    const ui = api.state.ui;
    const tab = ui.ctab || 'central', view = ui.cview || 'next';
    const hubKey = [tab, view, C.season, C.step, ui.cnews || 0].join('|'), enter = hubKey !== lastHubKey;
    const tabChanged = !lastHubKey || lastHubKey.split('|')[0] !== tab;
    lastHubKey = hubKey; lastPick = null;
    const newsList = C.news.slice(0, 30);
    // ---- building blocks ----
    const ring = (val, max, label, txt, icon) => {
      const f = Math.max(0, Math.min(1, val / max)), r = 30, cir = 2 * Math.PI * r;
      const colr = f >= 0.66 ? '#1F8BFF' : f >= 0.4 ? 'rgba(255,255,255,0.85)' : '#F2542D';
      return `<div class="fc-ring"><svg viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="${r}" class="trk"/><circle cx="38" cy="38" r="${r}" class="val" style="stroke:${colr};--dash:${(cir * f).toFixed(1)}px;--cir:${cir.toFixed(1)}px;stroke-dasharray:${(cir * f).toFixed(1)} ${cir.toFixed(1)}"/></svg><span class="fc-ring-in" style="color:${colr}">${icon}</span><b>${txt}</b><small>${label}</small></div>`;
    };
    const tableHtml = `<div class="table-wrap"><table class="st"><thead><tr><th>#</th><th class="l">Team</th><th>OVR</th><th>Split 1</th><th>Split 2</th><th>Season</th></tr></thead><tbody>
      ${table.slice(0, 16).map((id, i) => { const tt = teamObj(id); return `<tr class="${i < slots ? 'q' : ''} ${id === C.user ? 'hl' : ''}"><td class="pos">${i + 1}</td><td class="l"><div class="tcell">${api.badge(tt, 'sm')}<span>${esc(tt.name)}</span></div></td><td>${tt.ovr}</td><td>${C.points[id].s1}</td><td>${C.points[id].s2}</td><td><b>${C.points[id].season}</b></td></tr>`; }).join('')}
      </tbody></table></div>`;
    const timelineHtml = `<div class="timeline">${SCHEDULE.map((s, i) => { const res = myEventStatus(s); const hth = hostTheme(s); return `<div class="tl ${i < C.step ? 'done' : i === C.step ? 'now' : ''} ${s.type}${hth ? ' host' : ''}" style="${hostVars(hth)}"><b>${s.short}</b><small>${i < C.step ? (res || (s.type === 'window' ? 'Closed' : '✓')) : i === C.step ? 'Now' : s.type === 'major' ? esc(majorCity(s)) : s.type === 'worlds' ? esc(worldsCity()) : ''}</small></div>`; }).join('')}</div>`;
    const squadHtml = `<div class="leader-list">${roster.map((p, i) => `<div class="leader"><span class="rk">${i < 3 ? 'ST' : 'SUB'}</span><span class="who"><b>${p.flag || ''} ${esc(p.name)}</b><small>Age ${ageLabel(p)} · ${p.contract}y · ${money(p.salary)}/yr${p.stats.gp ? ' · ' + p.stats.g + 'G ' + p.stats.sv + 'Sv' : ''}</small></span><span class="val">${p.rating}</span></div>`).join('')}</div>`;
    const objHtml = C.objectives.map((o) => `<div class="kv"><span>${esc(o.t)}</span><span class="pill">${C.season}</span></div>`).join('');
    const trophyHtml = C.trophies.length ? C.trophies.slice().reverse().slice(0, 8).map((x) => `<div class="kv"><span>🏆 ${esc(x.title)}</span></div>`).join('') : '<p class="muted" style="font-size:13px">No trophies yet.</p>';
    const newsHtml = `<div class="pulse">${newsList.map((n) => `<div class="story ${n.kind === 'trophy' ? 'win' : n.kind === 'transfer' ? 'upset' : ''}"><small>${esc(n.when)}</small>${n.html}</div>`).join('')}</div>`;
    const historyHtml = C.history.length ? `<div class="table-wrap"><table class="st"><thead><tr><th class="l">Season</th><th>Points</th><th>Region</th><th>Best Open</th><th>Majors</th><th>Worlds</th><th class="l">World champion</th><th class="l">Objectives</th></tr></thead><tbody>
      ${C.history.map((h) => `<tr><td class="l">${h.season}</td><td>${h.points}</td><td>${E.ordinal(h.regRank)}</td><td>${h.bestOpen}</td><td>${h.majors}/2</td><td>${esc(h.worlds)}</td><td class="l">${esc(h.champion)}</td><td class="l">${h.objectives.map((o) => (o.ok ? '✓ ' : '✗ ') + esc(o.t)).join(' · ')}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted" style="font-size:13px">Your finished seasons will appear here.</p>';
    // ---- feature panel (news carousel) ----
    const ni = Math.min(newsList.length - 1, Math.max(0, ui.cnews || 0));
    const story = newsList[ni];
    const feature = `<div class="fc-feature" style="--tc:${t.color || 'var(--azure)'}">
        <div class="fc-feature-art">${api.badge(t, 'xl')}<span class="fc-feature-season">RLCS ${C.season}</span></div>
        ${story ? `<div class="fc-headline"><span class="fc-tag">${story.kind === 'trophy' ? 'Trophy' : story.kind === 'transfer' ? 'Transfer' : 'News'}</span><p>${story.html}</p></div>` : ''}
        <div class="fc-feature-foot"><button class="fc-link" data-action="career-view" data-v="news">Go to News</button>
          <span class="fc-dots">${newsList.length > 1 ? `<button class="fc-arrow" data-action="career-news" data-v="${(ni - 1 + Math.min(5, newsList.length)) % Math.min(5, newsList.length)}" aria-label="Previous story">‹</button>` : ''}${newsList.slice(0, 5).map((_, k) => `<button class="fc-dot ${k === ni ? 'on' : ''}" data-action="career-news" data-v="${k}" aria-label="Story ${k + 1}"></button>`).join('')}${newsList.length > 1 ? `<button class="fc-arrow" data-action="career-news" data-v="${(ni + 1) % Math.min(5, newsList.length)}" aria-label="Next story">›</button>` : ''}</span></div>
      </div>`;
    const VIEWS = [['next', 'Next up', st.name], ['standings', 'Standings', api.regions[reg]], ['schedule', 'Season schedule', 'RLCS ' + C.season], ['objectives', 'Objectives', C.objectives.length + (C.objectives.length === 1 ? ' goal' : ' goals')], ['news', 'News', newsList.length + (newsList.length === 1 ? ' story' : ' stories')]];
    const mainView = view === 'standings' ? `<div class="fc-panel-body"><h3 class="fc-h">${esc(api.regions[reg])} standings</h3><p class="help">${st.type === 'worlds' || st.type === 'review' ? 'Season points · top ' + slots + ' reach Worlds' : 'Split ' + (splitKey === 's1' ? 1 : 2) + ' points · top ' + slots + ' reach the Major'}</p>${tableHtml}</div>`
      : view === 'schedule' ? `<div class="fc-panel-body"><h3 class="fc-h">Season ${C.season}</h3>${timelineHtml}</div>`
      : view === 'objectives' ? `<div class="fc-panel-body"><h3 class="fc-h">Board objectives</h3>${objHtml}<h3 class="fc-h" style="margin-top:18px">Trophy cabinet <span class="pill gold">${C.trophies.length}</span></h3>${trophyHtml}</div>`
      : view === 'news' ? `<div class="fc-panel-body"><h3 class="fc-h">News</h3>${newsHtml}</div>`
      : feature;
    // ---- next-up side card (all the season actions live here) ----
    const sideCard = `<aside class="fc-side">
        <div class="fc-side-head"><h2>${esc(st.name)}</h2><small>RLCS ${C.season}${hostCity(st) ? ' · ' + esc(hostCity(st)) + (HOST_PAL[hostCity(st)] ? ', ' + esc(HOST_PAL[hostCity(st)][0]) : '') : ''} · step ${C.step + 1} of ${SCHEDULE.length}</small></div>
        <div class="fc-side-row"><span class="fc-day">${C.step + 1}</span><span><small>${esc(st.type === 'window' ? 'Transfer window' : st.type === 'review' ? 'Season review' : st.type === 'open' ? 'Regional Open' : st.type === 'major' ? 'Major' : 'World Championship')}</small><b>${esc(st.short || st.name)}</b></span><span class="fc-ico" aria-hidden="true">${st.type === 'window' ? '⇄' : st.type === 'review' ? '★' : '🏆'}</span></div>
        <div class="fc-side-mid"><small>${esc(t.name)} · ${regionRankLabel()} in ${esc(api.regions[reg])}</small>
          <div class="fc-rings">${ring(t.ovr - 60, 40, 'Team rating', `<span data-count="${t.ovr}">${t.ovr}</span>`, '◆')}${ring(C.board, 100, 'Board', `<span data-count="${C.board}" data-suf="%">${C.board}%</span>`, '☺')}${ring(C.step + 1, SCHEDULE.length, 'Season', (C.step + 1) + '/' + SCHEDULE.length, '▶')}</div></div>
        <div class="fc-next">${next}</div>
      </aside>`;
    const tiles = `<nav class="fc-tiles" aria-label="Career hub">${VIEWS.map(([k, l, sub]) => `<button class="fc-tile ${k === view && tab === 'central' ? 'on' : ''}" data-action="career-view" data-v="${k}"><b>${l}</b><small>${esc(sub)}</small><span class="fc-tile-ico" aria-hidden="true">${{ next: '▶', standings: '☰', schedule: '▦', objectives: '✔', news: '▤' }[k]}</span></button>`).join('')}</nav>`;
    // ---- tabs ----
    const TABS = [['central', 'Central'], ['squad', 'Squad'], ['transfers', 'Transfers'], ['office', 'Office'], ['history', 'History']];
    let body;
    if (tab === 'squad') body = `<div class="fc-grid2"><section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Squad · OVR ${t.ovr}</h3>${squadHtml}<div class="action-row"><button class="btn primary" data-action="career-market">Manage squad</button></div></div></section>
        <section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Trophy cabinet <span class="pill gold">${C.trophies.length}</span></h3>${trophyHtml}</div></section></div>`;
    else if (tab === 'transfers') body = `<div class="fc-grid2"><section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Transfer market</h3>
        <div class="kv"><span>Window</span><b>${st.type === 'window' ? 'Open' : 'Closed'}</b></div><div class="kv"><span>Budget</span><b>${money(me.budget)}</b></div><div class="kv"><span>Salaries</span><span>${money(salaries)} per season</span></div><div class="kv"><span>Roster</span><span>${roster.length}/4</span></div><div class="kv"><span>Free agents</span><span>${C.fa.length}</span></div>
        <div class="action-row"><button class="btn primary" data-action="career-market">Open transfer market</button></div></div></section>
        <section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Transfer news</h3><div class="pulse">${C.news.filter((n) => n.kind === 'transfer').slice(0, 20).map((n) => `<div class="story upset"><small>${esc(n.when)}</small>${n.html}</div>`).join('') || '<p class="muted" style="font-size:13px">No transfers yet.</p>'}</div></div></section></div>`;
    else if (tab === 'office') body = `<div class="fc-grid2"><section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Finances</h3>
        <div class="fc-stats"><div><small>Budget</small><b data-count="${me.budget}" data-fmt="money">${money(me.budget)}</b></div><div><small>Salaries / season</small><b data-count="${salaries}" data-fmt="money">${money(salaries)}</b></div><div><small>Circuit points</small><b data-count="${C.points[C.user].season}">${C.points[C.user].season}</b><small>Split 1: ${C.points[C.user].s1} · Split 2: ${C.points[C.user].s2}</small></div><div><small>Board confidence</small><b>${C.board}%</b><div class="progress" style="margin-top:6px"><i style="width:${C.board}%"></i></div></div></div>
        <div class="action-row"><button class="btn danger" data-action="career-quit">End career</button></div></div></section>
        <section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Board objectives</h3>${objHtml}</div></section></div>`;
    else if (tab === 'history') body = `<section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Career history</h3>${historyHtml}<h3 class="fc-h" style="margin-top:18px">Trophy cabinet <span class="pill gold">${C.trophies.length}</span></h3>${trophyHtml}</div></section>`;
    else body = `<div class="fc-central"><section class="fc-panel fc-main">${mainView}</section>${sideCard}</div>${tiles}`;
    app.innerHTML = `
      <div class="fc ${enter ? 'fc-enter' : ''} ${tabChanged ? 'fc-tabin' : ''}${hostTheme(st) ? ' fc-host' : ''}" style="${hostVars(hostTheme(st))}">
        <div class="fc-top">
          <button class="fc-club" data-action="nav" data-v="home" title="Back to modes">${api.badge(t, 'sm')}<span class="fc-club-name">${esc(t.name)}</span><i class="fc-club-bar" style="--b:${C.board}%"></i><span class="fc-thumb ${C.board >= 60 ? 'good' : C.board >= 35 ? 'mid' : 'bad'}" aria-label="Board ${C.board}%">${C.board >= 60 ? '👍' : C.board >= 35 ? '✋' : '👎'}</span></button>
          <div class="fc-top-r"><button class="fc-chip" data-action="career-view" data-v="news">✉ Inbox <i>${Math.min(99, newsList.length)}</i></button><button class="fc-chip" data-action="career-market">⇄ Market</button><button class="fc-chip" data-action="nav" data-v="home">← Modes</button></div>
        </div>
        <div class="fc-tabs" role="tablist"><span class="fc-key" aria-hidden="true">Q</span>${TABS.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-action="career-tab" data-v="${k}">${l}</button>`).join('')}<span class="fc-key" aria-hidden="true">E</span></div>
        ${body}
        <div class="fc-legend"><span><kbd>Q</kbd><kbd>E</kbd> Switch tabs</span><span><kbd>1</kbd>–<kbd>5</kbd> Hub tiles</span><span class="fc-legend-r">${esc(api.regions[reg])} · ${esc(st.name)}</span></div>
      </div>`;
    if (enter) countUp(app);
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
    const hc = hostCity(st);
    api.launch(ev.cfg, eventTitle(st, reg), Object.assign({ career: { season: C.season, step: C.step } }, hc && HOST_PAL[hc] ? { theme: hostKey(hc) } : {}));
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
      case 'career-preview': api.state.ui.cpick = id; api.render(); return true;
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
      case 'career-tab': api.state.ui.ctab = v; api.render(); return true;
      case 'career-view': api.state.ui.ctab = 'central'; api.state.ui.cview = v; api.render(); return true;
      case 'career-news': api.state.ui.cnews = +v; api.state.ui.cview = 'next'; api.render(); return true;
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
    init(a) {
      api = a; E = a.E; load();
      document.addEventListener('keydown', (ev) => {
        if (api.state.view !== 'career' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
        if (!C) {
          if (document.querySelector('#modalRoot .modal') || /input|select|textarea/i.test((ev.target && ev.target.tagName) || '')) return;
          const nav = (d) => { const b = document.querySelectorAll('.cs-nav')[d > 0 ? 1 : 0]; if (b) { ev.preventDefault(); b.click(); } };
          if (ev.key === 'ArrowLeft') nav(-1); else if (ev.key === 'ArrowRight') nav(1);
          else if (ev.key === 'Enter' && !(ev.target && ev.target.closest && ev.target.closest('button'))) { const b = document.querySelector('.cs-go'); if (b) b.click(); }
          else if (ev.key === 'Escape') api.go('home');
          return;
        }
        if (document.querySelector('#modalRoot .modal') || /input|select|textarea/i.test((ev.target && ev.target.tagName) || '')) return;
        const TABS = ['central', 'squad', 'transfers', 'office', 'history'], VIEWS = ['next', 'standings', 'schedule', 'objectives', 'news'];
        const ui = api.state.ui, k = ev.key.toLowerCase();
        if (k === 'q' || k === 'e') { const i = TABS.indexOf(ui.ctab || 'central'); ui.ctab = TABS[(i + (k === 'e' ? 1 : TABS.length - 1)) % TABS.length]; api.render(); }
        else if (/^[1-5]$/.test(k)) { ui.ctab = 'central'; ui.cview = VIEWS[+k - 1]; api.render(); }
      });
    },
    render, onAction, recordFromT, simRest,
    has: () => !!C,
    teamObj: (id) => (C ? teamObj(id) : null),
    summary: () => (C ? { team: teamObj(C.user), season: C.season, step: SCHEDULE[C.step].name } : null),
    canAdvance: canAdvanceCheck,
    money,
  };
})(window);
