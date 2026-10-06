/*
 * Observatoire Prestaterre — V6.14 — moteur des mentions (calculs purs, sans affichage).
 *
 * Centralise : normalisation des identifiants, contexte normatif d'une ligne RAPPORT,
 * code canonique d'une exigence, bouquet des exigences les plus sélectionnées,
 * couverture des critères d'une mention et classement.
 * Fonctionne dans le navigateur (window.NEWOSB_MENTIONS) et dans Node (module.exports) pour les tests.
 */
(function (root) {
  'use strict';

  // Paramètre documenté : taille du bouquet comparé (« les N exigences les plus sélectionnées »).
  // À modifier ici uniquement.
  const BOUQUET_SIZE = 20;

  const strip = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const norm = v => strip(v).toLowerCase().replace(/[’'`´]/g, "'").replace(/\s+/g, ' ').trim();
  const natural = (a, b) => String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' });

  // ---------------------------------------------------------------- identifiants
  // Normalise la représentation d'un identifiant d'opération sans en changer la valeur :
  // espaces parasites, espaces insécables, caractères invisibles, tirets typographiques, casse.
  // Les zéros significatifs sont conservés (« OP-0012 » ≠ « OP-12 ») et rien n'est fusionné par approximation.
  function normalizeId(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .replace(/[​-‍⁠﻿­]/g, '')
      .replace(/[   ]/g, ' ')
      .replace(/[‐-―−]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  // ---------------------------------------------------------------- contexte normatif
  function referentialFamily(name) {
    const n = norm(name);
    if (!n || !/\bbee\b/.test(n)) return '';
    if (/tertiaire/.test(n)) {
      if (/exploitation/.test(n)) return 'BEE_TE';
      if (/neuf/.test(n)) return 'BEE_TN';
      return '';
    }
    if (/renovation/.test(n)) return 'BEE_LR';
    if (/neuf/.test(n)) return 'BEE_LN';
    return '';
  }
  function parseVersionDate(text) {
    const s = String(text ?? '').trim();
    if (!s) return '';
    let m = s.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})\b/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    m = s.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return '';
  }
  function rowContext(row) {
    const family = referentialFamily(row?.referential);
    const version = parseVersionDate(row?.referentialVersion) || parseVersionDate(row?.referentialVersionDate);
    const versionText = String(row?.referentialVersion || row?.referentialVersionDate || '').trim();
    if (!family) return { key: '', family: '', version, versionText, reason: row?.referential ? `Référentiel non reconnu : « ${row.referential} »` : 'Référentiel absent' };
    if (!version) return { key: `${family}@?${versionText ? norm(versionText) : ''}`, family, version: '', versionText, reason: versionText ? `Version non datée : « ${versionText} »` : 'Version du référentiel absente' };
    return { key: `${family}@${version}`, family, version, versionText, reason: '' };
  }

  // ---------------------------------------------------------------- exigences
  // Codes acceptés : 1.2.3, 3.3.14, 4.B.2 (anciennes versions), A1.2, E.1.2.3… (pas de limite aux cibles 1 à 4).
  const CODE_RE = /^\s*([A-Z]{0,3}\d{1,2}(?:\.[0-9A-Z]{1,3}){1,3})(?=$|[\s\-–—:.)\]])/i;
  function codeFrom(text) {
    const m = String(text ?? '').match(CODE_RE);
    return m ? m[1].toUpperCase().replace(/\.$/, '') : '';
  }
  function labelFrom(text) {
    return String(text ?? '').replace(CODE_RE, '').replace(/^\s*[-–—:.]\s*/, '').trim();
  }
  function catalogSources(catalog) { return Array.isArray(catalog?.sources) ? catalog.sources : []; }
  function sourceFor(catalog, contextKey) { return catalogSources(catalog).find(s => s.context === contextKey) || null; }

  // Code canonique d'une ligne : colonnes de code d'abord, puis préfixe de l'intitulé.
  // Des codes contradictoires sur une même ligne rendent la ligne « non résolue ».
  function canonicalCode(row) {
    const fields = [row?.requirementCode, row?.requirementNumber, row?.requirementReference, row?.requirementLabel, row?.requirement];
    const codes = [...new Set(fields.map(codeFrom).filter(Boolean))];
    if (!codes.length) return { code: '', reason: 'Aucun code d’exigence lisible' };
    if (codes.length > 1) return { code: '', reason: `Codes contradictoires sur la ligne : ${codes.join(' / ')}` };
    return { code: codes[0], reason: '' };
  }
  function rowLabel(row) {
    return labelFrom(row?.requirementLabel) || labelFrom(row?.associatedRequirementReferenceTitle) || labelFrom(row?.requirement) || String(row?.requirement || '').trim();
  }
  function resolveRequirement(row, catalog, ctx = rowContext(row)) {
    const { code, reason } = canonicalCode(row);
    const label = rowLabel(row);
    const source = ctx.key ? sourceFor(catalog, ctx.key) : null;
    const reqs = source && Array.isArray(source.requirements) ? source.requirements : null;
    if (reqs) {
      if (code) {
        const hit = reqs.find(r => r.code === code);
        if (hit) return { key: `${ctx.key}|${code}`, code, label: hit.title, status: 'exact', reason: '' };
        return { key: '', code, label, status: 'unresolved', reason: `Code ${code} absent du référentiel ${source.title} ${source.versionLabel}` };
      }
      // Correspondance exacte de l'intitulé (après normalisation), unique dans ce référentiel et cette version.
      const n = norm(label);
      const hits = n ? reqs.filter(r => norm(r.title) === n) : [];
      if (hits.length === 1) return { key: `${ctx.key}|${hits[0].code}`, code: hits[0].code, label: hits[0].title, status: 'title', reason: '' };
      return { key: '', code: '', label, status: 'unresolved', reason: hits.length > 1 ? 'Intitulé ambigu dans le référentiel' : reason };
    }
    if (!ctx.key) return { key: '', code, label, status: 'unresolved', reason: ctx.reason };
    if (!code) return { key: '', code: '', label, status: 'unresolved', reason };
    return { key: `${ctx.key}|${code}`, code, label, status: 'uncatalogued', reason: '' };
  }

  // ---------------------------------------------------------------- bouquet
  // rows : lignes RAPPORT normalisées du périmètre (jamais les éléments visibles ni une page).
  // Fréquence = opérations distinctes ayant sélectionné l'exigence / opérations distinctes documentées du contexte.
  function buildBouquets(rows, catalog, options = {}) {
    const size = Math.max(1, Number(options.size) || BOUQUET_SIZE);
    const contexts = new Map(), noOperation = [], noContext = new Map();
    for (const row of rows || []) {
      const op = normalizeId(row?.operationCode);
      if (!op) { noOperation.push(row); continue; }
      const ctx = rowContext(row);
      if (!ctx.key) {
        const k = ctx.reason; if (!noContext.has(k)) noContext.set(k, new Set()); noContext.get(k).add(op); continue;
      }
      if (!contexts.has(ctx.key)) contexts.set(ctx.key, { key: ctx.key, family: ctx.family, version: ctx.version, versionText: ctx.versionText, reason: ctx.reason, operations: new Set(), reqs: new Map(), unresolved: new Map(), rows: 0 });
      const c = contexts.get(ctx.key);
      c.rows++; c.operations.add(op);
      const r = resolveRequirement(row, catalog, ctx);
      if (!r.key) {
        const k = `${r.reason}\u0001${norm(r.label) || r.code}`;
        if (!c.unresolved.has(k)) c.unresolved.set(k, { label: r.label || r.code || '(sans intitulé)', code: r.code, reason: r.reason, operations: new Set() });
        c.unresolved.get(k).operations.add(op);
        continue;
      }
      if (!c.reqs.has(r.key)) c.reqs.set(r.key, { key: r.key, code: r.code, label: r.label, status: r.status, operations: new Set(), labels: new Map() });
      const item = c.reqs.get(r.key);
      item.operations.add(op);
      if (r.label) item.labels.set(r.label, (item.labels.get(r.label) || 0) + 1);
    }
    const families = catalog?.families || {};
    const out = [...contexts.values()].map(c => {
      const source = sourceFor(catalog, c.key);
      const opsCount = c.operations.size;
      const items = [...c.reqs.values()].map(it => {
        const label = it.status === 'exact' || it.status === 'title' ? it.label : ([...it.labels.entries()].sort((a, b) => b[1] - a[1] || natural(a[0], b[0]))[0]?.[0] || it.label);
        return { key: it.key, code: it.code, label, status: it.status, operations: it.operations.size, frequency: opsCount ? it.operations.size / opsCount : 0 };
      }).sort((a, b) => b.operations - a.operations || natural(a.code, b.code) || natural(a.key, b.key));
      return {
        key: c.key, family: c.family, familyLabel: families[c.family] || c.family, version: c.version, versionText: c.versionText,
        versionLabel: source?.versionLabel || (c.version ? c.version.split('-').reverse().join('/') : (c.versionText || 'version non datée')),
        reason: c.reason, operations: opsCount, rows: c.rows, source: source ? { status: source.status, title: source.title, missing: source.missing || '' } : null,
        items, top: items.slice(0, size), size,
        unresolved: [...c.unresolved.values()].map(u => ({ label: u.label, code: u.code, reason: u.reason, operations: u.operations.size })).sort((a, b) => b.operations - a.operations || natural(a.label, b.label))
      };
    }).sort((a, b) => b.operations - a.operations || natural(a.key, b.key));
    return {
      size, contexts: out,
      diagnostics: {
        rowsWithoutOperation: noOperation.length,
        withoutContext: [...noContext.entries()].map(([reason, ops]) => ({ reason, operations: ops.size })).sort((a, b) => b.operations - a.operations)
      }
    };
  }

  // ---------------------------------------------------------------- évaluation d'une mention
  function fieldValue(values, field) { const v = values && Object.prototype.hasOwnProperty.call(values, field) ? values[field] : ''; return v === undefined || v === null ? '' : String(v); }

  // Condition d'application d'un critère : { field, applicableIf: 'oui' | [valeurs] }.
  function whenState(when, values) {
    if (!when) return 'yes';
    const v = fieldValue(values, when.field);
    if (!v) return 'unknown';
    const ok = Array.isArray(when.applicableIf) ? when.applicableIf : [when.applicableIf || 'oui'];
    return ok.includes(v) ? 'yes' : 'no';
  }
  function evalNode(node, present, values, catalog, depth, seen) {
    const t = node?.type;
    if (node?.when && t !== 'req') {
      const w = whenState(node.when, values);
      if (w === 'no') return { kind: t, label: node.label || '', state: 'na', units: 0, note: 'Non applicable (condition renseignée)', field: node.when.field, children: [] };
      if (w === 'unknown') { const inner = evalNode({ ...node, when: null }, present, values, catalog, depth, seen); return { ...inner, state: inner.state === 'covered' ? 'unknown' : inner.state === 'na' ? 'unknown' : 'unknown', note: 'Condition d’application inconnue', field: node.when.field }; }
    }
    if (t === 'switch') {
      // Critère dont le contenu dépend d'une donnée de contexte (régime, date de permis, type d'ouvrage…).
      const v = fieldValue(values, node.field);
      const cases = node.cases || {};
      if (v) {
        const c = cases[v];
        if (!c) return { kind: 'switch', label: node.label || '', state: 'na', units: 0, note: 'Non applicable pour ce contexte', field: node.field, children: [] };
        const r = evalNode(c, present, values, catalog, depth + 1, seen);
        return { ...r, label: r.label || node.label || '', switchLabel: node.label || '', caseValue: v };
      }
      const results = Object.keys(cases).map(k => ({ k, r: evalNode(cases[k], present, values, catalog, depth + 1, seen) }));
      const states = [...new Set(results.map(x => x.r.state === 'na' ? 'na' : x.r.state))];
      if (states.length === 1 && states[0] !== 'unknown' && states[0] !== 'unresolved') {
        const first = results[0].r;
        return { ...first, label: node.label || first.label || '', note: 'Même résultat quel que soit « ' + node.field + ' »', via: [...new Set(results.flatMap(x => x.r.via || []))] };
      }
      return { kind: 'switch', label: node.label || '', state: 'unknown', units: 1, note: `Dépend d’une donnée de contexte non renseignée`, field: node.field, children: results.map(x => x.r) };
    }
    if (t === 'req') {
      const codes = [node.code, ...(node.alt || [])];
      const base = { kind: 'req', code: node.code, codes, inferred: node.inferredAlt || [], label: node.label || '', group: node.group || '', units: 1, ambiguity: node.ambiguity || '' };
      if (node.when) {
        const w = whenState(node.when, values);
        if (w === 'unknown') return { ...base, state: 'unknown', note: 'Condition d’application inconnue', field: node.when.field };
        if (w === 'no') return { ...base, state: 'na', units: 0, note: 'Non applicable (condition renseignée)', field: node.when.field };
      }
      const via = codes.filter(c => present.has(c));
      if (via.length) return { ...base, state: 'covered', via };
      const viaInferred = (node.inferredAlt || []).filter(c => present.has(c));
      if (viaInferred.length) return { ...base, state: 'unresolved', via: viaInferred, note: 'Seul un niveau supérieur présumé est présent : correspondance à vérifier, non comptée' };
      return { ...base, state: 'absent', via: [] };
    }
    if (t === 'any' || t === 'all') {
      const children = dedupe(node.items).map(n => evalNode(n, present, values, catalog, depth + 1, seen));
      const app = children.filter(c => c.state !== 'na');
      let state;
      if (!app.length) state = 'na';
      else if (t === 'any') state = app.some(c => c.state === 'covered') ? 'covered' : app.some(c => c.state === 'unknown' || c.state === 'unresolved') ? 'unknown' : 'absent';
      else state = app.some(c => c.state === 'absent') ? 'absent' : app.some(c => c.state === 'unknown' || c.state === 'unresolved') ? 'unknown' : 'covered';
      return { kind: t, label: node.label || '', state, units: state === 'na' ? 0 : 1, children, via: children.filter(c => c.state === 'covered').flatMap(c => c.via || []) };
    }
    if (t === 'atLeast') {
      const k = Math.max(1, Number(node.k) || 1);
      const children = dedupe(node.items).map(n => evalNode(n, present, values, catalog, depth + 1, seen));
      const covered = children.filter(c => c.state === 'covered').length;
      const unknown = children.filter(c => c.state === 'unknown' || c.state === 'unresolved').length;
      const applicable = children.filter(c => c.state !== 'na').length;
      const units = Math.min(k, applicable);
      return { kind: 'atLeast', k, label: node.label || '', children, units, coveredUnits: Math.min(units, covered), state: covered >= units ? 'covered' : (covered + unknown >= units ? 'unknown' : (covered > 0 ? 'partial' : 'absent')), via: children.filter(c => c.state === 'covered').flatMap(c => c.via || []) };
    }
    if (t === 'mention') {
      const ref = (catalog?.mentions || []).find(m => m.id === node.id);
      if (!ref || depth > 6 || seen.has(node.id)) return { kind: 'mention', id: node.id, label: ref?.name || node.id, state: 'unknown', units: 1, note: ref ? 'Dépendance circulaire' : 'Mention dépendante absente du catalogue' };
      const r = evaluateMention(ref, present, values, catalog, depth + 1, new Set([...seen, node.id]));
      // La présence de la mention dans une colonne n'est pas une preuve : on évalue sa règle.
      const state = r.status === 'ok' ? (r.covered === r.required ? 'covered' : 'absent') : r.status === 'not_applicable' ? 'na' : 'unknown';
      return { kind: 'mention', id: node.id, label: ref.name, state, units: state === 'na' ? 0 : 1, note: r.status === 'ok' ? `${r.covered}/${r.required}` : (r.reason || 'Non calculable'), via: [] };
    }
    return { kind: 'unknown', label: node?.label || '', state: 'unknown', units: 1, note: node?.reason || 'Critère indéterminé', unresolvable: true };
  }
  function nodeSignature(n) { return JSON.stringify(n); }
  function dedupe(items) { const seen = new Set(); return (items || []).filter(n => { const s = nodeSignature(n); if (seen.has(s)) return false; seen.add(s); return true; }); }

  function evaluateMention(mention, present, values = {}, catalog = null, depth = 0, seen = new Set([mention?.id])) {
    const presentSet = present instanceof Set ? present : new Set(present || []);
    const base = { id: mention.id, name: mention.name, context: mention.context, mention };
    for (const cond of mention.applicability || []) {
      const v = fieldValue(values, cond.field);
      if (!v) return { ...base, status: 'provisional', pct: null, covered: 0, required: 0, units: [], reason: `Applicabilité inconnue : ${cond.text || cond.field}`, unknownFields: [cond.field], ...partialEvaluation(mention, presentSet, values, catalog, depth, seen) };
      if ((cond.notIn && cond.notIn.includes(v)) || (cond.in && !cond.in.includes(v))) return { ...base, status: 'not_applicable', pct: null, covered: 0, required: 0, units: [], reason: cond.text || 'Mention non applicable dans ce contexte' };
    }
    if (!mention.criteria) return { ...base, status: 'not_computable', pct: null, covered: 0, required: 0, units: [], reason: mention.notComputableReason || 'Critères non disponibles' };
    const p = partialEvaluation(mention, presentSet, values, catalog, depth, seen);
    if (!p.required && !p.unknownUnits) return { ...base, status: 'not_computable', pct: null, ...p, reason: 'Aucun critère applicable' };
    const blocking = (mention.ambiguities || []).filter(a => a.affectsScore && (!a.when || whenState(a.when, values) !== 'no'));
    if (blocking.length) return { ...base, status: 'provisional', ...p, reason: `Ambiguïté du référentiel affectant les critères : ${blocking.map(a => a.id || a.text).join(', ')}` };
    if (p.unknownUnits) return { ...base, status: 'provisional', ...p, reason: `${p.unknownUnits} critère${p.unknownUnits > 1 ? 's' : ''} dont l’application ou la correspondance n’est pas établie` };
    return { ...base, status: 'ok', ...p, reason: '' };
  }
  function partialEvaluation(mention, present, values, catalog, depth, seen) {
    if (!mention.criteria) return { units: [], covered: 0, required: 0, unknownUnits: 0, pct: null };
    const root = mention.criteria.type === 'all' ? mention.criteria : { type: 'all', items: [mention.criteria] };
    const units = dedupe(root.items).map(n => evalNode(n, present, values, catalog, depth + 1, seen));
    let covered = 0, required = 0, unknownUnits = 0;
    const unknownFields = new Set();
    for (const u of units) {
      if (u.state === 'na') continue;
      if (u.kind === 'atLeast') { required += u.units; covered += u.coveredUnits; if (u.state === 'unknown') unknownUnits += u.units - u.coveredUnits; continue; }
      if (u.state === 'unknown' || u.state === 'unresolved') { unknownUnits += u.units; if (u.field) unknownFields.add(u.field); continue; }
      required += u.units; if (u.state === 'covered') covered += u.units;
    }
    return { units, covered, required, unknownUnits, unknownFields: [...unknownFields], pct: required ? 100 * covered / required : null };
  }

  // Classement automatique : uniquement les résultats fiables (status ok) d'un même contexte.
  function rankMentions(results) {
    return (results || []).filter(r => r.status === 'ok' && r.pct !== null)
      .slice().sort((a, b) => b.pct - a.pct || b.required - a.required || natural(a.name, b.name) || natural(a.id, b.id));
  }

  function mentionsForContext(catalog, contextKey) { return (catalog?.mentions || []).filter(m => m.context === contextKey); }
  function contextFieldsFor(catalog, contextKey) {
    const source = sourceFor(catalog, contextKey);
    const used = new Set();
    const walk = n => { if (!n) return; if (n.when?.field) used.add(n.when.field); if (n.type === 'switch') { used.add(n.field); Object.values(n.cases || {}).forEach(walk); } (n.items || []).forEach(walk); };
    const all = catalog?.mentions || [];
    const walkMention = (m, depth = 0) => { walk(m.criteria); (m.applicability || []).forEach(a => used.add(a.field)); (m.ambiguities || []).forEach(a => a.when && used.add(a.when.field));
      const deps = []; const findDeps = n => { if (!n) return; if (n.type === 'mention') deps.push(n.id); if (n.type === 'switch') Object.values(n.cases || {}).forEach(findDeps); (n.items || []).forEach(findDeps); }; findDeps(m.criteria);
      if (depth < 4) deps.forEach(id => { const d = all.find(x => x.id === id); if (d) walkMention(d, depth + 1); }); };
    mentionsForContext(catalog, contextKey).forEach(m => walkMention(m));
    return (source?.contextFields || []).filter(f => used.has(f.id));
  }
  // Liste complète pour le menu : toutes les mentions, regroupées par référentiel et version.
  function mentionMenu(catalog) {
    const groups = new Map();
    for (const m of catalog?.mentions || []) {
      const s = sourceFor(catalog, m.context);
      const label = s ? `${s.title} · ${s.versionLabel}` : m.context;
      if (!groups.has(m.context)) groups.set(m.context, { context: m.context, label, status: s?.status || 'unknown', mentions: [] });
      groups.get(m.context).mentions.push(m);
    }
    return [...groups.values()];
  }

  // Analyse complète d'un contexte : évalue toutes ses mentions sur le même bouquet.
  function analyseContext(bouquetContext, catalog, values = {}) {
    const present = new Set((bouquetContext?.top || []).map(i => i.code));
    const source = sourceFor(catalog, bouquetContext?.key);
    const mentions = mentionsForContext(catalog, bouquetContext?.key);
    const results = mentions.map(m => evaluateMention(m, present, values, catalog));
    return { context: bouquetContext?.key || '', source, present, results, ranked: rankMentions(results) };
  }

  const api = {
    BOUQUET_SIZE, normalizeId, referentialFamily, parseVersionDate, rowContext, codeFrom, labelFrom, canonicalCode,
    resolveRequirement, buildBouquets, evaluateMention, rankMentions, mentionsForContext, contextFieldsFor, mentionMenu, analyseContext, sourceFor
  };
  root.NEWOSB_MENTIONS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
