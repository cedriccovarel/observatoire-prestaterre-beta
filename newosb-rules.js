/*
 * Observatoire Prestaterre — règles de lecture des données (V6.13)
 *
 * Module unique partagé par l'Observatoire (index.html), le générateur
 * (generator.html), newosb-core.js et les tests Node.
 *
 * Principe : une valeur que l'on ne sait pas lire avec certitude n'est jamais
 * transformée en chiffre. Elle est renvoyée avec status 'doubtful' et une
 * raison, pour être signalée dans la page Qualité & données.
 */
(function (root) {
  'use strict';

  const VERSION = '6.13.0';

  // ---------------------------------------------------------------------------
  // Outils de normalisation
  // ---------------------------------------------------------------------------
  const stripAccents = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const looseNorm = v => stripAccents(v).toLowerCase().replace(/[’'`´]/g, "'").replace(/\s+/g, ' ').trim();
  const headerKey = v => stripAccents(v).toLowerCase().replace(/&lt;br\s*\/?\s*&gt;|<br\s*\/?\s*>/gi, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

  const PLACEHOLDERS = new Set([
    '', '-', '--', '–', '—', '/', '?', 'x', '0/0',
    'nc', 'n c', 'n.c', 'n.c.', 'na', 'n/a', 'n.a.', 'nr', 'n.r.', 'nd', 'n.d.',
    'so', 's.o.', 's/o', 'sans objet', 'non renseigne', 'non renseignee', 'non communique',
    'non communiquee', 'inconnu', 'inconnue', 'neant', 'aucun', 'aucune', 'nan', 'null', 'undefined'
  ]);
  function isPlaceholder(v) {
    return PLACEHOLDERS.has(looseNorm(v));
  }

  const result = (value, status, reason, raw, extra) => Object.assign({ value, status, reason: reason || '', raw: raw === undefined ? '' : raw }, extra || {});

  // ---------------------------------------------------------------------------
  // Extraction des nombres d'un texte
  // ---------------------------------------------------------------------------
  // Un nombre collé à une lettre fait partie d'une unité (m2, CO2, kWhep/m2…)
  // et n'est pas une valeur, sauf après une étiquette R ou U isolée (R4,5).
  const LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ²³µ]/;
  const NUMBER_RE = /\d+(?:[.,]\d+)*(?: \d{3}(?!\d)(?:[.,]\d+)?)*/g;

  function tokenToNumber(token) {
    let t = token.replace(/ /g, '');
    const commas = (t.match(/,/g) || []).length;
    const dots = (t.match(/\./g) || []).length;
    if (commas && dots) {
      if (t.lastIndexOf(',') > t.lastIndexOf('.')) t = t.replace(/\./g, '').replace(',', '.');
      else t = t.replace(/,/g, '');
      if ((t.match(/\./g) || []).length > 1) return NaN;
    } else if (commas > 1 || dots > 1) {
      const sep = commas > 1 ? ',' : '.';
      const parts = t.split(sep);
      if (parts.slice(1).every(p => p.length === 3)) t = parts.join('');
      else return NaN;
    } else if (commas === 1) {
      t = t.replace(',', '.');
    }
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }

  function readUnit(after) {
    const m = String(after).match(/^\s*(mm|cm|m)(?![a-z²2³3])/i);
    return m ? m[1].toLowerCase() : '';
  }

  function extractNumbers(text) {
    const s = String(text ?? '').replace(/[\u00a0\u202f\u2009\u2007]/g, ' ');
    const out = [];
    NUMBER_RE.lastIndex = 0;
    let m;
    while ((m = NUMBER_RE.exec(s))) {
      const start = m.index, end = start + m[0].length;
      const before = s.slice(0, start);
      const prev = before.slice(-1);
      if (prev && LETTER.test(prev) && !/(^|[^A-Za-zÀ-ÿ])[RrUu]$/.test(before) && !/(\d|\s)[xX]$/.test(before)) continue;
      let value = tokenToNumber(m[0]);
      if (!Number.isFinite(value)) { out.push({ value: NaN, invalid: true, start, end, text: m[0] }); continue; }
      if (prev === '-' && !/[0-9A-Za-zÀ-ÿ]/.test(before.slice(-2, -1))) value = -value;
      out.push({ value, start, end, text: m[0], unit: readUnit(s.slice(end)) });
    }
    return { text: s, tokens: out };
  }

  // ---------------------------------------------------------------------------
  // Nombre simple (Bbio, Cep, IC, logements…)
  // ---------------------------------------------------------------------------
  function parseNumber(raw) {
    if (raw === null || raw === undefined) return result(null, 'empty', '', raw);
    if (typeof raw === 'number') return Number.isFinite(raw) ? result(raw, 'ok', '', raw) : result(null, 'doubtful', 'valeur non numérique', raw);
    if (isPlaceholder(raw)) return result(null, 'empty', '', raw);
    const s = String(raw);
    if (/[<>≤≥]/.test(s)) return result(null, 'doubtful', 'inégalité (< ou >) : valeur non exacte', raw);
    if (/\d\s*[x×*]\s*\d/i.test(s)) return result(null, 'doubtful', 'multiplication dans la cellule', raw);
    const { tokens } = extractNumbers(s);
    if (tokens.some(t => t.invalid)) return result(null, 'doubtful', 'format de nombre illisible', raw);
    if (!tokens.length) return result(null, 'doubtful', 'aucun nombre lisible', raw);
    if (tokens.length > 1) return result(null, 'doubtful', 'plusieurs valeurs dans la cellule', raw);
    return result(tokens[0].value, 'ok', '', raw);
  }

  // ---------------------------------------------------------------------------
  // Grandeurs d'enveloppe : épaisseur d'isolant (mm) et résistance R (m².K/W)
  // ---------------------------------------------------------------------------
  const MEASURES = {
    thickness: { label: 'épaisseur', unit: 'mm', min: 5, max: 1000 },
    resistance: { label: 'résistance R', unit: 'm².K/W', min: 0.05, max: 20 }
  };

  function toMillimetres(value, unit) {
    if (unit === 'cm') return value * 10;
    if (unit === 'm') return value * 1000;
    return value;
  }

  // Règles :
  //  - « + » entre deux valeurs = couches successives : on additionne ;
  //  - « 2x100 » = nombre de couches × valeur : on multiplie ;
  //  - autres séparateurs (/, ;, « et », retour ligne…) = valeurs alternatives
  //    (plusieurs parois ou bâtiments) : on retient la plus élevée (règle V6.12) ;
  //  - épaisseur sans unité = mm (règle V6.12), cm ×10, m ×1000 ;
  //  - pour R, une valeur annotée mm/cm/m est une épaisseur et est ignorée ;
  //  - une valeur hors plage plausible est écartée et signalée.
  function parseMeasure(raw, kind) {
    const def = MEASURES[kind];
    if (!def) throw new Error('Type de grandeur inconnu : ' + kind);
    if (raw === null || raw === undefined) return result(null, 'empty', '', raw);
    if (typeof raw === 'number') raw = String(raw);
    if (isPlaceholder(raw)) return result(null, 'empty', '', raw);
    const s = String(raw);
    if (kind === 'resistance' && /w\s*\/\s*m/i.test(s) && !/k\s*\/\s*w/i.test(s)) {
      return result(null, 'doubtful', 'valeur exprimée en W/m².K (coefficient U), pas une résistance R', raw);
    }
    if (/[<>≤≥]/.test(s)) return result(null, 'doubtful', 'inégalité (< ou >) : valeur non exacte', raw);
    const { text, tokens } = extractNumbers(s);
    if (tokens.some(t => t.invalid)) return result(null, 'doubtful', 'format de nombre illisible', raw);
    if (!tokens.length) return result(null, 'doubtful', 'aucun nombre lisible', raw);

    // Regroupement en expressions : a + b, n x a, puis valeurs alternatives.
    const groups = [];
    let current = null;
    tokens.forEach((tok, i) => {
      const between = i ? text.slice(tokens[i - 1].end, tok.start) : '';
      const op = /\+/.test(between) ? '+' : (/^\s*(?:mm|cm|m)?\s*[x×*]\s*$/i.test(between) ? 'x' : '');
      if (current && op) current.parts.push({ op, tok });
      else { current = { parts: [{ op: '', tok }] }; groups.push(current); }
    });

    const accepted = [], rejected = [];
    groups.forEach(g => {
      let value = null;
      if (kind === 'thickness') {
        // Une valeur sans unité prend l'unité de la suivante du même groupe (« 120 + 100 mm »).
        const units = g.parts.map(p => p.tok.unit);
        for (let i = units.length - 2; i >= 0; i--) if (!units[i] && g.parts[i + 1].op === '+') units[i] = units[i + 1];
        let sum = 0, factor = 1;
        g.parts.forEach((p, i) => {
          const next = g.parts[i + 1];
          if (next && next.op === 'x') { factor *= p.tok.value; return; }
          sum += factor * toMillimetres(p.tok.value, units[i]);
          factor = 1;
        });
        value = sum;
      } else {
        const parts = g.parts.filter(p => !p.tok.unit);
        if (!parts.length) return; // uniquement des épaisseurs dans ce groupe
        let sum = 0, factor = 1;
        parts.forEach((p, i) => {
          const next = parts[i + 1];
          if (next && next.op === 'x') { factor *= p.tok.value; return; }
          sum += factor * p.tok.value; factor = 1;
        });
        value = sum;
      }
      const label = g.parts.map(p => p.tok.text).join(' ');
      if (value >= def.min && value <= def.max) accepted.push(value);
      else rejected.push({ value, label });
    });

    if (!accepted.length) {
      if (!rejected.length) return result(null, 'doubtful', kind === 'resistance' ? 'seules des épaisseurs (mm/cm) sont indiquées' : 'aucune valeur exploitable', raw);
      const r = rejected[0];
      return result(null, 'doubtful', `${def.label} invraisemblable (${Number(r.value.toFixed(3))} ${def.unit}) : vérifier l’unité`, raw);
    }
    const value = Math.max(...accepted);
    const note = rejected.length ? `${rejected.length} valeur(s) invraisemblable(s) écartée(s)` : '';
    return result(Math.round(value * 1e6) / 1e6, 'ok', note, raw, { alternatives: accepted.length });
  }

  // ---------------------------------------------------------------------------
  // Avancement de l'évaluation
  // ---------------------------------------------------------------------------
  // Liste fermée : toute autre valeur signifie que la colonne lue n'est pas
  // la bonne (ou qu'une cellule est mal saisie).
  const PROGRESS_SOURCE_HEADER = 'Opération: Évaluation: Statut';
  const PROGRESS_STATUSES = [
    { key: 'notStarted', label: 'Non démarrée', color: '#9aa8a2' },
    { key: 'incomplete', label: 'Dossier incomplet', color: '#d49a32' },
    { key: 'complete', label: 'Dossier complet', color: '#b4a24a' },
    { key: 'planned', label: 'Analyse planifiée', color: '#6f9cb9' },
    { key: 'analysis', label: 'Analyse réalisée', color: '#4b9881' },
    { key: 'visit', label: 'Visite réalisée', color: '#16864f' },
    { key: 'compliant', label: 'Évaluation conforme', color: '#06402b' }
  ];
  const PROGRESS_KEYS = PROGRESS_STATUSES.map(s => s.key);
  const PROGRESS_MIN_VALID_RATIO = 0.95;

  // Tolère majuscules, accents, pluriels et e muet final, rien de plus.
  const progressCanon = v => headerKey(v).split(' ').filter(Boolean).map(w => w.replace(/s$/, '').replace(/e$/, '')).join(' ');
  const PROGRESS_INDEX = new Map(PROGRESS_STATUSES.map(s => [progressCanon(s.label), s]));

  function progressMatch(raw) {
    if (raw === null || raw === undefined || String(raw).trim() === '') return null;
    return PROGRESS_INDEX.get(progressCanon(raw)) || null;
  }
  function progressStatus(raw) {
    if (raw === null || raw === undefined || String(raw).trim() === '') return { key: 'unknown', label: '', state: 'empty' };
    const m = progressMatch(raw);
    return m ? { key: m.key, label: m.label, state: 'valid' } : { key: 'unknown', label: String(raw).trim(), state: 'invalid' };
  }

  function columnProgressStats(rows, header) {
    let nonEmpty = 0, valid = 0;
    const invalid = new Map();
    (rows || []).forEach(r => {
      const v = r ? r[header] : '';
      if (v === null || v === undefined || String(v).trim() === '') return;
      nonEmpty++;
      if (progressMatch(v)) valid++;
      else { const k = String(v).trim(); invalid.set(k, (invalid.get(k) || 0) + 1); }
    });
    return {
      header, nonEmpty, valid, ratio: nonEmpty ? valid / nonEmpty : 0,
      invalidValues: [...invalid.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([value, count]) => ({ value, count }))
    };
  }

  // Détermine la colonne d'avancement :
  //  1. « Opération: Évaluation: Statut » (ou variante d'écriture) ;
  //  2. toute autre colonne Évaluation + Statut ;
  //  3. sinon, n'importe quelle colonne dont le contenu respecte la liste fermée.
  // Une colonne n'est retenue que si au moins 95 % de ses valeurs non vides
  // appartiennent à la liste. Sinon, ce n'est pas la bonne colonne.
  function resolveProgressColumn(headers, rows, options) {
    const minRatio = (options && options.minRatio) || PROGRESS_MIN_VALID_RATIO;
    const list = (headers || []).filter(h => String(h || '').trim() !== '');
    const target = headerKey(PROGRESS_SOURCE_HEADER);
    const exact = list.filter(h => headerKey(h) === target);
    const named = list.filter(h => !exact.includes(h) && /\bevaluation\b/.test(headerKey(h)) && /\bstatut\b/.test(headerKey(h)));
    const others = list.filter(h => !exact.includes(h) && !named.includes(h));
    const checked = [];
    const accept = (h, origin) => {
      const st = Object.assign(columnProgressStats(rows, h), { origin });
      checked.push(st);
      return st.nonEmpty > 0 && st.ratio >= minRatio ? st : null;
    };
    for (const h of exact) { const st = accept(h, 'nom attendu'); if (st) return finish(st); }
    for (const h of named) { const st = accept(h, 'nom proche'); if (st) return finish(st); }
    const minCount = Math.max(3, Math.ceil(0.1 * (rows || []).length));
    for (const h of others) {
      const st = columnProgressStats(rows, h);
      if (st.nonEmpty >= minCount && st.ratio >= minRatio) { st.origin = 'contenu reconnu'; checked.push(st); return finish(st); }
    }
    return {
      header: null, found: false, expectedHeader: PROGRESS_SOURCE_HEADER, checked, minRatio,
      message: exact.length || named.length
        ? `La colonne « ${(exact[0] || named[0])} » ne contient pas les valeurs d’avancement attendues : ce n’est pas la bonne colonne.`
        : `Colonne « ${PROGRESS_SOURCE_HEADER} » introuvable et aucune autre colonne ne contient les valeurs d’avancement attendues.`
    };
    function finish(st) {
      return {
        header: st.header, found: true, origin: st.origin, ratio: st.ratio, nonEmpty: st.nonEmpty, valid: st.valid,
        invalidValues: st.invalidValues, expectedHeader: PROGRESS_SOURCE_HEADER, checked, minRatio,
        message: st.origin === 'nom attendu'
          ? `Avancement lu dans « ${st.header} ».`
          : `Avancement lu dans « ${st.header} » (${st.origin}) : la colonne « ${PROGRESS_SOURCE_HEADER} » est absente ou non conforme.`
      };
    }
  }

  const api = {
    VERSION, stripAccents, looseNorm, headerKey, isPlaceholder, extractNumbers,
    parseNumber, parseMeasure, MEASURES,
    PROGRESS_SOURCE_HEADER, PROGRESS_STATUSES, PROGRESS_KEYS, PROGRESS_MIN_VALID_RATIO,
    progressMatch, progressStatus, columnProgressStats, resolveProgressColumn
  };
  root.NEWOSB_RULES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
