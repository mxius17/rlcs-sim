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
  const CITIES = ['Copenhagen', 'Sydney', 'Riyadh', 'Los Angeles', 'London', 'Rio de Janeiro', 'Berlin', 'Tokyo', 'Dallas', 'Madrid', 'Toronto', 'Stockholm', 'Seoul', 'Mexico City',
    'Paris', 'São Paulo', 'Singapore', 'Amsterdam', 'Dubai', 'New York', 'Buenos Aires', 'Melbourne', 'Barcelona', 'Johannesburg', 'Chicago', 'Lisbon', 'Doha', 'Bangkok',
    'Milan', 'Montréal', 'Istanbul', 'Auckland', 'Warsaw', 'Santiago', 'Atlanta', 'Rotterdam', 'Cairo', 'Hong Kong', 'Vienna', 'Seattle', 'Abu Dhabi', 'Bogotá',
    'Birmingham', 'Prague', 'Manila', 'Casablanca', 'Orlando', 'Lima', 'Vancouver', 'Cape Town', 'Raleigh', 'Jakarta', 'Munich', 'Lyon',
    'Oslo', 'Helsinki', 'Dublin', 'Edinburgh', 'Brussels', 'Zurich', 'Budapest', 'Athens', 'Rome', 'Marseille', 'Hamburg', 'Cologne', 'Kraków', 'Bucharest', 'Valencia', 'Porto', 'Katowice', 'Miami', 'Austin', 'Denver', 'Phoenix', 'San Francisco', 'Nashville', 'Philadelphia', 'Houston', 'Calgary', 'Guadalajara', 'Monterrey', 'Medellín', 'Montevideo', 'Belo Horizonte', 'Quito', 'Jeddah', 'Kuwait City', 'Muscat', 'Amman', 'Marrakech', 'Tunis', 'Osaka', 'Busan', 'Shanghai', 'Taipei', 'Kuala Lumpur', 'Ho Chi Minh City', 'Mumbai', 'Brisbane', 'Perth', 'Wellington', 'Lagos', 'Nairobi', 'Accra', 'Durban'];
  const OLD_MAJOR_N = 54, OLD_WORLDS_N = 16; // pool sizes before random hosts (older saves keep their current season)
  const WORLDS_CITIES = ['Fort Worth', 'Paris', 'Lyon', 'Boston', 'Riyadh', 'London', 'Sydney', 'Las Vegas', 'Copenhagen', 'Tokyo', 'São Paulo', 'Dubai', 'New York', 'Berlin', 'Singapore', 'Toronto', 'Rome', 'Shanghai', 'Miami', 'Osaka', 'Jeddah', 'Melbourne'];
  /* Host-city palettes for career Majors and Worlds: flag / city colours of the host.
     a = main colour, b = deep second colour, c = highlight; on = text on a. */
  const HOST_PAL = {
    'Copenhagen': ['Denmark', '#E86A33', '#12355B', '#F4C430'], 'Sydney': ['Australia', '#00B4D8', '#03045E', '#F6A623'],
    'Riyadh': ['Saudi Arabia', '#00703C', '#4A3418', '#C9A227'], 'Los Angeles': ['United States', '#7B2CBF', '#F26B21', '#FDB927'],
    'London': ['United Kingdom', '#DA291C', '#0B1D51', '#FFFFFF'], 'Rio de Janeiro': ['Brazil', '#00C08B', '#0B5394', '#FFDF00'],
    'Berlin': ['Germany', '#4D5359', '#111111', '#FFCE00'], 'Tokyo': ['Japan', '#E6007E', '#1B1F5E', '#FFFFFF'],
    'Dallas': ['United States', '#BF5700', '#002244', '#C0C5CE'], 'Madrid': ['Spain', '#8E1B2E', '#1E5631', '#F1BF00'],
    'Toronto': ['Canada', '#134A8E', '#0B0B0B', '#E8291C'], 'Stockholm': ['Sweden', '#FECC00', '#00395F', '#FFFFFF'],
    'Seoul': ['South Korea', '#00A3A1', '#2B1A4F', '#F25C78'], 'Mexico City': ['Mexico', '#E4007C', '#006847', '#F2D16B'],
    'Fort Worth': ['United States', '#1747A6', '#BF0A30', '#C0C5CE'], 'Paris': ['France', '#2B3A8C', '#6B1E3A', '#E5C07B'],
    'Lyon': ['France', '#1F2A6B', '#D6001C', '#F5F5F5'], 'Boston': ['United States', '#1A4E9C', '#C8102E', '#D4B483'],
    'Las Vegas': ['United States', '#E10098', '#1C0F45', '#FFD100'],
    'Oslo': ['Norway', '#8ECAE6', '#023047', '#FB8500'], // fjord ice, Scream sunset
    'Helsinki': ['Finland', '#2F5D50', '#0B2440', '#9FC9E8'], // Nordic pine, Baltic night, frost
    'Dublin': ['Ireland', '#5BBA6F', '#2B2118', '#E8C547'], // shamrock, stout, harp gold
    'Edinburgh': ['United Kingdom', '#5B4A8B', '#1C1F33', '#B7A4D6'], // heather purple, castle stone night
    'Brussels': ['Belgium', '#FDDA24', '#5C3A21', '#EF3340'], // Belgian yellow, chocolate, red
    'Zurich': ['Switzerland', '#E4E8EE', '#0E3A5B', '#DA291C'], // alpine snow, lake blue, Swiss red
    'Budapest': ['Hungary', '#477050', '#7B1E1E', '#E5C07B'], // Hungarian green, paprika, Danube gold
    'Athens': ['Greece', '#0D5EAF', '#3F4A2F', '#F2F2F2'], // Aegean blue, marble, olive gold
    'Rome': ['Italy', '#8B1E2D', '#C49A2C', '#F4E3C3'], // imperial red, gold, travertine
    'Marseille': ['France', '#2FAEE0', '#0B2A4A', '#FFFFFF'], // Calanques sky blue, deep sea
    'Hamburg': ['Germany', '#3A3F44', '#7A0A0A', '#E30613'], // harbour grey, brick red
    'Cologne': ['Germany', '#B6A68C', '#2B2B2B', '#E30613'], // cathedral sandstone, carnival red
    'Kraków': ['Poland', '#3F7D20', '#4B2E83', '#C9A227'], // Wawel dragon green, royal purple, gold
    'Bucharest': ['Romania', '#002B7F', '#FCD116', '#CE1126'], // Romanian blue, yellow, red
    'Valencia': ['Spain', '#FF7F11', '#0B5563', '#FFE66D'], // orange groves, Mediterranean teal
    'Porto': ['Portugal', '#6D1A36', '#0F4C5C', '#F2C14E'], // port wine, Douro teal
    'Katowice': ['Poland', '#1B1B1B', '#4A4A4A', '#F7B500'], // coal black, esports gold
    'Miami': ['United States', '#FF6EC7', '#00B2CA', '#FDF5BF'], // Art Deco pink, ocean teal
    'Austin': ['United States', '#BF5700', '#4D2600', '#F2E1C1'], // burnt orange, live-music brown
    'Denver': ['United States', '#FB4F14', '#0B3D2E', '#A5ACAF'], // Rocky sunset, pine
    'Phoenix': ['United States', '#8C2D19', '#5F259F', '#F9AD1B'], // red rock, purple dusk
    'San Francisco': ['United States', '#C0362C', '#6C8EAD', '#F2A900'], // Golden Gate red, fog
    'Nashville': ['United States', '#4B92DB', '#C8102E', '#FFB81C'], // guitar blue, red, gold
    'Philadelphia': ['United States', '#004C54', '#A5ACAF', '#FFFFFF'], // midnight green, silver
    'Houston': ['United States', '#03202F', '#A71930', '#B4C2CC'], // space navy, red
    'Calgary': ['Canada', '#C8102E', '#F1BE48', '#111111'], // Stampede red, gold
    'Guadalajara': ['Mexico', '#4A8C7A', '#C8102E', '#FFD100'], // agave, mariachi red
    'Monterrey': ['Mexico', '#5C677D', '#1D2B4F', '#FF6B35'], // steel city, dusk, forge orange
    'Medellín': ['Colombia', '#43B02A', '#00205B', '#FFCD00'], // eternal spring green
    'Montevideo': ['Uruguay', '#74C69D', '#0B1C3D', '#FCD116'], // Rambla green, Río de la Plata night, sun of May
    'Belo Horizonte': ['Brazil', '#7C4DFF', '#1A1A2E', '#FFD54F'], // Pampulha modernist purple
    'Quito': ['Ecuador', '#FFD100', '#034EA2', '#ED1C24'], // Ecuador yellow, Andes blue
    'Jeddah': ['Saudi Arabia', '#0B4F6C', '#C9B37E', '#00C2D1'], // deep Red Sea, coral sand, reef
    'Kuwait City': ['Kuwait', '#2E86AB', '#0B0B0B', '#CE1126'], // Kuwait Towers blue
    'Muscat': ['Oman', '#A51931', '#3B2A1A', '#00843D'], // Omani red, white forts
    'Amman': ['Jordan', '#B5523B', '#3D405B', '#F2CC8F'], // Petra rose-red, dusk
    'Marrakech': ['Morocco', '#C1440E', '#2E5E4E', '#F2C14E'], // red city ochre, garden green
    'Tunis': ['Tunisia', '#0077B6', '#7A1F2B', '#F5F5F5'], // Sidi Bou Said blue and white
    'Osaka': ['Japan', '#F08300', '#3A0CA3', '#FFD60A'], // Dotonbori neon orange and violet
    'Busan': ['South Korea', '#E63946', '#0096C7', '#F1FAEE'], // lantern red, Haeundae sea
    'Shanghai': ['China', '#7209B7', '#F72585', '#4CC9F0'], // Pudong neon purple and pink
    'Taipei': ['Taiwan', '#F25F5C', '#0B1E3F', '#00A6A6'], // night-market coral, jade
    'Kuala Lumpur': ['Malaysia', '#5E60CE', '#0B0B2B', '#C0C0C0'], // Petronas steel, night
    'Ho Chi Minh City': ['Vietnam', '#FFD700', '#DA251D', '#2B2B2B'], // gold star on red
    'Mumbai': ['India', '#FF9933', '#138808', '#000080'], // saffron, green, chakra blue
    'Brisbane': ['Australia', '#8E7CC3', '#3C1642', '#FFC72C'], // jacaranda purple
    'Perth': ['Australia', '#FF9F1C', '#0B3954', '#2EC4B6'], // sunset orange, Indian Ocean
    'Wellington': ['New Zealand', '#2B2B2B', '#00A9CE', '#FFFFFF'], // All Black, harbour blue
    'Lagos': ['Nigeria', '#D81E5B', '#008751', '#FFFFFF'], // Lekki sunset magenta, Naija green
    'Nairobi': ['Kenya', '#BB0000', '#006600', '#000000'], // Kenyan red, green, black
    'Accra': ['Ghana', '#FCD116', '#006B3F', '#CE1126'], // Black Star gold, green, red
    'Durban': ['South Africa', '#00A19A', '#F7B538', '#1A1A1A'], // Indian Ocean teal, sun
    'São Paulo': ['Brazil', '#2D3047', '#9E1B32', '#FFDF00'], 'Singapore': ['Singapore', '#B5179E', '#3A0CA3', '#FFFFFF'],
    'Amsterdam': ['Netherlands', '#FF8200', '#1A1A1A', '#E4002B'], 'Dubai': ['United Arab Emirates', '#D4AF37', '#3A1C5D', '#FFFFFF'],
    'New York': ['United States', '#F7B500', '#1B1B1B', '#E4002B'], 'Buenos Aires': ['Argentina', '#74ACDF', '#5A1A2B', '#F6B40E'],
    'Melbourne': ['Australia', '#1B2A49', '#0B6E6E', '#FFCD00'], 'Barcelona': ['Spain', '#A50044', '#004D98', '#EDBB00'],
    'Johannesburg': ['South Africa', '#E09F1F', '#007749', '#FFFFFF'], 'Chicago': ['United States', '#41B6E6', '#8B0A1A', '#FFFFFF'],
    'Lisbon': ['Portugal', '#1F5AA6', '#0E2A47', '#F4B400'], 'Doha': ['Qatar', '#8A1538', '#6B5B3E', '#E6D3A3'],
    'Bangkok': ['Thailand', '#F28C28', '#0B5D3B', '#F4C430'], 'Milan': ['Italy', '#00876C', '#111111', '#E3C16F'],
    'Montréal': ['Canada', '#003DA5', '#8B0000', '#FFFFFF'], 'Istanbul': ['Türkiye', '#30D5C8', '#8B0A1A', '#FFFFFF'],
    'Auckland': ['New Zealand', '#2E7D32', '#111111', '#C0C0C0'], 'Warsaw': ['Poland', '#DC143C', '#2B2B2B', '#F2C14E'],
    'Santiago': ['Chile', '#B87333', '#0039A6', '#FFFFFF'], 'Atlanta': ['United States', '#F4A6B7', '#0B1F3A', '#EAAA00'],
    'Rotterdam': ['Netherlands', '#00A651', '#FF6A13', '#FFFFFF'], 'Cairo': ['Egypt', '#C2A060', '#0B3C5D', '#CE1126'],
    'Hong Kong': ['Hong Kong', '#D4145A', '#0B3D3D', '#FFFFFF'], 'Vienna': ['Austria', '#6A4C93', '#9E1B2F', '#E8C547'],
    'Seattle': ['United States', '#69BE28', '#002244', '#A5ACAF'], 'Abu Dhabi': ['United Arab Emirates', '#00838F', '#8C6A3B', '#F5F0E6'],
    'Bogotá': ['Colombia', '#FCD116', '#8B0A1A', '#003893'], 'Birmingham': ['United Kingdom', '#9AA4AE', '#7A1F2B', '#87CEEB'],
    'Prague': ['Czechia', '#8D5B4C', '#11457E', '#F2E8CF'], 'Manila': ['Philippines', '#F15A24', '#0038A8', '#FCD116'],
    'Casablanca': ['Morocco', '#6050DC', '#006233', '#F5F0E6'], 'Orlando': ['United States', '#5B2C83', '#00A3AD', '#FDB927'],
    'Lima': ['Peru', '#4B1D52', '#D91023', '#F2C14E'], 'Vancouver': ['Canada', '#00843D', '#0B2E4F', '#FF0000'],
    'Cape Town': ['South Africa', '#D9488C', '#2F3B2F', '#FFB81C'], 'Raleigh': ['United States', '#CC0000', '#1A1A1A', '#FFFFFF'],
    'Jakarta': ['Indonesia', '#6F4E37', '#CE1126', '#FFD700'], 'Munich': ['Germany', '#0098D4', '#1A1A1A', '#F2B705'],
  };
  /* Region palettes for the regional Opens (career + Simulators page): colours each region is known for. */
  const REGION_PAL = {
    EU: ['Europe', '#2A5BD7', '#0B1F66', '#FFCC00'],          // EU flag blue + gold stars
    NA: ['North America', '#C8102E', '#1C3F94', '#FFFFFF'],   // red, white and blue (US / Canada)
    SAM: ['South America', '#009C3B', '#2E6DB4', '#FFDF00'],  // Brazil green & yellow, Argentine sky blue
    MENA: ['Middle East & North Africa', '#0F8A5F', '#6B4423', '#D4A017'], // green, desert sand, gold
    OCE: ['Oceania', '#0097A7', '#003F5C', '#FFCD00'],        // Pacific teal, deep ocean, Aussie gold
    APAC: ['Asia-Pacific', '#D7263D', '#4A1A6B', '#F5B700'],  // red & gold, lacquer purple
    SSA: ['Sub-Saharan Africa', '#E87722', '#006B3F', '#FCD116'], // sunset orange, green, Pan-African gold
  };
  const regionKey = (r) => 'region-' + r.toLowerCase();
  const CITY_REGION = { 'Copenhagen': 'EU', 'London': 'EU', 'Berlin': 'EU', 'Madrid': 'EU', 'Stockholm': 'EU', 'Paris': 'EU', 'Amsterdam': 'EU', 'Barcelona': 'EU', 'Lisbon': 'EU', 'Milan': 'EU', 'Istanbul': 'EU', 'Warsaw': 'EU', 'Rotterdam': 'EU', 'Vienna': 'EU', 'Birmingham': 'EU', 'Prague': 'EU', 'Munich': 'EU', 'Lyon': 'EU', 'Oslo': 'EU', 'Helsinki': 'EU', 'Dublin': 'EU', 'Edinburgh': 'EU', 'Brussels': 'EU', 'Zurich': 'EU', 'Budapest': 'EU', 'Athens': 'EU', 'Rome': 'EU', 'Marseille': 'EU', 'Hamburg': 'EU', 'Cologne': 'EU', 'Kraków': 'EU', 'Bucharest': 'EU', 'Valencia': 'EU', 'Porto': 'EU', 'Katowice': 'EU', 'Los Angeles': 'NA', 'Dallas': 'NA', 'Toronto': 'NA', 'Mexico City': 'NA', 'New York': 'NA', 'Chicago': 'NA', 'Montréal': 'NA', 'Atlanta': 'NA', 'Seattle': 'NA', 'Orlando': 'NA', 'Vancouver': 'NA', 'Raleigh': 'NA', 'Fort Worth': 'NA', 'Boston': 'NA', 'Las Vegas': 'NA', 'Miami': 'NA', 'Austin': 'NA', 'Denver': 'NA', 'Phoenix': 'NA', 'San Francisco': 'NA', 'Nashville': 'NA', 'Philadelphia': 'NA', 'Houston': 'NA', 'Calgary': 'NA', 'Guadalajara': 'NA', 'Monterrey': 'NA', 'Rio de Janeiro': 'SAM', 'São Paulo': 'SAM', 'Buenos Aires': 'SAM', 'Santiago': 'SAM', 'Bogotá': 'SAM', 'Lima': 'SAM', 'Medellín': 'SAM', 'Montevideo': 'SAM', 'Belo Horizonte': 'SAM', 'Quito': 'SAM', 'Riyadh': 'MENA', 'Dubai': 'MENA', 'Doha': 'MENA', 'Cairo': 'MENA', 'Abu Dhabi': 'MENA', 'Casablanca': 'MENA', 'Jeddah': 'MENA', 'Kuwait City': 'MENA', 'Muscat': 'MENA', 'Amman': 'MENA', 'Marrakech': 'MENA', 'Tunis': 'MENA', 'Tokyo': 'APAC', 'Seoul': 'APAC', 'Singapore': 'APAC', 'Bangkok': 'APAC', 'Hong Kong': 'APAC', 'Manila': 'APAC', 'Jakarta': 'APAC', 'Osaka': 'APAC', 'Busan': 'APAC', 'Shanghai': 'APAC', 'Taipei': 'APAC', 'Kuala Lumpur': 'APAC', 'Ho Chi Minh City': 'APAC', 'Mumbai': 'APAC', 'Sydney': 'OCE', 'Melbourne': 'OCE', 'Auckland': 'OCE', 'Brisbane': 'OCE', 'Perth': 'OCE', 'Wellington': 'OCE', 'Johannesburg': 'SSA', 'Cape Town': 'SSA', 'Lagos': 'SSA', 'Nairobi': 'SSA', 'Accra': 'SSA', 'Durban': 'SSA' };
  /** Text colour for buttons filled with an event colour: dark on light colours (snow, yellows), white otherwise. */
  const onColor = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] > 0.45 ? '#0b1022' : '#fff'; };
  const hostKey = (city) => 'host-' + city.toLowerCase().replace(/[^a-z]+/g, '-');
  (function registerHostThemes() {
    const T = (window.RL_EVENT_THEMES = window.RL_EVENT_THEMES || {});
    Object.keys(HOST_PAL).forEach((city) => { const [country, a, b, c] = HOST_PAL[city]; T[hostKey(city)] = { name: city + ', ' + country, a, b, c, on: onColor(a) }; });
    T['career-worlds'] = { name: 'RLCS World Championship', a: '#1F5BFF', b: '#050505', c: '#D4A017', on: '#fff' }; // Worlds branding: blue, gold, black
    Object.keys(REGION_PAL).forEach((r) => { const [name, a, b, c] = REGION_PAL[r]; T[regionKey(r)] = { name, a, b, c, on: onColor(a) }; });
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
  /* ---------------- club economy ----------------
     Every organisation has a size tier. It sets the starting budget and the sponsorship paid each season,
     so a grassroots team cannot buy the world's best after one good year. Orgs keep only part of the prize
     money (most goes to the players), stars are priced steeply and only want to join bigger organisations.
     A club moves up a tier only after sustained success (and drops after poor seasons). */
  const TIERS = [null,
    { name: 'Grassroots', start: 35000, sponsor: 58000 },
    { name: 'Challenger', start: 90000, sponsor: 105000 },
    { name: 'Established', start: 220000, sponsor: 175000 },
    { name: 'Major', start: 550000, sponsor: 330000 },
    { name: 'Elite', start: 1000000, sponsor: 520000 },
  ];
  const PRIZE_SHARE = 0.2; // the organisation's cut of prize money (Hard)
  /* Difficulty only changes your own club: start budget, sponsorship, prize share, how forgiving the board is,
     how much stars ask from a smaller org, and how quickly the club grows. Hard is the original balance. */
  const DIFF = {
    relaxed: { name: 'Relaxed', blurb: 'More money, a patient board, stars more open to smaller clubs.', start: 1.6, sponsor: 1.5, prize: 0.35, boardBoth: 22, boardOne: 8, boardNone: -10, gap: 0.35, growEasy: true, growNeed: 1 },
    normal: { name: 'Normal', blurb: 'A fair challenge: small clubs build up over a few seasons.', start: 1.25, sponsor: 1.3, prize: 0.3, boardBoth: 20, boardOne: 6, boardNone: -15, gap: 0.6, growEasy: true, growNeed: 2 },
    hard: { name: 'Hard', blurb: 'Tight budgets, a strict board and stars who only want big orgs.', start: 1, sponsor: 1, prize: PRIZE_SHARE, boardBoth: 20, boardOne: 2, boardNone: -25, gap: 0.9, growEasy: false, growNeed: 2 },
  };
  const narrow = () => window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
  const diff = () => DIFF[(C && C.diff) || 'normal'] || DIFF.normal;
  const ELITE_ORGS = ['Team Vitality', 'Team Falcons', 'Karmine Corp', 'NRG', 'FaZe Clan', 'FURIA', 'Gen.G Mobil1 Racing', 'Manchester City Esports', 'Team Heretics', 'Ninjas in Pyjamas', 'MIBR', 'Virtus.pro', 'Twisted Minds', 'Shopify Rebellion', 'Spacestation Gaming', 'Gentle Mates', 'G2 Esports', 'G2 Stride', 'Team BDS', 'Team Liquid', 'OG', 'TSM', 'Complexity Gaming', '100 Thieves', 'Dignitas', 'Moist Esports', 'Guild Esports'];
  const ESTABLISHED_ORGS = ['Geekay Esports', 'Ikkaku', 'BIG', 'Five Fears', 'R8 Esports', 'M80', 'Elevate', 'Kaydop Corp', 'Team Secret', 'Luminosity Gaming', 'Version1', 'Oxygen Esports', 'Rule One', 'Team Singularity', 'Endpoint', 'Sandrock Gaming', 'Team Bliss', 'KRÜ Esports', 'Dplus', 'Detonator', 'PCS Stride', 'NOT', 'DNZ', 'WLT Gaming', 'Ninjas Bros', 'Team Evo'];
  function orgTier(name, partner, strength) {
    if (ELITE_ORGS.includes(name)) return 5;
    if (partner) return 4;
    if (ESTABLISHED_ORGS.includes(name)) return 3;
    return strength >= 83 ? 3 : strength >= 74 ? 2 : 1;
  }
  const tierOf = (cid) => (C.teams[cid] && C.teams[cid].tier) || 2;
  const tierName = (n) => TIERS[n].name;
  const aTier = (n) => (/^[AEIOU]/.test(TIERS[n].name) ? 'an ' : 'a ') + TIERS[n].name; // 'an Elite', 'a Major'
  const startBudget = (tier, strength) => Math.round((TIERS[tier].start * (0.9 + Math.max(0, Math.min(1, (strength - 70) / 25)) * 0.2)) / 1000) * 1000;
  /** Lowest tier a player will join without a big overpay. */
  const minTierFor = (p) => (p.rating >= 92 ? 4 : p.rating >= 88 ? 3 : p.rating >= 82 ? 2 : 1);
  /* Rookie nationalities, weighted roughly like the real scenes (a country listed twice is twice as likely). */
  const ROOKIE_COUNTRIES = {
    EU: ['France', 'France', 'France', 'Spain', 'Spain', 'England', 'England', 'Germany', 'Germany', 'Netherlands', 'Netherlands', 'Belgium', 'Denmark', 'Poland', 'Portugal', 'Italy', 'Sweden', 'Norway', 'Finland', 'Switzerland', 'Austria', 'Czechia', 'Ukraine', 'Turkey', 'Scotland', 'Wales', 'Ireland', 'Greece', 'Romania', 'Croatia', 'Serbia', 'Hungary', 'Lithuania', 'Estonia', 'Slovakia', 'Bulgaria'],
    NA: ['United States', 'United States', 'United States', 'United States', 'Canada', 'Canada', 'Mexico', 'Puerto Rico', 'Costa Rica', 'Guatemala'],
    SAM: ['Brazil', 'Brazil', 'Brazil', 'Brazil', 'Argentina', 'Argentina', 'Chile', 'Chile', 'Uruguay', 'Peru', 'Colombia', 'Paraguay', 'Ecuador', 'Bolivia', 'Venezuela'],
    MENA: ['Saudi Arabia', 'Saudi Arabia', 'Saudi Arabia', 'Morocco', 'Morocco', 'Kuwait', 'Egypt', 'United Arab Emirates', 'Qatar', 'Bahrain', 'Oman', 'Jordan', 'Tunisia', 'Algeria', 'Lebanon', 'Iraq'],
    OCE: ['Australia', 'Australia', 'Australia', 'Australia', 'New Zealand', 'New Zealand', 'Fiji'],
    APAC: ['Japan', 'Japan', 'Japan', 'South Korea', 'South Korea', 'Thailand', 'Singapore', 'Malaysia', 'Philippines', 'Indonesia', 'Vietnam', 'China', 'Taiwan', 'Hong Kong', 'India'],
    SSA: ['South Africa', 'South Africa', 'South Africa', 'Namibia', 'Kenya', 'Nigeria', 'Zimbabwe', 'Botswana', 'Mauritius'],
  };
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
    const ageF = p.age <= 20 ? 1.35 : p.age <= 23 ? 1.15 : p.age <= 26 ? 1 : p.age <= 28 ? 0.8 : 0.55;
    const base = 9000 * Math.exp(0.14 * (p.rating - 60)); // ~$75k at 75, ~$300k at 85, ~$1M+ at 94
    return Math.max(2000, Math.round((base * ageF + Math.max(0, p.pot - p.rating) * 6000) / 1000) * 1000);
  }

  /* ---------------- persistence ---------------- */
  function load() { try { const raw = localStorage.getItem(KEY); C = raw ? JSON.parse(raw) : null; } catch (e) { C = null; } fixAges(); fixEconomy(); fixHosts(); if (C && !C.academyV1) { fixAcademy(); save(); } bump(); }
  function fixHosts() {
    if (!C || C.hostsV2) return;
    C.hosts = C.hosts || {};
    C.hosts[C.season] = { m1: CITIES[(C.season * 2) % OLD_MAJOR_N], m2: CITIES[(C.season * 2 + 1) % OLD_MAJOR_N], w: WORLDS_CITIES[C.season % OLD_WORLDS_N] };
    C.usedHosts = [C.hosts[C.season].m1, C.hosts[C.season].m2];
    C.hostsV2 = true; save();
  }
  /** Saves from before club tiers: give every club its tier and rebalance budgets (the user keeps at most 1.5x their tier's start). */
  function fixEconomy() {
    if (!C || C.econV2) return;
    const lib = {}; (api.libraryTeams() || []).forEach((t) => (lib['c:' + t.id] = t));
    Object.values(C.teams).forEach((t) => {
      const L = lib[t.id]; const str = L ? E.teamStrength(L) : 75;
      t.tier = orgTier(t.name, !!(L && L.partner), str);
      const sb = startBudget(t.tier, str);
      t.budget = t.id === C.user ? Math.min(t.budget, Math.round(sb * 1.5 / 1000) * 1000) : sb;
    });
    C.econV2 = true; C.rep = 0;
    news('career', `Club finances were rebalanced: <b>${esc(userTeam().name)}</b> is ${aTier(tierOf(C.user))} organisation. Sponsorship now depends on club size, and the org keeps ${PRIZE_SHARE * 100}% of prize money.`);
    save();
  }
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
  /** Neutral viewer: a career with no club of your own. You follow one region for the Opens and standings. */
  const V = () => !!(C && C.viewer);
  const homeReg = () => (V() ? C.vreg || 'EU' : userTeam().region);
  const regionTeams = (reg) => Object.keys(C.teams).filter((id) => C.teams[id].region === reg);
  const step = () => SCHEDULE[C.step];
  const isWindow = () => step().type === 'window';

  /* ---------- gamer tags ----------
     Several styles, like real scene names: plain words ("Frost"), compounds ("NightOwl"), words with numbers
     or a trailing dot ("nova7", "kaze."), clipped first names from the player's culture ("Raysn", "Haru"),
     and the old syllable style. Names used in earlier careers on this device are avoided for a while. */
  const TAG_WORDS = ('frost blaze nova comet echo pixel vortex drift zephyr ember onyx rogue viper falcon raven lynx fox wolf otter panda koala mango cobalt neon atlas orbit lunar solar storm thunder rain mist ash cinder spark flare glitch byte cipher vector quantum prism nimbus aero turbo nitro jet rocket boost apex zenith pulse rift shade ghost spectre phantom wraith ronin samurai ninja kaiju titan golem goblin sprite pixie jinx hex rune myth fable saga quest hero vandal bandit outlaw maverick rebel wildcard joker ace king duke baron knight squire rook pawn bishop crown jewel ruby jade amber opal pearl topaz flint granite basalt quartz cactus maple cedar willow aspen birch pine oak ivy fern lotus orchid tulip daisy clover sage basil pepper ginger cocoa mocha latte espresso waffle pancake noodle ramen sushi taco nacho churro biscuit cookie muffin donut pretzel bagel crumb toast jelly honey sugar caramel candy mint lemon lime cherry berry plum peach melon kiwi papaya coconut banana apple acorn pebble boulder canyon summit ridge valley delta tundra savanna dune oasis harbor anchor compass sextant voyager drifter nomad pilgrim ranger scout sniper archer lancer gunner pilot captain major sergeant cadet rookie veteran legend icon idol oracle prophet wizard warlock druid shaman monk sensei master chef baker tailor smith miner digger skater surfer gamer glider rider racer runner sprinter jumper diver swimmer climber hunter keeper striker winger sweeper anchor pivot hook spin twist flip loop dash zoom zap bolt volt watt ohm amp lumen photon proton neutron atom ion mercury venus mars jupiter saturn neptune pluto vega sirius rigel orion draco hydra cetus lyra nyx eos helios kronos ares hermes apollo athena loki odin thor freya fenrir yeti sasquatch kraken siren selkie banshee pixel').split(' ');
  const TAG_PRE = ['x', 'mr', 'lil', 'its', 'not', 'dr', 'sir', 'el', 'le', 'yo', 'just'];
  const TAG_SUF = ['y', 'ie', 'z', 'zz', 'x', 'o', 'io', 'ey', 'ix'];
  const FIRST = {
    fr: 'lucas hugo theo nathan enzo louis jules gabriel arthur leo raphael noah adam maxime antoine baptiste quentin clement mathis romain axel kylian yanis bastien florian'.split(' '),
    es: 'pablo hugo alvaro diego mario javier sergio adrian daniel marcos ivan raul alejandro carlos jorge ruben iker unai pol nil oriol'.split(' '),
    de: 'lukas finn jonas leon felix paul niklas tim jan moritz max tobias lennard malte timo fabian kai nils ole'.split(' '),
    en: 'jack harry oliver charlie george alfie archie freddie jake liam connor callum kieran ryan owen ethan josh ben sam tom alex'.split(' '),
    nl: 'daan sem bram luuk jesse milan thijs ruben stijn niels joep gijs koen wout'.split(' '),
    nordic: 'emil oskar elias william liam axel isak magnus sindre jonas viktor anton rasmus mikkel'.split(' '),
    pl: 'jakub kacper szymon filip mateusz bartek wiktor igor oskar dawid kamil'.split(' '),
    it: 'leonardo francesco lorenzo mattia tommaso riccardo edoardo giulio pietro marco'.split(' '),
    pt: 'joao rodrigo tiago diogo goncalo duarte afonso tomas martim rafael'.split(' '),
    us: 'jayden mason logan ethan aiden caleb hunter tyler austin brandon colton chase blake dylan landon carter bryce gavin trevor'.split(' '),
    mx: 'santiago mateo emiliano diego leonardo sebastian rodrigo alonso emilio angel'.split(' '),
    br: 'gabriel arthur davi bernardo heitor theo miguel enzo pedro joao lucas guilherme rafael vinicius caio thiago felipe matheus kaique'.split(' '),
    ar: 'mateo benjamin bautista thiago santino joaquin lautaro tomas valentin franco agustin nicolas'.split(' '),
    arab: 'faisal rayan abdullah omar khalid saud nawaf turki yazeed fahad hamad salman majed ziad yousef karim anas bader meshal amir'.split(' '),
    maghreb: 'yassine amine mehdi ayoub hamza ilyas anas karim nassim walid sofiane'.split(' '),
    jp: 'haruto sota yuto riku hinata kaito ren minato yuma hayato kenta daiki takumi ryo shun'.split(' '),
    kr: 'minjun seojun doyun jiho junwoo hyunwoo jihun taeyang seungmin dohyun'.split(' '),
    sea: 'arif farhan danish haziq nattapong kittisak somchai minh khoa duc rizky bayu andre paolo marco'.split(' '),
    cn: 'hao yu jun wei ming lei kai chen bo tian'.split(' '),
    oce: 'cooper hudson lachlan jack riley mitchell harrison flynn beau archer tane nikau'.split(' '),
    ssa: 'thabo sipho lwazi kagiso tumelo neo musa jabu kwame tendai chinedu tunde themba'.split(' '),
  };
  const CULTURE = { France: 'fr', Belgium: 'fr', Switzerland: 'fr', Spain: 'es', England: 'en', Scotland: 'en', Wales: 'en', Ireland: 'en', Germany: 'de', Austria: 'de', Netherlands: 'nl', Denmark: 'nordic', Sweden: 'nordic', Norway: 'nordic', Finland: 'nordic', Estonia: 'nordic', Poland: 'pl', Czechia: 'pl', Slovakia: 'pl', Ukraine: 'pl', Lithuania: 'pl', Italy: 'it', Portugal: 'pt', 'United States': 'us', Canada: 'us', 'Puerto Rico': 'mx', Mexico: 'mx', 'Costa Rica': 'mx', Guatemala: 'mx', Brazil: 'br', Argentina: 'ar', Chile: 'ar', Uruguay: 'ar', Peru: 'ar', Colombia: 'ar', Paraguay: 'ar', Ecuador: 'ar', Bolivia: 'ar', Venezuela: 'ar', Morocco: 'maghreb', Algeria: 'maghreb', Tunisia: 'maghreb', Japan: 'jp', 'South Korea': 'kr', China: 'cn', Taiwan: 'cn', 'Hong Kong': 'cn', Australia: 'oce', 'New Zealand': 'oce', Fiji: 'oce' };
  const cultureOf = (country, region) => CULTURE[country] || { MENA: 'arab', APAC: 'sea', SSA: 'ssa', EU: 'en', NA: 'us', SAM: 'br', OCE: 'oce' }[region] || 'en';
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  /** Clip a first name the way players do: "Raphael" → "Raph", "Rayan" → "Raysn"-style twists, doubled letters, "-y" endings. */
  function clipName(n) {
    const r = Math.random();
    if (r < 0.3) return n.slice(0, ri(3, Math.max(3, Math.min(5, n.length))));
    if (r < 0.5) return n.slice(0, ri(3, 4)) + pick(['y', 'z', 'x', 'o', 'ie', 'i']);
    if (r < 0.65) return n.replace(/[aeiou](?=[^aeiou]*$)/, '') || n;
    if (r < 0.8) return n.split('').reverse().join('').slice(0, ri(3, 6));
    return n;
  }
  function styleCase(n) {
    const r = Math.random();
    if (r < 0.45) return n.toLowerCase();
    if (r < 0.95 || n.length > 5) return cap(n.toLowerCase());
    return n.toUpperCase();
  }
  const shortWord = () => { let w; do { w = pick(TAG_WORDS); } while (w.length > 5); return w; };
  function rawTag(country, region) {
    const r = Math.random();
    if (r < 0.3) return cap(pick(TAG_WORDS)); // Frost
    if (r < 0.36) return cap(shortWord()) + cap(shortWord()); // short compounds: IceFox
    if (r < 0.48) return (Math.random() < 0.5 ? shortWord() : pick(TAG_WORDS)) + (Math.random() < 0.55 ? ri(1, 99) : pick(TAG_SUF)); // nova7 / frosty
    if (r < 0.52) return pick(TAG_PRE) + cap(shortWord()); // xFrost, lilNova
    if (r < 0.85) return clipName(pick(FIRST[cultureOf(country, region)])); // clipped first name
    return pick(SYL1) + pick(SYL2) + pick(SYL3); // syllable style
  }
  let usedNames = null;
  const USED_KEY = 'rlsim.usedNames';
  function usedSet() {
    if (usedNames) return usedNames;
    try { usedNames = new Set(JSON.parse(localStorage.getItem(USED_KEY) || '[]')); } catch (e) { usedNames = new Set(); }
    return usedNames;
  }
  function rememberName(n) {
    const u = usedSet(); u.add(n.toLowerCase());
    if (u.size % 25 === 0 || u.size < 25) { try { localStorage.setItem(USED_KEY, JSON.stringify(Array.from(u).slice(-5000))); } catch (e) { /* storage full */ } }
  }
  function newName(country, region) {
    const taken = new Set(Object.values(C.players).map((p) => p.name.toLowerCase()));
    const used = usedSet();
    for (let i = 0; i < 80; i++) {
      let n = styleCase(rawTag(country, region)).replace(/[^A-Za-z0-9.]/g, '');
      if (Math.random() < 0.06) n += '.';
      if (n.length < 3 || n.length > 11) continue;
      const k = n.toLowerCase();
      if (taken.has(k) || (i < 60 && used.has(k))) continue; // a fresh name, also across this device's earlier careers
      rememberName(n);
      return n;
    }
    return 'Rookie' + ri(100, 999);
  }
  /** Development curve: early bloomers peak young and fade sooner, late bloomers keep growing into their mid-20s. */
  const pickCurve = () => { const r = Math.random(); return r < 0.22 ? 'early' : r < 0.78 ? 'normal' : 'late'; };
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
    return addPlayer({ name: newName(country, region), country, flag: global.RL_DATA.flagFor(country), region, age, rating, pot: clamp(rating + ri(6, 22), rating, 97), curve: pickCurve() });
  }

  /* ---------------- youth academies ----------------
     Clubs from Established up run an academy (you always have one). Prospects join at 15–16, develop
     faster than normal players and graduate at 18–19. A talent balance keeps the number of stars steady:
     each season it compares current and upcoming stars with the 2027 level and adds more "wonderkids"
     to the intake when the pipeline runs low, so the top level never thins out over a long career. */
  const AC_COST = [0, 0, 60000, 130000, 240000, 380000]; // cost to reach each level
  const AC_UPKEEP = 6000; // per level, per season
  const acTier = (cid) => (cid === C.user ? C.acLevel || 1 : Math.max(1, tierOf(cid) - 1)); // AI: Established 2, Major 3, Elite 4
  const acCap = (cid) => (cid === C.user ? 2 + Math.floor((C.acLevel || 1) / 2) : tierOf(cid) >= 4 ? 3 : 2);
  /** Each career rolls how good every academy is, so different clubs produce the stars in each save. */
  const acRep = (cid) => { C.acRep = C.acRep || {}; if (C.acRep[cid] == null) C.acRep[cid] = Math.round(rnd(0.45, 1.8) * 100) / 100; return C.acRep[cid]; };
  const hasAcademy = (cid) => cid === C.user || tierOf(cid) >= 3;
  /** The star count of the real 2027 scene, used as the long-run target. */
  function talentBase() {
    const r = []; (api.libraryTeams() || []).forEach((t) => t.players.slice(0, 4).forEach((p) => r.push(p.rating)));
    return { n90: r.filter((x) => x >= 90).length, n88: r.filter((x) => x >= 88).length, n85: r.filter((x) => x >= 85).length };
  }
  function makeProspect(cid, elite) {
    const reg = C.teams[cid] ? C.teams[cid].region : cid;
    const country = pick(ROOKIE_COUNTRIES[reg]);
    const q = C.teams[cid] ? acTier(cid) : 2;
    const pot = elite ? ri(89, 97) : clamp(ri(70, 80 + q * 2) + (Math.random() < 0.05 ? ri(4, 8) : 0), 68, 93); // the odd hidden gem
    const rating = elite ? ri(64, 75) : ri(54, 64 + q);
    const id = addPlayer({ name: newName(country, reg), curve: pickCurve(), country, flag: global.RL_DATA.flagFor(country), region: reg, age: ri(15, 16), rating, pot, contract: 0, salary: 0, academy: C.teams[cid] ? cid : null, wonder: elite || undefined, intake: C.season });
    if (C.teams[cid]) (C.academy[cid] = C.academy[cid] || []).push(id);
    return id;
  }
  function leaveAcademy(pid) {
    const p = C.players[pid]; if (!p || !p.academy) return;
    if (C.academy[p.academy]) C.academy[p.academy] = C.academy[p.academy].filter((x) => x !== pid);
    p.academy = null;
  }
  /** Stars now (older ones count less) and the pipeline of likely future stars aged 21 or under. */
  function talentSupply() {
    let now = 0, pipe = 0;
    Object.values(C.players).forEach((p) => {
      if (!(p.team || p.academy || C.fa.includes(p.id))) return;
      if (p.rating >= 88) now += p.age <= 26 ? 1 : p.age <= 28 ? 0.6 : 0.25;
      else if (p.age <= 21 && (p.wonder || (p.rating >= 80 && p.pot >= 90))) pipe += 1;
    });
    return { now, pipe };
  }
  /** Season end: academy development, graduations, then the new intake. */
  function academySeason(lines) {
    C.academy = C.academy || {};
    // extra development for academy players (on top of the normal growth)
    Object.keys(C.academy).forEach((cid) => (C.academy[cid] || []).forEach((pid) => {
      const p = C.players[pid]; if (!p) return;
      const d = rnd(1.5, 3.5) + (acTier(cid) - 2) * 0.5 + (cid === C.user ? 0 : (acRep(cid) - 1) * 0.8);
      p.rating = clamp(Math.round(Math.min(p.pot, p.rating + d)), 45, 99);
    }));
    // graduations
    Object.keys(C.academy).forEach((cid) => {
      if (!C.teams[cid]) { delete C.academy[cid]; return; }
      (C.academy[cid] || []).slice().forEach((pid) => {
        const p = C.players[pid]; if (!p) { leaveAcademy(pid); return; }
        if (cid === C.user) {
          if (p.age >= 19) { leaveAcademy(pid); C.fa.push(pid); lines.push(`${esc(p.name)} (${p.rating}) left your academy as a free agent.`); news('academy', `<b>${esc(p.name)}</b> (${p.rating}) leaves the ${esc(C.teams[cid].name)} academy without a pro contract.`); }
          return;
        }
        if (p.age < 18 && p.rating < 82) return;
        const tm = C.teams[cid];
        const weakest = tm.roster.map((id) => C.players[id]).sort((a, b) => a.rating - b.rating)[0];
        if (tm.roster.length < 4 && p.rating >= 72 || weakest && p.rating >= weakest.rating + 1) {
          leaveAcademy(pid);
          if (tm.roster.length >= 4 && weakest) { removeFromTeam(weakest.id); C.fa.push(weakest.id); }
          joinTeam(pid, cid, salaryFor(p.rating), ri(2, 3));
          if (p.rating >= 80 || p.wonder) news('academy', `${p.wonder ? '<span class="tag-hot">Wonderkid</span> ' : ''}<b>${esc(p.name)}</b> (${p.rating}, age ${p.age}) graduates from the academy into the <b>${esc(tm.name)}</b> roster.`, { pid, to: cid });
        } else if (p.age >= 19) { leaveAcademy(pid); C.fa.push(pid); }
      });
    });
    // intake: fill every academy, plus extra wonderkids when the star pipeline runs low
    const base = C.base || (C.base = talentBase());
    const sup = talentSupply();
    // a steady flow (stars last about five or six seasons at the top), corrected for the pipeline and today's stars
    const elite = clamp(Math.round(base.n88 / 6 + (base.n88 * 0.8 - sup.pipe) * 0.3 + (base.n88 - sup.now) * 0.25), 2, 14);
    const clubs = Object.keys(C.teams).filter(hasAcademy);
    clubs.forEach((cid) => { while ((C.academy[cid] || []).length < acCap(cid)) makeProspect(cid, false); });
    const wonders = [];
    for (let i = 0; i < elite; i++) {
      // bigger academies find more of them; a quarter come through unattached and can be signed by anyone
      if (Math.random() < 0.25) { const id = makeProspect(pick(REGIONS), true); C.players[id].age = ri(16, 17); C.fa.push(id); wonders.push(C.players[id]); continue; }
      const w = clubs.map((cid) => (cid === C.user ? 1 + (C.acLevel || 1) * 0.8 : [0, 0, 0, 1, 2, 3.2][tierOf(cid)] * acRep(cid) * acRep(cid)));
      let x = Math.random() * w.reduce((a, b) => a + b, 0), k = 0;
      while (k < clubs.length - 1 && x > w[k]) { x -= w[k]; k++; }
      wonders.push(C.players[makeProspect(clubs[k], true)]);
    }
    const mine = wonders.filter((p) => p.academy === C.user);
    mine.forEach((p) => news('academy', `<span class="tag-hot">Wonderkid</span> Your academy signs <b>${esc(p.name)}</b> (${p.age}), scouts see a future star.`, { pid: p.id }));
    const free = wonders.filter((p) => !p.academy);
    if (free.length) news('academy', `${free.length === 1 ? 'An unattached wonderkid is' : free.length + ' unattached wonderkids are'} on the market: ${free.map((p) => `<b>${esc(p.name)}</b> (${p.age}, ${esc(p.region)})`).join(', ')}. Check the free agents.`, { pid: free[0].id });
    if (mine.length) lines.push(`Wonderkid intake: ${mine.map((p) => esc(p.name)).join(', ')}.`);
    C.ys = { elite, now: Math.round(sup.now), pipe: sup.pipe, target: base.n88 };
  }
  function fixAcademy() {
    if (!C || C.academyV1) return;
    C.academy = {}; C.base = talentBase();
    C.acLevel = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 3 }[tierOf(C.user)] || 1;
    Object.keys(C.teams).filter(hasAcademy).forEach((cid) => { for (let i = 0; i < acCap(cid); i++) { const id = makeProspect(cid, false); C.players[id].age = ri(15, 17); } });
    C.academyV1 = true;
  }
  /** Scouted potential: a range that narrows as your academy level rises. */
  function potRange(p) {
    const w = Math.max(0, 6 - (C.acLevel || 1)) * 2, lo = clamp(p.pot - Math.floor(w * hash(p.id + 'pr')), 50, 99);
    return w ? lo + '–' + Math.min(99, lo + w) : String(p.pot);
  }

  /* ---------------- new career ---------------- */
  function newCareer(teamId, level, vreg) {
    const lib = api.libraryTeams();
    C = { v: 1, viewer: !teamId || undefined, vreg: teamId ? undefined : vreg || 'EU', diff: DIFF[level] ? level : 'normal', agesV2: true, econV2: true, hostsV2: true, rep: 0, season: 2027, step: 0, user: teamId ? 'c:' + teamId : null, teams: {}, players: {}, nextPid: 1, points: {}, results: {}, news: [], history: [], trophies: [], fa: [], seasonFin: { prize: 0, sponsor: 0, salaries: 0, transfers: 0 }, objectives: [], board: 60, stepNews: [] };
    lib.forEach((t) => {
      const cid = 'c:' + t.id;
      const roster = t.players.slice(0, 4).map((p, i) => {
        const born = bornOf(p.name, p.country);
        const known = born ? ageFromBorn(born) : null;
        const age = known != null ? known : 17 + Math.floor(hash(t.id + p.name) * 10);
        const pot = clamp(p.rating + Math.max(0, 23 - age) * (1 + hash(p.name) * 1.4), p.rating, 97);
        return addPlayer({ curve: pickCurve(), name: p.name, country: p.country, flag: p.flag, region: t.region, age, born: born || undefined, ageKnown: known != null, rating: p.rating, pot: Math.round(pot), team: cid, contract: 1 + Math.floor(hash(p.name + 'c') * 3), sub: i >= 3 });
      });
      const base = E.teamStrength(t);
      const tier = orgTier(t.name, !!t.partner, base);
      C.teams[cid] = { id: cid, name: t.name, tag: t.tag, region: t.region, color: t.color, roster, tier, budget: startBudget(tier, base) };
      if (teamId && cid === 'c:' + teamId) C.teams[cid].budget = Math.round((C.teams[cid].budget * diff().start) / 1000) * 1000;
    });
    REGIONS.forEach((r) => { for (let i = 0; i < 6; i++) C.fa.push(makeRookie(r)); });
    seasonHosts(C.season);
    fixAcademy();
    resetPoints();
    bump();
    setObjectives();
    news('career', V() ? `You follow the ${C.season} RLCS season as a neutral viewer, with ${esc(api.regions[C.vreg])} as your home region.` : `You take charge of <b>${esc(userTeam().name)}</b> for the ${C.season} RLCS season.`);
    save();
  }
  function resetPoints() { C.points = {}; Object.keys(C.teams).forEach((id) => (C.points[id] = { s1: 0, s2: 0, season: 0 })); C.results = {}; C.seasonFin = { prize: 0, sponsor: 0, salaries: 0, transfers: 0 }; Object.values(C.players).forEach((p) => (p.stats = { gp: 0, g: 0, a: 0, sv: 0, score: 0 })); }
  const esc = (s) => api.esc(s);
  function news(kind, html, meta) {
    if (C.newsN == null) { C.newsN = C.news.length; C.newsRead = C.news.length; }
    C.news.unshift(Object.assign({ kind, html, when: C.season + ' · ' + step().short }, meta ? { meta } : {})); C.news = C.news.slice(0, 80); C.newsN++;
  }
  /** Stories added since the inbox was last opened (older saves start fully read). */
  function unreadCount() {
    if (C.newsN == null) { C.newsN = C.news.length; C.newsRead = C.news.length; }
    return Math.max(0, Math.min(C.news.length, C.newsN - (C.newsRead || 0)));
  }

  /* ---------------- player photos + avatars (photos shared with the team pages) ---------------- */
  let photoReq = false;
  function photoOf(p) {
    const P = global.RL_PHOTOS;
    if (!P) {
      if (!photoReq) { photoReq = true; const sc = document.createElement('script'); sc.src = 'js/photos.js'; sc.async = true; sc.onload = () => { if (api.state.view === 'career' && C) api.render(); }; document.head.appendChild(sc); }
      return null;
    }
    const real = P[p.name + '|' + (p.country || '')];
    if (real) return real;
    // no real photo: a generated portrait (js/faces.js), like FIFA's generated youth players
    if (!global.RLFaces) return null;
    const club = p.team && C.teams[p.team] ? C.teams[p.team] : p.academy && C.teams[p.academy] ? C.teams[p.academy] : null;
    return global.RLFaces.uri({ seed: p.id + '|' + p.name, region: p.region || (club && club.region), country: p.country, age: p.age, color: club ? club.color : '#3a4256' });
  }
  const initialsOf = (n) => (String(n).replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || '?').toUpperCase();
  function avatar(p, cls) { const ph = photoOf(p); return `<span class="pav ${cls || ''}"><span>${esc(initialsOf(p.name))}</span>${ph ? `<img src="${esc(ph)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}</span>`; }

  function regionRankOfUser() {
    if (V()) return 0;
    const reg = userTeam().region;
    return regionTeams(reg).sort((a, b) => ovr(b) - ovr(a)).indexOf(C.user) + 1;
  }
  function setObjectives() {
    if (V()) { C.objectives = []; return; }
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
  /** Hosts are drawn at random for each career and season: the two Majors on different continents, and a city
      only returns once most of the pool has hosted. Saved, so a season's hosts never change once announced. */
  function seasonHosts(season) {
    C.hosts = C.hosts || {};
    if (C.hosts[season]) return C.hosts[season];
    let used = (C.usedHosts || []).filter((c) => CITIES.includes(c));
    if (CITIES.length - used.length < 12) used = [];
    const pool = CITIES.filter((c) => !used.includes(c));
    const m1 = pick(pool);
    const m2 = pick(pool.filter((c) => c !== m1 && CITY_REGION[c] !== CITY_REGION[m1])) || pick(pool.filter((c) => c !== m1));
    const lastW = C.hosts[season - 1] && C.hosts[season - 1].w;
    const w = pick(WORLDS_CITIES.filter((c) => c !== lastW && c !== m1 && c !== m2));
    C.usedHosts = used.concat([m1, m2]);
    C.hosts[season] = { m1, m2, w };
    return C.hosts[season];
  }
  const majorCity = (st) => seasonHosts(C.season)[st.split === 2 ? 'm2' : 'm1'];
  const worldsCity = () => seasonHosts(C.season).w;
  const hostCity = (st) => (st.type === 'major' ? majorCity(st) : st.type === 'worlds' ? worldsCity() : null);
  const themeKeyFor = (st) => { if (st.type === 'open') return C && (V() || userTeam()) ? regionKey(homeReg()) : null; if (st.type === 'worlds') return 'career-worlds'; const c = hostCity(st); return c && HOST_PAL[c] ? hostKey(c) : null; };
  const hostTheme = (st) => { const k = themeKeyFor(st); return k ? window.RL_EVENT_THEMES[k] || null : null; };
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
      const prize = Math.round(((PRIZE[kind] || [])[place - 1] || 0) * (id === C.user ? diff().prize : PRIZE_SHARE));
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
    if (champ === C.user) { C.trophies.push({ season: C.season, title }); news('trophy', `🏆 <b>${esc(userTeam().name)}</b> win the ${esc(title)}!`, { ev: st.key, region, champ, place: 1 }); }
    else if (kind !== 'open' || region === homeReg()) news('result', `<b>${esc(C.teams[champ].name)}</b> win the ${esc(title)}${me ? ` · you finished <b>${placeLabel(me.place, list)}</b>` : ''}.`, { ev: st.key, region, champ, mine: me ? placeLabel(me.place, list) : null });
  }

  function runStep(userT) {
    const st = step();
    const myReg = homeReg();
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
      else { const ev = eventCfg(st); if (!V() && !ev.cfg.teams.includes(C.user)) news('info', `${esc(userTeam().name)} did not qualify for the ${esc(title)}.`); applyEvent(simInstant(ev.cfg), st, null, title); }
    }
    advance();
  }
  function noteQualifier(ev, title) {
    if (V()) return;
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
    p.team = cid; p.salary = salary; p.contract = years; p.joined = C.season;
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
  /** Regions whose stars commonly move to each other (real RLCS migration paths). */
  const MIGRATE = { EU: ['MENA', 'NA'], MENA: ['EU'], NA: ['EU'], SAM: ['NA', 'EU'], OCE: ['NA', 'EU'], APAC: ['OCE', 'MENA'], SSA: ['EU', 'MENA'] };
  /** Small reshuffles (free agents, minor fees): kept out of the inbox, listed under Activity → Other moves. */
  function minorMove(html) { C.minor = C.minor || []; C.minor.unshift({ when: C.season + ' · ' + step().short, html }); C.minor = C.minor.slice(0, 160); }
  function recordDeal(p, from, to, fee) {
    C.deals = C.deals || [];
    C.deals.unshift({ season: C.season, when: C.season + ' · ' + step().short, pid: p.id, name: p.name, flag: p.flag || '', rating: p.rating, from: from ? C.teams[from].name : 'Free agent', fromId: from || null, to: C.teams[to].name, toId: to, fee });
    C.deals = C.deals.slice(0, 120);
  }
  function aiWindow() {
    const pre = C.step === 0;
    const ai = Object.keys(C.teams).filter((id) => id !== C.user);
    const signed = {}, sold = {}, headlines = [];
    let moves = 0;
    // ---- phase A: ambitious clubs chase a marquee upgrade from anywhere in their region (stars also across regions) ----
    const chance = pre ? [0, 0, 0, 0.15, 0.28, 0.4] : [0, 0, 0, 0.03, 0.05, 0.07];
    for (let pass = 0; pass < 2; pass++) {
      const buyers = ai.filter((id) => (C.teams[id].tier || 1) >= 3 && !signed[id]).sort(() => Math.random() - 0.5).sort((a, b) => (C.teams[b].tier || 1) - (C.teams[a].tier || 1));
      for (const buyer of buyers) {
        const bt = C.teams[buyer], tier = bt.tier || 3;
        // second pass: only clubs that just sold someone and have cash to reinvest
        if (pass === 1 ? !sold[buyer] || Math.random() > 0.4 : Math.random() > chance[tier]) continue; // sellers only sometimes reinvest straight away
        const starters = bt.roster.slice(0, 3).map((id) => C.players[id]).filter(Boolean);
        if (starters.length < 3) continue;
        const weakest = starters.slice().sort((a, b) => a.rating - b.rating)[0];
        const abroad = Math.random() < 0.25; // most clubs only shop in their own region
        const regs = [bt.region].concat(abroad ? MIGRATE[bt.region] || [] : []);
        const priced = [];
        Object.values(C.players).forEach((p) => {
          const st = p.team && C.teams[p.team];
          if (!st || p.team === buyer || p.team === C.user || sold[p.team] || !regs.includes(st.region) || p.joined === C.season) return; // new signings stay for the season
          if (st.region !== bt.region && (p.rating < 90 || Math.random() > 0.3)) return; // only top stars, and rarely, move across regions
          if (p.rating < weakest.rating + 3 || minTierFor(p) > tier) return;
          if (p.contract >= 2 && Math.random() > 0.25) return; // players under contract are rarely available
          if (p.rating >= 90 && st.roster.every((x) => !C.players[x] || C.players[x].rating <= p.rating) && Math.random() > 0.35) return; // franchise stars mostly stay
          const stT = st.tier || 1;
          const best = st.roster.every((x) => !C.players[x] || C.players[x].rating <= p.rating);
          let prem = 1;
          if (best) prem *= 1.3;            // their best player
          if (stT > tier) prem *= 1.35;     // prising a player from a bigger org
          if (p.contract <= 1) prem *= 0.8; // final contract year
          const fee = Math.round((valueFor(p) * prem * rnd(0.95, 1.12)) / 1000) * 1000;
          const sal = Math.max(salaryFor(p.rating), askingSalary(p, buyer));
          if (bt.budget < fee + sal) return;
          priced.push({ p, fee, sal, score: (p.rating - weakest.rating) * 3 + Math.max(0, p.pot - p.rating) * 0.6 + (st.region === bt.region ? 2 : 0) + Math.random() * 5 });
        });
        priced.sort((a, b) => b.score - a.score);
        const deal = priced[0];
        if (!deal) continue;
        const { p, fee, sal } = deal, from = p.team, ft = C.teams[from];
        bt.budget -= fee; ft.budget += fee;
        removeFromTeam(weakest.id); C.fa.push(weakest.id);
        joinTeam(p.id, buyer, sal, ri(2, 3));
        aiFill(from);
        signed[buyer] = true; sold[from] = true; moves++;
        recordDeal(p, from, buyer, fee);
        const blockbuster = fee >= 400000 || p.rating >= 90;
        headlines.push([{ pid: p.id, from, to: buyer, fee }, `${blockbuster ? '<span class="tag-hot">Blockbuster</span> ' : ''}<b>${esc(p.name)}</b> (${p.rating}) joins <b>${esc(bt.name)}</b> from ${esc(ft.name)} for ${money(fee)}${ft.region !== bt.region ? ` and moves to ${esc(api.regions[bt.region])}` : ''}; ${esc(weakest.name)} leaves.`]);
      }
    }
    // ---- phase B: smaller clubs upgrade from free agents and weaker teams nearby ----
    const target = pre ? 9 : 4;
    for (let tries = 0; tries < 260 && moves < target + Object.keys(signed).length; tries++) {
      const buyer = pick(ai);
      if (signed[buyer]) continue;
      const bt = C.teams[buyer];
      const starters = bt.roster.slice(0, 3).map((id) => C.players[id]).filter(Boolean);
      const weakest = starters.sort((a, b) => a.rating - b.rating)[0];
      if (!weakest) continue;
      const cands = C.fa.map((id) => C.players[id]).concat(Object.values(C.players).filter((p) => p.team && p.team !== buyer && p.team !== C.user && !sold[p.team] && C.teams[p.team].region === bt.region && ovr(p.team) < ovr(buyer) - 3 && p.joined !== C.season))
        .filter((p) => p.rating >= weakest.rating + 3 && p.rating <= weakest.rating + 12 && minTierFor(p) <= (bt.tier || 1) + 1);
      if (!cands.length) continue;
      const p = pick(cands.sort((a, b) => b.rating - a.rating).slice(0, 5));
      const fee = p.team ? valueFor(p) : 0;
      if (bt.budget < fee + salaryFor(p.rating)) continue;
      const from = p.team;
      bt.budget -= fee;
      if (from) { C.teams[from].budget += fee; sold[from] = true; }
      removeFromTeam(weakest.id); C.fa.push(weakest.id);
      joinTeam(p.id, buyer, salaryFor(p.rating), ri(1, 3));
      if (from) aiFill(from);
      signed[buyer] = true; moves++;
      if (from && fee >= 50000) recordDeal(p, from, buyer, fee);
      const line = `<b>${esc(p.name)}</b> joins ${esc(bt.name)}${from ? ` from ${esc(C.teams[from].name)} (${money(fee)})` : ' as a free agent'}; ${esc(weakest.name)} released.`;
      if (from && fee >= 150000) news('transfer', line, { pid: p.id, from, to: buyer, fee }); else minorMove(line);
    }
    ai.forEach(aiFill);
    headlines.reverse().forEach(([m, h]) => news('transfer', h, m)); // biggest clubs' deals end up on top
    bump();
  }

  /* ---------------- season review ---------------- */
  function seasonReview() {
    const me = userTeam();
    let majors = 0, worlds = null, bestOpen = 99, regRank = 0, objRes = [], salaries = 0, sponsor = 0, upkeep = 0;
    if (!V()) {
    // objectives
    majors = ['m1', 'm2'].filter((k) => C.results[k] && C.results[k].me).length;
    worlds = C.results.w && C.results.w.me;
    bestOpen = Math.min(...['o1', 'o2', 'o3', 'o4', 'o5', 'o6'].map((k) => (C.results[k] && C.results[k][me.region] && C.results[k][me.region].me ? C.results[k][me.region].me.place : 99)));
    const wonEvent = C.trophies.some((t) => t.season === C.season);
    regRank = standings(me.region, 'season').indexOf(C.user) + 1;
    const met = (k) => ({ worlds_top4: worlds && worlds.place <= 4, win_event: wonEvent, worlds: !!worlds, majors2: majors >= 2, major1: majors >= 1, open_top4: bestOpen <= 4, open_top8: bestOpen <= 8, region_top12: regRank <= 12 }[k]);
    objRes = C.objectives.map((o) => ({ t: o.t, ok: !!met(o.k) }));
    const okN = objRes.filter((o) => o.ok).length;
    C.board = clamp(C.board + (okN === 2 ? diff().boardBoth : okN === 1 ? diff().boardOne : diff().boardNone), 0, 100);
    if (C.board <= 0) {
      C.sacked = true;
      const myO = ovr(C.user);
      C.jobs = Object.keys(C.teams).filter((id) => id !== C.user && ovr(id) <= myO + 3 && ovr(id) >= myO - 12).sort(() => Math.random() - 0.5).slice(0, 3);
    }
    // finances: salaries out, sponsorship in
    salaries = me.roster.reduce((s, id) => s + C.players[id].salary, 0);
    const myTier = tierOf(C.user);
    const seasonTrophies = C.trophies.filter((t) => t.season === C.season).length;
    const bonus = Math.min(0.24, seasonTrophies * 0.08) + (worlds ? 0.05 : 0) + (okN === 2 ? 0.03 : 0);
    sponsor = Math.round((TIERS[myTier].sponsor * diff().sponsor * (1 + bonus)) / 1000) * 1000;
    upkeep = (C.acLevel || 1) * AC_UPKEEP;
    me.budget += sponsor - salaries - upkeep;
    C.seasonFin.salaries = salaries; C.seasonFin.sponsor = sponsor; C.seasonFin.academy = upkeep;
    // club growth: two strong seasons in a row move you up a tier, two poor ones down
    const strong = diff().growEasy ? !!worlds || seasonTrophies >= 1 || regRank <= 3 : (worlds && worlds.place <= 8) || seasonTrophies >= 2;
    const poor = !worlds && majors === 0 && regRank > 10;
    C.rep = strong ? Math.max(0, C.rep || 0) + 1 : poor ? Math.min(0, C.rep || 0) - 1 : 0;
    if (C.rep >= diff().growNeed && myTier < 5) { me.tier = myTier + 1; C.rep = 0; news('career', `Sponsors take notice: <b>${esc(me.name)}</b> grows into ${aTier(me.tier).replace(/(\w+)$/, '<b>$1</b>')} organisation. Sponsorship rises from next season.`); }
    else if (C.rep <= -2 && myTier > 1) { me.tier = myTier - 1; C.rep = 0; news('career', `After two poor seasons, sponsors pull back: <b>${esc(me.name)}</b> drops to ${aTier(me.tier).replace(/(\w+)$/, '<b>$1</b>')} organisation.`); }
    C.seasonFin.tierAfter = tierOf(C.user);
    }
    Object.values(C.teams).forEach((t) => { if (t.id !== C.user) { const tr = t.tier || 2; t.budget = Math.max(Math.round(TIERS[tr].start * 0.3), Math.round(t.budget + TIERS[tr].sponsor * 0.95 - t.roster.reduce((s, id) => s + C.players[id].salary, 0))); } });
    // awards
    const all = Object.values(C.players).filter((p) => p.team && p.stats.gp > 20);
    const mvp = all.slice().sort((a, b) => b.stats.score / b.stats.gp - a.stats.score / a.stats.gp)[0];
    const topG = all.slice().sort((a, b) => b.stats.g - a.stats.g)[0];
    // player development, ageing, contracts, retirements
    const devLines = [];
    let breakNews = 0;
    Object.values(C.players).forEach((p) => {
      const old = p.rating;
      if (!p.curve) p.curve = pickCurve();
      // surprises: some youngsters break out (higher ceiling), some stall (lower ceiling)
      if (p.age <= 22 && (p.team || p.academy || C.fa.includes(p.id))) {
        const r = Math.random();
        if (r < 0.09) { const was = p.pot; p.pot = clamp(p.pot + ri(3, 9), p.rating, 97); if (was < 90 && p.pot >= 90 && p.rating >= 74 && breakNews < 3) { breakNews++; news('academy', `<span class="tag-hot">Breakout</span> <b>${esc(p.name)}</b> (${p.age}${p.team && C.teams[p.team] ? ', ' + esc(C.teams[p.team].name) : ''}) is suddenly the talk of the scene: scouts now see a future star.`, { pid: p.id }); } }
        else if (r < 0.17) p.pot = Math.max(p.rating, p.pot - ri(2, 7));
      }
      const ea = p.age + ({ early: 1.5, late: -2 }[p.curve] || 0); // the age the body "feels" on this curve
      let d;
      if (ea <= 20) d = rnd(1, 5); else if (ea <= 23) d = rnd(0, 3); else if (ea <= 26) d = rnd(-1, 1.5); else if (ea <= 28) d = rnd(-3, 0.5); else d = rnd(-5, -1);
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
    const acLines = [];
    academySeason(acLines);
    REGIONS.forEach((r) => { for (let i = 0; i < 5; i++) C.fa.push(makeRookie(r)); });
    C.fa = C.fa.filter((id) => C.players[id]);
    Object.keys(C.teams).forEach((id) => { if (id !== C.user) aiFill(id); });
    const champion = C.results.w && C.results.w.champion;
    const evWin = (k) => (C.results[k] && C.results[k].champion && C.teams[C.results[k].champion] ? C.teams[C.results[k].champion].name : '—');
    if (V()) C.history.unshift({ season: C.season, viewer: true, champion: evWin('w'), runnerUp: C.results.w && C.teams[C.results.w.runnerUp] ? C.teams[C.results.w.runnerUp].name : '—', m1: evWin('m1'), m2: evWin('m2'), m1c: majorCity({ split: 1 }), m2c: majorCity({ split: 2 }), wc: worldsCity(), mvp: mvp ? mvp.name : '—', topG: topG ? topG.name + ' (' + topG.stats.g + ')' : '—', leader: (() => { const id = standings(homeReg(), 'season')[0]; return id ? C.teams[id].name : '—'; })() });
    else C.history.unshift({ season: C.season, worlds: worlds ? worlds.label : 'DNQ', majors, bestOpen: bestOpen < 99 ? E.ordinal(bestOpen) : '—', regRank, objectives: objRes, champion: champion && C.teams[champion] ? C.teams[champion].name : '—', mvp: mvp ? mvp.name : '—', points: C.points[C.user].season, m1: evWin('m1'), m2: evWin('m2') });
    C.review = { acLines, upkeep, objRes, salaries, sponsor, mvp: mvp && { name: mvp.name, team: mvp.team }, topG: topG && { name: topG.name, g: topG.stats.g }, devLines, retired: retired.filter((p) => p.team === C.user || p.rating >= 80).map((p) => p.name), expiring, champion, regRank };
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
    seasonHosts(C.season); // announce the new season's hosts
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
  function viewerCard() {
    const vr = api.state.ui.vreg || 'EU';
    return `<div class="cs-viewer"><span class="vw-eye" aria-hidden="true">◉</span><div class="cs-viewer-t"><b>Just want to watch?</b><small>Follow the whole circuit as a neutral viewer: no club, no board, no budget. Simulate or watch every Open, Major and Worlds while the clubs make their own transfers.</small></div>
      <div class="cs-viewer-r"><div class="seg" aria-label="Home region">${REGIONS.map((k) => `<button class="${k === vr ? 'active' : ''}" data-action="career-vpick" data-v="${k}" title="${esc(api.regions[k])}">${k}</button>`).join('')}</div><button class="btn" data-action="career-viewer" data-v="${vr}">Start as neutral viewer →</button></div></div>`;
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
    const tierN = orgTier(t.name, !!t.partner, E.teamStrength(t));
    const dk = DIFF[ui.cdiff] ? ui.cdiff : 'normal';
    const budget = Math.round((startBudget(tierN, E.teamStrength(t)) * DIFF[dk].start) / 1000) * 1000; // same formula as a new career
    const stars = t.ovr >= 90 ? 5 : t.ovr >= 86 ? 4.5 : t.ovr >= 82 ? 4 : t.ovr >= 78 ? 3.5 : t.ovr >= 74 ? 3 : t.ovr >= 70 ? 2.5 : 2;
    const starHtml = [1, 2, 3, 4, 5].map((n) => `<i class="${stars >= n ? 'f' : stars >= n - 0.5 ? 'h' : ''}">★</i>`).join('');
    const ages = t.players.slice(0, 4).map((p) => { const b = bornOf(p.name, p.country); return b ? ageFromBorn(b) : null; }).filter((a) => a != null);
    const avgAge = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 21;
    const exp = [
      ['Regional success', tier === 1 ? 1 : tier === 2 ? 2 : tier === 3 ? 3 : 4],
      ['International success', tier === 1 ? 1 : tier === 2 ? 2 : tier === 3 ? 4 : 6],
      ['Brand exposure', t.ovr >= 88 ? 2 : t.ovr >= 82 ? 3 : t.ovr >= 76 ? 4 : 5],
      ['Financial', tierN],
      ['Youth development', avgAge < 20 ? 2 : avgAge < 22 ? 4 : 5],
    ];
    const lineup = t.players.slice(0, 4);
    const desc = `${esc(t.name)} ${rank === 1 ? 'are the highest-rated team' : 'are ranked ' + E.ordinal(rank) + ' of ' + regTeams.length} in ${esc(api.regions[t.region])} going into the 2027 RLCS season, with a team rating of ${t.ovr}. The roster is led by ${esc(lineup.slice().sort((a, b) => b.rating - a.rating)[0].name)} (${lineup.slice().sort((a, b) => b.rating - a.rating)[0].rating})${lineup.length > 3 ? `, with ${esc(lineup[3].name)} as the substitute` : ''}.`;
    app.innerHTML = `
      <div class="cs ${motion}">
        <div class="cs-title"><button class="btn sm" data-action="nav" data-v="home">← Back to modes</button><h1>Choose your club</h1><span class="muted">${lib.length} teams · RLCS 2027</span></div>
        ${viewerCard()}
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
            <div class="cs-money"><div><small>Transfer budget</small><span class="cs-tier">${esc(tierName(tierN))} org</span><b data-count="${budget}" data-fmt="money">${money(budget)}</b></div><span class="cs-coin" aria-hidden="true">$</span><div><small>Team rating</small><b data-count="${t.ovr}" data-suf=" OVR">${t.ovr} OVR</b></div></div>
            <div class="cs-bottom">
              <div class="cs-lineup">${lineup.map((p, k) => `<div class="cs-player"><span class="cs-shirt" style="--tc:${t.color || 'var(--azure)'}">${p.rating}</span><b>${p.flag || ''} ${esc(p.name)}</b><small>${k < 3 ? 'Starter' : 'Sub'}</small></div>`).join('')}</div>
              <div class="cs-home"><span class="cs-arena" aria-hidden="true"></span><small>Home region</small><b>${esc(api.regions[t.region])}</b></div>
            </div>
          </div>
        </div>
        <div class="cs-diff"><span class="cs-diff-l">Difficulty</span><div class="seg" role="radiogroup" aria-label="Difficulty">${Object.entries(DIFF).map(([k, d]) => `<button role="radio" aria-checked="${k === dk}" class="${k === dk ? 'active' : ''}" data-action="career-diff" data-v="${k}">${d.name}</button>`).join('')}</div><small>${esc(DIFF[dk].blurb)}</small></div>
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
    if (V()) { const r = st.type === 'open' ? C.results[st.key] && C.results[st.key][homeReg()] : C.results[st.key]; const w = r && C.teams[r.champion]; return w ? '🏆 ' + (w.tag || w.name) : null; }
    const reg = userTeam().region;
    if (st.type === 'open') { const r = C.results[st.key] && C.results[st.key][reg]; return r ? (r.me ? r.me.label : 'DNQ') : null; }
    const r = C.results[st.key];
    return r ? (r.me ? r.me.label : 'DNQ') : null;
  }

  function renderHub(app) {
    const st = step();
    const viewer = V();
    const me = viewer ? { name: 'Neutral viewer', region: homeReg(), roster: [], budget: 0 } : userTeam();
    const t = viewer ? { id: 'viewer', name: 'Neutral viewer', tag: 'RLCS', color: '#1F8BFF', ovr: ovr(standings(homeReg(), 'season')[0]) || 0, players: [], region: homeReg() } : teamObj(C.user);
    const reg = me.region;
    const splitKey = st.split ? 's' + st.split : (C.step <= 5 ? 's1' : 's2');
    const table = standings(reg, st.type === 'worlds' || st.type === 'review' ? 'season' : splitKey);
    const slots = st.type === 'worlds' || st.type === 'review' ? WORLDS_SLOTS[reg] : MAJOR_SLOTS[reg];
    const T = api.state.T;
    const activeEvent = T && T.career && T.career.season === C.season && T.career.step === C.step && !T.career.recorded;
    let next = '';
    const regPick = viewer ? `<div class="vw-reg"><small>Home region</small><div class="seg">${REGIONS.map((k) => `<button class="${k === reg ? 'active' : ''}" data-action="career-vreg" data-v="${k}" title="${esc(api.regions[k])}">${k}</button>`).join('')}</div></div>` : '';
    if (viewer && st.type === 'window') {
      next = `<p>The transfer window is open. Clubs make their moves when you close it: follow the deals in the Transfers tab.</p>
        <div class="action-row"><button class="btn" data-action="career-vmarket">Transfer news</button><button class="btn primary" data-action="career-close-window">Close window →</button></div>${regPick}`;
    } else if (viewer && st.type === 'review') {
      if (!C.review) { seasonReview(); save(); }
      const R = C.review, H = C.history[0] || {};
      next = `<p>Season ${C.season} is over. ${R.champion ? `<b>${esc(C.teams[R.champion].name)}</b> are world champions.` : ''}</p>
        <div class="kv"><span>${esc(H.m1c || 'Major 1')} Major</span><b>${esc(H.m1 || '—')}</b></div><div class="kv"><span>${esc(H.m2c || 'Major 2')} Major</span><b>${esc(H.m2 || '—')}</b></div>
        <div class="kv"><span>Worlds · ${esc(H.wc || '')}</span><b>${esc(H.champion || '—')}</b></div>
        <div class="kv"><span>Season MVP</span><span>${R.mvp ? esc(R.mvp.name) + ' · ' + esc(C.teams[R.mvp.team] ? C.teams[R.mvp.team].name : '') : '—'}</span></div>
        <div class="kv"><span>Top scorer</span><span>${R.topG ? esc(R.topG.name) + ' · ' + R.topG.g + ' goals' : '—'}</span></div>
        ${(R.retired || []).length ? `<div class="tile-kicker" style="margin-top:12px">Retirements</div><p class="help">${R.retired.slice(0, 8).map(esc).join(' · ')}</p>` : ''}
        <div class="action-row"><button class="btn primary" data-action="career-next-season">Start ${C.season + 1} season →</button></div>`;
    } else if (viewer) {
      const title = eventTitle(st, reg);
      next = `<p><b>${esc(title)}</b> · ${st.type === 'open' ? '16 teams · Swiss stage, then an eight-team playoff' : st.type === 'major' ? '16 teams · groups, then the Final Eight' : '20 teams · four groups of five, then an eight-team knockout'}.</p>
        <p class="help">${st.type === 'open' ? 'You watch the Open in your home region; the other six regions play theirs at the same time.' : 'Watch it match by match, or simulate it and read the results.'}</p>
        <div class="action-row">
          ${activeEvent ? `<button class="btn primary" data-action="resume">Resume event →</button><button class="btn" data-action="career-sim-rest">Simulate the rest</button>` : `<button class="btn primary" data-action="career-play">▶ Watch event</button><button class="btn" data-action="career-sim">Simulate event</button>`}
        </div>${st.type === 'open' && !activeEvent ? regPick : ''}`;
    } else if (st.type === 'window') {
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
        <div class="kv"><span>Sponsorship</span><b>+${money(R.sponsor)}</b></div><div class="kv"><span>Salaries paid</span><b>-${money(R.salaries)}</b></div>${R.upkeep ? `<div class="kv"><span>Academy upkeep</span><b>-${money(R.upkeep)}</b></div>` : ''}
        <div class="kv"><span>Season MVP</span><span>${R.mvp ? esc(R.mvp.name) + ' · ' + esc(C.teams[R.mvp.team] ? C.teams[R.mvp.team].name : '') : '—'}</span></div>
        <div class="kv"><span>Top scorer</span><span>${R.topG ? esc(R.topG.name) + ' · ' + R.topG.g + ' goals' : '—'}</span></div>
        ${(R.acLines || []).length ? `<div class="tile-kicker" style="margin-top:12px">Academy</div><p class="help">${R.acLines.join(' · ')}</p>` : ''}
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
    let tab = ui.ctab || 'central'; const view = ui.cview || 'next';
    if (viewer && (tab === 'squad' || tab === 'office')) tab = ui.ctab = 'central';
    const hubKey = [tab, view, C.season, C.step, ui.cnews || 0].join('|'), enter = hubKey !== lastHubKey;
    const tabChanged = !lastHubKey || lastHubKey.split('|')[0] !== tab;
    lastHubKey = hubKey; lastPick = null;
    const newsList = C.news.slice(0, 30);
    // inbox: opening the news view marks everything read; the stories that were new keep a tag while you read
    if (tab === 'central' && view === 'news') { const u = unreadCount(); if (u) { ui.newsFresh = u; C.newsRead = C.newsN; save(); } } else ui.newsFresh = 0;
    const unread = unreadCount();
    const fresh = ui.newsFresh || 0;
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
    const newsHtml = `<div class="pulse">${newsList.map((n, i) => `<div class="story ${n.kind === 'trophy' ? 'win' : n.kind === 'transfer' ? 'upset' : ''}${i < fresh ? ' fresh' : ''}"><small>${i < fresh ? '<span class="new-tag">New</span>' : ''}${esc(n.when)}</small>${n.html}</div>`).join('')}</div>`;
    const historyHtml = viewer ? '' : C.history.length ? `<div class="table-wrap"><table class="st"><thead><tr><th class="l">Season</th><th>Points</th><th>Region</th><th>Best Open</th><th>Majors</th><th>Worlds</th><th class="l">World champion</th><th class="l">Objectives</th></tr></thead><tbody>
      ${C.history.map((h) => `<tr><td class="l">${h.season}</td><td>${h.points}</td><td>${E.ordinal(h.regRank)}</td><td>${h.bestOpen}</td><td>${h.majors}/2</td><td>${esc(h.worlds)}</td><td class="l">${esc(h.champion)}</td><td class="l">${h.objectives.map((o) => (o.ok ? '✓ ' : '✗ ') + esc(o.t)).join(' · ')}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted" style="font-size:13px">Your finished seasons will appear here.</p>';
    // ---- feature panel (news carousel) ----
    const slides = buildSlides(st, me, t, reg, newsList);
    const ni = Math.min(slides.length - 1, Math.max(0, ui.cnews || 0));
    const story = slides[ni];
    const art = story ? slideArt(story, t) : { tc: t.color, cls: '', html: api.badge(t, 'xl') };
    const nS = slides.length;
    const feature = `<div class="fc-feature ${art.cls}" style="--tc:${art.tc || t.color || 'var(--azure)'};${art.vars || ''}">
        <div class="fc-feature-art" ${story ? `key="${ni}"` : ''}>${art.html}<span class="fc-feature-season">RLCS ${C.season}</span></div>
        ${story ? `<div class="fc-headline"><span class="fc-tag">${esc(story.tag)}</span><p>${story.html}</p></div>` : ''}
        <div class="fc-feature-foot"><button class="fc-link" data-action="career-view" data-v="news">Go to News</button>
          <span class="fc-dots">${nS > 1 ? `<button class="fc-arrow" data-action="career-news" data-v="${(ni - 1 + nS) % nS}" aria-label="Previous slide">‹</button>` : ''}${slides.map((_, k) => `<button class="fc-dot ${k === ni ? 'on' : ''}" data-action="career-news" data-v="${k}" aria-label="Slide ${k + 1}"></button>`).join('')}${nS > 1 ? `<button class="fc-arrow" data-action="career-news" data-v="${(ni + 1) % nS}" aria-label="Next slide">›</button>` : ''}</span></div>
      </div>`;
    const VIEWS = [['next', 'Next up', st.name], ['standings', 'Standings', api.regions[reg]], ['schedule', 'Season schedule', 'RLCS ' + C.season], viewer ? ['objectives', 'Power rankings', 'Top 16 worldwide'] : ['objectives', 'Objectives', C.objectives.length + (C.objectives.length === 1 ? ' goal' : ' goals')], ['news', 'News', newsList.length + (newsList.length === 1 ? ' story' : ' stories')]];
    const mainView = view === 'standings' ? `<div class="fc-panel-body"><h3 class="fc-h">${esc(api.regions[reg])} standings</h3><p class="help">${st.type === 'worlds' || st.type === 'review' ? 'Season points · top ' + slots + ' reach Worlds' : 'Split ' + (splitKey === 's1' ? 1 : 2) + ' points · top ' + slots + ' reach the Major'}</p>${tableHtml}</div>`
      : view === 'schedule' ? `<div class="fc-panel-body"><h3 class="fc-h">Season ${C.season}</h3>${timelineHtml}</div>`
      : view === 'objectives' && viewer ? `<div class="fc-panel-body"><h3 class="fc-h">Power rankings</h3><p class="help">The 16 strongest teams in the world by team rating, with this season's circuit points.</p>${powerHtml()}</div>`
      : view === 'objectives' ? `<div class="fc-panel-body"><h3 class="fc-h">Board objectives</h3>${objHtml}<h3 class="fc-h" style="margin-top:18px">Trophy cabinet <span class="pill gold">${C.trophies.length}</span></h3>${trophyHtml}</div>`
      : view === 'news' ? `<div class="fc-panel-body"><h3 class="fc-h">News</h3>${newsHtml}</div>`
      : feature;
    // ---- next-up side card (all the season actions live here) ----
    const sideCard = `<aside class="fc-side">
        <div class="fc-side-head"><h2>${esc(st.name)}</h2><small>RLCS ${C.season}${hostCity(st) ? ' · ' + esc(hostCity(st)) + (HOST_PAL[hostCity(st)] ? ', ' + esc(HOST_PAL[hostCity(st)][0]) : '') : ''} · step ${C.step + 1} of ${SCHEDULE.length}</small></div>
        <div class="fc-side-row"><span class="fc-day">${C.step + 1}</span><span><small>${esc(st.type === 'window' ? 'Transfer window' : st.type === 'review' ? 'Season review' : st.type === 'open' ? 'Regional Open' : st.type === 'major' ? 'Major' : 'World Championship')}</small><b>${esc(st.short || st.name)}</b></span><span class="fc-ico" aria-hidden="true">${st.type === 'window' ? '⇄' : st.type === 'review' ? '★' : '🏆'}</span></div>
        <div class="fc-side-mid"><small>${viewer ? 'Neutral viewer · home region ' + esc(api.regions[reg]) : esc(t.name) + ' · ' + regionRankLabel() + ' in ' + esc(api.regions[reg])}</small>
          <div class="fc-rings">${viewer ? (() => { const n88 = Object.values(C.players).filter((p) => p.team && p.rating >= 88).length, base = (C.base || talentBase()).n88; return ring(t.ovr - 60, 40, 'Region leader', `<span data-count="${t.ovr}">${t.ovr}</span>`, '◆') + ring(n88, Math.round(base * 1.5), 'Stars 88+', `<span data-count="${n88}">${n88}</span>`, '★'); })() : ring(t.ovr - 60, 40, 'Team rating', `<span data-count="${t.ovr}">${t.ovr}</span>`, '◆')}${viewer ? '' : ring(C.board, 100, 'Board', `<span data-count="${C.board}" data-suf="%">${C.board}%</span>`, '☺')}${ring(C.step + 1, SCHEDULE.length, 'Season', (C.step + 1) + '/' + SCHEDULE.length, '▶')}</div></div>
        <div class="fc-next">${next}${(st.type === 'major' || st.type === 'worlds') && window.RLCutscene ? `<button class="fc-intro" data-action="career-intro">▶ Watch the ${esc(st.type === 'worlds' ? worldsCity() + ' Worlds' : majorCity(st))} intro</button>` : ''}</div>
      </aside>`;
    const tiles = `<nav class="fc-tiles" aria-label="Career hub">${VIEWS.map(([k, l, sub]) => `<button class="fc-tile ${k === view && tab === 'central' ? 'on' : ''}" data-action="career-view" data-v="${k}"><b>${l}</b><small>${esc(sub)}</small><span class="fc-tile-ico" aria-hidden="true">${{ next: '▶', standings: '☰', schedule: '▦', objectives: '✔', news: '▤' }[k]}</span></button>`).join('')}</nav>`;
    // ---- tabs ----
    const TABS = [['central', 'Central'], ['squad', 'Squad'], ['transfers', 'Transfers'], ['teams', 'Teams'], ['office', 'Office'], ['history', 'History']].filter(([k]) => !viewer || !['squad', 'office'].includes(k));
    let body;
    const avgAge = roster.length ? (roster.reduce((x, p) => x + p.age, 0) / roster.length).toFixed(1) : '—';
    const fin = C.seasonFin || { prize: 0, sponsor: 0, salaries: 0, transfers: 0 };
    if (tab === 'squad') {
      const cards = roster.map((p, i) => { const ph = photoOf(p); return `<button class="sq-card" data-action="th-pick" data-v="squad" data-id="${p.id}" title="Open ${esc(p.name)} in the transfer hub">
          <span class="sq-photo" style="--tc:${t.color || 'var(--azure)'}">${ph ? `<img src="${esc(ph)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<span class="sq-ini">${esc(initialsOf(p.name))}</span><span class="sq-ovr">${p.rating}</span><span class="sq-role">${i < 3 ? 'Starter' : 'Sub'}</span></span>
          <span class="sq-info"><b>${esc(p.name)}</b><small>${p.flag || ''} ${esc(p.country || '')} · Age ${ageLabel(p)}</small>
          <span class="sq-line"><span><i>GP</i>${p.stats.gp}</span><span><i>G</i>${p.stats.g}</span><span><i>A</i>${p.stats.a}</span><span><i>Sv</i>${p.stats.sv}</span></span>
          <span class="sq-contract">${p.contract}y · ${money(p.salary)}/yr · pot. ~${p.pot}</span></span></button>`; }).join('');
      const slots = Array.from({ length: Math.max(0, 4 - roster.length) }, (_, k) => `<button class="sq-card sq-empty" data-action="th-tab" data-v="${C.fa.length ? 'fa' : 'scout'}"><span class="sq-plus" aria-hidden="true">+</span><b>${roster.length + k < 3 ? 'Starter needed' : 'Open sub slot'}</b><small>Find a player in the transfer hub</small></button>`).join('');
      const contracts = roster.slice().sort((x, y) => x.contract - y.contract).map((p) => `<tr><td class="l"><div class="tcell">${avatar(p, 'sm')}<span>${esc(p.name)}</span></div></td><td>${p.contract}y</td><td>${money(p.salary)}</td><td>${money(valueFor(p))}</td><td>${p.contract <= 1 ? '<span class="pill warn">Expiring</span>' : '<span class="muted">—</span>'}</td></tr>`).join('');
      const leaders = [['Goals', 'g'], ['Assists', 'a'], ['Saves', 'sv'], ['Games', 'gp']].map(([l, k]) => { const best = roster.slice().sort((x, y) => y.stats[k] - x.stats[k])[0]; return best ? `<div><small>${l}</small><b>${best.stats[k] || '—'}</b><span>${best.stats[k] ? esc(best.name) : 'No games yet'}</span></div>` : ''; }).join('');
      const acIds = (C.academy && C.academy[C.user]) || [], lvl = C.acLevel || 1, canMove = isWindow() || st.type === 'review';
      const acCards = acIds.map((pid) => C.players[pid]).filter(Boolean).sort((a, b) => b.pot - a.pot).map((p) => { const pr = potRange(p), f = clamp((p.rating - 50) / Math.max(1, p.pot - 50), 0, 1);
        return `<div class="ac-card${p.wonder ? ' wonder' : ''}">${avatar(p)}<div class="ac-info"><b>${p.flag || ''} ${esc(p.name)}${p.wonder ? ' <span class="tag-hot">Wonderkid</span>' : ''}</b><small>Age ${p.age} · joined ${p.intake || C.season}${p.age >= 18 ? ' · <span class="ac-due">' + (p.age >= 19 ? 'leaves at season end' : 'ready to step up') + '</span>' : ''}</small>
          <div class="ac-bar" title="Rating ${p.rating} of potential ${pr}"><i style="width:${Math.round(f * 100)}%"></i></div></div>
          <div class="ac-nums"><span><b>${p.rating}</b><small>OVR</small></span><span><b>${pr}</b><small>Pot.</small></span></div>
          <div class="ac-acts"><button class="btn sm primary" data-action="career-ac-promote" data-id="${p.id}" ${roster.length < 4 && canMove ? '' : 'disabled'} title="${roster.length >= 4 ? 'Your roster is full' : canMove ? 'Sign a pro contract' : 'Promote during a transfer window'}">Promote</button><button class="btn sm" data-action="career-ac-release" data-id="${p.id}">Release</button></div></div>`; }).join('');
      const acEmpty = Array.from({ length: Math.max(0, acCap(C.user) - acIds.length) }, () => '<div class="ac-card ac-empty"><span class="ac-plus" aria-hidden="true">+</span><div class="ac-info"><b>Open place</b><small>Filled by the next intake at the end of the season</small></div></div>').join('');
      const upCost = lvl < 5 ? AC_COST[lvl + 1] : 0;
      const academyHtml = `<section class="fc-panel"><div class="fc-panel-body">
          <div class="sq-head"><h3 class="fc-h">Youth academy</h3><span class="sq-meta">Level ${lvl} of 5 · ${acIds.length}/${acCap(C.user)} prospects · upkeep ${money(lvl * AC_UPKEEP)}/season</span>
            ${lvl < 5 ? `<button class="btn" data-action="career-ac-upgrade" ${me.budget >= upCost ? '' : 'disabled'}>Upgrade to level ${lvl + 1} · ${money(upCost)}</button>` : '<span class="pill gold">Top academy</span>'}</div>
          <span class="ac-levels" aria-hidden="true">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= lvl ? 'f' : ''}"></i>`).join('')}</span>
          <p class="help">Prospects join at 15–16, develop faster than other players and can be promoted to your roster during a transfer window. Anyone still in the academy at 19 leaves. A higher level means more places, faster growth, better wonderkid odds and sharper scouting of potential.</p>
          <div class="ac-grid">${acCards}${acEmpty}</div></div></section>`;
      body = `<section class="fc-panel"><div class="fc-panel-body">
          <div class="sq-head"><h3 class="fc-h">Squad · OVR ${t.ovr}</h3><span class="sq-meta">Average age ${avgAge} · wage bill ${money(salaries)}/season · ${roster.length}/4 players</span><button class="btn primary" data-action="th-tab" data-v="squad">Manage in transfer hub →</button></div>
          <div class="sq-cards">${cards}${slots}</div></div></section>
        ${academyHtml}
        <div class="fc-grid2"><section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Contracts</h3>
            <div class="table-wrap"><table class="st"><thead><tr><th class="l">Player</th><th>Left</th><th>Salary</th><th>Value</th><th></th></tr></thead><tbody>${contracts}</tbody></table></div></div></section>
          <section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Season leaders</h3><div class="fc-stats sq-leaders">${leaders}</div>
            <h3 class="fc-h" style="margin-top:18px">Trophy cabinet <span class="pill gold">${C.trophies.length}</span></h3>${trophyHtml}</div></section></div>`;
    } else if (tab === 'transfers') body = transferHub(st, me, roster, salaries);
    else if (tab === 'teams') body = teamsPage(reg);
    else if (tab === 'office') {
      const evRows = SCHEDULE.filter((x) => x.type === 'open' || x.type === 'major' || x.type === 'worlds').map((x) => { const i = SCHEDULE.indexOf(x); const res = myEventStatus(x); const where = x.type === 'open' ? api.regions[reg] : hostCity(x); const th = hostTheme(x); return `<tr class="${i === C.step ? 'hl' : ''}"><td class="l"><span class="of-dot" style="background:${th ? th.a : 'var(--line-strong)'}"></span>${esc(x.name)}</td><td class="l muted">${esc(where || '')}</td><td>${res ? esc(res) : i === C.step ? '<b>Next</b>' : i < C.step ? '—' : '<span class="muted">Upcoming</span>'}</td></tr>`; }).join('');
      const mood = C.board >= 75 ? 'The board is delighted with the direction of the club.' : C.board >= 60 ? 'The board is happy. Keep hitting the season objectives.' : C.board >= 40 ? 'The board is getting nervous. Results need to improve.' : 'The board is close to losing patience. Your job is at risk.';
      body = `<div class="fc-grid2"><section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Finances</h3>
          <div class="fc-stats"><div><small>Budget</small><b data-count="${me.budget}" data-fmt="money">${money(me.budget)}</b></div><div><small>Salaries / season</small><b data-count="${salaries}" data-fmt="money">${money(salaries)}</b></div>
          <div><small>Prize money this season</small><b>${money(fin.prize || 0)}</b></div><div><small>Spent on transfers</small><b>${money(fin.transfers || 0)}</b></div>
          <div><small>Circuit points</small><b data-count="${C.points[C.user].season}">${C.points[C.user].season}</b><small>Split 1: ${C.points[C.user].s1} · Split 2: ${C.points[C.user].s2}</small></div><div><small>Region rank</small><b>${regionRankLabel()}</b><small>${esc(api.regions[reg])}</small></div>
          <div class="of-org"><small>Organisation size</small><b>${esc(tierName(tierOf(C.user)))}</b><small>Sponsorship ~${money(Math.round(TIERS[tierOf(C.user)].sponsor * diff().sponsor / 1000) * 1000)} a season · the org keeps ${Math.round(diff().prize * 100)}% of prize money · ${(C.rep || 0) > 0 && (C.rep || 0) < diff().growNeed ? 'one more strong season to grow' : (C.rep || 0) < 0 ? 'another poor season and sponsors pull back' : (diff().growNeed === 1 ? 'a strong season grows the club' : 'two strong seasons in a row grow the club')}</small><span class="of-tiers" aria-hidden="true">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= tierOf(C.user) ? 'f' : ''}"></i>`).join('')}</span></div></div></div></section>
        <section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Board</h3>
          <div class="of-board"><div class="of-meter"><b>${C.board}%</b><small>Confidence</small><div class="progress"><i style="width:${C.board}%"></i></div></div><p>${mood}</p></div>
          <div class="tile-kicker" style="margin-top:14px">Season objectives</div>${objHtml}
          <div class="tile-kicker" style="margin-top:14px">Difficulty</div><div class="seg of-diff" role="radiogroup" aria-label="Difficulty">${Object.entries(DIFF).map(([k, d]) => `<button role="radio" aria-checked="${d === diff()}" class="${d === diff() ? 'active' : ''}" data-action="career-setdiff" data-v="${k}">${d.name}</button>`).join('')}</div><p class="help">${esc(diff().blurb)}</p></div></section></div>
        <section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Season ${C.season} results</h3>
          <div class="table-wrap"><table class="st"><thead><tr><th class="l">Event</th><th class="l">Where</th><th>Your result</th></tr></thead><tbody>${evRows}</tbody></table></div>
          <div class="action-row"><button class="btn danger" data-action="career-quit">End career</button></div></div></section>`;
    } else if (tab === 'history' && viewer) { body = viewerHistory();
    } else if (tab === 'history') {
      const H = C.history;
      const bestW = H.map((h) => h.worlds).filter((w) => w && w !== 'DNQ');
      const rec = [['Seasons completed', H.length], ['Trophies', C.trophies.length], ['World Championships played', bestW.length], ['Best region finish', H.length ? E.ordinal(Math.min(...H.map((h) => h.regRank))) : '—'], ['Majors qualified', H.reduce((x, h) => x + (h.majors || 0), 0)], ['Objectives met', H.length ? H.reduce((x, h) => x + h.objectives.filter((o) => o.ok).length, 0) + '/' + H.reduce((x, h) => x + h.objectives.length, 0) : '—']];
      const cabinet = C.trophies.length ? `<div class="hi-cab">${C.trophies.slice().reverse().map((x) => `<div class="hi-trophy"><span aria-hidden="true">🏆</span><b>${esc(x.title)}</b><small>${x.season}</small></div>`).join('')}</div>` : '<p class="muted" style="font-size:13px">No trophies yet. Win an Open, a Major or Worlds to fill the cabinet.</p>';
      body = `<section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Career history</h3>${historyHtml}</div></section>
        <div class="fc-grid2"><section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Trophy cabinet <span class="pill gold">${C.trophies.length}</span></h3>${cabinet}</div></section>
          <section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Records</h3><div class="fc-stats">${rec.map(([l, v]) => `<div><small>${l}</small><b>${v}</b></div>`).join('')}</div></div></section></div>`;
    }
    else if (tab === 'central') body = `<div class="fc-central"><section class="fc-panel fc-main">${mainView}</section>${sideCard}</div>${tiles}`;
    app.innerHTML = `
      <div class="fc ${enter ? 'fc-enter' : ''} ${tabChanged ? 'fc-tabin' : ''}${hostTheme(st) ? ' fc-host' : ''}" style="${hostVars(hostTheme(st))}">
        <div class="fc-top">
          ${viewer ? `<button class="fc-club vw-club" data-action="nav" data-v="home" title="Back to modes"><span class="vw-eye" aria-hidden="true">◉</span><span class="fc-club-name">Neutral viewer</span><span class="vw-sub">${esc(reg)}</span></button>` : ''}<button class="fc-club${viewer ? ' hidden' : ''}" data-action="nav" data-v="home" title="Back to modes">${api.badge(t, 'sm')}<span class="fc-club-name">${esc(t.name)}</span><i class="fc-club-bar" style="--b:${C.board}%"></i><span class="fc-thumb ${C.board >= 60 ? 'good' : C.board >= 35 ? 'mid' : 'bad'}" aria-label="Board ${C.board}%">${C.board >= 60 ? '👍' : C.board >= 35 ? '✋' : '👎'}</span></button>
          <div class="fc-top-r"><button class="fc-chip" data-action="career-view" data-v="news" aria-label="Inbox${unread ? ', ' + unread + ' unread' : ''}">✉ Inbox${unread ? ` <i>${Math.min(99, unread)}</i>` : ''}</button><button class="fc-chip" data-action="${viewer ? 'career-vmarket' : 'career-market'}">⇄ ${viewer ? 'Transfers' : 'Market'}</button><button class="fc-chip" data-action="nav" data-v="home">← Modes</button>${viewer ? '<button class="fc-chip" data-action="career-quit" title="End this career">⏻ End</button>' : ''}</div>
        </div>
        <div class="fc-tabs" role="tablist" style="--tabs:${TABS.length}"><span class="fc-key" aria-hidden="true">Q</span>${TABS.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-action="career-tab" data-v="${k}"><span class="fc-tab-ico" aria-hidden="true">${{ central: '⌂', squad: '☷', transfers: '⇄', teams: '◫', office: '▤', history: '★' }[k]}</span><span class="fc-tab-l">${l}</span></button>`).join('')}<span class="fc-key" aria-hidden="true">E</span></div>
        ${body}
        <div class="fc-legend"><span><kbd>Q</kbd><kbd>E</kbd> Switch tabs</span><span><kbd>1</kbd>–<kbd>5</kbd> Hub tiles</span><span class="fc-legend-r">${esc(api.regions[reg])} · ${esc(st.name)}</span></div>
      </div>`;
    if (enter) countUp(app);
    const tq = app.querySelector('#thQ');
    if (tq) tq.addEventListener('input', () => { ui.thQ = tq.value; ui.thSel = null; const pos = tq.selectionStart; api.render(); const n = document.getElementById('thQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } });
    const mq = app.querySelector('#tmQ');
    if (mq) mq.addEventListener('input', () => { ui.tmQ = mq.value; const pos = mq.selectionStart; api.render(); const n = document.getElementById('tmQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } });
    const ms = app.querySelector('#tmSort');
    if (ms) ms.addEventListener('change', () => { ui.tmSort = ms.value; api.render(); });
    const ts = app.querySelector('#thSort');
    if (ts) ts.addEventListener('change', () => { ui.thSort = ts.value; ui.thSel = null; api.render(); });
    // first time a Major comes up: its host-city intro plays once
    const cutKey = C.season + '|' + st.key;
    if ((st.type === 'major' || st.type === 'worlds') && tab === 'central' && !activeEvent && window.RLCutscene && !(C.cutSeen || []).includes(cutKey)) {
      C.cutSeen = (C.cutSeen || []).concat(cutKey).slice(-40); save();
      setTimeout(() => playMajorIntro(st), 350);
    }
  }
  /** The host city's intro for a Major (js/cutscene.js), with the 16 qualified teams. */
  function playMajorIntro(st) {
    if (!window.RLCutscene || !C) return;
    const wc = st.type === 'worlds';
    const city = wc ? worldsCity() : majorCity(st), pal = HOST_PAL[city], th = hostTheme(st) || { a: '#1f8bff', b: '#121A2E', c: '#d4a017' };
    const country = pal ? pal[0] : '';
    const flag = global.RL_DATA.flagFor(country === 'United Kingdom' ? (city === 'Edinburgh' ? 'Scotland' : 'England') : country);
    const ids = eventCfg(st).cfg.teams.slice().sort((x, y) => ovr(y) - ovr(x));
    const RO = ['EU', 'NA', 'MENA', 'SAM', 'OCE', 'APAC', 'SSA'];
    if (wc) ids.sort((x, y) => RO.indexOf(C.teams[x].region) - RO.indexOf(C.teams[y].region) || ovr(y) - ovr(x));
    const field = ids.map((id) => { const tt = teamObj(id); return { badge: api.badge(tt, 'md'), name: tt.name, short: tt.tag || tt.name, region: C.teams[id].region, mine: !V() && id === C.user }; });
    const mineIn = !V() && ids.includes(C.user);
    const home = V() ? ids.filter((id) => C.teams[id].region === homeReg()).length : 0;
    const note = V() ? `${home} team${home === 1 ? '' : 's'} from ${api.regions[homeReg()]} made it.` : mineIn ? `${userTeam().name} are in, ${wc ? 'one of ' + ids.length + ' teams chasing the world title.' : 'seeded ' + E.ordinal(eventCfg(st).cfg.teams.slice().sort((x, y) => ovr(y) - ovr(x)).indexOf(C.user) + 1) + ' of 16.'}` : `${userTeam().name} did not qualify. You can still simulate the event and follow the results.`;
    const prev = (C.history || []).find((h) => h.season === C.season - 1);
    window.RLCutscene.play({ city, country, flag, palette: th, worlds: wc, holder: wc && prev && prev.champion && prev.champion !== '—' ? prev.champion : null, kicker: wc ? `RLCS ${C.season} · The season finale` : `RLCS ${C.season} · ${st.name} · Split ${st.split}`, field, note });
  }
  /** Viewer: the 16 strongest teams worldwide. */
  function powerHtml() {
    const ids = Object.keys(C.teams).sort((a, b) => ovr(b) - ovr(a)).slice(0, 16);
    return `<div class="table-wrap"><table class="st"><thead><tr><th>#</th><th class="l">Team</th><th>Region</th><th>OVR</th><th>Points</th><th class="l">Best player</th></tr></thead><tbody>${ids.map((id, i) => { const tt = teamObj(id), best = C.teams[id].roster.map((x) => C.players[x]).filter(Boolean).sort((a, b) => b.rating - a.rating)[0];
      return `<tr><td class="pos">${i + 1}</td><td class="l"><div class="tcell">${api.badge(tt, 'sm')}<span>${esc(tt.name)}</span></div></td><td>${esc(tt.region)}</td><td><b>${tt.ovr}</b></td><td>${C.points[id] ? C.points[id].season : 0}</td><td class="l">${best ? esc(best.name) + ' <span class="muted">' + best.rating + '</span>' : '—'}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  /** Viewer: champions of every season, and the clubs with the most titles. */
  function viewerHistory() {
    const H = C.history.filter((h) => h.viewer || h.m1);
    const rows = H.map((h) => `<tr><td class="l"><b>${h.season}</b></td><td class="l">🏆 ${esc(h.champion || '—')}${h.wc ? ` <span class="muted">· ${esc(h.wc)}</span>` : ''}</td><td class="l">${esc(h.runnerUp || '—')}</td><td class="l">${esc(h.m1 || '—')}${h.m1c ? ` <span class="muted">· ${esc(h.m1c)}</span>` : ''}</td><td class="l">${esc(h.m2 || '—')}${h.m2c ? ` <span class="muted">· ${esc(h.m2c)}</span>` : ''}</td><td class="l">${esc(h.mvp || '—')}</td><td class="l">${esc(h.topG || '—')}</td></tr>`).join('');
    const count = {};
    H.forEach((h) => { [['w', h.champion], ['m', h.m1], ['m', h.m2]].forEach(([k, n]) => { if (!n || n === '—') return; count[n] = count[n] || { w: 0, m: 0 }; count[n][k]++; }); });
    const fame = Object.entries(count).sort((a, b) => b[1].w - a[1].w || b[1].m - a[1].m).slice(0, 10);
    const stars = Object.values(C.players).filter((p) => p.team).sort((a, b) => b.rating - a.rating).slice(0, 8);
    return `<section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Champions</h3>
        ${H.length ? `<div class="table-wrap"><table class="st"><thead><tr><th class="l">Season</th><th class="l">World champion</th><th class="l">Runner-up</th><th class="l">Major 1</th><th class="l">Major 2</th><th class="l">MVP</th><th class="l">Top scorer</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted" style="font-size:13px">Finished seasons and their champions will appear here.</p>'}</div></section>
      <div class="fc-grid2"><section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Most titles</h3>
          ${fame.length ? `<div class="leader-list">${fame.map(([n, c], i) => `<div class="leader"><span class="rk">${i + 1}</span><span class="who"><b>${esc(n)}</b><small>${c.w} World title${c.w === 1 ? '' : 's'} · ${c.m} Major${c.m === 1 ? '' : 's'}</small></span><span class="val">${c.w + c.m}</span></div>`).join('')}</div>` : '<p class="muted" style="font-size:13px">No titles awarded yet.</p>'}</div></section>
        <section class="fc-panel"><div class="fc-panel-body"><h3 class="fc-h">Best players right now</h3>
          <div class="leader-list">${stars.map((p, i) => `<div class="leader"><span class="rk">${i + 1}</span><span class="who"><b>${p.flag || ''} ${esc(p.name)}</b><small>${esc(C.teams[p.team].name)} · age ${ageLabel(p)}</small></span><span class="val">${p.rating}</span></div>`).join('')}</div></div></section></div>
      <section class="fc-panel"><div class="fc-panel-body vw-end"><div><h3 class="fc-h">This career</h3><p class="help">Neutral viewer since ${C.history.length ? C.history[C.history.length - 1].season : C.season} · ${C.history.length} season${C.history.length === 1 ? '' : 's'} completed. End it to start a new viewer career or manage a club.</p></div><button class="btn danger" data-action="career-quit">End career</button></div></section>`;
  }
  /** Carousel slides: recent stories with artwork matched to the story, mixed with spotlights from the career. */
  function buildSlides(st, me, t, reg, newsList) {
    const slides = [];
    const pushStory = (n) => n && slides.push(Object.assign({ tag: n.kind === 'trophy' ? 'Trophy' : n.kind === 'transfer' ? 'Transfer' : n.kind === 'result' ? 'Result' : n.kind === 'academy' ? 'Academy' : 'News' }, n));
    // spotlight: next event in its colours
    let nextUp = null;
    if (st.type === 'open' || st.type === 'major' || st.type === 'worlds') {
      const where = st.type === 'open' ? api.regions[reg] : hostCity(st);
      nextUp = { kind: 'next', tag: 'Next up', html: `Next: <b>${esc(eventTitle(st, reg))}</b> · ${st.type === 'open' ? '16 teams, Swiss stage then an eight-team playoff' : st.type === 'major' ? '16 teams, groups then the Final Eight' : '20 teams, four groups then an eight-team knockout'}.`, meta: { stepKey: st.key, where, label: st.name } };
    } else if (st.type === 'window') {
      nextUp = { kind: 'next', tag: 'Transfer window', html: `The <b>${esc(st.name.toLowerCase())}</b> is open. Clubs make their moves when you close it.`, meta: { window: true, where: 'Transfer window', label: SCHEDULE[C.step + 1] ? 'Then ' + SCHEDULE[C.step + 1].name : '' } };
    }
    // spotlight: your star player
    const roster = V() ? Object.values(C.players).filter((p) => p.team && C.teams[p.team].region === reg) : me.roster.map((id) => C.players[id]).filter(Boolean);
    const star = roster.slice().sort((a, b) => (b.stats.g + b.stats.a + b.stats.sv) - (a.stats.g + a.stats.a + a.stats.sv) || b.rating - a.rating)[0];
    const spot = star && { kind: 'star', tag: 'Spotlight', html: star.stats.gp ? `<b>${esc(star.name)}</b> leads ${esc(V() ? C.teams[star.team].name : me.name)} this season: ${star.stats.g} goals, ${star.stats.a} assists and ${star.stats.sv} saves in ${star.stats.gp} games.` : `<b>${esc(star.name)}</b> (${star.rating}) is the player to watch at ${esc(me.name)} this season.`, meta: { pid: star.id } };
    // spotlight: region race (once points are on the board)
    const table = standings(reg, 'season');
    const race = C.points[table[0]] && C.points[table[0]].season > 0 ? { kind: 'race', tag: 'Standings', html: `<b>${esc(C.teams[table[0]].name)}</b> lead ${esc(api.regions[reg])} on ${C.points[table[0]].season} points. ${V() ? (table[1] ? `${esc(C.teams[table[1]].name)} are second on ${C.points[table[1]].season}.` : '') : table[0] === C.user ? 'You are top of the region.' : `You are ${E.ordinal(table.indexOf(C.user) + 1)} with ${C.points[C.user].season}.`}`, meta: { top: table.slice(0, 3) } } : null;
    // up to four recent stories, at most two of the same kind, so the carousel stays varied
    const picked = [], kinds = {};
    for (const n of C.news.slice(0, 14)) { const k = n.kind === 'info' || n.kind === 'career' ? 'club' : n.kind; if ((kinds[k] || 0) >= 2) continue; kinds[k] = (kinds[k] || 0) + 1; picked.push(n); if (picked.length === 4) break; }
    pushStory(picked[0]); if (nextUp) slides.push(nextUp);
    pushStory(picked[1]); if (spot) slides.push(spot);
    pushStory(picked[2]); if (race) slides.push(race);
    pushStory(picked[3]);
    return slides.slice(0, 7);
  }
  /** Player and teams a story is about: from its meta, or (older saves) from the names in its text. */
  function storySubjects(n) {
    const m = n.meta || {};
    let p = m.pid && C.players[m.pid];
    const bold = [...String(n.html).matchAll(/<b>([^<]+)<\/b>/g)].map((x) => x[1]);
    if (!p && n.kind === 'transfer' && bold[0]) { const nm = bold[0].replace(/&amp;/g, '&'); p = Object.values(C.players).find((x) => x.name === nm) || null; }
    let teams = [m.from, m.to].filter(Boolean);
    if (!teams.length) teams = Object.values(C.teams).map((x) => [String(n.html).indexOf(esc(x.name)), x.id]).filter(([i]) => i >= 0).sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, 2);
    return { p, teams };
  }
  function slideArt(sl, t) {
    const m = sl.meta || {};
    const photoBox = (p, cls) => { const ph = p && photoOf(p); return `<span class="fs-photo ${cls || ''}">${ph ? `<img src="${esc(ph)}" alt="" onerror="this.remove()">` : ''}<span>${esc(p ? initialsOf(p.name) : '?')}</span></span>`; };
    if (sl.kind === 'transfer') {
      const { p, teams } = storySubjects(sl);
      const toT = teams.length > 1 ? teams[1] : teams[0];
      const fromT = teams.length > 1 ? teams[0] : m.from;
      const tc = toT && teamObj(toT) ? teamObj(toT).color : t.color;
      return { tc, cls: 'fs-transfer', html: `${p ? photoBox(p, 'big') : ''}<div class="fs-move">${fromT && teamObj(fromT) ? api.badge(teamObj(fromT), 'lg') : '<span class="fs-fa">Free<br>agent</span>'}<span class="fs-arrow" aria-hidden="true">→</span>${toT && teamObj(toT) ? api.badge(teamObj(toT), 'lg') : ''}</div>${m.fee ? `<span class="fs-fee">${money(m.fee)}</span>` : ''}${p ? `<span class="fs-ovr"><small>OVR</small>${p.rating}</span>` : ''}` };
    }
    if (sl.kind === 'academy') {
      const p = m.pid && C.players[m.pid];
      const club = (m.to && C.teams[m.to]) ? m.to : p && (p.team || p.academy);
      const ct = club && teamObj(club);
      return { tc: ct ? ct.color : t.color, cls: 'fs-academy', html: `<span class="fs-word">Academy</span>${p ? `<div class="fs-stats"><span><small>Age</small><b>${p.age}</b></span><span><small>OVR</small><b>${p.rating}</b></span><span><small>Potential</small><b>${p.academy === C.user || p.team === C.user ? potRange(p) : '?'}</b></span><span><small>From</small><b>${esc(p.region)}</b></span></div><span class="fs-kid">${esc(initialsOf(p.name))}</span>` : ''}${ct ? api.badge(ct, 'lg') : ''}` };
    }
    if (sl.kind === 'trophy' || sl.kind === 'result') {
      const stp = SCHEDULE.find((x) => x.key === m.ev);
      const th = stp ? (stp.type === 'open' ? window.RL_EVENT_THEMES[regionKey(m.region || homeReg())] : hostTheme(stp)) : null;
      const champ = m.champ || storySubjects(sl).teams[0];
      const ct = champ && teamObj(champ);
      const vars = th ? `--s1:${th.a};--s2:${th.b};--s3:${th.c}` : '';
      if (sl.kind === 'trophy') { const crew = champ && C.teams[champ] ? C.teams[champ].roster.slice(0, 3).map((id) => C.players[id]).filter(Boolean) : []; return { tc: th ? th.a : t.color, vars, cls: 'fs-trophy', html: `<span class="fs-word">Champions</span>${crew[0] ? photoBox(crew[0], 'flank l') : ''}${crew[1] ? photoBox(crew[1], 'flank r') : ''}<span class="fs-cup" aria-hidden="true">🏆</span>${ct ? api.badge(ct, 'lg') : ''}` }; }
      return { tc: th ? th.a : (ct && ct.color) || t.color, vars, cls: 'fs-result', html: `${ct ? api.badge(ct, 'xl') : ''}<span class="fs-stamp">Champions</span>${m.mine ? `<span class="fs-you"><small>You</small>${esc(m.mine)}</span>` : ''}` };
    }
    if (sl.kind === 'next') {
      const stp = m.stepKey && SCHEDULE.find((x) => x.key === m.stepKey);
      const th = stp ? hostTheme(stp) : null;
      return { tc: th ? th.a : t.color, vars: th ? `--s1:${th.a};--s2:${th.b};--s3:${th.c}` : '', cls: 'fs-next' + (m.window ? ' fs-window' : ''), html: `<span class="fs-label">${esc(m.label || '')}</span><span class="fs-city">${esc(m.where || '')}</span>${m.window ? '<span class="fs-swap" aria-hidden="true">⇄</span>' : ''}` };
    }
    if (sl.kind === 'star') {
      const p = C.players[m.pid];
      return { tc: t.color, cls: 'fs-star', html: `${photoBox(p, 'big')}<div class="fs-stats"><span><small>OVR</small><b>${p.rating}</b></span><span><small>Goals</small><b>${p.stats.g}</b></span><span><small>Assists</small><b>${p.stats.a}</b></span><span><small>Saves</small><b>${p.stats.sv}</b></span></div>` };
    }
    if (sl.kind === 'race') {
      const [a, b, c] = m.top.map((id) => teamObj(id));
      const step = (tt, n, cls) => (tt ? `<span class="fs-pod ${cls}">${api.badge(tt, n === 1 ? 'lg' : 'md')}<i>${n}</i><small>${C.points[tt.id] ? C.points[tt.id].season : 0} pts</small></span>` : '');
      return { tc: t.color, cls: 'fs-race', html: `<div class="fs-podium">${step(b, 2, 'p2')}${step(a, 1, 'p1')}${step(c, 3, 'p3')}</div>` };
    }
    // club news: your starting line-up
    const fid = V() ? regionTeams(homeReg()).sort((a, b) => ovr(b) - ovr(a))[0] : C.user, ft = teamObj(fid) || t;
    const line = (C.teams[fid] ? C.teams[fid].roster : []).slice(0, 3).map((id) => C.players[id]).filter(Boolean);
    return { tc: ft.color || t.color, cls: 'fs-squad', html: `<div class="fs-line">${line.map((p) => photoBox(p, 'tall')).join('')}</div>${api.badge(ft, 'md')}` };
  }
  function regionRankLabel() { return E.ordinal(regionRankOfUser()); }

  /* ---------------- transfer market ---------------- */
  /** The market lives in the Transfers tab (Transfer Hub); old entry points land there. */
  function openMarket() { try { api.closeModal(); } catch (e) { /* no modal */ } api.state.ui.ctab = 'transfers'; api.render(); }

  function nextWindowLabel() {
    const k = SCHEDULE.findIndex((x, i) => i > C.step && x.type === 'window');
    return k > 0 ? SCHEDULE[k].name.toLowerCase() : 'the next pre-season';
  }
  function scoutNote(p) {
    if (V()) { const club = p.team && C.teams[p.team]; return `${club ? esc(club.name) + ' value' : 'As a free agent,'} <b>${esc(p.name)}</b> ${club ? 'at about <b>' + money(valueFor(p)) + '</b>' : 'would cost no fee'}. ${p.pot - p.rating >= 5 ? `Scouts expect growth towards ~${p.pot}.` : p.age >= 27 ? 'At this age, decline is closer than growth.' : 'Close to the expected peak.'}${p.wonder ? ' One of the wonderkids of this generation.' : ''}${club && p.contract <= 1 ? ' The contract ends this season.' : ''}`; }
    const ask = askingSalary(p, C.user);
    if (p.team === C.user) {
      return `${esc(p.name)} is valued at <b>${money(valueFor(p))}</b>. ${p.contract <= 1 ? 'The contract ends this season, so extend it or the player can leave for free.' : `A club in your region would pay around ${money(Math.round(valueFor(p) * 0.95 / 1000) * 1000)}.`}`;
    }
    if (!p.team) return `Free agent, so there is no transfer fee. ${esc(p.name)} wants about <b>${money(ask)}</b> per season${p.pot - p.rating >= 5 ? ` and still has room to grow (potential ~${p.pot})` : ''}${minTierFor(p) > tierOf(C.user) ? `, but expects at least ${aTier(minTierFor(p)).replace(/(\w+)$/, '<b>$1</b>')} org` : ''}.`;
    const club = C.teams[p.team];
    const best = club.roster.every((x) => !C.players[x] || C.players[x].rating <= p.rating);
    const parts = [`${esc(club.name)} value ${esc(p.name)} at about <b>${money(valueFor(p))}</b>`];
    if (best) parts.push(`as their best player, expect to pay around <b>${money(Math.round(valueFor(p) * 1.25 / 1000) * 1000)}</b>`);
    else if (p.contract <= 1) parts.push('the contract ends this season, so they may accept less');
    if (p.age <= 20 && p.pot - p.rating >= 4) parts.push(`scouts rate the potential at ~${p.pot}`);
    if (ask > salaryFor(p.rating)) parts.push('a move to a weaker team would need a pay rise');
    const gap = minTierFor(p) - tierOf(C.user);
    if (gap > 0) parts.push(`a player this good expects at least ${aTier(minTierFor(p)).replace(/(\w+)$/, '<b>$1</b>')} org, so it would take a much bigger salary to convince them`);
    return parts.join('; ') + '.';
  }
  /** Teams page: every club's current roster, by region. */
  function teamsPage(myReg) {
    const ui = api.state.ui;
    const reg = ui.tmReg || myReg, q = (ui.tmQ || '').trim().toLowerCase(), sort = ui.tmSort || 'ovr';
    let ids = Object.keys(C.teams).filter((id) => reg === 'all' || C.teams[id].region === reg);
    if (q) ids = ids.filter((id) => C.teams[id].name.toLowerCase().includes(q) || C.teams[id].roster.some((pid) => C.players[pid] && C.players[pid].name.toLowerCase().includes(q)));
    const val = (id) => C.teams[id].roster.reduce((x, pid) => x + (C.players[pid] ? valueFor(C.players[pid]) : 0), 0);
    const pts = (id) => (C.points[id] ? C.points[id].season : 0);
    const by = { ovr: (a, b) => ovr(b) - ovr(a), pts: (a, b) => pts(b) - pts(a) || ovr(b) - ovr(a), value: (a, b) => val(b) - val(a), name: (a, b) => C.teams[a].name.localeCompare(C.teams[b].name) }[sort] || ((a, b) => ovr(b) - ovr(a));
    ids.sort(by);
    const rank = {};
    REGIONS.forEach((r) => regionTeams(r).sort((a, b) => pts(b) - pts(a) || ovr(b) - ovr(a)).forEach((id, i) => { rank[id] = i + 1; }));
    const fromOf = (p) => { const d = (C.deals || []).find((x) => x.pid === p.id && x.toId === p.team && x.season === C.season); return d ? d.from : null; };
    const LIMIT = 24, more = !ui.tmAll && !q && ids.length > LIMIT ? ids.length - LIMIT : 0;
    const cards = ids.slice(0, more ? LIMIT : ids.length).map((id) => {
      const tm = C.teams[id], to = teamObj(id), mine = id === C.user;
      const ps = tm.roster.map((pid) => C.players[pid]).filter(Boolean);
      const rows = ps.map((p, i) => { const fresh = p.joined === C.season, fr = fresh ? fromOf(p) : null; const q2 = q && p.name.toLowerCase().includes(q);
        return `<button class="tm-pl${q2 ? ' hit' : ''}" data-action="career-teams-pl" data-id="${p.id}" title="Open ${esc(p.name)} in the transfer hub">${avatar(p, 'sm')}<span class="tm-who"><b>${p.flag || ''} ${esc(p.name)}${fresh ? ' <span class="new-tag">New</span>' : ''}</b><small>${i < 3 ? 'Starter' : 'Sub'} · age ${ageLabel(p)} · ${p.contract}y${fr ? ' · from ' + esc(fr) : ''}</small></span><span class="tm-r">${p.rating}</span></button>`; }).join('');
      const empty = Array.from({ length: Math.max(0, 3 - ps.length) }, () => '<div class="tm-pl tm-open"><span class="pav sm"><span>?</span></span><span class="tm-who"><b>Open slot</b><small>Plays with a stand-in</small></span></div>').join('');
      return `<article class="tm-card${mine ? ' mine' : ''}" style="--tc:${tm.color || 'var(--azure)'}">
        <header class="tm-head">${api.badge(to, 'md')}<span class="tm-name"><b>${esc(tm.name)}${mine ? ' <span class="pill">You</span>' : ''}</b><small>${esc(api.regions[tm.region] || tm.region)} · ${esc(tierName(tierOf(id)))} · ${E.ordinal(rank[id])} · ${pts(id)} pts</small></span><span class="tm-ovr"><b>${to.ovr}</b><small>OVR</small></span></header>
        <div class="tm-list">${rows}${empty}</div>
        <footer class="tm-foot"><span>Squad value <b>${money(val(id))}</b></span>${(C.academy && (C.academy[id] || []).length) ? `<span>Academy <b>${C.academy[id].length}</b>${C.academy[id].some((x) => C.players[x] && C.players[x].wonder) ? ' <span class="tag-hot">★</span>' : ''}</span>` : ''}<span>Avg age <b>${ps.length ? (ps.reduce((x, p) => x + p.age, 0) / ps.length).toFixed(1) : '—'}</b></span></footer></article>`;
    }).join('');
    const regBar = `<div class="seg th-reg">${[['all', 'All'], ...REGIONS.map((k) => [k, k])].map(([k, v]) => `<button class="${k === reg ? 'active' : ''}" data-action="career-teams-reg" data-v="${k}">${v}</button>`).join('')}</div>`;
    return `<section class="fc-panel"><div class="fc-panel-body">
        <div class="tm-bar"><h3 class="fc-h">${reg === 'all' ? 'All regions' : esc(api.regions[reg])} · ${ids.length} teams</h3>
          <div class="search"><input class="input" id="tmQ" placeholder="Search a team or player" value="${esc(ui.tmQ || '')}" aria-label="Search teams and players" /></div>
          <label class="th-sort">Sort <select class="select" id="tmSort">${[['ovr', 'Team rating'], ['pts', 'Circuit points'], ['value', 'Squad value'], ['name', 'Name']].map(([k, l]) => `<option value="${k}" ${k === sort ? 'selected' : ''}>${l}</option>`).join('')}</select></label>${regBar}</div>
        <p class="help">Current rosters across the circuit. Players marked New joined this season; click a player to scout them in the transfer hub.</p>
        ${ids.length ? `<div class="tm-grid">${cards}</div>${more ? `<div class="tm-more"><button class="btn" data-action="career-teams-all">Show all ${ids.length} teams (${more} more)</button></div>` : ''}` : '<p class="muted">No team or player matches that search.</p>'}
      </div></section>`;
  }
  function transferHub(st, me, roster, salaries) {
    const ui = api.state.ui;
    const open = isWindow();
    const tab = ui.thTab || 'scout';
    const q = (ui.thQ || '').toLowerCase();
    const reg = ui.thReg || me.region;
    const sort = ui.thSort || 'ovr';
    C.shortlist = (C.shortlist || []).filter((id) => C.players[id]);
    const sl = new Set(C.shortlist);
    let pool = [];
    if (tab === 'fa') pool = C.fa.map((id) => C.players[id]).filter(Boolean);
    else if (tab === 'shortlist') pool = C.shortlist.map((id) => C.players[id]).filter((p) => p && p.team !== C.user);
    else if (tab === 'squad') pool = roster.slice();
    else if (tab === 'scout') pool = Object.values(C.players).filter((p) => p.team && p.team !== C.user && C.teams[p.team] && (reg === 'all' || C.teams[p.team].region === reg));
    if (tab !== 'squad' && tab !== 'activity') {
      pool = pool.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.team && C.teams[p.team].name.toLowerCase().includes(q)));
      const key = { ovr: (p) => -p.rating, pot: (p) => -p.pot, age: (p) => p.age, value: (p) => -valueFor(p) }[sort] || ((p) => -p.rating);
      pool.sort((a, b) => key(a) - key(b) || b.rating - a.rating);
      pool = pool.slice(0, 60);
      const picked = ui.thSel && C.players[ui.thSel];
      if (tab === 'scout' && picked && picked.team && picked.team !== C.user && !pool.includes(picked)) pool.unshift(picked); // opened from the Teams page
    }
    const sel = pool.find((p) => p.id === ui.thSel) || pool[0] || null;
    const spent = (C.seasonFin && C.seasonFin.transfers) || 0;
    const moves = C.news.filter((n) => n.kind === 'transfer');
    const stats = `<div class="th-stats">
        <div class="th-stat ${open ? 'live' : ''}"><small>Transfer window</small><b>${open ? 'Open' : 'Closed'}</b><span>${open ? 'Closes when you continue to ' + esc(SCHEDULE[C.step + 1] ? SCHEDULE[C.step + 1].name : 'the next event') : 'Reopens at the ' + esc(nextWindowLabel())}</span></div>
        ${V() ? (() => { const ds = (C.deals || []).filter((d) => d.season === C.season), top = ds.slice().sort((a, b) => b.fee - a.fee)[0], wk = C.fa.map((id) => C.players[id]).filter((p) => p && p.wonder).length;
          return `<div class="th-stat"><small>Paid deals ${C.season}</small><b>${ds.length}</b><span>${ds.filter((d) => d.rating >= 88).length} involving 88+ players</span></div><div class="th-stat"><small>Record fee ${C.season}</small><b>${top ? money(top.fee) : '—'}</b><span>${top ? esc(top.name) + ' → ' + esc(top.to) : 'No paid deals yet'}</span></div><div class="th-stat"><small>Free agents</small><b>${C.fa.length}</b><span>${wk} wonderkid${wk === 1 ? '' : 's'} available</span></div>`; })() : `<div class="th-stat"><small>Transfer budget</small><b>${money(me.budget)}</b><span>${esc(tierName(tierOf(C.user)))} org · ${money(spent)} spent</span></div>
        <div class="th-stat"><small>Wage bill</small><b>${money(salaries)}</b><span>per season · ${roster.length} player${roster.length === 1 ? '' : 's'}</span></div>
        <div class="th-stat"><small>Roster</small><b>${roster.length}/4</b><span class="th-slots" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<i class="${i < roster.length ? 'f' : ''}${i === 3 ? ' sub' : ''}"></i>`).join('')}</span></div>`}
        <div class="th-stat"><small>${V() ? 'Watchlist' : 'Shortlist'}</small><b>${C.shortlist.length}</b><span>players tracked</span></div>
      </div>`;
    const TT = [['scout', 'Scout players'], ['fa', 'Free agents · ' + C.fa.length], ['shortlist', (V() ? 'Watchlist · ' : 'Shortlist · ') + C.shortlist.length], ['squad', 'My squad'], ['activity', V() ? 'Transfer news' : 'Activity']].filter(([k]) => !V() || k !== 'squad');
    const tabs = `<div class="th-tabs" role="tablist">${TT.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-action="th-tab" data-v="${k}">${esc(l)}</button>`).join('')}</div>`;
    const tools = tab === 'squad' || tab === 'activity' ? '' : `<div class="th-tools">
        <div class="search"><input class="input" id="thQ" placeholder="Search players or teams" value="${esc(ui.thQ || '')}" aria-label="Search players or teams" /></div>
        ${tab === 'scout' ? `<div class="seg th-reg">${[['all', 'All'], ...REGIONS.map((k) => [k, k])].map(([k, v]) => `<button class="${k === reg ? 'active' : ''}" data-action="th-reg" data-v="${k}">${v}</button>`).join('')}</div>` : ''}
        <label class="th-sort">Sort <select class="select" id="thSort">${[['ovr', 'Rating'], ['pot', 'Potential'], ['value', 'Value'], ['age', 'Youngest']].map(([k, v]) => `<option value="${k}" ${k === sort ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>`;
    let list;
    if (tab === 'activity') {
      const minor = C.minor || [];
      list = `<div class="th-feed"><div class="tile-kicker th-feed-h">Headline moves</div>${moves.slice(0, 40).map((n) => `<div class="th-feed-row"><small>${esc(n.when)}</small><span>${n.html}</span></div>`).join('') || '<p class="muted th-empty">No transfers yet. Moves by every club appear here.</p>'}
        ${minor.length ? `<div class="tile-kicker th-feed-h">Other moves</div>${minor.slice(0, 40).map((n) => `<div class="th-feed-row minor"><small>${esc(n.when)}</small><span>${n.html}</span></div>`).join('')}` : ''}</div>`;
    } else {
      const head = `<div class="th-row th-headrow" aria-hidden="true"><span></span><span>${tab === 'squad' ? 'Player · role' : 'Player · club'}</span><span class="th-c">Age</span><span class="th-c">OVR</span><span class="th-c hide-sm">Pot.</span><span class="th-c">${tab === 'fa' ? 'Asks' : tab === 'squad' ? 'Salary' : 'Value'}</span><span></span></div>`;
      const rows = pool.map((p) => {
        const club = p.team && C.teams[p.team];
        const sub = tab === 'squad' ? (me.roster.indexOf(p.id) < 3 ? 'Starter' : 'Substitute') + ' · ' + p.contract + 'y left' : club ? `${api.badge(teamObj(p.team), 'sm')}<span>${esc(club.name)}</span>` : 'Free agent';
        const val = tab === 'fa' ? askingSalary(p, C.user) : tab === 'squad' ? p.salary : valueFor(p);
        return `<button class="th-row ${sel && sel.id === p.id ? 'on' : ''}" data-action="th-sel" data-id="${p.id}">${avatar(p)}<span class="th-who"><b>${p.flag || ''} ${esc(p.name)}</b><small>${sub}</small></span><span class="th-c">${ageLabel(p)}</span><span class="th-c th-ovr">${p.rating}</span><span class="th-c hide-sm">~${p.pot}</span><span class="th-c th-val">${money(val)}</span><span class="th-star" aria-label="${sl.has(p.id) ? 'Shortlisted' : ''}">${sl.has(p.id) ? '★' : ''}</span></button>`;
      }).join('');
      const empty = { shortlist: 'Your shortlist is empty. Select a player and press ☆ Shortlist to track them here.', fa: 'No free agents right now.', scout: 'No players match.', squad: 'Your roster is empty.' }[tab];
      list = `${head}<div class="th-rows">${rows || `<p class="muted th-empty">${empty}</p>`}</div>`;
    }
    let detail;
    if (tab === 'activity') {
      const mine = moves.filter((n) => n.html.includes(esc(me.name)));
      detail = `<div class="th-dbody"><h3 class="fc-h">Window summary</h3>
          <div class="th-grid"><div><small>Moves this career</small><b>${moves.length}</b></div>${V() ? `<div><small>Paid deals this season</small><b>${(C.deals || []).filter((d) => d.season === C.season).length}</b></div>` : `<div><small>Involving you</small><b>${mine.length}</b></div>`}${V() ? '' : `<div><small>Spent this season</small><b>${money(spent)}</b></div><div><small>Budget left</small><b>${money(me.budget)}</b></div>`}</div>
          ${(() => { const big = (C.deals || []).filter((d) => d.season === C.season).sort((a, b) => b.fee - a.fee).slice(0, 6); return `<div class="tile-kicker" style="margin-top:4px">Biggest deals of ${C.season}</div>${big.length ? `<div class="th-deals">${big.map((d, k) => `<div class="th-deal"><span class="th-deal-rk">${k + 1}</span><span class="th-deal-who"><b>${d.flag} ${esc(d.name)} <i>${d.rating}</i></b><small>${esc(d.from)} → ${esc(d.to)}</small></span><b class="th-deal-fee">${money(d.fee)}</b></div>`).join('')}</div>` : '<p class="muted" style="font-size:13px;margin:0">No paid transfers yet this season. Clubs make their moves when the window closes.</p>'}`; })()}
          <div class="th-note">${V() ? (open ? 'The window is open. Clubs make their moves when you close it on the Central tab.' : `The window is closed. It reopens at the ${esc(nextWindowLabel())}.`) : open ? 'The window is open. AI clubs make their moves when you close it, so the best free agents can go quickly.' : `The window is closed. You can still scout and shortlist players; deals reopen at the ${esc(nextWindowLabel())}.`}</div></div>`;
    } else if (!sel) {
      detail = `<div class="th-dbody th-dempty"><span class="th-big-ico" aria-hidden="true">⇄</span><p>Select a player to see their scouting report.</p></div>`;
    } else {
      const p = sel, mine = p.team === C.user, club = p.team && C.teams[p.team], tobj = p.team ? teamObj(p.team) : null;
      const ph = photoOf(p);
      const idx = me.roster.indexOf(p.id);
      let acts = '';
      if (V()) acts = `<button class="btn" data-action="th-star" data-id="${p.id}">${sl.has(p.id) ? '★ On your watchlist' : '☆ Watch this player'}</button>`;
      else if (mine) acts = `${idx >= 3 ? `<button class="btn" data-action="mk-promote" data-id="${p.id}">Make starter</button>` : ''}${open ? `<button class="btn" data-action="mk-extend" data-id="${p.id}">Extend contract</button><button class="btn" data-action="mk-sell" data-id="${p.id}">Find a buyer</button><button class="btn danger" data-action="mk-release" data-id="${p.id}">Release</button>` : ''}`;
      else acts = `<button class="btn primary" data-action="mk-offer" data-id="${p.id}" ${open && roster.length < 4 ? '' : 'disabled'}>${club ? 'Make a bid' : 'Offer a contract'}</button><button class="btn" data-action="th-star" data-id="${p.id}">${sl.has(p.id) ? '★ Shortlisted' : '☆ Shortlist'}</button>`;
      const why = V() ? '' : !mine && !open ? `Deals reopen at the ${esc(nextWindowLabel())}.` : !mine && roster.length >= 4 ? 'Your roster is full: sell or release a player first.' : mine && !open ? 'Contracts, sales and releases open in the next transfer window.' : '';
      detail = `<button class="th-back" data-action="th-top">↑ Back to the list</button><div class="th-dhead" style="--tc:${(tobj && tobj.color) || 'var(--azure)'}">
          <div class="th-dname"><small>${club ? esc(club.name) : 'Free agent'}</small><b>${esc(p.name)}</b><span>${p.flag || ''} ${esc(p.country || '')} · Age ${ageLabel(p)}${mine ? ' · ' + (idx < 3 ? 'Starter' : 'Substitute') : ''}</span></div>
          <div class="th-dovr"><small>OVR</small><b>${p.rating}</b></div>
          <div class="th-dphoto">${ph ? `<img src="${esc(ph)}" alt="${esc(p.name)}" onerror="this.remove()">` : ''}<span>${esc(initialsOf(p.name))}</span></div>
        </div>
        <div class="th-dbody">
          <div class="th-grid">
            <div><small>Market value</small><b>${money(valueFor(p))}</b></div>
            <div><small>${mine ? 'Salary' : 'Asking salary'}</small><b>${money(mine ? p.salary : askingSalary(p, C.user))}</b></div>
            <div><small>Potential</small><b>~${p.pot}</b></div>
            <div><small>Contract</small><b>${p.team ? p.contract + ' season' + (p.contract === 1 ? '' : 's') : 'None'}</b></div>
            <div><small>Games · goals</small><b>${p.stats.gp} · ${p.stats.g}</b></div>
            <div><small>Assists · saves</small><b>${p.stats.a} · ${p.stats.sv}</b></div>
          </div>
          <div class="th-note"><span class="th-note-i" aria-hidden="true">!</span><span>${scoutNote(p)}</span></div>
          <div class="th-actions">${acts}</div>
          ${why ? `<p class="help">${why}</p>` : ''}
        </div>`;
    }
    return `<div class="th">
        <div class="th-crumb">Career <span aria-hidden="true">›</span> <b>Transfer hub</b></div>
        ${stats}${tabs}
        <div class="th-main"><section class="fc-panel th-list${tab === 'activity' ? ' th-list-feed' : ''}">${tools}${list}</section><aside class="fc-panel th-detail">${detail}</aside></div>
      </div>`;
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
    const gap = minTierFor(p) - tierOf(C.user);
    const reluctance = (p.rating >= 85 && ovr(C.user) < (p.team ? ovr(p.team) : 80) - 8 ? 1.5 : 1) * (gap > 0 ? 1 + gap * diff().gap : 1);
    if (sal < ask * 0.92 * reluctance) { api.toast(gap > 0 ? `${p.name} wants a bigger club than ${aTier(tierOf(C.user))} org. It would take about ${money(Math.round(ask * reluctance / 1000) * 1000)} a season.` : `${p.name} turned down ${money(sal)} a season.`); return; }
    const from = p.team;
    me.budget -= fee; C.seasonFin.transfers += fee;
    if (from) { C.teams[from].budget += fee; }
    if (from) recordDeal(p, from, C.user, fee);
    joinTeam(pid, C.user, sal, years);
    if (from) aiFill(from);
    news('transfer', `<b>${esc(p.name)}</b> signs for ${esc(me.name)}${from ? ` from ${esc(C.teams[from].name)} for ${money(fee)}` : ' as a free agent'}.`, { pid, from: from || null, to: C.user, fee });
    bump(); save();
    api.toast(`${p.name} signed!`);
    api.state.ui.thTab = 'squad'; api.state.ui.thSel = pid;
    openMarket();
  }

  /* ---------------- event flow ---------------- */
  function playEvent() {
    const st = step();
    const reg = homeReg();
    const ev = eventCfg(st, reg);
    if (st.type === 'open') noteQualifier(ev, eventTitle(st, reg));
    if (!V() && !ev.cfg.teams.includes(C.user)) { save(); api.toast('You did not make it into this event — simulate it instead.'); api.render(); return; }
    ev.cfg.managed = V() ? null : C.user;
    save();
    const tk = themeKeyFor(st);
    api.launch(ev.cfg, eventTitle(st, reg), Object.assign({ career: { season: C.season, step: C.step } }, tk ? { theme: tk } : {}));
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
    if (['career-play', 'career-sim', 'career-close-window', 'career-next-season'].includes(a) && C && !V() && userTeam().roster.length < 3) { api.toast('You need at least three players. Sign someone in the transfer market.'); return true; }
    switch (a) {
      case 'career-pick': newCareer(id, api.state.ui.cdiff || 'normal'); api.go('career'); return true;
      case 'career-viewer': newCareer(null, 'normal', v || 'EU'); api.state.ui.ctab = 'central'; api.state.ui.cview = 'next'; api.go('career'); return true;
      case 'career-intro': { const st = step(); if (st.type === 'major' || st.type === 'worlds') playMajorIntro(st); return true; }
      case 'career-vpick': api.state.ui.vreg = v; api.render(); return true;
      case 'career-vmarket': api.state.ui.ctab = 'transfers'; api.state.ui.thTab = 'activity'; api.state.ui.thSel = null; api.render(); window.scrollTo({ top: 0 }); return true;
      case 'career-vreg': if (C && V() && REGIONS.includes(v)) { C.vreg = v; bump(); save(); api.render(); } return true;
      case 'career-diff': api.state.ui.cdiff = v; api.render(); return true;
      case 'career-setdiff': if (C && DIFF[v]) { C.diff = v; save(); api.toast('Difficulty set to ' + DIFF[v].name + '. It applies from now on.'); api.render(); } return true;
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
      case 'career-tab': api.state.ui.ctab = v; api.render(); if (narrow()) window.scrollTo({ top: 0 }); return true;
      case 'career-teams-reg': api.state.ui.tmReg = v; api.state.ui.tmAll = false; api.render(); return true;
      case 'career-teams-pl': { const ui = api.state.ui, p = C.players[id]; ui.ctab = 'transfers'; if (p && p.team === C.user) ui.thTab = 'squad'; else { ui.thTab = 'scout'; ui.thReg = 'all'; } ui.thQ = ''; ui.thSel = id; api.render(); window.scrollTo({ top: 0 }); return true; }
      case 'career-view': api.state.ui.ctab = 'central'; api.state.ui.cview = v; api.render(); return true;
      case 'career-news': api.state.ui.cnews = +v; api.state.ui.cview = 'next'; api.render(); return true;
      case 'career-market': openMarket(); return true;
      case 'th-tab': api.state.ui.ctab = 'transfers'; api.state.ui.thTab = v; api.state.ui.thSel = null; api.render(); return true;
      case 'th-sel': api.state.ui.thSel = id; api.render(); if (narrow()) { const d = document.querySelector('.th-detail'); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return true;
      case 'th-top': { const l = document.querySelector('.th-list .th-row.on, .th-list'); if (l) l.scrollIntoView({ behavior: 'smooth', block: 'center' }); return true; }
      case 'career-ac-promote': {
        const p = C.players[id], me = userTeam();
        if (!p || p.academy !== C.user) return true;
        if (me.roster.length >= 4) { api.toast('Your roster is full (4).'); return true; }
        if (!(isWindow() || step().type === 'review')) { api.toast('Promote academy players during a transfer window.'); return true; }
        leaveAcademy(id); joinTeam(id, C.user, Math.max(5000, Math.round(salaryFor(p.rating) * 0.6 / 1000) * 1000), 3);
        news('academy', `<b>${esc(p.name)}</b> (${p.rating}, age ${p.age}) signs a first pro contract with ${esc(me.name)}.`, { pid: id, to: C.user });
        bump(); save(); api.toast(p.name + ' joins the roster on a three-season deal.'); api.render(); return true;
      }
      case 'career-ac-release': { const p = C.players[id]; if (!p || p.academy !== C.user) return true; leaveAcademy(id); C.fa.push(id); save(); api.toast(p.name + ' released. Other clubs can now sign them.'); api.render(); return true; }
      case 'career-ac-upgrade': {
        const lvl = C.acLevel || 1, cost = AC_COST[lvl + 1], me = userTeam();
        if (lvl >= 5) return true;
        if (me.budget < cost) { api.toast('Not enough budget: the upgrade costs ' + money(cost) + '.'); return true; }
        me.budget -= cost; C.acLevel = lvl + 1; C.seasonFin.academyUp = (C.seasonFin.academyUp || 0) + cost;
        news('academy', `The ${esc(me.name)} academy is upgraded to level ${C.acLevel}.`);
        save(); api.toast('Academy upgraded to level ' + C.acLevel + '.'); api.render(); return true;
      }
      case 'career-teams-all': api.state.ui.tmAll = true; api.render(); return true;
      case 'th-pick': api.state.ui.ctab = 'transfers'; api.state.ui.thTab = v; api.state.ui.thSel = id; api.render(); window.scrollTo({ top: 0 }); return true;
      case 'th-reg': api.state.ui.thReg = v; api.state.ui.thSel = null; api.render(); return true;
      case 'th-star': { C.shortlist = C.shortlist || []; C.shortlist = C.shortlist.includes(id) ? C.shortlist.filter((x) => x !== id) : C.shortlist.concat(id); save(); api.render(); return true; }
      case 'mk-tab': api.state.ui.thTab = { players: 'scout', fa: 'fa', squad: 'squad' }[v] || 'scout'; openMarket(); return true;
      case 'mk-reg': api.state.ui.thReg = v; openMarket(); return true;
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
  function canAdvanceCheck() { return !C || V() || userTeam().roster.length >= 3; }

  global.RLCareer = {
    theme() { try { return C && api && api.state.view === 'career' ? hostTheme(step()) : null; } catch (e) { return null; } },
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
        const TABS = (C && C.viewer ? ['central', 'transfers', 'teams', 'history'] : ['central', 'squad', 'transfers', 'teams', 'office', 'history']), VIEWS = ['next', 'standings', 'schedule', 'objectives', 'news'];
        const ui = api.state.ui, k = ev.key.toLowerCase();
        if (k === 'q' || k === 'e') { const i = TABS.indexOf(ui.ctab || 'central'); ui.ctab = TABS[(i + (k === 'e' ? 1 : TABS.length - 1)) % TABS.length]; api.render(); }
        else if (/^[1-5]$/.test(k)) { ui.ctab = 'central'; ui.cview = VIEWS[+k - 1]; api.render(); }
      });
    },
    render, onAction, recordFromT, simRest,
    has: () => !!C,
    /** Photo (real or generated) of a career player, by name: used by the tournament ceremony. */
    photoByName: (name, country) => { if (!C) return null; const p = Object.values(C.players).find((x) => x.name === name && (!country || x.country === country)) || Object.values(C.players).find((x) => x.name === name); return p ? photoOf(p) : null; },
    /** Delete the current career (home screen "Start new career"). */
    end: () => { C = null; save(); const ui = api.state.ui; ui.ctab = 'central'; ui.cview = 'next'; ui.cnews = 0; },
    teamObj: (id) => (C ? teamObj(id) : null),
    summary: () => (C ? { team: V() ? { name: 'Neutral viewer' } : teamObj(C.user), season: C.season, step: SCHEDULE[C.step].name } : null),
    canAdvance: canAdvanceCheck,
    money,
  };
})(window);
