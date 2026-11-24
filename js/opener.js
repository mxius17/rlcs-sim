/* RL Esports Simulator — broadcast openers for the Major, EWC and Worlds intros.
 *
 * Before the host city is revealed (js/cutscene.js), every event gets a title sequence in the style of a big
 * tournament broadcast: fast cuts on the beat of the city's anthem (js/music.js), each shot in the event's own
 * colours (--a/--b/--c). Everything that makes one city's opener different from another's comes from the city:
 *   - the pattern: a motif from the host country's visual culture (seigaiha waves for Japan, eight-point stars
 *     for Arabia, Copacabana waves for Brazil, tartan for Scotland, kente for West Africa …), angle and scale
 *     from the city's name;
 *   - the emblem: the event's badge, its shape and its city code;
 *   - the shots: three picked from kinetic type, trophy, kickoff, map, mosaic and arena, in the city's order;
 *   - the transitions between them, the type layout and the words, and the tempo (the anthem's BPM).
 * The opener always starts on the emblem and ends on a rapid montage of the qualified teams.
 */
(function (global) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
  const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
  function shuffle(r, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* host cities: latitude, longitude */
  const GEO = {
    Copenhagen: [55.68, 12.57], Sydney: [-33.87, 151.21], Riyadh: [24.71, 46.68], 'Los Angeles': [34.05, -118.24], London: [51.51, -0.13], 'Rio de Janeiro': [-22.91, -43.17],
    Berlin: [52.52, 13.4], Tokyo: [35.68, 139.69], Dallas: [32.78, -96.8], Madrid: [40.42, -3.7], Toronto: [43.65, -79.38], Stockholm: [59.33, 18.07], Seoul: [37.57, 126.98],
    'Mexico City': [19.43, -99.13], Paris: [48.86, 2.35], 'São Paulo': [-23.55, -46.63], Singapore: [1.35, 103.82], Amsterdam: [52.37, 4.9], Dubai: [25.2, 55.27],
    'New York': [40.71, -74.01], 'Buenos Aires': [-34.6, -58.38], Melbourne: [-37.81, 144.96], Barcelona: [41.39, 2.17], Johannesburg: [-26.2, 28.05], Chicago: [41.88, -87.63],
    Lisbon: [38.72, -9.14], Doha: [25.29, 51.53], Bangkok: [13.76, 100.5], Milan: [45.46, 9.19], 'Montréal': [45.5, -73.57], Istanbul: [41.01, 28.98], Auckland: [-36.85, 174.76],
    Warsaw: [52.23, 21.01], Santiago: [-33.45, -70.67], Atlanta: [33.75, -84.39], Rotterdam: [51.92, 4.48], Cairo: [30.04, 31.24], 'Hong Kong': [22.32, 114.17], Vienna: [48.21, 16.37],
    Seattle: [47.61, -122.33], 'Abu Dhabi': [24.45, 54.38], 'Bogotá': [4.71, -74.07], Birmingham: [52.49, -1.89], Prague: [50.08, 14.44], Manila: [14.6, 120.98], Casablanca: [33.57, -7.59],
    Orlando: [28.54, -81.38], Lima: [-12.05, -77.04], Vancouver: [49.28, -123.12], 'Cape Town': [-33.92, 18.42], Raleigh: [35.78, -78.64], Jakarta: [-6.21, 106.85], Munich: [48.14, 11.58],
    Lyon: [45.76, 4.84], Oslo: [59.91, 10.75], Helsinki: [60.17, 24.94], Dublin: [53.35, -6.26], Edinburgh: [55.95, -3.19], Brussels: [50.85, 4.35], Zurich: [47.38, 8.54],
    Budapest: [47.5, 19.04], Athens: [37.98, 23.73], Rome: [41.9, 12.5], Marseille: [43.3, 5.37], Hamburg: [53.55, 9.99], Cologne: [50.94, 6.96], 'Kraków': [50.06, 19.94],
    Bucharest: [44.43, 26.1], Valencia: [39.47, -0.38], Porto: [41.15, -8.61], Katowice: [50.26, 19.02], Miami: [25.76, -80.19], Austin: [30.27, -97.74], Denver: [39.74, -104.99],
    Phoenix: [33.45, -112.07], 'San Francisco': [37.77, -122.42], Nashville: [36.16, -86.78], Philadelphia: [39.95, -75.17], Houston: [29.76, -95.37], Calgary: [51.05, -114.07],
    Guadalajara: [20.66, -103.35], Monterrey: [25.69, -100.32], 'Medellín': [6.24, -75.58], Montevideo: [-34.9, -56.16], 'Belo Horizonte': [-19.92, -43.94], Quito: [-0.18, -78.47],
    Jeddah: [21.49, 39.19], 'Kuwait City': [29.38, 47.99], Muscat: [23.59, 58.41], Amman: [31.95, 35.93], Marrakech: [31.63, -8.01], Tunis: [36.81, 10.18], Osaka: [34.69, 135.5],
    Busan: [35.18, 129.08], Shanghai: [31.23, 121.47], Taipei: [25.03, 121.57], 'Kuala Lumpur': [3.14, 101.69], 'Ho Chi Minh City': [10.82, 106.63], Mumbai: [19.08, 72.88],
    Brisbane: [-27.47, 153.03], Perth: [-31.95, 115.86], Wellington: [-41.29, 174.78], Lagos: [6.52, 3.38], Nairobi: [-1.29, 36.82], Accra: [5.6, -0.19], Durban: [-29.86, 31.02],
    'Fort Worth': [32.76, -97.33], Boston: [42.36, -71.06], 'Las Vegas': [36.17, -115.14],
  };
  /* the event's city code on the emblem */
  const CODE = { 'Los Angeles': 'LA', 'New York': 'NYC', 'Mexico City': 'CDMX', 'Rio de Janeiro': 'RIO', 'São Paulo': 'SP', 'Buenos Aires': 'BA', 'Hong Kong': 'HK', 'Kuala Lumpur': 'KL', 'Ho Chi Minh City': 'HCMC', 'Abu Dhabi': 'AUH', 'San Francisco': 'SF', 'Las Vegas': 'LV', 'Fort Worth': 'FTW', 'Cape Town': 'CPT', 'Kuwait City': 'KWI', 'Belo Horizonte': 'BH' };
  const codeOf = (city) => CODE[city] || city.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();

  /* ---------- patterns: one motif family per musical flavour (same map as the anthems) ---------- */
  const PAT_OF = {
    japan: ['seigaiha', 'dots'], eastasia: ['hex', 'fret', 'seigaiha'], sea: ['tiles', 'petals', 'dots'], india: ['petals', 'tiles'], arab: ['star8', 'hex'],
    brazil: ['calcadao'], tango: ['checks', 'stripes'], mariachi: ['fret', 'zigzag'], andes: ['fret', 'zigzag', 'triangles'], spain: ['tiles', 'star8'],
    italy: ['tiles', 'stripes'], balkan: ['zigzag', 'tiles'], musette: ['stripes', 'dots'], brass: ['chevron', 'hex', 'checks'], british: ['checks', 'chevron'],
    scottish: ['tartan'], irish: ['petals', 'tartan'], nordic: ['crystal', 'chevron'], usa: ['stars', 'stripes'], canada: ['crystal', 'tartan', 'chevron'],
    oceania: ['dotpaint'], africa: ['kente', 'triangles'], dance: ['dots', 'zigzag'], worlds: ['hex', 'star8'],
  };
  /* tiles: w, h, body. Classes: f0 base (--b), f1 accent (--a), f2 light (--c), s1/s2 strokes in a/c */
  const PAT = {
    seigaiha: () => { const c = [[0, 0], [80, 0], [40, 20], [0, 40], [80, 40]]; return [80, 40, c.map(([x, y]) => [38, 29, 20, 11].map((r, k) => `<circle cx="${x}" cy="${y}" r="${r}" class="f0 ${k % 2 ? 's2' : 's1'}" stroke-width="3"/>`).join('')).join('')]; },
    dots: () => [28, 28, '<circle cx="7" cy="7" r="5" class="f1"/><circle cx="21" cy="21" r="3" class="f2"/>'],
    hex: () => [60, 104, '<path d="M30 0 L60 17 V52 L30 69 L0 52 V17Z M30 69 V104 M0 52 L-30 69 M60 52 L90 69" class="s1" stroke-width="3"/><path d="M30 18 L44 26 V43 L30 51 L16 43 V26Z" class="f2" opacity=".6"/>'],
    fret: () => [60, 60, '<path d="M0 50 H50 V10 H10 V40 H40 V20 H20 V30" class="s1" stroke-width="5" stroke-linecap="square"/>'],
    tiles: () => [60, 60, '<rect width="60" height="60" class="f0"/><circle cx="30" cy="30" r="16" class="s1" stroke-width="3"/><path d="M30 6 L54 30 L30 54 L6 30Z" class="s2" stroke-width="2"/><circle cx="0" cy="0" r="12" class="f1"/><circle cx="60" cy="0" r="12" class="f1"/><circle cx="0" cy="60" r="12" class="f1"/><circle cx="60" cy="60" r="12" class="f1"/><circle cx="30" cy="30" r="5" class="f2"/>'],
    petals: () => { const r = 20, h = 34.64; const c = [[0, 0], [40, 0], [20, h], [0, 2 * h], [40, 2 * h], [-20, h], [60, h]]; return [40, 2 * h, c.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" class="s1" stroke-width="2.5"/>`).join('') + `<circle cx="20" cy="${h}" r="4" class="f2"/>`]; },
    star8: () => [70, 70, '<rect x="17" y="17" width="36" height="36" class="s2" stroke-width="3"/><rect x="17" y="17" width="36" height="36" class="s2" stroke-width="3" transform="rotate(45 35 35)"/><circle cx="35" cy="35" r="7" class="f1"/><path d="M0 0 L8 0 L0 8Z M70 0 L62 0 L70 8Z M0 70 L8 70 L0 62Z M70 70 L62 70 L70 62Z" class="f1"/>'],
    calcadao: () => [120, 60, '<path d="M0 15 Q30 0 60 15 T120 15 V45 Q90 60 60 45 T0 45Z" class="f1"/><path d="M0 30 Q30 15 60 30 T120 30" class="s2" stroke-width="2" opacity=".5"/>'],
    checks: () => [40, 40, '<rect width="20" height="20" class="f1"/><rect x="20" y="20" width="20" height="20" class="f1"/><rect x="20" width="20" height="20" class="f2" opacity=".15"/>'],
    stripes: () => [40, 40, '<rect width="14" height="40" class="f1"/><rect x="20" width="4" height="40" class="f2" opacity=".7"/>'],
    zigzag: () => [40, 24, '<path d="M0 18 L10 6 L20 18 L30 6 L40 18" class="s1" stroke-width="4" stroke-linejoin="miter"/><path d="M0 24 L10 12 L20 24 L30 12 L40 24" class="s2" stroke-width="1.5" opacity=".6"/>'],
    triangles: () => [40, 36, '<path d="M0 36 L20 0 L40 36Z" class="f1"/><path d="M10 36 L20 18 L30 36Z" class="f2" opacity=".8"/>'],
    chevron: () => [40, 24, '<path d="M0 4 L20 18 L40 4" class="s1" stroke-width="6"/><path d="M0 14 L20 28 L40 14" class="s2" stroke-width="2" opacity=".5"/>'],
    tartan: () => [64, 64, '<rect width="64" height="64" class="f0"/><rect y="8" width="64" height="18" class="f1" opacity=".55"/><rect x="8" width="18" height="64" class="f1" opacity=".55"/><rect y="40" width="64" height="4" class="f2" opacity=".5"/><rect x="40" width="4" height="64" class="f2" opacity=".5"/><rect y="50" width="64" height="8" class="f1" opacity=".3"/><rect x="50" width="8" height="64" class="f1" opacity=".3"/>'],
    crystal: () => [70, 70, `<g transform="translate(35 35)" class="s2" stroke-width="2.5">${[0, 60, 120].map((a) => `<path d="M0 -24 V24 M-6 -18 L0 -12 L6 -18 M-6 18 L0 12 L6 18" transform="rotate(${a})"/>`).join('')}</g><circle cx="0" cy="0" r="3" class="f1"/><circle cx="70" cy="70" r="3" class="f1"/>`],
    stars: () => [60, 60, '<path d="M30 12 L34.7 25.5 L49 25.8 L37.6 34.5 L41.8 48.2 L30 40 L18.2 48.2 L22.4 34.5 L11 25.8 L25.3 25.5Z" class="f2"/><rect y="56" width="60" height="4" class="f1"/>'],
    dotpaint: () => { let s = ''; [[8, 6], [16, 12], [24, 18]].forEach(([r, n], k) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; s += `<circle cx="${(40 + r * Math.cos(a)).toFixed(1)}" cy="${(40 + r * Math.sin(a)).toFixed(1)}" r="2.6" class="${k % 2 ? 'f2' : 'f1'}"/>`; } }); return [80, 80, s + '<circle cx="40" cy="40" r="4" class="f2"/><circle cx="0" cy="0" r="6" class="f1"/><circle cx="80" cy="80" r="6" class="f1"/><circle cx="80" cy="0" r="6" class="f1"/><circle cx="0" cy="80" r="6" class="f1"/>']; },
    kente: () => [60, 60, '<rect width="30" height="30" class="f1"/><rect x="30" y="30" width="30" height="30" class="f1"/><rect x="30" width="30" height="30" class="f2" opacity=".85"/><path d="M0 34 H30 M0 42 H30 M0 50 H30 M34 0 V30 M42 0 V30 M50 0 V30" class="s2" stroke-width="2" opacity=".9"/><path d="M34 34 H56 V56 H34Z" class="s2" stroke-width="2"/>'],
  };

  /* ---------- the event emblem ---------- */
  const SHAPES = {
    shield: 'M0 -92 L78 -62 L70 30 Q58 72 0 96 Q-58 72 -70 30 L-78 -62Z',
    hex: 'M0 -94 L82 -47 V47 L0 94 L-82 47 V-47Z',
    circle: 'M0 -92 A92 92 0 1 1 -0.1 -92Z',
    diamond: 'M0 -98 L98 0 L0 98 L-98 0Z',
    star: (() => { let d = ''; for (let i = 0; i < 16; i++) { const r = i % 2 ? 76 : 96, a = (i / 16) * Math.PI * 2 - Math.PI / 2; d += (i ? 'L' : 'M') + (r * Math.cos(a)).toFixed(1) + ' ' + (r * Math.sin(a)).toFixed(1); } return d + 'Z'; })(),
  };
  function emblem(shape, code, sub) {
    const d = SHAPES[shape] || SHAPES.shield;
    const fs = code.length > 3 ? 40 : code.length === 3 ? 52 : 62;
    return `<svg class="op-emblem" viewBox="-110 -110 220 220" aria-hidden="true">
      <path d="${d}" class="em-fill"/><path d="${d}" class="em-line" pathLength="100"/><path d="${d}" class="em-in" transform="scale(.84)" pathLength="100"/>
      <path d="M-58 -44 L-30 -56 L-4 -46 L22 -58 L58 -44" class="em-crown"/>
      <text y="${fs * 0.36 + 4}" class="em-code" font-size="${fs}">${esc(code)}</text>
      <text y="46" class="em-sub">${esc(sub)}</text></svg>`;
  }
  const CUP = `<svg class="op-cup" viewBox="0 0 200 260" aria-hidden="true">
    <defs><linearGradient id="opCupG" x1="0" x2="1"><stop offset="0" class="cg0"/><stop offset=".45" class="cg1"/><stop offset=".55" class="cg2"/><stop offset="1" class="cg0"/></linearGradient>
    <clipPath id="opCupC"><path d="M40 20 H160 Q160 110 112 140 V182 Q140 190 146 214 H54 Q60 190 88 182 V140 Q40 110 40 20Z M44 236 H156 V252 H44Z"/></clipPath></defs>
    <path d="M40 34 Q6 34 8 66 Q12 100 52 108" class="cup-h"/><path d="M160 34 Q194 34 192 66 Q188 100 148 108" class="cup-h"/>
    <path d="M40 20 H160 Q160 110 112 140 V182 Q140 190 146 214 H54 Q60 190 88 182 V140 Q40 110 40 20Z" fill="url(#opCupG)" class="cup-b"/>
    <rect x="40" y="214" width="120" height="22" class="cup-base"/><rect x="44" y="236" width="112" height="16" class="cup-base2"/>
    <g clip-path="url(#opCupC)"><rect class="cup-shine" x="-60" y="0" width="40" height="260"/></g>
    <path d="M100 52 L106 66 L121 66 L109 75 L113 90 L100 81 L87 90 L91 75 L79 66 L94 66Z" class="cup-star"/></svg>`;
  const CAR = `<svg class="op-carsvg" viewBox="0 0 240 100" aria-hidden="true"><path d="M12 50 L4 32 L26 32 L32 46Z" class="car-b"/><path d="M6 64 L10 48 L44 44 L86 40 L120 22 L172 20 L204 40 L232 46 L237 58 L231 67Z" class="car-b"/><path d="M126 27 L168 25 L192 40 L114 41Z" class="car-w"/><path d="M14 56 H232" class="car-l"/><circle cx="58" cy="68" r="17" class="car-t"/><circle cx="190" cy="68" r="17" class="car-t"/><circle cx="58" cy="68" r="7" class="car-r"/><circle cx="190" cy="68" r="7" class="car-r"/></svg>`;

  function lum(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()); if (!m) return 0.2;
    const n = parseInt(m[1], 16), ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  const ink = (hex) => (lum(hex) > 0.4 ? '#07090f' : '#ffffff');

  /** Words for the kinetic-type shot. */
  function words(o, r) {
    const n = (o.field || []).length || 16, city = o.city;
    if (o.week) return ['1v1', '2v2', '3v3', 'Worlds Week'];
    if (o.worlds) return pick(r, [['Seven regions', n + ' teams', 'One world champion'], ['The world', 'comes to', city], ['One season', 'One stage', city]]);
    if (o.ewc) return pick(r, [['The world’s', 'biggest', 'stage'], ['Club', 'champions', city], ['One cup', 'every game', city]]);
    return pick(r, [[n + ' teams', 'One trophy', city], ['The world', 'comes to', city], [o.hello, city], ['Every boost', 'every touch', city], ['One city', 'One stage', 'One champion'], [o.nick, n + ' teams', 'One trophy'], ['Road to', 'the title', city]]);
  }

  /* ---------- the shots ---------- */
  const SH = {};
  SH.pat = (o) => `<div class="op-patl"><svg width="100%" height="100%"><rect width="100%" height="100%" fill="url(#opPat)"/></svg></div><div class="op-ring"><i></i><i></i><i></i></div><div class="op-gl"></div><div class="op-embw">${emblem(o.shape, o.code, o.sub)}</div><span class="op-kick">${esc(o.kicker)}</span>`;
  SH.type = (o, r) => {
    const ws = words(o, r), mode = o.week ? 'panels' : pick(r, ['panels', 'stack', 'panels', 'split']);
    const bgs = shuffle(r, [o.pal.a, o.pal.b, o.pal.c]);
    return { cls: 'm-' + mode, html: ws.map((w, i) => { const bg = mode === 'stack' ? 'transparent' : bgs[i % 3]; return `<div class="op-word" style="--i:${i};--len:${Math.max(4, Math.max(...String(w).split(' ').map((x) => x.length)))};--bg:${bg};--fg:${mode === 'stack' ? '#fff' : ink(bg)}"><b>${esc(w)}</b></div>`; }).join(''), beats: ws.length + 1 };
  };
  SH.trophy = (o) => `<div class="op-rays"></div><div class="op-glow"></div>${CUP}<div class="op-gl"></div><div class="op-sparks">${Array.from({ length: 14 }, (_, k) => `<i style="--k:${k}"></i>`).join('')}</div><div class="op-cap"><small>${o.worlds ? 'The World Championship' : o.ewc ? 'Esports World Cup' : 'One trophy'}</small><b>Who lifts it in ${esc(o.city)}?</b></div>`;
  SH.car = (o, r) => `<div class="op-floor"></div><div class="op-speed">${Array.from({ length: 14 }, () => `<i style="top:${(8 + r() * 84).toFixed(1)}%;--d:${(r() * 0.5).toFixed(2)}s;--w:${Math.round(12 + r() * 26)}vw"></i>`).join('')}</div><div class="op-car"><div class="op-boost"></div>${CAR}</div><div class="op-gl"></div><div class="op-ball"></div><div class="op-hit"></div><div class="op-cap op-cap-l"><small>Kickoff</small><b>${esc(o.city)}</b></div>`;
  SH.map = (o) => {
    const g = GEO[o.city], X = (lo) => lo + 180, Y = (la) => 90 - la;
    let grid = ''; for (let lo = -180; lo <= 180; lo += 30) grid += `M${X(lo)} 0V180`; for (let la = -60; la <= 60; la += 30) grid += `M0 ${Y(la)}H360`;
    const dots = Object.keys(GEO).map((c) => `<circle cx="${X(GEO[c][1]).toFixed(1)}" cy="${Y(GEO[c][0]).toFixed(1)}" r="1.1"/>`).join('');
    const r = seeded(o.city + '|arcs'), others = shuffle(r, Object.keys(GEO).filter((c) => c !== o.city && Math.abs(GEO[c][1] - g[1]) > 25)).slice(0, 7);
    const x0 = X(g[1]), y0 = Y(g[0]);
    const arcs = others.map((c, k) => { const x1 = X(GEO[c][1]), y1 = Y(GEO[c][0]); const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 12 - Math.abs(x1 - x0) * 0.18; return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x0.toFixed(1)} ${y0.toFixed(1)}" pathLength="100" style="--k:${k}"/>`; }).join('');
    const ox = (x0 / 3.6).toFixed(2), oy = (y0 / 3.6).toFixed(2);
    return `<div class="op-mapcam" style="transform-origin:${ox}vw ${oy}vw;--dx:${(50 - x0 / 3.6).toFixed(2)}vw;--dy:calc(${(25 - y0 / 3.6).toFixed(2)}vw)"><svg viewBox="0 0 360 180" preserveAspectRatio="none" aria-hidden="true"><path d="${grid}" class="mp-grid"/><g class="mp-dots">${dots}</g><g class="mp-arcs">${arcs}</g><circle cx="${x0}" cy="${y0}" r="1.4" class="mp-me"/></svg></div><div class="op-gl"></div>
      <div class="op-cross"></div><div class="op-pin"><i></i></div>
      <div class="op-coord" data-lat="${g[0]}" data-lon="${g[1]}"><small>${o.worlds ? 'World Championship host' : 'Host city'}</small><b>${esc(o.city)}</b><span class="op-ll">0.00° N · 0.00° E</span></div>`;
  };
  SH.mosaic = (o) => {
    const tiles = [
      `<div class="mo-flag">${o.flag || ''}</div>`,
      `<svg viewBox="880 0 480 600" preserveAspectRatio="xMidYMax meet" class="mo-lm"><path d="${o.lm}"/></svg><small>${esc(o.lmName)}</small>`,
      `<svg class="mo-pat" width="100%" height="100%"><rect width="100%" height="100%" fill="url(#opPat)"/></svg>`,
      `<b class="mo-big">${esc(o.hello)}</b>`,
      `<b class="mo-nick">${esc(o.nick)}</b>`,
      emblem(o.shape, o.code, o.sub),
    ];
    return `<div class="op-grid">${tiles.map((t, k) => `<div class="mo-t" style="--k:${k}">${t}</div>`).join('')}</div>`;
  };
  SH.arena = (o, r) => {
    let crowd = '', lights = '';
    for (let row = 0; row < 11; row++) {
      const y = 70 + row * 22, n = 46 + row * 5, rad = 3 + row * 0.5;
      for (let i = 0; i < n; i++) { const x = (i + 0.5 + (row % 2) * 0.5) * (1600 / n) + (r() - 0.5) * 8, yy = y + Math.sin((x / 1600) * Math.PI) * -30 + (r() - 0.5) * 4; crowd += `M${(x - rad).toFixed(0)} ${yy.toFixed(0)}a${rad} ${rad} 0 1 0 ${2 * rad} 0a${rad} ${rad} 0 1 0 ${-2 * rad} 0`; if (r() < 0.06) lights += `<circle cx="${x.toFixed(0)}" cy="${(yy - rad - 2).toFixed(0)}" r="2.6" style="--d:${(r() * 1.8).toFixed(2)}s"/>`; }
    }
    return `<div class="op-beams">${[0, 1, 2, 3, 4, 5].map((k) => `<i style="--k:${k}"></i>`).join('')}</div><div class="op-gl"></div>
      <div class="op-screen">${emblem(o.shape, o.code, o.sub)}<span>${esc(o.kicker)}</span></div>
      <div class="op-pyro">${[0, 1, 2, 3].map((k) => `<i style="--k:${k}"></i>`).join('')}</div>
      <svg class="op-crowd" viewBox="0 0 1600 330" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><path d="${crowd}"/><g>${lights}</g></svg>`;
  };
  SH.teams = (o) => {
    let f = (o.field || []).slice();
    if (f.length > 16) { const mine = f.filter((t) => t.mine); f = mine.concat(f.filter((t) => !t.mine)).slice(0, 16); }
    const cols = [o.pal.a, o.pal.b, o.pal.c];
    return { html: f.map((t, i) => { const bg = cols[i % 3]; return `<div class="op-tc${t.mine ? ' mine' : ''}${i === f.length - 1 ? ' last' : ''}" style="--i:${i};--bg:${bg};--fg:${ink(bg)}"><span class="tc-name">${esc(t.short || t.name)}</span><span class="tc-badge">${t.badge}</span><b>${esc(t.name)}</b></div>`; }).join('') + `<span class="op-tcount">${f.length < (o.field || []).length ? (o.field || []).length : f.length} teams · ${o.worlds ? 'one world title' : 'one trophy'}</span>`, n: f.length };
  };

  const TRANS = ['wipe', 'iris', 'blinds', 'glitch', 'zoom', 'flash'];
  const MID = ['type', 'trophy', 'car', 'map', 'mosaic', 'arena'];

  /**
   * Build the opener. o = { city, country, flag, pal:{a,b,c}, kicker, field, worlds, week, ewc, flavour, bpm, lm, lmName, nick, hello }
   * Returns { html, plan:[{k, dur, tr}], total, beat } or null when the opener should not play.
   */
  function build(o) {
    if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    const r = seeded((o.worlds ? 'worlds|' : '') + o.city + '|opener');
    const beat = 60 / Math.max(60, Math.min(160, o.bpm || 100));
    const fl = o.worlds ? 'worlds' : o.flavour || 'usa';
    o = Object.assign({}, o, { code: codeOf(o.city), shape: o.worlds ? 'star' : pick(r, ['shield', 'hex', 'circle', 'diamond', 'shield', 'hex']), sub: (String(o.kicker || '').match(/(RLCS|Esports World Cup) \d+/) || ['RLCS'])[0].replace('Esports World Cup', 'EWC') });
    const patName = pick(r, PAT_OF[fl] || ['stripes']);
    const [pw, ph, body] = PAT[patName]();
    const rot = o.worlds ? 0 : pick(r, [0, 0, 15, -20, 30, 45, -45]), scl = (0.8 + r() * 0.6).toFixed(2);
    let mid;
    if (o.worlds) mid = ['map', 'type', 'trophy'];
    else {
      // two of the 3D set-pieces (trophy, car, globe, arena) and one flat 2D shot (type, mosaic) per city
      const d3 = shuffle(r, ['trophy', 'car', 'map', 'arena'].filter((k) => k !== 'map' || GEO[o.city])).slice(0, 2), d2 = pick(r, ['type', 'mosaic']);
      mid = shuffle(r, d3.concat(d2)); if (o.ewc && !mid.includes('arena')) mid[mid.indexOf(d3[1])] = 'arena';
    }
    const order = ['pat'].concat(mid, ['teams']);
    const tr = shuffle(r, TRANS).slice(0, 2);
    const q = (s) => Math.max(2, Math.round(s / beat)) * beat; // shot lengths land on the beat
    let total = 0;
    const plan = [], parts = [];
    order.forEach((k, i) => {
      const res = SH[k](o, seeded(o.city + '|' + k));
      const obj = typeof res === 'string' ? { html: res } : res;
      let dur;
      if (k === 'type') dur = obj.beats * beat;
      else if (k === 'teams') { const step = beat / 2 * obj.n <= 3.2 ? beat / 2 : beat / 4; dur = obj.n * step + beat; obj.step = step; }
      else if (k === 'pat') dur = 4 * beat; // one bar: the first cut lands on the anthem's drop
      else dur = q({ pat: 2.3, trophy: 2.3, car: 2.2, map: 2.8, mosaic: 2.6, arena: 2.4 }[k]);
      plan.push({ k, dur, tr: i ? tr[i % 2] : null });
      parts.push(`<div class="op-shot s-${k} ${obj.cls || ''}" style="--d:${dur.toFixed(3)}s${obj.step ? `;--step:${obj.step.toFixed(3)}s` : ''}">${obj.html}</div>`);
      total += dur;
    });
    const pal = o.pal;
    const html = `<div class="op" style="--beat:${beat.toFixed(3)}s;--total:${total.toFixed(2)}s" aria-hidden="true">
      <svg class="op-defs" width="0" height="0"><defs><pattern id="opPat" width="${pw}" height="${ph}" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot}) scale(${scl})">${body}</pattern></defs></svg>
      ${parts.join('')}
      <div class="op-pulse"></div><div class="op-tr"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="op-hud"><span class="op-live"><i></i>${o.worlds ? 'Worlds' : 'Live'} · ${esc(o.city)}</span><span class="op-hk">${esc(o.kicker)}</span></div>
      <div class="op-tick"><div>${Array.from({ length: 2 }, () => [o.city, o.country, o.nick, o.hello, o.lmName].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('<i>◆</i>')).join('<i>◆</i>')}</div></div>
      <div class="op-bar"><i></i></div></div>`;
    // the 3D layer (js/opener3d.js): one render look per city, matched to the emblem and the globe arcs
    const g = GEO[o.city], ra = seeded(o.city + '|arcs');
    const others = g ? shuffle(ra, Object.keys(GEO).filter((c) => c !== o.city && Math.abs(GEO[c][1] - g[1]) > 25)).slice(0, 7).map((c) => GEO[c]) : [];
    const look = o.worlds || o.ewc ? 'chrome' : pick(seeded(o.city + '|look'), ['toon', 'toon', 'chrome', 'clay', 'toon', 'chrome', 'clay']);
    const three = { pal, beat, look, city: o.city, code: o.code, sub: o.sub, shape: o.shape, lat: g ? g[0] : null, lon: g ? g[1] : null, others, cities: Object.keys(GEO).map((c) => GEO[c]) };
    return { html, plan, total, beat, pattern: patName, shots: order, transitions: tr, ink: ink(pal.a), three, look };
  }

  /** Count the map's coordinates up to the host city. */
  function countCoords(shot, S) {
    const el = shot.querySelector('.op-coord'); if (!el) return;
    const lat = +el.dataset.lat, lon = +el.dataset.lon, out = el.querySelector('.op-ll'), t0 = performance.now();
    const fmt = (v, p, n) => Math.abs(v).toFixed(2) + '° ' + (v >= 0 ? p : n);
    const step = (now) => { if (S.dead) return; const k = Math.min(1, (now - t0) / 1300), e = 1 - Math.pow(1 - k, 3); out.textContent = fmt(lat * e, 'N', 'S') + ' · ' + fmt(lon * e, 'E', 'W'); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /** Set up the 3D layer (js/opener3d.js) and compile its scenes. Call it before the anthem starts: shader
   *  compiling can take a moment and would otherwise push the cuts off the beat. */
  function prep(root, spec, S) {
    let gl = null;
    try { gl = global.RLOp3D && spec.three ? global.RLOp3D.create(spec.three, S) : null; } catch (e) { gl = null; }
    if (gl) {
      const ready = gl.prepare(spec.plan.map((p) => p.k));
      ready.forEach((k) => root.classList.add('gl-' + k)); // these shots swap their 2D artwork for the 3D model
      root.classList.add('gl', 'look-' + gl.look);
    }
    spec.gl = gl;
    return gl;
  }

  /** Play the opener inside `root` (the .op element); calls done() when the last shot ends. */
  function run(root, spec, S, done) {
    const shots = root.querySelectorAll('.op-shot'), tr = root.querySelector('.op-tr');
    const sfx = (n) => global.RLSfx && global.RLSfx.play(n);
    const hit = (cls) => { tr.className = 'op-tr'; void tr.offsetWidth; tr.className = 'op-tr t-' + cls; };
    const later = (ms, f) => S.timers.push(setTimeout(() => { if (!S.dead) f(); }, Math.max(0, ms)));
    let t = 0.08; // the anthem's first bar starts 80 ms after play (js/music.js)
    const music = () => global.RLMusic && global.RLMusic.playing;
    const gl = spec.gl !== undefined ? spec.gl : prep(root, spec, S);
    root.classList.add('run');
    spec.plan.forEach((p, k) => {
      const at = t * 1000;
      if (p.tr) later(at - 180, () => { hit(p.tr); sfx('whoosh'); });
      later(at, () => {
        shots.forEach((s, i) => s.classList.toggle('on', i === k));
        if (gl) gl.enter(p.k, shots[k], p.dur);
        if (k > 1 && music()) global.RLMusic.hit('cut'); // a boom on every cut (the first cut is the anthem's own drop)
        if (p.k === 'map') countCoords(shots[k], S);
        if (p.k === 'pat' && !music()) later(420, () => sfx('impact'));
        if (p.k === 'car') later(p.dur * 450, () => sfx('impact'));
        if (p.k === 'trophy' && !music()) later(300, () => sfx('impact'));
      });
      t += p.dur;
    });
    later(t * 1000 - 180, () => { hit('out'); sfx('whoosh'); });
    later(t * 1000, () => { if (music()) global.RLMusic.hit('big'); root.classList.add('gone'); done(); });
    later(t * 1000 + 600, () => gl && gl.stop());
    later(t * 1000 + 700, () => { if (root.parentNode) root.parentNode.removeChild(root); });
  }

  global.RLOpener = { build, prep, run, codeOf, GEO, PAT_OF };
})(window);
