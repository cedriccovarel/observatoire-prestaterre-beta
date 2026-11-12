/* NEWOSB V6.49 — Complément TotalRecoll.
 * Les lignes du Sheet OPERATIONS restent la base (et la seule source des liens partagés). TotalRecoll envoie,
 * d'onglet à onglet (postMessage, même origine), les valeurs techniques ExtracTerre par bâtiment ; elles ne
 * remplissent que les cellules VIDES du Sheet et les colonnes qu'il n'a pas. Une valeur différente déjà présente
 * dans le Sheet est gardée et signalée comme écart. Rien n'est stocké ni envoyé ailleurs : tout reste en mémoire.
 * V6.50 — Une cellule du Sheet qui n'est qu'un bouche-trou (« NC », « - », « #N/A »…) compte comme vide. Un code
 * postal, un code INSEE, une latitude, une longitude ou une année illisible dans le Sheet (ex. un nom de personne
 * dans « Code postal ») est remplacé par la valeur ExtracTerre valide et compté à part (« corrigées »). Quand le
 * Sheet a moins de lignes que de bâtiments, les bâtiments suivants deviennent des lignes ajoutées à l'opération
 * (identifiants seuls + valeurs ExtracTerre, marquées __recollExtra) : leurs données comptent dans les moyennes.
 * V6.63 — Liens partagés : le complément des opérations du périmètre est enregistré avec le lien (buildShareComplement).
 * Chaque bâtiment y porte le code interne exact de sa ligne (« code ») : c'est lui qui sert à l'appariement, y compris
 * quand le serveur a pseudonymisé ce code et retiré le n° de contrat (lien anonymisé).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NEWOSB_RECOLL = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const MESSAGE_TYPE = 'totalrecoll:operations';
  const SHARE_TYPE = 'newosb:share-complement';
  const MAX_DETAILS = 300;

  // Mêmes formats que TotalRecoll : contrat 0000xxxx, opération OPE-XXXXXX.
  function normContract(v) {
    const m = String(v ?? '').match(/^\s*0*(\d{1,8})(?:\.0+)?\s*$/);
    return m && m[1] !== '0' ? m[1].padStart(8, '0') : '';
  }
  function normOpe(v) {
    const m = String(v ?? '').match(/OPE[\s_-]*(\d{1,6})\b/i);
    return m ? 'OPE-' + m[1].padStart(6, '0') : '';
  }
  // Code interne tel que le serveur le compare (espaces réduits, majuscules).
  const normCode = v => String(v ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[\u00A0\s]+/g, ' ').trim().toUpperCase().slice(0, 80);
  const normHeader = h => String(h ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').replace(/\s*:\s*$/, '').trim();
  // Bouche-trous des exports (comparés après normHeader) : la cellule est considérée comme vide.
  const PLACEHOLDERS = new Set(['-', '--', '—', '–', '.', '?', 'nc', 'n/c', 'n.c.', 'na', 'n/a', 'n.a.', 'nd', 'n/d', 'n.d.', 'non renseigne', 'non renseignee', 'a renseigner', 'inconnu', '#n/a', '#ref!', '#value!', '#valeur!', '#div/0!', '#name?', '#nom?']);
  const isEmpty = v => v == null || String(v).trim() === '' || PLACEHOLDERS.has(normHeader(v));
  // Colonnes au format fixe : une valeur du Sheet hors format est une erreur de saisie, remplacée si ExtracTerre a mieux.
  const num = v => { const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null; };
  const FORMATS = [
    [/^(code postal|cp)$/, v => /^\d{4,5}$/.test(String(v).trim())],
    [/^code insee( commune)?$/, v => /^(\d{4,5}|2[ab]\d{3})$/i.test(String(v).trim())],
    [/^latitude( commune)?$/, v => { const n = num(v); return n !== null && n >= -90 && n <= 90 && n !== 0; }],
    [/^longitude( commune)?$/, v => { const n = num(v); return n !== null && n >= -180 && n <= 180 && n !== 0; }],
    [/^annee( de construction)?$/, v => { const n = num(v); return n !== null && n >= 1000 && n <= 2100; }]
  ];
  const formatOf = h => { const nh = normHeader(h); const f = FORMATS.find(([re]) => re.test(nh)); return f ? f[1] : null; };
  function same(a, b) {
    const na = Number(String(a).replace(/\s/g, '').replace(',', '.')), nb = Number(String(b).replace(/\s/g, '').replace(',', '.'));
    if (String(a).trim() !== '' && String(b).trim() !== '' && Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) <= 1e-6 * Math.max(1, Math.abs(na));
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }

  // Contrôle du message reçu : forme attendue uniquement, valeurs simples, taille bornée.
  function validatePayload(data) {
    if (!data || (data.type !== MESSAGE_TYPE && data.type !== SHARE_TYPE) || data.v !== 1 || !Array.isArray(data.buildings)) return null;
    if (data.buildings.length > 50000) return null;
    const buildings = [];
    for (const b of data.buildings) {
      if (!b || typeof b !== 'object' || !b.cells || typeof b.cells !== 'object') continue;
      const cells = {};
      for (const [k, v] of Object.entries(b.cells)) {
        if (typeof k !== 'string' || !k.trim() || k.length > 200) continue;
        if (v == null || (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean')) continue;
        cells[k.trim()] = typeof v === 'string' ? v.slice(0, 2000) : v;
      }
      const contract = normContract(b.contract), ope = normOpe(b.ope), code = normCode(b.code);
      if (!contract && !ope && !code) continue;
      buildings.push({ contract, ope, ...(code ? { code } : {}), building: String(b.building ?? '').slice(0, 200), cells });
    }
    return { buildings, sentAt: typeof data.sentAt === 'string' ? data.sentAt : '', source: 'TotalRecoll' };
  }

  /* rows : lignes du Sheet (objets en-tête → valeur), jamais modifiées.
   * keys : { contract, code, name : en-têtes du n° de contrat, du code OPE et du nom (résolus par l'Observatoire) }. */
  function merge(rows, payload, keys = {}) {
    const stats = { buildings: 0, operations: 0, matchedOperations: 0, unmatchedOperations: 0, conflicts: 0, mismatches: 0, filledCells: 0, correctedCells: 0, ecarts: 0, rowsCompleted: 0, addedRows: 0, addedColumns: [] };
    const details = { unmatched: [], conflicts: [], mismatches: [], ecarts: [], corrected: [] };
    if (!Array.isArray(rows) || !rows.length || !payload || !Array.isArray(payload.buildings)) return { rows: Array.isArray(rows) ? rows : [], stats, details };
    const headers = Object.keys(rows[0] || {});
    const headerByNorm = new Map(headers.map(h => [normHeader(h), h]));
    const out = rows.map(r => ({ ...r }));
    // Index du Sheet : lignes par contrat et par OPE.
    const byContract = new Map(), byOpe = new Map(), byCode = new Map();
    out.forEach((r, i) => {
      const c = keys.contract ? normContract(r[keys.contract]) : '', o = keys.code ? normOpe(r[keys.code]) : '', k = keys.code ? normCode(r[keys.code]) : '';
      if (c) { if (!byContract.has(c)) byContract.set(c, []); byContract.get(c).push(i); }
      if (o) { if (!byOpe.has(o)) byOpe.set(o, []); byOpe.get(o).push(i); }
      if (k) { if (!byCode.has(k)) byCode.set(k, []); byCode.get(k).push(i); }
    });
    // Opérations TotalRecoll : bâtiments regroupés par contrat (sinon OPE), dans l'ordre reçu.
    const ops = new Map();
    payload.buildings.forEach(b => { const k = b.code ? 'k' + b.code : b.contract ? 'c' + b.contract : 'o' + b.ope; if (!ops.has(k)) ops.set(k, { contract: b.contract, ope: b.ope, code: b.code || '', buildings: [] }); const op = ops.get(k); if (!op.ope && b.ope) op.ope = b.ope; op.buildings.push(b); });
    stats.buildings = payload.buildings.length; stats.operations = ops.size;
    const added = new Set(), touched = new Set();
    const push = (list, item) => { if (list.length < MAX_DETAILS) list.push(item); };
    for (const op of ops.values()) {
      const rk = op.code ? byCode.get(op.code) : null;
      const rc = !rk && op.contract ? byContract.get(op.contract) : null, ro = !rk && op.ope ? byOpe.get(op.ope) : null;
      if (rc && ro && rc[0] !== ro[0] && !rc.includes(ro[0])) { stats.conflicts++; push(details.conflicts, { contract: op.contract, ope: op.ope }); continue; }
      const target = rk || rc || ro;
      if (!target) { stats.unmatchedOperations++; push(details.unmatched, { contract: op.contract, ope: op.ope }); continue; }
      stats.matchedOperations++;
      const k = target.length, n = op.buildings.length;
      // Lignes du Sheet déjà découpées par bâtiment : appariement dans l'ordre. Bâtiments en plus : lignes ajoutées.
      if (k !== n) { stats.mismatches++; push(details.mismatches, { contract: op.contract, ope: op.ope, sheetRows: k, buildings: n }); }
      op.buildings.forEach((b, i) => {
        let ri = i < k ? target[i] : -1;
        if (ri < 0) {
          // Identifiants de l'opération seulement : les colonnes de l'opération (logements, statut…) restent sur la 1re ligne.
          const tpl = out[target[0]], extra = {};
          headers.forEach(h => { extra[h] = ''; });
          [keys.code, keys.contract, keys.name].forEach(h => { if (h && h in tpl) extra[h] = tpl[h]; });
          Object.defineProperty(extra, '__recollExtra', { value: true });
          out.push(extra); ri = out.length - 1; stats.addedRows++;
        }
        const row = out[ri]; let filled = 0, fixed = 0;
        for (const [col, v] of Object.entries(b.cells)) {
          if (isEmpty(v)) continue;
          const nk = normHeader(col);
          let h = headerByNorm.get(nk);
          if (!h) { h = col; headerByNorm.set(nk, h); headers.push(h); added.add(h); }
          if (isEmpty(row[h])) { row[h] = v; filled++; continue; }
          if (same(row[h], v)) continue;
          const ok = formatOf(h);
          if (ok && !ok(row[h]) && ok(v)) { stats.correctedCells++; push(details.corrected, { contract: op.contract, ope: op.ope, building: b.building, column: h, sheet: row[h], totalrecoll: v }); row[h] = v; fixed++; continue; }
          stats.ecarts++; push(details.ecarts, { contract: op.contract, ope: op.ope, building: b.building, column: h, sheet: row[h], totalrecoll: v });
        }
        stats.filledCells += filled;
        if (filled || fixed) touched.add(ri);
      });
    }
    stats.rowsCompleted = [...touched].filter(i => i < rows.length).length;
    stats.addedColumns = [...added];
    // Colonnes ajoutées présentes sur toutes les lignes : l'Observatoire lit les en-têtes sur la 1re ligne.
    if (added.size) out.forEach(r => { added.forEach(h => { if (!(h in r)) r[h] = ''; }); });
    return { rows: out, stats, details };
  }

  /* V6.63 — Complément à enregistrer avec un lien partagé : bâtiments TotalRecoll des seules opérations du périmètre
   * (codes internes « codes »), chacun avec le code interne exact de sa ligne du Sheet. rows : lignes du Sheet seul. */
  function buildShareComplement(rows, payload, keys = {}, codes = []) {
    const want = new Set((codes || []).map(normCode).filter(Boolean));
    const out = { type: SHARE_TYPE, v: 1, sentAt: payload?.sentAt || '', buildings: [] };
    if (!Array.isArray(rows) || !rows.length || !payload || !Array.isArray(payload.buildings) || !keys.code || !want.size) return out;
    const byContract = new Map(), byOpe = new Map();
    rows.forEach(r => {
      const code = normCode(r[keys.code]); if (!code || !want.has(code)) return;
      const c = keys.contract ? normContract(r[keys.contract]) : '', o = normOpe(r[keys.code]);
      if (c && !byContract.has(c)) byContract.set(c, code);
      if (o && !byOpe.has(o)) byOpe.set(o, code);
    });
    for (const b of payload.buildings) {
      const code = (b.contract && byContract.get(b.contract)) || (b.ope && byOpe.get(b.ope)) || '';
      if (!code) continue;
      const cells = {};
      for (const [k, v] of Object.entries(b.cells || {})) if (!isEmpty(v)) cells[k] = v;
      if (Object.keys(cells).length) out.buildings.push({ code, contract: b.contract || '', ope: b.ope || '', building: b.building || '', cells });
    }
    return out;
  }

  return { MESSAGE_TYPE, SHARE_TYPE, normContract, normOpe, normCode, normHeader, isEmpty, validatePayload, merge, buildShareComplement };
});
