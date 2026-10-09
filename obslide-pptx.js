/* Obslide — export PPTX fidèle (V1.0)
 *
 * Convertit une slide HTML affichée à l'écran en objets PowerPoint natifs :
 *  - textes  → zones de texte modifiables, placées à la position mesurée à l'écran
 *              (coupures de lignes, interlignes, alignements et styles reproduits) ;
 *  - blocs   → formes natives (rectangles, arrondis, ellipses, bordures, ombres) ;
 *              dégradés et bordures complexes → image SVG exacte (+ PNG de secours) ;
 *  - <img>   → image d'origine (PNG / JPG / SVG conservés tels quels) ;
 *  - <svg>   → image SVG vectorielle + PNG haute définition de secours (Google Slides),
 *              ses textes étant extraits en zones de texte modifiables.
 *
 * Toutes les positions viennent du navigateur (getBoundingClientRect, getScreenCTM) :
 * aucune géométrie n'est recalculée « à la main », d'où la fidélité du rendu.
 *
 * API : window.ObslidePptx
 *   createPresentation(meta)                  → instance PptxGenJS (16:9, 13,333 × 7,5 po)
 *   addSlideFromElement(pptx, element, opts)  → ajoute une slide reproduisant `element`
 */
(function (global) {
  'use strict';

  const SLIDE_W_IN = 13.333;
  const SLIDE_H_IN = 7.5;
  const SVG_RASTER_SCALE = 2;        // résolution du PNG de secours des SVG (×2 = 3200 px pour une slide)
  const MAX_RASTER_SIDE = 4000;
  const GENERIC_FONTS = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|-apple-system|blinkmacsystemfont|inherit|initial)$/i;
  const DEFAULT_IGNORE = 'script,style,template,noscript,[data-pptx-ignore],[data-cover-placeholder],.no-export';
  const SVG_NON_RENDERED = 'defs,clipPath,mask,pattern,marker,symbol,linearGradient,radialGradient,filter';

  /* ---------------------------------------------------------------- couleurs */
  let colorCtx = null;
  const colorCache = new Map();
  function parseColor(input) {
    if (!input) return null;
    const str = String(input).trim();
    if (!str || str === 'transparent' || str === 'none' || str === 'currentcolor') return null;
    if (colorCache.has(str)) return colorCache.get(str);
    let out = null;
    let m = str.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i);
    if (!m) {
      if (!colorCtx) colorCtx = document.createElement('canvas').getContext('2d');
      // Valeur invalide (mot-clé « circle », « at »…) : le canvas garde la couleur précédente.
      colorCtx.fillStyle = '#010203';
      colorCtx.fillStyle = str;
      const norm = String(colorCtx.fillStyle);
      colorCtx.fillStyle = '#040506';
      colorCtx.fillStyle = str;
      if (String(colorCtx.fillStyle) !== norm) { colorCache.set(str, null); return null; }
      const hx = norm.match(/^#([0-9a-f]{6})$/i);
      if (hx) out = { hex: hx[1].toUpperCase(), a: 1 };
      else m = norm.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i);
    }
    if (m) {
      const a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
      const h = v => Math.max(0, Math.min(255, Math.round(parseFloat(v)))).toString(16).padStart(2, '0');
      out = { hex: (h(m[1]) + h(m[2]) + h(m[3])).toUpperCase(), a: isFinite(a) ? a : 1 };
    }
    if (out && out.a <= 0.003) out = null;
    colorCache.set(str, out);
    return out;
  }
  const transparencyOf = (alpha) => Math.max(0, Math.min(100, Math.round((1 - alpha) * 100)));
  const cssRgba = (c, alpha = 1) => c ? `rgba(${parseInt(c.hex.slice(0, 2), 16)},${parseInt(c.hex.slice(2, 4), 16)},${parseInt(c.hex.slice(4, 6), 16)},${+(c.a * alpha).toFixed(4)})` : 'none';

  /* ---------------------------------------------------------------- utilitaires */
  const px = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const escXml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function splitTopLevel(str, sep = ',') {
    const out = []; let depth = 0, cur = '', quote = '';
    for (const ch of String(str)) {
      if (quote) { cur += ch; if (ch === quote) quote = ''; continue; }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === sep && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function utf8Base64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const svgDataUrl = svg => 'data:image/svg+xml;base64,' + utf8Base64(svg);
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || '')); r.onerror = reject; r.readAsDataURL(blob); });
  }
  const dataUrlCache = new Map();
  function urlToDataUrl(url) {
    if (!url) return Promise.resolve('');
    if (/^data:/i.test(url)) return Promise.resolve(url);
    const abs = new URL(url, location.href).href;
    if (!dataUrlCache.has(abs)) {
      dataUrlCache.set(abs, fetch(abs, { cache: 'force-cache' })
        .then(r => { if (!r.ok) throw new Error('Image indisponible : ' + url); return r.blob(); })
        .then(blobToDataUrl)
        .catch(err => { dataUrlCache.delete(abs); throw err; }));
    }
    return dataUrlCache.get(abs);
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error('Image illisible')); im.src = src; });
  }
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  function intersect(a, b) {
    if (!b) return a;
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    const r = Math.min(a.x + a.w, b.x + b.w), btm = Math.min(a.y + a.h, b.y + b.h);
    return { x, y, w: Math.max(0, r - x), h: Math.max(0, btm - y) };
  }
  const isEmpty = r => !r || r.w <= 0.01 || r.h <= 0.01;

  function fontFace(cssFamily, fallback) {
    for (const raw of splitTopLevel(cssFamily || '')) {
      const name = raw.replace(/^["']|["']$/g, '').trim();
      if (name && !GENERIC_FONTS.test(name)) return name;
    }
    return fallback || 'Arial';
  }

  function applyTextTransform(text, transform) {
    if (transform === 'uppercase') return text.toLocaleUpperCase('fr-FR');
    if (transform === 'lowercase') return text.toLocaleLowerCase('fr-FR');
    if (transform === 'capitalize') return text.replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toLocaleUpperCase('fr-FR'));
    return text;
  }

  /* ---------------------------------------------------------------- dégradés → SVG */
  const ANGLE_RE = /^(-?[\d.]+)(deg|grad|rad|turn)$/i;
  function toDeg(token) {
    const m = String(token).match(ANGLE_RE); if (!m) return null;
    const v = parseFloat(m[1]); const u = m[2].toLowerCase();
    return u === 'deg' ? v : u === 'rad' ? v * 180 / Math.PI : u === 'grad' ? v * 0.9 : v * 360;
  }
  function parseStops(parts, lengthForPx) {
    const stops = [];
    for (const part of parts) {
      const m = part.match(/^(rgba?\([^)]*\)|hsla?\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8}|[a-z]+)\s*(.*)$/i);
      if (!m) continue;                       // indice d'interpolation : ignoré
      const color = parseColor(m[1]);
      const positions = m[2].trim() ? m[2].trim().split(/\s+/) : [];
      const toPos = p => {
        if (/%$/.test(p)) return parseFloat(p) / 100;
        const deg = toDeg(p); if (deg !== null) return deg / 360;
        if (/px$/.test(p)) return parseFloat(p) / (lengthForPx || 1);
        return null;
      };
      if (!positions.length) stops.push({ color, pos: null });
      positions.forEach(p => stops.push({ color, pos: toPos(p) }));
    }
    if (!stops.length) return stops;
    if (stops[0].pos === null) stops[0].pos = 0;
    if (stops[stops.length - 1].pos === null) stops[stops.length - 1].pos = 1;
    for (let i = 1; i < stops.length; i++) {
      if (stops[i].pos === null) {
        let j = i; while (stops[j].pos === null) j++;
        const a = stops[i - 1].pos, b = stops[j].pos;
        for (let k = i; k < j; k++) stops[k].pos = a + (b - a) * (k - i + 1) / (j - i + 1);
      }
      if (stops[i].pos < stops[i - 1].pos) stops[i].pos = stops[i - 1].pos;
    }
    return stops;
  }
  const stopXml = stops => stops.map(s => `<stop offset="${(s.pos * 100).toFixed(3)}%" stop-color="${s.color ? '#' + s.color.hex : '#000'}" stop-opacity="${s.color ? s.color.a : 0}"/>`).join('');
  function parsePosition(tokens, w, h) {
    let x = w / 2, y = h / 2;
    const kw = { left: 0, center: 0.5, right: 1, top: 0, bottom: 1 };
    const t = tokens.filter(Boolean);
    const val = (tok, size) => /%$/.test(tok) ? parseFloat(tok) / 100 * size : /px$/.test(tok) ? parseFloat(tok) : (tok in kw ? kw[tok] * size : null);
    if (t.length >= 1) {
      if (t[0] === 'top' || t[0] === 'bottom') { y = val(t[0], h); if (t[1]) x = val(t[1], w); }
      else { const vx = val(t[0], w); if (vx !== null) x = vx; if (t[1]) { const vy = val(t[1], h); if (vy !== null) y = vy; } }
    }
    return { x, y };
  }
  // Renvoie le fragment SVG (defs + forme) d'une couche de dégradé CSS, ou '' si non reconnue.
  function gradientLayerSvg(layer, w, h, clipPathD, id) {
    const m = layer.match(/^(repeating-)?(linear|radial|conic)-gradient\((.*)\)$/is);
    if (!m) return '';
    const kind = m[2].toLowerCase();
    const parts = splitTopLevel(m[3]);
    if (kind === 'linear') {
      let angle = 180;
      const first = parts[0] || '';
      if (/^to\s+/i.test(first)) {
        const dir = first.replace(/^to\s+/i, '').toLowerCase().split(/\s+/);
        const hz = dir.includes('left') ? -1 : dir.includes('right') ? 1 : 0;
        const vt = dir.includes('top') ? -1 : dir.includes('bottom') ? 1 : 0;
        if (hz && vt) angle = (Math.atan2(hz * w, -vt * h) * 180 / Math.PI + 360) % 360; // coin : perpendiculaire à la diagonale
        else angle = hz === 1 ? 90 : hz === -1 ? 270 : vt === -1 ? 0 : 180;
        parts.shift();
      } else if (toDeg(first) !== null) { angle = toDeg(first); parts.shift(); }
      const rad = angle * Math.PI / 180;
      const len = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
      const dx = Math.sin(rad) * len / 2, dy = -Math.cos(rad) * len / 2;
      const stops = parseStops(parts, len);
      if (!stops.length) return '';
      return `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${w / 2 - dx}" y1="${h / 2 - dy}" x2="${w / 2 + dx}" y2="${h / 2 + dy}"${m[1] ? ' spreadMethod="repeat"' : ''}>${stopXml(stops)}</linearGradient></defs><path d="${clipPathD}" fill="url(#${id})"/>`;
    }
    if (kind === 'radial') {
      let shape = 'ellipse', pos = { x: w / 2, y: h / 2 }, size = 'farthest-corner';
      const first = parts[0] || '';
      if (!parseColor(first.split(/\s+/)[0])) {
        const at = first.split(/\s+at\s+/i);
        const desc = (at[0] || '').toLowerCase().split(/\s+/).filter(Boolean);
        if (desc.includes('circle')) shape = 'circle';
        const sz = desc.find(d => /closest|farthest/.test(d)); if (sz) size = sz;
        if (at[1]) pos = parsePosition(at[1].trim().split(/\s+/), w, h);
        else if (/^at\s+/i.test(first)) pos = parsePosition(first.replace(/^at\s+/i, '').split(/\s+/), w, h);
        parts.shift();
      }
      const dxs = [pos.x, w - pos.x], dys = [pos.y, h - pos.y];
      const far = size.startsWith('farthest');
      let rx = far ? Math.max(...dxs) : Math.min(...dxs), ry = far ? Math.max(...dys) : Math.min(...dys);
      if (size.endsWith('corner')) { if (shape === 'circle') { rx = ry = Math.hypot(rx, ry); } else { rx *= Math.SQRT2; ry *= Math.SQRT2; } }
      else if (shape === 'circle') rx = ry = far ? Math.max(rx, ry) : Math.min(rx, ry);
      const stops = parseStops(parts, rx);
      if (!stops.length || rx <= 0 || ry <= 0) return '';
      return `<defs><radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${pos.x} ${pos.y}) scale(${rx} ${ry})">${stopXml(stops)}</radialGradient></defs><path d="${clipPathD}" fill="url(#${id})"/>`;
    }
    // conic : secteurs (1° quand la couleur varie, fusionnés quand elle est constante)
    let from = 0, pos = { x: w / 2, y: h / 2 };
    const first = parts[0] || '';
    if (/^(from|at)\s/i.test(first)) {
      const fm = first.match(/from\s+(\S+)/i); if (fm && toDeg(fm[1]) !== null) from = toDeg(fm[1]);
      const am = first.match(/at\s+(.+)$/i); if (am) pos = parsePosition(am[1].trim().split(/\s+/), w, h);
      parts.shift();
    }
    const stops = parseStops(parts, 360);
    if (!stops.length) return '';
    const colorAt = t => {
      if (t <= stops[0].pos) return stops[0].color;
      for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i].pos) {
          const a = stops[i - 1], b = stops[i];
          const k = b.pos === a.pos ? 1 : (t - a.pos) / (b.pos - a.pos);
          if (!a.color || !b.color || a.color.hex === b.color.hex && a.color.a === b.color.a) return k < 1 ? a.color : b.color;
          const mix = (x, y) => Math.round(x + (y - x) * k);
          const ca = [0, 2, 4].map(j => parseInt(a.color.hex.substr(j, 2), 16)), cb = [0, 2, 4].map(j => parseInt(b.color.hex.substr(j, 2), 16));
          return { hex: ca.map((v, j) => mix(v, cb[j]).toString(16).padStart(2, '0')).join('').toUpperCase(), a: a.color.a + (b.color.a - a.color.a) * k };
        }
      }
      return stops[stops.length - 1].color;
    };
    const R = Math.hypot(Math.max(pos.x, w - pos.x), Math.max(pos.y, h - pos.y)) + 2;
    const segs = [];
    for (let d = 0; d < 360; d += 1) {
      const c = colorAt((d + 0.5) / 360);
      const key = c ? c.hex + c.a : 'none';
      if (segs.length && segs[segs.length - 1].key === key) segs[segs.length - 1].end = d + 1;
      else segs.push({ key, c, start: d, end: d + 1 });
    }
    // Les bords nets des secteurs suivent exactement les arrêts de couleur.
    stops.forEach(s => segs.forEach(seg => { const a = s.pos * 360; if (Math.abs(seg.start - a) < 1) seg.start = a; if (Math.abs(seg.end - a) < 1) seg.end = a; }));
    const pt = a => { const r = (a + from - 90) * Math.PI / 180; return `${(pos.x + R * Math.cos(r)).toFixed(3)} ${(pos.y + R * Math.sin(r)).toFixed(3)}`; };
    const body = segs.filter(s => s.c).map(s => {
      const span = s.end - s.start;
      if (span >= 359.99) return `<rect x="-1" y="-1" width="${w + 2}" height="${h + 2}" fill="#${s.c.hex}" fill-opacity="${s.c.a}"/>`;
      return `<path d="M${pos.x} ${pos.y} L${pt(s.start)} A${R} ${R} 0 ${span > 180 ? 1 : 0} 1 ${pt(s.end)} Z" fill="#${s.c.hex}" fill-opacity="${s.c.a}"/>`;
    }).join('');
    return `<defs><clipPath id="${id}"><path d="${clipPathD}"/></clipPath></defs><g clip-path="url(#${id})">${body}</g>`;
  }

  /* ---------------------------------------------------------------- géométrie des boîtes */
  function cornerRadii(cs, w, h) {
    const r = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map(k => {
      const parts = String(cs[k] || '0').split(/\s+/);
      const v = (p, size) => /%$/.test(p) ? parseFloat(p) / 100 * size : px(p);
      return { x: v(parts[0], w), y: v(parts[1] || parts[0], h) };
    });
    // Réduction CSS quand la somme des rayons dépasse un côté.
    const f = Math.min(1,
      w / Math.max(1e-6, r[0].x + r[1].x), w / Math.max(1e-6, r[3].x + r[2].x),
      h / Math.max(1e-6, r[0].y + r[3].y), h / Math.max(1e-6, r[1].y + r[2].y));
    return r.map(c => ({ x: c.x * f, y: c.y * f }));
  }
  function roundedPath(x, y, w, h, rad) {
    const [tl, tr, br, bl] = rad;
    const f = n => +n.toFixed(3);
    return `M${f(x + tl.x)} ${f(y)} H${f(x + w - tr.x)} ` + (tr.x || tr.y ? `A${f(tr.x)} ${f(tr.y)} 0 0 1 ${f(x + w)} ${f(y + tr.y)} ` : '') +
      `V${f(y + h - br.y)} ` + (br.x || br.y ? `A${f(br.x)} ${f(br.y)} 0 0 1 ${f(x + w - br.x)} ${f(y + h)} ` : '') +
      `H${f(x + bl.x)} ` + (bl.x || bl.y ? `A${f(bl.x)} ${f(bl.y)} 0 0 1 ${f(x)} ${f(y + h - bl.y)} ` : '') +
      `V${f(y + tl.y)} ` + (tl.x || tl.y ? `A${f(tl.x)} ${f(tl.y)} 0 0 1 ${f(x + tl.x)} ${f(y)} ` : '') + 'Z';
  }
  // Ombres extérieures : liste du dessus vers le dessous (ordre CSS), épaisseur (spread) comprise.
  function parseShadows(value) {
    const out = [];
    if (!value || value === 'none') return out;
    for (const layer of splitTopLevel(value)) {
      if (/\binset\b/.test(layer)) continue;
      const colorMatch = layer.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i);
      const color = parseColor(colorMatch ? colorMatch[0] : 'rgba(0,0,0,1)');
      const nums = layer.replace(colorMatch ? colorMatch[0] : '', '').trim().split(/\s+/).map(px);
      if (!color) continue;
      const [ox = 0, oy = 0, blur = 0, spread = 0] = nums;
      out.push({ ox, oy, blur, spread, color });
    }
    return out;
  }
  // clip-path CSS (polygon, inset, circle, ellipse) → tracé SVG dans le repère de la boîte.
  function clipPathD(value, w, h) {
    const m = String(value || '').match(/^(polygon|inset|circle|ellipse)\((.*)\)/i);
    if (!m) return null;
    const kind = m[1].toLowerCase(), args = m[2].trim();
    const len = (t, size) => /%$/.test(t) ? parseFloat(t) / 100 * size : px(t);
    if (kind === 'polygon') {
      const pts = splitTopLevel(args).filter(p => !/^(nonzero|evenodd)$/i.test(p)).map(p => { const [a, b] = p.trim().split(/\s+/); return [len(a, w), len(b, h)]; });
      return pts.length >= 3 ? 'M' + pts.map(p => p[0].toFixed(3) + ' ' + p[1].toFixed(3)).join(' L') + ' Z' : null;
    }
    if (kind === 'inset') {
      const [box, round] = args.split(/\s+round\s+/i);
      const v = box.trim().split(/\s+/);
      const t = len(v[0], h), r = len(v[1] || v[0], w), b = len(v[2] || v[0], h), l = len(v[3] || v[1] || v[0], w);
      const rr = round ? len(round.trim().split(/\s+/)[0], Math.min(w, h)) : 0;
      return roundedPath(l, t, w - l - r, h - t - b, [0, 1, 2, 3].map(() => ({ x: rr, y: rr })));
    }
    const [size, at] = args.split(/\s+at\s+/i);
    const c = at ? parsePosition(at.trim().split(/\s+/), w, h) : { x: w / 2, y: h / 2 };
    const sz = (size || '').trim().split(/\s+/).filter(Boolean);
    let rx, ry;
    if (kind === 'circle') { rx = ry = sz[0] && !/side/.test(sz[0]) ? len(sz[0], Math.hypot(w, h) / Math.SQRT2) : Math.min(c.x, c.y, w - c.x, h - c.y); }
    else { rx = sz[0] && !/side/.test(sz[0]) ? len(sz[0], w) : Math.min(c.x, w - c.x); ry = sz[1] && !/side/.test(sz[1]) ? len(sz[1], h) : Math.min(c.y, h - c.y); }
    return `M${c.x - rx} ${c.y} A${rx} ${ry} 0 1 0 ${c.x + rx} ${c.y} A${rx} ${ry} 0 1 0 ${c.x - rx} ${c.y} Z`;
  }
  // Remplissage dégradé natif PowerPoint (<a:gradFill>) : linéaire ou radial simple.
  function nativeGradientXml(layer, alphaMul) {
    const m = String(layer).match(/^(linear|radial)-gradient\((.*)\)$/is);
    if (!m) return null;
    const parts = splitTopLevel(m[2]);
    let angle = 180, path = '';
    const first = parts[0] || '';
    if (m[1].toLowerCase() === 'linear') {
      if (/^to\s+/i.test(first)) {
        const d = first.toLowerCase();
        angle = /left/.test(d) ? (/top/.test(d) ? 315 : /bottom/.test(d) ? 225 : 270) : /right/.test(d) ? (/top/.test(d) ? 45 : /bottom/.test(d) ? 135 : 90) : /top/.test(d) ? 0 : 180;
        parts.shift();
      } else if (toDeg(first) !== null) { angle = toDeg(first); parts.shift(); }
    } else {
      let pos = { x: 50, y: 50 };
      if (!parseColor(first.split(/\s+/)[0])) {
        const at = first.split(/\s*\bat\s+/i)[1];
        if (at) { const p = parsePosition(at.trim().split(/\s+/), 100, 100); pos = { x: p.x, y: p.y }; }
        parts.shift();
      }
      path = `<a:path path="circle"><a:fillToRect l="${Math.round(pos.x * 1000)}" t="${Math.round(pos.y * 1000)}" r="${Math.round((100 - pos.x) * 1000)}" b="${Math.round((100 - pos.y) * 1000)}"/></a:path>`;
    }
    const stops = parseStops(parts, 1000);
    if (stops.length < 2 || stops.some(st => !st.color && st.color !== null)) return null;
    const gs = stops.map(st => {
      const c = st.color || { hex: 'FFFFFF', a: 0 };
      return `<a:gs pos="${Math.round(Math.max(0, Math.min(1, st.pos)) * 100000)}"><a:srgbClr val="${c.hex}"><a:alpha val="${Math.round(c.a * alphaMul * 100000)}"/></a:srgbClr></a:gs>`;
    }).join('');
    const lin = path ? '' : `<a:lin ang="${Math.round((((angle - 90) % 360) + 360) % 360 * 60000)}" scaled="0"/>`;
    return `<a:gradFill rotWithShape="1"><a:gsLst>${gs}</a:gsLst>${lin}${path}</a:gradFill>`;
  }
  function borderSides(cs) {
    return ['Top', 'Right', 'Bottom', 'Left'].map(s => {
      const style = cs[`border${s}Style`];
      const width = style === 'none' || style === 'hidden' ? 0 : px(cs[`border${s}Width`]);
      return { width, style, color: width ? parseColor(cs[`border${s}Color`]) : null };
    });
  }
  const dashOf = style => style === 'dashed' ? 'dash' : style === 'dotted' ? 'sysDot' : 'solid';

  // Dégradés natifs : PptxGenJS ne sait pas les écrire ; la forme reçoit un nom repère puis
  // son remplissage est remplacé par <a:gradFill> à l'enregistrement (voir save()).
  const GRAD_PREFIX = 'obsgrad-';
  const gradientRegistry = new Map();
  function registerGradient(xml) { const id = gradientRegistry.size + 1; gradientRegistry.set(String(id), xml); return id; }

  /* ---------------------------------------------------------------- moteur */
  class SlideCapture {
    constructor(root, opts) {
      this.root = root;
      this.opts = opts;
      this.items = [];
      this.pending = [];
      this.gid = 0;
      this.ignore = [DEFAULT_IGNORE, opts.ignoreSelector].filter(Boolean).join(',');
      const rr = root.getBoundingClientRect();
      this.origin = { x: rr.left, y: rr.top };
      this.k = root.offsetWidth ? rr.width / root.offsetWidth : 1;        // échelle écran de la racine
      this.W = root.offsetWidth || rr.width;
      this.H = root.offsetHeight || rr.height;
      this.inPerPx = SLIDE_W_IN / this.W;
      this.ptPerPx = this.inPerPx * 72;
      this.scaleCache = new Map();
    }
    rel(r) { return { x: (r.left - this.origin.x) / this.k, y: (r.top - this.origin.y) / this.k, w: r.width / this.k, h: r.height / this.k }; }
    inch(r) { return { x: +(r.x * this.inPerPx).toFixed(4), y: +(r.y * this.inPerPx).toFixed(4), w: +(Math.max(r.w, 0.5) * this.inPerPx).toFixed(4), h: +(Math.max(r.h, 0.5) * this.inPerPx).toFixed(4) }; }
    // Échelle cumulée des transformations CSS d'un élément HTML, relative à la racine.
    localScale(el) {
      if (!el || el === this.root) return 1;
      if (this.scaleCache.has(el)) return this.scaleCache.get(el);
      let s = 1;
      if (el instanceof HTMLElement && el.offsetWidth > 0) s = el.getBoundingClientRect().width / el.offsetWidth / this.k;
      else s = this.localScale(el.parentElement);
      if (!isFinite(s) || s <= 0) s = 1;
      this.scaleCache.set(el, s);
      return s;
    }
    push(item) { this.items.push(item); return item; }
    later(promise) { this.pending.push(promise); }
    name(el, kind) {
      const cls = (typeof el.className === 'string' ? el.className : el.getAttribute && el.getAttribute('class') || '').split(/\s+/).filter(Boolean)[0];
      return (kind + (cls ? ' · ' + cls : '')).slice(0, 80);
    }

    /* ---------- parcours HTML (ordre de peinture CSS simplifié) ---------- */
    capture() {
      const rootCs = getComputedStyle(this.root);
      const bg = parseColor(rootCs.backgroundColor);
      this.background = bg && bg.a >= 0.999 ? bg.hex : 'FFFFFF';
      const ctx = { opacity: 1, clip: { x: 0, y: 0, w: this.W, h: this.H } };
      const layer = this.newLayer();
      this.visit(this.root, ctx, layer, true);
      return this.flatten(layer);
    }
    newLayer() { return { own: [], neg: [], normal: [], zero: [], pos: [] }; }
    flatten(L) {
      const byZ = arr => arr.slice().sort((a, b) => a.z - b.z).flatMap(e => e.items);
      return [...L.own, ...byZ(L.neg), ...L.normal, ...L.zero.flatMap(e => e.items), ...byZ(L.pos)];
    }
    createsLayer(cs) {
      return cs.position !== 'static' || parseFloat(cs.opacity) < 1 || cs.transform !== 'none' || cs.filter !== 'none' || cs.isolation === 'isolate';
    }
    visit(el, ctx, layer, isRoot = false, isLayerRoot = false) {
      if (el.matches && el.matches(this.ignore)) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return;
      const opacity = ctx.opacity * (parseFloat(cs.opacity) || 0);
      if (opacity <= 0.003) return;
      const r = this.rel(el.getBoundingClientRect());
      const visible = cs.visibility !== 'hidden' && cs.visibility !== 'collapse';
      const sink = isRoot || isLayerRoot ? layer.own : layer.normal;
      const before = this.items.length;
      const tag = el.tagName.toLowerCase();

      if (el instanceof SVGSVGElement) { if (visible) this.svgElement(el, r, ctx, opacity); this.moveNewItems(before, sink); return; }
      if (tag === 'img') { if (visible) this.imageElement(el, cs, r, ctx, opacity); this.moveNewItems(before, sink); return; }
      if (tag === 'canvas') { if (visible) this.canvasElement(el, r, ctx, opacity); this.moveNewItems(before, sink); return; }
      if (tag === 'input' || tag === 'textarea' || tag === 'select') { if (visible) { this.box(el, cs, r, ctx, opacity, isRoot); this.formValue(el, cs, r, ctx, opacity); } this.moveNewItems(before, sink); return; }

      if (visible && !(isRoot)) this.box(el, cs, r, ctx, opacity, isRoot);
      if (cs.display !== 'inline' || isRoot) this.textBlock(el, cs, ctx, opacity);
      this.moveNewItems(before, sink);

      let clip = ctx.clip;
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || (cs.contain && /paint|strict|content/.test(cs.contain))) {
        const bl = px(cs.borderLeftWidth), bt = px(cs.borderTopWidth), s = this.localScale(el);
        clip = intersect({ x: r.x + bl * s, y: r.y + bt * s, w: el.clientWidth ? el.clientWidth * s : r.w, h: el.clientHeight ? el.clientHeight * s : r.h }, clip);
      }
      const childCtx = { opacity, clip };
      for (const child of el.children) {
        if (!(child instanceof Element)) continue;
        const ccs = getComputedStyle(child);
        if (ccs.display === 'none') continue;
        if (this.createsLayer(ccs) && !(child instanceof SVGElement && !(child instanceof SVGSVGElement))) {
          const sub = this.newLayer();
          this.visit(child, childCtx, sub, false, true);
          const z = ccs.zIndex === 'auto' ? 0 : parseInt(ccs.zIndex, 10) || 0;
          const entry = { z, items: this.flatten(sub) };
          if (z < 0) layer.neg.push(entry); else if (z === 0) layer.zero.push(entry); else layer.pos.push(entry);
        } else {
          this.visit(child, childCtx, layer);
        }
      }
    }
    moveNewItems(before, target) {
      if (this.items.length > before) target.push(...this.items.splice(before));
    }

    /* ---------- fonds, bordures, ombres ---------- */
    box(el, cs, r, ctx, opacity) {
      if (isEmpty(r)) return;
      const vis = intersect(r, ctx.clip);
      if (isEmpty(vis)) return;
      const bg = parseColor(cs.backgroundColor);
      const layers = cs.backgroundImage && cs.backgroundImage !== 'none' ? splitTopLevel(cs.backgroundImage) : [];
      const gradients = layers.filter(l => /gradient\(/i.test(l));
      const urls = layers.map(l => (l.match(/^url\(["']?(.*?)["']?\)$/i) || [])[1]).filter(Boolean);
      const sides = borderSides(cs);
      const s = this.localScale(el);
      const rad = cornerRadii(cs, r.w / s, r.h / s).map(c => ({ x: c.x * s, y: c.y * s }));
      const anyRadius = rad.some(c => c.x > 0.25 || c.y > 0.25);
      const sameRadius = rad.every(c => Math.abs(c.x - rad[0].x) < 0.5 && Math.abs(c.y - rad[0].y) < 0.5 && Math.abs(c.x - c.y) < 0.5);
      const borderOn = sides.filter(b => b.width > 0 && b.color);
      const widthSides = sides.filter(b => b.width > 0);
      const uniformBorder = borderOn.length === 4 && borderOn.every(b => b.width === borderOn[0].width && b.style === borderOn[0].style && b.color.hex === borderOn[0].color.hex && b.color.a === borderOn[0].color.a);
      const shadows = parseShadows(cs.boxShadow);
      const clipD = cs.clipPath && cs.clipPath !== 'none' ? clipPathD(cs.clipPath, r.w / s, r.h / s) : null;
      const clipped = vis.w < r.w - 0.5 || vis.h < r.h - 0.5;
      if (!bg && !gradients.length && !urls.length && !borderOn.length && !shadows.length) return;

      // Anneaux / ombres nettes (sans flou) : formes pleines sous la boîte, de la plus basse à la plus haute.
      const blurred = shadows.find(sh => sh.blur > 0.5);
      if (!clipD) shadows.filter(sh => sh.blur <= 0.5).reverse().forEach(sh => {
        const sp = sh.spread * s;
        const g = { x: r.x + sh.ox * s - sp, y: r.y + sh.oy * s - sp, w: r.w + 2 * sp, h: r.h + 2 * sp };
        this.nativeShape(el, g, rad.map(c => ({ x: c.x + sp, y: c.y + sp })), anyRadius && sameRadius, sh.color, null, null, opacity, s, 'Contour');
      });

      // Bordures de couleurs différentes ou transparentes sur d'autres côtés (triangles CSS…) : trapèzes exacts.
      const sameColor = (a, b) => a.color.hex === b.color.hex && a.color.a === b.color.a;
      const trapezoids = !uniformBorder && borderOn.length > 0 && widthSides.length >= 2 && (borderOn.length !== widthSides.length || borderOn.some(b => !sameColor(b, borderOn[0])));
      const singleGradient = gradients.length === 1 && !/repeating-|conic-/i.test(gradients[0]) ? nativeGradientXml(gradients[0], opacity) : null;
      const nativeOk = !clipD && !clipped && !trapezoids && (!anyRadius || sameRadius) && (borderOn.length === 0 || uniformBorder || !anyRadius);
      if (nativeOk && (!gradients.length || singleGradient)) {
        if (bg && singleGradient) this.nativeShape(el, r, rad, anyRadius, bg, null, null, opacity, s, 'Fond');
        const fill = singleGradient ? { gradient: singleGradient, base: this.firstGradientColor(gradients) || bg } : bg;
        if (fill || uniformBorder || blurred) this.nativeShape(el, r, rad, anyRadius, fill, uniformBorder ? borderOn[0] : null, blurred, opacity, s);
        if (!uniformBorder) this.sideBorders(el, r, sides, opacity, s);
      } else {
        if (blurred && !clipD) this.nativeShape(el, r, rad, anyRadius && sameRadius, bg || (gradients.length ? this.firstGradientColor(gradients) : null) || { hex: 'FFFFFF', a: 1 }, null, blurred, opacity, s, 'Ombre');
        this.svgBox(el, r, vis, rad, bg, gradients, sides, opacity, s, clipD, trapezoids);
      }
      urls.forEach(u => this.backgroundImage(el, cs, r, vis, u, opacity));
    }
    firstGradientColor(gradients) {
      for (const m of String(gradients[0]).matchAll(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/gi)) { const c = parseColor(m[0]); if (c) return c; }
      return null;
    }
    nativeShape(el, r, rad, rounded, fillColor, border, shadow, opacity, s, label = 'Forme') {
      const isEllipse = rounded && rad.every(c => c.x >= r.w / 2 - 0.5 && c.y >= r.h / 2 - 0.5);
      const bw = border ? border.width * s : 0;
      const geom = { x: r.x + bw / 2, y: r.y + bw / 2, w: r.w - bw, h: r.h - bw };
      const opts = Object.assign(this.inch(geom), { objectName: this.name(el, label) });
      if (fillColor && fillColor.gradient) {
        const id = registerGradient(fillColor.gradient);
        const base = fillColor.base || { hex: 'FFFFFF', a: 1 };
        opts.fill = { color: base.hex, transparency: transparencyOf(base.a * opacity) };
        opts.objectName = `${GRAD_PREFIX}${id}|${opts.objectName}`;
      } else if (fillColor) opts.fill = { color: fillColor.hex, transparency: transparencyOf(fillColor.a * opacity) };
      else opts.fill = { type: 'none' };
      if (border) opts.line = { color: border.color.hex, width: +(bw * this.ptPerPx).toFixed(2), transparency: transparencyOf(border.color.a * opacity), dashType: dashOf(border.style) };
      else opts.line = { type: 'none' };
      if (shadow) {
        opts.shadow = {
          type: 'outer', color: shadow.color.hex,
          opacity: +Math.min(1, shadow.color.a * opacity).toFixed(3),
          blur: +(shadow.blur * s * this.ptPerPx / 2).toFixed(2),
          offset: +(Math.hypot(shadow.ox, shadow.oy) * s * this.ptPerPx).toFixed(2),
          angle: Math.round((Math.atan2(shadow.oy, shadow.ox) * 180 / Math.PI + 360) % 360)
        };
      }
      let shape = 'rect';
      if (isEllipse) shape = 'ellipse';
      else if (rounded) { shape = 'roundRect'; opts.rectRadius = +(Math.max(0, Math.min(rad[0].x - bw / 2, Math.min(geom.w, geom.h) / 2)) * this.inPerPx).toFixed(4); }
      this.push({ type: 'shape', shape, opts });
    }
    sideBorders(el, r, sides, opacity, s) {
      const [t, rt, b, l] = sides;
      const bar = (x, y, w, h, side, horizontal) => {
        if (!side.width || !side.color) return;
        const common = { objectName: this.name(el, 'Bordure') };
        if (side.style === 'dotted' || side.style === 'dashed') {
          // Pointillés / tirets : trait natif sur l'axe de la bordure.
          const thick = horizontal ? h : w;
          const geo = horizontal ? { x, y: y + h / 2, w, h: 0 } : { x: x + w / 2, y, w: 0, h };
          return this.push({ type: 'shape', shape: 'line', opts: Object.assign({ x: +(geo.x * this.inPerPx).toFixed(4), y: +(geo.y * this.inPerPx).toFixed(4), w: +(geo.w * this.inPerPx).toFixed(4), h: +(geo.h * this.inPerPx).toFixed(4) }, common, { line: { color: side.color.hex, width: +(thick * this.ptPerPx).toFixed(2), transparency: transparencyOf(side.color.a * opacity), dashType: side.style === 'dotted' ? 'sysDot' : 'dash' } }) });
        }
        this.push({ type: 'shape', shape: 'rect', opts: Object.assign(this.inch({ x, y, w, h }), common, { fill: { color: side.color.hex, transparency: transparencyOf(side.color.a * opacity) }, line: { type: 'none' } }) });
      };
      bar(r.x, r.y, r.w, t.width * s, t, true);
      bar(r.x, r.y + r.h - b.width * s, r.w, b.width * s, b, true);
      bar(r.x, r.y, l.width * s, r.h, l, false);
      bar(r.x + r.w - rt.width * s, r.y, rt.width * s, r.h, rt, false);
    }
    svgBox(el, r, vis, rad, bg, gradients, sides, opacity, s, clipD, trapezoids) {
      const w = r.w, h = r.h;
      const outer = roundedPath(0, 0, w, h, rad);
      let body = '';
      if (bg) body += `<path d="${outer}" fill="#${bg.hex}" fill-opacity="${bg.a}"/>`;
      gradients.slice().reverse().forEach(g => { body += gradientLayerSvg(g, w, h, outer, 'g' + (++this.gid)); });
      const on = sides.filter(b => b.width > 0 && b.color);
      if (on.length) {
        const [t, rt, b, l] = sides.map(sd => sd.width * s);
        const fill = sd => `fill="#${sd.color.hex}" fill-opacity="${sd.color.a}"`;
        if (trapezoids && !rad.some(c => c.x > 0.25)) {
          // Rendu exact des bordures CSS : un trapèze par côté (onglets, triangles, flèches).
          const poly = (pts, sd) => sd.width > 0 && sd.color ? `<path d="M${pts.map(p => p.map(v => +v.toFixed(3)).join(' ')).join(' L')} Z" ${fill(sd)}/>` : '';
          body += poly([[0, 0], [w, 0], [w - rt, t], [l, t]], sides[0]) + poly([[w, 0], [w, h], [w - rt, h - b], [w - rt, t]], sides[1]) +
            poly([[0, h], [w, h], [w - rt, h - b], [l, h - b]], sides[2]) + poly([[0, 0], [0, h], [l, h - b], [l, t]], sides[3]);
        } else {
          const inner = roundedPath(l, t, Math.max(0, w - l - rt), Math.max(0, h - t - b), rad.map((c, i) => ({
            x: Math.max(0, c.x - (i === 0 || i === 3 ? l : rt)), y: Math.max(0, c.y - (i < 2 ? t : b))
          })));
          const same = on.every(sd => sd.color.hex === on[0].color.hex && sd.color.a === on[0].color.a);
          if (same) body += `<path d="${outer} ${inner}" fill-rule="evenodd" ${fill(on[0])}/>`;
          else {
            const cid = 'c' + (++this.gid);
            body += `<defs><clipPath id="${cid}"><path d="${outer} ${inner}" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#${cid})">`;
            const rect = (x, y, ww, hh, sd) => sd.color ? `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" ${fill(sd)}/>` : '';
            body += rect(0, 0, w, Math.max(t, 0.01), sides[0]) + rect(0, h - b, w, b, sides[2]) + rect(0, 0, l, h, sides[3]) + rect(w - rt, 0, rt, h, sides[1]) + '</g>';
          }
        }
      }
      if (!body) return;
      if (clipD) {
        const cp = 'k' + (++this.gid);
        const k = s !== 1 ? ` transform="scale(${s})"` : '';
        body = `<defs><clipPath id="${cp}"><path d="${clipD}"${k}/></clipPath></defs><g clip-path="url(#${cp})">${body}</g>`;
      }
      const vx = vis.x - r.x, vy = vis.y - r.y;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${(vis.w * SVG_RASTER_SCALE).toFixed(1)}" height="${(vis.h * SVG_RASTER_SCALE).toFixed(1)}" viewBox="${vx} ${vy} ${vis.w} ${vis.h}">${body}</svg>`;
      this.push({ type: 'image', opts: Object.assign(this.inch(vis), { data: svgDataUrl(svg), objectName: this.name(el, 'Fond'), transparency: opacity < 1 ? transparencyOf(opacity) : 0 }) });
    }
    backgroundImage(el, cs, r, vis, url, opacity) {
      const item = this.push({ type: 'image', opts: Object.assign(this.inch(vis), { objectName: this.name(el, 'Image de fond'), transparency: opacity < 1 ? transparencyOf(opacity) : 0 }) });
      this.later((async () => {
        const data = await urlToDataUrl(url);
        const img = await loadImage(data);
        const sizes = String(cs.backgroundSize || 'auto').split(/\s+/);
        let dw = img.naturalWidth || r.w, dh = img.naturalHeight || r.h;
        const ratio = dw / dh;
        if (sizes[0] === 'cover' || sizes[0] === 'contain') {
          const sc = sizes[0] === 'cover' ? Math.max(r.w / dw, r.h / dh) : Math.min(r.w / dw, r.h / dh); dw *= sc; dh *= sc;
        } else if (sizes[0] !== 'auto') {
          const v = (p, size) => /%$/.test(p) ? parseFloat(p) / 100 * size : px(p);
          dw = v(sizes[0], r.w); dh = sizes[1] && sizes[1] !== 'auto' ? v(sizes[1], r.h) : dw / ratio;
        }
        const off = (v, free) => /%$/.test(v) ? free * parseFloat(v) / 100 : px(v);
        const ox = off(String(cs.backgroundPositionX || '0%').split(',')[0].trim(), r.w - dw);
        const oy = off(String(cs.backgroundPositionY || '0%').split(',')[0].trim(), r.h - dh);
        item.opts.data = await this.rasterize(img, vis, r, { x: r.x + ox, y: r.y + oy, w: dw, h: dh }, cornerRadii(cs, r.w, r.h));
      })().catch(() => { item.skip = true; }));
    }

    /* ---------- images ---------- */
    imageElement(img, cs, r, ctx, opacity) {
      const vis = intersect(r, ctx.clip);
      if (isEmpty(vis) || isEmpty(r)) return;
      const src = img.currentSrc || img.getAttribute('src');
      if (!src) return;
      const item = this.push({ type: 'image', opts: Object.assign(this.inch(vis), { objectName: (img.getAttribute('alt') || this.name(img, 'Image')).slice(0, 80), altText: img.getAttribute('alt') || '', transparency: opacity < 1 ? transparencyOf(opacity) : 0 }) });
      this.later((async () => {
        const data = await urlToDataUrl(src);
        const nw = img.naturalWidth, nh = img.naturalHeight;
        const fit = cs.objectFit || 'fill';
        const s = this.localScale(img);
        const rad = cornerRadii(cs, r.w / s, r.h / s).map(c => ({ x: c.x * s, y: c.y * s }));
        const rounded = rad.some(c => c.x > 0.5);
        // Zone réellement dessinée par le navigateur (object-fit / object-position).
        let dest = { x: r.x, y: r.y, w: r.w, h: r.h };
        if (nw && nh && fit !== 'fill') {
          let sc = fit === 'cover' ? Math.max(r.w / nw, r.h / nh) : fit === 'none' ? 1 : Math.min(r.w / nw, r.h / nh);
          if (fit === 'scale-down') sc = Math.min(1, sc);
          const p = String(cs.objectPosition || '50% 50%').split(/\s+/);
          const frac = (t, d) => /%$/.test(t) ? parseFloat(t) / 100 : t === 'left' || t === 'top' ? 0 : t === 'right' || t === 'bottom' ? 1 : d;
          const dw = nw * sc, dh = nh * sc;
          dest = { x: r.x + (r.w - dw) * frac(p[0], 0.5), y: r.y + (r.h - dh) * frac(p[1] || '50%', 0.5), w: dw, h: dh };
        }
        const shown = intersect(dest, vis);
        const filter = cs.filter && cs.filter !== 'none' ? cs.filter : '';
        const needsCrop = rounded || filter || shown.w < dest.w - 0.5 || shown.h < dest.h - 0.5;
        if (!needsCrop) { Object.assign(item.opts, this.inch(dest)); item.opts.data = data; return; }
        const im = await loadImage(data);
        item.opts.data = await this.rasterize(im, shown, r, dest, rounded ? rad : null, filter);
        Object.assign(item.opts, this.inch(shown));
      })().catch(() => { item.skip = true; }));
    }
    // Dessine `img` (posée sur `dest`) dans un PNG couvrant `area`, avec coins arrondis éventuels de `box`.
    async rasterize(img, area, box, dest, rad, filter = '') {
      const native = (img.naturalWidth || dest.w) / Math.max(1, dest.w);       // garde la définition d'origine
      const s = Math.max(1, Math.min(Math.max(2, native), MAX_RASTER_SIDE / Math.max(area.w, area.h)));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(area.w * s)); c.height = Math.max(1, Math.round(area.h * s));
      const g = c.getContext('2d');
      g.scale(s, s); g.translate(-area.x, -area.y);
      if (rad && rad.some(k => k.x > 0.5)) { g.clip(new Path2D(roundedPath(box.x, box.y, box.w, box.h, rad))); }
      if (filter) g.filter = filter;                           // ex. icône blanchie : brightness(0) invert(1)
      g.drawImage(img, dest.x, dest.y, dest.w, dest.h);
      return c.toDataURL('image/png');
    }
    canvasElement(cv, r, ctx, opacity) {
      const vis = intersect(r, ctx.clip);
      if (isEmpty(vis)) return;
      try { this.push({ type: 'image', opts: Object.assign(this.inch(r), { data: cv.toDataURL('image/png'), objectName: this.name(cv, 'Canvas'), transparency: opacity < 1 ? transparencyOf(opacity) : 0 }) }); } catch (e) { /* canvas contaminé : ignoré */ }
    }
    formValue(el, cs, r, ctx, opacity) {
      const value = el.tagName === 'SELECT' ? (el.selectedOptions[0] ? el.selectedOptions[0].textContent : '') : el.value;
      if (!value || el.type === 'checkbox' || el.type === 'radio' || el.type === 'range' || el.type === 'hidden') return;
      const c = parseColor(cs.color);
      const s = this.localScale(el);
      const pl = px(cs.paddingLeft) * s + px(cs.borderLeftWidth) * s;
      this.push({ type: 'text', runs: [{ text: value, options: this.runStyle(cs, s, opacity, c) }], opts: Object.assign(this.inch({ x: r.x + pl, y: r.y, w: r.w - pl, h: r.h }), { margin: 0, valign: 'middle', align: 'left', wrap: false, fit: 'none', isTextBox: true, objectName: this.name(el, 'Champ') }) });
    }

    /* ---------- textes HTML ---------- */
    runStyle(cs, scale, opacity, color) {
      const sizePx = px(cs.fontSize) * scale;
      const o = {
        fontFace: fontFace(cs.fontFamily, this.opts.defaultFont),
        fontSize: +(sizePx * this.ptPerPx).toFixed(2),
        bold: (parseInt(cs.fontWeight, 10) || 400) >= 600,
        italic: cs.fontStyle === 'italic' || cs.fontStyle === 'oblique'
      };
      if (color) { o.color = color.hex; const tr = transparencyOf(color.a * opacity); if (tr) o.transparency = tr; }
      const ls = cs.letterSpacing === 'normal' ? 0 : px(cs.letterSpacing) * scale;
      if (Math.abs(ls) > 0.05) o.charSpacing = +(ls * this.ptPerPx).toFixed(2);
      const deco = cs.textDecorationLine || cs.textDecoration || '';
      if (/underline/.test(deco)) o.underline = { style: 'sng' };
      if (/line-through/.test(deco)) o.strike = 'sngStrike';
      if (cs.verticalAlign === 'super') o.superscript = true;
      if (cs.verticalAlign === 'sub') o.subscript = true;
      return o;
    }
    // Rassemble les mots du flux en ligne de `block` (texte direct et descendants display:inline),
    // avec leur position mesurée à l'écran.
    collectWords(block, opacity) {
      const words = [];
      let pendingSpace = false;
      const walk = (node, inheritedOpacity) => {
        for (const child of node.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) {
            const parent = child.parentElement;
            const pcs = getComputedStyle(parent);
            if (pcs.visibility === 'hidden') { pendingSpace = pendingSpace || /\s/.test(child.data); continue; }
            const pre = /^pre/.test(pcs.whiteSpace) || pcs.whiteSpace === 'break-spaces';
            const data = child.data;
            const re = pre ? /[^\n]+|\n/g : /\S+/g;
            let m, last = 0;
            while ((m = re.exec(data))) {
              const gap = data.slice(last, m.index);
              if (/\s/.test(gap)) pendingSpace = true;
              last = m.index + m[0].length;
              if (m[0] === '\n') { words.push({ hardBreak: true }); pendingSpace = false; continue; }
              const range = document.createRange();
              range.setStart(child, m.index); range.setEnd(child, m.index + m[0].length);
              const rects = [...range.getClientRects()].filter(q => q.width > 0 || q.height > 0);
              if (!rects.length) continue;
              const scale = this.localScale(parent);
              const color = parseColor(pcs.color) || this.clippedTextColor(parent);
              if (!color) { pendingSpace = false; continue; }   // texte invisible (couleur transparente)
              // Un « mot » coupé sur plusieurs lignes (césure, mot trop long) : un morceau par ligne.
              const pieces = rects.length > 1 ? this.splitWordByLines(child, m.index, m[0], rects) : [{ text: m[0], rect: rects[0] }];
              let offset = m.index;
              pieces.forEach((p, i) => { words.push({
                text: applyTextTransform(p.text, pcs.textTransform), raw: p.text, node: child, start: offset,
                rect: this.rel(p.rect), space: i === 0 ? pendingSpace : false,
                style: this.runStyle(pcs, scale, inheritedOpacity, color), fontPx: px(pcs.fontSize) * scale,
                el: parent, transform: pcs.textTransform
              }); offset += p.text.length; });
              pendingSpace = false;
            }
            if (/\s/.test(data.slice(last))) pendingSpace = true;
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            if (child.matches(this.ignore)) continue;
            if (child.tagName === 'BR') { words.push({ hardBreak: true }); pendingSpace = false; continue; }
            if (child instanceof SVGElement) continue;
            const ccs = getComputedStyle(child);
            if (ccs.display !== 'inline' || ['IMG', 'CANVAS', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(child.tagName)) { pendingSpace = pendingSpace || false; continue; }
            const op = inheritedOpacity * (parseFloat(ccs.opacity) || 0);
            if (op <= 0.003) continue;
            walk(child, op);
          }
        }
      };
      walk(block, opacity);
      return words;
    }
    ellipsize(words, limit) {
      const idx = words.findIndex(w => !w.hardBreak && w.rect.x + w.rect.w > limit + 0.5);
      if (idx < 0) return words;
      const w = Object.assign({}, words[idx]);
      const ell = w.fontPx;                                   // largeur de « … » en Arial ≈ 1 em
      let keep = '', right = w.rect.x;
      if (w.node) {
        const range = document.createRange();
        for (let i = 0; i < w.raw.length; i++) {
          range.setStart(w.node, w.start + i); range.setEnd(w.node, w.start + i + 1);
          const q = this.rel(range.getBoundingClientRect());
          if (q.x + q.w > limit - ell + 0.5) break;
          keep += w.raw[i]; right = q.x + q.w;
        }
      }
      w.text = applyTextTransform(keep, w.transform) + '…';
      w.rect = Object.assign({}, w.rect, { w: Math.max(0, right - w.rect.x) + ell });
      return words.slice(0, idx).concat(w);
    }
    // Texte en dégradé (background-clip: text) : couleur dominante du dégradé.
    clippedTextColor(el) {
      for (let n = el; n && n !== this.root.parentElement; n = n.parentElement) {
        const st = getComputedStyle(n);
        if ((st.webkitBackgroundClip || st.backgroundClip) === 'text') {
          const g = st.backgroundImage !== 'none' ? splitTopLevel(st.backgroundImage) : [];
          return (g.length && this.firstGradientColor(g)) || parseColor(st.backgroundColor);
        }
      }
      return null;
    }
    splitWordByLines(node, start, text, rects) {
      const out = []; let cur = '', curTop = null, curRect = null;
      const range = document.createRange();
      for (let i = 0; i < text.length; i++) {
        range.setStart(node, start + i); range.setEnd(node, start + i + 1);
        const q = range.getBoundingClientRect();
        if (curTop !== null && q.top > curTop + q.height * 0.5) { out.push({ text: cur, rect: curRect }); cur = ''; curRect = null; }
        if (curTop === null || cur === '') curTop = q.top;
        cur += text[i];
        curRect = curRect ? new DOMRect(Math.min(curRect.left, q.left), Math.min(curRect.top, q.top), Math.max(curRect.right, q.right) - Math.min(curRect.left, q.left), Math.max(curRect.bottom, q.bottom) - Math.min(curRect.top, q.top)) : q;
      }
      if (cur) out.push({ text: cur, rect: curRect });
      return out.length ? out : [{ text, rect: rects[0] }];
    }
    textBlock(block, cs, ctx, opacity) {
      let hasDirect = false;
      for (const n of block.childNodes) {
        if (n.nodeType === Node.TEXT_NODE && n.data.trim()) { hasDirect = true; break; }
        if (n.nodeType === Node.ELEMENT_NODE && !(n instanceof SVGElement) && getComputedStyle(n).display === 'inline' && n.textContent.trim()) { hasDirect = true; break; }
      }
      if (!hasDirect) return;
      let all = this.collectWords(block, opacity);
      let clip = ctx.clip;
      if (cs.overflowX !== 'visible') {
        // Texte coupé par sa propre boîte (overflow hidden) et, le cas échéant, terminé par « … ».
        const br = this.rel(block.getBoundingClientRect()), sc = this.localScale(block);
        const pad = { x: br.x + px(cs.borderLeftWidth) * sc, y: br.y + px(cs.borderTopWidth) * sc, w: br.w - (px(cs.borderLeftWidth) + px(cs.borderRightWidth)) * sc, h: br.h - (px(cs.borderTopWidth) + px(cs.borderBottomWidth)) * sc };
        clip = intersect(pad, clip);
        if (cs.textOverflow === 'ellipsis') all = this.ellipsize(all, pad.x + pad.w - px(cs.paddingRight) * sc);
      }
      const words = all.filter(w => w.hardBreak || (w.rect.x + w.rect.w / 2 >= clip.x - 1 && w.rect.x + w.rect.w / 2 <= clip.x + clip.w + 1 && w.rect.y + w.rect.h / 2 >= clip.y - 1 && w.rect.y + w.rect.h / 2 <= clip.y + clip.h + 1));
      if (!words.some(w => !w.hardBreak)) return;

      // Lignes, telles que le navigateur les a coupées.
      const lines = [];
      let line = null, prev = null, forceNew = false;
      for (const w of words) {
        if (w.hardBreak) { forceNew = true; continue; }
        const r = w.rect;
        const newLine = !line || forceNew || (r.y > line.bottom - Math.min(r.h, line.bottom - line.top) * 0.5) || (prev && r.x < prev.rect.x - 1 && r.y > line.top + 1);
        if (newLine) { line = { words: [], top: r.y, bottom: r.y + r.h }; lines.push(line); w.space = false; }
        line.words.push(w);
        line.top = Math.min(line.top, r.y); line.bottom = Math.max(line.bottom, r.y + r.h);
        prev = w; forceNew = false;
      }
      // Un grand écart horizontal dans une ligne (colonnes, flex, inline-block) : zones séparées.
      const clusters = lines.map(l => {
        const groups = [[l.words[0]]];
        for (let i = 1; i < l.words.length; i++) {
          const a = l.words[i - 1], b = l.words[i];
          const gap = b.rect.x - (a.rect.x + a.rect.w);
          if (gap > Math.max(b.fontPx, a.fontPx) * 1.1) { groups.push([b]); b.space = false; } else groups[groups.length - 1].push(b);
        }
        return groups;
      });
      const align = /center/.test(cs.textAlign) ? 'center' : /right|end/.test(cs.textAlign) ? 'right' : cs.textAlign === 'justify' ? 'justify' : 'left';
      if (clusters.every(g => g.length === 1)) this.emitText(block, cs, lines.map(l => l.words), align);
      else clusters.forEach(groups => groups.forEach(g => this.emitText(block, cs, [g], groups.length > 1 ? 'left' : align)));
    }
    emitText(block, cs, lines, align) {
      const runs = [];
      lines.forEach((words, li) => {
        words.forEach((w, wi) => {
          const text = (wi > 0 && w.space ? ' ' : '') + w.text;
          const last = runs[runs.length - 1];
          const sameStyle = last && wi > 0 && JSON.stringify(last.options) === JSON.stringify(w.style);
          if (sameStyle) last.text += text;
          else runs.push({ text, options: Object.assign({}, w.style, li > 0 && wi === 0 ? { softBreakBefore: true } : {}) });
        });
      });
      const flat = lines.flat();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, maxFont = 0;
      flat.forEach(w => { x0 = Math.min(x0, w.rect.x); y0 = Math.min(y0, w.rect.y); x1 = Math.max(x1, w.rect.x + w.rect.w); y1 = Math.max(y1, w.rect.y + w.rect.h); maxFont = Math.max(maxFont, w.fontPx); });
      const n = lines.length;
      const centers = lines.map(ws => { let t = Infinity, b = -Infinity; ws.forEach(w => { t = Math.min(t, w.rect.y); b = Math.max(b, w.rect.y + w.rect.h); }); return (t + b) / 2; });
      const pitch = n > 1 ? (centers[n - 1] - centers[0]) / (n - 1) : 0;
      const textW = x1 - x0;
      const slack = textW * 0.06 + maxFont * 0.8;            // marge : écarts de métrique entre navigateur et PowerPoint
      let w = textW + slack, x = x0;
      if (align === 'center') x = x0 - slack / 2;
      else if (align === 'right') x = x0 - slack;
      if (align === 'justify') { w = textW + maxFont * 0.2; }
      const lineH = n > 1 ? pitch : maxFont * 1.2;
      const h = Math.max(y1 - y0, n * lineH);
      const cy = (y0 + y1) / 2;
      const opts = Object.assign(this.inch({ x, y: cy - h / 2, w, h }), {
        margin: 0, valign: 'middle', align: align === 'justify' ? 'left' : align, fit: 'none', isTextBox: true,
        wrap: n > 1, paraSpaceBefore: 0, paraSpaceAfter: 0, objectName: this.name(block, 'Texte')
      });
      if (n > 1 && pitch > 0) opts.lineSpacing = +(pitch * this.ptPerPx).toFixed(2);
      this.push({ type: 'text', runs, opts });
    }

    /* ---------- SVG en ligne ---------- */
    svgElement(svg, r, ctx, opacity) {
      const vis = intersect(r, ctx.clip);
      if (isEmpty(vis) || isEmpty(r)) return;
      const clone = svg.cloneNode(true);
      const origs = [svg, ...svg.querySelectorAll('*')];
      const copies = [clone, ...clone.querySelectorAll('*')];
      const nativeTexts = [];
      const removals = [];
      const extractText = this.opts.svgTextMode !== 'image';
      origs.forEach((o, i) => {
        const c = copies[i];
        const tag = o.tagName.toLowerCase();
        if (tag === 'foreignobject' || tag === 'script' || (o.matches && o.matches('[data-pptx-ignore]'))) { removals.push(c); return; }
        const st = getComputedStyle(o);
        const inDefs = !!o.closest(SVG_NON_RENDERED);
        if (!inDefs && st.display === 'none') { removals.push(c); return; }
        if (extractText && tag === 'text' && !inDefs) { nativeTexts.push(o); removals.push(c); return; }
        this.inlineSvgStyle(o, c, st, i === 0);
      });
      removals.forEach(c => c.remove());
      // <use> pointant vers un sprite hors de ce SVG : la cible est recopiée.
      clone.querySelectorAll('use').forEach(u => {
        const href = u.getAttribute('href') || u.getAttribute('xlink:href') || '';
        if (!href.startsWith('#') || clone.querySelector(href.replace(/([^\w#-])/g, '\\$1'))) return;
        const target = document.getElementById(href.slice(1));
        if (target) { let defs = clone.querySelector(':scope > defs'); if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); clone.insertBefore(defs, clone.firstChild); } defs.appendChild(target.cloneNode(true)); }
      });
      const s = this.localScale(svg.parentElement) || 1;
      const localW = svg.clientWidth || svg.width.baseVal.value || r.w / s;
      const localH = svg.clientHeight || svg.height.baseVal.value || r.h / s;
      if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${localW} ${localH}`);
      ['class', 'id', 'width', 'height', 'x', 'y'].forEach(a => clone.removeAttribute(a));
      clone.setAttribute('width', r.w); clone.setAttribute('height', r.h);
      clone.setAttribute('x', 0); clone.setAttribute('y', 0);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const item = this.push({ type: 'image', opts: Object.assign(this.inch(vis), { objectName: (svg.getAttribute('aria-label') || this.name(svg, 'Graphique SVG')).slice(0, 80), transparency: opacity < 1 ? transparencyOf(opacity) : 0 }) });
      this.later((async () => {
        await Promise.all([...clone.querySelectorAll('image')].map(async im => {
          const href = im.getAttribute('href') || im.getAttribute('xlink:href');
          if (!href || /^data:/.test(href)) return;
          try { const d = await urlToDataUrl(href); im.setAttribute('href', d); im.removeAttribute('xlink:href'); } catch (e) { im.remove(); }
        }));
        const inner = new XMLSerializer().serializeToString(clone).replace(/\s+xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
        const vx = vis.x - r.x, vy = vis.y - r.y;
        const wrapper = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${(vis.w * SVG_RASTER_SCALE).toFixed(1)}" height="${(vis.h * SVG_RASTER_SCALE).toFixed(1)}" viewBox="${vx.toFixed(3)} ${vy.toFixed(3)} ${vis.w.toFixed(3)} ${vis.h.toFixed(3)}">${inner}</svg>`;
        item.opts.data = svgDataUrl(wrapper);
      })().catch(() => { item.skip = true; }));
      nativeTexts.forEach(t => this.svgText(t, vis, opacity));
    }
    inlineSvgStyle(o, c, st, isRoot) {
      const props = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset',
        'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'visibility', 'font-family', 'font-size', 'font-weight', 'font-style',
        'text-anchor', 'dominant-baseline', 'letter-spacing', 'stop-color', 'stop-opacity', 'paint-order', 'vector-effect', 'clip-path', 'clip-rule',
        'mask', 'marker-start', 'marker-mid', 'marker-end', 'shape-rendering', 'color', 'filter', 'mix-blend-mode'];
      const decl = [];
      for (const p of props) {
        let v = st.getPropertyValue(p);
        if (!v) continue;
        v = v.replace(/url\(\s*["']?[^"')]*?(#[^"')]+)["']?\s*\)/g, 'url($1)');
        if (isRoot && (p === 'opacity' || p === 'filter' || p === 'mix-blend-mode')) continue; // déjà appliqué par l'export
        decl.push(`${p}:${v}`);
      }
      if (!isRoot && st.transform && st.transform !== 'none' && !o.hasAttribute('transform')) {
        decl.push(`transform:${st.transform}`, `transform-origin:${st.transformOrigin}`, `transform-box:${st.transformBox}`);
      }
      c.removeAttribute('class');
      c.setAttribute('style', decl.join(';'));
    }
    svgText(textEl, vis, opacity) {
      const st = getComputedStyle(textEl);
      if (st.visibility === 'hidden') return;
      let op = opacity;
      for (let n = textEl; n && n instanceof SVGElement; n = n.parentElement) { op *= parseFloat(getComputedStyle(n).opacity) || 0; if (n instanceof SVGSVGElement) break; }
      if (op <= 0.003) return;
      // Chaque <tspan> repositionné (x / y / dy) forme sa propre ligne.
      const lineEls = [...textEl.children].filter(c => c.tagName.toLowerCase() === 'tspan' && (c.hasAttribute('x') || c.hasAttribute('y') || c.hasAttribute('dy')));
      const units = lineEls.length ? lineEls : [textEl];
      if (lineEls.length) {
        // texte « libre » hors tspan positionné : rattaché à la première ligne
        const loose = [...textEl.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.data.trim());
        if (loose) units.unshift(null);
      }
      const ctm = textEl.getScreenCTM();
      const ctmScale = ctm ? Math.hypot(ctm.a, ctm.b) / this.k : 1;
      const angle = ctm ? Math.atan2(ctm.b, ctm.a) * 180 / Math.PI : 0;
      units.forEach(unit => {
        const host = unit || textEl;
        const runs = [];
        const pushRuns = (node) => {
          for (const ch of node.childNodes) {
            if (ch.nodeType === Node.TEXT_NODE) {
              const txt = ch.data.replace(/\s+/g, ' ');
              if (!txt.trim() && !runs.length) continue;
              const pst = getComputedStyle(ch.parentElement);
              runs.push({ text: txt, options: this.svgRunStyle(pst, ctmScale, op) });
            } else if (ch.nodeType === Node.ELEMENT_NODE && (unit || !lineEls.includes(ch))) {
              if (getComputedStyle(ch).display === 'none') continue;
              pushRuns(ch);
            }
          }
        };
        if (unit) pushRuns(unit);
        else { for (const ch of textEl.childNodes) if (ch.nodeType === Node.TEXT_NODE) { const txt = ch.data.replace(/\s+/g, ' '); if (txt.trim()) runs.push({ text: txt, options: this.svgRunStyle(st, ctmScale, op) }); } }
        if (!runs.length) return;
        runs[0].text = runs[0].text.replace(/^\s+/, '');
        runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '');
        const content = runs.map(rn => rn.text).join('');
        if (!content.trim()) return;
        let box = (unit || textEl).getBoundingClientRect();
        if (!unit) {
          const loose = [...textEl.childNodes].filter(n => n.nodeType === Node.TEXT_NODE && n.data.trim());
          const range = document.createRange(); range.setStartBefore(loose[0]); range.setEndAfter(loose[loose.length - 1]);
          box = range.getBoundingClientRect();
        }
        const rr = this.rel(box);
        if (isEmpty(rr)) return;
        const cx = rr.x + rr.w / 2, cy = rr.y + rr.h / 2;
        if (cx < vis.x - 1 || cx > vis.x + vis.w + 1 || cy < vis.y - 1 || cy > vis.y + vis.h + 1) return;
        const ust = getComputedStyle(host);
        const fontPx = px(ust.fontSize) * ctmScale;
        const anchor = ust.textAnchor || st.textAnchor;
        const align = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left';
        let boxW, boxH, x, y, rotate = 0;
        if (Math.abs(angle) > 0.5) {
          let len = 0; try { len = (unit || textEl).getComputedTextLength() * ctmScale; if (!len) throw new Error('0'); } catch (e) { len = Math.max(rr.w, rr.h); }
          boxW = len + fontPx * 1.2; boxH = fontPx * 1.3;
          x = cx - boxW / 2; y = cy - boxH / 2; rotate = Math.round(((angle % 360) + 360) % 360 * 100) / 100;
          return this.push({ type: 'text', runs, opts: Object.assign(this.inch({ x, y, w: boxW, h: boxH }), { margin: 0, valign: 'middle', align: 'center', wrap: false, fit: 'none', rotate, isTextBox: true, objectName: 'Texte SVG' }) });
        }
        const slack = rr.w * 0.08 + fontPx * 0.8;
        boxW = rr.w + slack; boxH = Math.max(rr.h, fontPx * 1.2);
        x = align === 'center' ? rr.x - slack / 2 : align === 'right' ? rr.x - slack : rr.x;
        y = cy - boxH / 2;
        const glow = this.svgHalo(ust, ctmScale, op);
        if (glow) runs.forEach(rn => { rn.options.glow = Object.assign({}, glow); });
        this.push({ type: 'text', runs, opts: Object.assign(this.inch({ x, y, w: boxW, h: boxH }), { margin: 0, valign: 'middle', align, wrap: false, fit: 'none', isTextBox: true, objectName: 'Texte SVG' }) });
      });
    }
    svgRunStyle(st, scale, opacity) {
      const fill = /^url/.test(st.fill) ? null : parseColor(st.fill);
      const stroke = parseColor(st.stroke);
      const color = fill || (st.fill === 'none' ? stroke : { hex: '000000', a: 1 });
      const o = this.runStyle(st, scale, opacity * (parseFloat(st.fillOpacity) || 1), color);
      return o;
    }
    svgHalo(st, scale, opacity) {
      // Texte détouré (paint-order: stroke) : halo reproduit par une lueur de la couleur du contour.
      if (!/^stroke/.test(st.paintOrder || '')) return null;
      const stroke = parseColor(st.stroke);
      const width = px(st.strokeWidth) * scale;
      if (!stroke || width <= 0) return null;
      return { size: +(width * this.ptPerPx * 0.6).toFixed(2), opacity: +Math.min(1, stroke.a * opacity * (parseFloat(st.strokeOpacity) || 1)).toFixed(2), color: stroke.hex };
    }
  }

  /* ---------------------------------------------------------------- pseudo-éléments */
  // ::before / ::after n'ont pas de géométrie accessible : ils sont matérialisés le temps
  // de la mesure par des <span> portant exactement leur style calculé.
  function materializePseudos(root, ignore) {
    const created = [], hidden = [];
    const styleTag = document.createElement('style');
    styleTag.textContent = '[data-pptx-nobefore]::before{content:none!important}[data-pptx-noafter]::after{content:none!important}';
    const candidates = [];
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el instanceof SVGElement || el.matches(ignore)) continue;
      for (const which of ['::before', '::after']) {
        const st = getComputedStyle(el, which);
        const content = st.content;
        if (!content || content === 'none' || content === 'normal' || st.display === 'none') continue;
        candidates.push({ el, which, st });
      }
    }
    const SKIP = new Set(['content', 'quotes', 'counter-increment', 'counter-reset', 'counter-set', 'transition', 'animation']);
    const prepared = candidates.map(({ el, which, st }) => {
      const span = document.createElement('span');
      span.setAttribute('data-pptx-pseudo', which);
      span.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < st.length; i++) {
        const p = st[i];
        if (SKIP.has(p) || p.startsWith('transition') || p.startsWith('animation')) continue;
        span.style.setProperty(p, st.getPropertyValue(p));
      }
      const parts = (st.content.match(/"((?:[^"\\]|\\.)*)"/g) || []).map(q => q.slice(1, -1).replace(/\\a/g, '\n').replace(/\\(.)/g, '$1'));
      span.textContent = parts.join('');
      const url = (st.content.match(/url\(["']?([^"')]+)["']?\)/) || [])[1];
      if (url && !span.textContent) { const img = document.createElement('img'); img.src = url; img.style.cssText = 'width:100%;height:100%;display:block'; span.appendChild(img); }
      return { el, which, span };
    });
    document.head.appendChild(styleTag);
    prepared.forEach(({ el, which, span }) => {
      el.setAttribute(which === '::before' ? 'data-pptx-nobefore' : 'data-pptx-noafter', '');
      hidden.push([el, which === '::before' ? 'data-pptx-nobefore' : 'data-pptx-noafter']);
      if (which === '::before') el.insertBefore(span, el.firstChild); else el.appendChild(span);
      created.push(span);
    });
    return () => {
      created.forEach(s => s.remove());
      hidden.forEach(([el, attr]) => el.removeAttribute(attr));
      styleTag.remove();
    };
  }

  /* ---------------------------------------------------------------- API */
  function createPresentation(meta = {}) {
    if (typeof global.PptxGenJS !== 'function') throw new Error('Le module PPTX (pptxgen.min.js) n’est pas chargé.');
    gradientRegistry.clear();
    const pptx = new global.PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = meta.author || 'Prestaterre Certification';
    pptx.company = meta.company || 'Prestaterre Certification';
    pptx.subject = meta.subject || 'Export Obslide fidèle à l’écran';
    pptx.title = meta.title || 'Observatoire du bâtiment durable — Prestaterre';
    pptx.lang = 'fr-FR';
    pptx.theme = { headFontFace: meta.font || 'Arial', bodyFontFace: meta.font || 'Arial', lang: 'fr-FR' };
    return pptx;
  }

  async function addSlideFromElement(pptx, element, opts = {}) {
    if (!element) throw new Error('Slide introuvable.');
    const options = Object.assign({ defaultFont: 'Arial', svgTextMode: 'native' }, opts);
    const savedTransform = element.style.getPropertyValue('transform');
    const savedPriority = element.style.getPropertyPriority('transform');
    if (options.neutralizeTransform !== false) element.style.setProperty('transform', 'none', 'important');
    let restorePseudos = () => {};
    try {
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* ignoré */ } }
      await Promise.all([...element.querySelectorAll('img')].map(img => img.complete ? null : new Promise(r => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); setTimeout(r, 4000); })));
      restorePseudos = materializePseudos(element, [DEFAULT_IGNORE, options.ignoreSelector].filter(Boolean).join(','));
      await nextFrame();
      const cap = new SlideCapture(element, options);
      const ordered = cap.capture();
      await Promise.all(cap.pending);
      const slide = pptx.addSlide();
      slide.background = { color: cap.background };
      for (const it of ordered) {
        if (it.skip) continue;
        try {
          if (it.type === 'shape') slide.addShape(it.shape, it.opts);
          else if (it.type === 'image') { if (it.opts.data) slide.addImage(it.opts); }
          else if (it.type === 'text') slide.addText(it.runs, it.opts);
        } catch (e) { console.warn('Obslide PPTX : objet ignoré', e, it); }
      }
      if (options.notes) slide.addNotes(String(options.notes));
      return { slide, objects: ordered.length };
    } finally {
      restorePseudos();
      if (savedTransform) element.style.setProperty('transform', savedTransform, savedPriority);
      else element.style.removeProperty('transform');
    }
  }

  // Écrit le fichier : PptxGenJS produit le paquet, puis les formes repérées reçoivent
  // leur dégradé natif (<a:gradFill>) — modifiable dans PowerPoint et lu par Google Slides.
  async function finalize(pptx) {
    const data = await pptx.write({ outputType: 'arraybuffer' });
    if (!gradientRegistry.size || typeof global.JSZip !== 'function') return new Blob([data], { type: PPTX_MIME });
    const zip = await global.JSZip.loadAsync(data);
    const slides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    for (const name of slides) {
      let xml = await zip.file(name).async('string');
      if (!xml.includes(GRAD_PREFIX)) continue;
      xml = xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, sp => {
        const m = sp.match(new RegExp('name="' + GRAD_PREFIX + '(\\d+)\\|'));
        if (!m || !gradientRegistry.has(m[1])) return sp;
        return sp.replace(new RegExp('name="' + GRAD_PREFIX + '\\d+\\|'), 'name="')
          .replace(/(<\/a:prstGeom>)<a:solidFill>[\s\S]*?<\/a:solidFill>/, '$1' + gradientRegistry.get(m[1]));
      });
      zip.file(name, xml);
    }
    return zip.generateAsync({ type: 'blob', mimeType: PPTX_MIME, compression: 'DEFLATE' });
  }
  const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  async function save(pptx, fileName) {
    const blob = await finalize(pptx);
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    gradientRegistry.clear();
    return blob;
  }

  global.ObslidePptx = { version: '1.1.0', createPresentation, addSlideFromElement, finalize, save, _internals: { parseColor, gradientLayerSvg, nativeGradientXml, clipPathD, splitTopLevel } };
})(window);
