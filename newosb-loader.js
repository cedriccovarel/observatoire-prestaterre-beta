/*
 * Observatoire Prestaterre — V6.33 — écran de chargement des données.
 *
 * Un chantier de rénovation en cinq étapes avance avec le chargement réel : diagnostic thermique,
 * isolation de la façade, menuiseries, énergie (panneaux solaires, pompe à chaleur), végétalisation.
 * Le CO₂ qui s'échappe du bâtiment est capté et remplit la barre de chargement.
 * Une seule progression couvre toutes les phases du chargement (OPERATIONS puis RAPPORT) : la barre
 * n'atteint 100 % qu'à la fin de la dernière phase et ne recule jamais.
 * Aucune donnée n'est lue ni transmise par cet écran. Il se ferme seul à la fin du chargement.
 */
(() => {
  'use strict';

  const W = 640, H = 300, GROUND = 222;
  const C = {
    green: '#06402b', green2: '#16864f', leaf: '#5aa86f', leaf2: '#3f8f5a',
    stoneDirty: [150, 138, 122], render: [238, 232, 216], roofDirty: [92, 84, 78], roofClean: [74, 92, 84],
    winDirty: [86, 92, 96], winClean: [140, 192, 214], co2: '#8b9490', carbon: '#2d3633'
  };
  const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  const clamp = v => Math.max(0, Math.min(1, v));
  const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

  // Étapes du chantier, réparties sur l'avancement global (0 → 1).
  const STAGES = [
    { label: 'Diagnostic thermique', from: 0, to: 0.18 },
    { label: 'Isolation de la façade', from: 0.18, to: 0.4 },
    { label: 'Menuiseries', from: 0.4, to: 0.6 },
    { label: 'Énergie renouvelable', from: 0.6, to: 0.8 },
    { label: 'Végétalisation', from: 0.8, to: 1 }
  ];
  const stageK = (r, i) => clamp((r - STAGES[i].from) / (STAGES[i].to - STAGES[i].from));
  const stageIndex = r => { for (let i = STAGES.length - 1; i >= 0; i--) if (r >= STAGES[i].from) return i; return 0; };

  const B = { x: 34, y: 92, w: 190, h: GROUND - 92 }; // bâtiment
  const BAR = { x: 318, y: 240, w: 300, h: 24 };
  const INTAKE = { x: BAR.x - 22, y: BAR.y - 26 };   // capteur de CO₂ relié à la barre

  const ui = {
    el: null, canvas: null, ctx: null, raf: 0, last: 0, t: 0, visible: false, openTimer: 0, closeTimer: 0,
    target: 0, shown: 0, known: false, onEnter: null, failed: false, loaded: false,
    phases: null, phaseKey: '', puffs: [], flow: [], spawn: 0, sparks: [], tech: { x: 280, dir: -1 }, birds: [],
    truck: null, delivered: {}, dust: []
  };

  function build() {
    if (ui.el) return;
    const el = document.createElement('div');
    el.id = 'obsLoader'; el.className = 'obs-loader'; el.hidden = true;
    el.innerHTML = `<div class="obs-loader-card" role="dialog" aria-modal="true" aria-labelledby="obsLoaderTitle" aria-describedby="obsLoaderStatus">
  <div class="obs-loader-head"><span class="obs-loader-kicker">OBSERVATOIRE PRESTATERRE</span><h2 id="obsLoaderTitle">Chargement des données</h2></div>
  <canvas width="${W}" height="${H}" aria-hidden="true"></canvas>
  <div class="obs-loader-phases" data-loader-phases hidden></div>
  <div class="obs-loader-foot"><span class="obs-loader-status" id="obsLoaderStatus" data-loader-status role="status" aria-live="polite">Connexion à la source…</span><span class="obs-loader-pct" data-loader-pct>0 %</span></div>
  <div class="obs-loader-actions"><button type="button" class="obs-loader-hide" data-loader-hide>Continuer en arrière-plan</button><button type="button" class="obs-loader-close" data-loader-close hidden>Fermer</button></div>
</div>`;
    document.body.appendChild(el);
    ui.el = el; ui.canvas = el.querySelector('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ui.canvas.width = W * dpr; ui.canvas.height = H * dpr;
    ui.ctx = ui.canvas.getContext('2d'); ui.ctx.scale(dpr, dpr);
    el.addEventListener('click', e => { if (e.target.closest('[data-loader-hide],[data-loader-close]')) close(); });
  }

  // --------------------------------------------------------------- dessin
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  // V6.31 (photoréalisme) : textures procédurales générées une seule fois (grain d'enduit, gazon, ciel de
  // vitrage), puis réutilisées comme motifs. Aucune image ni ressource externe.
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const TEX = {};
  function texture(name, w, h, paint) {
    if (TEX[name] !== undefined) return TEX[name];
    try {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      paint(g, w, h); TEX[name] = ui.ctx.createPattern(c, 'repeat');
    } catch { TEX[name] = null; }
    return TEX[name];
  }
  // grain fin (enduit, pierre, trottoir) : pixels clairs et sombres semi-transparents
  const grain = () => texture('grain', 96, 96, (g, w, h) => {
    const rnd = rng(7), img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = rnd(), light = v > 0.5; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = light ? 255 : 0; img.data[i * 4 + 3] = Math.round(Math.abs(v - 0.5) * 2 * 34); }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.04})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, 2 + rnd() * 6, 0, Math.PI * 2); g.fill(); }
  });
  // gazon : brins de longueur et de teinte variées, ombrés à la base
  const lawn = () => texture('lawn', 120, 40, (g, w, h) => {
    const rnd = rng(11); g.fillStyle = '#4f8f57'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const x = rnd() * w, y = rnd() * h, l = 2 + rnd() * 4, tone = rnd(); g.strokeStyle = `rgb(${Math.round(60 + tone * 70)},${Math.round(120 + tone * 70)},${Math.round(62 + tone * 40)})`; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 2, y - l); g.stroke(); }
  });
  // V6.30 (réalisme) : fumée de CO₂ diffuse (volutes à bords flous qui s'étalent puis se dissipent en
  // étant aspirées), au lieu de nuages pleins.
  function smoke(ctx, x, y, s, age, seed) {
    const grow = 1 + Math.min(1, age / 1.6) * 0.5, fade = clamp(Math.min(age / 0.25, 1)) * 0.78;
    for (let i = 0; i < 4; i++) {
      const a = seed * 1.7 + i * 1.9 + age * 0.8, rad = (8 + (i % 2) * 4) * s * grow;
      const cx = x + 10 * s + Math.cos(a) * 7 * s, cy = y + Math.sin(a) * 4 * s;
      const g = ctx.createRadialGradient(cx, cy, rad * 0.15, cx, cy, rad);
      g.addColorStop(0, `rgba(96,104,101,${0.55 * fade})`); g.addColorStop(0.6, `rgba(120,128,125,${0.28 * fade})`); g.addColorStop(1, 'rgba(140,148,145,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    }
  }
  // V6.30 (réalisme) : nuage volumineux, éclairé par le haut, base plus sombre.
  function softCloud(ctx, x, y, s, k) {
    const blobs = [[0, 0, 13], [14, -7, 16], [30, -2, 13], [44, 2, 10], [20, 5, 14]];
    blobs.forEach(([dx, dy, rad]) => {
      const cx = x + dx * s, cy = y + dy * s, rr2 = rad * s, g = ctx.createRadialGradient(cx - rr2 * 0.3, cy - rr2 * 0.5, rr2 * 0.1, cx, cy, rr2);
      g.addColorStop(0, `rgba(255,255,255,${0.75 + 0.2 * k})`); g.addColorStop(0.7, mix([214, 214, 210], [240, 244, 247], k)); g.addColorStop(1, 'rgba(225,228,230,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, Math.PI * 2); ctx.fill();
    });
  }
  const SUN = { x: 560, y: 54 };
  // Ciel en trois tons (zénith → horizon), soleil voilé par la pollution au début puis net, brume qui se dissipe.
  function sky(ctx, r, t) {
    const k = ease(r);
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, mix([170, 176, 180], [104, 166, 212], k)); g.addColorStop(0.55, mix([204, 203, 196], [176, 212, 234], k)); g.addColorStop(1, mix([226, 220, 206], [228, 240, 238], k));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
    // soleil et halo (intensité croissante)
    const sunK = 0.25 + 0.75 * k, halo = ctx.createRadialGradient(SUN.x, SUN.y, 4, SUN.x, SUN.y, 90);
    halo.addColorStop(0, `rgba(255,244,214,${0.55 * sunK})`); halo.addColorStop(0.35, `rgba(255,236,190,${0.18 * sunK})`); halo.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = halo; ctx.fillRect(SUN.x - 90, SUN.y - 90, 180, 180);
    ctx.fillStyle = `rgba(255,${Math.round(236 + 14 * k)},${Math.round(200 + 30 * k)},${0.45 + 0.55 * k})`; ctx.beginPath(); ctx.arc(SUN.x, SUN.y, 13, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const x = ((i * 190 + t * (5 + i * 2)) % (W + 160)) - 80, y = 26 + i * 15;
      softCloud(ctx, x, y, 0.9 + (i % 2) * 0.35, k);
    }
    // brume de pollution sur l'horizon, dissipée par le chantier
    const smog = 0.42 * (1 - k);
    if (smog > 0.01) { const h = ctx.createLinearGradient(0, GROUND - 90, 0, GROUND); h.addColorStop(0, 'rgba(176,160,132,0)'); h.addColorStop(1, `rgba(176,160,132,${smog})`); ctx.fillStyle = h; ctx.fillRect(0, GROUND - 90, W, 90); }
  }
  // Silhouette de ville lointaine, estompée par la perspective atmosphérique.
  const SKYLINE = [[0, 22], [26, 34], [48, 18], [70, 40], [92, 28], [118, 46], [140, 24], [166, 36], [196, 20], [228, 30], [252, 50], [274, 26], [300, 38], [330, 22], [356, 44], [380, 30], [404, 24], [430, 52], [452, 34], [480, 26], [506, 40], [530, 22], [556, 32], [584, 46], [608, 28], [634, 20]];
  const SKYLINE2 = [[0, 30, 1], [40, 58, 0], [64, 44, 1], [98, 70, 0], [128, 52, 1], [170, 40, 0], [214, 62, 1], [250, 48, 0], [292, 74, 1], [330, 56, 0], [368, 46, 1], [404, 66, 0], [446, 50, 1], [488, 78, 0], [522, 54, 1], [566, 42, 0], [600, 64, 1]];
  // Deux plans de ville : le plus lointain très estompé, le plus proche avec des fenêtres ; la brume
  // (perspective atmosphérique) se lève avec le chantier.
  function backdrop(ctx, r) {
    const k = ease(r);
    ctx.fillStyle = `rgba(${Math.round(150 + 30 * k)},${Math.round(160 + 34 * k)},${Math.round(168 + 40 * k)},${0.42 - 0.1 * k})`;
    ctx.beginPath(); ctx.moveTo(0, GROUND);
    SKYLINE.forEach(([x, h], i) => { const nx = (SKYLINE[i + 1] || [W + 20])[0]; ctx.lineTo(x, GROUND - h); ctx.lineTo(nx - 3, GROUND - h); ctx.lineTo(nx - 3, GROUND - h * 0.6); });
    ctx.lineTo(W, GROUND); ctx.closePath(); ctx.fill();
    // plan intermédiaire : immeubles plus nets, face éclairée et face à l'ombre, fenêtres
    SKYLINE2.forEach(([x, h, lit], i) => {
      const nx = (SKYLINE2[i + 1] || [W + 30])[0], w = Math.min(34, nx - x - 6), top = GROUND - h * 0.62;
      if (x + w < B.x + B.w + 20 && x > B.x - 30) return; // masqué par le bâtiment : inutile de le dessiner
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, `rgba(${Math.round(132 + 40 * k)},${Math.round(140 + 44 * k)},${Math.round(146 + 50 * k)},.55)`); g.addColorStop(1, `rgba(${Math.round(160 + 40 * k)},${Math.round(166 + 44 * k)},${Math.round(170 + 46 * k)},.55)`);
      ctx.fillStyle = g; ctx.fillRect(x, top, w, GROUND - top);
      ctx.fillStyle = `rgba(255,255,255,${0.14 + 0.1 * k})`;
      for (let yy = top + 5; yy < GROUND - 6; yy += 7) for (let xx = x + 4; xx < x + w - 4; xx += 6) if (((xx * 7 + yy * 3 + lit) % 5) > 1) ctx.fillRect(xx, yy, 2.4, 3);
    });
    const haze = ctx.createLinearGradient(0, GROUND - 80, 0, GROUND);
    haze.addColorStop(0, 'rgba(230,236,238,0)'); haze.addColorStop(1, `rgba(${Math.round(222 + 10 * k)},${Math.round(220 + 16 * k)},${Math.round(208 + 26 * k)},${0.5 - 0.2 * k})`);
    ctx.fillStyle = haze; ctx.fillRect(0, GROUND - 80, W, 80);
  }
  // Sol : trottoir (joints, bordure) puis terre / pelouse ; ombre portée du bâtiment (soleil en haut à droite).
  function ground(ctx, r, t) {
    const k = ease(r);
    const g = ctx.createLinearGradient(0, GROUND, 0, H);
    g.addColorStop(0, mix([196, 192, 180], [196, 226, 204], k)); g.addColorStop(1, mix([170, 166, 152], [150, 196, 160], k));
    ctx.fillStyle = g; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = mix([206, 204, 198], [222, 224, 220], k); ctx.fillRect(0, GROUND, W, 9);
    ctx.strokeStyle = 'rgba(120,120,112,.28)'; ctx.lineWidth = 0.7; ctx.beginPath();
    for (let x = 6; x < W; x += 22) { ctx.moveTo(x, GROUND); ctx.lineTo(x - 3, GROUND + 9); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,118,108,.35)'; ctx.fillRect(0, GROUND + 9, W, 1.5);
    // V6.31 : grain du trottoir et de la terre, gazon texturé qui s'étend à la végétalisation
    const gp = grain(); if (gp) { ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = gp; ctx.fillRect(0, GROUND, W, H - GROUND); ctx.restore(); }
    const lp = lawn(), lawnK = ease(stageK(r, 4) * 1.2);
    if (lp && lawnK > 0) {
      ctx.save(); ctx.globalAlpha = lawnK; ctx.fillStyle = lp; ctx.translate(0, GROUND + 11); ctx.fillRect(0, 0, W, H - GROUND - 11);
      const fade = ctx.createLinearGradient(0, 0, 0, H - GROUND - 11); fade.addColorStop(0, 'rgba(255,255,240,.18)'); fade.addColorStop(1, 'rgba(20,50,30,.18)'); ctx.fillStyle = fade; ctx.fillRect(0, 0, W, H - GROUND - 11);
      ctx.restore();
    }
    const sh = 0.10 + 0.10 * k;
    ctx.save(); try { ctx.filter = 'blur(2.5px)'; } catch {} ctx.fillStyle = `rgba(30,40,36,${sh + 0.06})`; ctx.beginPath(); ctx.moveTo(B.x + B.w + 14, GROUND); ctx.lineTo(B.x + B.w - 22, GROUND + 15); ctx.lineTo(B.x - 34, GROUND + 15); ctx.lineTo(B.x, GROUND); ctx.closePath(); ctx.fill(); ctx.restore();
    const grass = ease(stageK(r, 4));
    if (grass > 0) {
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 64; i++) { const x = 4 + i * 10 + (i % 3) * 2; if (x > W - 4) break; const h = (4 + (i % 4) * 1.6) * grass, sway = Math.sin(t * 2 + i) * 1.1; ctx.strokeStyle = i % 2 ? C.leaf : C.leaf2; ctx.beginPath(); ctx.moveTo(x, GROUND + 11); ctx.lineTo(x + sway, GROUND + 11 - h); ctx.stroke(); }
    }
  }

  // Arbre : tronc effilé, branches, feuillage en touffes ombrées, ombre au sol.
  function tree(ctx, x, s, t) {
    if (s <= 0) return;
    const h = 46 * s, sway = Math.sin(t * 1.3 + x) * 1.5 * s, base = GROUND + 4;
    ctx.fillStyle = 'rgba(30,40,36,.14)'; ctx.beginPath(); ctx.ellipse(x - 10 * s, base + 2, 22 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6e4f34'; ctx.beginPath(); ctx.moveTo(x - 3.2 * s, base); ctx.lineTo(x - 1.4 * s, base - h); ctx.lineTo(x + 1.4 * s, base - h); ctx.lineTo(x + 3.2 * s, base); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6e4f34'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(x, base - h * 0.6); ctx.lineTo(x - 9 * s, base - h * 0.85); ctx.moveTo(x, base - h * 0.7); ctx.lineTo(x + 8 * s, base - h * 0.95); ctx.stroke();
    const clusters = [[-9, -4, 12], [9, -6, 12], [0, -14, 15], [-4, 2, 11], [6, 1, 10]];
    clusters.forEach(([dx, dy, rad]) => {
      const cx = x + (dx + sway) * s, cy = base - h + dy * s, rr2 = rad * s, g = ctx.createRadialGradient(cx + rr2 * 0.35, cy - rr2 * 0.4, rr2 * 0.1, cx, cy, rr2);
      g.addColorStop(0, '#8cc98f'); g.addColorStop(0.55, C.leaf); g.addColorStop(1, '#2f6e44');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, Math.PI * 2); ctx.fill();
    });
  }

  function windowsPos() { const out = []; for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) out.push({ x: B.x + 20 + i * 42, y: B.y + 16 + j * 38, j }); return out; }
  const WINDOWS = windowsPos();

  const DEPTH = { x: 14, y: -8 }; // profondeur du mur latéral (perspective)
  function building(ctx, r, t) {
    const s0 = stageK(r, 0), s1 = stageK(r, 1), s2 = stageK(r, 2), s3 = stageK(r, 3), s4 = stageK(r, 4);
    const R = B.x + B.w, base = GROUND;
    // mur latéral en perspective (éclairé par le soleil à droite), puis façade
    const sideDirty = [178, 166, 148], sideClean = [248, 244, 232], ins = ease(s1);
    ctx.fillStyle = mix(sideDirty, sideClean, ins); ctx.beginPath(); ctx.moveTo(R, B.y); ctx.lineTo(R + DEPTH.x, B.y + DEPTH.y); ctx.lineTo(R + DEPTH.x, base + DEPTH.y); ctx.lineTo(R, base); ctx.closePath(); ctx.fill();
    ctx.fillStyle = mix(C.stoneDirty, [176, 166, 150], s0 * 0.3); ctx.fillRect(B.x, B.y, B.w, B.h);
    // joints de pierre de la façade d'origine (s'effacent sous l'isolant)
    if (ins < 1) {
      ctx.strokeStyle = `rgba(92,82,70,${0.22 * (1 - ins)})`; ctx.lineWidth = 0.6; ctx.beginPath();
      for (let y = B.y + 6, row = 0; y < base; y += 6, row++) { ctx.moveTo(B.x, y); ctx.lineTo(R, y); for (let x = B.x + (row % 2 ? 7 : 0); x < R; x += 14) { ctx.moveTo(x, y - 6); ctx.lineTo(x, y); } }
      ctx.stroke();
    }
    // isolation par l'extérieur : bandes posées de bas en haut (enduit clair, léger relief)
    for (let j = 0; j < 3; j++) {
      const k = ease(s1 * 3 - (2 - j)); if (k <= 0) continue;
      const y = B.y + j * (B.h / 3), w = B.w * k;
      const g = ctx.createLinearGradient(0, y, 0, y + B.h / 3); g.addColorStop(0, mix(C.render, [250, 247, 238], s4)); g.addColorStop(1, mix([226, 219, 202], [238, 233, 220], s4));
      ctx.fillStyle = g; ctx.fillRect(B.x, y, w, B.h / 3 + 0.5);
      if (k < 1) { ctx.fillStyle = 'rgba(120,136,128,.55)'; ctx.fillRect(B.x + w - 2, y, 2, B.h / 3); ctx.fillStyle = '#e4ecd8'; ctx.fillRect(B.x + w, y + 3, 6, B.h / 3 - 6); }
    }
    // bandeaux d'étage
    ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let j = 1; j < 3; j++) ctx.fillRect(B.x, B.y + j * (B.h / 3) - 1, B.w, 2);
    ctx.fillStyle = 'rgba(0,0,0,.06)'; for (let j = 1; j < 3; j++) ctx.fillRect(B.x, B.y + j * (B.h / 3) + 1, B.w, 1.5);
    // V6.31 : matière de la façade (grain de l'enduit ou de la pierre) et lumière rasante du soleil
    const fp = grain(); if (fp) { ctx.save(); ctx.globalAlpha = 0.5 - 0.3 * ins; ctx.fillStyle = fp; ctx.fillRect(B.x, B.y, B.w, B.h); ctx.beginPath(); ctx.moveTo(R, B.y); ctx.lineTo(R + DEPTH.x, B.y + DEPTH.y); ctx.lineTo(R + DEPTH.x, base + DEPTH.y); ctx.lineTo(R, base); ctx.closePath(); ctx.fill(); ctx.restore(); }
    const lightK = 0.3 + 0.7 * ease(r), lg = ctx.createLinearGradient(B.x, B.y, R, base);
    lg.addColorStop(0, `rgba(40,36,30,${0.12})`); lg.addColorStop(0.6, 'rgba(255,250,235,0)'); lg.addColorStop(1, `rgba(255,236,200,${0.16 * lightK})`);
    ctx.fillStyle = lg; ctx.fillRect(B.x, B.y, B.w, B.h);
    // salissures / fissures tant que la façade n'est pas isolée
    if (s1 < 1) {
      ctx.globalAlpha = 0.5 * (1 - s1); ctx.strokeStyle = '#5d5248'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(B.x + 26, base); ctx.lineTo(B.x + 34, base - 22); ctx.lineTo(B.x + 30, base - 40); ctx.moveTo(B.x + 160, B.y + 30); ctx.lineTo(B.x + 168, B.y + 52); ctx.lineTo(B.x + 162, B.y + 70); ctx.stroke();
      const g = ctx.createLinearGradient(0, base - 22, 0, base); g.addColorStop(0, 'rgba(90,80,70,0)'); g.addColorStop(1, 'rgba(90,80,70,.9)');
      ctx.fillStyle = g; ctx.fillRect(B.x, base - 22, B.w, 22); ctx.globalAlpha = 1;
    }
    // occlusion ambiante au pied de la façade
    const ao = ctx.createLinearGradient(0, base - 12, 0, base); ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,.14)');
    ctx.fillStyle = ao; ctx.fillRect(B.x, base - 12, B.w, 12);
    // toiture : pan avant + pan latéral, rangs de tuiles, ombre de l'avant-toit
    const roofC = mix(C.roofDirty, C.roofClean, s3), ridge = { x: B.x + B.w / 2, y: B.y - 44 };
    ctx.fillStyle = mix([70, 64, 60], [58, 74, 68], s3); ctx.beginPath(); ctx.moveTo(ridge.x, ridge.y); ctx.lineTo(ridge.x + DEPTH.x, ridge.y + DEPTH.y); ctx.lineTo(R + 10 + DEPTH.x, B.y + DEPTH.y); ctx.lineTo(R + 10, B.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = roofC; ctx.beginPath(); ctx.moveTo(B.x - 10, B.y); ctx.lineTo(ridge.x, ridge.y); ctx.lineTo(R + 10, B.y); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.moveTo(B.x - 10, B.y); ctx.lineTo(ridge.x, ridge.y); ctx.lineTo(R + 10, B.y); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 0.8; ctx.beginPath(); for (let y = B.y - 4; y > ridge.y; y -= 5) { ctx.moveTo(B.x - 10, y); ctx.lineTo(R + 10, y); } ctx.stroke();
    const rg = ctx.createLinearGradient(B.x, 0, R, 0); rg.addColorStop(0, 'rgba(0,0,0,.12)'); rg.addColorStop(1, 'rgba(255,255,255,.10)'); ctx.fillStyle = rg; ctx.fillRect(B.x - 10, ridge.y, B.w + 20, B.y - ridge.y);
    ctx.restore();
    const eave = ctx.createLinearGradient(0, B.y, 0, B.y + 9); eave.addColorStop(0, 'rgba(0,0,0,.22)'); eave.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = eave; ctx.fillRect(B.x, B.y, B.w, 9);
    ctx.fillStyle = mix([96, 90, 84], [120, 128, 124], s3); ctx.fillRect(B.x - 11, B.y - 1, B.w + 22, 2.5); // gouttière
    // cheminée (fermée à l'étape « énergie »), face éclairée + face à l'ombre
    ctx.fillStyle = mix([120, 104, 92], [150, 150, 146], s3); ctx.fillRect(B.x + 140, B.y - 46, 14, 26);
    ctx.fillStyle = mix([150, 132, 116], [176, 176, 172], s3); ctx.fillRect(B.x + 154, B.y - 46, 4, 24);
    ctx.fillStyle = '#5d5550'; ctx.fillRect(B.x + 138, B.y - 49, 20, 3);
    if (s3 > 0.4) { ctx.fillStyle = '#7d8a85'; ctx.fillRect(B.x + 137, B.y - 52, 22, 4); }
    // panneaux solaires sur le pan gauche (cellules, cadre alu, reflet du ciel)
    for (let i = 0; i < 4; i++) {
      const k = ease(s3 * 5 - i); if (k <= 0) continue;
      const u0 = 0.12 + i * 0.2, u1 = u0 + 0.17, lx = u => B.x - 6 + u * (B.w / 2 + 6), ly = u => B.y - 4 - u * 38, off = (1 - k) * -16;
      ctx.globalAlpha = k;
      const g = ctx.createLinearGradient(lx(u0), ly(u1), lx(u1), ly(u0) + 8); g.addColorStop(0, '#1c3a52'); g.addColorStop(0.6, '#2d5878'); g.addColorStop(1, '#6f9bbb');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lx(u0), ly(u0) - 2 + off); ctx.lineTo(lx(u1), ly(u1) - 2 + off); ctx.lineTo(lx(u1), ly(u1) + 8 + off); ctx.lineTo(lx(u0), ly(u0) + 8 + off); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#c9d3d8'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.strokeStyle = 'rgba(200,220,235,.35)'; ctx.lineWidth = 0.5; ctx.beginPath(); const um = (u0 + u1) / 2; ctx.moveTo(lx(um), ly(um) - 2 + off); ctx.lineTo(lx(um), ly(um) + 8 + off); ctx.stroke();
      const shine = (t * 0.35 + i * 0.25) % 1; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(lx(u0 + (u1 - u0) * shine), ly(u0 + (u1 - u0) * shine) - 1 + off); ctx.lineTo(lx(u0 + (u1 - u0) * shine), ly(u0 + (u1 - u0) * shine) + 7 + off); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // toiture végétalisée (pan droit) : substrat + sedums en touffes
    if (s4 > 0) {
      ctx.globalAlpha = ease(s4 * 1.5);
      const g = ctx.createLinearGradient(0, B.y - 40, 0, B.y); g.addColorStop(0, '#6fb27a'); g.addColorStop(1, '#4e9460');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ridge.x + 4, B.y - 40); ctx.lineTo(R + 6, B.y - 2); ctx.lineTo(R - 4, B.y - 2); ctx.lineTo(ridge.x + 4, B.y - 32); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 9; i++) { const u = (i + 0.5) / 9, px = ridge.x + 6 + u * (B.w / 2), py = B.y - 40 + u * 38; ctx.fillStyle = i % 2 ? '#8cc98f' : '#3f8f5a'; ctx.beginPath(); ctx.arc(px, py - 3, 2.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // fenêtres : tableau en retrait, appui, vitrage qui reflète le ciel ; remplacées une à une
    WINDOWS.forEach((w, i) => {
      const k = clamp(s2 * 12 - i);
      ctx.fillStyle = 'rgba(40,36,32,.35)'; ctx.fillRect(w.x - 1, w.y - 1, 24, 26);
      const g = ctx.createLinearGradient(0, w.y, 0, w.y + 24);
      g.addColorStop(0, mix([110, 116, 118], [196, 224, 238], k)); g.addColorStop(1, mix(C.winDirty, [118, 168, 196], k));
      ctx.fillStyle = g; ctx.fillRect(w.x + 1, w.y + 1, 20, 22);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(w.x + 1, w.y + 1, 20, 2); ctx.fillRect(w.x + 1, w.y + 1, 2, 22);
      ctx.fillStyle = mix([70, 64, 58], [250, 250, 248], k); ctx.fillRect(w.x + 10, w.y + 1, 2, 22); ctx.fillRect(w.x + 1, w.y + 11, 20, 2);
      ctx.strokeStyle = mix([70, 64, 58], [250, 250, 248], k); ctx.lineWidth = 1.2; ctx.strokeRect(w.x + 1, w.y + 1, 20, 22);
      if (k > 0.5) { ctx.strokeStyle = `rgba(255,255,255,${0.35 * k})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(w.x + 3, w.y + 9); ctx.lineTo(w.x + 8, w.y + 3); ctx.moveTo(w.x + 13, w.y + 20); ctx.lineTo(w.x + 19, w.y + 14); ctx.stroke(); }
      // V6.31 : reflet d'un nuage qui glisse sur le vitrage, intérieur plus sombre en bas (profondeur)
      if (k > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(w.x + 1, w.y + 1, 20, 22); ctx.clip();
        const cx = w.x + ((t * 6 + i * 13) % 44) - 12, cg = ctx.createRadialGradient(cx, w.y + 7, 1, cx, w.y + 7, 10);
        cg.addColorStop(0, `rgba(255,255,255,${0.45 * k})`); cg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = cg; ctx.fillRect(w.x, w.y, 22, 24);
        const dg2 = ctx.createLinearGradient(0, w.y + 12, 0, w.y + 24); dg2.addColorStop(0, 'rgba(20,30,40,0)'); dg2.addColorStop(1, `rgba(20,30,40,${0.28 * k})`); ctx.fillStyle = dg2; ctx.fillRect(w.x, w.y + 12, 22, 12);
        ctx.restore();
      }
      ctx.fillStyle = mix([150, 140, 126], [236, 232, 222], ins); ctx.fillRect(w.x - 3, w.y + 24, 28, 3); // appui
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(w.x - 2, w.y + 27, 26, 2);
      if (k > 0 && k < 1 && !w.flashed) { w.flashed = true; burst(w.x + 11, w.y + 12, '#ffffff'); }
      if (k === 0) w.flashed = false;
    });
    // porte : encadrement, panneau, poignée
    const dx = B.x + B.w / 2 - 12;
    ctx.fillStyle = 'rgba(40,36,32,.35)'; ctx.fillRect(dx - 2, base - 36, 28, 36);
    const dg = ctx.createLinearGradient(dx, 0, dx + 24, 0); dg.addColorStop(0, mix([86, 64, 48], [6, 64, 43], s2)); dg.addColorStop(1, mix([108, 82, 62], [22, 96, 66], s2));
    ctx.fillStyle = dg; ctx.fillRect(dx, base - 34, 24, 34);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(dx + 4, base - 30, 16, 12);
    ctx.fillStyle = '#d8c9a0'; ctx.fillRect(dx + 18, base - 18, 3, 2);
    // diagnostic : fuites de chaleur (caméra thermique) qui disparaissent avec l'isolation
    const heat = (0.35 + 0.65 * ease(s0 * 2)) * (1 - ease(s1 * 1.3));
    if (heat > 0.02) {
      const spots = [[B.x + 40, B.y + 30], [B.x + 120, B.y + 66], [B.x + 75, B.y + 104], [B.x + 160, B.y + 22], [B.x + B.w / 2, B.y - 18]];
      spots.forEach(([x, y], i) => {
        const pulse = 0.75 + 0.25 * Math.sin(t * 3 + i * 1.7), rad = 26 * pulse;
        const g = ctx.createRadialGradient(x, y, 2, x, y, rad);
        g.addColorStop(0, `rgba(232,72,48,${0.5 * heat})`); g.addColorStop(0.5, `rgba(250,160,60,${0.26 * heat})`); g.addColorStop(1, 'rgba(250,200,80,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      });
    }
    // échafaudage : montants, lisses, diagonales, planchers bois, filet de protection
    const scaffold = Math.min(ease(s1 * 2.5), 1 - ease(s4 * 1.6));
    if (scaffold > 0.01) {
      const top = B.y + B.h - (B.h + 6) * scaffold, x0 = B.x - 8, x1 = R + 8;
      ctx.save(); ctx.beginPath(); ctx.rect(x0 - 6, top, x1 - x0 + 12, base - top + 1); ctx.clip();
      ctx.fillStyle = 'rgba(40,120,80,.07)'; ctx.fillRect(x0, top, x1 - x0, base - top);
      ctx.strokeStyle = '#8c9696'; ctx.lineWidth = 1.6;
      for (let x = x0; x <= x1 + 0.5; x += 49.5) { ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, top); ctx.stroke(); }
      ctx.lineWidth = 0.9; ctx.beginPath();
      for (let x = x0; x < x1 - 1; x += 49.5) for (let j = 0; j < 3; j++) { const y1 = base - j * (B.h / 3), y2 = y1 - B.h / 3; ctx.moveTo(x, y1); ctx.lineTo(x + 49.5, y2); }
      ctx.stroke();
      for (let j = 0; j < 4; j++) {
        const y = base - j * (B.h / 3); if (y < top) break;
        ctx.fillStyle = '#b07a3a'; ctx.fillRect(x0 - 3, y - 3, x1 - x0 + 6, 3); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x0 - 3, y, x1 - x0 + 6, 1);
        ctx.strokeStyle = '#8c9696'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 - 3, y - 12); ctx.lineTo(x1 + 3, y - 12); ctx.stroke(); // garde-corps
      }
      ctx.restore();
    }
    // pompe à chaleur : caisson avec face latérale, grille, ventilateur
    const pac = ease(s3 * 2 - 0.6);
    if (pac > 0) {
      const px = R + 6, h = 26 * pac, py = base - h;
      ctx.fillStyle = 'rgba(30,40,36,.16)'; ctx.beginPath(); ctx.ellipse(px + 12, base + 2, 22, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#cfd8d4'; ctx.beginPath(); ctx.moveTo(px + 34, py); ctx.lineTo(px + 40, py - 4); ctx.lineTo(px + 40, base - 4); ctx.lineTo(px + 34, base); ctx.closePath(); ctx.fill();
      const pg = ctx.createLinearGradient(0, py, 0, base); pg.addColorStop(0, '#f4f7f6'); pg.addColorStop(1, '#dce3e0');
      ctx.fillStyle = pg; rr(ctx, px, py, 34, h, 3); ctx.fill(); ctx.strokeStyle = '#9aa8a3'; ctx.lineWidth = 1; rr(ctx, px, py, 34, h, 3); ctx.stroke();
      if (pac > 0.9) {
        ctx.strokeStyle = '#b5c0bc'; ctx.beginPath(); ctx.arc(px + 17, py + 13, 9.5, 0, Math.PI * 2); ctx.stroke();
        ctx.save(); ctx.translate(px + 17, py + 13); ctx.rotate(t * 9);
        ctx.fillStyle = '#7d8a85'; for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.ellipse(5, 0, 5, 2.2, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
    }
  }

  // Petites étincelles (fenêtre posée, panneau installé).
  function burst(x, y, color) { if (reduced()) return; for (let i = 0; i < 7; i++) { const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 40; ui.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, age: 0, color }); } }

  // V6.27 : grue de chantier. Elle se monte avec l'isolation, livre le matériau de l'étape en cours
  // (panneau isolant, fenêtre, panneau solaire) au-dessus du bâtiment, puis est démontée à la végétalisation.
  function crane(ctx, r, t) {
    const show = Math.min(ease(stageK(r, 1) * 3), 1 - ease(stageK(r, 4) * 1.8));
    if (show <= 0.01) return;
    const mx = 352, top = 46, rise = ease(stageK(r, 1) * 4), mastTop = GROUND - (GROUND - top) * rise;
    ctx.save(); ctx.globalAlpha = show;
    // V6.33 : lest béton au pied, membrures en relief (arête sombre + reflet), moufle sur le câble
    const cb = ctx.createLinearGradient(0, GROUND - 9, 0, GROUND); cb.addColorStop(0, '#c9ccc7'); cb.addColorStop(1, '#8f938e');
    ctx.fillStyle = cb; ctx.fillRect(mx - 14, GROUND - 9, 28, 9); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(mx - 14, GROUND - 5, 28, 0.8); ctx.fillRect(mx - 0.4, GROUND - 9, 0.8, 9);
    ctx.lineCap = 'round';
    [['#8a6a12', 3.6], ['#e9b52c', 2.2]].forEach(([c, w]) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(mx - 5, GROUND - 9); ctx.lineTo(mx - 5, mastTop); ctx.moveTo(mx + 5, GROUND - 9); ctx.lineTo(mx + 5, mastTop); ctx.stroke(); });
    ctx.strokeStyle = 'rgba(255,240,190,.55)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(mx + 4.4, GROUND - 9); ctx.lineTo(mx + 4.4, mastTop); ctx.stroke();
    ctx.lineCap = 'butt'; ctx.strokeStyle = '#d9a520';
    ctx.lineWidth = 1; ctx.beginPath();
    for (let y = GROUND; y > mastTop + 8; y -= 12) { ctx.moveTo(mx - 5, y); ctx.lineTo(mx + 5, y - 12); }
    ctx.stroke();
    if (rise > 0.98) {
      // flèche, contre-flèche, lest, cabine
      const jx0 = 200, jx1 = mx + 62;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(jx0, top); ctx.lineTo(jx1, top); ctx.moveTo(jx0 + 20, top + 7); ctx.lineTo(mx, top + 7); ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); for (let x = jx0 + 20; x < mx; x += 14) { ctx.moveTo(x, top + 7); ctx.lineTo(x + 7, top); ctx.lineTo(x + 14, top + 7); } ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, top - 16); ctx.lineTo(jx0 + 20, top); ctx.moveTo(mx, top - 16); ctx.lineTo(jx1 - 6, top); ctx.stroke();
      const cw = ctx.createLinearGradient(0, top + 1, 0, top + 13); cw.addColorStop(0, '#b9bdb8'); cw.addColorStop(1, '#7e837f');
      ctx.fillStyle = cw; ctx.fillRect(jx1 - 16, top + 1, 16, 12); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(jx1 - 16, top + 5, 16, 0.7); ctx.fillRect(jx1 - 16, top + 9, 16, 0.7);
      ctx.fillStyle = '#d9a520'; ctx.fillRect(mx - 8, top + 7, 16, 12); ctx.fillStyle = '#cfe7f2'; ctx.fillRect(mx - 5, top + 10, 8, 6);
      // chariot + câble + charge : va-et-vient lent au-dessus du bâtiment
      const k = 0.5 + 0.5 * Math.sin(t * 0.55), tx = 214 + k * 112, drop = 46 + 26 * (0.5 + 0.5 * Math.sin(t * 0.9 + 1)), sway = Math.sin(t * 1.7) * 2.5;
      ctx.fillStyle = '#3c4a45'; ctx.fillRect(tx - 5, top + 1, 10, 6);
      ctx.strokeStyle = '#3c4a45'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx, top + 7); ctx.lineTo(tx + sway, top + drop); ctx.stroke();
      const i = stageIndex(r), lx = tx + sway, ly = top + drop;
      ctx.fillStyle = '#f2c94c'; rr(ctx, lx - 3.5, ly - 7, 7, 5, 1); ctx.fill(); ctx.fillStyle = '#3c4a45'; ctx.fillRect(lx - 0.6, ly - 2, 1.2, 2);
      if (i === 1) { ctx.fillStyle = '#efe6cf'; ctx.fillRect(lx - 16, ly, 32, 12); ctx.strokeStyle = '#c9b98f'; ctx.strokeRect(lx - 16, ly, 32, 12); }
      else if (i === 2) { ctx.fillStyle = '#8cc0d6'; ctx.fillRect(lx - 9, ly, 18, 20); ctx.fillStyle = '#fff'; ctx.fillRect(lx - 1, ly, 2, 20); ctx.fillRect(lx - 9, ly + 9, 18, 2); }
      else if (i === 3) { ctx.fillStyle = '#284b63'; ctx.fillRect(lx - 15, ly, 30, 10); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(lx - 5, ly); ctx.lineTo(lx - 5, ly + 10); ctx.moveTo(lx + 5, ly); ctx.lineTo(lx + 5, ly + 10); ctx.stroke(); }
      else { ctx.strokeStyle = '#3c4a45'; ctx.beginPath(); ctx.arc(lx, ly + 3, 3, 0, Math.PI); ctx.stroke(); }
      // feu clignotant en bout de flèche
      if (Math.sin(t * 4) > 0) { ctx.fillStyle = '#e8483a'; ctx.beginPath(); ctx.arc(jx0, top - 2, 2.2, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  // V6.28 : clôture de chantier (grillage translucide) et panneau « Rénovation en cours », posés avec
  // l'échafaudage puis retirés pendant la végétalisation.
  function fence(ctx, r) {
    const show = Math.min(ease(stageK(r, 1) * 3), 1 - ease(stageK(r, 4) * 2));
    if (show <= 0.01) return;
    const x0 = B.x - 22, x1 = B.x + B.w + 6, h = 15, y = GROUND - h;
    ctx.save(); ctx.globalAlpha = show;
    ctx.fillStyle = 'rgba(214,226,220,.32)'; ctx.fillRect(x0, y, x1 - x0, h);
    ctx.strokeStyle = 'rgba(96,112,106,.55)'; ctx.lineWidth = 0.6; ctx.beginPath();
    for (let x = x0; x <= x1; x += 5) { ctx.moveTo(x, y); ctx.lineTo(x, GROUND); }
    for (let yy = y; yy <= GROUND; yy += 5) { ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); }
    ctx.stroke();
    ctx.fillStyle = '#7d8a85'; for (let x = x0; x <= x1; x += 40) ctx.fillRect(x - 1, y - 2, 2, h + 2);
    ctx.fillStyle = '#e8eeeb'; for (let x = x0; x <= x1; x += 40) ctx.fillRect(x - 5, GROUND - 2, 10, 2);
    // panneau de chantier
    const px = B.x - 18, py = y - 25;
    ctx.fillStyle = '#ffffff'; rr(ctx, px, py, 72, 21, 3); ctx.fill(); ctx.strokeStyle = C.green; ctx.lineWidth = 1.2; rr(ctx, px, py, 72, 21, 3); ctx.stroke();
    ctx.fillStyle = '#f2c94c'; ctx.fillRect(px + 3, py + 3, 4, 15);
    ctx.fillStyle = C.green; ctx.font = '800 6.4px Inter, system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('RÉNOVATION', px + 11, py + 9); ctx.fillText('EN COURS', px + 11, py + 16.5);
    ctx.fillStyle = '#7d8a85'; ctx.fillRect(px + 34, py + 21, 2, 4);
    ctx.restore();
  }

  // V6.29 : palette de matériaux au pied de la grue (isolant, fenêtres, panneaux solaires) qui se vide à
  // mesure que l'étape avance.
  function pallet(ctx, r) {
    const i = stageIndex(r); if (i < 1 || i > 4) return;
    // V6.33 : la palette n'apparaît qu'une fois livrée par le camion (sauf animations réduites).
    if (!reduced() && !ui.delivered[i]) return;
    const k = stageK(r, i), left = Math.max(0, Math.ceil((1 - k) * 5)), x = 372, y = GROUND;
    const fade = Math.min(1, (1 - k) * 8 + 0.15);
    ctx.save(); ctx.globalAlpha = Math.max(0.15, fade);
    ctx.fillStyle = 'rgba(25,35,30,.22)'; ctx.beginPath(); ctx.ellipse(x + 16, y + 1, 26, 3, 0, 0, Math.PI * 2); ctx.fill();
    const wood = ctx.createLinearGradient(0, y - 6, 0, y); wood.addColorStop(0, '#d2ad74'); wood.addColorStop(1, '#9a7442');
    ctx.fillStyle = wood; ctx.fillRect(x, y - 6, 40, 3); ctx.fillRect(x + 1, y - 2, 6, 2); ctx.fillRect(x + 17, y - 2, 6, 2); ctx.fillRect(x + 33, y - 2, 6, 2);
    ctx.fillStyle = 'rgba(70,50,25,.35)'; ctx.fillRect(x, y - 3, 40, 1); for (let px = x + 8; px < x + 40; px += 8) ctx.fillRect(px, y - 6, 0.7, 3);
    for (let n = 0; n < left; n++) {
      const hh = i === 2 ? 7 : (i === 4 ? 6 : 5), yy = y - 6 - (n + 1) * hh;
      cargoLayer(ctx, i, x + 20, yy, n);
    }
    if (left > 0 && i !== 2) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x + 12, y - 6); ctx.lineTo(x + 12, y - 6 - left * (i === 4 ? 6 : 5)); ctx.moveTo(x + 28, y - 6); ctx.lineTo(x + 28, y - 6 - left * (i === 4 ? 6 : 5)); ctx.stroke(); }
    ctx.restore();
  }
  // Une couche de matériau (centrée en cx, sommet en y) : isolant, fenêtre, panneau solaire, bac de sedum.
  function cargoLayer(ctx, i, cx, y, n) {
    if (i === 1) { const g = ctx.createLinearGradient(0, y, 0, y + 5); g.addColorStop(0, '#f6efd9'); g.addColorStop(1, '#d9caa0'); ctx.fillStyle = g; ctx.fillRect(cx - 19, y, 38, 5); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(cx - 19, y, 38, 1); ctx.fillStyle = 'rgba(120,100,60,.25)'; ctx.fillRect(cx - 19, y + 4, 38, 1); }
    else if (i === 2) { ctx.fillStyle = '#f4f6f5'; ctx.fillRect(cx - 16, y, 32, 7); const g = ctx.createLinearGradient(cx - 16, y, cx + 16, y + 7); g.addColorStop(0, '#9cc9dc'); g.addColorStop(0.5, '#d9eef6'); g.addColorStop(1, '#6fa6c0'); ctx.fillStyle = g; ctx.fillRect(cx - 14, y + 1, 13, 5); ctx.fillRect(cx + 1, y + 1, 13, 5); }
    else if (i === 3) { const g = ctx.createLinearGradient(cx - 19, y, cx + 19, y + 4); g.addColorStop(0, '#1c3a52'); g.addColorStop(0.6, '#2f5f82'); g.addColorStop(1, '#5d8fb2'); ctx.fillStyle = g; ctx.fillRect(cx - 19, y, 38, 4); ctx.fillStyle = '#cfd8dd'; ctx.fillRect(cx - 19, y, 38, 0.8); ctx.fillRect(cx - 19, y, 0.8, 4); ctx.fillRect(cx + 18.2, y, 0.8, 4); }
    else { ctx.fillStyle = '#3d3a36'; ctx.fillRect(cx - 18, y + 2, 36, 4); for (let k = 0; k < 9; k++) { ctx.fillStyle = (k + n) % 2 ? '#79b86e' : '#4f9a58'; ctx.beginPath(); ctx.arc(cx - 16 + k * 4, y + 2, 2.2, 0, Math.PI * 2); ctx.fill(); } }
  }
  function cargoHeight(i) { return i === 2 ? 21 : (i === 4 ? 18 : 15); }
  // Charge complète du camion (3 couches), sommet en topY.
  function cargo(ctx, i, cx, topY) {
    const hh = i === 2 ? 7 : (i === 4 ? 6 : 5);
    for (let n = 0; n < 3; n++) cargoLayer(ctx, i, cx, topY + n * hh, n);
    if (i !== 2) { ctx.strokeStyle = 'rgba(40,40,40,.45)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(cx - 8, topY); ctx.lineTo(cx - 8, topY + 3 * hh); ctx.moveTo(cx + 8, topY); ctx.lineTo(cx + 8, topY + 3 * hh); ctx.stroke(); }
  }

  // V6.33 : camion plateau de livraison avec bras de grue auxiliaire. À chaque étape (isolation,
  // menuiseries, énergie, végétalisation), il arrive, se gare, dépose le matériau de l'étape sur la palette
  // avec son bras, puis repart. Animation sur l'horloge (pas sur la progression) : elle reste fluide même
  // si les données arrivent par à-coups. Animations réduites : camion garé, sans mouvement.
  const TRUCK = { stop: 420, len: 122, arrive: 2.4, unfold: 3.0, lift: 4.6, fold: 5.2, leave: 7.8 };
  function updateTruck(r, dt, still) {
    const i = stageIndex(r);
    if (still) return;
    const tr = ui.truck;
    if (tr) { tr.time += dt; if (tr.time >= TRUCK.lift) ui.delivered[tr.stage] = true; if (tr.time >= TRUCK.leave) ui.truck = null; return; }
    if (i >= 1 && i <= 4 && !ui.delivered[i] && stageK(r, i) < 0.9) ui.truck = { stage: i, time: 0, dist: 0, puff: 0 };
    else if (i >= 1 && i <= 4 && !ui.delivered[i]) ui.delivered[i] = true; // étape trop rapide : pas de livraison
  }
  function ik(px, py, l1, l2, tx, ty) {
    let dx = tx - px, dy = ty - py, d = Math.hypot(dx, dy);
    d = Math.max(Math.abs(l1 - l2) + 0.5, Math.min(l1 + l2 - 0.5, d));
    const a = Math.atan2(dy, dx), b = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    const e1 = { x: px + Math.cos(a - b) * l1, y: py + Math.sin(a - b) * l1 }, e2 = { x: px + Math.cos(a + b) * l1, y: py + Math.sin(a + b) * l1 };
    const e = e1.y < e2.y ? e1 : e2, a2 = Math.atan2(ty - e.y, tx - e.x);
    return { e, tip: { x: e.x + Math.cos(a2) * l2, y: e.y + Math.sin(a2) * l2 } };
  }
  function wheel(ctx, cx, cy, rad, ang) {
    const g = ctx.createRadialGradient(cx - 1, cy - 1, 1, cx, cy, rad); g.addColorStop(0, '#3a3d3c'); g.addColorStop(0.75, '#232524'); g.addColorStop(1, '#141615');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    const rim = ctx.createRadialGradient(cx - 1, cy - 1, 0.5, cx, cy, rad * 0.55); rim.addColorStop(0, '#f2f4f3'); rim.addColorStop(1, '#8e9592');
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, rad * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5d6461'; for (let k = 0; k < 5; k++) { const a = ang + k * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rad * 0.33, cy + Math.sin(a) * rad * 0.33, 0.8, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#2b2f2d'; ctx.beginPath(); ctx.arc(cx, cy, rad * 0.14, 0, Math.PI * 2); ctx.fill();
  }
  function truck(ctx, r, t, dt, still) {
    let tr = ui.truck;
    if (still) { const i = stageIndex(r); if (i < 1 || i > 4) return; tr = { stage: i, time: TRUCK.fold + 0.01, dist: 0, parked: true }; }
    if (!tr) return;
    const T = tr.time, L = TRUCK.len;
    let x;
    if (T < TRUCK.arrive) { const u = T / TRUCK.arrive; x = TRUCK.stop + (W + 40 - TRUCK.stop) * Math.pow(1 - u, 2.2); }
    else if (T < TRUCK.fold || tr.parked) x = TRUCK.stop;
    else { const u = (T - TRUCK.fold) / (TRUCK.leave - TRUCK.fold); x = TRUCK.stop - (TRUCK.stop + L + 30) * u * u; }
    const prev = tr.x === undefined ? x : tr.x; tr.dist = (tr.dist || 0) + (prev - x); tr.x = x;
    const speed = dt > 0 ? Math.abs(prev - x) / dt : 0, braking = T > TRUCK.arrive - 0.7 && T < TRUCK.arrive + 0.6;
    const yW = GROUND + 1, rad = 7.5, ang = tr.dist / rad, bounce = speed > 5 ? Math.sin(t * 22) * 0.35 : 0;
    // poussière soulevée par les roues arrière et fumée d'échappement au démarrage
    if (!still && speed > 25 && Math.random() < dt * 30) ui.dust.push({ x: x + L - 18 + Math.random() * 10, y: yW + 4, vx: 10 + Math.random() * 14, vy: -6 - Math.random() * 6, age: 0, s: 3 + Math.random() * 3, c: '170,150,120' });
    if (!still && T > TRUCK.fold - 0.2 && T < TRUCK.fold + 1.4 && Math.random() < dt * 14) ui.dust.push({ x: x + 33, y: yW - 1, vx: 8 + Math.random() * 6, vy: -9 - Math.random() * 5, age: 0, s: 2.5 + Math.random() * 2, c: '110,114,112' });
    ctx.save();
    // ombre portée (soleil en haut à droite → ombre vers la gauche)
    ctx.save(); try { ctx.filter = 'blur(2px)'; } catch {} ctx.fillStyle = 'rgba(20,28,24,.30)'; ctx.beginPath(); ctx.ellipse(x + L / 2 - 8, yW + rad - 0.5, L / 2 + 6, 4.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.translate(0, bounce);
    // châssis
    ctx.fillStyle = '#2a2e2c'; ctx.fillRect(x + 6, yW - 8, L - 8, 5);
    // plateau : plancher bois + ridelles basses
    const bedX = x + 36, bedW = L - 37, bedY = yW - 14;
    const bw = ctx.createLinearGradient(0, bedY, 0, bedY + 6); bw.addColorStop(0, '#c49a62'); bw.addColorStop(1, '#8b6a3e');
    ctx.fillStyle = bw; ctx.fillRect(bedX, bedY, bedW, 6);
    ctx.fillStyle = '#7d8783'; ctx.fillRect(bedX, bedY - 4, bedW, 4); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(bedX, bedY - 4, bedW, 1);
    ctx.fillStyle = '#5c6562'; for (let px = bedX; px <= bedX + bedW - 2; px += 21) ctx.fillRect(px, bedY - 5, 2, 5);
    ctx.fillStyle = '#d64535'; ctx.fillRect(x + L - 2, bedY + 1, 2, 4); // feu arrière
    // garde-boue et roues (avant, tandem arrière)
    const wheels = [x + 17, x + L - 30, x + L - 14];
    ctx.fillStyle = '#1f2321'; wheels.forEach((wx, k) => { ctx.beginPath(); ctx.arc(wx, yW, rad + 2, Math.PI, 0); ctx.lineTo(wx + rad + 2, yW - 2); ctx.lineTo(wx - rad - 2, yW - 2); ctx.closePath(); if (k === 0) ctx.fill(); });
    ctx.fillRect(x + L - 41, yW - 10, 38, 3);
    wheels.forEach(wx => wheel(ctx, wx, yW, rad, -ang));
    // cabine : carrosserie claire en dégradé, pare-brise reflétant le ciel, chauffeur, rétroviseur
    const cab = ctx.createLinearGradient(x, yW - 40, x + 34, yW);
    cab.addColorStop(0, '#ffffff'); cab.addColorStop(0.55, '#e7ecea'); cab.addColorStop(1, '#b9c2be');
    ctx.fillStyle = cab; ctx.beginPath(); ctx.moveTo(x + 2, yW - 4); ctx.lineTo(x + 1, yW - 24); ctx.quadraticCurveTo(x + 2, yW - 38, x + 10, yW - 39); ctx.lineTo(x + 34, yW - 39); ctx.lineTo(x + 35, yW - 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(60,70,66,.35)'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = C.green2; ctx.fillRect(x + 1.5, yW - 15, 33.5, 3); // bande de couleur
    const ws = ctx.createLinearGradient(x + 2, yW - 37, x + 14, yW - 22); ws.addColorStop(0, '#dff0f8'); ws.addColorStop(0.5, '#8fb7cc'); ws.addColorStop(1, '#4d6f82');
    ctx.fillStyle = ws; ctx.beginPath(); ctx.moveTo(x + 3, yW - 23); ctx.quadraticCurveTo(x + 3.5, yW - 35, x + 10, yW - 36); ctx.lineTo(x + 14, yW - 36); ctx.lineTo(x + 14, yW - 23); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5f8296'; rr(ctx, x + 16, yW - 36, 15, 12, 1.5); ctx.fill();
    ctx.fillStyle = '#2f3d4a'; ctx.beginPath(); ctx.arc(x + 22, yW - 29, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + 18.5, yW - 26.5, 7, 3); // chauffeur
    ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(x + 22, yW - 30.5, 3.5, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.moveTo(x + 17, yW - 35); ctx.lineTo(x + 22, yW - 35); ctx.lineTo(x + 17, yW - 27); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(60,70,66,.4)'; ctx.beginPath(); ctx.moveTo(x + 15, yW - 22); ctx.lineTo(x + 15, yW - 5); ctx.stroke(); ctx.fillStyle = '#7d8783'; ctx.fillRect(x + 25, yW - 20, 4, 1.2);
    ctx.fillStyle = '#3a403e'; ctx.fillRect(x - 3, yW - 33, 1.5, 9); ctx.fillRect(x - 4.5, yW - 33, 3, 6); // rétroviseur
    ctx.fillStyle = '#3a403e'; ctx.fillRect(x - 1, yW - 8, 8, 4); // pare-chocs
    ctx.fillStyle = '#fff3c4'; ctx.fillRect(x + 0.5, yW - 11, 3, 3); ctx.fillStyle = '#f0a030'; ctx.fillRect(x + 0.5, yW - 14, 3, 2);
    ctx.fillStyle = '#4b5250'; ctx.fillRect(x + 33, yW - 9, 4, 1.5); // pot d'échappement
    // feux de freinage
    if (braking && !tr.parked) { const g = ctx.createRadialGradient(x + L - 1, bedY + 3, 0.5, x + L - 1, bedY + 3, 8); g.addColorStop(0, 'rgba(255,70,50,.9)'); g.addColorStop(1, 'rgba(255,70,50,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + L - 1, bedY + 3, 8, 0, Math.PI * 2); ctx.fill(); }
    // bras de grue auxiliaire (deux segments, vérin) qui dépose la charge sur la palette
    const pv = { x: x + 38, y: yW - 34 }, l1 = 40, l2 = 36, h = cargoHeight(tr.stage);
    const bedTop = { x: x + 80, y: bedY - 4 - h }, palTop = { x: 392, y: GROUND - 6 - h }, rest = { x: pv.x + 64, y: pv.y + 14 };
    let hook = null, load = null;
    if (T < TRUCK.arrive) load = bedTop;
    else if (T < TRUCK.unfold) { const u = ease((T - TRUCK.arrive) / (TRUCK.unfold - TRUCK.arrive)); hook = { x: rest.x + (bedTop.x - rest.x) * u, y: rest.y + (bedTop.y - 9 - rest.y) * u }; load = bedTop; }
    else if (T < TRUCK.lift) { const u = ease((T - TRUCK.unfold) / (TRUCK.lift - TRUCK.unfold)); load = { x: bedTop.x + (palTop.x - bedTop.x) * u, y: bedTop.y + (palTop.y - bedTop.y) * u - 26 * Math.sin(Math.PI * u) }; hook = { x: load.x, y: load.y - 9 }; }
    else if (T < TRUCK.fold && !tr.parked) { const u = ease((T - TRUCK.lift) / (TRUCK.fold - TRUCK.lift)); hook = { x: palTop.x + (rest.x - palTop.x) * u, y: palTop.y - 9 + (rest.y - palTop.y + 9) * u }; }
    const tgt = hook || rest, arm = ik(pv.x, pv.y, l1, l2, tgt.x, tgt.y);
    ctx.fillStyle = '#4a5250'; ctx.fillRect(pv.x - 3, pv.y, 6, bedY - 4 - pv.y);
    ctx.lineCap = 'round';
    const seg = (a, b, w) => { ctx.strokeStyle = '#9a6d12'; ctx.lineWidth = w + 1.4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.strokeStyle = '#e0a62a'; ctx.lineWidth = w; ctx.stroke(); ctx.strokeStyle = 'rgba(255,240,190,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y - w / 3); ctx.lineTo(b.x, b.y - w / 3); ctx.stroke(); };
    seg(pv, arm.e, 4.6); seg(arm.e, arm.tip, 3.6);
    ctx.strokeStyle = '#c9d0cd'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(pv.x + 2, pv.y + 6); ctx.lineTo((pv.x + arm.e.x) / 2 + 2, (pv.y + arm.e.y) / 2 + 2); ctx.stroke(); // vérin
    ctx.fillStyle = '#3a403e'; [pv, arm.e].forEach(j => { ctx.beginPath(); ctx.arc(j.x, j.y, 2.2, 0, Math.PI * 2); ctx.fill(); });
    ctx.lineCap = 'butt';
    if (hook && load) { ctx.strokeStyle = '#2b2f2d'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(arm.tip.x, arm.tip.y); ctx.lineTo(load.x - 10, load.y); ctx.moveTo(arm.tip.x, arm.tip.y); ctx.lineTo(load.x + 10, load.y); ctx.stroke(); }
    if (load) { if (load !== bedTop) { ctx.fillStyle = 'rgba(20,28,24,.18)'; ctx.beginPath(); ctx.ellipse(load.x - 4, GROUND - 1, 16, 2.5, 0, 0, Math.PI * 2); ctx.fill(); } cargo(ctx, tr.stage, load.x, load.y); }
    ctx.restore();
  }
  function dust(ctx, dt) {
    ui.dust.forEach(d => { d.age += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy *= 0.97; const a = 0.35 * (1 - d.age / 1.4), rr2 = d.s * (1 + d.age * 1.6); if (a <= 0) return; const g = ctx.createRadialGradient(d.x, d.y, 0.5, d.x, d.y, rr2); g.addColorStop(0, `rgba(${d.c},${a})`); g.addColorStop(1, `rgba(${d.c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, d.y, rr2, 0, Math.PI * 2); ctx.fill(); });
    ui.dust = ui.dust.filter(d => d.age < 1.4);
  }
  // Cônes de signalisation posés avec la clôture.
  function cones(ctx, r) {
    const show = Math.min(ease(stageK(r, 1) * 3), 1 - ease(stageK(r, 4) * 2)); if (show <= 0.01) return;
    ctx.save(); ctx.globalAlpha = show;
    [252, 342].forEach(cx => {
      const y = GROUND + 3;
      ctx.fillStyle = 'rgba(20,28,24,.22)'; ctx.beginPath(); ctx.ellipse(cx - 2, y + 1, 7, 1.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2e3230'; ctx.fillRect(cx - 6, y - 2, 12, 2.5);
      const g = ctx.createLinearGradient(cx - 4, 0, cx + 4, 0); g.addColorStop(0, '#c4421c'); g.addColorStop(0.45, '#ff7a3d'); g.addColorStop(1, '#b23a18');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - 4.5, y - 2); ctx.lineTo(cx - 1, y - 15); ctx.lineTo(cx + 1, y - 15); ctx.lineTo(cx + 4.5, y - 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.moveTo(cx - 3.3, y - 6); ctx.lineTo(cx - 2.3, y - 10); ctx.lineTo(cx + 2.3, y - 10); ctx.lineTo(cx + 3.3, y - 6); ctx.closePath(); ctx.fill();
    });
    ctx.restore();
  }

  // Technicien : se déplace vers le poste de travail de l'étape en cours.
  function techTarget(r) {
    const i = stageIndex(r);
    if (i === 0) return { x: 282, y: GROUND, tool: 'camera' };
    if (i === 1) { const row = Math.min(2, Math.floor(stageK(r, 1) * 3)); return { x: B.x + 30 + stageK(r, 1) * 3 % 1 * (B.w - 60), y: B.y + B.h - row * (B.h / 3), tool: 'trowel' }; }
    if (i === 2) { const w = WINDOWS[Math.min(11, Math.floor(stageK(r, 2) * 12))]; return { x: w.x + 11, y: B.y + B.h - w.j * (B.h / 3), tool: 'trowel' }; }
    if (i === 3) return { x: B.x + B.w + 52, y: GROUND, tool: 'wrench' };
    return { x: 262, y: GROUND, tool: 'can' };
  }
  function technician(ctx, r, t, dt) {
    const tg = techTarget(r), p = ui.tech;
    if (p.y === undefined) { p.x = tg.x; p.y = tg.y; }
    const dx = tg.x - p.x, dy = tg.y - p.y, dist = Math.hypot(dx, dy), speed = reduced() ? 1e6 : 90;
    const walking = dist > 1.5;
    if (walking) { const k = Math.min(1, speed * dt / dist); p.x += dx * k; p.y += dy * k; p.dir = dx < 0 ? -1 : 1; }
    const x = p.x, y = p.y - 52, step = walking ? Math.sin(t * 12) * 4 : 0, work = walking ? 0 : Math.sin(t * 8);
    // V6.30 (réalisme) : ombre portée au sol, pantalon de travail, chaussures de sécurité, gilet haute
    // visibilité à bandes, bras libre qui balance à la marche, léger rebond du pas.
    ctx.save(); ctx.fillStyle = 'rgba(30,40,35,.22)'; ctx.beginPath(); ctx.ellipse(x + 3, p.y + 1, 13, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const bob = walking ? Math.abs(Math.sin(t * 12)) * 1.2 : 0;
    ctx.save(); ctx.translate(x, y - bob); ctx.scale(p.dir < 0 ? -1 : 1, 1);
    ctx.lineCap = 'round';
    // bras arrière (balancier)
    const swing = walking ? -Math.sin(t * 12) * 0.5 : 0.15;
    ctx.strokeStyle = '#155f3c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-6, 7); ctx.lineTo(-6 + Math.sin(swing) * 13, 7 + Math.cos(swing) * 13); ctx.stroke();
    // jambes : pantalon foncé, genoux légèrement fléchis, chaussures
    [[-3, -step], [3, step]].forEach(([hx0, st]) => {
      const kx = hx0 + st * 0.5, fx = hx0 + st;
      ctx.strokeStyle = '#2f3d4a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(hx0, 31); ctx.lineTo(kx + 0.8, 42); ctx.lineTo(fx, 50); ctx.stroke();
      ctx.fillStyle = '#3a2b22'; rr(ctx, fx - 3, 49, 9, 4, 2); ctx.fill();
    });
    // torse : polo + gilet haute visibilité
    const vest = ctx.createLinearGradient(-10, 0, 10, 0); vest.addColorStop(0, '#d9ec3c'); vest.addColorStop(1, '#b9cc22');
    ctx.fillStyle = C.green2; rr(ctx, -9, 0, 18, 33, 6); ctx.fill();
    ctx.fillStyle = vest; rr(ctx, -10, 2, 20, 26, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(-10, 13, 20, 2.2); ctx.fillRect(-10, 21, 20, 2.2);
    ctx.fillStyle = C.green2; ctx.fillRect(-1, 2, 2, 26);
    ctx.fillStyle = '#2f3d4a'; ctx.fillRect(-9, 28, 18, 5); // ceinture / bas
    // tête : cou, visage ombré, oreille, casque avec visière
    ctx.fillStyle = '#e3b08a'; ctx.fillRect(-2.5, -2, 5, 4);
    const face = ctx.createRadialGradient(2, -10, 2, 0, -8, 9); face.addColorStop(0, '#f6cfaa'); face.addColorStop(1, '#dca57f');
    ctx.fillStyle = face; ctx.beginPath(); ctx.arc(0, -8, 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b3a35'; ctx.beginPath(); ctx.arc(4, -8, 1.1, 0, Math.PI * 2); ctx.fill();
    const helm = ctx.createLinearGradient(0, -21, 0, -10); helm.addColorStop(0, '#ffe07a'); helm.addColorStop(1, '#e2b52f');
    ctx.fillStyle = helm; ctx.beginPath(); ctx.arc(0, -11, 9.5, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#d4a628'; rr(ctx, -10, -12.5, 23, 3, 1.5); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -11, 6.5, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();
    // bras + outil
    const ang = -0.5 + work * 0.35;
    ctx.strokeStyle = C.green2; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(6, 8); ctx.lineTo(6 + Math.cos(ang) * 14, 8 + Math.sin(ang) * 14); ctx.stroke();
    const hx = 6 + Math.cos(ang) * 14, hy = 8 + Math.sin(ang) * 14;
    if (tg.tool === 'camera') { ctx.fillStyle = '#33403b'; rr(ctx, hx - 2, hy - 7, 12, 10, 2); ctx.fill(); ctx.fillStyle = '#ff8a50'; ctx.fillRect(hx + 1, hy - 5, 6, 5); }
    else if (tg.tool === 'wrench') { ctx.strokeStyle = '#7d8a85'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 10, hy - 6); ctx.stroke(); }
    else if (tg.tool === 'can') { ctx.fillStyle = '#4f9fd1'; rr(ctx, hx - 2, hy - 6, 12, 10, 2); ctx.fill(); if (!walking && !reduced()) { ctx.fillStyle = '#7cc3ee'; for (let i = 0; i < 3; i++) { const k = (t * 2 + i / 3) % 1; ctx.fillRect(hx + 12 + k * 8, hy - 2 + k * 18, 2, 3); } } }
    else { ctx.fillStyle = '#9aa8a3'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 11, hy - 4); ctx.lineTo(hx + 9, hy + 3); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }

  // V6.31 (photoréalisme) : passe d'éclairage globale — lumière chaude venue du soleil (mélange
  // « soft-light »), rayons très discrets quand le ciel est dégagé, vignettage léger comme une optique.
  function lighting(ctx, r, t) {
    const k = ease(r);
    // V6.32 : ombres des nuages qui glissent sur le sol et la façade, au rythme des nuages du ciel ;
    // plus nettes quand le soleil perce (fixes si les animations sont réduites).
    const cs = 0.07 + 0.17 * k;
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 190 + t * (5 + i * 2)) % (W + 160)) - 80 + 22 - 70, w = 70 + (i % 2) * 26;
      [[GROUND + 30, 0.9], [B.y + B.h * 0.55, 0.6]].forEach(([cy, a], j) => {
        if (j === 1 && (cx + w < B.x || cx - w > B.x + B.w)) return;
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, w);
        g.addColorStop(0, `rgba(20,34,40,${cs * a})`); g.addColorStop(1, 'rgba(20,34,40,0)');
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1, j ? 0.9 : 0.32); ctx.translate(-cx, -cy);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, w, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
    }
    ctx.save();
    try { ctx.globalCompositeOperation = 'soft-light'; } catch {}
    const warm = ctx.createRadialGradient(SUN.x, SUN.y, 10, SUN.x, SUN.y, 520);
    warm.addColorStop(0, `rgba(255,214,150,${0.30 + 0.35 * k})`); warm.addColorStop(0.5, `rgba(255,226,180,${0.10 + 0.12 * k})`); warm.addColorStop(1, 'rgba(40,60,80,.22)');
    ctx.fillStyle = warm; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    if (k > 0.35) {
      ctx.save(); ctx.globalAlpha = (k - 0.35) * 0.16; ctx.translate(SUN.x, SUN.y);
      for (let i = 0; i < 5; i++) {
        const a = 2.0 + i * 0.22 + Math.sin(t * 0.2 + i) * 0.02, rg = ctx.createLinearGradient(0, 0, Math.cos(a) * 300, Math.sin(a) * 300);
        rg.addColorStop(0, 'rgba(255,246,220,1)'); rg.addColorStop(1, 'rgba(255,246,220,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 0.04) * 300, Math.sin(a - 0.04) * 300); ctx.lineTo(Math.cos(a + 0.04) * 300, Math.sin(a + 0.04) * 300); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,20,16,.20)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  // Capteur de CO₂ et barre de chargement remplie de carbone capté.
  function intake(ctx, t, active) {
    ctx.fillStyle = C.green; rr(ctx, INTAKE.x - 14, INTAKE.y - 14, 28, 28, 6); ctx.fill();
    ctx.save(); ctx.translate(INTAKE.x, INTAKE.y); ctx.rotate(active ? t * 10 : t * 2);
    ctx.fillStyle = '#9fdcac'; for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.ellipse(5, 0, 6, 2.4, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = C.green; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(INTAKE.x, INTAKE.y + 14); ctx.lineTo(INTAKE.x, BAR.y + BAR.h / 2); ctx.lineTo(BAR.x, BAR.y + BAR.h / 2); ctx.stroke();
  }
  function bar(ctx, r, t) {
    ctx.fillStyle = '#ffffff'; rr(ctx, BAR.x, BAR.y, BAR.w, BAR.h, 12); ctx.fill();
    ctx.strokeStyle = C.green; ctx.lineWidth = 2; rr(ctx, BAR.x, BAR.y, BAR.w, BAR.h, 12); ctx.stroke();
    const fw = Math.max(0, (BAR.w - 6) * r);
    if (fw > 1) {
      ctx.save(); rr(ctx, BAR.x + 3, BAR.y + 3, fw, BAR.h - 6, 9); ctx.clip();
      const g = ctx.createLinearGradient(BAR.x, 0, BAR.x + BAR.w, 0); g.addColorStop(0, '#2d3633'); g.addColorStop(1, '#1f5a41');
      ctx.fillStyle = g; ctx.fillRect(BAR.x + 3, BAR.y + 3, fw, BAR.h - 6);
      for (let i = 0; i < fw / 7; i++) { const gx = BAR.x + 5 + i * 7 + ((i * 37) % 5), gy = BAR.y + 6 + ((i * 53) % 11); ctx.fillStyle = (Math.floor(t * 4 + i) % 5) ? 'rgba(255,255,255,.12)' : 'rgba(159,220,172,.7)'; ctx.fillRect(gx, gy, 3, 3); }
      // reflet qui balaie la partie remplie
      const sx = BAR.x + 3 + ((t * 120) % (fw + 60)) - 30, sg = ctx.createLinearGradient(sx - 20, 0, sx + 20, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.22)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(sx - 20, BAR.y, 40, BAR.h);
      ctx.restore();
    }
    ctx.fillStyle = C.green; ctx.font = '700 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('CO₂ capté', BAR.x + 2, BAR.y - 7);
    // repères des étapes du chantier sous la barre
    STAGES.forEach((s, i) => {
      const x = BAR.x + 3 + (BAR.w - 6) * s.to, done = r >= s.to - 0.001;
      if (i < STAGES.length - 1) { ctx.fillStyle = done ? C.green2 : '#c7d4ce'; ctx.fillRect(x - 1, BAR.y + BAR.h + 3, 2, 5); }
    });
  }

  // Étiquette de l'étape en cours (haut gauche) + pastilles d'étapes.
  function stagePill(ctx, r) {
    const i = stageIndex(r), label = `Étape ${i + 1}/5 · ${STAGES[i].label}`;
    ctx.font = '700 11px Inter, system-ui, sans-serif'; const w = ctx.measureText(label).width + 22 + STAGES.length * 10;
    ctx.fillStyle = 'rgba(255,255,255,.88)'; rr(ctx, 12, 10, w, 24, 12); ctx.fill();
    STAGES.forEach((s, k) => { ctx.fillStyle = k < i ? C.green2 : (k === i ? C.green : '#c7d4ce'); ctx.beginPath(); ctx.arc(24 + k * 10, 22, k === i ? 4 : 3, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = C.green; ctx.textAlign = 'left'; ctx.fillText(label, 24 + STAGES.length * 10 + 2, 26);
  }

  function frame(now) {
    if (!ui.visible) return;
    const dt = Math.min(0.05, Math.max(0, (now - (ui.last || now)) / 1000)); ui.last = now; ui.t += dt;
    // Progression affichée : suit la progression réelle (toutes phases confondues) et avance doucement
    // entre deux blocs reçus, sans jamais dépasser la phase en cours ni atteindre 100 % avant la fin.
    const cap = ui.loaded ? 1 : Math.min(phaseEnd() - 0.01, ui.target + 0.05, 0.98);
    const goal = Math.max(ui.target, Math.min(cap, ui.shown + dt * 0.006));
    ui.shown += (Math.max(ui.shown, goal) - ui.shown) * Math.min(1, dt * 3);
    if (ui.loaded && !ui.failed) ui.shown = Math.max(ui.shown, Math.min(1, ui.shown + dt * 1.2));
    const r = clamp(ui.shown), ctx = ui.ctx, t = ui.t, still = reduced();
    ctx.clearRect(0, 0, W, H);
    sky(ctx, r, still ? 0 : t);
    backdrop(ctx, r);
    ground(ctx, r, t);
    tree(ctx, 470, ease(stageK(r, 4) * 1.3), t);
    tree(ctx, 612, ease(stageK(r, 4) * 1.3 - 0.25) * 0.85, t);
    tree(ctx, 404, ease(stageK(r, 4) * 1.3 - 0.45) * 0.7, t);
    crane(ctx, r, still ? 0 : t);
    pallet(ctx, r);
    building(ctx, r, t);
    fence(ctx, r);
    cones(ctx, r);
    updateTruck(r, dt, still);
    truck(ctx, r, t, dt, still);
    dust(ctx, dt);
    // émissions : moins nombreuses à mesure que le chantier avance
    ui.spawn += dt;
    if (!still && ui.spawn > 0.22 + r * 1.4 && ui.puffs.length < 12 && r < 0.97) {
      ui.spawn = 0;
      const fromChimney = Math.random() < (stageK(r, 3) > 0.4 ? 0 : 0.5);
      ui.puffs.push({ x: fromChimney ? B.x + 147 : B.x + 20 + Math.random() * (B.w - 40), y: fromChimney ? B.y - 50 : B.y + 10 + Math.random() * (B.h - 30), s: 0.45 + Math.random() * 0.4, age: 0, sw: Math.random() * 6 });
    }
    ui.puffs.forEach(p => {
      p.age += dt;
      const pull = ease(p.age / 2.4);
      p.x += ((INTAKE.x - p.x) * pull) * dt * 1.8 + 4 * dt;
      p.y += ((INTAKE.y - p.y) * pull) * dt * 1.8 - 14 * dt * (1 - pull) + Math.sin(t * 3 + p.sw) * 0.3;
      smoke(ctx, p.x, p.y, p.s * (1 - pull * 0.55), p.age, p.sw);
      if (p.age > 0.4 && p.age < 1.2) { ctx.fillStyle = '#5c6662'; ctx.font = '600 9px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('CO₂', p.x + 10 * p.s, p.y + 3); }
    });
    let sucking = false;
    ui.puffs = ui.puffs.filter(p => {
      if (p.age > 0.8) sucking = true;
      if (Math.hypot(p.x - INTAKE.x, p.y - INTAKE.y) > 12 && p.age < 5) return true;
      ui.flow.push({ k: 0 });
      return false;
    });
    technician(ctx, r, t, dt);
    lighting(ctx, r, still ? 0 : t);
    intake(ctx, t, sucking);
    // granulés : du capteur vers la barre
    ui.flow.forEach(f => {
      f.k += dt * 1.4; const k = Math.min(1, f.k);
      const x = INTAKE.x + (BAR.x + 6 - INTAKE.x) * Math.max(0, (k - 0.5) * 2), y = INTAKE.y + 14 + (BAR.y + BAR.h / 2 - INTAKE.y - 14) * Math.min(1, k * 2);
      ctx.fillStyle = '#9fdcac'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
    });
    ui.flow = ui.flow.filter(f => f.k < 1);
    // étincelles
    ui.sparks.forEach(s => { s.age += dt; s.vy += 90 * dt; s.x += s.vx * dt; s.y += s.vy * dt; ctx.globalAlpha = clamp(1 - s.age / 0.6); ctx.fillStyle = s.color === '#ffffff' ? '#ffe9a8' : s.color; ctx.fillRect(s.x, s.y, 2.5, 2.5); });
    ctx.globalAlpha = 1; ui.sparks = ui.sparks.filter(s => s.age < 0.6);
    // oiseaux en fin de chantier
    if (!still && stageK(r, 4) > 0.5) {
      if (ui.birds.length < 3 && Math.random() < dt * 0.6) ui.birds.push({ x: -10, y: 40 + Math.random() * 50, v: 40 + Math.random() * 30 });
      ctx.strokeStyle = '#3d4a45'; ctx.lineWidth = 1.5;
      ui.birds.forEach(b => { b.x += b.v * dt; const f = Math.sin(t * 10 + b.y) * 3; ctx.beginPath(); ctx.moveTo(b.x - 6, b.y - f); ctx.quadraticCurveTo(b.x - 3, b.y - 3, b.x, b.y); ctx.quadraticCurveTo(b.x + 3, b.y - 3, b.x + 6, b.y - f); ctx.stroke(); });
      ui.birds = ui.birds.filter(b => b.x < W + 10);
    }
    bar(ctx, r, t);
    stagePill(ctx, r);
    const pct = Math.round(r * 100);
    const pe = ui.el.querySelector('[data-loader-pct]'); if (pe.textContent !== `${pct} %`) pe.textContent = `${pct} %`;
    ui.raf = requestAnimationFrame(frame);
  }

  // --------------------------------------------------------------- phases du chargement
  // phases : [{key, label, weight}] — ex. OPERATIONS puis RAPPORT. Sans phases, une seule phase.
  function phaseBounds(key) {
    if (!ui.phases) return { from: 0, to: 1 };
    const total = ui.phases.reduce((s, p) => s + p.weight, 0) || 1; let acc = 0;
    for (const p of ui.phases) { const from = acc / total; acc += p.weight; if (p.key === key) return { from, to: acc / total }; }
    return { from: 0, to: 1 };
  }
  function phaseEnd() { return ui.phases ? phaseBounds(ui.phaseKey).to : 1; }
  function renderPhases() {
    const el = ui.el?.querySelector('[data-loader-phases]'); if (!el) return;
    el.hidden = !ui.phases;
    if (!ui.phases) { el.innerHTML = ''; return; }
    const cur = ui.phases.findIndex(p => p.key === ui.phaseKey);
    el.innerHTML = ui.phases.map((p, i) => `<span class="${i < cur || ui.loaded ? 'is-done' : (i === cur ? 'is-current' : '')}">${i < cur || (ui.loaded && !ui.failed) ? '✓ ' : ''}${p.label}</span>`).join('<i aria-hidden="true">›</i>');
  }
  function setTarget(ratio) { if (Number.isFinite(ratio)) { ui.known = true; ui.target = Math.max(ui.target, clamp(ratio)); } }

  // --------------------------------------------------------------- API
  function show() {
    build(); ui.openTimer = 0;
    if (ui.visible) return;
    ui.visible = true; ui.el.hidden = false; ui.last = 0;
    document.documentElement.classList.add('newosb-loader-open');
    ui.raf = requestAnimationFrame(frame);
  }
  function status(text, ratio) {
    if (!ui.el) return;
    ui.el.querySelector('[data-loader-status]').textContent = text;
    setTarget(ratio);
  }
  function open(opts = {}) {
    build();
    clearTimeout(ui.closeTimer);
    ui.loaded = false; ui.failed = false; ui.onEnter = typeof opts.onEnter === 'function' ? opts.onEnter : null;
    ui.el.querySelector('#obsLoaderTitle').textContent = opts.title || 'Chargement des données';
    ui.el.querySelector('[data-loader-close]').hidden = true;
    ui.el.querySelector('[data-loader-hide]').hidden = false;
    ui.el.classList.remove('is-failed', 'is-done');
    if (!ui.visible) { ui.target = 0; ui.shown = 0; ui.known = false; ui.puffs = []; ui.flow = []; ui.sparks = []; ui.birds = []; ui.tech = { x: 300, dir: -1 }; ui.truck = null; ui.delivered = {}; ui.dust = []; }
    const phases = Array.isArray(opts.phases) ? opts.phases.filter(p => p && p.key).map(p => ({ key: String(p.key), label: String(p.label || p.key), weight: Math.max(0.01, Number(p.weight) || 1) })) : [];
    ui.phases = phases.length > 1 ? phases : null; ui.phaseKey = ui.phases ? ui.phases[0].key : '';
    renderPhases();
    status(opts.status || 'Connexion à la source…');
    if (ui.visible) return;
    clearTimeout(ui.openTimer);
    ui.openTimer = setTimeout(show, Number.isFinite(opts.delay) ? opts.delay : 400);
  }
  // Début d'une phase : les phases précédentes sont terminées.
  function phase(key, text) {
    if (!ui.el || !ui.phases || !ui.phases.some(p => p.key === key)) { if (text) status(text); return; }
    ui.phaseKey = key; renderPhases();
    status(text || `Chargement : ${ui.phases.find(p => p.key === key).label}…`, phaseBounds(key).from);
  }
  function progress(loaded, total, label, key) {
    if (!ui.el) return;
    let ratio = total ? loaded / total : undefined;
    if (ui.phases && Number.isFinite(ratio)) {
      if (key && key !== ui.phaseKey && ui.phases.some(p => p.key === key)) { ui.phaseKey = key; renderPhases(); }
      const b = phaseBounds(key && ui.phases.some(p => p.key === key) ? key : ui.phaseKey); ratio = b.from + clamp(ratio) * (b.to - b.from);
    }
    status(label || (total ? `${Number(loaded).toLocaleString('fr-FR')} / ${Number(total).toLocaleString('fr-FR')} lignes` : 'Chargement…'), ratio);
  }
  // Fin du chargement : la barre se remplit, puis l'écran se ferme et l'Observatoire s'affiche.
  function done(text) {
    if (!ui.el) return;
    clearTimeout(ui.openTimer); ui.openTimer = 0;
    ui.loaded = true; ui.known = true; ui.target = 1; renderPhases();
    status(`✓ ${text || 'Données chargées'}`, 1);
    if (!ui.visible) { ui.onEnter = null; close(); return; } // chargement rapide : rien n'a été affiché
    ui.el.classList.add('is-done');
    clearTimeout(ui.closeTimer);
    ui.closeTimer = setTimeout(finish, reduced() ? 150 : 1100);
  }
  function fail(text) {
    if (!ui.el) return;
    clearTimeout(ui.openTimer); ui.openTimer = 0;
    ui.failed = true; ui.loaded = true; ui.onEnter = null;
    if (!ui.visible) return;
    status(`Chargement interrompu : ${text || 'erreur'}`);
    ui.el.classList.add('is-failed');
    ui.el.querySelector('[data-loader-close]').hidden = false;
    ui.el.querySelector('[data-loader-hide]').hidden = true;
  }
  function finish() {
    const cb = ui.loaded && !ui.failed ? ui.onEnter : null;
    ui.onEnter = null;
    close();
    if (cb) { try { cb(); } catch (e) { console.warn('NEWOSB chargement :', e); } }
  }
  function close() {
    clearTimeout(ui.openTimer); ui.openTimer = 0; clearTimeout(ui.closeTimer);
    if (!ui.visible) return;
    ui.visible = false; ui.el.hidden = true;
    cancelAnimationFrame(ui.raf);
    document.documentElement.classList.remove('newosb-loader-open');
  }

  window.addEventListener('keydown', e => { if (ui.visible && e.key === 'Escape') close(); });
  window.NEWOSB_LOADER = { open, phase, progress, status, done, fail, close, isOpen: () => ui.visible, _state: () => ({ shown: ui.shown, target: ui.target, loaded: ui.loaded, failed: ui.failed, visible: ui.visible, phase: ui.phaseKey, stage: STAGES[stageIndex(clamp(ui.shown))].label }) };
})();
