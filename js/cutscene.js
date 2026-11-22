/* RL Esports Simulator — career Major intros.
 *
 * Every Major host city gets its own short cutscene: the city's colours, a skyline generated from its name,
 * a silhouette of its landmark (drawn from a small set of landmark styles), a welcome in the local language,
 * the city's nickname, then the 16 teams of the field. career.js decides when to play it and passes the field.
 */
(function (global) {
  'use strict';
  /* city → [landmark style, landmark name, nickname] */
  const SCENE = {
    'Copenhagen': ['gables', 'Nyhavn', 'The city of spires'], 'Sydney': ['opera', 'Sydney Opera House', 'The Harbour City'], 'Riyadh': ['ring', 'Kingdom Centre', 'Heart of Arabia'],
    'Los Angeles': ['palms', 'The Hollywood Hills', 'City of Angels'], 'London': ['wheel', 'London Eye & Big Ben', 'The Big Smoke'], 'Rio de Janeiro': ['mountain', 'Sugarloaf Mountain', 'A Cidade Maravilhosa'],
    'Berlin': ['gate', 'Brandenburg Gate', 'Poor but sexy'], 'Tokyo': ['needle', 'Tokyo Skytree', 'The Eastern Capital'], 'Dallas': ['ball', 'Reunion Tower', 'Big D'],
    'Madrid': ['gate', 'Puerta de Alcalá', 'Villa y Corte'], 'Toronto': ['needle', 'CN Tower', 'The Six'], 'Stockholm': ['spire', 'Stockholm City Hall', 'Venice of the North'],
    'Seoul': ['needle', 'N Seoul Tower', 'The Soul of Asia'], 'Mexico City': ['temple', 'Palacio de Bellas Artes', 'CDMX'], 'Paris': ['eiffel', 'Eiffel Tower', 'La Ville Lumière'],
    'São Paulo': ['skyline', 'Avenida Paulista', 'Sampa'], 'Singapore': ['ship', 'Marina Bay Sands', 'The Lion City'], 'Amsterdam': ['gables', 'The canal houses', 'Venice of the North'],
    'Dubai': ['spike', 'Burj Khalifa', 'City of Gold'], 'New York': ['skyline', 'Empire State Building', 'The Big Apple'], 'Buenos Aires': ['obelisk', 'Obelisco', 'Paris of the South'],
    'Melbourne': ['skyline', 'Flinders Street', 'The sporting capital'], 'Barcelona': ['spire', 'Sagrada Família', 'La Ciudad Condal'], 'Johannesburg': ['needle', 'Hillbrow Tower', 'Jozi'],
    'Chicago': ['skyline', 'Willis Tower', 'The Windy City'], 'Lisbon': ['bridge', 'Ponte 25 de Abril', 'City of Seven Hills'], 'Doha': ['skyline', 'West Bay', 'The Pearl of the Gulf'],
    'Bangkok': ['stupa', 'Wat Arun', 'City of Angels'], 'Milan': ['spire', 'Duomo di Milano', 'Capital of design'], 'Montréal': ['ball', 'Biosphère', 'La Métropole'],
    'Istanbul': ['mosque', 'Hagia Sophia', 'Where two continents meet'], 'Auckland': ['needle', 'Sky Tower', 'City of Sails'], 'Warsaw': ['needle', 'Palace of Culture', 'The Phoenix City'],
    'Santiago': ['mountain', 'The Andes', 'Santiago de Chile'], 'Atlanta': ['skyline', 'Peachtree', 'The ATL'], 'Rotterdam': ['bridge', 'Erasmus Bridge', 'Manhattan on the Maas'],
    'Cairo': ['pyramid', 'The Pyramids of Giza', 'City of a Thousand Minarets'], 'Hong Kong': ['skyline', 'Victoria Harbour', 'Asia’s World City'], 'Vienna': ['spire', 'St. Stephen’s Cathedral', 'City of Music'],
    'Seattle': ['needle', 'Space Needle', 'The Emerald City'], 'Abu Dhabi': ['mosque', 'Sheikh Zayed Mosque', 'The capital of the Emirates'], 'Bogotá': ['mountain', 'Monserrate', 'The Athens of South America'],
    'Birmingham': ['gate', 'The Bullring', 'The city of a thousand trades'], 'Prague': ['castle', 'Prague Castle', 'City of a Hundred Spires'], 'Manila': ['skyline', 'Manila Bay', 'Pearl of the Orient'],
    'Casablanca': ['minaret', 'Hassan II Mosque', 'Casa'], 'Orlando': ['palms', 'Lake Eola', 'The City Beautiful'], 'Lima': ['temple', 'Plaza Mayor', 'City of Kings'],
    'Vancouver': ['mountain', 'The North Shore Mountains', 'Hollywood North'], 'Cape Town': ['mountain', 'Table Mountain', 'The Mother City'], 'Raleigh': ['skyline', 'Capitol District', 'City of Oaks'],
    'Jakarta': ['obelisk', 'Monas', 'The Big Durian'], 'Munich': ['onion', 'Frauenkirche', 'Millionendorf'], 'Lyon': ['spire', 'Basilica of Fourvière', 'Capital of gastronomy'],
    'Oslo': ['opera', 'Oslo Opera House', 'Tiger City'], 'Helsinki': ['onion', 'Helsinki Cathedral', 'Daughter of the Baltic'], 'Dublin': ['bridge', 'Samuel Beckett Bridge', 'The Fair City'],
    'Edinburgh': ['castle', 'Edinburgh Castle', 'Auld Reekie'], 'Brussels': ['spire', 'Grand-Place', 'Capital of Europe'], 'Zurich': ['mountain', 'The Alps', 'Little Big City'],
    'Budapest': ['bridge', 'Chain Bridge', 'Pearl of the Danube'], 'Athens': ['temple', 'The Parthenon', 'Cradle of democracy'], 'Rome': ['colosseum', 'The Colosseum', 'The Eternal City'],
    'Marseille': ['onion', 'Notre-Dame de la Garde', 'La Cité Phocéenne'], 'Hamburg': ['wave', 'Elbphilharmonie', 'Gateway to the World'], 'Cologne': ['spire', 'Cologne Cathedral', 'Domstadt'],
    'Kraków': ['castle', 'Wawel Castle', 'City of Kings'], 'Bucharest': ['palace', 'Palace of the Parliament', 'Little Paris'], 'Valencia': ['wave', 'City of Arts and Sciences', 'City of Light'],
    'Porto': ['bridge', 'Dom Luís I Bridge', 'Cidade Invicta'], 'Katowice': ['wave', 'Spodek', 'Heart of esports'], 'Miami': ['palms', 'South Beach', 'The Magic City'],
    'Austin': ['skyline', 'Texas State Capitol', 'Live Music Capital'], 'Denver': ['mountain', 'The Rocky Mountains', 'The Mile High City'], 'Phoenix': ['cactus', 'Camelback Mountain', 'Valley of the Sun'],
    'San Francisco': ['bridge', 'Golden Gate Bridge', 'The City by the Bay'], 'Nashville': ['skyline', 'Batman Building', 'Music City'], 'Philadelphia': ['skyline', 'Independence Hall', 'City of Brotherly Love'],
    'Houston': ['skyline', 'Space City', 'H-Town'], 'Calgary': ['needle', 'Calgary Tower', 'Cowtown'], 'Guadalajara': ['spire', 'Guadalajara Cathedral', 'La Perla Tapatía'],
    'Monterrey': ['mountain', 'Cerro de la Silla', 'Sultana del Norte'], 'Medellín': ['mountain', 'The Aburrá Valley', 'City of Eternal Spring'], 'Montevideo': ['palace', 'Palacio Salvo', 'La Muy Fiel'],
    'Belo Horizonte': ['wave', 'Pampulha', 'Beagá'], 'Quito': ['mountain', 'Pichincha Volcano', 'Light of America'], 'Jeddah': ['spike', 'King Fahd’s Fountain', 'Bride of the Red Sea'],
    'Kuwait City': ['ball', 'Kuwait Towers', 'Pearl of the Gulf'], 'Muscat': ['mosque', 'Sultan Qaboos Grand Mosque', 'Jewel of Arabia'], 'Amman': ['temple', 'The Citadel', 'City of Seven Hills'],
    'Marrakech': ['minaret', 'Koutoubia Mosque', 'The Red City'], 'Tunis': ['minaret', 'Zitouna Mosque', 'The Green City'], 'Osaka': ['castle', 'Osaka Castle', 'The Nation’s Kitchen'],
    'Busan': ['needle', 'Busan Tower', 'Summer Capital'], 'Shanghai': ['ball', 'Oriental Pearl Tower', 'Paris of the East'], 'Taipei': ['pagoda', 'Taipei 101', 'City of Azaleas'],
    'Kuala Lumpur': ['twin', 'Petronas Towers', 'KL'], 'Ho Chi Minh City': ['skyline', 'Bitexco Tower', 'Pearl of the Far East'], 'Mumbai': ['gate', 'Gateway of India', 'City of Dreams'],
    'Brisbane': ['palms', 'Story Bridge', 'Brissie'], 'Perth': ['palms', 'Kings Park', 'City of Lights'], 'Wellington': ['mountain', 'Mount Victoria', 'Windy Welly'],
    'Lagos': ['bridge', 'Third Mainland Bridge', 'Centre of Excellence'], 'Nairobi': ['needle', 'KICC', 'Green City in the Sun'], 'Accra': ['gate', 'Independence Arch', 'The Gateway'],
    'Durban': ['wave', 'Moses Mabhida Stadium', 'Durbs'],
  };
  const HELLO = {
    Denmark: 'Velkommen til', Norway: 'Velkommen til', Sweden: 'Välkommen till', Finland: 'Tervetuloa', Germany: 'Willkommen in', Austria: 'Willkommen in', Switzerland: 'Willkommen in',
    France: 'Bienvenue à', Belgium: 'Bienvenue à', Spain: 'Bienvenidos a', Mexico: 'Bienvenidos a', Argentina: 'Bienvenidos a', Chile: 'Bienvenidos a', Colombia: 'Bienvenidos a', Peru: 'Bienvenidos a', Ecuador: 'Bienvenidos a', Uruguay: 'Bienvenidos a',
    Brazil: 'Bem-vindos a', Portugal: 'Bem-vindos ao', Italy: 'Benvenuti a', Netherlands: 'Welkom in', Poland: 'Witamy w', Czechia: 'Vítejte v', Hungary: 'Üdvözöljük', Romania: 'Bine ați venit',
    Greece: 'Καλώς ήρθατε', Turkey: 'Hoş geldiniz', Ireland: 'Fáilte go', Japan: 'ようこそ', 'South Korea': '환영합니다', China: '欢迎来到', Taiwan: '歡迎來到', 'Hong Kong': '歡迎來到',
    Thailand: 'ยินดีต้อนรับ', Malaysia: 'Selamat datang ke', Indonesia: 'Selamat datang di', Philippines: 'Mabuhay', Vietnam: 'Chào mừng', India: 'स्वागत है',
    'Saudi Arabia': 'أهلاً بكم', 'United Arab Emirates': 'أهلاً بكم', Qatar: 'أهلاً بكم', Kuwait: 'أهلاً بكم', Oman: 'أهلاً بكم', Jordan: 'أهلاً بكم', Egypt: 'أهلاً بكم', Morocco: 'Marhaba', Tunisia: 'Marhaba',
    Kenya: 'Karibu', 'South Africa': 'Sawubona', Nigeria: 'Welcome to', Ghana: 'Akwaaba', 'New Zealand': 'Kia ora', Australia: 'G’day', Canada: 'Welcome to', 'United States': 'Welcome to', 'United Kingdom': 'Welcome to',
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }

  /* ---------- landmark silhouettes (viewBox 1600 x 600, ground at y=560, centred on x) ---------- */
  const G = 560;
  const R = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}z`;
  const LM = {
    eiffel: (x) => `M${x - 150} ${G} C${x - 90} ${G - 120} ${x - 40} ${G - 260} ${x - 14} ${G - 470} L${x - 6} ${G - 520} L${x} ${G - 560} L${x + 6} ${G - 520} L${x + 14} ${G - 470} C${x + 40} ${G - 260} ${x + 90} ${G - 120} ${x + 150} ${G} L${x + 80} ${G} Q${x} ${G - 120} ${x - 80} ${G} Z` + R(x - 70, G - 200, 140, 14) + R(x - 32, G - 360, 64, 10),
    needle: (x) => `M${x - 18} ${G} L${x - 8} ${G - 330} L${x - 40} ${G - 340} Q${x} ${G - 400} ${x + 40} ${G - 340} L${x + 8} ${G - 330} L${x + 18} ${G}Z M${x - 4} ${G - 380} L${x} ${G - 540} L${x + 4} ${G - 380}Z` + R(x - 26, G - 230, 52, 18),
    ball: (x) => `M${x - 14} ${G} L${x - 10} ${G - 300} L${x + 10} ${G - 300} L${x + 14} ${G}Z M${x} ${G - 290} m-62 -50 a62 62 0 1 0 124 0 a62 62 0 1 0 -124 0 M${x - 3} ${G - 400} L${x} ${G - 470} L${x + 3} ${G - 400}Z M${x - 40} ${G - 140} a40 40 0 1 0 80 0 a40 40 0 1 0 -80 0`,
    spike: (x) => `M${x - 70} ${G} L${x - 60} ${G - 150} L${x - 40} ${G - 150} L${x - 34} ${G - 300} L${x - 18} ${G - 300} L${x - 14} ${G - 420} L${x - 5} ${G - 420} L${x} ${G - 565} L${x + 5} ${G - 420} L${x + 14} ${G - 420} L${x + 20} ${G - 330} L${x + 38} ${G - 330} L${x + 44} ${G - 180} L${x + 64} ${G - 180} L${x + 74} ${G}Z`,
    twin: (x) => [-60, 60].map((d) => `M${x + d - 34} ${G} L${x + d - 34} ${G - 330} L${x + d - 24} ${G - 360} L${x + d - 14} ${G - 400} L${x + d - 4} ${G - 420} L${x + d} ${G - 520} L${x + d + 4} ${G - 420} L${x + d + 14} ${G - 400} L${x + d + 24} ${G - 360} L${x + d + 34} ${G - 330} L${x + d + 34} ${G}Z`).join(' ') + R(x - 26, G - 260, 52, 12),
    pagoda: (x) => { let d = ''; for (let i = 0; i < 8; i++) { const y = G - 90 - i * 48, w = 46 - i * 1.2; d += `M${x - w} ${y} L${x - w + 8} ${y - 46} L${x + w - 8} ${y - 46} L${x + w} ${y}Z`; } return d + R(x - 52, G - 90, 104, 90) + `M${x - 4} ${G - 474} L${x} ${G - 548} L${x + 4} ${G - 474}Z`; },
    skyline: (x, rnd) => { let d = ''; const ws = [70, 54, 90, 60, 76]; let cx = x - 190; ws.forEach((w, i) => { const h = 260 + rnd() * 230 + (i === 2 ? 70 : 0); d += R(cx, G - h, w, h); if (i === 2) d += `M${cx + w / 2 - 14} ${G - h} L${cx + w / 2} ${G - h - 70} L${cx + w / 2 + 14} ${G - h}Z`; cx += w + 6; }); return d; },
    bridge: (x) => `M${x - 420} ${G - 110} L${x + 420} ${G - 110} L${x + 420} ${G - 96} L${x - 420} ${G - 96}Z` + [-200, 200].map((d) => R(x + d - 14, G - 380, 28, 380) + R(x + d - 22, G - 260, 44, 10) + R(x + d - 22, G - 360, 44, 10)).join('') + `M${x - 420} ${G - 200} Q${x - 300} ${G - 120} ${x - 200} ${G - 380} Q${x} ${G - 60} ${x + 200} ${G - 380} Q${x + 300} ${G - 120} ${x + 420} ${G - 200} L${x + 420} ${G - 194} Q${x + 300} ${G - 112} ${x + 200} ${G - 370} Q${x} ${G - 52} ${x - 200} ${G - 370} Q${x - 300} ${G - 112} ${x - 420} ${G - 194}Z`,
    opera: (x) => [[-150, 130], [-70, 190], [10, 240], [90, 170], [160, 110]].map(([d, h]) => `M${x + d - 70} ${G - 40} Q${x + d - 40} ${G - h - 40} ${x + d + 40} ${G - h - 50} Q${x + d + 10} ${G - h / 2} ${x + d + 30} ${G - 40}Z`).join('') + R(x - 260, G - 40, 520, 40),
    mountain: (x, rnd) => `M${x - 520} ${G} L${x - 330} ${G - 200 - rnd() * 60} L${x - 250} ${G - 150} L${x - 120} ${G - 330 - rnd() * 90} Q${x - 70} ${G - 420} ${x - 20} ${G - 340} L${x + 80} ${G - 240} L${x + 200} ${G - 300 - rnd() * 80} L${x + 360} ${G - 160} L${x + 520} ${G}Z`,
    pyramid: (x) => `M${x - 330} ${G} L${x - 120} ${G - 280} L${x + 90} ${G}Z M${x - 20} ${G} L${x + 160} ${G - 230} L${x + 340} ${G}Z M${x + 260} ${G} L${x + 360} ${G - 120} L${x + 460} ${G}Z`,
    colosseum: (x) => { let d = `M${x - 260} ${G} L${x - 260} ${G - 260} Q${x} ${G - 300} ${x + 230} ${G - 230} L${x + 260} ${G - 160} L${x + 260} ${G}Z`; for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) { const ax = x - 240 + i * 54, ay = G - 40 - r * 76; d += `M${ax} ${ay} L${ax} ${ay - 36} A16 16 0 0 1 ${ax + 32} ${ay - 36} L${ax + 32} ${ay}Z`; } return d; },
    temple: (x) => { let d = `M${x - 230} ${G - 250} L${x} ${G - 330} L${x + 230} ${G - 250}Z` + R(x - 240, G - 250, 480, 26) + R(x - 250, G - 22, 500, 22); for (let i = 0; i < 8; i++) d += R(x - 220 + i * 60, G - 224, 26, 202); return d; },
    mosque: (x) => `M${x - 150} ${G - 200} Q${x - 150} ${G - 360} ${x} ${G - 380} Q${x + 150} ${G - 360} ${x + 150} ${G - 200}Z M${x - 4} ${G - 380} L${x} ${G - 430} L${x + 4} ${G - 380}Z` + R(x - 190, G - 200, 380, 200) + [-280, 280].map((d) => R(x + d - 12, G - 420, 24, 420) + `M${x + d - 14} ${G - 420} L${x + d} ${G - 470} L${x + d + 14} ${G - 420}Z`).join('') + [-120, 120].map((d) => `M${x + d - 60} ${G - 200} Q${x + d} ${G - 290} ${x + d + 60} ${G - 200}Z`).join(''),
    minaret: (x) => R(x - 34, G - 470, 68, 470) + R(x - 42, G - 480, 84, 14) + R(x - 22, G - 540, 44, 60) + `M${x - 24} ${G - 540} L${x} ${G - 580} L${x + 24} ${G - 540}Z` + R(x - 260, G - 120, 220, 120) + R(x + 40, G - 120, 220, 120),
    castle: (x) => { let d = R(x - 260, G - 200, 520, 200); for (let i = 0; i < 13; i++) d += R(x - 260 + i * 40, G - 226, 22, 26); [-200, 0, 200].forEach((o, k) => { const h = k === 1 ? 380 : 300; d += R(x + o - 40, G - h, 80, h) + `M${x + o - 48} ${G - h} L${x + o} ${G - h - 90} L${x + o + 48} ${G - h}Z`; }); return d; },
    spire: (x) => { let d = R(x - 150, G - 220, 300, 220) + `M${x - 150} ${G - 220} L${x} ${G - 300} L${x + 150} ${G - 220}Z`; [-110, 110].forEach((o) => { d += R(x + o - 30, G - 380, 60, 380) + `M${x + o - 34} ${G - 380} L${x + o} ${G - 540} L${x + o + 34} ${G - 380}Z`; }); return d + `M${x - 50} ${G - 120} Q${x} ${G - 220} ${x + 50} ${G - 120}Z`; },
    onion: (x) => R(x - 160, G - 220, 320, 220) + [-90, 90].map((o) => R(x + o - 34, G - 380, 68, 380) + `M${x + o - 40} ${G - 380} Q${x + o - 50} ${G - 440} ${x + o} ${G - 470} Q${x + o + 50} ${G - 440} ${x + o + 40} ${G - 380}Z M${x + o - 3} ${G - 470} L${x + o} ${G - 510} L${x + o + 3} ${G - 470}Z`).join(''),
    gate: (x) => { let d = R(x - 240, G - 300, 480, 50) + R(x - 260, G - 250, 520, 20); for (let i = 0; i < 6; i++) d += R(x - 230 + i * 88, G - 230, 36, 230); return d + `M${x - 60} ${G - 300} L${x - 40} ${G - 370} L${x + 40} ${G - 370} L${x + 60} ${G - 300}Z`; },
    gables: (x, rnd) => { let d = ''; let cx = x - 330; for (let i = 0; i < 9; i++) { const w = 60 + rnd() * 20, h = 200 + rnd() * 120; d += R(cx, G - h, w, h) + `M${cx} ${G - h} L${cx + w / 2} ${G - h - 50 - rnd() * 30} L${cx + w} ${G - h}Z`; cx += w + 4; } return d; },
    palms: (x) => { let d = R(x - 300, G - 170, 120, 170) + R(x + 180, G - 240, 110, 240) + R(x - 160, G - 120, 300, 120); [-380, -20, 360].forEach((o, k) => { const h = 300 + k * 30; d += `M${x + o - 5} ${G} Q${x + o + 20} ${G - h / 2} ${x + o + 6} ${G - h} L${x + o + 14} ${G - h} Q${x + o + 30} ${G - h / 2} ${x + o + 5} ${G}Z`; for (let f = 0; f < 6; f++) { const a = -Math.PI + (f / 5) * Math.PI, ex = x + o + 10 + Math.cos(a) * 90, ey = G - h + Math.sin(a) * 40 + 30; d += `M${x + o + 10} ${G - h} Q${(x + o + 10 + ex) / 2} ${G - h - 40} ${ex} ${ey} Q${(x + o + 10 + ex) / 2} ${G - h - 20} ${x + o + 10} ${G - h + 6}Z`; } }); return d; },
    wheel: (x) => { let d = `M${x - 300} ${G} m0 0 a190 190 0 1 0 380 0 a190 190 0 1 0 -380 0 M${x - 290} ${G} a180 180 0 1 1 360 0 a180 180 0 1 1 -360 0`.replace(/M(\S+) (\S+) m0 0/, 'M$1 $2'); d = `M${x - 300} ${G - 200} a190 190 0 1 0 380 0 a190 190 0 1 0 -380 0 Z M${x - 288} ${G - 200} a178 178 0 1 1 356 0 a178 178 0 1 1 -356 0 Z`; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, ex = x - 110 + Math.cos(a) * 180, ey = G - 200 + Math.sin(a) * 180; d += `M${x - 112} ${G - 202} L${ex} ${ey} L${ex + 3} ${ey + 3} L${x - 108} ${G - 198}Z`; } d += `M${x - 140} ${G} L${x - 110} ${G - 200} L${x - 80} ${G}Z`; return d + R(x + 180, G - 420, 56, 420) + `M${x + 176} ${G - 420} L${x + 208} ${G - 500} L${x + 240} ${G - 420}Z` + R(x + 188, G - 380, 40, 40); },
    stupa: (x) => { let d = ''; [[-200, 0.6], [0, 1], [200, 0.6]].forEach(([o, s]) => { for (let i = 0; i < 6; i++) { const w = (110 - i * 16) * s, h = 46 * s; d += `M${x + o - w} ${G - i * h} L${x + o - w + 10} ${G - (i + 1) * h} L${x + o + w - 10} ${G - (i + 1) * h} L${x + o + w} ${G - i * h}Z`; } d += `M${x + o - 8 * s} ${G - 6 * 46 * s} L${x + o} ${G - 6 * 46 * s - 140 * s} L${x + o + 8 * s} ${G - 6 * 46 * s}Z`; }); return d; },
    ship: (x) => [-170, 0, 170].map((o) => `M${x + o - 34} ${G} L${x + o - 24} ${G - 340} L${x + o + 24} ${G - 340} L${x + o + 34} ${G}Z`).join('') + `M${x - 260} ${G - 340} L${x + 270} ${G - 352} Q${x + 290} ${G - 346} ${x + 270} ${G - 330} L${x - 260} ${G - 320}Z`,
    ring: (x) => `M${x - 90} ${G} L${x - 90} ${G - 330} Q${x - 80} ${G - 520} ${x} ${G - 540} Q${x + 80} ${G - 520} ${x + 90} ${G - 330} L${x + 90} ${G}Z M${x - 50} ${G - 360} Q${x - 50} ${G - 480} ${x} ${G - 490} Q${x + 50} ${G - 480} ${x + 50} ${G - 360}Z` + R(x - 60, G - 362, 120, 14),
    obelisk: (x) => `M${x - 40} ${G} L${x - 26} ${G - 430} L${x} ${G - 480} L${x + 26} ${G - 430} L${x + 40} ${G}Z` + R(x - 260, G - 60, 520, 60),
    wave: (x) => `M${x - 300} ${G} L${x - 300} ${G - 160} Q${x - 220} ${G - 260} ${x - 130} ${G - 190} Q${x - 40} ${G - 290} ${x + 50} ${G - 200} Q${x + 140} ${G - 310} ${x + 230} ${G - 210} Q${x + 270} ${G - 240} ${x + 300} ${G - 220} L${x + 300} ${G}Z` + R(x - 300, G - 160, 600, 12),
    palace: (x) => { let d = R(x - 320, G - 200, 640, 200) + R(x - 120, G - 300, 240, 100) + R(x - 50, G - 400, 100, 100) + `M${x - 50} ${G - 400} L${x} ${G - 460} L${x + 50} ${G - 400}Z`; for (let i = 0; i < 14; i++) d += R(x - 300 + i * 44, G - 160, 14, 26); return d; },
    cactus: (x) => `M${x - 520} ${G} Q${x - 300} ${G - 170} ${x - 160} ${G - 220} Q${x - 60} ${G - 300} ${x + 30} ${G - 210} Q${x + 200} ${G - 160} ${x + 520} ${G}Z` + `M${x + 260} ${G} L${x + 260} ${G - 260} Q${x + 278} ${G - 290} ${x + 296} ${G - 260} L${x + 296} ${G}Z M${x + 260} ${G - 150} L${x + 220} ${G - 150} L${x + 220} ${G - 210} Q${x + 232} ${G - 230} ${x + 244} ${G - 210} L${x + 244} ${G - 166} L${x + 260} ${G - 166}Z`,
  };

  function skyline(rnd) {
    // background buildings, generated from the city's name so every host looks different
    let d = '', x = 0;
    while (x < 1600) { const w = 40 + rnd() * 90, h = 90 + rnd() * rnd() * 300; d += R(x, G - h, w, h); if (rnd() < 0.18) d += `M${x + w / 2 - 3} ${G - h} L${x + w / 2} ${G - h - 40 - rnd() * 40} L${x + w / 2 + 3} ${G - h}Z`; x += w + 2 + rnd() * 10; }
    return d;
  }
  function windows(rnd) {
    let out = '';
    for (let i = 0; i < 70; i++) out += `<rect x="${Math.round(rnd() * 1600)}" y="${Math.round(G - 20 - rnd() * 200)}" width="4" height="6" style="--d:${(rnd() * 2).toFixed(2)}s"/>`;
    return out;
  }

  let cur = null;
  function stop() {
    if (!cur) return;
    cur.dead = true; cur.timers.forEach(clearTimeout);
    document.removeEventListener('keydown', cur.onKey, true);
    if (cur.el.parentNode) cur.el.parentNode.removeChild(cur.el);
    document.documentElement.classList.remove('cer-open');
    cur = null;
  }
  /** o: { city, country, flag, palette:{a,b,c}, kicker, field:[{badge,name,mine}], note } */
  function play(o, done) {
    stop();
    const info = SCENE[o.city] || ['skyline', o.city, o.country];
    const rnd = seeded(o.city + '|' + o.country);
    const lmX = 1120, lm = (LM[info[0]] || LM.skyline)(lmX, rnd);
    const { a, b, c } = o.palette;
    const hello = HELLO[o.country] || 'Welcome to';
    let li = 0;
    const words = o.city.split(' ');
    const letters = words.map((w) => `<span class="cut-w">${Array.from(w).map((ch) => `<i style="--i:${li++}">${esc(ch)}</i>`).join('')}</span>`).join(' ');
    const longest = Math.max(...words.map((w) => w.length));
    const el = document.createElement('div');
    el.className = 'cut';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Major intro: ' + o.city);
    el.style.cssText = `--a:${a};--b:${b};--c:${c}`;
    el.innerHTML = `
      <div class="cut-sky"></div>
      <div class="cut-bands" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="cut-sun" aria-hidden="true"></div>
      <svg class="cut-city" viewBox="0 0 1600 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs><linearGradient id="cutLm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="#05070e"/></linearGradient></defs>
        <path class="cut-back" d="${skyline(rnd)}"/>
        <g class="cut-win">${windows(rnd)}</g>
        <path class="cut-lm" d="${lm}" fill="url(#cutLm)"/>
        <rect class="cut-ground" x="0" y="${G}" width="1600" height="40"/>
      </svg>
      <div class="cut-text">
        <span class="cut-kicker">${esc(o.kicker)}</span>
        <span class="cut-hello">${esc(hello)}</span>
        <h1 class="cut-name" aria-label="${esc(o.city)}" style="--len:${longest}">${letters}</h1>
        <span class="cut-country">${o.flag || ''} ${esc(o.country)}</span>
        <span class="cut-lmname">${esc(info[1])} · <em>${esc(info[2])}</em></span>
      </div>
      <div class="cut-field" aria-label="The field">
        <span class="cut-fh">The field · 16 teams</span>
        <div class="cut-grid">${(o.field || []).map((t, i) => `<span class="cut-team${t.mine ? ' mine' : ''}" style="--i:${i}" title="${esc(t.name)}">${t.badge}<small>${esc(t.short || t.name)}</small></span>`).join('')}</div>
        ${o.note ? `<p class="cut-note">${esc(o.note)}</p>` : ''}
      </div>
      <div class="cut-ui"><button class="cut-skip" type="button">Skip intro</button><button class="cut-go" type="button">Let’s go →</button></div>`;
    document.body.appendChild(el);
    document.documentElement.classList.add('cer-open');
    const S = (cur = { el, timers: [], dead: false });
    const finish = () => { if (S.dead) return; stop(); if (done) done(); };
    el.querySelector('.cut-skip').addEventListener('click', finish);
    el.querySelector('.cut-go').addEventListener('click', finish);
    S.onKey = (ev) => { if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); finish(); } };
    document.addEventListener('keydown', S.onKey, true);
    // second beat: the city text moves up and the field flies in
    S.timers.push(setTimeout(() => { if (!S.dead) el.classList.add('beat2'); }, 4300));
    S.timers.push(setTimeout(() => { const g = el.querySelector('.cut-go'); if (g && !S.dead) { g.classList.add('on'); g.focus({ preventScroll: true }); } }, 6200));
  }

  global.RLCutscene = { play, stop, has: (city) => !!SCENE[city] };
})(window);
