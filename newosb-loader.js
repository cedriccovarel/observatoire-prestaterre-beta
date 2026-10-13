/*
 * Observatoire Prestaterre — V6.30 — écran de chargement des données.
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
    phases: null, phaseKey: '', puffs: [], flow: [], spawn: 0, sparks: [], tech: { x: 280, dir: -1 }, birds: []
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
  function backdrop(ctx, r) {
    const k = ease(r);
    ctx.fillStyle = `rgba(${Math.round(150 + 30 * k)},${Math.round(160 + 34 * k)},${Math.round(168 + 40 * k)},${0.42 - 0.1 * k})`;
    ctx.beginPath(); ctx.moveTo(0, GROUND);
    SKYLINE.forEach(([x, h], i) => { const nx = (SKYLINE[i + 1] || [W + 20])[0]; ctx.lineTo(x, GROUND - h); ctx.lineTo(nx - 3, GROUND - h); ctx.lineTo(nx - 3, GROUND - h * 0.6); });
    ctx.lineTo(W, GROUND); ctx.closePath(); ctx.fill();
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
    const sh = 0.10 + 0.10 * k;
    ctx.fillStyle = `rgba(30,40,36,${sh})`; ctx.beginPath(); ctx.moveTo(B.x + B.w + 14, GROUND); ctx.lineTo(B.x + B.w - 22, GROUND + 15); ctx.lineTo(B.x - 34, GROUND + 15); ctx.lineTo(B.x, GROUND); ctx.closePath(); ctx.fill();
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
    // mât en treillis
    ctx.strokeStyle = '#d9a520'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mx - 5, GROUND); ctx.lineTo(mx - 5, mastTop); ctx.moveTo(mx + 5, GROUND); ctx.lineTo(mx + 5, mastTop); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath();
    for (let y = GROUND; y > mastTop + 8; y -= 12) { ctx.moveTo(mx - 5, y); ctx.lineTo(mx + 5, y - 12); }
    ctx.stroke();
    if (rise > 0.98) {
      // flèche, contre-flèche, lest, cabine
      const jx0 = 200, jx1 = mx + 62;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(jx0, top); ctx.lineTo(jx1, top); ctx.moveTo(jx0 + 20, top + 7); ctx.lineTo(mx, top + 7); ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); for (let x = jx0 + 20; x < mx; x += 14) { ctx.moveTo(x, top + 7); ctx.lineTo(x + 7, top); ctx.lineTo(x + 14, top + 7); } ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, top - 16); ctx.lineTo(jx0 + 20, top); ctx.moveTo(mx, top - 16); ctx.lineTo(jx1 - 6, top); ctx.stroke();
      ctx.fillStyle = '#5f6b66'; ctx.fillRect(jx1 - 16, top + 1, 16, 12);
      ctx.fillStyle = '#d9a520'; ctx.fillRect(mx - 8, top + 7, 16, 12); ctx.fillStyle = '#cfe7f2'; ctx.fillRect(mx - 5, top + 10, 8, 6);
      // chariot + câble + charge : va-et-vient lent au-dessus du bâtiment
      const k = 0.5 + 0.5 * Math.sin(t * 0.55), tx = 214 + k * 112, drop = 46 + 26 * (0.5 + 0.5 * Math.sin(t * 0.9 + 1)), sway = Math.sin(t * 1.7) * 2.5;
      ctx.fillStyle = '#3c4a45'; ctx.fillRect(tx - 5, top + 1, 10, 6);
      ctx.strokeStyle = '#3c4a45'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx, top + 7); ctx.lineTo(tx + sway, top + drop); ctx.stroke();
      const i = stageIndex(r), lx = tx + sway, ly = top + drop;
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
    const i = stageIndex(r); if (i < 1 || i > 3) return;
    const k = stageK(r, i), left = Math.max(0, Math.ceil((1 - k) * 5)), x = 372, y = GROUND;
    const fade = Math.min(1, k * 8, (1 - k) * 8 + 0.15);
    ctx.save(); ctx.globalAlpha = Math.max(0.15, fade);
    ctx.fillStyle = '#b8945f'; ctx.fillRect(x, y - 5, 40, 5); ctx.fillStyle = '#8f6f42'; ctx.fillRect(x + 3, y - 2, 6, 2); ctx.fillRect(x + 31, y - 2, 6, 2);
    for (let n = 0; n < left; n++) {
      const yy = y - 5 - (n + 1) * (i === 2 ? 7 : 5);
      if (i === 1) { ctx.fillStyle = n % 2 ? '#efe6cf' : '#e6dbbe'; ctx.fillRect(x + 1, yy, 38, 5); }
      else if (i === 2) { ctx.fillStyle = '#8cc0d6'; ctx.fillRect(x + 4, yy, 32, 6); ctx.fillStyle = '#fff'; ctx.fillRect(x + 19, yy, 2, 6); }
      else { ctx.fillStyle = '#284b63'; ctx.fillRect(x + 1, yy, 38, 4); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 1, yy, 38, 1); }
    }
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
    if (!ui.visible) { ui.target = 0; ui.shown = 0; ui.known = false; ui.puffs = []; ui.flow = []; ui.sparks = []; ui.birds = []; ui.tech = { x: 300, dir: -1 }; }
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
