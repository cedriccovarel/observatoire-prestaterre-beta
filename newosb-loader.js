/*
 * Observatoire Prestaterre — V6.29 — écran de chargement des données.
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
  function cloud(ctx, x, y, s, color, alpha) {
    ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath();
    ctx.arc(x, y, 9 * s, 0, Math.PI * 2); ctx.arc(x + 10 * s, y - 4 * s, 11 * s, 0, Math.PI * 2); ctx.arc(x + 21 * s, y, 8 * s, 0, Math.PI * 2); ctx.arc(x + 10 * s, y + 5 * s, 9 * s, 0, Math.PI * 2);
    ctx.fill(); ctx.globalAlpha = 1;
  }

  // Ciel brumeux qui s'éclaircit, nuages qui défilent, soleil en fin de chantier.
  function sky(ctx, r, t) {
    const k = ease(r);
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, mix([214, 214, 206], [208, 233, 244], k)); g.addColorStop(1, mix([236, 234, 226], [240, 248, 243], k));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
    const sun = ease(stageK(r, 4) * 1.4);
    if (sun > 0) {
      ctx.globalAlpha = sun; ctx.fillStyle = '#ffd56b'; ctx.beginPath(); ctx.arc(560, 52, 20, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd56b'; ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + t * 0.4; ctx.beginPath(); ctx.moveTo(560 + Math.cos(a) * 26, 52 + Math.sin(a) * 26); ctx.lineTo(560 + Math.cos(a) * 34, 52 + Math.sin(a) * 34); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 4; i++) {
      const x = ((i * 190 + t * (8 + i * 3)) % (W + 120)) - 60, y = 30 + i * 17;
      cloud(ctx, x, y, 1.1 + (i % 2) * 0.4, mix([180, 180, 172], [255, 255, 255], k), 0.75);
    }
  }

  function ground(ctx, r, t) {
    ctx.fillStyle = mix([206, 204, 190], [214, 234, 219], ease(r)); ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = mix([168, 162, 146], [126, 184, 140], ease(r)); ctx.fillRect(0, GROUND, W, 3);
    const grass = ease(stageK(r, 4));
    if (grass > 0) {
      ctx.strokeStyle = C.leaf; ctx.lineWidth = 1.4;
      for (let i = 0; i < 58; i++) { const x = 8 + i * 11 + (i % 3) * 2; if (x > W - 6) break; const h = (4 + (i % 4) * 1.5) * grass, sway = Math.sin(t * 2 + i) * 1.2; ctx.beginPath(); ctx.moveTo(x, GROUND + 1); ctx.lineTo(x + sway, GROUND + 1 - h); ctx.stroke(); }
    }
  }

  function tree(ctx, x, s, t) {
    if (s <= 0) return;
    const h = 46 * s, sway = Math.sin(t * 1.3 + x) * 1.5 * s;
    ctx.fillStyle = '#7a5a3c'; ctx.fillRect(x - 2.5 * s, GROUND - h, 5 * s, h);
    ctx.fillStyle = C.leaf2; ctx.beginPath(); ctx.arc(x + sway, GROUND - h - 8 * s, 18 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.leaf; ctx.beginPath(); ctx.arc(x - 8 * s + sway, GROUND - h - 2 * s, 12 * s, 0, Math.PI * 2); ctx.arc(x + 9 * s + sway, GROUND - h - 4 * s, 12 * s, 0, Math.PI * 2); ctx.fill();
  }

  function windowsPos() { const out = []; for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) out.push({ x: B.x + 20 + i * 42, y: B.y + 16 + j * 38, j }); return out; }
  const WINDOWS = windowsPos();

  function building(ctx, r, t) {
    const s0 = stageK(r, 0), s1 = stageK(r, 1), s2 = stageK(r, 2), s3 = stageK(r, 3), s4 = stageK(r, 4);
    // façade d'origine
    ctx.fillStyle = mix(C.stoneDirty, [176, 166, 150], s0 * 0.3); ctx.fillRect(B.x, B.y, B.w, B.h);
    // isolation par l'extérieur : bandes posées de bas en haut
    for (let j = 0; j < 3; j++) {
      const k = ease(s1 * 3 - (2 - j)); if (k <= 0) continue;
      const y = B.y + j * (B.h / 3), w = B.w * k;
      ctx.fillStyle = mix(C.render, [246, 242, 230], s4); ctx.fillRect(B.x, y, w, B.h / 3 + 0.5);
      if (k < 1) { ctx.fillStyle = '#c8d8cc'; ctx.fillRect(B.x + w - 3, y, 3, B.h / 3); }
    }
    // salissures / fissures tant que la façade n'est pas isolée
    if (s1 < 1) {
      ctx.globalAlpha = 0.5 * (1 - s1); ctx.strokeStyle = '#5d5248'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(B.x + 26, B.y + B.h); ctx.lineTo(B.x + 34, B.y + B.h - 22); ctx.lineTo(B.x + 30, B.y + B.h - 40); ctx.moveTo(B.x + 160, B.y + 30); ctx.lineTo(B.x + 168, B.y + 52); ctx.lineTo(B.x + 162, B.y + 70); ctx.stroke();
      ctx.fillStyle = '#6f645a'; ctx.fillRect(B.x, B.y + B.h - 16, B.w, 16); ctx.globalAlpha = 1;
    }
    // toiture
    ctx.fillStyle = mix(C.roofDirty, C.roofClean, s3);
    ctx.beginPath(); ctx.moveTo(B.x - 10, B.y); ctx.lineTo(B.x + B.w / 2, B.y - 44); ctx.lineTo(B.x + B.w + 10, B.y); ctx.closePath(); ctx.fill();
    // cheminée (fermée à l'étape « énergie »)
    ctx.fillStyle = mix([120, 104, 92], [150, 150, 146], s3); ctx.fillRect(B.x + 140, B.y - 46, 14, 26);
    if (s3 > 0.4) { ctx.fillStyle = '#7d8a85'; ctx.fillRect(B.x + 137, B.y - 49, 20, 4); }
    // panneaux solaires sur le pan gauche
    for (let i = 0; i < 4; i++) {
      const k = ease(s3 * 5 - i); if (k <= 0) continue;
      const u0 = 0.12 + i * 0.2, u1 = u0 + 0.17, lx = u => B.x - 6 + u * (B.w / 2 + 6), ly = u => B.y - 4 - u * 38;
      ctx.globalAlpha = k; ctx.fillStyle = '#284b63';
      ctx.beginPath(); ctx.moveTo(lx(u0), ly(u0) - 2 + (1 - k) * -16); ctx.lineTo(lx(u1), ly(u1) - 2 + (1 - k) * -16); ctx.lineTo(lx(u1), ly(u1) + 8 + (1 - k) * -16); ctx.lineTo(lx(u0), ly(u0) + 8 + (1 - k) * -16); ctx.closePath(); ctx.fill();
      const shine = (t * 0.5 + i * 0.25) % 1; ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(lx(u0 + (u1 - u0) * shine), ly(u0 + (u1 - u0) * shine) - 1); ctx.lineTo(lx(u0 + (u1 - u0) * shine), ly(u0 + (u1 - u0) * shine) + 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // toiture végétalisée (pan droit)
    if (s4 > 0) {
      ctx.globalAlpha = ease(s4 * 1.5); ctx.fillStyle = C.leaf;
      ctx.beginPath(); ctx.moveTo(B.x + B.w / 2 + 4, B.y - 40); ctx.lineTo(B.x + B.w + 6, B.y - 2); ctx.lineTo(B.x + B.w - 4, B.y - 2); ctx.lineTo(B.x + B.w / 2 + 4, B.y - 32); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.green2; for (let i = 0; i < 5; i++) { const u = (i + 0.5) / 5, px = B.x + B.w / 2 + 6 + u * (B.w / 2), py = B.y - 40 + u * 38; ctx.fillRect(px - 1, py - 6, 2, 6); ctx.fillRect(px - 3, py - 4, 2, 3); ctx.fillRect(px + 1, py - 4, 2, 3); }
      ctx.globalAlpha = 1;
    }
    // menuiseries remplacées une à une
    WINDOWS.forEach((w, i) => {
      const k = clamp(s2 * 12 - i);
      ctx.fillStyle = mix(C.winDirty, C.winClean, k); ctx.fillRect(w.x, w.y, 22, 24);
      ctx.fillStyle = mix([70, 64, 58], [255, 255, 255], k); ctx.fillRect(w.x + 10, w.y, 2, 24); ctx.fillRect(w.x, w.y + 11, 22, 2);
      if (k > 0 && k < 1 && !w.flashed) { w.flashed = true; burst(w.x + 11, w.y + 12, '#ffffff'); }
      if (k === 0) w.flashed = false;
    });
    // porte
    ctx.fillStyle = mix([96, 72, 54], [6, 64, 43], s2); ctx.fillRect(B.x + B.w / 2 - 12, B.y + B.h - 34, 24, 34);
    // diagnostic : fuites de chaleur (caméra thermique) qui disparaissent avec l'isolation
    const heat = (0.35 + 0.65 * ease(s0 * 2)) * (1 - ease(s1 * 1.3));
    if (heat > 0.02) {
      const spots = [[B.x + 40, B.y + 30], [B.x + 120, B.y + 66], [B.x + 75, B.y + 104], [B.x + 160, B.y + 22], [B.x + B.w / 2, B.y - 18]];
      spots.forEach(([x, y], i) => {
        const pulse = 0.75 + 0.25 * Math.sin(t * 3 + i * 1.7), rad = 26 * pulse;
        const g = ctx.createRadialGradient(x, y, 2, x, y, rad);
        g.addColorStop(0, `rgba(232,72,48,${0.55 * heat})`); g.addColorStop(0.5, `rgba(250,160,60,${0.3 * heat})`); g.addColorStop(1, 'rgba(250,200,80,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      });
    }
    // échafaudage : monté au début de l'isolation, démonté pendant la végétalisation
    const scaffold = Math.min(ease(s1 * 2.5), 1 - ease(s4 * 1.6));
    if (scaffold > 0.01) {
      const top = B.y + B.h - (B.h + 6) * scaffold, x0 = B.x - 8, x1 = B.x + B.w + 8;
      ctx.strokeStyle = '#c28a2c'; ctx.lineWidth = 2;
      for (let x = x0; x <= x1; x += 49.5) { ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x, top); ctx.stroke(); }
      ctx.strokeStyle = '#8f6420'; ctx.lineWidth = 3;
      for (let j = 0; j < 4; j++) { const y = B.y + B.h - j * (B.h / 3); if (y < top) break; ctx.beginPath(); ctx.moveTo(x0 - 3, y); ctx.lineTo(x1 + 3, y); ctx.stroke(); }
    }
    // pompe à chaleur
    const pac = ease(s3 * 2 - 0.6);
    if (pac > 0) {
      const px = B.x + B.w + 6, py = GROUND - 26 * pac;
      ctx.fillStyle = '#e7ecea'; rr(ctx, px, py, 34, 26 * pac, 3); ctx.fill(); ctx.strokeStyle = '#9aa8a3'; ctx.lineWidth = 1; rr(ctx, px, py, 34, 26 * pac, 3); ctx.stroke();
      if (pac > 0.9) {
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
    ctx.save(); ctx.translate(x, y); ctx.scale(p.dir < 0 ? -1 : 1, 1);
    ctx.lineCap = 'round'; ctx.strokeStyle = '#2b3a35'; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(-3, 32); ctx.lineTo(-5 - step, 52); ctx.moveTo(3, 32); ctx.lineTo(5 + step, 52); ctx.stroke();
    ctx.fillStyle = C.green2; rr(ctx, -10, 0, 20, 34, 7); ctx.fill();
    ctx.fillStyle = '#f2c94c'; ctx.fillRect(-10, 14, 20, 3); // bande réfléchissante
    ctx.fillStyle = '#f2c39b'; ctx.beginPath(); ctx.arc(0, -8, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(0, -11, 10, Math.PI, 0); ctx.fill(); ctx.fillRect(-12, -12, 24, 3); // casque
    // bras + outil
    const ang = -0.5 + work * 0.35;
    ctx.strokeStyle = C.green2; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(6, 8); ctx.lineTo(6 + Math.cos(ang) * 14, 8 + Math.sin(ang) * 14); ctx.stroke();
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
      cloud(ctx, p.x, p.y, p.s * (1 - pull * 0.55), C.co2, 0.7);
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
