'use strict';
// Suite de tests unique de l'Observatoire — à lancer depuis la racine : node tests/run_all.js
// Aucun test ne vérifie un numéro de version : la suite reste valable d'une version à l'autre.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const { loadGs, HEADERS, ROWS, MATRIX, asObjects } = require('./gs_harness');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { failed++; console.log('  ÉCHEC ' + name + '\n       ' + (e && e.message)); } }
function section(t) { console.log('\n' + t); }

const R = require(path.join(ROOT, 'newosb-rules.js'));

section('1. Lecture des nombres');
const num = v => R.parseNumber(v);
test('décimale française et séparateur de milliers', () => { assert.strictEqual(num('1 234,5').value, 1234.5); assert.strictEqual(num('1.234,5').value, 1234.5); assert.strictEqual(num('1\u202f200,5').value, 1200.5); });
test('unités ignorées (m², CO2, kWh/m2)', () => { assert.strictEqual(num('68 kWhEP/m².an').value, 68); assert.strictEqual(num('45 kWh/m2').value, 45); assert.strictEqual(num('512 kgCO2/m2').value, 512); });
test('valeurs vides ou non communiquées → null, jamais 0', () => { for (const v of ['', '-', 'n.c.', 'NC', 'N/A', 'sans objet', null, undefined]) assert.strictEqual(num(v).value, null, String(v)); });
test('zéro reste une valeur valide', () => assert.strictEqual(num('0').value, 0));
test('cellule ambiguë → null + motif', () => { for (const v of ['12,3 / 15', '45-50', '< 50', '3.2.1', '2x100']) { const r = num(v); assert.strictEqual(r.value, null, v); assert.strictEqual(r.status, 'doubtful', v); assert(r.reason, v); } });
test('nombre négatif', () => assert.strictEqual(num('-12,5').value, -12.5));

section('2. Épaisseurs et résistances R');
const th = v => R.parseMeasure(v, 'thickness').value, rr = v => R.parseMeasure(v, 'resistance').value;
test('« / » ou « ; » : valeur la plus élevée (règle V6.12)', () => { assert.strictEqual(th('12 cm ; 140 mm ; 95'), 140); assert.strictEqual(th('80 mm / 10 cm'), 100); assert.strictEqual(rr('R=3,2 / R=4,75'), 4.75); });
test('« + » : couches additionnées', () => { assert.strictEqual(th('120 + 100 mm'), 220); assert.strictEqual(rr('R=3 + R=2'), 5); });
test('« x » : nombre de couches × épaisseur', () => { assert.strictEqual(th('2x100 mm'), 200); assert.strictEqual(th('2 x 60 + 100 mm'), 220); });
test('unités d’épaisseur : sans unité = mm, cm ×10, m ×1000', () => { assert.strictEqual(th('160'), 160); assert.strictEqual(th('14cm'), 140); assert.strictEqual(th('0,14 m'), 140); });
test('R : le « 2 » de m2 n’est pas une valeur', () => { assert.strictEqual(rr('R=1,5 m2.K/W'), 1.5); assert.strictEqual(rr('R 3.7 m²K/W'), 3.7); });
test('R : une épaisseur en mm est ignorée', () => assert.strictEqual(rr('R=4,2 ; épaisseur 140 mm'), 4.2));
test('R : un coefficient U est refusé', () => { const r = R.parseMeasure('U=0,25 W/m².K', 'resistance'); assert.strictEqual(r.value, null); assert.strictEqual(r.status, 'doubtful'); });
test('valeurs invraisemblables écartées et signalées', () => { assert.strictEqual(th('0,14'), null); assert.strictEqual(rr('25'), null); assert.strictEqual(R.parseMeasure('25', 'resistance').status, 'doubtful'); });

section('3. Avancement (liste fermée de 7 étapes)');
test('les 7 valeurs admises, dans l’ordre', () => assert.deepStrictEqual(R.PROGRESS_STATUSES.map(s => s.label), ['Non démarrée', 'Dossier incomplet', 'Dossier complet', 'Analyse planifiée', 'Analyse réalisée', 'Visite réalisée', 'Évaluation conforme']));
test('tolère accents, majuscules et pluriels', () => { assert.strictEqual(R.progressStatus('non demarree').key, 'notStarted'); assert.strictEqual(R.progressStatus('DOSSIERS INCOMPLETS').key, 'incomplete'); assert.strictEqual(R.progressStatus('Analyse realisee').key, 'analysis'); });
test('valeur hors liste → unknown + invalid', () => { const p = R.progressStatus('Gagnée'); assert.strictEqual(p.key, 'unknown'); assert.strictEqual(p.state, 'invalid'); });
test('cellule vide → unknown + empty (plus « Non démarrée » par défaut)', () => { const p = R.progressStatus(''); assert.strictEqual(p.key, 'unknown'); assert.strictEqual(p.state, 'empty'); });
const objs = asObjects(HEADERS, ROWS);
test('colonne BC = index 54 ; l’avancement de la feuille de test est bien en BC', () => { assert.strictEqual(R.columnLetter(54), 'BC'); assert.strictEqual(R.columnLetter(0), 'A'); assert.strictEqual(R.columnLetter(26), 'AA'); assert.strictEqual(R.columnLetter(HEADERS.indexOf('Opération: Évaluation: Statut')), 'BC'); });
test('colonne « Opération: Évaluation: Statut » retenue', () => { const r = R.resolveProgressColumn(HEADERS, objs); assert.strictEqual(r.header, 'Opération: Évaluation: Statut'); assert.strictEqual(r.origin, 'nom attendu'); });
test('une faute de frappe sur 40 lignes n’invalide pas la colonne (seuil 95 %)', () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ 'Opération: Évaluation: Statut': i === 0 ? 'Analyse réalisé' : 'Analyse réalisée' }));
  assert.strictEqual(R.resolveProgressColumn(['Opération: Évaluation: Statut'], rows).found, true);
});
test('colonne au bon nom mais au contenu inattendu → utilisée quand même, avec alerte', () => {
  const rows = Array.from({ length: 10 }, () => ({ 'Opération: Évaluation: Statut': 'Gagnée', Autre: 'x' }));
  const r = R.resolveProgressColumn(['Opération: Évaluation: Statut', 'Autre'], rows); assert.strictEqual(r.header, 'Opération: Évaluation: Statut'); assert.strictEqual(r.warning, true); assert(/reconnues/.test(r.message));
});
test('aucune autre colonne n’est utilisée, même si son contenu ressemble à un avancement', () => {
  const rows = objs.map(o => ({ Code: o['Opération: Code interne'], 'Étape éval.': o['Opération: Évaluation: Statut'] }));
  assert.strictEqual(R.resolveProgressColumn(['Code', 'Étape éval.'], rows, { fullHeaders: ['Code', 'Étape éval.'] }).found, false);
});
test('colonne BC renommée : utilisée si son contenu correspond', () => {
  const full = Array.from({ length: 60 }, (_, i) => (i === 54 ? 'Statut évaluation' : 'C' + i));
  const rows = objs.map(o => ({ 'Statut évaluation': o['Opération: Évaluation: Statut'] }));
  const r = R.resolveProgressColumn(['Statut évaluation'], rows, { fullHeaders: full }); assert.strictEqual(r.header, 'Statut évaluation'); assert.strictEqual(r.column, 'BC');
});
test('colonne au bon nom mais pas en BC → utilisée, avec alerte « déplacée »', () => {
  const r = R.resolveProgressColumn(['A', 'Opération: Évaluation: Statut'], objs, { fullHeaders: ['A', 'Opération: Évaluation: Statut'] }); assert.strictEqual(r.column, 'B'); assert(r.warning && /BC/.test(r.message));
});
test('feuille de test : colonne trouvée en BC sans alerte', () => { const r = R.resolveProgressColumn(HEADERS, objs, { fullHeaders: HEADERS }); assert.strictEqual(r.column, 'BC'); assert.strictEqual(r.warning, false); });
test('numérotation et compléments tolérés (« 3 - Dossier complet », « Analyse réalisée - en attente »)', () => { assert.strictEqual(R.progressStatus('3 - Dossier complet').key, 'complete'); assert.strictEqual(R.progressStatus('05. Analyse planifiée').key, 'planned'); assert.strictEqual(R.progressStatus('Analyse réalisée - en attente').key, 'analysis'); assert.strictEqual(R.progressStatus('Dossier incomplet').key, 'incomplete'); });
test('le statut commercial (Gagnée/Perdue) n’est jamais pris pour l’avancement', () => {
  const rows = objs.map(o => ({ Statut: o.Statut })); assert.strictEqual(R.resolveProgressColumn(['Statut'], rows, { fullHeaders: ['Statut'] }).found, false);
});

section('3 bis. Années de certification et de création');
const yr = v => R.parseDateYear(v).value;
test('formats de date acceptés', () => { assert.strictEqual(yr('15/03/2024'), 2024); assert.strictEqual(yr('15/03/24'), 2024); assert.strictEqual(yr('2024-03-15'), 2024); assert.strictEqual(yr('15 mars 2024'), 2024); assert.strictEqual(yr(45366), 2024); assert.strictEqual(yr('45366'), 2024); assert.strictEqual(yr(new Date(2023, 5, 1)), 2023); });
test('date vide → aucune année ; date illisible → signalée', () => { assert.strictEqual(yr(''), null); assert.strictEqual(R.parseDateYear('bientôt').status, 'doubtful'); assert.strictEqual(R.parseDateYear('2023 / 2024').status, 'doubtful'); });
test('« Date de décision de certification » choisie, jamais « Date de décision CD »', () => assert.strictEqual(R.resolveExactHeader(HEADERS, R.CERTIFICATION_DATE_HEADER).header, 'Date de décision de certification'));
test('« Date de création » choisie, jamais « Affaire: Date de création »', () => assert.strictEqual(R.resolveExactHeader(HEADERS, R.CREATION_DATE_HEADER).header, 'Date de création'));
test('intitulé préfixé accepté s’il est unique', () => assert.strictEqual(R.resolveExactHeader(['Certification: Date de décision de certification'], R.CERTIFICATION_DATE_HEADER).header, 'Certification: Date de décision de certification'));
test('plusieurs colonnes possibles → aucune n’est devinée', () => assert.strictEqual(R.resolveExactHeader(['Affaire: Date de création', 'Contrat: Date de création'], R.CREATION_DATE_HEADER).header, null));

test('règle « étape la moins avancée » présente dans le moteur', () => { const a = read('app.js'); assert(a.includes('function dataMergeProjectProgress(g,o)') && a.includes('ro<rg')); });
section('4. Moteur Observatoire (newosb-core.js)');
const coreCtx = { window: { NEWOSB_RULES: R }, console }; vm.createContext(coreCtx); vm.runInContext(read('newosb-core.js'), coreCtx);
const C = coreCtx.window.NEWOSB_CORE;
const op = (key, ...vals) => ({ fields: { [key]: 'X' }, rawRows: vals.map(v => ({ X: v })) });
test('compatibilité V6.12 : maximum entre lignes et unités', () => { assert.strictEqual(C.rawNumber(op('roofThickness', '10 cm', '160 mm'), 'roofThickness'), 160); assert.strictEqual(C.rawNumber(op('wallR', 'R=4,2 ; épaisseur 140 mm'), 'wallR'), 4.2); });
test('une cellule « n.c. » ne masque pas la valeur de la ligne suivante', () => assert.strictEqual(C.rawNumber(op('bbio', 'n.c.', '52'), 'bbio'), 52));
test('valeurs illisibles listées pour la page Qualité', () => { const u = C.unreadableValues(op('bbio', '12,3 / 15'), 'bbio'); assert.strictEqual(u.length, 1); assert(u[0].reason); });
test('Qualité : avancement hors liste signalé', () => { const q = C.qualityForOperation({ code: 'A', name: 'A', moa: 'M', department: '33', referential: 'R', progressState: 'invalid', rawStatus: 'Gagnée', fields: {}, rawRows: [{}] }); assert(q.issues.some(i => i.code === 'progress:invalid')); });
test('dictionnaire : avancement documenté avec la liste fermée', () => assert(/Visite réalisée/.test(C.dictByKey.status.definition) && /95 %/.test(C.dictByKey.status.method)));
test('dictionnaire : années documentées (décision de certification / création)', () => assert(/Date de décision de certification/.test(C.dictByKey.year.method) && /Date de création/.test(C.dictByKey.createdYear.method)));
test('date illisible listée pour la page Qualité', () => assert.strictEqual(C.unreadableValues({ fields: { createdDate: 'D' }, rawRows: [{ D: 'bientôt' }] }, 'createdDate').length, 1));

section('5. Anonymisation côté navigateur (privacy.js)');
const store = {};
const pctx = { console, TextEncoder, Uint8Array, Uint32Array, DataView, crypto: require('crypto').webcrypto,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
  document: { readyState: 'complete', documentElement: { classList: { toggle() {} } }, querySelectorAll: () => [] },
  CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } } };
pctx.window = pctx; pctx.addEventListener = () => {}; pctx.dispatchEvent = () => {};
vm.createContext(pctx); vm.runInContext(read('privacy.js'), pctx);
const P = pctx.window.NEWOSB_PRIVACY;
test('pseudonyme stable pour un même nom', () => assert.strictEqual(P.moa('Promoteur A'), P.moa('promoteur a')));
test('aucune collision sur 20 000 codes', () => { const s = new Set(); for (let i = 0; i < 20000; i++) s.add(P.operationCode('OP' + i)); assert.strictEqual(s.size, 20000); });
test('pseudonymes dépendants de la clé secrète (non devinables)', () => { const a = P.moa('Promoteur A'); P.setSecret('autre-cle'); assert.notStrictEqual(P.moa('Promoteur A'), a); P.setSecret('autre-cle'); assert.strictEqual(P.moa('Promoteur A'), P.moa('Promoteur A')); });
test('montants et adresses supprimés, secteur d’activité conservé', () => {
  const out = P.scrubRaw({ 'Montant HT affaire': '12000', 'Code postal': '33400', "Nom de la société: Secteur d'activité": 'Promoteur', 'Nom de la société: Nom de la société': 'Promoteur A' }, { code: 'OP-1' });
  assert.strictEqual(out['Montant HT affaire'], ''); assert.strictEqual(out['Code postal'], ''); assert.strictEqual(out["Nom de la société: Secteur d'activité"], 'Promoteur'); assert(/^MOA \d{6}$/.test(out['Nom de la société: Nom de la société']));
});

section('6. Script Apps Script OPERATIONS (Code_Operations.gs)');
const call = (gs, params) => JSON.parse(gs.doGet({ parameter: params }).text);
test('lecture meta + bloc de données', () => { const gs = loadGs('Code_Operations.gs', { matrix: MATRIX }); const m = call(gs, { mode: 'meta' }); assert.deepStrictEqual(m.headers.slice(0, 4), HEADERS.slice(0, 4)); const c = call(gs, { mode: 'chunk', offset: 0, limit: 500, totalRows: m.totalRows, lastColumn: m.lastColumn, firstDataRow: m.firstDataRow }); assert.strictEqual(c.rows.length, ROWS.length); });
test('clé d’accès : refus sans clé, accès avec la bonne clé', () => { const gs = loadGs('Code_Operations.gs', { matrix: MATRIX, properties: { NEWOSB_ACCESS_KEY: 'S3cret' } }); assert.strictEqual(call(gs, { mode: 'ping' }).ok, false); assert.strictEqual(call(gs, { mode: 'ping', key: 'faux' }).ok, false); assert.strictEqual(call(gs, { mode: 'ping', key: 'S3cret' }).ok, true); });
test('pont : sans site autorisé, aucune donnée transmise', () => { const gs = loadGs('Code_Operations.gs', { matrix: MATRIX }); const h = gs.doGet({ parameter: { bridge: '1', bridgeToken: 'T' } }).html; assert(/var ALLOWED = \[\];/.test(h)); assert(/ALLOWED\.indexOf\(event\.origin\) < 0/.test(h)); assert(!/postMessage\(payload, '\*'\)/.test(h)); });
test('pont : réponses envoyées uniquement à l’origine autorisée', () => { const gs = loadGs('Code_Operations.gs', { matrix: MATRIX, properties: { NEWOSB_ALLOWED_ORIGINS: 'https://exemple.github.io/, https://autre.fr' } }); const h = gs.doGet({ parameter: { bridge: '1', bridgeToken: 'T' } }).html; assert(h.includes('var ALLOWED = ["https://exemple.github.io","https://autre.fr"];')); assert(h.includes('payload:payload, token:TOKEN}, event.origin)')); });
test('mode anonymisé : noms pseudonymisés, montants/CP supprimés, statut et chiffres conservés', () => {
  const gs = loadGs('Code_Operations.gs', { matrix: MATRIX, properties: { NEWOSB_ANONYMIZED_ONLY: '1' } }); const m = call(gs, { mode: 'meta' });
  const rows = call(gs, { mode: 'chunk', offset: 0, limit: 500, totalRows: m.totalRows, lastColumn: m.lastColumn, firstDataRow: m.firstDataRow }).rows;
  const col = h => HEADERS.indexOf(h); const r0 = rows[0];
  assert(/^OP [0-9A-F]{8}$/.test(r0[col('Opération: Code interne')])); assert(/^Operation [0-9A-F]{8}$/.test(r0[col("Nom de l'opération")])); assert(/^MOA [0-9A-F]{8}$/.test(r0[col('Nom de la société: Nom de la société')]));
  assert.strictEqual(r0[col('Code postal')], ''); assert.strictEqual(r0[col('Montant HT affaire')], '');
  assert.strictEqual(r0[col("Nom de la société: Secteur d'activité")], 'Promoteur'); assert.strictEqual(r0[col('Opération: Évaluation: Statut')], 'Non démarrée'); assert.strictEqual(r0[col('Bbio')], '45');
  assert.strictEqual(rows[0][col('Nom de la société: Nom de la société')], rows[1][col('Nom de la société: Nom de la société')], 'même MOA → même pseudonyme');
  assert.strictEqual(call(gs, { mode: 'ping' }).anonymizedOnly, true);
});
test('Exigences : clé d’accès respectée', () => {
  const ctx = { console, PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k === 'NEWOSB_ACCESS_KEY' ? 'K' : null) }) }, ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) } };
  vm.createContext(ctx); vm.runInContext(read('Code_Exigences.gs') + ';this.__g=doGet;', ctx);
  assert.strictEqual(JSON.parse(ctx.__g({ parameter: {} }).text).ok, false);
});

section('7. Cohérence du paquet');
const index = read('index.html'), gen = read('generator.html');
const scripts = h => [...h.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
test('newosb-rules.js chargé avant app.js et newosb-core.js', () => { for (const h of [index, gen]) { const s = scripts(h); assert(s.indexOf('newosb-rules.js') >= 0 && s.indexOf('newosb-rules.js') < s.indexOf('app.js')); } const s = scripts(index); assert(s.indexOf('newosb-rules.js') < s.indexOf('newosb-core.js')); });
test('l’Observatoire et le générateur chargent la même version d’app.js', () => { const v = h => (h.match(/app\.js\?v=([^"]+)/) || [])[1]; assert.strictEqual(v(index), v(gen)); });
test('tous les fichiers référencés existent', () => { for (const h of [index, gen]) for (const f of [...scripts(h), ...[...h.matchAll(/href="([^"?#:]+\.(?:css|png))/g)].map(m => m[1])]) assert(fs.existsSync(path.join(ROOT, f)), f); });
test('un seul script Apps Script OPERATIONS à la racine (pas de doGet en double)', () => assert(!fs.existsSync(path.join(ROOT, 'Code.gs'))));
test('plus de copie périmée du script dans app.js', () => assert(!/NEWOSB V05\.22\\n \* Source OPERATIONS/.test(read('app.js'))));
test('syntaxe JavaScript valide', () => { for (const f of ['app.js', 'newosb.js', 'newosb-core.js', 'newosb-rules.js', 'privacy.js', 'requirements.js', 'auth.js']) new vm.Script(read(f), { filename: f }); for (const f of ['Code_Operations.gs', 'Code_Exigences.gs']) new vm.Script(read(f), { filename: f }); });
test('l’avancement n’est plus déduit de « État du dossier » ni du statut commercial', () => { const a = read('app.js'); assert(!a.includes('dataRawValue(r,fields.status)||dataRawValue(r,fields.dossierState)||affairStage')); });

console.log(`\n${passed} tests réussis, ${failed} en échec.`);
process.exit(failed ? 1 : 0);
