/*
 * Observatoire Prestaterre — V6.17 — mini-jeu pendant le chargement des données.
 *
 * « Capte le CO₂ » (8 bits) : du CO₂ s'échappe au hasard des bâtiments (logements, maisons, tours,
 * bureaux, usine, école, commerce, hôpital) ; le personnage le capte en longeant le bâtiment (3 au
 * maximum) et le rapporte à la base pour faire pousser l'arbre du logo Prestaterre. Des engins de
 * chantier polluants le prennent en chasse : 2 au niveau 1, un de plus à chaque arbre planté.
 *
 * Le jeu s'ouvre pendant le chargement (OPERATIONS, Exigences, lien de partage). Si personne n'a
 * touché au jeu, l'Observatoire s'affiche dès que les données sont chargées ; sinon, un bandeau
 * propose d'y accéder (bouton ou Entrée) sans attendre la fin de la partie.
 * Aucune donnée n'est lue ni transmise par le jeu ; seul le record est gardé dans le navigateur.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Logique (sans DOM, testable)
  // ---------------------------------------------------------------------------
  const W = 23, H = 12, TILE = 16;
  const BASE = { x0: 10, x1: 12, y0: 5, y1: 6 };
  const SPAWN = { x: 11, y: 4 };
  const VEHICLE_SPAWNS = [{ x: 1, y: 1 }, { x: 21, y: 10 }, { x: 21, y: 1 }, { x: 1, y: 10 }, { x: 1, y: 7 }, { x: 21, y: 4 }, { x: 17, y: 10 }];
  const CARRY_MAX = 3, TREE_FULL = 15, LIVES = 3, VEHICLES_MAX = 7;
  const DIRS = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
  // Engins de chantier : vitesse relative, tendance à poursuivre, distance de vue dans une rue.
  const VEHICLE_TYPES = [
    { kind: 'bulldozer', name: 'bulldozer', speed: 0.82, chase: 0.75, sight: 8 },
    { kind: 'camion', name: 'camion-benne', speed: 1.18, chase: 0.25, sight: 6 },
    { kind: 'toupie', name: 'toupie béton', speed: 1.0, chase: 0.45, sight: 7 },
    { kind: 'pelleteuse', name: 'pelleteuse', speed: 0.9, chase: 0.6, sight: 9 }
  ];
  const BUILDING_TYPES = ['logement', 'maison', 'tour', 'bureau', 'usine', 'ecole', 'commerce', 'hopital', 'logement', 'maison', 'tour', 'bureau', 'logement', 'usine'];

  const isBase = (x, y) => x >= BASE.x0 && x <= BASE.x1 && y >= BASE.y0 && y <= BASE.y1;
  const inside = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
  const walkable = (x, y) => inside(x, y) && !isBase(x, y) && (x % 4 === 1 || y % 3 === 1);
  const touches = (x, y, test) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => test(x + a, y + b));
  const nearBase = (x, y) => walkable(x, y) && touches(x, y, isBase);
  // Îlots de 3 × 2 cases entre les rues ; l'îlot central est la base.
  const BLOCKS = [];
  for (let by = 2; by < H - 1; by += 3) for (let bx = 2; bx < W - 1; bx += 4) if (!isBase(bx, by)) BLOCKS.push({ x: bx, y: by, w: 3, h: 2 });
  const inBlock = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  const besideBlock = (b, x, y) => walkable(x, y) && touches(x, y, (a, c) => inBlock(b, a, c));

  function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function bfs(from) {
    const dist = new Array(W * H).fill(Infinity), q = [[from.x, from.y]];
    dist[from.y * W + from.x] = 0;
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i], d = dist[y * W + x];
      for (const k in DIRS) { const nx = x + DIRS[k].dx, ny = y + DIRS[k].dy; if (walkable(nx, ny) && dist[ny * W + nx] === Infinity) { dist[ny * W + nx] = d + 1; q.push([nx, ny]); } }
    }
    return dist;
  }
  // Le personnage est-il visible dans la rue, devant l'engin (sans bâtiment entre eux) ?
  function inSight(e, p, d, range) {
    let x = e.x, y = e.y;
    for (let i = 0; i < range; i++) { x += d.dx; y += d.dy; if (!walkable(x, y)) return false; if (Math.abs(x - p.x) < 0.6 && Math.abs(y - p.y) < 0.6) return true; }
    return false;
  }

  function createGame(options = {}) {
    const rng = options.rng || Math.random;
    const g = {
      phase: 'ready', // ready → play → over
      player: null, enemies: [], emitters: [], smoke: [], carried: 0, growth: 0, trees: 0, score: 0, lives: LIVES, level: 1,
      buildings: [], greenRoofs: [], invuln: 0, emitTimer: 0, time: 0, flash: '', flashTime: 0, desired: null, events: []
    };
    const ent = (x, y, speed) => ({ x, y, dir: { dx: 0, dy: 0 }, speed, anim: 0, face: 1 });
    const vehicleCount = () => Math.min(VEHICLES_MAX, g.level + 1);
    const baseSpeed = () => Math.min(4.6, 2.5 + 0.2 * (g.level - 1));
    function spawnEnemies() {
      g.enemies = VEHICLE_SPAWNS.slice(0, vehicleCount()).map((p, i) => ({ ...ent(p.x, p.y, baseSpeed()), type: VEHICLE_TYPES[i % VEHICLE_TYPES.length], wait: 1 + i * 0.7, charging: false, puff: 0 }));
    }
    function emitMax() { return Math.min(6, 3 + Math.floor(g.level / 2)); }
    function addEmitter() {
      const free = BLOCKS.map((b, i) => i).filter(i => !g.emitters.some(e => e.b === i));
      if (!free.length) return;
      // Les usines émettent plus souvent.
      const pool = free.flatMap(i => (g.buildings[i] === 'usine' ? [i, i, i] : [i]));
      const b = pool[Math.floor(rng() * pool.length)];
      g.emitters.push({ b, amount: g.buildings[b] === 'usine' ? 2 : 1, born: g.time });
    }
    function reset() {
      const types = BUILDING_TYPES.slice();
      for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
      Object.assign(g, { phase: 'ready', carried: 0, growth: 0, trees: 0, score: 0, lives: LIVES, level: 1, buildings: types.slice(0, BLOCKS.length), greenRoofs: [], invuln: 0, emitTimer: 0, flash: '', flashTime: 0, desired: null, emitters: [], smoke: [], events: [] });
      g.player = ent(SPAWN.x, SPAWN.y, 5.4);
      spawnEnemies();
      for (let i = 0; i < 3; i++) addEmitter();
    }
    reset();

    const aligned = e => Math.abs(e.x - Math.round(e.x)) < 1e-6 && Math.abs(e.y - Math.round(e.y)) < 1e-6;
    // Déplacement case par case ; onTile est appelé à chaque centre de case atteint (y compris en passant).
    function move(e, dt, decide, onTile) {
      let remaining = e.speed * dt;
      for (let guard = 0; guard < 8 && remaining > 1e-9; guard++) {
        if (aligned(e)) { e.x = Math.round(e.x); e.y = Math.round(e.y); decide(e); }
        if (!e.dir.dx && !e.dir.dy) return;
        if (e.dir.dx) e.face = e.dir.dx;
        const tx = e.dir.dx ? (e.dir.dx > 0 ? Math.floor(e.x + 1e-9) + 1 : Math.ceil(e.x - 1e-9) - 1) : e.x;
        const ty = e.dir.dy ? (e.dir.dy > 0 ? Math.floor(e.y + 1e-9) + 1 : Math.ceil(e.y - 1e-9) - 1) : e.y;
        const dist = Math.abs(tx - e.x) + Math.abs(ty - e.y);
        const step = Math.min(dist, remaining);
        e.x += e.dir.dx * step; e.y += e.dir.dy * step; remaining -= step; e.anim += step;
        if (step === dist) { e.x = tx; e.y = ty; if (onTile) onTile(tx, ty); }
      }
    }
    function decidePlayer(e) {
      const d = g.desired;
      if (d && walkable(e.x + d.dx, e.y + d.dy)) e.dir = { ...d };
      else if (!walkable(e.x + e.dir.dx, e.y + e.dir.dy)) e.dir = { dx: 0, dy: 0 };
    }
    // Engins : roulent dans les rues et ne tournent qu'aux carrefours ; foncent quand ils voient le
    // personnage dans leur rue ; sinon patrouillent (tout droit de préférence) ou se rapprochent.
    function decideVehicle(e, dist) {
      const p = g.player;
      const opts = Object.values(DIRS).filter(d => walkable(e.x + d.dx, e.y + d.dy));
      const forward = opts.filter(d => !(d.dx === -e.dir.dx && d.dy === -e.dir.dy));
      const pool = forward.length ? forward : opts;
      const seen = pool.find(d => inSight(e, p, d, e.type.sight));
      e.charging = !!seen;
      if (seen) { e.dir = { ...seen }; return; }
      const straight = pool.find(d => d.dx === e.dir.dx && d.dy === e.dir.dy);
      if (rng() < e.type.chase) { pool.sort((a, b) => dist[(e.y + a.dy) * W + e.x + a.dx] - dist[(e.y + b.dy) * W + e.x + b.dx]); e.dir = { ...pool[0] }; }
      else if (straight && rng() < 0.7) e.dir = { ...straight };
      else e.dir = { ...pool[Math.floor(rng() * pool.length)] };
    }
    function say(text, t = 1.6) { g.flash = text; g.flashTime = t; }

    function input(name) {
      const d = DIRS[name]; if (!d) return;
      g.desired = d;
      if (g.phase === 'ready') g.phase = 'play';
      const p = g.player;
      if (g.phase === 'play' && d.dx === -p.dir.dx && d.dy === -p.dir.dy && (d.dx || d.dy)) p.dir = { ...d }; // demi-tour immédiat
    }

    function deposit() {
      g.growth += g.carried; g.score += 10 * g.carried; g.events.push('drop');
      say(`+${g.carried} CO₂ capté${g.carried > 1 ? 's' : ''} : l’arbre pousse !`); g.carried = 0;
      if (g.growth >= TREE_FULL) {
        g.growth = 0; g.trees++; g.level++; g.score += 100; g.events.push('tree');
        const roofs = BLOCKS.map((b, i) => i).filter(i => !g.greenRoofs.includes(i));
        if (roofs.length) g.greenRoofs.push(roofs[Math.floor(rng() * roofs.length)]);
        say(`Arbre planté ! Niveau ${g.level} : ${vehicleCount()} engins de chantier`, 2.6);
        spawnEnemies();
      }
    }
    function collect(x, y) {
      for (let i = g.emitters.length - 1; i >= 0; i--) {
        const em = g.emitters[i];
        if (!besideBlock(BLOCKS[em.b], x, y)) continue;
        if (g.carried >= CARRY_MAX) { if (g.flash !== 'Sac plein : retourne à la base !' || g.flashTime <= 0) say('Sac plein : retourne à la base !'); return; }
        const take = Math.min(em.amount, CARRY_MAX - g.carried);
        g.carried += take; em.amount -= take; g.events.push('pick');
        if (em.amount <= 0) g.emitters.splice(i, 1);
      }
    }
    function onPlayerTile(x, y) {
      collect(x, y);
      if (g.carried && nearBase(x, y)) deposit();
    }

    function step(dt) {
      g.events = [];
      if (g.flashTime > 0) g.flashTime -= dt;
      g.smoke = g.smoke.filter(s => (s.age += dt) < 0.9);
      if (g.phase !== 'play') return g;
      g.time += dt;
      const p = g.player;
      move(p, dt, decidePlayer, onPlayerTile);
      if (aligned(p)) onPlayerTile(Math.round(p.x), Math.round(p.y));
      if (g.invuln > 0) g.invuln -= dt;
      // Émissions de CO₂ dans les bâtiments
      g.emitTimer += dt;
      if (g.emitters.length < emitMax() && g.emitTimer > Math.max(1.3, 3 - 0.2 * g.level)) { g.emitTimer = 0; addEmitter(); }
      // Engins de chantier
      const ptx = Math.max(1, Math.min(W - 2, Math.round(p.x))), pty = Math.max(1, Math.min(H - 2, Math.round(p.y)));
      const dist = bfs({ x: ptx, y: pty });
      for (const e of g.enemies) {
        if (e.wait > 0) { e.wait -= dt; continue; }
        e.speed = baseSpeed() * e.type.speed * (e.charging ? 1.45 : 1);
        move(e, dt, en => decideVehicle(en, dist));
        e.puff += dt;
        if (e.puff > 0.22) { e.puff = 0; if (g.smoke.length < 90) g.smoke.push({ x: e.x - e.face * 0.35, y: e.y - 0.25, age: 0 }); }
        if (g.invuln <= 0 && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) < 0.7) {
          g.lives--; g.events.push('hit');
          const lost = g.carried; g.carried = 0;
          if (g.lives <= 0) { g.phase = 'over'; say('Partie terminée', 99); return g; }
          say(`Percuté par un${e.type.kind === 'pelleteuse' || e.type.kind === 'toupie' ? 'e' : ''} ${e.type.name} !${lost ? ` ${lost} CO₂ perdu${lost > 1 ? 's' : ''}` : ''}`, 2);
          Object.assign(p, { x: SPAWN.x, y: SPAWN.y, dir: { dx: 0, dy: 0 } }); g.desired = null; g.invuln = 2;
          g.enemies.forEach((en, i) => Object.assign(en, { ...VEHICLE_SPAWNS[i], dir: { dx: 0, dy: 0 }, wait: 1 + i * 0.4, charging: false }));
          break;
        }
      }
      return g;
    }

    return { state: g, input, step, reset, treeStage: () => Math.min(5, Math.floor(g.growth / 3)) };
  }

  // ---------------------------------------------------------------------------
  // Dessin 8 bits
  // ---------------------------------------------------------------------------
  const PAL = { G: '#2fae5f', g: '#1d7a43', S: '#f2c39b', K: '#1e1e1e', W: '#cfe8f5', w: '#ffffff', B: '#2b4c7e', C: '#dfe6e3', D: '#a3b0ab', R: '#e8463a', Y: '#f2b705', y: '#ffd166', O: '#e07a1f', M: '#56606a', N: '#8a8f8c', P: '#2b6cb0', T: '#f2f2f2' };
  const PLAYER = [
    ['....GGGG....', '...GGGGGG...', '..gGGGGGGg..', '...SSSSSS...', '...SKSSKS...', '...SSSSSS...', '....wwww....', '..wwwwwwww..', '..Swwwwwws..', '....BBBB....', '...BB..BB...', '...KK..KK...'],
    ['....GGGG....', '...GGGGGG...', '..gGGGGGGg..', '...SSSSSS...', '...SKSSKS...', '...SSSSSS...', '....wwww....', '..wwwwwwww..', '..Swwwwwws..', '....BBBB....', '....BBBB....', '....KKKK....']
  ];
  // Engins dessinés vers la gauche (retournés quand ils roulent vers la droite).
  const VEHICLE_SPRITES = {
    bulldozer: ['.....YYYY.....', '.....YWWY.....', '.....YWWY.....', '..YYYYYYYYYY..', '.NYYYYYYYYYYY.', 'NNYYYYYYYYYYY.', 'N.KKKKKKKKKKK.', '..KNKNKNKNKNK.', '...KKKKKKKKK..'],
    camion: ['..............', '.OOO.NNNNNNNN.', 'OWWO.NNNNNNNN.', 'OOOO.NNNNNNNN.', 'OOOOOOOOOOOOOO', 'OOOOOOOOOOOOOO', '.KK.......KK..', '.KK.......KK..', '..............'],
    toupie: ['.......TOTO...', '.PPP..TOTOTOT.', 'PWWP.TOTOTOTOT', 'PPPP..TOTOTOT.', 'MMMMMMMMMMMMMM', 'MMMMMMMMMMMMMM', '.KK..KK...KK..', '.KK..KK...KK..', '..............'],
    pelleteuse: ['.K............', '.KY...........', '..Y.YYYY......', '...YYYWWYY....', '.....YWWYYYY..', '....YYYYYYYYY.', '....KKKKKKKKK.', '....KNKNKNKNK.', '.....KKKKKKK..']
  };

  function sprite(ctx, rows, x, y, pal, flipX) {
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[flipX ? row.length - 1 - i : i]; if (ch === '.') continue; ctx.fillStyle = pal[ch] || PAL[ch]; ctx.fillRect(x + i, y + j, 1, 1); } });
  }
  const rect = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  function windows(ctx, c, x, y, w, h, sx, sy, ww = 3, wh = 3) { for (let j = y; j + wh <= y + h; j += sy) for (let i = x; i + ww <= x + w; i += sx) rect(ctx, c, i, j, ww, wh); }
  function roofTri(ctx, c, x, y, w) { for (let i = 0; i < Math.ceil(w / 2); i++) rect(ctx, c, x + i, y - i / 2 | 0, w - 2 * i, 1); }

  // Îlot de 48 × 32 px : chaque type de bâtiment a sa silhouette.
  function drawBuilding(ctx, type, x, y, green) {
    const ground = green ? '#4f9a5a' : '#7d8a84';
    rect(ctx, ground, x, y, 48, 32);
    if (type === 'maison') {
      rect(ctx, '#4f9a5a', x, y, 48, 32);
      [[x + 3, '#f1e4c8'], [x + 26, '#efd9b4']].forEach(([hx, c]) => { rect(ctx, c, hx, y + 15, 19, 15); roofTri(ctx, '#c0503a', hx - 1, y + 14, 21); rect(ctx, '#7a4e2a', hx + 8, y + 23, 4, 7); rect(ctx, '#5f7d8c', hx + 2, y + 18, 4, 4); rect(ctx, '#5f7d8c', hx + 13, y + 18, 4, 4); });
    } else if (type === 'tour') {
      rect(ctx, '#7fb2c9', x + 5, y + 3, 15, 29); rect(ctx, '#5d93ad', x + 26, y + 9, 17, 23);
      for (let i = x + 7; i < x + 19; i += 3) rect(ctx, '#bfe0ee', i, y + 5, 1, 26);
      for (let j = y + 11; j < y + 31; j += 3) rect(ctx, '#a9cbe0', x + 27, j, 15, 1);
      rect(ctx, '#3d4a45', x + 12, y, 1, 3);
    } else if (type === 'bureau') {
      rect(ctx, '#4f7fa6', x + 2, y + 6, 44, 26); for (let j = y + 8; j < y + 30; j += 4) rect(ctx, '#a9cbe0', x + 3, j, 42, 2);
      rect(ctx, '#2c4a63', x + 2, y + 5, 44, 1); rect(ctx, '#1e2f3d', x + 21, y + 26, 6, 6);
    } else if (type === 'usine') {
      rect(ctx, '#9aa29d', x + 2, y + 15, 40, 17);
      for (let k = 0; k < 4; k++) for (let i = 0; i < 10; i++) rect(ctx, '#7b837e', x + 2 + k * 10 + i, y + 15 - Math.floor(i / 2), 1, Math.floor(i / 2) + 1);
      rect(ctx, '#b84a3a', x + 40, y + 2, 5, 30); rect(ctx, '#f2f2f2', x + 40, y + 8, 5, 2); rect(ctx, '#f2f2f2', x + 40, y + 16, 5, 2);
      windows(ctx, '#e0c060', x + 4, y + 20, 34, 8, 6, 8, 3, 4);
    } else if (type === 'ecole') {
      rect(ctx, '#c98a5a', x + 3, y + 11, 42, 21); rect(ctx, '#8a4d32', x + 2, y + 9, 44, 3);
      windows(ctx, '#f6efe0', x + 6, y + 15, 36, 12, 7, 7, 4, 4); rect(ctx, '#3d4a45', x + 23, y + 1, 1, 9); rect(ctx, '#2b6cb0', x + 24, y + 1, 3, 2); rect(ctx, '#f2f2f2', x + 24, y + 3, 3, 1); rect(ctx, '#e8463a', x + 24, y + 4, 3, 2);
    } else if (type === 'commerce') {
      rect(ctx, '#e8dcc4', x + 2, y + 8, 44, 24); for (let i = 0; i < 44; i += 4) rect(ctx, i % 8 ? '#f2f2f2' : '#e8463a', x + 2 + i, y + 14, 4, 4);
      rect(ctx, '#7fb2c9', x + 5, y + 19, 38, 10); rect(ctx, '#5c3d22', x + 21, y + 22, 6, 10); windows(ctx, '#5f7d8c', x + 6, y + 9, 36, 4, 7, 6, 4, 3);
    } else if (type === 'hopital') {
      rect(ctx, '#f6f6f2', x + 2, y + 4, 44, 28); windows(ctx, '#7fb2c9', x + 5, y + 7, 38, 22, 6, 6, 3, 3);
      rect(ctx, '#f6f6f2', x + 18, y + 9, 12, 12); rect(ctx, '#e8463a', x + 22, y + 10, 4, 10); rect(ctx, '#e8463a', x + 19, y + 13, 10, 4);
    } else { // logement collectif
      rect(ctx, '#e8dcc4', x + 2, y + 3, 44, 29); rect(ctx, '#b89f7a', x + 2, y + 2, 44, 2);
      windows(ctx, '#5f7d8c', x + 5, y + 6, 40, 24, 7, 7, 4, 4);
      for (let j = y + 11; j < y + 31; j += 7) rect(ctx, '#9c8a6b', x + 3, j, 42, 1);
    }
    if (green) { rect(ctx, '#3fa86a', x + 2, y, 44, 3); for (let i = 4; i < 46; i += 6) rect(ctx, '#7ed492', x + i, y, 2, 2); }
  }

  // Arbre du logo Prestaterre : tronc droit et houppier ovale cerné de vert foncé, qui grandit par étapes.
  function drawTree(ctx, stage, cx, groundY, t) {
    const u = 2;
    cx = Math.round(cx); groundY = Math.round(groundY);
    const trunkH = [1, 2, 3, 4, 4, 5][stage];
    ctx.fillStyle = '#06402b';
    ctx.fillRect(cx - u / 2, groundY - trunkH * u, u, trunkH * u);
    if (stage === 0) { ctx.fillStyle = '#7ed492'; ctx.fillRect(cx - u * 1.5, groundY - 3 * u, u, u); ctx.fillRect(cx + u / 2, groundY - 4 * u, u, u); ctx.fillStyle = '#5c3d22'; ctx.fillRect(cx - u * 2, groundY - u, u * 4, u); return; }
    const rx = [0, 1.5, 2.4, 3.2, 3.8, 4.3][stage], ry = [0, 1.8, 2.9, 3.9, 4.7, 5.4][stage];
    const top = groundY - trunkH * u - Math.ceil(ry) * 2 * u + u;
    const cy = top + Math.ceil(ry) * u;
    for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++) {
      if ((i * i) / (rx * rx) + (j * j) / (ry * ry) > 1) continue;
      const edge = (i * i) / ((rx - 1) * (rx - 1)) + (j * j) / ((ry - 1) * (ry - 1)) > 1;
      ctx.fillStyle = stage >= 3 ? (edge ? '#06402b' : '#a8e0b4') : '#3fa86a';
      ctx.fillRect(cx + i * u - u / 2, cy + j * u, u, u);
    }
    if (stage === 5 && Math.floor(t * 2) % 2) { ctx.fillStyle = PAL.y; ctx.fillRect(cx - u * 2 - u / 2, cy - u, u, u); ctx.fillRect(cx + u + u / 2, cy + u * 2, u, u); }
  }

  function draw(ctx, game, t) {
    const g = game.state;
    ctx.imageSmoothingEnabled = false;
    // Rues (marquage aux carrefours), bordure verte
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x * TILE, py = y * TILE;
      if (!inside(x, y)) { rect(ctx, '#06402b', px, py, TILE, TILE); rect(ctx, '#0b5a3d', px + 2, py + 2, 4, 4); rect(ctx, '#0b5a3d', px + 9, py + 9, 4, 4); continue; }
      if (!walkable(x, y)) continue;
      rect(ctx, '#3a4642', px, py, TILE, TILE);
      const hRoad = y % 3 === 1, vRoad = x % 4 === 1;
      if (hRoad && !vRoad) rect(ctx, '#c9c2a2', px + 3, py + 7, 6, 1);
      if (vRoad && !hRoad) rect(ctx, '#c9c2a2', px + 7, py + 3, 1, 6);
      if (hRoad && vRoad) { for (let i = 2; i < 14; i += 3) rect(ctx, '#6b7671', px + i, py + 1, 2, 1); }
    }
    // Bâtiments
    BLOCKS.forEach((b, i) => drawBuilding(ctx, g.buildings[i], b.x * TILE, b.y * TILE, g.greenRoofs.includes(i)));
    // Base + zone de dépôt
    const bx = BASE.x0 * TILE, by = BASE.y0 * TILE, bw = (BASE.x1 - BASE.x0 + 1) * TILE, bh = (BASE.y1 - BASE.y0 + 1) * TILE;
    rect(ctx, '#2f8a4c', bx, by, bw, bh);
    for (let i = 0; i < 9; i++) rect(ctx, '#3ea35d', bx + ((i * 17) % (bw - 2)), by + ((i * 11) % (bh - 4)), 2, 2);
    if (g.carried) {
      const on = Math.floor(t * 4) % 2;
      for (let y = BASE.y0 - 1; y <= BASE.y1 + 1; y++) for (let x = BASE.x0 - 1; x <= BASE.x1 + 1; x++) if (nearBase(x, y)) { ctx.strokeStyle = on ? '#ffd166' : '#9fdcac'; ctx.lineWidth = 1; ctx.strokeRect(x * TILE + 1.5, y * TILE + 1.5, TILE - 3, TILE - 3); }
    }
    ctx.strokeStyle = '#9fdcac'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    drawTree(ctx, game.treeStage(), bx + bw / 2, by + bh - 3, t);
    rect(ctx, '#06402b', bx + 3, by + bh - 3, bw - 6, 2);
    rect(ctx, PAL.y, bx + 3, by + bh - 3, Math.round((bw - 6) * g.growth / TREE_FULL), 2);
    // CO₂ qui s'échappe des bâtiments
    g.emitters.forEach((em, i) => {
      const b = BLOCKS[em.b], w = em.amount > 1 ? 30 : 22, cx = b.x * TILE + 24 - w / 2, cy = b.y * TILE + 3 + Math.round(Math.sin(t * 2.5 + i) * 1.5);
      rect(ctx, '#2d3a35', cx - 1, cy - 1, w + 2, 12); rect(ctx, em.amount > 1 ? '#d9dedc' : '#f4f6f5', cx, cy, w, 10);
      rect(ctx, '#2d3a35', cx - 1, cy - 1, 1, 1); rect(ctx, '#2d3a35', cx + w, cy - 1, 1, 1);
      ctx.fillStyle = '#1e2a25'; ctx.font = 'bold 8px monospace'; ctx.fillText(em.amount > 1 ? 'CO2x2' : 'CO2', cx + 3, cy + 8);
      const rise = (t * 6 + i * 3) % 7; rect(ctx, '#c7cdca', cx + w / 2 - 1, cy - 3 - Math.round(rise), 3, 3);
    });
    // Fumées d'échappement
    g.smoke.forEach(s => { ctx.globalAlpha = Math.max(0, 0.7 - s.age * 0.75); rect(ctx, '#4a4f4c', Math.round(s.x * TILE + 7), Math.round(s.y * TILE + 6 - s.age * 6), 3, 3); });
    ctx.globalAlpha = 1;
    // Engins de chantier (gyrophare quand ils foncent)
    g.enemies.forEach(e => {
      const x = Math.round(e.x * TILE + 1), y = Math.round(e.y * TILE + 4);
      sprite(ctx, VEHICLE_SPRITES[e.type.kind], x, y + (Math.floor(e.anim * 4) % 2), {}, e.face > 0);
      if (e.charging && Math.floor(t * 8) % 2) rect(ctx, '#ff9f1c', x + 6, y - 2, 2, 2);
    });
    // Personnage (clignote quand invulnérable) et CO₂ transporté
    const p = g.player;
    if (!(g.invuln > 0 && Math.floor(t * 10) % 2)) {
      sprite(ctx, PLAYER[Math.floor(p.anim * 3) % 2], Math.round(p.x * TILE + 2), Math.round(p.y * TILE + 2), {}, p.face < 0);
      for (let i = 0; i < g.carried; i++) rect(ctx, '#e3e8e6', Math.round(p.x * TILE + 2 + i * 4), Math.round(p.y * TILE - 2), 3, 3);
    }
  }

  // ---------------------------------------------------------------------------
  // Fenêtre de chargement
  // ---------------------------------------------------------------------------
  const BEST_KEY = 'newosb-game-best-v1';
  const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', z: 'up', w: 'up', s: 'down', q: 'left', a: 'left', d: 'right', Z: 'up', W: 'up', S: 'down', Q: 'left', A: 'left', D: 'right' };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ui = { el: null, canvas: null, ctx: null, game: null, raf: 0, last: 0, t: 0, visible: false, interacted: false, loaded: false, failed: false, paused: false, openTimer: 0, onEnter: null, session: 0, hudKey: '' };

  function best() { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } }
  function saveBest(v) { try { if (v > best()) localStorage.setItem(BEST_KEY, String(v)); } catch {} }

  function build() {
    if (ui.el) return;
    const el = document.createElement('div');
    el.id = 'obsGame'; el.className = 'obs-game'; el.hidden = true;
    el.innerHTML = `<div class="obs-game-card" role="dialog" aria-modal="true" aria-labelledby="obsGameTitle">
  <div class="obs-game-head"><div><span class="obs-game-kicker">CHARGEMENT DES DONNÉES</span><h2 id="obsGameTitle">Chargement…</h2></div>
    <div class="obs-game-progress"><div class="obs-game-bar"><i data-game-bar></i></div><span data-game-status role="status" aria-live="polite">Connexion…</span></div></div>
  <div class="obs-game-hud" data-game-hud aria-hidden="true"></div>
  <div class="obs-game-stage"><canvas width="${W * TILE}" height="${H * TILE}" aria-label="Mini-jeu Capte le CO₂ : ramasse les nuages de CO₂ et rapporte-les à la base pour faire pousser l’arbre" tabindex="0"></canvas>
    <div class="obs-game-msg" data-game-msg></div></div>
  <div class="obs-game-foot"><p><b>Capte le CO₂</b> · ← ↑ → ↓ pour te déplacer · longe les bâtiments qui rejettent du CO₂ pour le capter (3 max), puis passe devant la base pour faire pousser l’arbre · évite les engins de chantier · P : pause</p>
    <div class="obs-game-dpad" aria-hidden="true"><button type="button" data-game-dir="up">▲</button><button type="button" data-game-dir="left">◀</button><button type="button" data-game-dir="down">▼</button><button type="button" data-game-dir="right">▶</button></div>
    <div class="obs-game-actions"><button type="button" class="obs-game-hide" data-game-hide>Masquer le jeu</button><button type="button" class="obs-game-enter" data-game-enter disabled>Accéder à l’Observatoire</button></div></div>
</div>`;
    document.body.appendChild(el);
    ui.el = el; ui.canvas = el.querySelector('canvas'); ui.ctx = ui.canvas.getContext('2d');
    el.addEventListener('click', e => {
      if (e.target.closest('[data-game-enter]')) { enter(); return; }
      if (e.target.closest('[data-game-hide]')) { close(); return; }
      if (e.target === ui.canvas) { ui.canvas.focus(); }
    });
    el.addEventListener('pointerdown', e => { const b = e.target.closest('[data-game-dir]'); if (b) { e.preventDefault(); press(b.dataset.gameDir); } });
    let touch = null;
    ui.canvas.addEventListener('touchstart', e => { const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY }; }, { passive: true });
    ui.canvas.addEventListener('touchend', e => { if (!touch) return; const t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y; touch = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return; press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); }, { passive: true });
  }

  function press(dir) {
    if (!ui.game) return;
    const g = ui.game.state;
    if (g.phase === 'over') return;
    ui.interacted = true; ui.paused = false;
    ui.game.input(dir);
  }

  function onKey(e) {
    if (!ui.visible) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Enter' && ui.loaded) { e.preventDefault(); enter(); return; }
    const g = ui.game?.state;
    if ((e.key === ' ' || e.key === 'Enter') && g && g.phase === 'over') { e.preventDefault(); saveBest(g.score); ui.game.reset(); ui.interacted = true; return; }
    if ((e.key === 'p' || e.key === 'P') && g && g.phase === 'play') { e.preventDefault(); ui.paused = !ui.paused; return; }
    const dir = KEYMAP[e.key];
    if (dir) { e.preventDefault(); press(dir); }
  }

  function hud() {
    const g = ui.game.state;
    const key = [g.lives, g.carried, g.score, g.trees, g.level].join('|');
    if (key === ui.hudKey) return; ui.hudKey = key;
    const el = ui.el.querySelector('[data-game-hud]');
    el.innerHTML = `<span>${'♥'.repeat(Math.max(0, g.lives))}<s>${'♥'.repeat(Math.max(0, LIVES - g.lives))}</s></span><span>CO₂ ${g.carried}/${CARRY_MAX}</span><span>Score ${g.score}</span><span>Arbres ${g.trees}</span><span>Niveau ${g.level}</span><span>Record ${Math.max(best(), g.score)}</span>`;
  }

  function message() {
    const g = ui.game.state, el = ui.el.querySelector('[data-game-msg]');
    let text = '';
    if (ui.paused) text = 'Pause · P pour reprendre';
    else if (g.phase === 'ready') text = 'Appuie sur une flèche pour jouer';
    else if (g.phase === 'over') text = `Partie terminée · ${g.score} points · Espace pour rejouer`;
    else if (g.flashTime > 0) text = g.flash;
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('is-on', !!text);
  }

  function frame(now) {
    if (!ui.visible) return;
    const dt = Math.min(0.05, Math.max(0, (now - (ui.last || now)) / 1000)); ui.last = now; ui.t += dt;
    if (!ui.paused && !document.hidden) { ui.game.step(dt); if (ui.game.state.phase === 'over') saveBest(ui.game.state.score); }
    draw(ui.ctx, ui.game, ui.t);
    hud(); message();
    ui.raf = requestAnimationFrame(frame);
  }

  function show() {
    build();
    ui.openTimer = 0;
    if (ui.visible) return;
    ui.visible = true; ui.el.hidden = false; ui.last = 0;
    document.documentElement.classList.add('newosb-game-open');
    if (!ui.game) ui.game = createGame();
    ui.hudKey = '';
    try { ui.canvas.focus({ preventScroll: true }); } catch {}
    ui.raf = requestAnimationFrame(frame);
  }

  // Ouverture différée : un chargement très rapide n'affiche pas le jeu.
  function open(opts = {}) {
    build();
    ui.session++;
    ui.loaded = false; ui.failed = false; ui.onEnter = typeof opts.onEnter === 'function' ? opts.onEnter : null;
    ui.el.querySelector('#obsGameTitle').textContent = opts.title || 'Chargement des données';
    status(opts.status || 'Connexion à la source…', 0);
    const btn = ui.el.querySelector('[data-game-enter]'); btn.disabled = true; btn.textContent = 'Accéder à l’Observatoire';
    ui.el.classList.remove('is-loaded', 'is-failed');
    if (ui.visible) return ui.session;
    ui.interacted = false; // « a joué » est propre à chaque chargement
    clearTimeout(ui.openTimer);
    const delay = Number.isFinite(opts.delay) ? opts.delay : 500;
    ui.openTimer = setTimeout(show, delay);
    return ui.session;
  }

  function status(text, ratio) {
    if (!ui.el) return;
    ui.el.querySelector('[data-game-status]').textContent = text;
    if (Number.isFinite(ratio)) ui.el.querySelector('[data-game-bar]').style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
  }
  function progress(loaded, total, label) {
    if (!ui.el) return;
    const ratio = total ? loaded / total : 0;
    status(label || (total ? `${Number(loaded).toLocaleString('fr-FR')} / ${Number(total).toLocaleString('fr-FR')} lignes` : 'Chargement…'), ratio);
  }

  // Données prêtes : sans interaction, on rend la main tout de suite ; sinon, bandeau et bouton.
  function done(text) {
    if (!ui.el) return;
    clearTimeout(ui.openTimer); ui.openTimer = 0;
    ui.loaded = true;
    status(`✓ ${text || 'Données chargées'}`, 1);
    if (!ui.visible) { ui.onEnter = null; return; } // chargement rapide : le jeu ne s'est pas affiché
    if (!ui.interacted || ui.game?.state.phase === 'ready') { enter(); return; }
    ui.el.classList.add('is-loaded');
    const btn = ui.el.querySelector('[data-game-enter]'); btn.disabled = false; btn.textContent = 'Accéder à l’Observatoire ⏎';
  }
  function fail(text) {
    if (!ui.el) return;
    clearTimeout(ui.openTimer); ui.openTimer = 0;
    ui.failed = true; ui.loaded = true;
    if (!ui.visible) { ui.onEnter = null; return; }
    status(`Chargement interrompu : ${text || 'erreur'}`, 0);
    ui.el.classList.add('is-failed');
    const btn = ui.el.querySelector('[data-game-enter]'); btn.disabled = false; btn.textContent = 'Fermer';
  }

  function enter() {
    const cb = ui.loaded && !ui.failed ? ui.onEnter : null;
    ui.onEnter = null;
    close();
    if (cb) { try { cb(); } catch (e) { console.warn('NEWOSB jeu :', e); } }
  }
  function close() {
    clearTimeout(ui.openTimer); ui.openTimer = 0;
    if (ui.game) saveBest(ui.game.state.score);
    if (!ui.visible) return;
    ui.visible = false; ui.el.hidden = true; ui.paused = false;
    cancelAnimationFrame(ui.raf);
    document.documentElement.classList.remove('newosb-game-open');
  }

  window.addEventListener('keydown', onKey);
  window.NEWOSB_GAME = {
    open, progress, status, done, fail, close,
    isOpen: () => ui.visible,
    _state: () => (ui.game ? JSON.parse(JSON.stringify({ phase: ui.game.state.phase, player: ui.game.state.player, carried: ui.game.state.carried, interacted: ui.interacted, loaded: ui.loaded })) : null),
    // Accès de test : logique pure, sans affichage.
    _createGame: createGame, _draw: draw, _map: { W, H, TILE, BASE, SPAWN, walkable, isBase, nearBase, BLOCKS, besideBlock, bfs }, _rng: mulberry
  };
})();
