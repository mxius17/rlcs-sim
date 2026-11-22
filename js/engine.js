/* RL Esports Simulator — tournament + match engine (no DOM). */
(function (global) {
  'use strict';

  /* ---------------- Format catalogue ---------------- */
  const FORMATS = {
    knockout: {
      name: 'Knockout', short: 'Single elimination',
      desc: 'Win the series to advance. One defeat ends a team\'s run. Odd field sizes give the top seeds a bye.',
      sizes: [4, 6, 8, 12, 16, 20, 24, 32, 48, 64, 96, 128],
    },
    double: {
      name: 'Double elimination', short: 'Upper + lower bracket',
      desc: 'Every team gets a second life. Lose in the upper bracket and drop to the lower bracket; lose twice and you are out. Upper and lower bracket winners meet in the grand final. In uneven fields the top seeds get a bye (24 teams: seeds 1-8 start in Upper Round 2, like the 2027 Kick-Off).',
      sizes: [4, 8, 12, 16, 24, 32, 48, 64],
    },
    swiss: {
      name: 'Swiss + playoffs', short: 'RLCS open style',
      desc: 'Teams with the same record meet each round. Reach the win target to qualify, hit the loss limit and you are eliminated (3 wins / 3 losses with 16 teams). The top half moves on to a seeded single-elimination playoff.',
      sizes: [8, 16, 32, 64],
    },
    groups: {
      name: 'Groups + knockout', short: 'Round robin groups',
      desc: 'Single round-robin groups, then the qualifiers enter a seeded knockout bracket. Group winners face runners-up from another group.',
      sizes: [6, 8, 9, 10, 12, 15, 16, 18, 20, 24, 25, 30, 32, 36, 40, 48, 64],
      groups: true,
    },
    swiss8: {
      name: 'Swiss + Final Eight', short: 'RLCS 2027 Club Finale',
      desc: 'A 16-team Swiss stage (Bo5, 3 wins to advance, 3 losses out), then the AFL Final Eight (Bo7): the top four Swiss teams get a double chance, teams 5th-8th start with one life. Used by the 2027 Club Finale and the Kick-Off Opens.',
      sizes: [16],
    },
    major: {
      name: 'RLCS Major', short: 'Groups + Final Eight',
      desc: 'The 2026 Boston & Paris Major format. Four groups of four play a single round robin (Bo5). Group winners enter the upper side of an AFL-style Final Eight with a double chance; runners-up start with one life. Playoffs are Bo7.',
      sizes: [16],
    },
    league: {
      name: 'League', short: 'Round robin table',
      desc: 'Everyone plays everyone (once or home-and-away). Series wins decide the table, then game and goal difference. Top of the table is champion.',
      sizes: [4, 6, 8, 10, 12, 14, 16, 18, 20, 24],
    },
    leaguePlayoffs: {
      name: 'League + playoffs', short: 'Season + top 8',
      desc: 'A full round-robin regular season, then the top eight (top four in small leagues) play a seeded knockout playoff for the title.',
      sizes: [6, 8, 10, 12, 14, 16, 18, 20, 24],
    },
  };

  const SIM_STYLES = {
    realistic: { name: 'Realistic', k: 0.075, chaos: 0 },
    standard: { name: 'Standard', k: 0.055, chaos: 0.05 },
    chaos: { name: 'Pure chaos', k: 0.018, chaos: 0.25 },
  };
  const GOAL_LEVELS = { tight: { name: 'Tight games', g: 2.2 }, normal: { name: 'Normal', g: 3.1 }, fest: { name: 'Goal fest', g: 4.6 } };
  const PLAYSTYLES = {
    balanced: { name: 'Balanced', atk: 1, def: 1, str: 0, desc: 'No adjustments. Trust the rotation.' },
    aggressive: { name: 'Aggressive', atk: 1.18, def: 1.12, str: 0, desc: 'Push up, more shots for both sides.' },
    defensive: { name: 'Defensive', atk: 0.88, def: 0.84, str: 0, desc: 'Back-post heavy. Fewer goals both ways.' },
    possession: { name: 'Possession', atk: 1.0, def: 0.95, str: 1.5, desc: 'Control the ball. Small strength boost.' },
    demo: { name: 'Demo heavy', atk: 1.05, def: 1.0, str: 0.5, desc: 'Bump everything. More demos, a little extra pressure.' },
  };

  const rnd = Math.random;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pow2ceil = (n) => { let p = 1; while (p < n) p *= 2; return p; };
  const isPow2 = (n) => n > 0 && (n & (n - 1)) === 0;
  const groupLetter = (i) => (i < 26 ? String.fromCharCode(65 + i) : 'G' + (i + 1));
  function poisson(lambda) { const L = Math.exp(-lambda); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; }

  /** Standard seeded bracket order, e.g. 8 -> [1,8,4,5,2,7,3,6] */
  function seedOrder(n) {
    let order = [1, 2];
    while (order.length < n) {
      const m = order.length * 2 + 1;
      order = order.flatMap((s) => [s, m - s]);
    }
    return order;
  }

  function roundName(teamsLeft) {
    if (teamsLeft === 2) return 'Grand Final';
    if (teamsLeft === 4) return 'Semi-finals';
    if (teamsLeft === 8) return 'Quarter-finals';
    return 'Round of ' + teamsLeft;
  }

  function validSizes(format, cfg) {
    const f = FORMATS[format];
    if (!f) return [];
    if (format === 'groups') {
      const gs = cfg.groupSize || 4;
      return [4, 6, 8, 9, 10, 12, 15, 16, 18, 20, 24, 25, 28, 30, 32, 36, 40, 48, 64, 96, 128].filter((n) => n % gs === 0 && n / gs >= 2);
    }
    return f.sizes;
  }

  /* ---------------- Series length defaults ---------------- */
  /** RLCS default: Bo5 until the quarter-finals, Bo7 from the quarter-finals on (late = quarter-final stage or later). */
  function defaultBo(T, stageType, isFinal, late) {
    const s = T.settings;
    if (isFinal && s.finalBo && s.finalBo !== 'default') return +s.finalBo;
    if (s.seriesBo && s.seriesBo !== 'default') return +s.seriesBo;
    if (stageType === 'groups' || stageType === 'swiss' || stageType === 'league') return 5;
    return isFinal || late ? 7 : 5;
  }

  /* ---------------- Builders ---------------- */
  let _mid = 0;
  function newMatch(T, props) {
    const id = props.id || ('m' + (++_mid));
    const m = Object.assign({ id, a: null, b: null, bo: 5, result: null, day: 0 }, props, { id });
    T.matches[id] = m;
    T.order.push(id);
    return m;
  }

  function roundRobinPairs(ids, legs) {
    const teams = ids.slice();
    if (teams.length % 2) teams.push(null);
    const n = teams.length, rounds = [];
    const arr = teams.slice();
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const x = arr[i], y = arr[n - 1 - i];
        if (x !== null && y !== null) pairs.push(r % 2 === 0 ? [x, y] : [y, x]);
      }
      rounds.push(pairs);
      arr.splice(1, 0, arr.pop());
    }
    if (legs === 2) {
      const back = rounds.map((rp) => rp.map(([x, y]) => [y, x]));
      return rounds.concat(back);
    }
    return rounds;
  }

  /** Build a single-elim bracket from a list of seed sources (index 0 = seed 1). */
  function buildKnockout(T, stageId, seeds, opts) {
    opts = opts || {};
    const n = seeds.length;
    const P = pow2ceil(n);
    const order = seedOrder(P);
    let prev = [];
    for (let i = 0; i < P; i += 2) {
      const sa = order[i] <= n ? seeds[order[i] - 1] : { t: 'bye' };
      const sb = order[i + 1] <= n ? seeds[order[i + 1] - 1] : { t: 'bye' };
      prev.push({ sa, sb });
    }
    const rounds = Math.log2(P);
    const dayBase = opts.dayBase || 0;
    const stage = T.stages.find((s) => s.id === stageId);
    let left = P, prevIds = [];
    for (let r = 0; r < rounds; r++) {
      const name = roundName(left);
      const isFinal = left === 2;
      const ids = [];
      const count = left / 2;
      for (let k = 0; k < count; k++) {
        const sa = r === 0 ? prev[k].sa : { t: 'W', m: prevIds[2 * k] };
        const sb = r === 0 ? prev[k].sb : { t: 'W', m: prevIds[2 * k + 1] };
        const m = newMatch(T, {
          id: stageId + '-r' + (r + 1) + '-' + (k + 1), stage: stageId, round: r, roundName: name, label: name === 'Grand Final' ? 'Grand Final' : name + ' · Match ' + (k + 1),
          sa, sb, bo: defaultBo(T, 'bracket', isFinal, left <= 8), day: dayBase + r, section: 'main',
        });
        ids.push(m.id);
      }
      stage.rounds.push({ name, ids, section: 'main' });
      prevIds = ids;
      left /= 2;
    }
    if (opts.thirdPlace && P >= 4) {
      const sfRound = stage.rounds[stage.rounds.length - 2];
      const m = newMatch(T, {
        id: stageId + '-3rd', stage: stageId, round: rounds - 1, roundName: 'Third-place match', label: 'Third-place match',
        sa: { t: 'L', m: sfRound.ids[0] }, sb: { t: 'L', m: sfRound.ids[1] }, bo: defaultBo(T, 'bracket', false, true), day: dayBase + rounds - 1, section: 'third',
      });
      stage.rounds.push({ name: 'Third place', ids: [m.id], section: 'third' });
    }
    stage.finalId = prevIds[0];
    return stage;
  }

  function buildDouble(T, stageId, seeds) {
    const n = seeds.length; // power of two
    const order = seedOrder(n);
    const stage = T.stages.find((s) => s.id === stageId);
    const k = Math.log2(n);
    const wb = [];
    let left = n;
    for (let r = 0; r < k; r++) {
      const ids = [];
      for (let i = 0; i < left / 2; i++) {
        const sa = r === 0 ? seeds[order[2 * i] - 1] : { t: 'W', m: wb[r - 1][2 * i] };
        const sb = r === 0 ? seeds[order[2 * i + 1] - 1] : { t: 'W', m: wb[r - 1][2 * i + 1] };
        const name = left === 2 ? 'Upper Final' : left === 4 ? 'Upper Semi-finals' : left === 8 ? 'Upper Quarter-finals' : 'Upper Round ' + (r + 1);
        const m = newMatch(T, { id: stageId + '-u' + (r + 1) + '-' + (i + 1), stage: stageId, roundName: name, label: name + ' · Match ' + (i + 1), sa, sb, bo: defaultBo(T, 'bracket', false, left <= 8), day: r === 0 ? 0 : 2 * r - 1, section: 'upper' });
        ids.push(m.id);
      }
      wb.push(ids);
      stage.rounds.push({ name: wb[r].length === 1 ? 'Upper Final' : 'Upper R' + (r + 1), ids, section: 'upper' });
      left /= 2;
    }
    // lower bracket
    const lb = [];
    let lbIdx = 0;
    // lower-bracket rounds go Bo7 once the upper bracket has reached its quarter-finals
    const mkLB = (pairs, name, day, late) => {
      lbIdx++;
      const ids = pairs.map((p, i) => newMatch(T, { id: stageId + '-l' + lbIdx + '-' + (i + 1), stage: stageId, roundName: name, label: name + ' · Match ' + (i + 1), sa: p[0], sb: p[1], bo: defaultBo(T, 'bracket', false, late), day, section: 'lower' }).id);
      lb.push(ids);
      stage.rounds.push({ name, ids, section: 'lower' });
      return ids;
    };
    let cur;
    if (k === 1) {
      cur = null;
    } else {
      const pairs = [];
      for (let i = 0; i < wb[0].length; i += 2) pairs.push([{ t: 'L', m: wb[0][i] }, { t: 'L', m: wb[0][i + 1] }]);
      cur = mkLB(pairs, 'Lower Round 1', 1, n <= 8);
      for (let r = 1; r < k; r++) {
        const losers = wb[r].slice().reverse();
        const dropPairs = cur.map((id, i) => [{ t: 'W', m: id }, { t: 'L', m: losers[i] }]);
        const isLF = r === k - 1;
        const lateLB = n / Math.pow(2, r) <= 8;
        cur = mkLB(dropPairs, isLF ? 'Lower Final' : 'Lower Round ' + (lbIdx + 1), 2 * r, lateLB);
        if (!isLF) {
          const cp = [];
          for (let i = 0; i < cur.length; i += 2) cp.push([{ t: 'W', m: cur[i] }, { t: 'W', m: cur[i + 1] }]);
          cur = mkLB(cp, cp.length === 1 ? 'Lower Semi-final' : 'Lower Round ' + (lbIdx + 1), 2 * r + 1, lateLB);
        }
      }
    }
    const gfDay = 2 * k;
    const gf = newMatch(T, {
      id: stageId + '-gf', stage: stageId, roundName: 'Grand Final', label: 'Grand Final',
      sa: { t: 'W', m: wb[k - 1][0] }, sb: k === 1 ? { t: 'L', m: wb[0][0] } : { t: 'W', m: cur[0] }, bo: defaultBo(T, 'bracket', true), day: gfDay, section: 'final',
    });
    stage.rounds.push({ name: 'Grand Final', ids: [gf.id], section: 'final' });
    stage.finalId = gf.id;
  }

  function buildFinalEight(T, stageId, gstage, fromSwiss) {
    const stage = T.stages.find((s) => s.id === stageId);
    const bo = defaultBo(T, 'bracket', false, true), fbo = defaultBo(T, 'bracket', true);
    const W = (i) => (fromSwiss ? { t: 'sq', stage: gstage, rank: i } : { t: 'gq', stage: gstage, place: 1, rank: i });
    const R = (i) => (fromSwiss ? { t: 'sq', stage: gstage, rank: 4 + i } : { t: 'gq', stage: gstage, place: 2, rank: i });
    const mk = (id, name, label, sa, sb, day, section, b) => newMatch(T, { id: stageId + '-' + id, stage: stageId, roundName: name, label, sa, sb, bo: b || bo, day, section }).id;
    const uq1 = mk('uq1', 'Upper Quarter-finals', 'Upper QF 1', W(1), W(4), 0, 'upper');
    const uq2 = mk('uq2', 'Upper Quarter-finals', 'Upper QF 2', W(2), W(3), 0, 'upper');
    const l1a = mk('l1a', 'Lower Round 1', 'Lower R1 · Match 1', R(1), R(4), 0, 'lower');
    const l1b = mk('l1b', 'Lower Round 1', 'Lower R1 · Match 2', R(2), R(3), 0, 'lower');
    const lq1 = mk('lq1', 'Lower Quarter-finals', 'Lower QF 1', { t: 'L', m: uq1 }, { t: 'W', m: l1b }, 1, 'lower');
    const lq2 = mk('lq2', 'Lower Quarter-finals', 'Lower QF 2', { t: 'L', m: uq2 }, { t: 'W', m: l1a }, 1, 'lower');
    const sf1 = mk('sf1', 'Semi-finals', 'Semi-final 1', { t: 'W', m: uq1 }, { t: 'W', m: lq2 }, 2, 'main');
    const sf2 = mk('sf2', 'Semi-finals', 'Semi-final 2', { t: 'W', m: uq2 }, { t: 'W', m: lq1 }, 2, 'main');
    const gf = mk('gf', 'Grand Final', 'Grand Final', { t: 'W', m: sf1 }, { t: 'W', m: sf2 }, 3, 'final', fbo);
    stage.rounds.push({ name: 'Upper QF', ids: [uq1, uq2], section: 'upper' });
    stage.rounds.push({ name: 'Lower R1', ids: [l1a, l1b], section: 'lower' });
    stage.rounds.push({ name: 'Lower QF', ids: [lq1, lq2], section: 'lower' });
    stage.rounds.push({ name: 'Semi-finals', ids: [sf1, sf2], section: 'main' });
    stage.rounds.push({ name: 'Grand Final', ids: [gf], section: 'final' });
    stage.finalId = gf;
  }

  function buildRoundRobinStage(T, stageId, type, groupsTeams, legs) {
    const stage = T.stages.find((s) => s.id === stageId);
    stage.groups = groupsTeams.map((ids, gi) => ({ name: type === 'league' ? 'League' : 'Group ' + groupLetter(gi), teams: ids.slice(), matchIds: [] }));
    stage.groups.forEach((g, gi) => {
      const rounds = roundRobinPairs(g.teams, legs);
      rounds.forEach((pairs, r) => {
        pairs.forEach(([x, y], pi) => {
          const m = newMatch(T, {
            id: stageId + '-g' + gi + '-d' + (r + 1) + '-' + (pi + 1), stage: stageId, group: gi,
            roundName: (type === 'league' ? 'Matchday ' : 'Matchday ') + (r + 1), label: g.name + ' · Matchday ' + (r + 1),
            sa: { t: 'team', id: x }, sb: { t: 'team', id: y }, bo: defaultBo(T, type === 'league' ? 'league' : 'groups', false), day: r,
          });
          g.matchIds.push(m.id);
        });
      });
    });
  }

  function arrangeGroups(slots, groupSize) {
    const out = [];
    for (let i = 0; i < slots.length; i += groupSize) out.push(slots.slice(i, i + groupSize));
    return out;
  }

  /**
   * Build a tournament from setup config.
   * cfg: { format, size, teams:[ids], groupSize, advance, legs, thirdPlace, seriesBo, finalBo, simStyle, goalLevel, matchType, managed, overrides }
   */
  function buildTournament(cfg, teamLookup) {
    _mid = 0;
    const T = {
      v: 2, created: Date.now(), format: cfg.format, size: cfg.size,
      settings: { simStyle: cfg.simStyle, goalLevel: cfg.goalLevel, seriesBo: cfg.seriesBo, finalBo: cfg.finalBo, matchType: cfg.matchType, thirdPlace: cfg.thirdPlace },
      teams: cfg.teams.slice(), managed: cfg.managed || null, playstyle: 'balanced',
      stages: [], matches: {}, order: [], overrides: Object.assign({}, cfg.overrides || {}),
      stats: {}, stories: [], champion: null, finished: false, eliminated: {},
    };
    const ids = cfg.teams.slice();
    const seedsOf = (list) => list.map((id) => ({ t: 'team', id }));
    switch (cfg.format) {
      case 'knockout': {
        T.stages.push({ id: 'ko', type: 'bracket', name: 'Bracket', rounds: [] });
        buildKnockout(T, 'ko', seedsOf(ids), { thirdPlace: cfg.thirdPlace });
        break;
      }
      case 'double': {
        T.stages.push({ id: 'de', type: 'bracket', kind: 'double', name: 'Double elimination', rounds: [] });
        const seeds = seedsOf(ids);
        while (!isPow2(seeds.length)) seeds.push({ t: 'bye' });
        buildDouble(T, 'de', seeds);
        break;
      }
      case 'swiss8':
      case 'swiss': {
        const n = ids.length;
        const target = Math.log2(n) - 1;
        T.stages.push({ id: 'sw', type: 'swiss', name: 'Swiss stage', teams: ids.slice(), target, rounds: [], records: {} });
        ids.forEach((id) => (T.stages[0].records[id] = { w: 0, l: 0, gd: 0, opp: [], seed: ids.indexOf(id) }));
        const half = n / 2;
        const pairs = [];
        for (let i = 0; i < half; i++) pairs.push([ids[i], ids[i + half]]);
        addSwissRound(T, T.stages[0], pairs);
        if (cfg.format === 'swiss8') {
          T.stages.push({ id: 'f8', type: 'bracket', kind: 'final8', name: 'Playoffs', rounds: [], pending: true, from: 'sw' });
          buildFinalEight(T, 'f8', 'sw', true);
          Object.values(T.matches).forEach((m) => { if (m.stage === 'f8') m.day += 100; });
          break;
        }
        T.stages.push({ id: 'po', type: 'bracket', name: 'Playoffs', rounds: [], pending: true, from: 'sw', qualifiers: n / 2 });
        const seeds = Array.from({ length: n / 2 }, (_, i) => ({ t: 'sq', stage: 'sw', rank: i + 1 }));
        buildKnockout(T, 'po', seeds, { thirdPlace: cfg.thirdPlace, dayBase: 100 });
        break;
      }
      case 'groups': {
        const gs = cfg.groupSize || 4;
        const adv = Math.min(cfg.advance || 2, gs - 1);
        const groups = arrangeGroups(ids, gs);
        T.stages.push({ id: 'gr', type: 'groups', name: 'Group stage', advance: adv });
        buildRoundRobinStage(T, 'gr', 'groups', groups, 1);
        const G = groups.length;
        T.stages.push({ id: 'ko', type: 'bracket', name: 'Knockout', rounds: [], pending: true, from: 'gr' });
        buildKnockout(T, 'ko', orderGroupSeeds(G, adv), { thirdPlace: cfg.thirdPlace, dayBase: 100 });
        break;
      }
      case 'major': {
        const groups = arrangeGroups(ids, 4);
        T.stages.push({ id: 'gr', type: 'groups', name: 'Group stage', advance: 2 });
        buildRoundRobinStage(T, 'gr', 'groups', groups, 1);
        T.stages.push({ id: 'f8', type: 'bracket', kind: 'final8', name: 'Playoffs', rounds: [], pending: true, from: 'gr' });
        buildFinalEight(T, 'f8', 'gr');
        Object.values(T.matches).forEach((m) => { if (m.stage === 'f8') m.day += 100; });
        break;
      }
      case 'league':
      case 'leaguePlayoffs': {
        T.stages.push({ id: 'lg', type: 'league', name: 'Regular season', advance: 0 });
        buildRoundRobinStage(T, 'lg', 'league', [ids], cfg.legs || 1);
        if (cfg.format === 'leaguePlayoffs') {
          const q = ids.length >= 12 ? 8 : 4;
          T.stages[0].advance = q;
          T.stages.push({ id: 'ko', type: 'bracket', name: 'Playoffs', rounds: [], pending: true, from: 'lg' });
          const seeds = Array.from({ length: q }, (_, i) => ({ t: 'gp', stage: 'lg', group: 0, place: i + 1 }));
          buildKnockout(T, 'ko', seeds, { thirdPlace: cfg.thirdPlace, dayBase: 100 });
        }
        break;
      }
    }
    // Apply per-match series length overrides
    Object.entries(T.overrides).forEach(([mid, ov]) => { if (T.matches[mid] && ov.bo) T.matches[mid].bo = ov.bo; });
    ids.forEach((id) => (T.stats[id] = T.stats[id] || {}));
    return T;
  }

  /** Order group qualifiers into seeds so that bracket R1 pits a winner vs another group's runner-up. */
  function orderGroupSeeds(G, adv) {
    const out = [];
    // seed list: all winners (A1..), then runners-up arranged so seed i (winner of group i) meets runner-up of group i+1
    for (let g = 0; g < G; g++) out.push({ t: 'gp', stage: 'gr', group: g, place: 1 });
    if (adv >= 2) {
      const ru = new Array(G);
      for (let k = 0; k < G; k++) ru[k] = { t: 'gp', stage: 'gr', group: (G - k) % G, place: 2 };
      // seed G+1+k ; seed (2G - i + 1) pairs with seed i when 2G is a power of two
      out.push(...ru);
    }
    for (let place = 3; place <= adv; place++) {
      for (let g = 0; g < G; g++) out.push({ t: 'gp', stage: 'gr', group: (g + place - 1) % G, place });
    }
    return out;
  }

  /* ---------------- Swiss ---------------- */
  function addSwissRound(T, stage, pairs) {
    const r = stage.rounds.length;
    const ids = pairs.map(([x, y], i) => {
      const rx = stage.records[x];
      const m = newMatch(T, {
        id: 'sw-r' + (r + 1) + '-' + (i + 1), stage: 'sw', roundName: 'Swiss Round ' + (r + 1), label: 'Round ' + (r + 1) + ' · ' + rx.w + '-' + rx.l + ' pool',
        sa: { t: 'team', id: x }, sb: { t: 'team', id: y }, bo: defaultBo(T, 'swiss', false), day: r, pool: rx.w + '-' + rx.l,
      });
      if (T.overrides[m.id] && T.overrides[m.id].bo) m.bo = T.overrides[m.id].bo;
      return m.id;
    });
    stage.rounds.push({ name: 'Round ' + (r + 1), ids });
  }

  function swissNextRound(T, stage) {
    const active = stage.teams.filter((id) => { const r = stage.records[id]; return r.w < stage.target && r.l < stage.target; });
    if (!active.length) { stage.done = true; return false; }
    const pools = {};
    active.forEach((id) => { const r = stage.records[id]; (pools[r.w + '-' + r.l] = pools[r.w + '-' + r.l] || []).push(id); });
    const pairs = [];
    Object.keys(pools).sort((a, b) => { const [aw, al] = a.split('-').map(Number); const [bw, bl] = b.split('-').map(Number); return (bw - bl) - (aw - al) || bw - aw; }).forEach((key) => {
      const p = pools[key].slice().sort((a, b) => (stage.records[b].gd - stage.records[a].gd) || (stage.records[a].seed - stage.records[b].seed));
      while (p.length >= 2) {
        const top = p.shift();
        let j = p.length - 1;
        while (j > 0 && stage.records[top].opp.includes(p[j])) j--;
        const opp = p.splice(j, 1)[0];
        pairs.push([top, opp]);
      }
      if (p.length) pairs.push([p[0], null]);
    });
    const real = pairs.filter((x) => x[1] !== null);
    pairs.filter((x) => x[1] === null).forEach(([id]) => { stage.records[id].w++; });
    addSwissRound(T, stage, real);
    return true;
  }

  function swissStandings(stage) {
    return stage.teams.slice().sort((a, b) => {
      const A = stage.records[a], B = stage.records[b];
      const aq = A.w >= stage.target ? 1 : 0, bq = B.w >= stage.target ? 1 : 0;
      return (bq - aq) || (A.l - B.l) || (B.w - A.w) || (B.gd - A.gd) || (A.seed - B.seed);
    });
  }

  /* ---------------- Standings ---------------- */
  function groupTable(T, stageId, gi) {
    const stage = T.stages.find((s) => s.id === stageId);
    const g = stage.groups[gi];
    const rows = {};
    g.teams.forEach((id, i) => (rows[id] = { id, p: 0, w: 0, l: 0, gw: 0, gl: 0, gf: 0, ga: 0, seed: i }));
    g.matchIds.forEach((mid) => {
      const m = T.matches[mid];
      if (!m.result) return;
      const a = rows[m.a], b = rows[m.b];
      if (!a || !b) return;
      a.p++; b.p++;
      a.gw += m.result.sa; a.gl += m.result.sb; b.gw += m.result.sb; b.gl += m.result.sa;
      a.gf += m.result.goalsA; a.ga += m.result.goalsB; b.gf += m.result.goalsB; b.ga += m.result.goalsA;
      if (m.result.winner === m.a) { a.w++; b.l++; } else { b.w++; a.l++; }
    });
    const list = Object.values(rows);
    list.forEach((r) => { r.gd = r.gw - r.gl; r.goalD = r.gf - r.ga; r.pts = r.w * 3; });
    list.sort((x, y) => (y.w - x.w) || (y.gd - x.gd) || (y.goalD - x.goalD) || (y.gf - x.gf) || (x.seed - y.seed));
    return list;
  }

  function stageComplete(T, stage) {
    if (stage.type === 'swiss') return !!stage.done;
    const ids = Object.values(T.matches).filter((m) => m.stage === stage.id);
    return ids.length > 0 && ids.every((m) => m.result);
  }

  /* ---------------- Source resolution ---------------- */
  function resolve(T, src) {
    if (!src) return undefined;
    switch (src.t) {
      case 'team': return src.id;
      case 'bye': return 'BYE';
      case 'W': case 'L': {
        const m = T.matches[src.m];
        if (!m || !m.result) return undefined;
        if (src.t === 'W') return m.result.winner;
        return m.result.loser === 'BYE' ? 'BYE' : m.result.loser;
      }
      case 'gp': {
        const stage = T.stages.find((s) => s.id === src.stage);
        if (!stage || !stageComplete(T, stage)) return undefined;
        const tbl = groupTable(T, src.stage, src.group);
        return tbl[src.place - 1] ? tbl[src.place - 1].id : 'BYE';
      }
      case 'gq': { // ranked among group finishers of given place
        const stage = T.stages.find((s) => s.id === src.stage);
        if (!stage || !stageComplete(T, stage)) return undefined;
        const rows = stage.groups.map((g, gi) => groupTable(T, src.stage, gi)[src.place - 1]);
        rows.sort((x, y) => (y.w - x.w) || (y.gd - x.gd) || (y.goalD - x.goalD) || (x.seed - y.seed));
        return rows[src.rank - 1] ? rows[src.rank - 1].id : 'BYE';
      }
      case 'sq': {
        const stage = T.stages.find((s) => s.id === src.stage);
        if (!stage || !stage.done) return undefined;
        return swissStandings(stage)[src.rank - 1];
      }
    }
    return undefined;
  }

  function sourceLabel(T, src) {
    if (!src) return 'TBD';
    switch (src.t) {
      case 'bye': return 'BYE';
      case 'W': return 'Winner of ' + shortLabel(T.matches[src.m]);
      case 'L': return 'Loser of ' + shortLabel(T.matches[src.m]);
      case 'gp': {
        const st = T.stages.find((s) => s.id === src.stage);
        const gname = st && st.groups ? st.groups[src.group].name : 'Group';
        return ordinal(src.place) + ' · ' + gname;
      }
      case 'gq': return (src.place === 1 ? 'Group winner' : 'Group runner-up') + ' #' + src.rank;
      case 'sq': return 'Swiss seed ' + src.rank;
    }
    return 'TBD';
  }
  function shortLabel(m) { return m ? m.label.replace(' · Match ', ' M') : '?'; }
  function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  /** Refresh team slots for all matches; auto-resolve byes. Returns true if anything changed. */
  function refresh(T) {
    let changed = true, loops = 0;
    while (changed && loops++ < 50) {
      changed = false;
      for (const id of T.order) {
        const m = T.matches[id];
        const a = resolve(T, m.sa), b = resolve(T, m.sb);
        if (m.a !== a) { m.a = a; changed = true; }
        if (m.b !== b) { m.b = b; changed = true; }
        if (!m.result && (a === 'BYE' || b === 'BYE') && a !== undefined && b !== undefined) {
          const w = a === 'BYE' ? b : a;
          const l = a === 'BYE' ? a : b;
          m.result = { winner: w, loser: l, bye: true, sa: 0, sb: 0, games: [], goalsA: 0, goalsB: 0 };
          changed = true;
        }
      }
      // Swiss progression
      T.stages.forEach((st) => {
        if (st.type !== 'swiss' || st.done) return;
        const last = st.rounds[st.rounds.length - 1];
        if (last.ids.every((mid) => T.matches[mid].result)) {
          if (swissNextRound(T, st)) changed = true; else changed = true;
        }
      });
    }
    // champion
    const finalStage = T.stages[T.stages.length - 1];
    if (finalStage.type === 'bracket') {
      const fm = T.matches[finalStage.finalId];
      if (fm && fm.result && !fm.result.bye) { T.champion = fm.result.winner; T.runnerUp = fm.result.loser; }
      else if (fm && fm.result) { T.champion = fm.result.winner; }
    } else if (stageComplete(T, finalStage)) {
      const tbl = groupTable(T, finalStage.id, 0);
      T.champion = tbl[0].id; T.runnerUp = tbl[1] && tbl[1].id;
    }
    const allDone = T.order.every((id) => T.matches[id].result);
    T.finished = !!T.champion && allDone;
    return T;
  }

  function isReady(m) { return !m.result && m.a && m.b && m.a !== 'BYE' && m.b !== 'BYE'; }
  function readyMatches(T) { return T.order.map((id) => T.matches[id]).filter(isReady); }
  function nextDay(T) {
    const r = readyMatches(T);
    if (!r.length) return null;
    return Math.min(...r.map((m) => m.day));
  }

  /* ---------------- Elimination tracking ---------------- */
  function aliveTeams(T) {
    // team is alive if it appears (or could) in an unplayed match. Approximate: team not eliminated.
    return T.teams.filter((id) => !T.eliminated[id]);
  }
  function updateEliminations(T, lastMatch) {
    const out = [];
    const check = (id) => {
      if (!id || id === 'BYE' || T.eliminated[id]) return;
      if (!teamHasFuture(T, id)) { T.eliminated[id] = true; out.push(id); }
    };
    if (lastMatch) { check(lastMatch.a); check(lastMatch.b); }
    // stage completions can eliminate many teams
    T.teams.forEach(check);
    return out;
  }
  function teamHasFuture(T, id) {
    if (T.champion === id) return false;
    // any unplayed match where team is or may become a participant?
    for (const mid of T.order) {
      const m = T.matches[mid];
      if (m.result) continue;
      if (m.a === id || m.b === id) return true;
    }
    // pending sources: groups/swiss not complete, team still in contention
    for (const st of T.stages) {
      if (st.type === 'groups' || st.type === 'league') {
        if (!stageComplete(T, st)) {
          const inStage = st.groups.some((g) => g.teams.includes(id));
          if (inStage) return true;
        }
      }
      if (st.type === 'swiss' && !st.done) {
        const r = st.records[id];
        if (r && r.w < st.target && r.l < st.target) return true;
        if (r && r.w >= st.target) return true; // qualified, awaiting playoffs
      }
    }
    // unresolved bracket slots that could resolve to the team
    for (const mid of T.order) {
      const m = T.matches[mid];
      if (m.result) continue;
      for (const s of [m.sa, m.sb]) {
        if ((s.t === 'W' || s.t === 'L')) {
          const src = T.matches[s.m];
          if (src && !src.result && (src.a === id || src.b === id)) return true;
        }
      }
    }
    return false;
  }

  /* ---------------- Match simulation ---------------- */
  function teamStrength(team) {
    const ps = (team.players || []).slice(0, 3);
    if (!ps.length) return team.rating || 70;
    return ps.reduce((s, p) => s + p.rating, 0) / ps.length;
  }

  function matchupParams(T, A, B) {
    const style = SIM_STYLES[T.settings.simStyle] || SIM_STYLES.standard;
    const goals = (GOAL_LEVELS[T.settings.goalLevel] || GOAL_LEVELS.normal).g;
    const psA = A.id === T.managed ? PLAYSTYLES[T.playstyle] || PLAYSTYLES.balanced : PLAYSTYLES.balanced;
    const psB = B.id === T.managed ? PLAYSTYLES[T.playstyle] || PLAYSTYLES.balanced : PLAYSTYLES.balanced;
    const sA = teamStrength(A) + psA.str, sB = teamStrength(B) + psB.str;
    // 1v1 and 2v2: fewer goals than 3v3 (more space, but one or two attackers)
    const n = Math.min(3, (A.players || []).length || 3, (B.players || []).length || 3);
    return { style, goals: goals * (n === 1 ? 0.74 : n === 2 ? 0.9 : 1), psA, psB, sA, sB };
  }

  /** Simulate one game. Returns {ga, gb, ot, otTime, events:[...], pstats} */
  function simGame(T, A, B, params, forceWinner, isOTOnly) {
    const { style, goals, psA, psB } = params;
    const tries = forceWinner ? 40 : 1;
    let g;
    for (let t = 0; t < tries; t++) {
      g = simGameOnce(T, A, B, params, isOTOnly);
      if (!forceWinner) break;
      const w = g.ga > g.gb ? 'A' : 'B';
      if (w === forceWinner) break;
    }
    if (forceWinner) {
      const w = g.ga > g.gb ? 'A' : 'B';
      if (w !== forceWinner) {
        // swap a goal into OT to honour override
        g = simGameOnce(T, A, B, params, true, forceWinner);
      }
    }
    return g;
  }

  function simGameOnce(T, A, B, params, otOnly, forceOT) {
    const { style, goals, psA, psB, sA, sB } = params;
    const d = sA - sB;
    let pA = 1 / (1 + Math.exp(-style.k * d));
    if (style.chaos) pA = clamp(pA + (rnd() - 0.5) * style.chaos * 2, 0.08, 0.92);
    const lamA = goals * pA * psA.atk * psB.def * (0.85 + rnd() * 0.3);
    const lamB = goals * (1 - pA) * psB.atk * psA.def * (0.85 + rnd() * 0.3);
    const events = [];
    const pst = {};
    const P = (team, side) => team.players.slice(0, 3).map((p) => { const k = side + ':' + p.name; pst[k] = pst[k] || { name: p.name, team: team.id, side, g: 0, a: 0, sv: 0, sh: 0, dm: 0, score: 0 }; return pst[k]; });
    const pa = P(A, 'A'), pb = P(B, 'B');
    const weighted = (team, list, pow) => {
      const ps = team.players.slice(0, 3);
      const w = ps.map((p) => Math.pow(Math.max(30, p.rating) / 80, pow || 3) * (0.6 + rnd() * 0.8));
      let s = w.reduce((x, y) => x + y, 0), r = rnd() * s;
      for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
      return list[list.length - 1];
    };
    let ga = 0, gb = 0;
    const addGoal = (side, time, ot) => {
      const team = side === 'A' ? A : B, list = side === 'A' ? pa : pb;
      const scorer = weighted(team, list, 3);
      let assist = null;
      if (rnd() < 0.62) { const others = list.filter((x) => x !== scorer); assist = others[Math.floor(rnd() * others.length)]; }
      scorer.g++; scorer.sh++; scorer.score += 100 + 20; if (assist) { assist.a++; assist.score += 50; }
      if (side === 'A') ga++; else gb++;
      events.push({ t: time, type: 'goal', side, scorer: scorer.name, assist: assist && assist.name, ot: !!ot, score: [ga, gb], speed: Math.round(70 + rnd() * 75) });
    };
    if (!otOnly) {
      const na = poisson(lamA), nb = poisson(lamB);
      const times = [];
      for (let i = 0; i < na; i++) times.push(['A', rnd() * 298 + 1]);
      for (let i = 0; i < nb; i++) times.push(['B', rnd() * 298 + 1]);
      times.sort((x, y) => x[1] - y[1]).forEach(([s, t]) => addGoal(s, t));
      // non-goal shots and saves
      const extraShots = (lam, side) => poisson(lam * 2.6 + 3);
      const sides = [['A', lamA, pa, pb, A, B], ['B', lamB, pb, pa, B, A]];
      sides.forEach(([side, lam, list, olist, team, oteam]) => {
        const n = extraShots(lam, side);
        for (let i = 0; i < n; i++) {
          const shooter = weighted(team, list, 2);
          shooter.sh++; shooter.score += 20;
          const t = rnd() * 299;
          if (rnd() < 0.58) {
            const saver = weighted(oteam, olist, 2);
            saver.sv++; saver.score += 50;
            events.push({ t, type: 'save', side, shooter: shooter.name, saver: saver.name, epic: rnd() < 0.12 });
          } else events.push({ t, type: 'miss', side, shooter: shooter.name });
        }
        const demos = poisson((side === 'A' && psA === PLAYSTYLES.demo) || (side === 'B' && psB === PLAYSTYLES.demo) ? 3.4 : 1.7);
        for (let i = 0; i < demos; i++) {
          const who = list[Math.floor(rnd() * list.length)]; const vic = olist[Math.floor(rnd() * olist.length)];
          who.dm++; who.score += 15;
          events.push({ t: rnd() * 299, type: 'demo', side, who: who.name, victim: vic.name });
        }
      });
    }
    let ot = false, otTime = 0;
    if (ga === gb) {
      ot = true;
      otTime = Math.min(-Math.log(1 - rnd()) * 70 + 2, 600);
      let side = rnd() < pA ? 'A' : 'B';
      if (forceOT) side = forceOT;
      // some OT shots first
      const n = poisson(otTime / 40);
      for (let i = 0; i < n; i++) {
        const s = rnd() < 0.5 ? 'A' : 'B';
        const list = s === 'A' ? pa : pb, olist = s === 'A' ? pb : pa;
        const shooter = list[Math.floor(rnd() * list.length)], saver = olist[Math.floor(rnd() * olist.length)];
        shooter.sh++; shooter.score += 20; saver.sv++; saver.score += 50;
        events.push({ t: 300 + rnd() * otTime, type: 'save', side: s, shooter: shooter.name, saver: saver.name, ot: true });
      }
      addGoal(side, 300 + otTime, true);
    }
    events.sort((x, y) => x.t - y.t);
    // Recount: if forced OT path from otOnly with forceOT ensure winner
    // win bonus
    const winSide = ga > gb ? 'A' : 'B';
    Object.values(pst).forEach((p) => { if (p.side === winSide) p.score += 0; });
    return { ga, gb, ot, otTime, events, pstats: Object.values(pst) };
  }

  /** Simulate a full series. Honours overrides {winner:'A'|'B', sa, sb}. */
  function simSeries(T, m, getTeam) {
    const A = getTeam(m.a), B = getTeam(m.b);
    const params = matchupParams(T, A, B);
    const need = Math.ceil(m.bo / 2);
    const ov = T.overrides[m.id];
    let plan = null;
    if (ov && ov.winner) {
      let wa = ov.winner === 'A' ? need : (ov.sa != null ? +ov.sa : Math.floor(rnd() * need));
      let wb = ov.winner === 'B' ? need : (ov.sb != null ? +ov.sb : Math.floor(rnd() * need));
      if (ov.winner === 'A') wb = Math.min(wb, need - 1); else wa = Math.min(wa, need - 1);
      const seq = shuffle([].concat(Array(ov.winner === 'A' ? wa - 1 : wa).fill('A'), Array(ov.winner === 'B' ? wb - 1 : wb).fill('B')));
      seq.push(ov.winner);
      plan = seq;
    }
    const otOnly = T.settings.matchType === 'ot';
    let sa = 0, sb = 0;
    const games = [];
    let gi = 0;
    while (sa < need && sb < need) {
      const fw = plan ? plan[gi] : null;
      const g = simGame(T, A, B, params, fw, otOnly);
      games.push(g);
      if (g.ga > g.gb) sa++; else sb++;
      gi++;
      if (gi > 15) break;
    }
    const winner = sa > sb ? m.a : m.b;
    const loser = winner === m.a ? m.b : m.a;
    const goalsA = games.reduce((s, g) => s + g.ga, 0), goalsB = games.reduce((s, g) => s + g.gb, 0);
    return { winner, loser, sa, sb, games, goalsA, goalsB, upset: (params.sA - params.sB) * (winner === m.a ? -1 : 1) > 4 };
  }

  function commitResult(T, m, res) {
    m.result = res;
    // aggregate player stats
    res.games.forEach((g) => {
      g.pstats.forEach((p) => {
        const key = p.team + '|' + p.name;
        const s = T.stats[key] || (T.stats[key] = { name: p.name, team: p.team, gp: 0, g: 0, a: 0, sv: 0, sh: 0, dm: 0, score: 0 });
        s.gp++; s.g += p.g; s.a += p.a; s.sv += p.sv; s.sh += p.sh; s.dm += p.dm; s.score += p.score;
      });
    });
    // swiss record
    if (m.stage === 'sw') {
      const st = T.stages.find((s) => s.id === 'sw');
      const ra = st.records[m.a], rb = st.records[m.b];
      if (res.winner === m.a) { ra.w++; rb.l++; } else { rb.w++; ra.l++; }
      ra.gd += res.sa - res.sb; rb.gd += res.sb - res.sa;
      ra.opp.push(m.b); rb.opp.push(m.a);
    }
    refresh(T);
  }

  global.RLEngine = {
    FORMATS, SIM_STYLES, GOAL_LEVELS, PLAYSTYLES, validSizes, buildTournament, refresh, readyMatches, nextDay, isReady,
    simSeries, commitResult, groupTable, swissStandings, stageComplete, sourceLabel, resolve, updateEliminations, teamHasFuture,
    seedOrder, shuffle, pick, clamp, isPow2, pow2ceil, teamStrength, ordinal, groupLetter,
  };
})(window);
