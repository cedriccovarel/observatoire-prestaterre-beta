/* NEWOSB V6.49 — Complément TotalRecoll.
 * Les lignes du Sheet OPERATIONS restent la base (et la seule source des liens partagés). TotalRecoll envoie,
 * d'onglet à onglet (postMessage, même origine), les valeurs techniques ExtracTerre par bâtiment ; elles ne
 * remplissent que les cellules VIDES du Sheet et les colonnes qu'il n'a pas. Une valeur différente déjà présente
 * dans le Sheet est gardée et signalée comme écart. Rien n'est stocké ni envoyé ailleurs : tout reste en mémoire.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NEWOSB_RECOLL = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const MESSAGE_TYPE = 'totalrecoll:operations';
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
  const normHeader = h => String(h ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').replace(/\s*:\s*$/, '').trim();
  const isEmpty = v => v == null || String(v).trim() === '' || v === '#N/A';
  function same(a, b) {
    const na = Number(String(a).replace(/\s/g, '').replace(',', '.')), nb = Number(String(b).replace(/\s/g, '').replace(',', '.'));
    if (String(a).trim() !== '' && String(b).trim() !== '' && Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) <= 1e-6 * Math.max(1, Math.abs(na));
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }

  // Contrôle du message reçu : forme attendue uniquement, valeurs simples, taille bornée.
  function validatePayload(data) {
    if (!data || data.type !== MESSAGE_TYPE || data.v !== 1 || !Array.isArray(data.buildings)) return null;
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
      const contract = normContract(b.contract), ope = normOpe(b.ope);
      if (!contract && !ope) continue;
      buildings.push({ contract, ope, building: String(b.building ?? '').slice(0, 200), cells });
    }
    return { buildings, sentAt: typeof data.sentAt === 'string' ? data.sentAt : '', source: 'TotalRecoll' };
  }

  /* rows : lignes du Sheet (objets en-tête → valeur), jamais modifiées.
   * keys : { contract: en-tête du n° de contrat, code: en-tête du code OPE } (résolus par l'Observatoire). */
  function merge(rows, payload, keys = {}) {
    const stats = { buildings: 0, operations: 0, matchedOperations: 0, unmatchedOperations: 0, conflicts: 0, mismatches: 0, filledCells: 0, ecarts: 0, rowsCompleted: 0, addedColumns: [] };
    const details = { unmatched: [], conflicts: [], mismatches: [], ecarts: [] };
    if (!Array.isArray(rows) || !rows.length || !payload || !Array.isArray(payload.buildings)) return { rows: Array.isArray(rows) ? rows : [], stats, details };
    const headers = Object.keys(rows[0] || {});
    const headerByNorm = new Map(headers.map(h => [normHeader(h), h]));
    const out = rows.map(r => ({ ...r }));
    // Index du Sheet : lignes par contrat et par OPE.
    const byContract = new Map(), byOpe = new Map();
    out.forEach((r, i) => {
      const c = keys.contract ? normContract(r[keys.contract]) : '', o = keys.code ? normOpe(r[keys.code]) : '';
      if (c) { if (!byContract.has(c)) byContract.set(c, []); byContract.get(c).push(i); }
      if (o) { if (!byOpe.has(o)) byOpe.set(o, []); byOpe.get(o).push(i); }
    });
    // Opérations TotalRecoll : bâtiments regroupés par contrat (sinon OPE), dans l'ordre reçu.
    const ops = new Map();
    payload.buildings.forEach(b => { const k = b.contract ? 'c' + b.contract : 'o' + b.ope; if (!ops.has(k)) ops.set(k, { contract: b.contract, ope: b.ope, buildings: [] }); const op = ops.get(k); if (!op.ope && b.ope) op.ope = b.ope; op.buildings.push(b); });
    stats.buildings = payload.buildings.length; stats.operations = ops.size;
    const added = new Set(), touched = new Set();
    const push = (list, item) => { if (list.length < MAX_DETAILS) list.push(item); };
    for (const op of ops.values()) {
      const rc = op.contract ? byContract.get(op.contract) : null, ro = op.ope ? byOpe.get(op.ope) : null;
      if (rc && ro && rc[0] !== ro[0] && !rc.includes(ro[0])) { stats.conflicts++; push(details.conflicts, { contract: op.contract, ope: op.ope }); continue; }
      const target = rc || ro;
      if (!target) { stats.unmatchedOperations++; push(details.unmatched, { contract: op.contract, ope: op.ope }); continue; }
      stats.matchedOperations++;
      const k = target.length, n = op.buildings.length;
      // Lignes du Sheet déjà découpées par bâtiment : appariement dans l'ordre ; sinon les premières seulement.
      if (k !== n) { stats.mismatches++; push(details.mismatches, { contract: op.contract, ope: op.ope, sheetRows: k, buildings: n }); }
      op.buildings.slice(0, Math.min(k, n)).forEach((b, i) => {
        const row = out[target[i]]; let filled = 0;
        for (const [col, v] of Object.entries(b.cells)) {
          if (isEmpty(v)) continue;
          const nk = normHeader(col);
          let h = headerByNorm.get(nk);
          if (!h) { h = col; headerByNorm.set(nk, h); headers.push(h); added.add(h); }
          if (isEmpty(row[h])) { row[h] = v; filled++; continue; }
          if (!same(row[h], v)) { stats.ecarts++; push(details.ecarts, { contract: op.contract, ope: op.ope, building: b.building, column: h, sheet: row[h], totalrecoll: v }); }
        }
        if (filled) { stats.filledCells += filled; touched.add(target[i]); }
      });
    }
    stats.rowsCompleted = touched.size;
    stats.addedColumns = [...added];
    // Colonnes ajoutées présentes sur toutes les lignes : l'Observatoire lit les en-têtes sur la 1re ligne.
    if (added.size) out.forEach(r => { added.forEach(h => { if (!(h in r)) r[h] = ''; }); });
    return { rows: out, stats, details };
  }

  return { MESSAGE_TYPE, normContract, normOpe, normHeader, validatePayload, merge };
});
