/*
 * Observatoire Prestaterre — V6.16 — mini-jeu pendant le chargement des données.
 *
 * « Capte le CO₂ » (8 bits) : le personnage ramasse les nuages de CO₂ émis par les bâtiments
 * (3 au maximum), les rapporte à la base pour faire pousser l'arbre du logo Prestaterre, et évite
 * les nuages de pollution qui le poursuivent. Un arbre adulte = un arbre planté, un niveau de plus.
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
  const ENEMY_SPAWNS = [{ x: 1, y: 1 }, { x: 21, y: 10 }, { x: 21, y: 1 }, { x: 1, y: 10 }];
  const CARRY_MAX = 3, TREE_FULL = 15, LIVES = 3, CO2_MAX = 5;
  const DIRS = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };

  const isBase = (x, y) => x >= BASE.x0 && x <= BASE.x1 && y >= BASE.y0 && y <= BASE.y1;
  const inside = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
  const walkable = (x, y) => inside(x, y) && !isBase(x, y) && (x % 4 === 1 || y % 3 === 1);
  const isBuilding = (x, y) => inside(x, y) && !walkable(x, y) && !isBase(x, y);
  const nearBase = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => isBase(x + a, y + b));

  // Emplacements de CO₂ : couloir le long d'un bâtiment, hors carrefours et hors abords de la base.
  const CO2_SPOTS = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!walkable(x, y) || nearBase(x, y)) continue;
    const cross = x % 4 === 1 && y % 3 === 1;
    const byBuilding = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => isBuilding(x + a, y + b));
    if (!cross && byBuilding && Math.abs(x - SPAWN.x) + Math.abs(y - SPAWN.y) > 3) CO2_SPOTS.push({ x, y });
  }

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

  function createGame(options = {}) {
    const rng = options.rng || Math.random;
    const g = {
      phase: 'ready', // ready → play → (dead) → over
      player: null, enemies: [], co2: [], carried: 0, growth: 0, trees: 0, score: 0, lives: LIVES, level: 1,
      greenRoofs: [], invuln: 0, co2Timer: 0, time: 0, flash: '', flashTime: 0, desired: null, events: []
    };
    const ent = (x, y, speed) => ({ x, y, dir: { dx: 0, dy: 0 }, speed, anim: 0 });
    const enemyCount = () => Math.min(ENEMY_SPAWNS.length, g.level);
    const enemySpeed = () => Math.min(5.2, 2.9 + 0.35 * (g.level - 1));
    function spawnEnemies() { g.enemies = ENEMY_SPAWNS.slice(0, enemyCount()).map((p, i) => ({ ...ent(p.x, p.y, enemySpeed()), kind: i % 3, wait: 1.2 + i * 0.8 })); }
    function addCo2() {
      const free = CO2_SPOTS.filter(s => !g.co2.some(c => c.x === s.x && c.y === s.y) && !(Math.round(g.player.x) === s.x && Math.round(g.player.y) === s.y));
      if (free.length) g.co2.push({ ...free[Math.floor(rng() * free.length)], born: g.time });
    }
    function reset() {
      Object.assign(g, { phase: 'ready', carried: 0, growth: 0, trees: 0, score: 0, lives: LIVES, level: 1, greenRoofs: [], invuln: 0, co2Timer: 0, flash: '', flashTime: 0, desired: null, co2: [], events: [] });
      g.player = ent(SPAWN.x, SPAWN.y, 5.4);
      spawnEnemies();
      for (let i = 0; i < 3; i++) addCo2();
    }
    reset();

    const aligned = e => Math.abs(e.x - Math.round(e.x)) < 1e-6 && Math.abs(e.y - Math.round(e.y)) < 1e-6;
    function move(e, dt, decide) {
      let remaining = e.speed * dt;
      for (let guard = 0; guard < 8 && remaining > 1e-9; guard++) {
        if (aligned(e)) { e.x = Math.round(e.x); e.y = Math.round(e.y); decide(e); }
        if (!e.dir.dx && !e.dir.dy) return;
        const tx = e.dir.dx ? (e.dir.dx > 0 ? Math.floor(e.x + 1e-9) + 1 : Math.ceil(e.x - 1e-9) - 1) : e.x;
        const ty = e.dir.dy ? (e.dir.dy > 0 ? Math.floor(e.y + 1e-9) + 1 : Math.ceil(e.y - 1e-9) - 1) : e.y;
        const dist = Math.abs(tx - e.x) + Math.abs(ty - e.y);
        const step = Math.min(dist, remaining);
        e.x += e.dir.dx * step; e.y += e.dir.dy * step; remaining -= step; e.anim += step;
        if (step === dist) { e.x = tx; e.y = ty; }
      }
    }
    function decidePlayer(e) {
      const d = g.desired;
      if (d && walkable(e.x + d.dx, e.y + d.dy)) e.dir = { ...d };
      else if (!walkable(e.x + e.dir.dx, e.y + e.dir.dy)) e.dir = { dx: 0, dy: 0 };
    }
    function decideEnemy(e, dist) {
      const opts = Object.values(DIRS).filter(d => walkable(e.x + d.dx, e.y + d.dy));
      const forward = opts.filter(d => !(d.dx === -e.dir.dx && d.dy === -e.dir.dy));
      const pool = forward.length ? forward : opts;
      const chase = Math.min(0.88, 0.55 + 0.08 * (g.level - 1));
      if (rng() < chase) { pool.sort((a, b) => dist[(e.y + a.dy) * W + e.x + a.dx] - dist[(e.y + b.dy) * W + e.x + b.dx]); e.dir = { ...pool[0] }; }
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

    function step(dt) {
      g.events = [];
      if (g.flashTime > 0) g.flashTime -= dt;
      if (g.phase !== 'play') return g;
      g.time += dt;
      const p = g.player;
      move(p, dt, decidePlayer);
      if (g.invuln > 0) g.invuln -= dt;
      const ptx = Math.round(p.x), pty = Math.round(p.y);
      // Ramassage
      for (let i = g.co2.length - 1; i >= 0; i--) {
        const c = g.co2[i];
        if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) < 0.55) {
          if (g.carried < CARRY_MAX) { g.co2.splice(i, 1); g.carried++; g.events.push('pick'); }
          else if (!g.flashTime || g.flash !== 'Sac plein : retour à la base !') say('Sac plein : retour à la base !');
        }
      }
      // Dépôt à la base
      if (g.carried && aligned(p) && nearBase(ptx, pty)) {
        g.growth += g.carried; g.score += 10 * g.carried; g.events.push('drop');
        say(`+${g.carried} CO₂ capté${g.carried > 1 ? 's' : ''}`); g.carried = 0;
        if (g.growth >= TREE_FULL) {
          g.growth = 0; g.trees++; g.level++; g.score += 100; g.events.push('tree');
          const roofs = [];
          for (let by = 2; by < H - 1; by += 3) for (let bx = 2; bx < W - 1; bx += 4) if (!isBase(bx, by) && !g.greenRoofs.some(r => r.x === bx && r.y === by)) roofs.push({ x: bx, y: by });
          if (roofs.length) g.greenRoofs.push(roofs[Math.floor(rng() * roofs.length)]);
          say(`Arbre planté ! Niveau ${g.level}`, 2.4);
          spawnEnemies();
        }
      }
      // Apparition du CO₂
      g.co2Timer += dt;
      if (g.co2.length < CO2_MAX && g.co2Timer > Math.max(1.2, 2.6 - 0.2 * g.level)) { g.co2Timer = 0; addCo2(); }
      // Pollueurs
      const dist = bfs({ x: Math.max(1, Math.min(W - 2, ptx)), y: Math.max(1, Math.min(H - 2, pty)) });
      for (const e of g.enemies) {
        if (e.wait > 0) { e.wait -= dt; continue; }
        e.speed = enemySpeed();
        move(e, dt, en => decideEnemy(en, dist));
        if (g.invuln <= 0 && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) < 0.7) {
          g.lives--; g.events.push('hit');
          const lost = g.carried; g.carried = 0;
          for (let i = 0; i < lost; i++) addCo2();
          if (g.lives <= 0) { g.phase = 'over'; say('Partie terminée', 99); return g; }
          say(lost ? `Touché ! ${lost} CO₂ relâché${lost > 1 ? 's' : ''}` : 'Touché !');
          Object.assign(p, { x: SPAWN.x, y: SPAWN.y, dir: { dx: 0, dy: 0 } }); g.desired = null; g.invuln = 2;
          g.enemies.forEach((en, i) => Object.assign(en, { ...ENEMY_SPAWNS[i], dir: { dx: 0, dy: 0 }, wait: 1 + i * 0.5 }));
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
  const PAL = { G: '#2fae5f', g: '#1d7a43', S: '#f2c39b', K: '#14231d', W: '#ffffff', B: '#2b4c7e', C: '#dfe6e3', D: '#a3b0ab', R: '#e8463a', Y: '#ffd166' };
  const PLAYER = [
    ['....GGGG....', '...GGGGGG...', '..gGGGGGGg..', '...SSSSSS...', '...SKSSKS...', '...SSSSSS...', '....WWWW....', '..WWWWWWWW..', '..SWWWWWWS..', '....BBBB....', '...BB..BB...', '...KK..KK...'],
    ['....GGGG....', '...GGGGGG...', '..gGGGGGGg..', '...SSSSSS...', '...SKSSKS...', '...SSSSSS...', '....WWWW....', '..WWWWWWWW..', '..SWWWWWWS..', '....BBBB....', '....BBBB....', '....KKKK....']
  ];
  const SMOG = [
    ['....PPPP....', '..PPPPPPPP..', '.PPPPPPPPPP.', '.PPWWPPWWPP.', '.PPWRPPWRPP.', 'PPPPPPPPPPPP', 'PPPPPPPPPPPP', 'PPPPPPPPPPPP', 'PPPPPPPPPPPP', 'PP.PPP.PPP.P'],
    ['....PPPP....', '..PPPPPPPP..', '.PPPPPPPPPP.', '.PPWWPPWWPP.', '.PPRWPPRWPP.', 'PPPPPPPPPPPP', 'PPPPPPPPPPPP', 'PPPPPPPPPPPP', 'PPPPPPPPPPPP', 'P.PPP.PPP.PP']
  ];
  const SMOG_COLORS = ['#5f5866', '#7a4e3a', '#4b4f6e', '#6b6b3a'];
  const CLOUD = ['...CCC....', '.CCCCCC.C.', 'CCCDCCCCCC', 'CCCCCCDCCC', '.CCCCCCCC.'];

  function sprite(ctx, rows, x, y, pal, flipX) {
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[flipX ? row.length - 1 - i : i]; if (ch === '.') continue; ctx.fillStyle = pal[ch] || PAL[ch]; ctx.fillRect(x + i, y + j, 1, 1); } });
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
    if (stage === 5 && Math.floor(t * 2) % 2) { ctx.fillStyle = PAL.Y; ctx.fillRect(cx - u * 2 - u / 2, cy - u, u, u); ctx.fillRect(cx + u + u / 2, cy + u * 2, u, u); }
  }

  function draw(ctx, game, t) {
    const g = game.state;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0e2a21'; ctx.fillRect(0, 0, W * TILE, H * TILE);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x * TILE, py = y * TILE;
      if (!inside(x, y)) { ctx.fillStyle = '#06402b'; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = '#0b5a3d'; ctx.fillRect(px + 2, py + 2, 4, 4); ctx.fillRect(px + 9, py + 9, 4, 4); continue; }
      if (walkable(x, y)) { ctx.fillStyle = (x + y) % 2 ? '#123629' : '#10322a'; ctx.fillRect(px, py, TILE, TILE); continue; }
      if (isBase(x, y)) { ctx.fillStyle = '#2f8a4c'; ctx.fillRect(px, py, TILE, TILE); ctx.fillStyle = '#3ea35d'; ctx.fillRect(px + ((x * 5) % 11), py + ((y * 7) % 13), 2, 2); continue; }
      // Bâtiment : façade, fenêtres, toit (végétalisé après un arbre planté)
      const bx = x - ((x - 2) % 4), by = y - ((y - 2) % 3);
      const green = g.greenRoofs.some(r => r.x === bx && r.y === by);
      ctx.fillStyle = green ? '#cfe8d3' : '#c9d1cc'; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = green ? '#4f8f62' : '#5f7d8c';
      for (let wy = 3; wy < TILE - 2; wy += 6) for (let wx = 3; wx < TILE - 2; wx += 6) ctx.fillRect(px + wx, py + wy, 3, 3);
      if (y === by) { ctx.fillStyle = green ? '#3fa86a' : '#8a958f'; ctx.fillRect(px, py, TILE, 3); }
    }
    // Base + arbre
    ctx.strokeStyle = '#9fdcac'; ctx.lineWidth = 1; ctx.strokeRect(BASE.x0 * TILE + 0.5, BASE.y0 * TILE + 0.5, (BASE.x1 - BASE.x0 + 1) * TILE - 1, (BASE.y1 - BASE.y0 + 1) * TILE - 1);
    drawTree(ctx, game.treeStage(), (BASE.x0 + 1.5) * TILE, (BASE.y1 + 1) * TILE - 3, t);
    // Jauge de croissance sous l'arbre
    ctx.fillStyle = '#06402b'; ctx.fillRect(BASE.x0 * TILE + 3, (BASE.y1 + 1) * TILE - 3, (BASE.x1 - BASE.x0 + 1) * TILE - 6, 2);
    ctx.fillStyle = PAL.Y; ctx.fillRect(BASE.x0 * TILE + 3, (BASE.y1 + 1) * TILE - 3, Math.round(((BASE.x1 - BASE.x0 + 1) * TILE - 6) * g.growth / TREE_FULL), 2);
    // CO₂ (avec fumée sur le bâtiment voisin)
    g.co2.forEach((c, i) => {
      const bob = Math.round(Math.sin(t * 3 + i) * 1);
      sprite(ctx, CLOUD, c.x * TILE + 3, c.y * TILE + 5 + bob, {});
      ctx.fillStyle = '#3d4a45'; ctx.font = '5px monospace'; ctx.fillText('CO2', c.x * TILE + 4, c.y * TILE + 9 + bob);
    });
    // Pollueurs
    g.enemies.forEach((e, i) => sprite(ctx, SMOG[Math.floor(t * 4 + i) % 2], Math.round(e.x * TILE + 2), Math.round(e.y * TILE + 3), { P: SMOG_COLORS[e.kind % SMOG_COLORS.length] }, e.dir.dx < 0));
    // Personnage (clignote quand invulnérable) et CO₂ transporté
    const p = g.player;
    if (!(g.invuln > 0 && Math.floor(t * 10) % 2)) {
      sprite(ctx, PLAYER[Math.floor(p.anim * 3) % 2], Math.round(p.x * TILE + 2), Math.round(p.y * TILE + 2), {}, p.dir.dx < 0);
      for (let i = 0; i < g.carried; i++) { ctx.fillStyle = PAL.C; ctx.fillRect(Math.round(p.x * TILE + 3 + i * 4), Math.round(p.y * TILE - 1), 3, 3); }
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
  <div class="obs-game-foot"><p><b>Capte le CO₂</b> · ← ↑ → ↓ pour te déplacer · ramasse le CO₂ des bâtiments (3 max) et rapporte-le à la base pour faire pousser l’arbre · évite les nuages de pollution · P : pause</p>
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
    _createGame: createGame, _draw: draw, _map: { W, H, TILE, BASE, SPAWN, walkable, isBase, CO2_SPOTS, bfs }, _rng: mulberry
  };
})();
