/*
 * Observatoire Prestaterre — V6.22 — écran de chargement des données.
 *
 * Animation sobre : un technicien capte le CO₂ qui s'échappe d'un bâtiment ancien ; le carbone capté
 * remplit la barre de chargement, qui suit l'avancement réel (lignes reçues / lignes attendues).
 * À mesure que le chargement avance, le bâtiment se rénove (façade, fenêtres, toiture végétalisée).
 * Aucune donnée n'est lue ni transmise par cet écran. Il se ferme seul à la fin du chargement.
 */
(() => {
  'use strict';

  const W = 640, H = 300;
  const C = {
    sky: '#f3f8f5', ground: '#dfe9e3', green: '#06402b', green2: '#16864f', light: '#9fdcac',
    stoneDirty: [150, 138, 122], stoneClean: [233, 222, 200], roofDirty: [92, 84, 78], roofClean: [70, 96, 82],
    winDirty: [86, 92, 96], winClean: [126, 178, 201], co2: '#8b9490', carbon: '#2d3633'
  };
  const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  const ease = t => t * t * (3 - 2 * t);
  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

  const ui = { el: null, canvas: null, ctx: null, raf: 0, last: 0, t: 0, visible: false, openTimer: 0, closeTimer: 0, target: 0, shown: 0, known: false, onEnter: null, failed: false, loaded: false, puffs: [], flow: [], spawn: 0 };

  function build() {
    if (ui.el) return;
    const el = document.createElement('div');
    el.id = 'obsLoader'; el.className = 'obs-loader'; el.hidden = true;
    el.innerHTML = `<div class="obs-loader-card" role="dialog" aria-modal="true" aria-labelledby="obsLoaderTitle" aria-describedby="obsLoaderStatus">
  <div class="obs-loader-head"><span class="obs-loader-kicker">OBSERVATOIRE PRESTATERRE</span><h2 id="obsLoaderTitle">Chargement des données</h2></div>
  <canvas width="${W}" height="${H}" aria-hidden="true"></canvas>
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

  // Bâtiment ancien (années 1950) qui se rénove avec l'avancement r (0 → 1).
  function building(ctx, r) {
    const x = 40, y = 70, w = 180, h = 150, k = ease(r);
    ctx.fillStyle = mix(C.stoneDirty, C.stoneClean, k); ctx.fillRect(x, y, w, h);
    // toiture à deux pans + cheminée
    ctx.fillStyle = mix(C.roofDirty, C.roofClean, k);
    ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + w / 2, y - 46); ctx.lineTo(x + w + 10, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = mix([120, 104, 92], [180, 74, 58], k); ctx.fillRect(x + 128, y - 50, 16, 30);
    if (k > 0.7) { // toiture végétalisée
      ctx.globalAlpha = Math.min(1, (k - 0.7) / 0.25); ctx.fillStyle = '#5aa86f';
      ctx.beginPath(); ctx.moveTo(x - 4, y - 2); ctx.lineTo(x + w / 2, y - 42); ctx.lineTo(x + w + 4, y - 2); ctx.lineTo(x + w - 6, y - 2); ctx.lineTo(x + w / 2, y - 34); ctx.lineTo(x + 6, y - 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.green2; for (let i = 0; i < 7; i++) { const u = (i + 0.5) / 7, px = x + u * w, py = y - 3 - (1 - Math.abs(u - 0.5) * 2) * 40; ctx.fillRect(px - 1, py - 5, 2, 5); ctx.fillRect(px - 3, py - 4, 2, 3); ctx.fillRect(px + 1, py - 4, 2, 3); }
      ctx.globalAlpha = 1;
    }
    // fenêtres (3 niveaux × 4)
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
      const wx = x + 18 + i * 40, wy = y + 18 + j * 42;
      ctx.fillStyle = mix(C.winDirty, C.winClean, k); ctx.fillRect(wx, wy, 22, 26);
      ctx.fillStyle = mix([70, 64, 58], [255, 255, 255], k); ctx.fillRect(wx + 10, wy, 2, 26); ctx.fillRect(wx, wy + 12, 22, 2);
    }
    // fissures et salissures qui disparaissent
    if (k < 0.95) {
      ctx.globalAlpha = 0.55 * (1 - k); ctx.strokeStyle = '#5d5248'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x + 30, y + 150); ctx.lineTo(x + 38, y + 128); ctx.lineTo(x + 34, y + 110); ctx.moveTo(x + 150, y + 40); ctx.lineTo(x + 158, y + 62); ctx.lineTo(x + 152, y + 80); ctx.stroke();
      ctx.fillStyle = '#6f645a'; ctx.fillRect(x, y + h - 22, w, 22); ctx.globalAlpha = 1;
    }
    // porte
    ctx.fillStyle = mix([96, 72, 54], [6, 64, 43], k); ctx.fillRect(x + w / 2 - 12, y + h - 36, 24, 36);
    // étiquette « avant / après »
    ctx.fillStyle = k > 0.5 ? C.green : '#6f645a'; ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(k > 0.98 ? 'Bâtiment rénové' : 'Bâtiment de 1955', x + w / 2, y + h + 18);
  }

  // Technicien Prestaterre avec capteur dorsal.
  function avatar(ctx, x, y, t, sucking) {
    const step = Math.sin(t * 6) * (sucking ? 1.5 : 3);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2b3a35'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x - 4, y + 30); ctx.lineTo(x - 6 - step, y + 52); ctx.moveTo(x + 4, y + 30); ctx.lineTo(x + 6 + step, y + 52); ctx.stroke();
    ctx.fillStyle = '#c9d4cf'; rr(ctx, x + 6, y - 4, 16, 30, 5); ctx.fill(); // capteur dorsal
    ctx.fillStyle = C.green2; rr(ctx, x - 12, y - 6, 24, 38, 8); ctx.fill(); // veste
    ctx.fillStyle = '#f2c39b'; ctx.beginPath(); ctx.arc(x, y - 16, 10, 0, Math.PI * 2); ctx.fill(); // tête
    ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(x, y - 19, 11, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 13, y - 20, 26, 3); // casque
    // tuyau + buse orientée vers le bâtiment
    ctx.strokeStyle = '#56606a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + 14, y + 6); ctx.quadraticCurveTo(x - 6, y + 22, x - 26, y + 6); ctx.stroke();
    ctx.fillStyle = '#56606a'; ctx.beginPath(); ctx.moveTo(x - 26, y + 1); ctx.lineTo(x - 38, y - 3); ctx.lineTo(x - 38, y + 15); ctx.lineTo(x - 26, y + 11); ctx.closePath(); ctx.fill();
    if (sucking) { ctx.strokeStyle = 'rgba(22,134,79,.35)'; ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const a = (t * 3 + i / 3) % 1; ctx.beginPath(); ctx.arc(x - 38, y + 6, 6 + a * 18, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke(); } }
  }

  // Barre de chargement remplie de carbone capté.
  const BAR = { x: 300, y: 236, w: 310, h: 26 };
  function bar(ctx, r, t) {
    ctx.fillStyle = '#ffffff'; rr(ctx, BAR.x, BAR.y, BAR.w, BAR.h, 13); ctx.fill();
    ctx.strokeStyle = C.green; ctx.lineWidth = 2; rr(ctx, BAR.x, BAR.y, BAR.w, BAR.h, 13); ctx.stroke();
    const fw = Math.max(0, (BAR.w - 6) * r);
    if (fw > 1) {
      ctx.save(); rr(ctx, BAR.x + 3, BAR.y + 3, fw, BAR.h - 6, 10); ctx.clip();
      ctx.fillStyle = C.carbon; ctx.fillRect(BAR.x + 3, BAR.y + 3, fw, BAR.h - 6);
      // granulés de carbone qui scintillent
      for (let i = 0; i < fw / 7; i++) { const gx = BAR.x + 5 + i * 7 + ((i * 37) % 5), gy = BAR.y + 7 + ((i * 53) % 12); ctx.fillStyle = (Math.floor(t * 3 + i) % 4) ? '#46514d' : '#6b7672'; ctx.fillRect(gx, gy, 3, 3); }
      ctx.restore();
    }
    ctx.fillStyle = C.green; ctx.font = '700 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('CO₂ capté', BAR.x, BAR.y - 8);
    // réservoir : entrée de la barre
    ctx.fillStyle = C.green; rr(ctx, BAR.x - 16, BAR.y + 4, 16, 18, 4); ctx.fill();
  }

  function frame(now) {
    if (!ui.visible) return;
    const dt = Math.min(0.05, Math.max(0, (now - (ui.last || now)) / 1000)); ui.last = now; ui.t += dt;
    // Progression affichée : suit la progression réelle ; sans information, avance lentement jusqu'à 15 %.
    const goal = ui.known ? ui.target : Math.min(0.15, ui.shown + dt * 0.02);
    ui.shown += (goal - ui.shown) * Math.min(1, dt * 4);
    if (ui.loaded && !ui.failed) ui.shown = Math.max(ui.shown, Math.min(1, ui.shown + dt * 1.5));
    const r = Math.max(0, Math.min(1, ui.shown)), ctx = ui.ctx, t = ui.t;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.ground; ctx.fillRect(0, 220, W, 80);
    building(ctx, r);
    // émissions : moins nombreuses à mesure que le bâtiment se rénove
    ui.spawn += dt;
    if (!reduced() && ui.spawn > 0.25 + r * 0.9 && ui.puffs.length < 10) {
      ui.spawn = 0;
      const fromChimney = Math.random() < 0.5;
      ui.puffs.push({ x: fromChimney ? 176 : 70 + Math.random() * 120, y: fromChimney ? 20 : 90 + Math.random() * 100, s: 0.5 + Math.random() * 0.4, age: 0 });
    }
    const ax = 268 + Math.sin(t * 0.8) * 8, ay = 170, nozzle = { x: ax - 38, y: ay + 6 };
    ui.puffs.forEach(p => {
      p.age += dt;
      const pull = Math.min(1, p.age / 2.2);
      p.x += ((nozzle.x - p.x) * pull) * dt * 1.6 + 6 * dt;
      p.y += ((nozzle.y - p.y) * pull) * dt * 1.6 - 8 * dt * (1 - pull);
      cloud(ctx, p.x, p.y, p.s * (1 - pull * 0.5), C.co2, 0.75);
      if (p.age > 0.6 && p.age < 1.4) { ctx.fillStyle = '#5c6662'; ctx.font = '600 9px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('CO₂', p.x + 10 * p.s, p.y + 3); }
    });
    // un nuage atteint la buse : il part vers la barre sous forme de granulés
    ui.puffs = ui.puffs.filter(p => {
      if (Math.hypot(p.x - nozzle.x, p.y - nozzle.y) > 14 && p.age < 4) return true;
      for (let i = 0; i < 3; i++) ui.flow.push({ k: -i * 0.08, x0: ax + 14, y0: ay - 2 });
      return false;
    });
    avatar(ctx, ax, ay, t, ui.puffs.some(p => p.age > 0.5));
    // granulés : du capteur dorsal vers l'entrée de la barre
    ui.flow.forEach(f => {
      f.k += dt * 0.9; if (f.k < 0) return;
      const k = Math.min(1, f.k), ex = BAR.x - 10, ey = BAR.y + 12;
      const x = f.x0 + (ex - f.x0) * k, y = f.y0 + (ey - f.y0) * k - Math.sin(k * Math.PI) * 40;
      ctx.fillStyle = C.carbon; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    });
    ui.flow = ui.flow.filter(f => f.k < 1);
    bar(ctx, r, t);
    const pct = Math.round(r * 100);
    const pe = ui.el.querySelector('[data-loader-pct]'); if (pe.textContent !== `${pct} %`) pe.textContent = `${pct} %`;
    ui.raf = requestAnimationFrame(frame);
  }

  // --------------------------------------------------------------- API (inchangée pour les modules)
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
    if (Number.isFinite(ratio)) { ui.known = true; ui.target = Math.max(ui.target, Math.max(0, Math.min(1, ratio))); }
  }
  function open(opts = {}) {
    build();
    clearTimeout(ui.closeTimer);
    ui.loaded = false; ui.failed = false; ui.onEnter = typeof opts.onEnter === 'function' ? opts.onEnter : null;
    ui.el.querySelector('#obsLoaderTitle').textContent = opts.title || 'Chargement des données';
    ui.el.querySelector('[data-loader-close]').hidden = true;
    ui.el.querySelector('[data-loader-hide]').hidden = false;
    ui.el.classList.remove('is-failed', 'is-done');
    if (!ui.visible) { ui.target = 0; ui.shown = 0; ui.known = false; ui.puffs = []; ui.flow = []; }
    status(opts.status || 'Connexion à la source…');
    if (ui.visible) return;
    clearTimeout(ui.openTimer);
    ui.openTimer = setTimeout(show, Number.isFinite(opts.delay) ? opts.delay : 400);
  }
  function progress(loaded, total, label) {
    if (!ui.el) return;
    status(label || (total ? `${Number(loaded).toLocaleString('fr-FR')} / ${Number(total).toLocaleString('fr-FR')} lignes` : 'Chargement…'), total ? loaded / total : undefined);
  }
  // Fin du chargement : la barre se remplit, puis l'écran se ferme et l'Observatoire s'affiche.
  function done(text) {
    if (!ui.el) return;
    clearTimeout(ui.openTimer); ui.openTimer = 0;
    ui.loaded = true; ui.known = true; ui.target = 1;
    status(`✓ ${text || 'Données chargées'}`, 1);
    if (!ui.visible) { ui.onEnter = null; close(); return; } // chargement rapide : rien n'a été affiché
    ui.el.classList.add('is-done');
    clearTimeout(ui.closeTimer);
    ui.closeTimer = setTimeout(finish, reduced() ? 150 : 900);
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
  window.NEWOSB_LOADER = { open, progress, status, done, fail, close, isOpen: () => ui.visible, _state: () => ({ shown: ui.shown, target: ui.target, loaded: ui.loaded, failed: ui.failed, visible: ui.visible }) };
})();
