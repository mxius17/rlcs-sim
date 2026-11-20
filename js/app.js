/* RL Esports Simulator — UI */
(function () {
  'use strict';
  const E = window.RLEngine;
  const DATA = window.RL_DATA;
  const STORE_KEY = 'rlsim.v1';
  const $ = (sel, root) => (root || document).querySelector(sel);
  const app = $('#app');
  const modalRoot = $('#modalRoot');

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const REGIONS = DATA.regions;
  const QUICK_FILLS = {
    top: 'Top ranked', random: 'Random teams', worlds: 'Worlds 2026 field', EU: 'European teams', NA: 'North American teams', SAM: 'South American teams',
    MENA: 'MENA teams', OCE: 'Oceanian teams', APAC: 'Asia-Pacific teams', SSA: 'Sub-Saharan African teams', underdogs: 'Underdogs',
  };
  const SPEEDS = [1, 2, 4, 8, 16, 32];

  /* ---------------- State ---------------- */
  const defaultSetup = () => ({
    format: 'major', size: 16, groupSize: 4, advance: 2, legs: 1, teams: [], managed: '', quickFill: 'top',
    simStyle: 'standard', goalLevel: 'normal', seriesBo: 'default', finalBo: 'default', matchType: 'full', thirdPlace: false, overrides: {},
  });
  let state = {
    view: 'setup', setup: defaultSetup(), customTeams: [], teamEdits: {}, T: null,
    settings: { theme: 'system', speed: 2, mode: 'extended' },
    ui: { stageTab: null, filter: '', hideGroups: false, drawTab: 'groups', swapSel: null, browseRegion: 'all', browseQuery: '' },
  };
  let live = null; // live playback state (not persisted)
  let themeTouched = false;

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      state.setup = Object.assign(defaultSetup(), s.setup || {});
      state.customTeams = s.customTeams || [];
      state.teamEdits = s.teamEdits || {};
      state.T = s.T || null;
      state.settings = Object.assign(state.settings, s.settings || {});
      if (s.view === 'tournament' && state.T) state.view = 'tournament';
    } catch (e) { /* ignore corrupt storage */ }
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ setup: state.setup, customTeams: state.customTeams, teamEdits: state.teamEdits, T: state.T, settings: state.settings, view: state.view }));
    } catch (e) { /* storage full or blocked */ }
  }

  /* ---------------- Teams ---------------- */
  let teamCache = null;
  function allTeams() {
    if (teamCache) return teamCache;
    const d27 = (window.RL_DATA27 && window.RL_DATA27.teams) || [];
    const hist = ((window.RL_HIST && window.RL_HIST.seasons) || []).flatMap((se) => se.teams.map((t) => Object.assign({ season: se.key }, t)));
    const list = DATA.teams.map((t) => Object.assign({ season: '2026' }, t)).concat(d27.map((t) => Object.assign({ season: '2027' }, t)), hist, state.customTeams.map((t) => Object.assign({ custom: true, season: 'custom' }, t)));
    teamCache = list.map((t) => {
      const ed = state.teamEdits[t.id];
      const merged = Object.assign({}, t, ed ? { players: ed.players || t.players, name: ed.name || t.name, tag: ed.tag || t.tag, color: ed.color || t.color } : {});
      merged.players = merged.players.map((p) => Object.assign({}, p));
      merged.ovr = Math.round(E.teamStrength(merged));
      return merged;
    });
    return teamCache;
  }
  const teamMap = () => { const m = {}; allTeams().forEach((t) => (m[t.id] = t)); return m; };
  let tmap = null;
  function getTeam(id) { if (typeof id === 'string' && id.startsWith('c:') && window.RLCareer) { const ct = window.RLCareer.teamObj(id); if (ct) return ct; } if (!tmap) tmap = teamMap(); return tmap[id] || { id, name: 'Unknown', tag: '??', color: '#555', players: [{ name: 'P1', rating: 60 }, { name: 'P2', rating: 60 }, { name: 'P3', rating: 60 }], region: 'EU' }; }
  function invalidateTeams() { teamCache = null; tmap = null; }
  const HAS27 = !!(window.RL_DATA27 && window.RL_DATA27.teams && window.RL_DATA27.teams.length);
  const HIST = (window.RL_HIST && window.RL_HIST.seasons) || [];
  /** Every roster season the app knows, newest first: 2027 (current), 2026, then the archive (2025 … 2021-22). */
  const SEASON_KEYS = (HAS27 ? ['2027'] : []).concat(['2026'], HIST.map((x) => x.key));
  const curSeason = () => { const v = state.settings.season; return SEASON_KEYS.includes(v) ? v : SEASON_KEYS[0]; };
  const seasonLabel = (s) => { const h = HIST.find((x) => x.key === s); return h ? h.label : 'RLCS ' + s; };
  function rankedTeams(season) { const se = season || curSeason(); return allTeams().filter((t) => t.season === se || t.custom).sort((a, b) => b.ovr - a.ovr || a.name.localeCompare(b.name)); }
  const seasonSeg = (action) => SEASON_KEYS.length > 1 ? `<label class="season-pick"><span>Season</span><select class="select" data-season-select="${action || 'set-season'}" aria-label="Roster season">${SEASON_KEYS.map((k) => `<option value="${k}" ${curSeason() === k ? 'selected' : ''}>${seasonLabel(k)}${k === '2027' ? ' · current' : ''}</option>`).join('')}</select></label>` : '';

  const LOGOS = window.RL_LOGOS || {};
  const badge = (t, cls) => {
    const logo = t && (LOGOS[t.logoKey] || LOGOS[t.name]);
    if (logo) return `<span class="badge logo ${cls || ''}" style="--c:${esc(t.color || '#2f8cff')}" title="${esc(t.name)}" aria-hidden="true"><img src="${logo}" alt="" decoding="async" /></span>`;
    return `<span class="badge ${cls || ''}" style="--c:${esc(t.color || '#2f8cff')}" aria-hidden="true">${esc((t.tag || t.name || '?').slice(0, 4))}</span>`;
  };
  const flagsOf = (t) => t.players.slice(0, 3).map((p) => p.flag || '').join('');
  const teamName = (id) => (id === 'BYE' ? 'BYE' : getTeam(id).name);

  /* ---------------- Toast & Modal ---------------- */
  function toast(msg, action) {
    const root = $('#toastRoot');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
    if (action) el.querySelector('button').onclick = () => { action.fn(); el.remove(); };
    root.appendChild(el);
    setTimeout(() => el.remove(), action ? 6000 : 2800);
  }
  let modalOnClose = null;
  function openModal(html, opts) {
    opts = opts || {};
    const fresh = !modalRoot.querySelector('.modal'); // pop in only when a modal opens, not when it re-renders
    modalRoot.innerHTML = `<div class="modal-backdrop${fresh ? ' m-enter' : ''}" data-backdrop><div class="modal ${opts.size || ''} ${opts.cls || ''}" role="dialog" aria-modal="true" style="${opts.style || ''}">${html}</div></div>`;
    modalOnClose = opts.onClose || null;
    const first = modalRoot.querySelector('input, select, button:not(.close-x)');
    if (first && opts.focus !== false) first.focus({ preventScroll: true });
  }
  function closeModal() { modalRoot.innerHTML = ''; const f = modalOnClose; modalOnClose = null; if (f) f(); }
  const modalHead = (title, sub) => `<div class="modal-head"><div><h2>${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button class="close-x" data-action="close-modal" aria-label="Close">×</button></div>`;

  /* ---------------- Setup helpers ---------------- */
  function setupValidSizes() { return E.validSizes(state.setup.format, state.setup); }
  function snapSize() {
    const sizes = setupValidSizes();
    if (!sizes.includes(state.setup.size)) {
      const n = state.setup.size;
      state.setup.size = sizes.reduce((best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best), sizes[0]);
    }
    if (state.setup.teams.length > state.setup.size) state.setup.teams = state.setup.teams.slice(0, state.setup.size);
    if (state.setup.managed && !state.setup.teams.includes(state.setup.managed)) state.setup.managed = '';
  }
  const usesGroups = () => ['groups', 'major'].includes(state.setup.format);
  function arrangeForFormat(ids) {
    const sorted = ids.slice().sort((a, b) => getTeam(b).ovr - getTeam(a).ovr);
    if (!usesGroups()) return sorted;
    const gs = state.setup.format === 'major' ? 4 : state.setup.groupSize;
    const G = Math.ceil(sorted.length / gs);
    const groups = Array.from({ length: G }, () => []);
    sorted.forEach((id, k) => { const row = Math.floor(k / G); const col = row % 2 === 0 ? k % G : G - 1 - (k % G); groups[col].push(id); });
    return groups.flat();
  }
  function autoFill(replace) {
    const s = state.setup;
    const kind = s.quickFill;
    let base = replace ? [] : s.teams.slice();
    const taken = new Set(base);
    let pool = rankedTeams().filter((t) => !taken.has(t.id));
    let order;
    if (kind === 'random') order = E.shuffle(pool);
    else if (kind === 'underdogs') order = pool.slice().reverse();
    else if (kind === 'worlds') order = pool.filter((t) => t.worlds).concat(pool.filter((t) => !t.worlds));
    else if (REGIONS[kind]) order = pool.filter((t) => t.region === kind).concat(pool.filter((t) => t.region !== kind));
    else order = pool;
    const need = s.size - base.length;
    base = base.concat(order.slice(0, need).map((t) => t.id));
    s.teams = kind === 'random' ? base : arrangeForFormat(base);
    s.overrides = {};
    if (s.teams.length < s.size) toast('Not enough teams in the library — create a team to fill the rest.');
    persistRender();
  }

  /* ---------------- Render: Setup ---------------- */
  function previewTournament() {
    const s = state.setup;
    if (s.teams.length !== s.size) return null;
    try { const T = E.buildTournament(s, getTeam); E.refresh(T); return T; } catch (e) { console.error(e); return null; }
  }

  function renderSetup() {
    const s = state.setup;
    const F = E.FORMATS[s.format];
    const sizes = setupValidSizes();
    const full = s.teams.length === s.size;
    const T = state.T;
    const teamsSel = s.teams.map(getTeam);
    const avg = teamsSel.length ? Math.round(teamsSel.reduce((x, t) => x + t.ovr, 0) / teamsSel.length) : 0;
    const fav = teamsSel.slice().sort((a, b) => b.ovr - a.ovr)[0];
    const chaos = { realistic: ['Low', 'favourites usually win'], standard: ['Balanced', 'upsets can happen'], chaos: ['Maximum', 'anyone can win'] }[s.simStyle];
    const preview = full ? previewTournament() : null;
    const stageSummary = buildStageSummary(s, preview);

    app.innerHTML = `
      <div class="page-head">
        <button class="btn sm" data-action="go-home">← Back to modes</button>
        <h1>${esc(s.title || 'Custom tournament')}</h1>
        <div class="head-actions">
          <button class="btn sm" data-action="save-preset" title="Download this setup as a preset file">↓ Save preset</button>
          <button class="btn sm" data-action="import-preset" title="Load a preset file">↑ Import preset</button>
          <span class="count-pill">${s.teams.length}/${s.size} teams</span>
          <button class="btn primary" data-action="start" ${full ? '' : 'disabled'}>Start tournament →</button>
        </div>
      </div>
      <div class="bento">
        ${T && !T.finished ? `<section class="tile c-12 resume-banner"><div><div class="tile-kicker">Resume tournament</div><strong>${esc(T.title || E.FORMATS[T.format].name)} · ${T.teams.length} teams</strong> <span class="muted">— ${Object.values(T.matches).filter((m) => m.result && !m.result.bye).length} series played</span></div><div class="toolbar"><button class="btn sm danger" data-action="discard-t">Delete saved tournament</button><button class="btn sm primary" data-action="resume">Resume →</button></div></section>` : ''}
        <section class="tile stat-tile accent-blue c-3"><span class="glyph">◎</span><div class="tile-kicker">Field size</div><div class="big">${s.size}</div><div class="sub">${s.teams.length === s.size ? 'all places filled' : (s.size - s.teams.length) + ' places left to fill'}</div></section>
        <section class="tile stat-tile accent-violet c-3"><span class="glyph">⌘</span><div class="tile-kicker">Format</div><div class="big" style="font-size:clamp(22px,2.4vw,30px)">${esc(F.name)}</div><div class="sub">${esc(stageSummary)}</div></section>
        <section class="tile stat-tile accent-orange c-3"><span class="glyph">⚡</span><div class="tile-kicker">Chaos meter</div><div class="big" style="font-size:clamp(24px,2.6vw,34px)">${chaos[0]}</div><div class="sub">${chaos[1]}</div></section>
        <section class="tile stat-tile c-3"><span class="glyph">★</span><div class="tile-kicker">Favourite</div>${fav ? `<div style="display:flex;align-items:center;gap:10px">${badge(fav)}<div class="big" style="font-size:clamp(18px,2vw,24px)">${esc(fav.name)}</div></div><div class="sub">OVR ${fav.ovr} · field average ${avg}</div>` : '<div class="big" style="font-size:24px">—</div><div class="sub">add teams to see the favourite</div>'}</section>

        <div class="stack col-setup c-3">
          ${renderSetupTile(sizes, F)}
        </div>
        <div class="stack col-main c-6">
          ${renderBracketTile(preview)}
          ${renderTeamsTile()}
        </div>
        <div class="stack col-adv c-3">
          ${renderAdvancedTile()}
        </div>
      </div>`;
  }

  function buildStageSummary(s, T) {
    switch (s.format) {
      case 'knockout': { const r = Math.ceil(Math.log2(Math.max(2, s.size))); return r + ' knockout rounds'; }
      case 'double': return 'upper + lower bracket';
      case 'swiss': return 'Swiss, then top ' + s.size / 2 + ' playoff';
      case 'groups': return s.size / s.groupSize + ' groups of ' + s.groupSize + ' · top ' + Math.min(s.advance, s.groupSize - 1) + ' advance';
      case 'major': return '4 groups · Final Eight playoffs';
      case 'league': return (s.legs === 2 ? 'double' : 'single') + ' round robin';
      case 'leaguePlayoffs': return 'season + top ' + (s.size >= 12 ? 8 : 4) + ' playoffs';
    }
    return '';
  }

  function renderSetupTile(sizes, F) {
    const s = state.setup;
    const teamsSel = s.teams.map(getTeam).sort((a, b) => a.name.localeCompare(b.name));
    return `<section class="tile">
      <div class="tile-head"><h2>Tournament setup</h2></div>
      <div class="field"><label for="selSize">Number of teams</label>
        <select class="select" id="selSize" data-bind="size">${sizes.map((n) => `<option value="${n}" ${n === s.size ? 'selected' : ''}>${n} teams</option>`).join('')}</select></div>
      <div class="field-label" style="margin-bottom:6px">Format</div>
      <div class="format-list" role="radiogroup" aria-label="Format">
        ${Object.entries(E.FORMATS).map(([k, f]) => `<div class="format-opt"><button class="format-btn ${k === s.format ? 'active' : ''}" role="radio" aria-checked="${k === s.format}" data-action="format" data-v="${k}"><span>${esc(f.name)}</span><small>${esc(f.short)}</small></button><button class="info-btn" data-action="format-info" data-v="${k}" aria-label="About ${esc(f.name)}">i</button></div>`).join('')}
      </div>
      ${s.format === 'groups' ? `<div class="form-grid" style="margin-top:12px">
        <div class="field"><label for="selGs">Teams per group</label><select class="select" id="selGs" data-bind="groupSize">${[3, 4, 5, 6, 8].map((n) => `<option value="${n}" ${n === s.groupSize ? 'selected' : ''}>${n} teams</option>`).join('')}</select></div>
        <div class="field"><label for="selAdv">Qualify per group</label><select class="select" id="selAdv" data-bind="advance">${[1, 2, 3, 4].filter((n) => n < s.groupSize).map((n) => `<option value="${n}" ${n === s.advance ? 'selected' : ''}>Top ${n}</option>`).join('')}</select></div></div>` : ''}
      ${s.format === 'league' || s.format === 'leaguePlayoffs' ? `<div class="field" style="margin-top:12px"><label for="selLegs">Fixtures</label><select class="select" id="selLegs" data-bind="legs"><option value="1" ${s.legs === 1 ? 'selected' : ''}>Play each team once</option><option value="2" ${s.legs === 2 ? 'selected' : ''}>Home and away (twice)</option></select></div>` : ''}
      <p class="format-desc">${esc(F.desc)}</p>
      <hr class="divider" />
      <div class="field"><label for="selManaged">Manage a team <span class="muted">(optional)</span></label>
        <select class="select" id="selManaged" data-bind="managed" ${teamsSel.length ? '' : 'disabled'}><option value="">Neutral · watch any match</option>${teamsSel.map((t) => `<option value="${esc(t.id)}" ${t.id === s.managed ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
        <p class="help">${teamsSel.length ? (s.managed ? 'You pick the playstyle for every series your team plays.' : 'Leave this neutral to watch any match.') : 'Add teams to choose one to manage.'}</p></div>
    </section>`;
  }

  function renderBracketTile(T) {
    const s = state.setup;
    const title = usesGroups() || s.format === 'swiss' || s.format.startsWith('league') ? 'Groups & bracket' : 'Tournament bracket';
    let strip = '';
    if (T) {
      strip = '<div class="preview-strip">' + T.stages.map((st) => {
        if (st.type === 'groups') return `<div class="preview-round"><strong>${st.groups.length} groups</strong><span>${st.groups[0].teams.length} teams each · ${st.groups.reduce((x, g) => x + g.matchIds.length, 0)} series</span></div>`;
        if (st.type === 'league') return `<div class="preview-round"><strong>League</strong><span>${st.groups[0].matchIds.length} series</span></div>`;
        if (st.type === 'swiss') return `<div class="preview-round"><strong>Swiss</strong><span>${st.target} wins to qualify</span></div>`;
        return st.rounds.map((r) => `<div class="preview-round"><strong>${esc(r.name)}</strong><span>${r.ids.length} series · Bo${T.matches[r.ids[0]].bo}</span></div>`).join('');
      }).join('') + '</div>';
    } else strip = `<p class="help">Fill every place to preview the ${usesGroups() ? 'groups, ' : ''}fixtures and bracket.</p>`;
    const ov = Object.keys(s.overrides).length;
    return `<section class="tile">
      <div class="tile-head"><div><h2>${title}</h2><p>Arrange your teams and edit individual series.${ov ? ` <span class="ov-tag">${ov} edited</span>` : ''}</p></div><button class="btn sm" data-action="open-draw" ${T ? '' : 'disabled'}>Open draw ↗</button></div>
      ${strip}
    </section>`;
  }

  function renderTeamsTile() {
    const s = state.setup;
    const full = s.teams.length === s.size;
    const chips = s.teams.map((id, i) => {
      const t = getTeam(id);
      return `<div class="team-chip ${id === s.managed ? 'managed' : ''}"><span class="slot-no">${i + 1}</span>${badge(t)}<div class="meta"><div class="name">${esc(t.name)}</div><div class="sub">${esc(REGIONS[t.region] || t.region)} · OVR ${t.ovr} ${flagsOf(t)}</div></div><div class="chip-actions"><button data-action="edit-team" data-id="${esc(id)}" title="Edit ${esc(t.name)}" aria-label="Edit ${esc(t.name)}">✎</button><button data-action="remove-team" data-id="${esc(id)}" title="Remove" aria-label="Remove ${esc(t.name)}">×</button></div></div>`;
    }).join('');
    const empties = Math.min(s.size - s.teams.length, 4);
    const emptyChips = s.teams.length ? Array.from({ length: empties }, () => '<button class="team-chip empty" data-action="browse">+ Add team</button>').join('') : '';
    return `<section class="tile">
      <div class="tile-head"><div><h2>Teams</h2><p>${s.teams.length} of ${s.size} selected</p></div><button class="btn sm" data-action="browse">+ Add teams</button></div>
      <div class="library-row">
        <div class="field" style="margin:0"><span class="field-label">Team library</span><button class="library-btn" data-action="browse"><span>${seasonLabel(curSeason())} teams · ${rankedTeams().length}</span><small>Browse →</small></button></div>
        <div class="field" style="margin:0"><label for="selFill">Auto-fill with</label><select class="select" id="selFill" data-bind="quickFill">${Object.entries(QUICK_FILLS).map(([k, v]) => `<option value="${k}" ${k === s.quickFill ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      </div>
      <div class="action-row">
        <button class="btn sm" data-action="autofill">${full ? 'Refill teams' : 'Auto-fill'}</button>
        <button class="btn sm" data-action="randomise" ${s.teams.length > 1 ? '' : 'disabled'} title="Shuffle selected teams between slots and reset match overrides">Randomise</button>
        <button class="btn sm" data-action="create-team">+ Create team</button>
        <button class="btn sm danger" data-action="clear-teams" ${s.teams.length ? '' : 'disabled'}>Clear teams</button>
      </div>
      <hr class="divider" />
      ${s.teams.length ? `<div class="team-grid">${chips}${emptyChips}</div>` : `<div class="empty-state"><div class="plus-row"><span>+</span><span>+</span><span>+</span></div>Add your favourite teams or fill the tournament automatically.</div>`}
      <p class="help">${full ? 'All places filled. Your tournament is ready.' : `${s.size - s.teams.length} places left to fill.`}${full && s.teams.length ? ' Slot order sets the seeding' + (usesGroups() ? ' (groups fill A → B → …).' : '.') : ''}</p>
    </section>`;
  }

  function renderAdvancedTile() {
    const s = state.setup;
    const opt = (v, cur, label) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;
    const hasKO = !['league'].includes(s.format);
    return `<section class="tile">
      <div class="tile-head"><h2>Advanced settings</h2></div>
      <div class="field"><label for="selMt">Match type</label><select class="select" id="selMt" data-bind="matchType">${opt('full', s.matchType, 'Full games (5:00 + overtime)')}${opt('ot', s.matchType, 'Sudden-death overtime only')}</select></div>
      <div class="field"><label for="selSs">Simulation style</label><select class="select" id="selSs" data-bind="simStyle">${Object.entries(E.SIM_STYLES).map(([k, v]) => opt(k, s.simStyle, v.name)).join('')}</select></div>
      <div class="field"><label for="selGl">Goal level</label><select class="select" id="selGl" data-bind="goalLevel">${Object.entries(E.GOAL_LEVELS).map(([k, v]) => opt(k, s.goalLevel, v.name)).join('')}</select></div>
      <div class="field"><label for="selBo">Series length</label><select class="select" id="selBo" data-bind="seriesBo">${opt('default', s.seriesBo, 'Format default')}${[1, 3, 5, 7].map((n) => opt(n, s.seriesBo, 'Best of ' + n)).join('')}</select></div>
      <div class="field"><label for="selFb">Final</label><select class="select" id="selFb" data-bind="finalBo" ${hasKO ? '' : 'disabled'}>${opt('default', s.finalBo, 'Format default')}${[3, 5, 7, 9].map((n) => opt(n, s.finalBo, 'Best of ' + n)).join('')}</select></div>
      <p class="help">Format default: Bo5 for groups, Swiss, league series and every knockout round before the quarter-finals; Bo7 from the quarter-finals on. Single-series edits from the draw take priority.</p>
      <label class="check" style="margin-top:12px"><input type="checkbox" data-bind="thirdPlace" ${s.thirdPlace ? 'checked' : ''} ${['knockout', 'groups', 'swiss', 'leaguePlayoffs'].includes(s.format) ? '' : 'disabled'} /> Third-place match</label>
      <hr class="divider" />
      <h3 style="font-size:15px">Edit teams</h3>
      <p class="help">Adjust team strength or customise the players in your tournament.</p>
      <div class="action-row"><button class="btn sm" data-action="team-ratings">Team ratings</button><button class="btn sm" data-action="edit-players">Edit players</button></div>
      <p class="help">Set individual results from <b>Edit match</b> in the draw popup.</p>
    </section>`;
  }

  /* ---------------- Modals: browse/create/edit teams ---------------- */
  function openBrowse() {
    const s = state.setup;
    const q = state.ui.browseQuery.toLowerCase();
    const reg = state.ui.browseRegion;
    const list = rankedTeams().filter((t) => (reg === 'all' || (reg === 'custom' ? t.custom : t.region === reg)) && (!q || t.name.toLowerCase().includes(q) || t.players.some((p) => p.name.toLowerCase().includes(q))));
    const sel = new Set(s.teams);
    openModal(`${modalHead('Team library', `${seasonLabel(curSeason())} rosters from Liquipedia · ${s.teams.length} of ${s.size} selected`)}
      <div class="modal-body">
        <div class="modal-toolbar">
          <div class="toolbar">${seasonSeg('browse-season')}<div class="search"><input class="input" id="browseQ" placeholder="Search teams or players" value="${esc(state.ui.browseQuery)}" aria-label="Search teams or players" /></div></div>
          <div class="seg" role="tablist">${[['all', 'All'], ...Object.keys(REGIONS).map((k) => [k, k]), ['custom', 'Custom']].map(([k, v]) => `<button class="${k === reg ? 'active' : ''}" data-action="browse-region" data-v="${k}" title="${esc(REGIONS[k] || v)}">${v}</button>`).join('')}</div>
        </div>
        <div class="browse-list">${list.map((t) => `<button class="browse-item ${sel.has(t.id) ? 'on' : ''}" data-action="toggle-team" data-id="${esc(t.id)}" aria-pressed="${sel.has(t.id)}">${badge(t)}<span class="meta"><b>${esc(t.name)}</b><small>${esc(t.players.slice(0, 3).map((p) => (p.flag || '') + ' ' + p.name).join(' · '))}</small></span><span class="rt">${t.ovr}</span><span class="tick">${sel.has(t.id) ? '✓' : ''}</span></button>`).join('') || '<p class="muted">No teams match.</p>'}</div>
      </div>
      <div class="modal-foot"><span class="count-pill" style="margin-right:auto">${s.teams.length}/${s.size}</span><button class="btn" data-action="create-team">+ Create team</button><button class="btn primary" data-action="close-modal">Done</button></div>`, { focus: false, onClose: render });
    const inp = $('#browseQ');
    if (inp) {
      inp.addEventListener('input', () => { state.ui.browseQuery = inp.value; const pos = inp.selectionStart; openBrowse(); const n = $('#browseQ'); n.focus(); n.setSelectionRange(pos, pos); });
    }
  }

  function toggleTeam(id) {
    const s = state.setup;
    const i = s.teams.indexOf(id);
    if (i >= 0) { s.teams.splice(i, 1); if (s.managed === id) s.managed = ''; }
    else {
      if (s.teams.length >= s.size) { toast('All ' + s.size + ' places are filled. Remove a team first.'); return; }
      s.teams.push(id);
    }
    s.overrides = {};
    save();
  }

  function openTeamEditor(id) {
    const t = id ? getTeam(id) : { id: '', name: '', tag: '', region: 'EU', color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'), players: [{ name: '', country: '', rating: 75 }, { name: '', country: '', rating: 75 }, { name: '', country: '', rating: 75 }] };
    const isCustom = !id || t.custom;
    const players = t.players.slice(0, 4);
    while (players.length < 3) players.push({ name: '', rating: 70 });
    openModal(`${modalHead(id ? 'Edit ' + t.name : 'Create team', id && !isCustom ? 'Changes apply on top of the Liquipedia roster and can be reset.' : 'Custom teams are saved in this browser.')}
      <form class="modal-body" id="teamForm">
        <div class="form-grid">
          <div class="field"><label for="tfName">Team name</label><input class="input" id="tfName" name="name" required maxlength="40" value="${esc(t.name)}" /></div>
          <div class="field"><label for="tfTag">Tag (2–4 letters)</label><input class="input" id="tfTag" name="tag" maxlength="4" value="${esc(t.tag)}" /></div>
          <div class="field"><label for="tfRegion">Region</label><select class="select" id="tfRegion" name="region" ${isCustom ? '' : 'disabled'}>${Object.entries(REGIONS).map(([k, v]) => `<option value="${k}" ${k === t.region ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label for="tfColor">Colour</label><input class="input" type="color" id="tfColor" name="color" value="${esc(t.color)}" style="height:42px;padding:4px" /></div>
        </div>
        <div class="field-label" style="margin:4px 0 8px">Players (first three start · rating 40–99)</div>
        ${players.map((p, i) => `<div class="player-edit"><input class="input" name="pn${i}" placeholder="${i < 3 ? 'Player ' + (i + 1) : 'Substitute (optional)'}" value="${esc(p.name)}" ${i < 3 ? 'required' : ''} aria-label="Player ${i + 1} name" /><input class="input" name="pc${i}" placeholder="Country" value="${esc(p.country || '')}" aria-label="Player ${i + 1} country" /><input class="input" type="number" min="40" max="99" name="pr${i}" value="${p.rating || 70}" aria-label="Player ${i + 1} rating" /></div>`).join('')}
      </form>
      <div class="modal-foot">
        ${id && isCustom ? '<button class="btn danger" data-action="delete-custom" data-id="' + esc(id) + '" style="margin-right:auto">Delete team</button>' : ''}
        ${id && !isCustom && state.teamEdits[id] ? '<button class="btn" data-action="reset-team" data-id="' + esc(id) + '" style="margin-right:auto">Reset to Liquipedia roster</button>' : ''}
        <button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="save-team" data-id="${esc(id || '')}">${id ? 'Save changes' : 'Create team'}</button>
      </div>`, { size: 'md' });
  }

  function saveTeamForm(id) {
    const f = $('#teamForm');
    if (!f.reportValidity()) return;
    const fd = new FormData(f);
    const name = String(fd.get('name')).trim();
    const tag = (String(fd.get('tag') || '').trim() || name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3)).toUpperCase();
    const players = [];
    for (let i = 0; i < 4; i++) {
      const pn = String(fd.get('pn' + i) || '').trim();
      if (!pn) continue;
      const country = String(fd.get('pc' + i) || '').trim();
      players.push({ name: pn, country, flag: DATA.flagFor ? DATA.flagFor(country) : '', rating: E.clamp(parseInt(fd.get('pr' + i), 10) || 70, 40, 99) });
    }
    if (players.length < 3) { toast('A team needs three players.'); return; }
    const color = String(fd.get('color'));
    if (!id) {
      const nid = 'custom-' + Date.now().toString(36);
      state.customTeams.push({ id: nid, name, tag, region: String(fd.get('region')), color, players, custom: true });
      invalidateTeams();
      const s = state.setup;
      if (s.teams.length < s.size) s.teams.push(nid);
      toast(name + ' created' + (s.teams.includes(nid) ? ' and added.' : '.'));
    } else {
      const ct = state.customTeams.find((t) => t.id === id);
      if (ct) Object.assign(ct, { name, tag, region: String(fd.get('region')), color, players });
      else state.teamEdits[id] = { name, tag, color, players };
      invalidateTeams();
    }
    closeModal();
    persistRender();
  }

  function openRatings() {
    const ids = state.view === 'tournament' && state.T ? state.T.teams : state.setup.teams;
    if (!ids.length) { toast('Add teams first.'); return; }
    const list = ids.map(getTeam).sort((a, b) => b.ovr - a.ovr);
    openModal(`${modalHead('Team ratings', 'Team strength is the average of the three starters. Moving a slider shifts every player on that team.')}
      <div class="modal-body">${list.map((t) => `<div class="rating-row"><div style="display:flex;gap:8px;align-items:center;min-width:0">${badge(t, 'sm')}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</span></div><input type="range" min="40" max="99" value="${t.ovr}" data-rate="${esc(t.id)}" aria-label="${esc(t.name)} rating" /><span class="v" id="rv-${esc(t.id)}">${t.ovr}</span></div>`).join('')}</div>
      <div class="modal-foot"><button class="btn" data-action="reset-ratings">Reset all</button><button class="btn primary" data-action="close-modal">Done</button></div>`, { size: 'md', onClose: render });
    modalRoot.querySelectorAll('input[data-rate]').forEach((inp) => {
      inp.addEventListener('input', () => { $('#rv-' + CSS.escape(inp.dataset.rate)).textContent = inp.value; });
      inp.addEventListener('change', () => setTeamRating(inp.dataset.rate, +inp.value));
    });
  }
  function setTeamRating(id, val) {
    const t = getTeam(id);
    const delta = val - E.teamStrength(t);
    const players = t.players.map((p, i) => Object.assign({}, p, { rating: E.clamp(Math.round(p.rating + (i < 3 ? delta : delta)), 40, 99) }));
    const ct = state.customTeams.find((x) => x.id === id);
    if (ct) ct.players = players; else state.teamEdits[id] = Object.assign({}, state.teamEdits[id] || {}, { players });
    invalidateTeams(); save();
  }

  function openPlayers(teamId) {
    const ids = state.view === 'tournament' && state.T ? state.T.teams : state.setup.teams;
    const pool = ids.length ? ids : rankedTeams().slice(0, 20).map((t) => t.id);
    const cur = teamId || pool[0];
    const t = getTeam(cur);
    openModal(`${modalHead('Edit players', 'Rename players, change nationality or tweak individual ratings.')}
      <div class="modal-body">
        <div class="field"><label for="epTeam">Team</label><select class="select" id="epTeam">${pool.map(getTeam).sort((a, b) => a.name.localeCompare(b.name)).map((x) => `<option value="${esc(x.id)}" ${x.id === cur ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
        <form id="playersForm">${t.players.map((p, i) => `<div class="player-edit"><input class="input" name="pn${i}" value="${esc(p.name)}" aria-label="Player ${i + 1} name" required /><input class="input" name="pc${i}" value="${esc(p.country || '')}" placeholder="Country" aria-label="Player ${i + 1} country" /><input class="input" type="number" min="40" max="99" name="pr${i}" value="${p.rating}" aria-label="Player ${i + 1} rating" /></div>`).join('')}</form>
        <p class="help">${t.players.length > 3 ? 'Only the first three players start; others are listed as substitutes.' : ''}</p>
      </div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Close</button><button class="btn primary" data-action="save-players" data-id="${esc(cur)}">Save players</button></div>`, { size: 'md', onClose: render });
    $('#epTeam').addEventListener('change', (e) => openPlayers(e.target.value));
  }
  function savePlayers(id) {
    const f = $('#playersForm');
    if (!f.reportValidity()) return;
    const fd = new FormData(f);
    const t = getTeam(id);
    const players = t.players.map((p, i) => { const country = String(fd.get('pc' + i) || ''); return Object.assign({}, p, { name: String(fd.get('pn' + i)).trim() || p.name, country, flag: country === p.country ? p.flag : (DATA.flagFor ? DATA.flagFor(country) : p.flag), rating: E.clamp(parseInt(fd.get('pr' + i), 10) || p.rating, 40, 99) }); });
    const ct = state.customTeams.find((x) => x.id === id);
    if (ct) ct.players = players; else state.teamEdits[id] = Object.assign({}, state.teamEdits[id] || {}, { players });
    invalidateTeams(); save(); toast('Players saved for ' + t.name + '.');
  }

  /* ---------------- Draw modal ---------------- */
  function openDraw() {
    const T = previewTournament();
    if (!T) return;
    const s = state.setup;
    const hasGroups = T.stages[0].groups && T.stages[0].type !== 'league';
    const tabs = [[hasGroups ? 'groups' : 'groups', hasGroups ? 'Groups' : 'Seeding'], ['matches', 'Matches'], ['bracket', 'Bracket']];
    if (!T.stages.some((st) => st.type === 'bracket')) tabs.pop();
    let tab = state.ui.drawTab;
    if (!tabs.some((x) => x[0] === tab)) tab = 'groups';
    let body = '';
    if (tab === 'groups') {
      const sel = state.ui.swapSel;
      const row = (id, i, n) => { const t = getTeam(id); return `<div class="group-row ${sel === i ? 'selected' : ''}" data-action="swap" data-i="${i}" role="button" tabindex="0"><span class="n">${n}</span>${badge(t, 'sm')}<span class="nm">${esc(t.name)}</span><span class="muted mono" style="font-size:12px">${t.ovr}</span></div>`; };
      if (hasGroups) {
        body = `<div class="groups-grid">${T.stages[0].groups.map((g, gi) => `<div class="group-card"><header>${esc(g.name)}<small>${g.teams.length} teams</small></header>${g.teams.map((id, k) => row(id, s.teams.indexOf(id), k + 1)).join('')}</div>`).join('')}</div>`;
      } else {
        body = `<div class="groups-grid"><div class="group-card"><header>Seeds<small>${s.teams.length} teams</small></header>${s.teams.map((id, i) => row(id, i, i + 1)).join('')}</div></div>`;
      }
      body = `<p class="help" style="margin:0 0 10px">Tap a team, then tap another to swap their places.${state.setup.format === 'swiss' ? ' Round 1 pairs seed 1 with seed ' + (s.size / 2 + 1) + ', and so on.' : ''}</p>` + body;
    } else if (tab === 'matches') {
      const stage = T.stages[0];
      const mids = T.order.filter((id) => T.matches[id].stage === stage.id);
      if (stage.groups) {
        body = stage.groups.map((g) => `<h4 class="b-section-title">${esc(g.name)}</h4><div class="fixtures-grid">${g.matchIds.map((mid) => fixtureCard(T, T.matches[mid], { draw: true })).join('')}</div>`).join('');
      } else {
        body = `<div class="fixtures-grid">${mids.slice(0, 64).map((mid) => fixtureCard(T, T.matches[mid], { draw: true })).join('')}</div>${stage.type === 'swiss' ? '<p class="help">Later Swiss rounds are drawn from results as the stage is played.</p>' : ''}`;
      }
    } else {
      body = T.stages.filter((st) => st.type === 'bracket').map((st) => bracketView(T, st, { draw: true })).join('');
    }
    openModal(`${modalHead('Groups & bracket', 'Arrange teams and plan your tournament.')}
      <div class="modal-body">
        <div class="modal-toolbar">
          <div class="tabs">${tabs.map(([k, v]) => `<button class="${k === tab ? 'active' : ''}" data-action="draw-tab" data-v="${k}">${v}</button>`).join('')}</div>
          <div class="toolbar"><span class="muted" style="font-size:13px">${s.teams.length} of ${s.size} teams selected</span><button class="btn sm" data-action="draw-seed">Seed by rating</button><button class="btn sm" data-action="draw-shuffle">Shuffle ${hasGroups ? 'groups' : 'seeds'}</button></div>
        </div>
        ${body}
      </div>`, { focus: false, onClose: render });
  }

  /* ---------------- Edit match ---------------- */
  function openEditMatch(mid, inTournament) {
    const T = inTournament ? state.T : previewTournament();
    const m = T.matches[mid];
    const ovStore = inTournament ? state.T.overrides : state.setup.overrides;
    const ov = ovStore[mid] || {};
    const la = m.a && m.a !== 'BYE' ? teamName(m.a) : E.sourceLabel(T, m.sa);
    const lb = m.b && m.b !== 'BYE' ? teamName(m.b) : E.sourceLabel(T, m.sb);
    const bo = ov.bo || m.bo;
    const need = Math.ceil(bo / 2);
    const scoreOpts = (w) => Array.from({ length: need }, (_, k) => k).map((k) => { const v = w === 'A' ? need + '-' + k : k + '-' + need; return `<option value="${v}" ${ov.winner === w && ((w === 'A' && +ov.sb === k) || (w === 'B' && +ov.sa === k)) ? 'selected' : ''}>${v}</option>`; }).join('');
    openModal(`${modalHead('Edit match', esc(m.label))}
      <div class="modal-body">
        <div class="scoreboard" style="margin-bottom:16px"><div class="sb-team blue"><span class="nm" style="font-size:18px">${esc(la)}</span></div><div class="sb-mid muted">vs</div><div class="sb-team orange"><span class="nm" style="font-size:18px">${esc(lb)}</span></div></div>
        <div class="field"><label for="emBo">Series length</label><select class="select" id="emBo">${[1, 3, 5, 7, 9].map((n) => `<option value="${n}" ${n === bo ? 'selected' : ''}>Best of ${n}</option>`).join('')}</select></div>
        <div class="field"><label for="emRule">Result</label><select class="select" id="emRule"><option value="">Normal rules · simulate</option><option value="A" ${ov.winner === 'A' ? 'selected' : ''}>${esc(la)} win</option><option value="B" ${ov.winner === 'B' ? 'selected' : ''}>${esc(lb)} win</option></select></div>
        <div class="field ${ov.winner ? '' : 'hidden'}" id="emScoreWrap"><label for="emScore">Series score</label><select class="select" id="emScore">${ov.winner ? scoreOpts(ov.winner) : ''}</select><p class="help">Game scores and scorers are still simulated around this result.</p></div>
      </div>
      <div class="modal-foot"><button class="btn" data-action="clear-override" data-id="${esc(mid)}" data-t="${inTournament ? 1 : 0}" style="margin-right:auto">Reset to normal rules</button><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="save-override" data-id="${esc(mid)}" data-t="${inTournament ? 1 : 0}">Save</button></div>`, {
      size: 'sm', onClose: inTournament ? render : () => openDraw(),
    });
    const upd = () => {
      const w = $('#emRule').value; const b = +$('#emBo').value; const nd = Math.ceil(b / 2);
      $('#emScoreWrap').classList.toggle('hidden', !w);
      if (w) $('#emScore').innerHTML = Array.from({ length: nd }, (_, k) => { const v = w === 'A' ? nd + '-' + k : k + '-' + nd; return `<option value="${v}">${v}</option>`; }).join('');
    };
    $('#emRule').addEventListener('change', upd);
    $('#emBo').addEventListener('change', upd);
  }
  function saveOverride(mid, inT) {
    const store = inT ? state.T.overrides : state.setup.overrides;
    const bo = +$('#emBo').value; const w = $('#emRule').value;
    const ov = {};
    const T = inT ? state.T : null;
    const defBo = inT ? T.matches[mid].bo : (previewTournament().matches[mid] || {}).bo;
    if (bo !== defBo || (store[mid] && store[mid].bo)) ov.bo = bo;
    if (w) { const [x, y] = $('#emScore').value.split('-').map(Number); ov.winner = w; ov.sa = x; ov.sb = y; }
    if (Object.keys(ov).length) store[mid] = ov; else delete store[mid];
    if (inT && ov.bo) T.matches[mid].bo = ov.bo;
    save(); closeModal();
  }

  /* ---------------- Fixture & bracket views ---------------- */
  function fixtureCard(T, m, opts) {
    opts = opts || {};
    const ov = T.overrides[m.id] || (opts.draw ? state.setup.overrides[m.id] : null);
    const line = (side) => {
      const id = side === 'a' ? m.a : m.b;
      const src = side === 'a' ? m.sa : m.sb;
      const known = id && id !== 'BYE';
      const t = known ? getTeam(id) : null;
      const sc = m.result && !m.result.bye ? (side === 'a' ? m.result.sa : m.result.sb) : '–';
      const cls = m.result ? (m.result.winner === id ? 'win' : 'lose') : '';
      return `<div class="fx-line ${cls}">${t ? badge(t, 'sm') : '<span class="badge sm">?</span>'}<span class="nm ${t ? '' : 'tbd'}">${t ? esc(t.name) : id === 'BYE' ? 'BYE' : esc(E.sourceLabel(T, src))}</span><span class="sc">${sc}</span></div>`;
    };
    const featured = state.T === T && T.featured === m.id;
    const mine = T.managed && (m.a === T.managed || m.b === T.managed);
    const status = m.result ? (m.result.bye ? 'Bye' : 'FT') : 'Bo' + m.bo;
    const tag = opts.draw ? (ov ? '<span class="ov-tag">Edited</span>' : '<span class="muted">Normal rules</span>') : (ov && !m.result ? '<span class="ov-tag">Edited</span>' : '');
    return `<div class="fx ${featured ? 'featured' : ''} ${mine ? 'mine' : ''}" ${opts.draw ? '' : `data-action="feature" data-id="${esc(m.id)}" role="button" tabindex="0"`}>
      <div class="fx-top"><span>${esc(m.label)}</span><span class="mono">${status}</span></div>
      ${line('a')}${line('b')}
      <div class="fx-top" style="align-items:center">${tag}${(opts.draw || (!m.result && state.T === T)) ? `<button class="btn xs" data-action="edit-match" data-id="${esc(m.id)}" data-t="${opts.draw ? 0 : 1}">Edit match</button>` : ''}</div>
    </div>`;
  }

  function bracketView(T, st, opts) {
    const sections = [['upper', 'Upper bracket'], ['lower', 'Lower bracket'], ['main', ''], ['third', ''], ['final', '']];
    let out = `<div class="b-section-title">${esc(st.name)}</div>`;
    const bySec = {};
    st.rounds.forEach((r) => (bySec[r.section] = bySec[r.section] || []).push(r));
    if (st.kind === 'double' || st.kind === 'final8') {
      const up = (bySec.upper || []).concat(st.kind === 'final8' ? (bySec.main || []) : []).concat(bySec.final || []);
      out += `<div class="b-section-title" style="margin-top:4px">Upper bracket</div><div class="bracket-scroll"><div class="bracket">${up.map((r) => bCol(T, r, opts)).join('')}</div></div>`;
      out += `<div class="b-section-title">Lower bracket</div><div class="bracket-scroll"><div class="bracket">${(bySec.lower || []).map((r) => bCol(T, r, opts)).join('')}</div></div>`;
    } else {
      const main = (bySec.main || []);
      out += `<div class="bracket-scroll"><div class="bracket">${main.map((r) => bCol(T, r, opts)).join('')}${bySec.third ? bCol(T, bySec.third[0], opts) : ''}</div></div>`;
    }
    return out;
  }
  const bCol = (T, r, opts) => `<div class="b-col"><h5>${esc(r.name)}</h5><div class="b-matches">${r.ids.map((id) => fixtureCard(T, T.matches[id], opts)).join('')}</div></div>`;

  /* ---------------- Tournament screen ---------------- */
  function featuredMatch(T) {
    if (T.featured && T.matches[T.featured]) {
      const m = T.matches[T.featured];
      if (m.result || E.isReady(m)) return m;
    }
    const ready = E.readyMatches(T);
    if (!ready.length) {
      const played = T.order.map((id) => T.matches[id]).filter((m) => m.result && !m.result.bye);
      return played[played.length - 1] || null;
    }
    const day = Math.min(...ready.map((m) => m.day));
    const pool = ready.filter((m) => m.day === day);
    const mine = T.managed && pool.find((m) => m.a === T.managed || m.b === T.managed);
    const mineAny = T.managed && ready.find((m) => m.a === T.managed || m.b === T.managed);
    return mine || pool[0] || mineAny;
  }

  function currentStage(T) {
    const pending = T.stages.find((st) => Object.values(T.matches).some((m) => m.stage === st.id && !m.result) || (st.type === 'swiss' && !st.done));
    return pending || T.stages[T.stages.length - 1];
  }

  function renderTournament() {
    const T = state.T;
    E.refresh(T);
    const fm = featuredMatch(T);
    if (fm) T.featured = fm.id;
    const all = Object.values(T.matches).filter((m) => !(m.result && m.result.bye));
    const played = all.filter((m) => m.result).length;
    const total = all.length + (T.stages.some((s) => s.type === 'swiss' && !s.done) ? 8 : 0);
    const pct = Math.round((played / Math.max(1, total)) * 100);
    const cs = currentStage(T);
    if (!state.ui.stageTab || !T.stages.find((s) => s.id === state.ui.stageTab)) state.ui.stageTab = cs.id;
    const ready = E.readyMatches(T);
    const isLive = live && live.mid === (fm && fm.id);

    app.innerHTML = `
      <div class="page-head">
        ${T.career ? '<button class="btn sm" data-action="nav" data-v="career">← Career</button>' : `<button class="btn sm" data-action="go-setup">← ${T.cfg && T.cfg.custom ? 'Back to modes' : 'Back to settings'}</button>`}
        <h1>${esc(T.title || E.FORMATS[T.format].name)} <span class="muted" style="font-size:.55em;font-family:var(--font)">· ${T.teams.length} teams</span></h1>
        <div class="head-actions">
          <div style="min-width:140px"><div class="progress" title="${pct}% complete"><i style="width:${pct}%"></i></div><div class="muted mono" style="font-size:11px;margin-top:4px">${played} series played · ${esc(cs.name)}</div></div>
          <button class="btn sm" data-action="sim-day" ${ready.length && !isLive ? '' : 'disabled'}>Simulate ${cs.type === 'bracket' ? 'round' : 'matchday'}</button>
          <button class="btn sm orange" data-action="sim-all" ${ready.length && !isLive ? '' : 'disabled'}>Simulate all</button>
        </div>
      </div>
      <div class="bento">
        <div class="stack col-stats c-3">
          ${statsTile(T, fm)}
          ${T.managed ? tacticsTile(T) : ''}
        </div>
        <div class="stack col-main col-match c-6">
          ${matchCentreTile(T, fm)}
          ${leadersTile(T)}
        </div>
        <div class="stack col-info c-3">
          ${miniStandingsTile(T, fm)}
          ${pulseTile(T)}
        </div>
        <section class="tile c-12">${stageTile(T)}</section>
      </div>`;
    if (isLive) mountLive();
  }

  function statsTile(T, m) {
    if (!m) return `<section class="tile"><div class="tile-head"><h2>Stats</h2></div><p class="muted">No match selected</p></section>`;
    const A = getTeam(m.a), B = getTeam(m.b);
    let res = m.result && !m.result.bye ? m.result : null;
    let partial = false;
    if (live && live.mid === m.id) { res = liveAggregate(); partial = true; }
    if (!res) {
      return `<section class="tile"><div class="tile-head"><h2>Stats</h2><span class="pill">Preview</span></div>
        <div class="stat-bars">${statBar('Team rating', A.ovr, B.ovr)}${statBar('Best player', Math.max(...A.players.slice(0, 3).map((p) => p.rating)), Math.max(...B.players.slice(0, 3).map((p) => p.rating)))}</div>
        <hr class="divider" />${rosterTable(A, 'a')}${rosterTable(B, 'b')}</section>`;
    }
    const tot = (side, k) => res.games.reduce((s, g) => s + g.pstats.filter((p) => p.side === side).reduce((x, p) => x + p[k], 0), 0);
    const ga = res.goalsA, gb = res.goalsB, sha = tot('A', 'sh'), shb = tot('B', 'sh');
    const players = {};
    res.games.forEach((g) => g.pstats.forEach((p) => { const k = p.side + p.name; const o = players[k] || (players[k] = { name: p.name, side: p.side, g: 0, a: 0, sv: 0, sh: 0, score: 0 }); o.g += p.g; o.a += p.a; o.sv += p.sv; o.sh += p.sh; o.score += p.score; }));
    const rows = Object.values(players).sort((x, y) => (x.side > y.side ? 1 : x.side < y.side ? -1 : y.score - x.score));
    return `<section class="tile"><div class="tile-head"><h2>Stats</h2>${partial ? '<span class="pill good">Live</span>' : '<span class="pill">Series</span>'}</div>
      <div class="stat-bars">${statBar('Goals', ga, gb)}${statBar('Shots', sha, shb)}${statBar('Saves', tot('A', 'sv'), tot('B', 'sv'))}${statBar('Assists', tot('A', 'a'), tot('B', 'a'))}${statBar('Demos', tot('A', 'dm'), tot('B', 'dm'))}${statBar('Shooting %', sha ? Math.round((ga / sha) * 100) : 0, shb ? Math.round((gb / shb) * 100) : 0)}</div>
      <hr class="divider" />
      <div class="table-wrap"><table class="scorecard"><thead><tr><th>Player</th><th title="Score">Pts</th><th title="Goals">G</th><th title="Assists">A</th><th title="Saves">Sv</th><th title="Shots">Sh</th></tr></thead><tbody>
      ${rows.map((p) => `<tr class="team-${p.side === 'A' ? 'a' : 'b'}"><td>${esc(p.name)}</td><td>${p.score}</td><td>${p.g}</td><td>${p.a}</td><td>${p.sv}</td><td>${p.sh}</td></tr>`).join('')}</tbody></table></div></section>`;
  }
  function rosterTable(t, side) {
    return `<div class="tile-kicker" style="margin-top:8px">${esc(t.name)}</div><table class="scorecard"><tbody>${t.players.slice(0, 3).map((p) => `<tr class="team-${side}"><td>${p.flag || ''} ${esc(p.name)}</td><td>${p.rating}</td></tr>`).join('')}</tbody></table>`;
  }
  function statBar(label, a, b) {
    const s = a + b || 1;
    return `<div class="stat-bar"><div class="lbl"><span>${a}</span><span>${label}</span><span>${b}</span></div><div class="track"><i class="a" style="width:${(a / s) * 100}%"></i><i class="b" style="width:${(b / s) * 100}%"></i></div></div>`;
  }

  function tacticsTile(T) {
    const t = getTeam(T.managed);
    const out = T.eliminated[T.managed];
    return `<section class="tile"><div class="tile-head"><div><div class="tile-kicker">Your team</div><h2 style="display:flex;gap:8px;align-items:center">${badge(t, 'sm')} ${esc(t.name)}</h2></div>${out ? '<span class="pill bad">Eliminated</span>' : T.champion === T.managed ? '<span class="pill gold">Champions</span>' : '<span class="pill good">Alive</span>'}</div>
      <div class="field-label" style="margin-bottom:6px">Playstyle</div>
      <div class="seg" style="display:flex">${Object.entries(E.PLAYSTYLES).map(([k, p]) => `<button class="${T.playstyle === k ? 'active' : ''}" data-action="playstyle" data-v="${k}" title="${esc(p.desc)}" ${out ? 'disabled' : ''}>${p.name}</button>`).join('')}</div>
      <p class="help">${esc((E.PLAYSTYLES[T.playstyle] || E.PLAYSTYLES.balanced).desc)}</p></section>`;
  }

  function leadersTile(T) {
    const rows = Object.values(T.stats).filter((s) => s && s.name);
    if (!rows.length) return `<section class="tile"><div class="tile-head"><h2>Leaders</h2></div><p class="muted" style="font-size:13px">Top scorers, savers and MVP race appear once series are played.</p></section>`;
    const tab = state.ui.leaderTab || 'g';
    const key = { g: 'g', score: 'score', sv: 'sv', a: 'a' }[tab];
    const list = rows.slice().sort((x, y) => y[key] - x[key] || y.score - x.score).slice(0, 6);
    return `<section class="tile"><div class="tile-head"><h2>Leaders</h2></div>
      <div class="seg" style="margin-bottom:10px">${[['g', 'Goals'], ['score', 'MVP race'], ['sv', 'Saves'], ['a', 'Assists']].map(([k, v]) => `<button class="${k === tab ? 'active' : ''}" data-action="leader-tab" data-v="${k}">${v}</button>`).join('')}</div>
      <div class="leader-list">${list.map((p, i) => { const t = getTeam(p.team); return `<div class="leader"><span class="rk">${i + 1}</span>${badge(t, 'sm')}<span class="who"><b>${esc(p.name)}</b><small>${esc(t.name)} · ${p.gp} games</small></span><span class="val">${p[key]}</span></div>`; }).join('')}</div></section>`;
  }

  function pulseTile(T) {
    return `<section class="tile grow"><div class="tile-head"><div><div class="tile-kicker">Tournament pulse</div><h2>Live story</h2></div></div>
      <div class="pulse">${T.stories.length ? T.stories.slice(0, 40).map((s) => `<div class="story ${s.kind}"><small>${esc(s.when)}</small>${s.html}</div>`).join('') : '<p class="muted" style="font-size:13px">Results, upsets and eliminations will appear here.</p>'}</div></section>`;
  }

  function miniStandingsTile(T, m) {
    if (m && m.stage) {
      const st = T.stages.find((s) => s.id === m.stage);
      if (st.groups && m.group != null) {
        return `<section class="tile"><div class="tile-head"><h2>${esc(st.groups[m.group].name)}</h2></div>${groupTableHTML(T, st, m.group, true)}</section>`;
      }
      if (st.type === 'swiss') {
        return `<section class="tile"><div class="tile-head"><h2>Swiss standings</h2></div>${swissTableHTML(T, st, 8)}</section>`;
      }
    }
    // path for bracket: show series summary
    const alive = T.teams.filter((id) => !T.eliminated[id]);
    return `<section class="tile"><div class="tile-head"><h2>Still standing</h2><span class="pill">${alive.length}/${T.teams.length}</span></div><div class="leader-list">${alive.slice(0, 10).map((id) => { const t = getTeam(id); return `<div class="leader">${badge(t, 'sm')}<span class="who"><b>${esc(t.name)}</b><small>OVR ${t.ovr}</small></span></div>`; }).join('')}${alive.length > 10 ? `<p class="muted" style="font-size:12px;margin:4px 0 0">+${alive.length - 10} more</p>` : ''}</div></section>`;
  }

  function groupTableHTML(T, st, gi, compact) {
    const tbl = E.groupTable(T, st.id, gi);
    const adv = st.advance || 0;
    const f8 = T.format === 'major';
    return `<div class="table-wrap"><table class="st"><thead><tr><th>#</th><th class="l">Team</th><th>P</th>${compact ? '' : '<th>W</th><th>L</th>'}<th title="Game difference">GD</th>${compact ? '' : '<th title="Goal difference">+/-</th>'}<th title="Series wins">${compact ? 'W' : 'Pts'}</th></tr></thead><tbody>
      ${tbl.map((r, i) => { const t = getTeam(r.id); const q = f8 ? (i === 0 ? 'q' : i === 1 ? 'q2' : '') : i < adv ? 'q' : ''; const hl = T.managed === r.id || (state.ui.filter && t.name.toLowerCase().includes(state.ui.filter.toLowerCase())) ? 'hl' : ''; return `<tr class="${q} ${hl}"><td class="pos">${i + 1}</td><td class="l"><div class="tcell">${badge(t, 'sm')}<span>${esc(compact ? t.name : t.name)}</span></div></td><td>${r.p}</td>${compact ? '' : `<td>${r.w}</td><td>${r.l}</td>`}<td>${r.gd > 0 ? '+' : ''}${r.gd}</td>${compact ? '' : `<td>${r.goalD > 0 ? '+' : ''}${r.goalD}</td>`}<td><b>${compact ? r.w : r.w * 3}</b></td></tr>`; }).join('')}
    </tbody></table></div>`;
  }
  function swissTableHTML(T, st, limit) {
    const list = E.swissStandings(st);
    return `<div class="table-wrap"><table class="st"><thead><tr><th>#</th><th class="l">Team</th><th>W-L</th><th>GD</th><th></th></tr></thead><tbody>
      ${list.slice(0, limit || list.length).map((id, i) => { const r = st.records[id]; const t = getTeam(id); const status = r.w >= st.target ? '<span class="pill good">Q</span>' : r.l >= st.target ? '<span class="pill bad">OUT</span>' : ''; return `<tr class="${r.w >= st.target ? 'q' : r.l >= st.target ? 'out' : ''} ${T.managed === id ? 'hl' : ''}"><td class="pos">${i + 1}</td><td class="l"><div class="tcell">${badge(t, 'sm')}<span>${esc(t.name)}</span></div></td><td>${r.w}-${r.l}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td>${status}</td></tr>`; }).join('')}
    </tbody></table></div>`;
  }

  function stageTile(T) {
    const st = T.stages.find((s) => s.id === state.ui.stageTab);
    const filter = state.ui.filter.toLowerCase();
    const matchFilter = (m) => !filter || [m.a, m.b].some((id) => id && id !== 'BYE' && getTeam(id).name.toLowerCase().includes(filter));
    let head = `<div class="tile-head"><div class="tabs">${T.stages.map((s) => `<button class="${s.id === st.id ? 'active' : ''}" data-action="stage-tab" data-v="${s.id}">${esc(s.name)}</button>`).join('')}</div>
      <div class="toolbar"><div class="search"><input class="input" id="teamFilter" placeholder="Filter by team" value="${esc(state.ui.filter)}" aria-label="Filter by team" /></div>${st.groups && st.type !== 'league' ? `<button class="btn sm" data-action="toggle-groups">${state.ui.hideGroups ? 'Show groups' : 'Hide groups'}</button>` : ''}</div></div>`;
    let body = '';
    if (st.type === 'groups' || st.type === 'league') {
      if (!state.ui.hideGroups) {
        body += st.type === 'league' ? `<div class="table-card">${groupTableHTML(T, st, 0)}</div>` : `<div class="tables-grid">${st.groups.map((g, gi) => `<div class="table-card"><h4>${esc(g.name)}</h4>${groupTableHTML(T, st, gi, true)}</div>`).join('')}</div>`;
      }
      const ms = T.order.map((id) => T.matches[id]).filter((m) => m.stage === st.id && matchFilter(m));
      const played = ms.filter((m) => m.result).length;
      const days = [...new Set(ms.map((m) => m.day))].sort((a, b) => a - b);
      body += `<div class="tile-head" style="margin-top:18px"><h3>${st.type === 'league' ? 'Fixtures' : 'Group fixtures'}</h3><span class="muted" style="font-size:13px">${played}/${ms.length} played</span></div>`;
      body += days.map((d) => `<div class="b-section-title">Matchday ${d + 1}</div><div class="fixtures-grid">${ms.filter((m) => m.day === d).map((m) => fixtureCard(T, m)).join('')}</div>`).join('');
    } else if (st.type === 'swiss') {
      body += `<div class="table-card">${swissTableHTML(T, st)}</div>`;
      body += st.rounds.slice().reverse().map((r) => `<div class="b-section-title">${esc(r.name)}</div><div class="fixtures-grid">${r.ids.map((id) => T.matches[id]).filter(matchFilter).map((m) => fixtureCard(T, m)).join('')}</div>`).join('');
    } else {
      if (filter) {
        const ms = T.order.map((id) => T.matches[id]).filter((m) => m.stage === st.id && matchFilter(m));
        body += `<div class="fixtures-grid">${ms.map((m) => fixtureCard(T, m)).join('') || '<p class="muted">No matches for this team in this stage.</p>'}</div>`;
      } else body += bracketView(T, st, {});
    }
    return head + body;
  }

  /* ---------------- Match centre & live playback ---------------- */
  function matchCentreTile(T, m) {
    if (!m) {
      return `<section class="tile mc"><div class="empty-state">No playable series right now.</div></section>`;
    }
    const A = getTeam(m.a), B = getTeam(m.b);
    const res = m.result && !m.result.bye ? m.result : null;
    const isLive = live && live.mid === m.id;
    const mode = state.settings.mode;
    const scoreA = isLive ? live.sa : res ? res.sa : 0, scoreB = isLive ? live.sb : res ? res.sb : 0;
    const pips = (isLive ? live.res.games.slice(0, live.gi + 1) : res ? res.games : []).map((g, i) => {
      const cur = isLive && i === live.gi;
      const done = !cur;
      const cls = cur ? 'live' : g.ga > g.gb ? 'a' : 'b';
      return `<span class="game-pip ${cls}">G${i + 1} ${done ? g.ga + '-' + g.gb + (g.ot ? ' OT' : '') : 'live'}</span>`;
    }).join('');
    const mine = T.managed && (m.a === T.managed || m.b === T.managed);
    return `<section class="tile mc" id="matchCentre">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="mc-label">${esc(m.label)} · Bo${m.bo}</span>
        <div class="seg" aria-label="Viewer mode">${[['commentary', 'Commentary only'], ['highlights', 'Highlights only'], ['extended', 'Extended']].map(([k, v]) => `<button class="${mode === k ? 'active' : ''}" data-action="view-mode" data-v="${k}">${v}</button>`).join('')}</div>
      </div>
      <div class="scoreboard">
        <div class="sb-team blue">${badge(A, 'lg')}<span class="nm">${esc(A.name)}</span><span class="rt">OVR ${A.ovr} ${flagsOf(A)}</span></div>
        <div class="sb-mid"><div class="sb-score"><span id="scA">${scoreA}</span><span class="dash">-</span><span id="scB">${scoreB}</span></div><div class="sb-sub" id="sbSub">${isLive ? 'GAME ' + (live.gi + 1) : res ? 'FINAL' : 'SERIES'}</div></div>
        <div class="sb-team orange">${badge(B, 'lg')}<span class="nm">${esc(B.name)}</span><span class="rt">OVR ${B.ovr} ${flagsOf(B)}</span></div>
      </div>
      <div class="game-pips" id="pips">${pips}</div>
      ${isLive ? `
        <div class="live-bar"><span class="clock" id="clock">5:00</span><span class="mono muted" id="gameScore" style="font-size:13px"></span></div>
        <div class="commentary" id="commentary">Kick-off!</div>
        <div class="pitch-wrap ${mode === 'commentary' ? 'hidden' : ''}"><canvas id="pitch" width="1100" height="820" aria-label="Top-down live view of the pitch"></canvas><div class="pitch-overlay" id="pitchOverlay"></div></div>
        <div class="live-bar">
          <button class="btn sm" data-action="live-pause">${live.playing ? 'Pause' : 'Resume'}</button>
          <div class="seg" aria-label="Playback speed">${SPEEDS.map((s) => `<button class="${live.speed === s ? 'active' : ''}" data-action="live-speed" data-v="${s}">${s}×</button>`).join('')}</div>
          <button class="btn sm" data-action="live-skip-game">Skip game</button>
          <button class="btn sm orange" data-action="live-reveal">Reveal result →</button>
        </div>
        <div class="feed" id="feed"></div>`
      : res ? `
        <div class="result-line">${esc(getTeam(res.winner).name)} win ${Math.max(res.sa, res.sb)}-${Math.min(res.sa, res.sb)}${res.upset ? ' · <b style="color:var(--orange)">UPSET</b>' : ''}</div>
        ${gameSummary(res, A, B)}
        <div class="live-bar">${nextMatchButton(T)}</div>`
      : `
        <div class="result-line">${mine ? 'Your team is up next. Pick a playstyle, then play the series.' : 'Watch it live with commentary and a top-down pitch, or simulate instantly.'}</div>
        <div class="live-bar"><button class="btn primary" data-action="play-live" data-id="${esc(m.id)}">▶ Play this series</button><button class="btn" data-action="sim-one" data-id="${esc(m.id)}">Quick sim</button></div>`}
    </section>`;
  }
  function nextMatchButton(T) {
    const r = E.readyMatches(T);
    if (!r.length) return T.champion ? `<button class="btn primary" data-action="show-champion">🏆 View champion</button>` : '';
    return `<button class="btn primary" data-action="feature-next">Next series →</button>`;
  }
  function gameSummary(res, A, B) {
    return `<div class="feed" style="max-height:260px">${res.games.map((g, i) => {
      const goals = g.events.filter((e) => e.type === 'goal');
      return `<div class="ev"><span class="t">G${i + 1}</span><span><b>${g.ga}-${g.gb}${g.ot ? ' (OT ' + fmtClock(g.otTime, true) + ')' : ''}</b> — ${goals.map((e) => `<span style="color:${e.side === 'A' ? 'var(--team-a)' : 'var(--team-b)'}">${esc(e.scorer)}</span>`).join(', ') || 'no goals'}</span></div>`;
    }).join('')}</div>`;
  }
  const fmtClock = (sec, ot) => { const s = Math.max(0, Math.round(sec)); return (ot ? '+' : '') + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function startLive(mid) {
    const T = state.T;
    const m = T.matches[mid];
    if (!E.isReady(m)) return;
    stopLive();
    const res = E.simSeries(T, m, getTeam);
    live = { mid, res, gi: 0, t: 0, sa: 0, sb: 0, playing: true, speed: state.settings.speed, ei: 0, last: 0, pauseUntil: performance.now() + 2000, cdStart: performance.now() + 300, cdEnd: performance.now() + 2000, kickAt: 0, pitch: null, needKick: false, goalFlash: 0, done: false, feed: [{ t: 0, txt: 'Game 1 — kickoff!' }] };
    T.featured = mid;
    render();
  }
  function stopLive() { if (live && live.raf) cancelAnimationFrame(live.raf); live = null; }

  function mountLive() {
    if (!live) return;
    const cv = $('#pitch');
    const mm = state.T.matches[live.mid];
    if (!live.pitch) { live.pitch = new window.RLPitch(cv, getTeam(mm.a), getTeam(mm.b)); live.pitch.theme = themeOf(state.T.theme); }
    else live.pitch.attach(cv);
    live.last = performance.now();
    renderFeed();
    if (live.raf) cancelAnimationFrame(live.raf);
    const gen = (live.gen = (live.gen || 0) + 1);
    const step = (now) => {
      if (!live || live.gen !== gen) return;
      const dt = Math.min(0.1, (now - live.last) / 1000);
      live.last = now;
      tickLive(dt, now);
      if (live && live.gen === gen) live.raf = requestAnimationFrame(step);
    };
    live.raf = requestAnimationFrame(step);
  }

  function liveAggregate() {
    const games = live.res.games.slice(0, live.gi).concat([partialGame(live.res.games[live.gi], live.t)]);
    return { games, goalsA: games.reduce((s, g) => s + g.ga, 0), goalsB: games.reduce((s, g) => s + g.gb, 0) };
  }
  function partialGame(g, t) {
    if (!g) return { ga: 0, gb: 0, pstats: [], events: [] };
    const evs = g.events.filter((e) => e.t <= t);
    const ps = {};
    g.pstats.forEach((p) => (ps[p.side + p.name] = { name: p.name, team: p.team, side: p.side, g: 0, a: 0, sv: 0, sh: 0, dm: 0, score: 0 }));
    evs.forEach((e) => {
      const S = (side, n) => ps[side + n];
      if (e.type === 'goal') { const s = S(e.side, e.scorer); if (s) { s.g++; s.sh++; s.score += 120; } if (e.assist) { const a = S(e.side, e.assist); if (a) { a.a++; a.score += 50; } } }
      if (e.type === 'save') { const o = e.side === 'A' ? 'B' : 'A'; const s = S(e.side, e.shooter); if (s) { s.sh++; s.score += 20; } const v = S(o, e.saver); if (v) { v.sv++; v.score += 50; } }
      if (e.type === 'miss') { const s = S(e.side, e.shooter); if (s) { s.sh++; s.score += 20; } }
      if (e.type === 'demo') { const s = S(e.side, e.who); if (s) { s.dm++; s.score += 15; } }
    });
    const last = evs.filter((e) => e.type === 'goal').pop();
    return { ga: last ? last.score[0] : 0, gb: last ? last.score[1] : 0, pstats: Object.values(ps), events: evs };
  }

  function eventText(e, A, B) {
    const tn = (side) => (side === 'A' ? A.name : B.name);
    switch (e.type) {
      case 'goal': return `GOAL! ${e.scorer} scores for ${tn(e.side)}${e.assist ? ', assisted by ' + e.assist : ''} — ${e.speed} km/h${e.ot ? '. It ends in overtime!' : '.'}`;
      case 'save': return e.epic ? `EPIC SAVE! ${e.saver} robs ${e.shooter}!` : `${e.saver} saves ${e.shooter}'s shot.`;
      case 'miss': return `${e.shooter} (${tn(e.side)}) fires wide.`;
      case 'demo': return `${e.who} demolishes ${e.victim}!`;
    }
    return '';
  }

  function tickLive(dt, now) {
    const T = state.T, m = T.matches[live.mid];
    const A = getTeam(m.a), B = getTeam(m.b);
    const g = live.res.games[live.gi];
    if (!g) return;
    const endT = g.ot ? 300 + g.otTime : 300;
    const t0 = live.t;
    if (live.needKick && now >= live.kickAt) { live.needKick = false; if (live.pitch) live.pitch.kickoff(); live.cdStart = now; live.cdEnd = live.pauseUntil; }
    if (live.playing && now > live.pauseUntil) {
      let rate = live.speed; // 1x = real time (a game lasts 5:00)
      if (state.settings.mode === 'highlights') {
        const next = g.events.find((e) => e.t > live.t && e.type !== 'demo');
        if (!next || next.t - live.t > 3) rate *= 6;
      }
      live.t = Math.min(endT, live.t + dt * rate);
      if (g.ot && !live.otAnnounced && t0 < 300) live.t = Math.min(live.t, 300); // the clock stops at 0:00 for overtime
      // consume events
      while (live.ei < g.events.length && g.events[live.ei].t <= live.t) {
        const e = g.events[live.ei++];
        const txt = eventText(e, A, B);
        live.feed.unshift({ t: e.t, txt, goal: e.type === 'goal', side: e.side });
        const c = $('#commentary'); if (c) c.textContent = txt;
        if (e.type === 'goal') {
          live.goalFlash = now;
          const ov = $('#pitchOverlay'); if (ov) ov.innerHTML = `<div class="goal-flash ${e.side === 'A' ? 'blue' : 'orange'}">GOAL!</div>`;
          live.pauseUntil = now + 4200 / Math.sqrt(live.speed);
          live.kickAt = now + 2000 / Math.sqrt(live.speed);
          live.needKick = true;
          if (live.pitch) live.pitch.goal(e.side);
        }
        renderFeed();
        refreshLiveStats();
      }
      if (live.t >= 300 && g.ot && !live.otAnnounced) {
        // tied at 0:00: play stops, then overtime starts with a fresh kickoff (as in Rocket League)
        live.otAnnounced = true;
        const c = $('#commentary'); if (c) c.textContent = 'Tied at zeroes on the clock — OVERTIME! Next goal wins.';
        live.feed.unshift({ t: 300, txt: 'OVERTIME! Next goal wins.' });
        const ov = $('#pitchOverlay'); if (ov) ov.innerHTML = '<div class="goal-flash ot">OVERTIME</div>';
        live.pauseUntil = now + 4200 / Math.sqrt(live.speed);
        live.kickAt = now + 2000 / Math.sqrt(live.speed);
        live.needKick = true;
        renderFeed();
      }
      if (live.t >= endT && now > live.pauseUntil) { endLiveGame(); return; }
    }
    if (live.pitch) {
      const frozen = !live.playing || now < live.pauseUntil;
      const gdt = live.t - t0;
      if (frozen) live.pitch.update(live.t, live.playing ? dt * 0.6 : 0, g, true);
      else if (gdt > 0) live.pitch.update(live.t, gdt, g, false);
      let cd = null;
      if (live.cdEnd && now >= live.cdStart) {
        if (now < live.cdEnd) cd = String(3 - Math.min(2, Math.floor(((now - live.cdStart) / Math.max(1, live.cdEnd - live.cdStart)) * 3)));
        else if (now < live.cdEnd + 450) cd = 'GO!';
      }
      if (state.settings.mode !== 'commentary') live.pitch.render(live.playing ? dt : 0, cd);
    }
    // clock
    const ck = $('#clock');
    if (ck) {
      const ot = live.t > 300;
      ck.textContent = ot ? fmtClock(live.t - 300, true) : fmtClock(300 - live.t);
      ck.classList.toggle('ot', ot);
      const p = partialGame(g, live.t);
      const gs = $('#gameScore'); if (gs) gs.textContent = `Game ${live.gi + 1}: ${p.ga}-${p.gb}`;
    }
  }

  function endLiveGame() {
    const g = live.res.games[live.gi];
    if (g.ga > g.gb) live.sa++; else live.sb++;
    live.gi++; live.t = 0; live.ei = 0; live.otAnnounced = false; live.needKick = false;
    if (live.pitch) live.pitch.newGame();
    if (live.gi >= live.res.games.length) { finishLive(); return; }
    live.pauseUntil = performance.now() + 2600 / Math.sqrt(live.speed);
    live.cdStart = performance.now() + 500 / Math.sqrt(live.speed); live.cdEnd = live.pauseUntil;
    live.feed.unshift({ t: 0, txt: `Game ${live.gi + 1} — kickoff! Series ${live.sa}-${live.sb}` });
    render();
  }
  function finishLive() {
    const T = state.T; const mid = live.mid; const res = live.res;
    stopLive();
    applyResult(T.matches[mid], res);
    render();
    afterResults();
  }
  function renderFeed() {
    const f = $('#feed'); if (!f || !live) return;
    f.innerHTML = live.feed.slice(0, 40).map((e) => `<div class="ev ${e.goal ? 'goal' : ''} ${e.side === 'B' ? 'b' : ''}"><span class="t">${e.t > 300 ? fmtClock(e.t - 300, true) : fmtClock(300 - e.t)}</span><span>${esc(e.txt)}</span></div>`).join('');
  }
  let statsThrottle = 0;
  function refreshLiveStats() {
    const now = performance.now();
    if (now - statsThrottle < 400) return; statsThrottle = now;
    const T = state.T, m = T.matches[live.mid];
    const holder = app.querySelector('.stack.c-3 > section.tile');
    if (holder) { const tmp = document.createElement('div'); tmp.innerHTML = statsTile(T, m); holder.replaceWith(tmp.firstElementChild); }
  }

  /* ---------------- Results & stories ---------------- */
  function applyResult(m, res) {
    const T = state.T;
    const W = getTeam(res.winner), L = getTeam(res.loser);
    E.commitResult(T, m, res);
    const score = Math.max(res.sa, res.sb) + '-' + Math.min(res.sa, res.sb);
    const when = m.label;
    if (res.upset) T.stories.unshift({ kind: 'upset', when, html: `<b>Upset!</b> ${esc(W.name)} (${W.ovr}) beat ${esc(L.name)} (${L.ovr}) ${score}.` });
    else if (m.id === T.featured || T.managed === W.id || T.managed === L.id) T.stories.unshift({ kind: '', when, html: `${esc(W.name)} beat ${esc(L.name)} ${score}.` });
    const ot = res.games.filter((g) => g.ot && g.otTime > 120);
    if (ot.length) T.stories.unshift({ kind: '', when, html: `Marathon overtime: ${esc(W.name)} vs ${esc(L.name)} went ${fmtClock(ot[0].otTime, true)} into OT.` });
    const outs = E.updateEliminations(T, m);
    outs.forEach((id) => { if (id !== T.champion) T.stories.unshift({ kind: 'out', when, html: `${esc(getTeam(id).name)} ${T.managed === id ? '— your team — ' : ''}are eliminated.` }); });
    if (T.champion && !T.championAnnounced && T.finished) {
      T.championAnnounced = true;
      T.stories.unshift({ kind: 'win', when: 'Champions', html: `🏆 <b>${esc(getTeam(T.champion).name)}</b> win the tournament!` });
    }
    T.stories = T.stories.slice(0, 120);
    if (T.featured === m.id) { /* keep showing result */ }
    save();
    return outs;
  }

  function afterResults() {
    const T = state.T;
    if (T.career && T.finished && !T.career.recorded) { window.RLCareer.recordFromT(T); save(); }
    if (T.managed && T.eliminated[T.managed] && !T.managedOutShown) { T.managedOutShown = true; save(); openTeamOut(); return; }
    if (T.finished && !T.championShown) { T.championShown = true; save(); openChampion(); }
  }

  function simMatches(list) {
    const T = state.T;
    list.forEach((m) => { if (E.isReady(m)) { const res = E.simSeries(T, m, getTeam); applyResult(m, res); } });
  }
  function simDay() {
    const T = state.T;
    const day = E.nextDay(T);
    if (day == null) return;
    const cs = E.readyMatches(T)[0].stage;
    simMatches(E.readyMatches(T).filter((m) => m.day === day && m.stage === cs));
    T.featured = null;
    render(); afterResults();
  }
  function simAll() {
    const T = state.T;
    let guard = 0;
    while (E.readyMatches(T).length && guard++ < 5000) {
      if (T.managed && T.eliminated[T.managed] && !T.managedOutShown) break;
      simMatches(E.readyMatches(T));
    }
    T.featured = null;
    render(); afterResults();
  }

  function openTeamOut() {
    const T = state.T; const t = getTeam(T.managed);
    openModal(`${modalHead('Your team are out', '')}<div class="modal-body" style="text-align:center">${badge(t, 'xl')}<h3 style="font-family:var(--display);font-size:26px;margin:12px 0 4px">${esc(t.name)}</h3><p class="muted">They have no remaining series in this tournament.</p></div>
      <div class="modal-foot">${T.career ? '<button class="btn" data-action="career-out-sim">Simulate the rest</button><button class="btn primary" data-action="continue-neutral">Keep watching</button>' : '<button class="btn" data-action="replay-team">Replay this team</button><button class="btn primary" data-action="continue-neutral">Continue neutrally</button>'}</div>`, { size: 'sm' });
  }

  function openChampion() {
    const T = state.T; const t = getTeam(T.champion);
    const rows = Object.values(T.stats).filter((s) => s && s.name);
    const mvp = rows.filter((s) => s.team === T.champion).sort((a, b) => b.score - a.score)[0];
    const topG = rows.slice().sort((a, b) => b.g - a.g || b.score - a.score)[0];
    const topSv = rows.slice().sort((a, b) => b.sv - a.sv)[0];
    const ms = T.order.map((id) => T.matches[id]).filter((m) => m.result && !m.result.bye && (m.a === T.champion || m.b === T.champion));
    const wins = ms.filter((m) => m.result.winner === T.champion).length;
    const award = (lbl, p, val) => p ? `<div class="award"><small>${lbl}</small><b>${esc(p.name)}</b><span class="muted">${esc(getTeam(p.team).name)} · ${val}</span></div>` : '';
    openModal(`${modalHead(T.cfg && T.cfg.custom ? 'Match winner' : 'Champions', esc(T.title || E.FORMATS[T.format].name) + ' · ' + T.teams.length + ' teams')}
      <div class="modal-body"><div class="champion"><div class="trophy">🏆</div>${badge(t, 'xl')}<h3>${esc(t.name)}</h3><p class="muted">${t.players.slice(0, 3).map((p) => (p.flag || '') + ' ' + esc(p.name)).join(' · ')}</p><p>${wins} series wins from ${ms.length}${T.runnerUp ? ' · beat ' + esc(getTeam(T.runnerUp).name) + ' in the final' : ''}.</p></div>
        <div class="award-grid">${award('Tournament MVP', mvp, mvp && mvp.score + ' pts')}${award('Top scorer', topG, topG && topG.g + ' goals')}${award('Wall award', topSv, topSv && topSv.sv + ' saves')}</div></div>
      <div class="modal-foot"><button class="btn" data-action="export-results">Save tournament</button><button class="btn" data-action="champ-fixtures">View team fixtures</button>${T.career ? '<button class="btn primary" data-action="nav" data-v="career">Back to career →</button>' : '<button class="btn primary" data-action="run-it-back">Run it back ↻</button>'}</div>`, { size: 'md' });
  }

  /* ---------------- Settings & guide ---------------- */
  function openSettings() {
    const st = state.settings;
    openModal(`${modalHead('Settings', '')}
      <div class="modal-body">
        
        <div class="field"><label for="setSpeed">Default playback speed</label><select class="select" id="setSpeed">${SPEEDS.map((s) => `<option value="${s}" ${st.speed === s ? 'selected' : ''}>${s}×</option>`).join('')}</select></div>
        <div class="field"><label for="setMode">Default viewer</label><select class="select" id="setMode">${[['extended', 'Extended (pitch + commentary)'], ['highlights', 'Highlights only'], ['commentary', 'Commentary only']].map(([k, v]) => `<option value="${k}" ${st.mode === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <hr class="divider" />
        <p class="help">Data: ${esc(DATA.source)} · updated ${esc(DATA.updated)}.</p>
        <button class="btn danger" data-action="reset-all">Reset all saved data</button>
      </div>
      <div class="modal-foot"><button class="btn primary" data-action="save-settings">Save</button></div>`, { size: 'sm' });
  }
  function openGuide() {
    openModal(`${modalHead('How it works', '')}
      <div class="modal-body" style="font-size:14px">
        <ol style="padding-left:18px;display:grid;gap:8px;margin:0">
          <li><b>Pick a format</b> and field size in <i>Tournament setup</i>. Tap <b>i</b> for a description of each format.</li>
          <li><b>Add teams</b> from the RLCS 2026 library, auto-fill by region or ranking, or create your own team.</li>
          <li><b>Open draw</b> to swap teams between groups/seeds and use <b>Edit match</b> to change series length or force a result.</li>
          <li>Optionally <b>manage a team</b> to choose its playstyle before every series.</li>
          <li><b>Start tournament</b>. Play series live (2D pitch + commentary), quick-sim one, or simulate a whole matchday or the rest of the event.</li>
        </ol>
        <p class="help">Each game is 5:00 with sudden-death overtime. Team strength is the average rating of the three starters; ratings were derived from 2026 RLCS results on Liquipedia and can be edited. Your setup and tournament are saved in this browser automatically.</p>
      </div>`, { size: 'md' });
  }

  /* ---------------- Export / import ---------------- */
  function download(name, obj) {
    const json = JSON.stringify(obj, null, 2);
    const preset = obj.kind === 'rlsim-preset';
    openModal(`${modalHead(preset ? 'Save preset' : 'Save tournament', preset ? 'Copy this text and keep it somewhere safe. Paste it into Import preset to load this setup again.' : 'Copy the full results, series scores and player stats as JSON.')}
      <div class="modal-body"><textarea class="input mono" id="jsonOut" readonly rows="14" style="width:100%;font-size:12px;resize:vertical" aria-label="${esc(name)}">${esc(json)}</textarea></div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Close</button><button class="btn primary" data-action="copy-json">Copy</button></div>`, { size: 'md', focus: false });
  }
  function applyPreset(p) {
    if (!p || p.kind !== 'rlsim-preset') throw new Error('not a preset');
    state.setup = Object.assign(defaultSetup(), p.setup || {});
    (p.customTeams || []).forEach((ct) => { if (!state.customTeams.find((x) => x.id === ct.id)) state.customTeams.push(ct); });
    state.teamEdits = Object.assign({}, state.teamEdits, p.teamEdits || {});
    invalidateTeams();
    const known = new Set(allTeams().map((t) => t.id));
    state.setup.teams = state.setup.teams.filter((id) => known.has(id));
    snapSize(); persistRender(); toast('Preset imported.');
  }
  function importPreset() {
    openModal(`${modalHead('Import preset', 'Paste preset text, or choose a preset file.')}
      <div class="modal-body"><textarea class="input mono" id="jsonIn" rows="10" style="width:100%;font-size:12px;resize:vertical" placeholder='{"kind":"rlsim-preset", ...}' aria-label="Preset text"></textarea>
      <div class="field" style="margin-top:12px"><label for="presetFile">Or load a file</label><input class="input" type="file" id="presetFile" accept="application/json,.json" /></div></div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="paste-import">Import</button></div>`, { size: 'md' });
    $('#presetFile').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then((txt) => { try { applyPreset(JSON.parse(txt)); closeModal(); } catch (err) { toast('That file is not a valid preset.'); } });
    });
  }

  /* ---------------- Home ---------------- */
  const REGION_COLORS = { EU: '#3b6cf6', NA: '#e0662b', SAM: '#1f9d55', MENA: '#c79a1c', OCE: '#0f9bb5', APAC: '#d43f6a', SSA: '#8b5cf6' };
  const EVENT_FIELDS = {
    paris: ['Team Vitality', 'Gentle Mates', 'Ninjas in Pyjamas', 'Karmine Corp', 'Manchester City Esports', 'NRG', 'Spacestation Gaming', 'Shopify Rebellion', 'FUT Esports', 'MIBR', 'FURIA', 'Twisted Minds', 'R8 Esports', 'Wildcard', 'TSM', 'Five Fears'],
    boston: ['Karmine Corp', 'Gentle Mates', 'Team Vitality', 'Ninjas in Pyjamas', 'Geekay Esports', 'NRG', 'Shopify Rebellion', 'Virtus.pro', 'Spacestation Gaming', 'FURIA', 'MIBR', 'Team Falcons', 'Twisted Minds', 'PWR', 'TSM', 'Five Fears'],
  };
  function idsByNames(names) { const byName = {}; allTeams().filter((t) => t.season === '2026').forEach((t) => (byName[t.name.toLowerCase()] = t.id)); return names.map((n) => byName[n.toLowerCase()]).filter(Boolean); }
  function fillTo(ids, n, pool) {
    const out = ids.slice(0, n); const have = new Set(out);
    (pool || rankedTeams()).forEach((t) => { if (out.length < n && !have.has(t.id)) { out.push(t.id); have.add(t.id); } });
    return out;
  }
  /* Event branding (from each event's official logo on Liquipedia): primary / secondary / accent + logo */
  const THEMES = window.RL_EVENT_THEMES || {};
  const themeOf = (key) => (key && THEMES[key]) || null;
  const themeVars = (th) => (th ? `--c:${th.a};--e1:${th.a};--e2:${th.b};--e3:${th.c};--e-on:${th.on || '#fff'}` : '');
  function compTile(c) {
    const th = themeOf(c.theme);
    return `<button class="comp-tile${th ? ' themed' : ''}" data-action="comp" data-v="${c.id}" style="${th ? themeVars(th) : '--c:' + c.color}"><span class="comp-ico">${esc(c.mono)}</span><span class="comp-txt"><b>${esc(c.name)}</b><small>${esc(c.sub)}</small></span></button>`;
  }
  function competitions() {
    const ev = DATA.events;
    const list = [
      { id: 'worlds', theme: 'worlds-2026', mono: 'WC', color: '#d4a017', name: 'RLCS World Championship', sub: '2026 · 20 teams', info: ev[0], format: 'groups', groupSize: 5, advance: 2, size: 20, teams: () => allTeams().filter((t) => t.worlds && t.season === '2026').map((t) => t.id), fmtText: '4 groups of 5, top two into an eight-team knockout (Bo7).' },
      { id: 'paris', theme: 'paris', mono: 'PM', color: '#3b6cf6', name: 'Paris Major', sub: '2026 · 16 teams', info: ev[1], format: 'major', size: 16, teams: () => idsByNames(EVENT_FIELDS.paris), fmtText: 'Four groups of four (Bo5), then the Final Eight playoffs (Bo7).' },
      { id: 'boston', theme: 'boston', mono: 'BM', color: '#b91c1c', name: 'Boston Major', sub: '2026 · 16 teams', info: ev[2], format: 'major', size: 16, teams: () => idsByNames(EVENT_FIELDS.boston), fmtText: 'Four groups of four (Bo5), then the Final Eight playoffs (Bo7).' },
    ];
    list.forEach((c) => (c.season = c.season || '2026'));
    list.forEach((c) => { const th = themeOf(c.theme); if (th) c.color = th.a; });
    if (HAS27) list.unshift(...competitions27());
    HIST.forEach((se) => se.events.forEach((e, i) => {
      const byName = {}; se.teams.forEach((t) => (byName[t.name] = 'h' + se.key + '-' + t.id.replace(/^h[^-]*-/, '')));
      const ids = e.teams.map((n) => { const t = se.teams.find((x) => x.name === n); return t && t.id; }).filter(Boolean);
      list.push({ id: 'arch-' + se.key + '-' + i, season: se.key, theme: e.worlds ? 'worlds-' + se.key : 'major-' + se.key + '-' + i, mono: e.worlds ? 'WC' : 'M' + (i + 1), color: e.worlds ? '#F2542D' : '#1F8BFF', name: e.name, sub: se.label.replace(/^RLCS /, '') + ' · ' + e.size + ' teams · won by ' + (e.winner || 'TBD'),
        info: { where: e.where, date: e.date, winner: e.winner || '—', runnerUp: e.runnerUp || '—' }, format: e.format, groupSize: e.groupSize, advance: e.advance, size: e.size, teams: () => ids, fmtText: e.fmtText });
    }));
    Object.entries(REGIONS).forEach(([k, v]) => list.push({ id: 'open-' + k, theme: 'region-' + k.toLowerCase(), mono: k, color: REGION_COLORS[k], name: v + ' Open', sub: '2026 · regional open · 16 teams', season: '2026', region: k, format: 'swiss', size: 16, teams: () => rankedTeams('2026').filter((t) => t.region === k).map((t) => t.id), fmtText: '16-team Swiss stage (3 wins to qualify, 3 losses out), then an eight-team playoff.' }));
    return list;
  }
  /* RLCS 2027 Club Championship events (rosters as of today; TBD slots filled by the best-rated eligible teams) */
  function competitions27() {
    const D = window.RL_DATA27;
    const byName = {}; rankedTeams('2027').forEach((t) => { if (!t.custom) byName[t.name] = t; });
    const ids = (names) => names.map((n) => byName[n]).filter(Boolean).map((t) => t.id);
    const r27 = rankedTeams('2027').filter((t) => !t.custom);
    const ko = D.events.find((e) => e.id === 'k27');
    const koIds = ids(ko.teams);
    const euQ = r27.find((t) => t.region === 'EU' && !t.partner && !koIds.includes(t.id));
    const koField = euQ ? koIds.concat(euQ.id) : koIds;
    const list = [{
      id: 'k27', theme: 'k27', season: '2027', mono: 'KO', color: '#e11d48', name: 'Club Championship Kick-Off', sub: 'London · 9–13 Dec 2026 · 24 teams', format: 'double', size: 24,
      teams: () => koField, info27: { where: ko.where, date: ko.date, prize: ko.prize, status: 'Upcoming' }, projected: euQ ? [euQ.name + ' fills the Europe Kick-Off Open spot (qualifier ends 22 Nov)'] : [],
      fmtText: '24 teams, double elimination. The top 8 seeds get a bye to Upper Round 2. The winner\'s region earns an extra Club Finale spot.',
    }];
    D.events.filter((e) => e.id.startsWith('ko-')).forEach((e) => {
      const field = ids(e.teams).sort((a, b) => getTeam(b).ovr - getTeam(a).ovr).slice(0, 16);
      list.push({ id: e.id, theme: 'region-' + e.region.toLowerCase(), season: '2027', region: e.region, mono: e.region, color: REGION_COLORS[e.region], name: 'Kick-Off Open · ' + REGIONS[e.region], sub: e.qualified ? 'Finished · ' + e.qualified + ' qualified' : 'Live · 13–22 Nov 2026', format: 'swiss8', size: 16,
        teams: () => field, info27: { where: 'Online · ' + REGIONS[e.region], date: e.region === 'EU' ? '2026-11-13 – 2026-11-22' : '2026-11-06 – 2026-11-15', status: e.qualified ? 'Finished — ' + e.qualified + ' won the Kick-Off spot' : 'In progress — top 64 decided, playoffs on 20–22 Nov' },
        fmtText: 'The real Open runs double elimination → 32-team Swiss → GSL groups → AFL Final Eight. Simulated here from the top 16 of the top-64 field: 16-team Swiss, then the Final Eight.' });
    });
    const LEAGUE_SIZE = { EU: 12, NA: 12, SAM: 8, MENA: 8, OCE: 8, APAC: 8, SSA: 8 };
    Object.entries(LEAGUE_SIZE).forEach(([k, n]) => {
      const partners = r27.filter((t) => t.region === k && t.partner).map((t) => t.id);
      const rest = r27.filter((t) => t.region === k && !t.partner).slice(0, n - partners.length);
      list.push({ id: 'cl-' + k, theme: 'region-' + k.toLowerCase(), season: '2027', region: k, mono: k, color: REGION_COLORS[k], name: 'Club League · ' + REGIONS[k], sub: '2027 · ' + n + ' teams · ' + partners.length + ' partners', format: 'league', size: n,
        teams: () => partners.concat(rest.map((t) => t.id)), info27: { where: REGIONS[k], date: '2027 (dates TBA)', status: 'Upcoming — Club League qualifiers not yet played' },
        projected: [rest.length + ' qualifier spot' + (rest.length === 1 ? '' : 's') + ' filled by the best-rated non-partner teams'],
        fmtText: 'Regional league play: partners plus Club League qualifiers. The top teams reach the Club Finale (EU 4, NA 4, MENA 2, SAM 2, OCE/APAC/SSA 1). Simulated as a single round robin.' });
    });
    const SLOTS = { EU: 4, NA: 4, MENA: 2, SAM: 2, OCE: 1, APAC: 1, SSA: 1 };
    let fin = [];
    Object.entries(SLOTS).forEach(([k, n]) => (fin = fin.concat(r27.filter((t) => t.region === k).slice(0, n).map((t) => t.id))));
    const extra = r27.find((t) => !fin.includes(t.id));
    if (extra) fin.push(extra.id);
    list.push({ id: 'cf27', season: '2027', mono: 'CF', color: '#d4a017', name: 'Club Finale', sub: '2027 · 16 teams · $500,500', format: 'swiss8', size: 16, teams: () => fin,
      info27: { where: 'Venue TBA', date: '2027 (dates TBA)', prize: '$500,500', status: 'Upcoming — field decided by the Club Leagues' },
      projected: ['Projected field: the top-rated teams in each region by the slot split, plus the Kick-Off slot'],
      fmtText: '16-team Swiss stage (Bo5), then the AFL Final Eight (Bo7). Slots: EU 4, NA 4, MENA 2, SAM 2, OCE 1, APAC 1, SSA 1, plus one for the Kick-Off winner\'s region.' });
    return list;
  }
  function presetSetup(c) {
    const se = c.season || '2026';
    const ids = fillTo(c.teams(), c.size, c.region ? rankedTeams(se).filter((t) => t.region === c.region).concat(rankedTeams(se)) : rankedTeams(se));
    const s = Object.assign(defaultSetup(), { format: c.format, size: c.size, groupSize: c.groupSize || 4, advance: c.advance || 2, legs: c.legs || 1, quickFill: c.region || 'top', simStyle: state.setup.simStyle, goalLevel: state.setup.goalLevel });
    state.setup = s;
    s.teams = ['swiss', 'swiss8', 'knockout', 'double'].includes(c.format) ? ids.slice().sort((a, b) => getTeam(b).ovr - getTeam(a).ovr) : arrangeForFormat(ids);
    s.title = c.name;
    s.theme = c.theme || null;
  }
  function go(view) {
    stopLive();
    state.view = view;
    const h = view === 'home' ? '' : view === 'setup' ? '#custom-tournament' : view === 'team' ? '#team/' + encodeURIComponent(state.ui.teamId || '') : '#' + view;
    try { if (location.hash !== h) history.replaceState(null, '', h || location.pathname + location.search); } catch (e) { /* sandboxed history */ }
    persistRender();
    window.scrollTo({ top: 0 });
  }

  function renderHome() {
    const T = state.T;
    const comps = competitions();
    const q = (state.ui.compQuery || '').toLowerCase();
    const compList = comps.filter((c) => !q || (c.name + ' ' + c.sub).toLowerCase().includes(q));
    const worlds = allTeams().filter((t) => t.worlds && t.season === '2026').sort((a, b) => parseInt(a.worlds, 10) - parseInt(b.worlds, 10) || b.ovr - a.ovr);
    const regionCounts = {}; rankedTeams().forEach((t) => (regionCounts[t.region] = (regionCounts[t.region] || 0) + 1));
    const live = T && !T.finished;
    app.innerHTML = `<div class="home">
      ${live ? `<section class="home-banner"><div><b>Resume tournament</b><p>${esc(T.title || E.FORMATS[T.format].name)} · ${T.teams.length} teams · ${Object.values(T.matches).filter((m) => m.result && !m.result.bye).length} series played</p></div><button class="btn sm" data-action="resume">View →</button></section>` : `<section class="home-banner"><div><b>Resume tournaments</b><p>Tournaments you start are saved on this device so you can pick them up later.</p></div><button class="btn sm" data-action="nav" data-v="setup">New tournament →</button></section>`}

      <div class="home-h-row"><span></span><div class="search"><input class="input" id="compQuery" placeholder="Search competitions…" value="${esc(state.ui.compQuery || '')}" aria-label="Search competitions" /></div></div>

      <button class="career-banner" data-action="nav" data-v="career"><span class="eyebrow">New · Career mode</span><b>${window.RLCareer.has() ? 'Continue your career' : 'Run an RLCS organisation'}</b><span>${(() => { const c = window.RLCareer.summary(); return c ? esc(c.team.name) + ' · RLCS ' + c.season + ' · ' + esc(c.step) : 'Seasons, Opens, Majors, Worlds, transfers, contracts and player development.'; })()}</span><span class="feat-arrow">→</span></button>

      ${HAS27 ? (() => {
        const ko = comps.find((c) => c.id === 'k27');
        const koTeams = ko.teams().map(getTeam).sort((a, b) => b.ovr - a.ovr);
        const days = Math.max(0, Math.ceil((new Date('2026-12-09T00:00:00Z') - new Date()) / 86400000));
        return `<div class="home-h-row"><h2 class="home-h">RLCS 2027 <span class="pill good" style="vertical-align:middle;font-family:var(--font)">Current season</span></h2><span class="muted" style="font-size:13px">Rosters as of ${esc(window.RL_DATA27.asOf)}</span></div>
        <div class="featured">
          <button class="feat-hero k27" data-action="comp" data-v="k27">
            <div class="feat-copy">
              <span class="eyebrow">Copper Box Arena, London · 9–13 Dec 2026</span>
              <span class="feat-title">Club Championship <em>Kick-Off</em></span>
              <span class="feat-meta">24 teams · double elimination · $300,000</span>
              <span class="feat-meta">${days > 0 ? '<b>' + days + ' days away</b> · ' : ''}20 partner teams + 4 Open qualifiers</span>
            </div>
            <div class="feat-board" aria-hidden="true">
              <div class="feat-board-head"><span>Kick-Off field</span><span class="mono">OVR</span></div>
              <div class="feat-grid feat-grid-6">${koTeams.map((t) => `<div class="fb-cell" title="${esc(t.name)}">${badge(t, 'sm')}<span>${esc(t.tag)}</span><i>${t.ovr}</i></div>`).join('')}</div>
            </div>
          </button>
          <div class="feat-side">
            <button class="feat-card" data-action="comp" data-v="ko-EU" style="--c:#2A5BD7"><span class="feat-card-title">Europe Kick-Off Open</span><span class="feat-meta">Live · playoffs 20–22 Nov · last Kick-Off spot</span><span class="feat-arrow">→</span></button>
            <button class="feat-card" data-action="comp" data-v="cf27" style="--c:#d4a017"><span class="feat-card-title">Club Finale</span><span class="feat-meta">2027 · 16 teams · $500,500</span><span class="feat-arrow">→</span></button>
          </div>
        </div>
        <div class="tile-grid">${compList.filter((c) => c.season === '2027').map(compTile).join('') || '<p class="muted">No competitions match.</p>'}</div>`;
      })() : ''}

      <h2 class="home-h">RLCS 2026</h2>
      <div class="featured">
        <button class="feat-hero" data-action="comp" data-v="worlds">
          <div class="feat-copy">
            <span class="eyebrow">Fort Worth · Sep 2026</span>
            <span class="feat-title">RLCS World <em>Championship</em></span>
            <span class="feat-meta">20 teams · <span class="chip">Real 2026 field</span></span>
            <span class="feat-meta">Won by <b>${esc(DATA.events[0].winner)}</b> over ${esc(DATA.events[0].runnerUp)}</span>
          </div>
          <div class="feat-board" aria-hidden="true">
            <div class="feat-board-head"><span>Worlds field</span><span class="mono">OVR</span></div>
            <div class="feat-grid">${worlds.map((t) => `<div class="fb-cell" title="${esc(t.name)} · ${esc(t.worlds)}">${badge(t, 'sm')}<span>${esc(t.tag)}</span><i>${t.ovr}</i></div>`).join('')}</div>
          </div>
        </button>
        <div class="feat-side">
          <button class="feat-card" data-action="comp" data-v="paris" style="--c:#3b6cf6"><span class="feat-card-title">Paris Major</span><span class="feat-meta">May 2026 · won by ${esc(DATA.events[1].winner)}</span><span class="feat-arrow">→</span></button>
          <button class="feat-card" data-action="comp" data-v="boston" style="--c:#b91c1c"><span class="feat-card-title">Boston Major</span><span class="feat-meta">Feb 2026 · won by ${esc(DATA.events[2].winner)}</span><span class="feat-arrow">→</span></button>
        </div>
      </div>

      <div class="tile-grid">${compList.filter((c) => c.season === '2026').map(compTile).join('') || '<p class="muted">No competitions match.</p>'}</div>

      ${HIST.length ? (() => {
        const ak = HIST.some((x) => x.key === state.ui.archive) ? state.ui.archive : HIST[0].key;
        const se = HIST.find((x) => x.key === ak);
        return `<div class="home-h-row"><h2 class="home-h">Season archive</h2><div class="seg archive-seg" role="tablist" aria-label="Archive season">${HIST.map((x) => `<button class="${x.key === ak ? 'active' : ''}" data-action="archive" data-v="${x.key}" title="${esc(x.label)}">${esc(x.key.replace(/^S(\w+)$/, 'S$1'))}</button>`).join('')}</div></div>
        <p class="help" style="margin:-6px 0 0">${esc(se.label)}: real fields and rosters from ${se.key === 'S9' ? 'the regional championships (the Season 9 Finals were cancelled because of COVID-19)' : se.key === 'SX' ? 'the online regional Majors of each split and the regional Championships (RLCS X had no LAN events)' : /^S\d$/.test(se.key) ? 'the season Finals (the World Championship of its day)' : 'every Major and the World Championship'}. Pick one to simulate it again.</p>
        <div class="tile-grid">${compList.filter((c) => c.season === ak).map(compTile).join('') || '<p class="muted">No competitions match.</p>'}</div>`;
      })() : ''}

      <div class="home-h-row"><h2 class="home-h">Regional leagues</h2>${seasonSeg()}</div>
      <div class="tile-grid">${Object.entries(REGIONS).map(([k, v]) => `<button class="comp-tile${themeOf('region-' + k.toLowerCase()) ? ' themed' : ''}" data-action="region-league" data-v="${k}" style="${themeOf('region-' + k.toLowerCase()) ? themeVars(themeOf('region-' + k.toLowerCase())) : '--c:' + REGION_COLORS[k]}"><span class="comp-ico">${k}</span><span class="comp-txt"><b>${esc(v)}</b><small>${regionCounts[k] || 0} teams · ${seasonLabel(curSeason())} · league + playoffs</small></span></button>`).join('')}</div>

      <h2 class="home-h">More simulators</h2>
      <div class="sim-grid">
        <button class="sim-card" data-action="nav" data-v="career" style="--c:#d4a017"><b>Career mode</b><span>Seasons, transfers, Majors and Worlds.</span></button>
        <button class="sim-card" data-action="nav" data-v="setup" style="--c:#2f8cff"><b>Custom tournament</b><span>Build the field and control the format.</span></button>
        <button class="sim-card" data-action="custom-match" style="--c:#ff8a1f"><b>Custom match</b><span>Play one series between any two teams.</span></button>
        <button class="sim-card" data-action="mega" style="--c:#8b5cf6"><b>128-team knockout</b><span>Every region's best in one enormous bracket.</span></button>
        <button class="sim-card" data-action="build-league" style="--c:#14b8a6"><b>Build a league</b><span>Pick a field and play a full round-robin season.</span></button>
      </div>

      <section class="home-banner about"><b>About the simulator</b><div class="toolbar"><button class="btn xs" data-action="open-guide">How it works</button><button class="btn xs" data-action="nav" data-v="teams">Team rankings</button><a class="btn xs" href="https://liquipedia.net/rocketleague/Main_Page" target="_blank" rel="noopener">Data: Liquipedia ↗</a></div></section>
    </div>`;
    const cq = $('#compQuery');
    if (cq) cq.addEventListener('input', () => { state.ui.compQuery = cq.value; const pos = cq.selectionStart; renderHome(); const n = $('#compQuery'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function openComp(id) {
    const c = competitions().find((x) => x.id === id);
    if (!c) return;
    const se = c.season || '2026';
    const ids = fillTo(c.teams(), c.size, c.region ? rankedTeams(se).filter((t) => t.region === c.region).concat(rankedTeams(se)) : rankedTeams(se));
    const teams = ids.map(getTeam).sort((a, b) => b.ovr - a.ovr);
    const info = c.info, i27 = c.info27;
    const th = themeOf(c.theme);
    openModal(`${th ? `<div class="event-banner${th.art ? ' has-art' : ''}" style="${themeVars(th)}${th.art ? `;background-image:linear-gradient(180deg, rgba(11,18,38,0.05), rgba(11,18,38,0.55)),url(${th.art});background-position:${th.pos || 'center'}${th.fit === 'h' ? `;background-size:cover,auto 100%;background-repeat:no-repeat;background-color:${th.edge}` : ''}` : ''}" ${th.art ? `role="img" aria-label="${esc(th.name)} key art"` : ''}><span class="event-swatches"><i style="background:${th.a}"></i><i style="background:${th.b}"></i><i style="background:${th.c}"></i></span></div>` : ''}${modalHead(c.name, esc(i27 ? 'RLCS 2027 · ' + i27.where + ' · ' + i27.date : info ? info.where + ' · ' + info.date : E.FORMATS[c.format].name + ' · top-rated ' + REGIONS[c.region] + ' teams (2026)'))}
      <div class="modal-body">
        ${info ? `<div class="kv"><span>Real champion</span><b>${esc(info.winner)}</b></div><div class="kv"><span>Runner-up</span><span>${esc(info.runnerUp)}</span></div>` : ''}
        ${i27 ? `<div class="kv"><span>Status</span><b>${esc(i27.status)}</b></div>${i27.prize ? `<div class="kv"><span>Prize pool</span><span>${esc(i27.prize)}</span></div>` : ''}` : ''}
        ${c.projected && c.projected.length ? `<div class="kv"><span>Projected</span><span class="muted">${esc(c.projected.join('; '))}</span></div>` : ''}
        <div class="kv"><span>Format</span><span>${esc(c.fmtText)}</span></div>
        <div class="field-label" style="margin:14px 0 8px">Field · ${teams.length} teams (${se === '2027' ? 'RLCS 2027 rosters as of ' + esc(window.RL_DATA27.asOf) : seasonLabel(se) + ' rosters'})</div>
        <div class="team-grid">${teams.map((t) => `<div class="team-chip">${badge(t)}<div class="meta"><div class="name">${esc(t.name)}</div><div class="sub">OVR ${t.ovr} ${flagsOf(t)}</div></div></div>`).join('')}</div>
      </div>
      <div class="modal-foot"><button class="btn" data-action="comp-customise" data-v="${c.id}">Customise</button><button class="btn primary" data-action="comp-start" data-v="${c.id}">Start tournament →</button></div>`, { size: 'md', cls: th ? 'event-themed' : '', style: themeVars(th) });
  }

  function openCustomMatch() {
    const list = rankedTeams();
    const opts = (sel) => list.map((t) => `<option value="${esc(t.id)}" ${t.id === sel ? 'selected' : ''}>${esc(t.name)} · ${t.ovr}</option>`).join('');
    openModal(`${modalHead('Custom match', 'Create one series with your own teams.')}
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label for="cmA">Blue team</label><select class="select" id="cmA">${opts(list[0].id)}</select></div>
          <div class="field"><label for="cmB">Orange team</label><select class="select" id="cmB">${opts(list[1].id)}</select></div>
          <div class="field"><label for="cmBo">Series length</label><select class="select" id="cmBo">${[1, 3, 5, 7, 9].map((n) => `<option value="${n}" ${n === 7 ? 'selected' : ''}>Best of ${n}</option>`).join('')}</select></div>
          <div class="field"><label for="cmSim">Simulation style</label><select class="select" id="cmSim">${Object.entries(E.SIM_STYLES).map(([k, v]) => `<option value="${k}" ${k === 'standard' ? 'selected' : ''}>${v.name}</option>`).join('')}</select></div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="custom-match-start">Play match →</button></div>`, { size: 'sm' });
  }

  function launch(cfg, title, extra) {
    const goNow = () => {
      stopLive();
      const T = E.buildTournament(cfg, getTeam);
      T.cfg = JSON.parse(JSON.stringify(cfg));
      T.title = title || null;
      if (extra) Object.assign(T, extra);
      if (cfg.custom) { const m = T.matches[T.order[0]]; m.label = 'Showmatch'; m.roundName = 'Showmatch'; T.stages[0].name = 'Showmatch'; T.stages[0].rounds[0].name = 'Showmatch'; }
      E.refresh(T);
      state.T = T; state.ui.stageTab = null; state.ui.filter = '';
      go('tournament');
    };
    if (state.T && !state.T.finished) {
      openModal(`${modalHead('Replace saved tournament?', 'You have a tournament in progress. Starting a new one deletes it.')}<div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="confirmStart">Start new tournament</button></div>`, { size: 'sm' });
      $('#confirmStart').onclick = () => { closeModal(); goNow(); };
    } else { closeModal(); goNow(); }
  }

  /* ---------------- team page ---------------- */
  const orgKey = (t) => (t.logoKey || t.name || '').toLowerCase().replace(/\b(team|esports?|e-sports|gaming|club|esport)\b/g, '').replace(/[^a-z0-9]/g, '') || (t.name || '').toLowerCase();
  let photosState = 0; // 0 not loaded, 1 loading, 2 ready
  function ensurePhotos() {
    if (photosState) return;
    if (window.RL_PHOTOS) { photosState = 2; return; }
    photosState = 1;
    const sc = document.createElement('script'); sc.src = 'js/photos.js'; sc.async = true;
    sc.onload = () => { photosState = 2; if (state.view === 'team') render(); };
    sc.onerror = () => { photosState = 2; window.RL_PHOTOS = window.RL_PHOTOS || {}; if (state.view === 'team') render(); };
    document.head.appendChild(sc);
  }
  function seasonRefDate(se) {
    if (se === '2027') return '2026-11-20';
    if (se === '2026') return '2026-09-01';
    const h = HIST.find((x) => x.key === se);
    const d = h && h.events.map((e) => (e.date || '').slice(0, 10)).filter(Boolean).sort()[0];
    return d || null;
  }
  function ageAt(born, ref) {
    if (!born || !ref) return null;
    const [by, bm, bd] = born.split('-').map(Number), [ry, rm, rd] = ref.split('-').map(Number);
    let a = ry - by; if (bm && (rm < bm || (rm === bm && bd && rd < bd))) a--;
    return { age: a, approx: !bm };
  }
  function teamResults(group) {
    const ids = new Set(group.map((t) => t.id));
    const out = [];
    competitions().forEach((c) => {
      if (!c.info && !c.info27) return; // only real events (regional opens/leagues are generated fields)
      let field; try { field = c.teams(); } catch (e) { return; }
      const mine = group.find((t) => field.includes(t.id));
      if (!mine) return;
      const w = c.info && c.info.winner, r = c.info && c.info.runnerUp;
      const nk = (n) => (n || '').toLowerCase();
      let res = c.info27 ? 'Upcoming' : nk(w) === nk(mine.name) ? 'Champion' : nk(r) === nk(mine.name) ? 'Runner-up' : 'Participant';
      if (c.id === 'worlds' && mine.worlds) res = mine.worlds === '1st' ? 'Champion' : mine.worlds === '2nd' ? 'Runner-up' : mine.worlds + ' place';
      out.push({ c, team: mine, res, date: (c.info && c.info.date) || (c.info27 && c.info27.date) || '' });
    });
    return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }
  function renderTeamPage() {
    const t = allTeams().find((x) => x.id === state.ui.teamId);
    if (!t) { state.view = 'teams'; renderTeamsPage(); return; }
    ensurePhotos();
    const P = window.RL_PHOTOS || {}, PAGES = window.RL_PLAYER_PAGES || {}, B = window.RL_BIRTHS || {};
    const se = t.season || curSeason();
    const seasonTeams = rankedTeams(se).filter((x) => !x.custom);
    const rank = seasonTeams.findIndex((x) => x.id === t.id) + 1;
    const regRank = seasonTeams.filter((x) => x.region === t.region).findIndex((x) => x.id === t.id) + 1;
    const group = allTeams().filter((x) => !x.custom && orgKey(x) === orgKey(t));
    const results = teamResults(group);
    const titles = results.filter((r) => r.res === 'Champion').length;
    const ref = seasonRefDate(se);
    const players = t.players.map((p, i) => {
      const key = p.name + '|' + (p.country || '');
      const ag = ageAt(B[key], ref);
      return { p, i, key, photo: P[key], page: PAGES[key], age: ag };
    });
    const ages = players.map((x) => x.age && x.age.age).filter((a) => a != null);
    const best = players.slice().sort((a, b) => b.p.rating - a.p.rating)[0];
    const otherSeasons = group.filter((x) => x.id !== t.id).sort((a, b) => SEASON_KEYS.indexOf(a.season) - SEASON_KEYS.indexOf(b.season));
    const initials = (n) => esc(n.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?');
    const resPill = (r) => `<span class="pill ${r === 'Champion' ? 'gold' : r === 'Runner-up' ? 'good' : ''}">${r === 'Champion' ? '🏆 ' : ''}${esc(r)}</span>`;
    app.innerHTML = `
      <div class="tp" style="--tc:${esc(t.color || '#1F8BFF')}">
        <div class="tp-hero">
          <button class="btn sm" data-action="nav" data-v="teams">← Team rankings</button>
          <div class="tp-id">
            ${badge(t, 'xl')}
            <div class="tp-name">
              <span class="tp-eyebrow">${esc(seasonLabel(se))} · ${esc(REGIONS[t.region] || t.region)}</span>
              <h1>${esc(t.name)}</h1>
              <div class="tp-tags"><span class="region-tag">${esc(t.region)}</span><span class="pill">${esc(t.tag || '')}</span>${titles ? `<span class="pill gold" title="Real titles at the events in the simulator">🏆 ${titles} title${titles === 1 ? '' : 's'}</span>` : ''}</div>
            </div>
            <div class="tp-ovr"><b>${t.ovr}</b><small>Team rating</small></div>
          </div>
          <div class="tp-stats">
            <div><small>Rank</small><b>#${rank || '—'}</b><span>of ${seasonTeams.length} in ${esc(seasonLabel(se))}</span></div>
            <div><small>${esc(t.region)} rank</small><b>#${regRank || '—'}</b><span>${esc(REGIONS[t.region] || '')}</span></div>
            <div><small>Best player</small><b>${best ? esc(best.p.name) : '—'}</b><span>${best ? best.p.rating + ' rating' : ''}</span></div>
            <div><small>Average age</small><b>${ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : '—'}</b><span>${ages.length ? 'in ' + esc(seasonLabel(se)) : 'birth dates unknown'}</span></div>
          </div>
        </div>
        <section class="tp-sec"><div class="tp-sec-head"><h2>Roster</h2><button class="btn sm" data-action="edit-team" data-id="${esc(t.id)}">Edit team</button></div>
          <div class="tp-roster">${players.map(({ p, i, photo, page, age }) => `
            <article class="tp-player ${i >= 3 ? 'sub' : ''}">
              <div class="tp-photo"><span class="tp-initials" aria-hidden="true">${initials(p.name)}</span>${photo ? `<img src="${esc(photo)}" alt="${esc(p.name)}" loading="lazy" decoding="async" onerror="this.remove()">` : ''}<span class="tp-rating">${p.rating}</span></div>
              <div class="tp-pinfo"><b>${esc(p.name)}</b><small>${p.flag || ''} ${esc(p.country || 'Unknown')}</small>
                <small>${i >= 3 ? 'Substitute' : 'Starter'}${age ? ' · ' + (age.approx ? '~' : '') + age.age + ' years old' : ''}</small>
                ${page ? `<a class="tp-lp" href="https://liquipedia.net/rocketleague/${encodeURIComponent(page.replace(/ /g, '_'))}" target="_blank" rel="noopener">Liquipedia ↗</a>` : ''}</div>
              <div class="tp-bar"><i style="width:${Math.max(4, Math.min(100, (p.rating - 50) * 2))}%"></i></div>
            </article>`).join('')}</div>
          ${photosState === 1 ? '<p class="help">Loading player photos…</p>' : players.some((x) => !x.photo) ? '<p class="help">Photos are from Liquipedia where a player page has one.</p>' : ''}
        </section>
        <div class="tp-grid">
          <section class="tp-sec"><div class="tp-sec-head"><h2>Results</h2><span class="count-pill">${results.length} event${results.length === 1 ? '' : 's'}</span></div>
            ${results.length ? `<div class="tp-results">${results.map((r) => `<button class="tp-result" data-action="comp" data-v="${esc(r.c.id)}"><span class="tp-rdate">${/^\d{4}-\d{2}/.test(r.date || '') ? esc(r.date.slice(0, 7)) : 'TBA'}</span><span class="tp-rname"><b>${esc(r.c.name)}</b><small>${esc(seasonLabel(r.c.season || '2026'))}${r.team.name !== t.name ? ' · as ' + esc(r.team.name) : ''}</small></span>${resPill(r.res)}</button>`).join('')}</div>` : '<p class="muted">No real events for this team in the simulator.</p>'}
          </section>
          <section class="tp-sec"><div class="tp-sec-head"><h2>Other seasons</h2><span class="count-pill">${otherSeasons.length}</span></div>
            ${otherSeasons.length ? `<div class="tp-seasons">${otherSeasons.map((x) => `<button class="tp-season" data-action="team-page" data-id="${esc(x.id)}">${badge(x, 'sm')}<span><b>${esc(seasonLabel(x.season))}</b><small>${esc(x.players.slice(0, 3).map((q) => q.name).join(' · '))}</small></span><span class="tp-sovr">${x.ovr}</span></button>`).join('')}</div>` : '<p class="muted">This roster only appears in one season in the simulator.</p>'}
          </section>
        </div>
      </div>`;
  }

  function renderTeamsPage() {
    const q = (state.ui.rankQuery || '').toLowerCase();
    const reg = state.ui.rankRegion || 'all';
    const list = rankedTeams().map((t, i) => Object.assign({ rank: i + 1 }, t)).filter((t) => (reg === 'all' || t.region === reg) && (!q || t.name.toLowerCase().includes(q) || t.players.some((p) => p.name.toLowerCase().includes(q))));
    app.innerHTML = `
      <div class="page-head"><button class="btn sm" data-action="nav" data-v="home">← Back to modes</button><h1>Team rankings</h1><div class="head-actions">${seasonSeg()}<span class="count-pill">${rankedTeams().length} teams</span></div></div>
      <div class="bento">
        <section class="tile c-12">
          <div class="tile-head"><div><h2>${seasonLabel(curSeason())} rosters</h2><p>${curSeason() === '2027' ? 'Current rosters as of ' + esc((window.RL_DATA27 || {}).asOf || '') + '. ' : HIST.some((x) => x.key === curSeason()) ? 'Rosters from that season\'s ' + (/^S\d$/.test(curSeason()) ? 'Finals' : curSeason() === 'S9' ? 'regional championships' : curSeason() === 'SX' ? 'regional Majors and Championships' : 'Majors and World Championship') + '. ' : ''}Ratings are estimates from ${curSeason() === '2027' || curSeason() === '2026' ? '2026' : 'that season\'s'} results. Select a team to edit its name, players or ratings.</p></div>
            <div class="toolbar"><div class="search"><input class="input" id="rankQ" placeholder="Search teams or players" value="${esc(state.ui.rankQuery || '')}" aria-label="Search teams or players" /></div></div></div>
          <div class="seg" style="margin-bottom:12px">${[['all', 'All'], ...Object.keys(REGIONS).map((k) => [k, k])].map(([k, v]) => `<button class="${k === reg ? 'active' : ''}" data-action="rank-region" data-v="${k}" title="${esc(REGIONS[k] || 'All regions')}">${v}</button>`).join('')}</div>
          <div class="table-wrap"><table class="st rank-table"><thead><tr><th>#</th><th class="l">Team</th><th class="l">Region</th><th class="l hide-sm">Roster</th>${curSeason() === '2026' ? '<th class="l hide-sm">Worlds 2026</th>' : ''}<th>OVR</th></tr></thead><tbody>
          ${list.slice(0, 300).map((t) => `<tr data-action="edit-team" data-id="${esc(t.id)}" role="button" tabindex="0" style="cursor:pointer"><td class="pos">${t.rank}</td><td class="l"><div class="tcell"><button class="team-link" data-action="team-page" data-id="${esc(t.id)}" title="Open the ${esc(t.name)} team page" aria-label="Open the ${esc(t.name)} team page">${badge(t, 'sm')}</button><span>${esc(t.name)}</span></div></td><td class="l"><span class="region-tag">${t.region}</span></td><td class="l hide-sm muted">${esc(t.players.slice(0, 3).map((p) => (p.flag || '') + ' ' + p.name).join('  '))}</td>${curSeason() === '2026' ? `<td class="l hide-sm">${t.worlds ? `<span class="pill ${t.worlds === '1st' ? 'gold' : ''}">${esc(t.worlds)}</span>` : '<span class="muted">—</span>'}</td>` : ''}<td><b>${t.ovr}</b></td></tr>`).join('') || '<tr><td colspan="6" class="l muted">No teams match.</td></tr>'}
          </tbody></table></div>
        </section>
      </div>`;
    const rq = $('#rankQ');
    if (rq) rq.addEventListener('input', () => { state.ui.rankQuery = rq.value; const pos = rq.selectionStart; renderTeamsPage(); const n = $('#rankQ'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  /* ---------------- Render root ---------------- */
  let lastPageKey = null;
  function render() {
    if (state.view === 'tournament' && !state.T) state.view = 'home';
    const th = state.view === 'tournament' && state.T ? themeOf(state.T.theme) : null;
    // whole-screen event palette: tournament theme, or the career hub's upcoming event
    const pth = th || (state.view === 'career' && window.RLCareer && window.RLCareer.theme ? window.RLCareer.theme() : null);
    const root = document.documentElement;
    root.classList.toggle('ev', !!pth);
    root.classList.toggle('ev-art', !!(pth && pth.art));
    ['--e1', '--e2', '--e3', '--e-on'].forEach((k, i) => (pth ? root.style.setProperty(k, [pth.a, pth.b, pth.c, pth.on || '#fff'][i]) : root.style.removeProperty(k)));
    if (pth && pth.art) root.style.setProperty('--ev-art', `url(${pth.art})`); else root.style.removeProperty('--ev-art');
    app.classList.toggle('event-theme', !!th);
    app.classList.toggle('has-art', !!(th && th.art));
    if (th && th.art) { app.style.setProperty('--e-art', `url(${th.art})`); app.style.setProperty('--e-pos', th.pos || 'center'); } else { app.style.removeProperty('--e-art'); app.style.removeProperty('--e-pos'); }
    ['--e1', '--e2', '--e3', '--e-on'].forEach((k, i) => (th ? app.style.setProperty(k, [th.a, th.b, th.c, th.on || '#fff'][i]) : app.style.removeProperty(k)));
    document.querySelectorAll('.topnav [data-v]').forEach((b) => b.classList.toggle('active', b.dataset.v === (state.view === 'teams' || state.view === 'team' ? 'teams' : state.view === 'career' ? 'career' : 'home')));
    if (state.view === 'tournament') renderTournament();
    else if (state.view === 'setup') renderSetup();
    else if (state.view === 'teams') renderTeamsPage();
    else if (state.view === 'team') renderTeamPage();
    else if (state.view === 'career') window.RLCareer.render(app);
    else { state.view = 'home'; renderHome(); }
    // page entrance animation: only when the page (or tournament / stage tab / archive season) changes.
    // Worked out after rendering (views pick defaults such as the stage tab while they render); the class is
    // applied before the browser paints, so the new content still animates in.
    const pageKey = [state.view, state.view === 'team' ? state.ui.teamId : '', state.view === 'tournament' && state.T ? (state.T.title || '') + (state.T.teams || []).length : '', state.ui.stageTab || '', state.ui.archive || '', state.ui.browseSeason || ''].join('|');
    app.classList.toggle('pg-enter', pageKey !== lastPageKey);
    lastPageKey = pageKey;
  }
  function persistRender() { save(); render(); }

  function startTournament() {
    const s = state.setup;
    if (s.teams.length !== s.size) return;
    launch(s, s.title || null, s.theme ? { theme: s.theme } : null);
  }

  /* ---------------- Events ---------------- */
  document.addEventListener('click', (ev) => {
    if (ev.target.matches('[data-backdrop]')) { closeModal(); return; }
    const el = ev.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const a = el.dataset.action, v = el.dataset.v, id = el.dataset.id;
    const s = state.setup;
    if ((a.startsWith('career-') || a.startsWith('mk-') || a.startsWith('th-')) && a !== 'career-out-sim' && window.RLCareer.onAction(a, el)) return;
    switch (a) {
      case 'career-out-sim': { closeModal(); const T = state.T; T.managedOutShown = true; T.championShown = true; window.RLCareer.simRest(T); save(); go('career'); break; }
      case 'close-modal': closeModal(); break;
      case 'go-setup': ev.preventDefault(); go(state.T && state.T.cfg && state.T.cfg.custom ? 'home' : 'setup'); break;
      case 'go-home': ev.preventDefault(); go('home'); break;
      case 'nav': ev.preventDefault(); closeModal(); go(v); break;
      case 'resume': go('tournament'); break;
      case 'comp': openComp(v); break;
      case 'comp-customise': { const c = competitions().find((x) => x.id === v); presetSetup(c); closeModal(); go('setup'); break; }
      case 'comp-start': { const c = competitions().find((x) => x.id === v); presetSetup(c); launch(state.setup, c.name, c.theme ? { theme: c.theme } : null); break; }
      case 'region-league': {
        const ids = rankedTeams().filter((t) => t.region === v).slice(0, 10).map((t) => t.id);
        state.setup = Object.assign(defaultSetup(), { format: 'leaguePlayoffs', size: 10, quickFill: v, teams: ids, title: REGIONS[v] + ' League', theme: 'region-' + v.toLowerCase() });
        go('setup'); toast(REGIONS[v] + ' League loaded — adjust anything, then start.'); break;
      }
      case 'mega': state.setup = Object.assign(defaultSetup(), { format: 'knockout', size: 128, quickFill: 'top', title: '128-team knockout' }); state.setup.teams = rankedTeams().slice(0, 128).map((t) => t.id); go('setup'); break;
      case 'build-league': state.setup = Object.assign(defaultSetup(), { format: 'league', size: 10, legs: 2, quickFill: 'top', title: null }); go('setup'); toast('Pick a field with Add teams or Auto-fill, then start the season.'); break;
      case 'custom-match': openCustomMatch(); break;
      case 'custom-match-start': {
        const A = $('#cmA').value, B = $('#cmB').value;
        if (A === B) { toast('Pick two different teams.'); break; }
        const bo = +$('#cmBo').value;
        launch(Object.assign(defaultSetup(), { format: 'knockout', size: 2, teams: [A, B], seriesBo: bo, finalBo: bo, simStyle: $('#cmSim').value, custom: true }), 'Custom match');
        break;
      }
      case 'rank-region': state.ui.rankRegion = v; render(); break;
      case 'set-season': state.settings.season = v; save(); render(); break;
      case 'archive': state.ui.archive = v; render(); break;
      case 'browse-season': state.settings.season = v; save(); openBrowse(); break;
      case 'discard-t': stopLive(); state.T = null; persistRender(); toast('Saved tournament deleted.'); break;
      case 'format': s.title = null; s.format = v; if (v === 'major') s.size = 16; snapSize(); s.overrides = {}; if (s.teams.length) s.teams = s.quickFill === 'random' ? s.teams : arrangeForFormat(s.teams); persistRender(); break;
      case 'format-info': { const f = E.FORMATS[v]; openModal(`${modalHead(f.name, f.short)}<div class="modal-body"><p>${esc(f.desc)}</p><p class="help">Field sizes: ${E.validSizes(v, s).join(', ')} teams.</p></div><div class="modal-foot"><button class="btn primary" data-action="format" data-v="${v}" onclick="">Use this format</button></div>`, { size: 'sm' }); break; }
      case 'browse': openBrowse(); break;
      case 'browse-region': state.ui.browseRegion = v; openBrowse(); break;
      case 'toggle-team': toggleTeam(id); openBrowse(); break;
      case 'remove-team': toggleTeam(id); render(); break;
      case 'autofill': autoFill(s.teams.length === s.size); break;
      case 'randomise': s.teams = E.shuffle(s.teams); s.overrides = {}; persistRender(); break;
      case 'clear-teams': { const prev = { teams: s.teams.slice(), managed: s.managed, overrides: s.overrides }; s.teams = []; s.managed = ''; s.overrides = {}; persistRender(); toast('Teams cleared.', { label: 'Undo', fn: () => { Object.assign(s, prev); persistRender(); } }); break; }
      case 'create-team': openTeamEditor(null); break;
      case 'edit-team': openTeamEditor(id); break;
      case 'team-page': state.ui.teamId = id; go('team'); break;
      case 'save-team': saveTeamForm(id || null); break;
      case 'delete-custom': state.customTeams = state.customTeams.filter((t) => t.id !== id); s.teams = s.teams.filter((x) => x !== id); invalidateTeams(); closeModal(); persistRender(); break;
      case 'reset-team': delete state.teamEdits[id]; invalidateTeams(); closeModal(); persistRender(); break;
      case 'team-ratings': openRatings(); break;
      case 'reset-ratings': { const ids = state.view === 'tournament' && state.T ? state.T.teams : s.teams; ids.forEach((x) => { if (state.teamEdits[x]) delete state.teamEdits[x].players; }); invalidateTeams(); save(); openRatings(); break; }
      case 'edit-players': openPlayers(); break;
      case 'save-players': savePlayers(id); break;
      case 'open-draw': state.ui.swapSel = null; openDraw(); break;
      case 'draw-tab': state.ui.drawTab = v; openDraw(); break;
      case 'draw-shuffle': s.teams = E.shuffle(s.teams); s.overrides = {}; save(); openDraw(); break;
      case 'draw-seed': s.teams = arrangeForFormat(s.teams); s.overrides = {}; save(); openDraw(); break;
      case 'swap': {
        const i = +el.dataset.i;
        if (state.ui.swapSel == null) state.ui.swapSel = i;
        else { const j = state.ui.swapSel; [s.teams[i], s.teams[j]] = [s.teams[j], s.teams[i]]; state.ui.swapSel = null; s.overrides = {}; save(); }
        openDraw(); break;
      }
      case 'edit-match': ev.stopPropagation(); openEditMatch(id, el.dataset.t === '1'); break;
      case 'save-override': saveOverride(id, el.dataset.t === '1'); break;
      case 'clear-override': { const store = el.dataset.t === '1' ? state.T.overrides : s.overrides; delete store[id]; save(); closeModal(); break; }
      case 'save-preset': download('rl-tournament-preset.json', { kind: 'rlsim-preset', v: 1, setup: s, customTeams: state.customTeams.filter((t) => s.teams.includes(t.id)), teamEdits: state.teamEdits }); break;
      case 'import-preset': importPreset(); break;
      case 'start': startTournament(); break;
      // tournament
      case 'feature': if (live) { toast('Finish or reveal the live series first.'); break; } state.T.featured = id; render(); document.getElementById('matchCentre')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); break;
      case 'feature-next': state.T.featured = null; render(); break;
      case 'play-live': startLive(id); break;
      case 'sim-one': { const m = state.T.matches[id]; simMatches([m]); render(); afterResults(); break; }
      case 'sim-day': simDay(); break;
      case 'sim-all': simAll(); break;
      case 'live-pause': if (live) { live.playing = !live.playing; el.textContent = live.playing ? 'Pause' : 'Resume'; } break;
      case 'live-speed': if (live) { live.speed = +v; el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === el)); } break;
      case 'live-skip-game': if (live) { const g = live.res.games[live.gi]; live.t = g.ot ? 300 + g.otTime : 300; live.pauseUntil = 0; live.playing = true; } break;
      case 'live-reveal': if (live) finishLive(); break;
      case 'view-mode': state.settings.mode = v; save(); render(); break;
      case 'playstyle': state.T.playstyle = v; save(); render(); break;
      case 'leader-tab': state.ui.leaderTab = v; render(); break;
      case 'stage-tab': state.ui.stageTab = v; render(); break;
      case 'toggle-groups': state.ui.hideGroups = !state.ui.hideGroups; render(); break;
      case 'show-champion': openChampion(); break;
      case 'replay-team': { const T0 = state.T; const cfg = Object.assign({}, T0.cfg || s, { managed: T0.cfg ? T0.cfg.managed : T0.managed }); closeModal(); state.T = null; launch(cfg, T0.title); break; }
      case 'continue-neutral': state.T.managed = null; closeModal(); save(); render(); afterResults(); break;
      case 'run-it-back': { const T0 = state.T; closeModal(); state.T = null; launch(T0.cfg || s, T0.title); break; }
      case 'champ-fixtures': { closeModal(); state.ui.filter = getTeam(state.T.champion).name; state.ui.stageTab = state.T.stages[0].id; render(); break; }
      case 'export-results': {
        const T = state.T;
        download('rl-tournament-results.json', { champion: teamName(T.champion), runnerUp: T.runnerUp && teamName(T.runnerUp), format: E.FORMATS[T.format].name, series: T.order.map((mid) => T.matches[mid]).filter((m) => m.result && !m.result.bye).map((m) => ({ stage: m.label, a: teamName(m.a), b: teamName(m.b), score: m.result.sa + '-' + m.result.sb, games: m.result.games.map((g) => g.ga + '-' + g.gb + (g.ot ? ' OT' : '')) })), players: Object.values(T.stats).filter((p) => p && p.name).map((p) => Object.assign({}, p, { team: teamName(p.team) })) });
        break;
      }
      case 'open-settings': openSettings(); break;
      case 'save-settings': state.settings.speed = +$('#setSpeed').value; state.settings.mode = $('#setMode').value; closeModal(); persistRender(); break;
      case 'reset-all':
        openModal(`${modalHead('Reset all saved data?', 'This deletes your setup, custom teams, roster edits and saved tournament in this browser.')}<div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn danger" data-action="reset-confirm">Delete everything</button></div>`, { size: 'sm' });
        break;
      case 'reset-confirm': stopLive(); try { localStorage.removeItem(STORE_KEY); } catch (e) { /* storage blocked */ } location.reload(); break;
      case 'copy-json': {
        const ta = $('#jsonOut');
        const done = () => toast('Copied to clipboard.');
        const fallback = () => { ta.focus(); ta.select(); toast('Press Ctrl/Cmd+C to copy.'); };
        try { navigator.clipboard.writeText(ta.value).then(done, fallback); } catch (e) { fallback(); }
        break;
      }
      case 'paste-import': {
        try { applyPreset(JSON.parse($('#jsonIn').value)); closeModal(); } catch (e) { toast('That text is not a valid preset.'); }
        break;
      }
      case 'open-guide': openGuide(); break;
    }
    if (a === 'format' && modalRoot.innerHTML) closeModal();
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset && el.dataset.seasonSelect) {
      state.settings.season = el.value; save();
      if (el.dataset.seasonSelect === 'browse-season') openBrowse(); else render();
      return;
    }
    const k = el.dataset && el.dataset.bind;
    if (!k) return;
    const s = state.setup;
    if (el.type === 'checkbox') s[k] = el.checked;
    else if (['size', 'groupSize', 'advance', 'legs'].includes(k)) s[k] = +el.value;
    else s[k] = el.value;
    if (k === 'groupSize') { snapSize(); s.advance = Math.min(s.advance, s.groupSize - 1); if (s.teams.length) s.teams = arrangeForFormat(s.teams); }
    if (['size', 'format', 'groupSize', 'legs'].includes(k)) s.title = null;
    if (k === 'size') { if (s.teams.length > s.size) toast('Removed ' + (s.teams.length - s.size) + ' team(s) to fit the new field.'); snapSize(); }
    if (['size', 'groupSize', 'advance', 'legs', 'seriesBo', 'finalBo', 'thirdPlace'].includes(k)) s.overrides = {};
    persistRender();
  });

  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'teamFilter') {
      state.ui.filter = ev.target.value;
      const pos = ev.target.selectionStart;
      render();
      const n = $('#teamFilter'); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && modalRoot.innerHTML) { closeModal(); return; }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[role=button][data-action]')) { ev.preventDefault(); ev.target.click(); }
  });

  /* ---------------- Boot ---------------- */
  load();
  { // drop saved team ids that no longer exist (e.g. after a roster data refresh)
    const known = new Set(allTeams().map((t) => t.id));
    state.setup.teams = (state.setup.teams || []).filter((id) => known.has(id));
    if (state.setup.managed && !known.has(state.setup.managed)) state.setup.managed = '';
  }
  window.RLCareer.init({
    E, state, esc, badge, toast, openModal, closeModal, modalHead, launch, go, render: () => render(), getTeam,
    regions: REGIONS, libraryTeams: () => rankedTeams(HAS27 ? '2027' : '2026').filter((t) => !t.custom).map((t) => Object.assign({}, t)),
  });
  if (state.T) { try { E.refresh(state.T); } catch (e) { state.T = null; state.view = 'setup'; } }
  let hadStore = false;
  try { hadStore = !!localStorage.getItem(STORE_KEY); } catch (e) { /* storage blocked */ }
  if (!state.setup.teams.length && !hadStore) {
    // first visit: pre-fill with the Worlds field for a quick start
    state.setup.quickFill = 'top';
    autoFill(false);
  }
  $('#dataStamp').textContent = 'Rosters: ' + (HAS27 ? 'RLCS 2027 (as of ' + window.RL_DATA27.asOf + ') · ' : '') + 'RLCS 2026: ' + DATA.updated + (HIST.length ? ' · archive: RLCS ' + HIST.map((x) => x.key).reverse().join(', ') : '');
  const fromHash = () => { const h = (location.hash || '').replace('#', ''); if (h.startsWith('team/')) { state.ui.teamId = decodeURIComponent(h.slice(5)); return 'team'; } return h === 'custom-tournament' ? 'setup' : h === 'tournament' && state.T ? 'tournament' : h === 'teams' ? 'teams' : h === 'career' ? 'career' : 'home'; };
  state.view = fromHash();
  window.addEventListener('hashchange', () => { const v = fromHash(); if (v !== state.view) { stopLive(); state.view = v; render(); } });
  render();
})();
