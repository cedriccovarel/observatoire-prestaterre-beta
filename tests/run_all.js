'use strict';
// Suite de tests unique de l'Observatoire — à lancer depuis la racine : node tests/run_all.js
// Aucun test ne vérifie un numéro de version : la suite reste valable d'une version à l'autre.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const { loadGs, HEADERS, ROWS, MATRIX, asObjects } = require('./gs_harness');
let passed = 0, failed = 0;
// Tous les tests (synchrones ou asynchrones) sont exécutés dans l'ordre de déclaration.
const asyncTests = [];
function test(name, fn) { asyncTests.push([name, fn]); }
function atest(name, fn) { asyncTests.push([name, fn]); }
function section(t) { asyncTests.push(['__section__', t]); }

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

section('3. Avancement (liste fermée de 8 étapes)');
test('les 8 valeurs admises, dans l’ordre', () => assert.deepStrictEqual(R.PROGRESS_STATUSES.map(s => s.label), ['Proposition commerciale en cours', 'Non démarrée', 'Dossier incomplet', 'Dossier complet', 'Analyse planifiée', 'Analyse réalisée', 'Visite réalisée', 'Évaluation conforme']));
test('tolère accents, majuscules et pluriels', () => { assert.strictEqual(R.progressStatus('non demarree').key, 'notStarted'); assert.strictEqual(R.progressStatus('DOSSIERS INCOMPLETS').key, 'incomplete'); assert.strictEqual(R.progressStatus('Analyse realisee').key, 'analysis'); });
test('valeur hors liste → unknown + invalid', () => { const p = R.progressStatus('Gagnée'); assert.strictEqual(p.key, 'unknown'); assert.strictEqual(p.state, 'invalid'); });
test('cellule vide → unknown + empty (plus « Non démarrée » par défaut)', () => { const p = R.progressStatus(''); assert.strictEqual(p.key, 'unknown'); assert.strictEqual(p.state, 'empty'); });
const objs = asObjects(HEADERS, ROWS);
test('colonne BC = index 54 ; l’avancement de la feuille de test est bien en BC', () => { assert.strictEqual(R.columnLetter(54), 'BC'); assert.strictEqual(R.columnLetter(0), 'A'); assert.strictEqual(R.columnLetter(26), 'AA'); assert.strictEqual(R.columnLetter(HEADERS.indexOf('Opération: Évaluation: Statut')), 'BC'); });
test('colonne « Opération: Évaluation: Statut » retenue', () => { const r = R.resolveProgressColumn(HEADERS, objs); assert.strictEqual(r.header, 'Opération: Évaluation: Statut'); assert.strictEqual(r.origin, 'nom attendu'); });
test('seuil de 80 % : 8 valeurs reconnues sur 10 suffisent, 7 sur 10 déclenchent une alerte', () => {
  const mk = n => Array.from({ length: 10 }, (_, i) => ({ X: i < n ? 'Analyse réalisée' : 'Gagnée' }));
  const full = Array.from({ length: 60 }, (_, i) => (i === 54 ? 'X' : 'C' + i));
  assert.strictEqual(R.resolveProgressColumn(['X'], mk(8), { fullHeaders: full }).found, true);
  assert.strictEqual(R.resolveProgressColumn(['X'], mk(7), { fullHeaders: full }).found, false);
  assert.strictEqual(R.PROGRESS_MIN_VALID_RATIO, 0.8);
});
test('une faute de frappe sur 40 lignes n’invalide pas la colonne', () => {
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
test('orthographe, majuscules, espaces et fautes légères tolérés', () => {
  const cases = { 'NON  DÉMARRÉE': 'notStarted', 'Non-démarrée': 'notStarted', 'Nondémarrée': 'notStarted', 'Non démarée': 'notStarted', ' dossier  incomplet ': 'incomplete', 'Dossier imcomplet': 'incomplete',
    'dossiercomplet': 'complete', 'Dossier complét': 'complete', 'analyse plannifiée': 'planned', 'Analyse prévue': 'planned', 'Analyse realisé': 'analysis', 'Analyse faite': 'analysis', 'Visite realisee': 'visit', 'Visite': 'visit',
    'Evaluation Conforme': 'compliant', 'Eval. conforme': 'compliant', 'Évaluation conforme.': 'compliant', '\u200bAnalyse réalisée': 'analysis', 'Proposition commerciale en cours': 'proposal' };
  for (const [v, k] of Object.entries(cases)) assert.strictEqual(R.progressStatus(v).key, k, v);
});
test('« non conforme » et les statuts commerciaux ne sont jamais lus comme un avancement', () => { for (const v of ['Non conforme', 'Évaluation non conforme', 'Gagnée', 'En cours', 'Soldé', 'Annulé', 'Analyse']) assert.strictEqual(R.progressStatus(v).key, 'unknown', v); });
test('repli « État du dossier » : lu seulement quand BC est vide', () => {
  assert.strictEqual(R.readProgress({ BC: 'Visite réalisée', AV: 'Évaluation conforme' }, 'BC', 'AV').key, 'visit');
  const fb = R.readProgress({ BC: '', AV: 'Évaluation conforme' }, 'BC', 'AV'); assert.strictEqual(fb.key, 'compliant'); assert.strictEqual(fb.source, 'fallback');
  const bad = R.readProgress({ BC: 'Gagnée', AV: 'Évaluation conforme' }, 'BC', 'AV'); assert.strictEqual(bad.state, 'invalid'); assert.strictEqual(bad.source, 'primary');
  assert.strictEqual(R.readProgress({ BC: '  ', AV: '' }, 'BC', 'AV').state, 'empty');
  assert.strictEqual(R.readProgress({ AV: 'Visite réalisée' }, null, 'AV').key, 'visit');
});
test('colonne de repli retrouvée par son intitulé (accents et casse ignorés), jamais par son contenu', () => {
  assert.strictEqual(R.resolveProgressFallback(['a', 'Etat du dossier']).column, 'B');
  assert.strictEqual(R.resolveProgressFallback(['a', 'Autre']).header, null);
  const r = R.resolveProgressFallback(HEADERS); assert.strictEqual(r.header, 'État du dossier');
});
test('nom de colonne dupliqué : la colonne en position BC est lue (clé unique), pas la dernière', () => {
  const full = Array.from({ length: 70 }, (_, i) => 'C' + i); full[54] = 'Opération: Évaluation: Statut'; full[65] = 'Opération: Évaluation: Statut';
  const keys = full.slice(); keys[54] = 'Opération: Évaluation: Statut [1]';
  const rows = Array.from({ length: 10 }, () => ({ 'Opération: Évaluation: Statut [1]': 'Non démarrée', 'Opération: Évaluation: Statut': '' }));
  const r = R.resolveProgressColumn(full, rows, { fullHeaders: full, keys });
  assert.strictEqual(r.column, 'BC'); assert.strictEqual(r.key, 'Opération: Évaluation: Statut [1]'); assert.strictEqual(r.ratio, 1); assert(/2 colonnes portent ce nom \(BC, BN\)/.test(r.message));
});
test('moteur : la lecture ligne à ligne utilise BC puis le repli', () => { const a = read('app.js'); assert(a.includes('DATA_RULES.readProgress(r,fields.status,fields.progressFallback)') && a.includes('resolveProgressFallback')); });
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
test('dictionnaire : avancement documenté avec la liste fermée', () => assert(/Visite réalisée/.test(C.dictByKey.status.definition) && /80 %/.test(C.dictByKey.status.method) && /État du dossier/.test(C.dictByKey.status.method) && /Proposition commerciale/.test(C.dictByKey.status.definition)));
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

section('6. Script Apps Script OPERATIONS (Code_Operations.gs) — sécurité V6.14');
const call = (gs, params) => JSON.parse(gs.doGet({ parameter: params }).text);
const KEY = 'cle-de-test-0123456789abcdef';
const opsGs = (props = {}) => loadGs('Code_Operations.gs', { matrix: MATRIX, properties: { NEWOSB_ACCESS_KEY: KEY, ...props } });
test('pont + bonne clé : lecture meta + bloc de données', () => { const gs = opsGs(); const m = gs.newosbBridgeRequest({ mode: 'meta', key: KEY }); assert.strictEqual(m.ok, true); assert.deepStrictEqual(m.headers.slice(0, 4), HEADERS.slice(0, 4)); const c = gs.newosbBridgeRequest({ mode: 'chunk', offset: 0, limit: 500, totalRows: m.totalRows, lastColumn: m.lastColumn, firstDataRow: m.firstDataRow, key: KEY }); assert.strictEqual(c.rows.length, ROWS.length); });
test('clé absente, incorrecte ou non configurée : refus (authError), aucune donnée', () => {
  const gs = opsGs();
  for (const k of [undefined, '', 'faux', KEY + 'x', KEY.slice(0, -1)]) { const r = gs.newosbBridgeRequest({ mode: 'meta', key: k }); assert.strictEqual(r.ok, false); assert.strictEqual(r.authError, true); assert(!r.headers && !r.rows && !r.totalRows); }
  const none = loadGs('Code_Operations.gs', { matrix: MATRIX }); const r = none.newosbBridgeRequest({ mode: 'meta', key: 'nimporte' }); assert.strictEqual(r.ok, false); assert(/non configuree/.test(r.error));
  const court = loadGs('Code_Operations.gs', { matrix: MATRIX, properties: { NEWOSB_ACCESS_KEY: 'court' } }); assert.strictEqual(court.newosbBridgeRequest({ mode: 'meta', key: 'court' }).ok, false);
});
test('clé révoquée : les nouvelles requêtes avec l’ancienne clé sont refusées', () => { const gs = opsGs(); assert.strictEqual(gs.newosbBridgeRequest({ mode: 'ping', key: KEY }).ok, true); gs.props.NEWOSB_ACCESS_KEY = 'nouvelle-cle-0123456789xyz'; assert.strictEqual(gs.newosbBridgeRequest({ mode: 'ping', key: KEY }).ok, false); assert.strictEqual(gs.newosbBridgeRequest({ mode: 'ping', key: 'nouvelle-cle-0123456789xyz' }).ok, true); });
test('accès direct GET aux modes data/meta/chunk : aucune donnée, même avec ?key=', () => { const gs = opsGs(); for (const mode of ['meta', 'data', 'chunk', '', 'createslides']) for (const key of [undefined, KEY]) { const r = call(gs, { mode, key, offset: 0, limit: 50 }); assert.strictEqual(r.ok, false, mode); assert(!r.headers && !r.rows && !r.totalRows, mode); } });
test('ping public minimal : ni volume, ni en-tête, ni donnée métier', () => { const r = call(opsGs(), { mode: 'ping' }); assert.strictEqual(r.ok, true); assert.deepStrictEqual(Object.keys(r).sort(), ['ok', 'protected', 'service', 'version']); });
test('plus de transport JSONP (paramètre prefix ignoré)', () => { const gs = opsGs(); const out = gs.doGet({ parameter: { mode: 'meta', prefix: 'cb', key: KEY } }); assert.notStrictEqual(out.mime, 'js'); assert(!/^cb\(/.test(out.text)); assert.strictEqual(JSON.parse(out.text).ok, false); });
test('la clé n’est jamais transmise au traitement ni journalisée', () => { const gs = opsGs({ NEWOSB_ALLOWED_ORIGINS: 'https://a.fr' }); gs.configurerSecuriteObservatoire(); assert(!gs.logs.join('\n').includes(KEY)); assert(read('Code_Operations.gs').includes("if (k !== 'key') clean[k] = input[k]")); assert(!/Logger\.log\([^)]*(params|input)\b/.test(read('Code_Operations.gs'))); });
test('limitation des essais : 30 clés invalides bloquent temporairement', () => { const gs = opsGs(); for (let i = 0; i < 30; i++) gs.newosbBridgeRequest({ mode: 'ping', key: 'x' + i }); const r = gs.newosbBridgeRequest({ mode: 'ping', key: KEY }); assert.strictEqual(r.ok, false); assert(/Trop de tentatives/.test(r.error)); });
test('genererCleAcces : ne remplace jamais une clé existante', () => { const gs = opsGs(); assert.strictEqual(gs.genererCleAccesObservatoire().exists, true); assert.strictEqual(gs.props.NEWOSB_ACCESS_KEY, KEY); const vide = loadGs('Code_Operations.gs', { matrix: MATRIX }); assert.strictEqual(vide.genererCleAccesObservatoire().ok, true); assert.strictEqual(vide.props.NEWOSB_ACCESS_KEY.length, 40); assert(!vide.logs.join('').includes(vide.props.NEWOSB_ACCESS_KEY)); });
test('page du pont : sans site autorisé, refus ; jamais d’envoi vers « * »', () => { const h = opsGs().doGet({ parameter: { bridge: '1', bridgeToken: 'T' } }).html; assert(/var ALLOWED = \[\];/.test(h)); assert(/ALLOWED\.indexOf\(event\.origin\) < 0/.test(h)); assert(!/postMessage\([^)]*'\*'\)/.test(h)); assert(!/postMessage\([^)]*"\*"\)/.test(h)); });
test('page du pont : un seul interlocuteur (fenêtre + origine), jeton exigé', () => { const h = opsGs({ NEWOSB_ALLOWED_ORIGINS: 'https://exemple.github.io/, https://autre.fr' }).doGet({ parameter: { bridge: '1', bridgeToken: 'T' } }).html; assert(h.includes('var ALLOWED = ["https://exemple.github.io","https://autre.fr"];')); assert(/event\.source !== PEER \|\| event\.origin !== PEER_ORIGIN/.test(h)); assert(/!TOKEN \|\| !msg \|\| msg\.token !== TOKEN/.test(h)); });
test('Google Slides et proxys publics conservés', () => { const s = read('Code_Operations.gs'); assert(s.includes("mode === 'createslides'") && s.includes('function newosbCreateGoogleSlides_') && s.includes("endpoint === 'zone123'")); });
test('mode anonymisé : noms pseudonymisés, montants/CP supprimés, statut et chiffres conservés', () => {
  const gs = opsGs({ NEWOSB_ANONYMIZED_ONLY: '1' }); const m = gs.newosbBridgeRequest({ mode: 'meta', key: KEY });
  const rows = gs.newosbBridgeRequest({ mode: 'chunk', offset: 0, limit: 500, totalRows: m.totalRows, lastColumn: m.lastColumn, firstDataRow: m.firstDataRow, key: KEY }).rows;
  const col = h => HEADERS.indexOf(h); const r0 = rows[0];
  assert(/^OP [0-9A-F]{8}$/.test(r0[col('Opération: Code interne')])); assert(/^MOA [0-9A-F]{8}$/.test(r0[col('Nom de la société: Nom de la société')]));
  assert.strictEqual(r0[col('Code postal')], ''); assert.strictEqual(r0[col('Montant HT affaire')], ''); assert.strictEqual(r0[col('Opération: Évaluation: Statut')], 'Non démarrée');
});

section('6 quater. Liens de partage à durée limitée (Code_Operations.gs) — V6.15');
const CODE_H = 'Opération: Code interne', MOA_H = 'Nom de la société: Nom de la société';
const DAYMS = 86400000;
const mkShare = (gs, extra = {}) => gs.newosbBridgeRequest({ mode: 'shareCreate', key: KEY, label: 'Test partage', tabs: ['overview', 'carbon', 'presentation', 'inconnu'], landing: 'carbon', expiresAt: Date.now() + 7 * DAYMS, anonymized: false, codes: ['OP-1', ' op-3 ', 'OP-1'], codeHeader: CODE_H, summary: 'Référentiel : BEE Logement Neuf', ...extra });
const shareRows = (gs, token) => { const m = gs.newosbBridgeRequest({ mode: 'meta', share: token }); assert.strictEqual(m.ok, true, m.error); const c = gs.newosbBridgeRequest({ mode: 'chunk', share: token, offset: 0, limit: 500, totalRows: 9999, firstDataRow: 1, lastColumn: m.lastColumn }); assert.strictEqual(c.ok, true, c.error); return { m, c }; };
test('création : clé exigée ; le jeton est renvoyé une fois, seule son empreinte est stockée', () => {
  const gs = opsGs();
  const refused = gs.newosbBridgeRequest({ mode: 'shareCreate', key: 'mauvaise', tabs: ['overview'], codes: ['OP-1'], codeHeader: CODE_H, expiresAt: Date.now() + DAYMS });
  assert.strictEqual(refused.ok, false); assert.strictEqual(refused.authError, true); assert(!gs.sheets.OBSERVATOIRE_PARTAGES);
  const r = mkShare(gs); assert.strictEqual(r.ok, true, r.error); assert(/^[A-Za-z0-9]{43}$/.test(r.token));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.share.tabs)), ['overview', 'carbon']); assert.strictEqual(r.share.operationCount, 2); assert.strictEqual(r.share.landing, 'carbon');
  const sh = gs.sheets.OBSERVATOIRE_PARTAGES; assert(sh && sh.hidden && sh.protected);
  const stored = JSON.stringify(sh.data); assert(!stored.includes(r.token)); assert(stored.includes(require('crypto').createHash('sha256').update('newosb-share|' + r.token).digest('hex')));
});
test('lecture par le lien : uniquement les lignes du périmètre, sans clé', () => {
  const gs = opsGs(); const { token } = mkShare(gs);
  const ping = gs.newosbBridgeRequest({ mode: 'ping', share: token }); assert.strictEqual(ping.ok, true); assert.strictEqual(ping.share.label, 'Test partage'); assert(!ping.rows && !ping.headers);
  const { m, c } = shareRows(gs, token); assert.strictEqual(m.totalRows, 2); assert.deepStrictEqual(m.headers.slice(0, 3), HEADERS.slice(0, 3));
  const codes = c.rows.map(r => r[HEADERS.indexOf(CODE_H)]).sort(); assert.strictEqual(JSON.stringify(codes), '["OP-1","OP-3"]'); assert.strictEqual(c.done, true);
  assert.strictEqual(c.rows[0][HEADERS.indexOf(MOA_H)], 'Promoteur A');
  const list = gs.newosbBridgeRequest({ mode: 'shareList', key: KEY }); assert.strictEqual(list.shares[0].accessCount, 1); assert(list.shares[0].lastAccessAt > 0); assert(!JSON.stringify(list).includes(token));
});
test('lien anonymisé : pseudonymisation par le serveur, montants et codes postaux retirés', () => {
  const gs = opsGs(); const { token } = mkShare(gs, { anonymized: true }); const { c } = shareRows(gs, token);
  c.rows.forEach(r => { assert(/^MOA [0-9A-F]{8}$/.test(r[HEADERS.indexOf(MOA_H)])); assert(/^OP [0-9A-F]{8}$/.test(r[HEADERS.indexOf(CODE_H)])); assert.strictEqual(r[HEADERS.indexOf('Code postal')], ''); assert.strictEqual(r[HEADERS.indexOf('Montant HT affaire')], ''); });
  assert(!JSON.stringify(c.rows).includes('Promoteur A'));
});
test('expiration, révocation et jeton inconnu : refus explicite, aucune donnée', () => {
  const gs = opsGs(); const a = mkShare(gs), b = mkShare(gs);
  const sh = gs.sheets.OBSERVATOIRE_PARTAGES; sh.data[1][4] = String(Date.now() - 1000);
  const exp = gs.newosbBridgeRequest({ mode: 'meta', share: a.token }); assert.strictEqual(exp.ok, false); assert.strictEqual(exp.authError, true); assert(/expir/.test(exp.error)); assert(!exp.headers && !exp.rows);
  assert.strictEqual(gs.newosbBridgeRequest({ mode: 'shareRevoke', key: KEY, id: b.share.id }).share.status, 'revoked');
  const rev = gs.newosbBridgeRequest({ mode: 'chunk', share: b.token, offset: 0, limit: 10 }); assert.strictEqual(rev.ok, false); assert(/revoqu/.test(rev.error)); assert(!rev.rows);
  for (const t of ['A'.repeat(43), 'court', '<script>', b.token + 'x']) { const r = gs.newosbBridgeRequest({ mode: 'ping', share: t }); assert.strictEqual(r.ok, false); assert.strictEqual(r.authError, true); }
});
test('prolongation : nouvelle date contrôlée (1 h minimum, 366 jours maximum) ; un lien révoqué ne se prolonge pas', () => {
  const gs = opsGs(); const a = mkShare(gs); const sh = gs.sheets.OBSERVATOIRE_PARTAGES; sh.data[1][4] = String(Date.now() - 1000);
  assert.strictEqual(gs.newosbBridgeRequest({ mode: 'ping', share: a.token }).ok, false);
  const ext = gs.newosbBridgeRequest({ mode: 'shareExtend', key: KEY, id: a.share.id, expiresAt: Date.now() + 30 * DAYMS }); assert.strictEqual(ext.ok, true); assert.strictEqual(ext.share.status, 'active');
  assert.strictEqual(gs.newosbBridgeRequest({ mode: 'ping', share: a.token }).ok, true);
  for (const bad of [Date.now() + 1000, Date.now() + 400 * DAYMS, 'demain']) assert.strictEqual(gs.newosbBridgeRequest({ mode: 'shareExtend', key: KEY, id: a.share.id, expiresAt: bad }).ok, false);
  assert.strictEqual(mkShare(gs, { expiresAt: Date.now() + 400 * DAYMS }).ok, false);
  gs.newosbBridgeRequest({ mode: 'shareRevoke', key: KEY, id: a.share.id });
  assert.strictEqual(gs.newosbBridgeRequest({ mode: 'shareExtend', key: KEY, id: a.share.id, expiresAt: Date.now() + 30 * DAYMS }).ok, false);
});
test('un lien ne donne accès ni à l’administration, ni à Google Slides, ni à la lecture complète', () => {
  const gs = opsGs(); const { token } = mkShare(gs);
  for (const mode of ['shareCreate', 'shareList', 'shareRevoke', 'createSlides', 'data', '']) { const r = gs.newosbBridgeRequest({ mode, share: token, codes: ['OP-2'], tabs: ['overview'] }); assert.strictEqual(r.ok, false, mode); assert(!r.rows && !r.token && !r.shares, mode); }
  const both = gs.newosbBridgeRequest({ mode: 'meta', share: token, key: KEY }); assert.strictEqual(both.ok, false); assert(!both.headers);
  const { c } = shareRows(gs, token); assert.strictEqual(c.rows.length, 2);
});
test('création refusée : aucun onglet, aucun code, colonne du code inconnue', () => {
  const gs = opsGs();
  assert(/onglet/.test(mkShare(gs, { tabs: ['presentation'] }).error)); assert(/NEWOSB_RAPPORT_SPREADSHEET_ID/.test(mkShare(gs, { tabs: ['requirements'] }).error)); assert(/aucune operation/.test(mkShare(gs, { codes: [] }).error)); assert(/introuvable/.test(mkShare(gs, { codeHeader: 'Colonne absente' }).error));
});
test('déploiement anonymisé (NEWOSB_ANONYMIZED_ONLY) : tous les liens sont anonymisés', () => {
  const gs = opsGs({ NEWOSB_ANONYMIZED_ONLY: '1' }); const r = mkShare(gs, { anonymized: false }); assert.strictEqual(r.share.anonymized, true);
  const { c } = shareRows(gs, r.token); assert(!JSON.stringify(c.rows).includes('Promoteur A'));
});
test('texte libre écrit dans la feuille : jamais interprété comme une formule', () => {
  const gs = opsGs(); mkShare(gs, { label: '=IMPORTRANGE("x")', summary: '+cmd' }); const row = gs.sheets.OBSERVATOIRE_PARTAGES.data[1];
  assert(!/^[=+\-@]/.test(row[2])); assert(!/^[=+\-@]/.test(row[9])); row.slice(14).filter(Boolean).forEach(v => assert(/^~/.test(v)));
});


// Exigences incluses dans un lien : RAPPORT lu par le script OPERATIONS (même classeur ou NEWOSB_RAPPORT_SPREADSHEET_ID).
const { RAPPORT_HEADERS: RH } = require('./gs_harness');
const RREQ = [RH];
const addReq = (op, ev, moa, codes) => codes.forEach(c => RREQ.push([`${c} - Exigence ${c}`, ev, moa, op, 'BEE Logement Neuf', '04/05/2026', 'Nouvelle-Aquitaine', '33', c, '', 'En cours', '']));
addReq('OP-1', 'EVA-1', 'Promoteur A', ['1.1.1', '2.1.1']); addReq('op-3 ', 'EVA-3', 'Bailleur B', ['1.2.1']); addReq('OP-2', 'EVA-2', 'Promoteur A', ['3.1.1', '4.1.1']);
const opsReqGs = (props = {}) => loadGs('Code_Operations.gs', { matrix: MATRIX, properties: { NEWOSB_ACCESS_KEY: KEY, ...props }, extraSheets: { RAPPORT: RREQ } });
const reqRows = (gs, token) => { const m = gs.newosbBridgeRequest({ mode: 'reqMeta', share: token }); assert.strictEqual(m.ok, true, m.error); const c = gs.newosbBridgeRequest({ mode: 'reqChunk', share: token, offset: 0, limit: 1500 }); assert.strictEqual(c.ok, true, c.error); return { m, c }; };
test('Exigences dans un lien : seules les lignes RAPPORT des opérations du périmètre, sans clé Exigences', () => {
  const gs = opsReqGs(); const r = mkShare(gs, { tabs: ['overview', 'requirements'], reqFilters: { referential: ['BEE Logement Neuf'], moa: ['Promoteur A'], inconnu: ['x'] } }); assert.strictEqual(r.ok, true, r.error);
  const ping = gs.newosbBridgeRequest({ mode: 'ping', share: r.token }); assert(ping.share.tabs.includes('requirements')); assert.strictEqual(JSON.stringify(ping.share.reqFilters), '{"referential":["BEE Logement Neuf"],"moa":["Promoteur A"]}');
  const { m, c } = reqRows(gs, r.token); assert.strictEqual(m.rowCount, 3); assert.strictEqual(m.service, 'NEWOSB EXIGENCES');
  assert.strictEqual(c.rows.map(x => x.operationCode.trim().toUpperCase()).sort().join(','), 'OP-1,OP-1,OP-3'); assert(c.rows.every(x => x.requirement && x.evaluationCode));
});
test('Exigences dans un lien anonymisé : MOA, codes et évaluations pseudonymisés comme les opérations, filtres MOA retirés', () => {
  const gs = opsReqGs(); const r = mkShare(gs, { tabs: ['requirements'], anonymized: true, reqFilters: { moa: ['Promoteur A'], moaGroup: ['G'], referential: ['BEE Logement Neuf'] } });
  const ping = gs.newosbBridgeRequest({ mode: 'ping', share: r.token }); assert.strictEqual(JSON.stringify(ping.share.reqFilters), '{"referential":["BEE Logement Neuf"]}');
  const { c } = reqRows(gs, r.token); const txt = JSON.stringify(c.rows); assert(!/Promoteur A|Bailleur B|EVA-1|"OP-1"/.test(txt));
  const opCodes = shareRows(gs, r.token).c.rows.map(x => x[HEADERS.indexOf(CODE_H)]);
  c.rows.forEach(x => { assert(/^MOA [0-9A-F]{8}$/.test(x.moa)); assert(/^EVA [0-9A-F]{8}$/.test(x.evaluationCode)); assert(opCodes.includes(x.operationCode), 'même pseudonyme que dans OPERATIONS'); });
});
test('Exigences : refusées si l’onglet n’est pas dans le lien, si le lien est révoqué ou expiré', () => {
  const gs = opsReqGs(); const a = mkShare(gs, { tabs: ['overview'] }); const b = mkShare(gs, { tabs: ['requirements'] });
  const no = gs.newosbBridgeRequest({ mode: 'reqChunk', share: a.token, offset: 0, limit: 10 }); assert.strictEqual(no.ok, false); assert(!no.rows);
  gs.newosbBridgeRequest({ mode: 'shareRevoke', key: KEY, id: b.share.id });
  const rev = gs.newosbBridgeRequest({ mode: 'reqMeta', share: b.token }); assert.strictEqual(rev.ok, false); assert.strictEqual(rev.authError, true);
});
test('Exigences : RAPPORT dans un autre classeur via NEWOSB_RAPPORT_SPREADSHEET_ID (identifiant ou URL)', () => {
  const gs = loadGs('Code_Operations.gs', { matrix: MATRIX, properties: { NEWOSB_ACCESS_KEY: KEY, NEWOSB_RAPPORT_SPREADSHEET_ID: 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit' }, extraSheets: { RAPPORT: RREQ } });
  const r = mkShare(gs, { tabs: ['requirements'] }); assert.strictEqual(r.ok, true, r.error); assert.strictEqual(reqRows(gs, r.token).m.rowCount, 3);
  assert.strictEqual(gs.verifierPartageExigences().ok, true);
});

test('V6.17 : Exigences servies par le script OPERATIONS avec la clé OPERATIONS (une seule connexion)', () => {
  const gs = opsReqGs();
  const no = gs.newosbBridgeRequest({ mode: 'reqMeta', key: 'mauvaise-cle-0123456789' }); assert.strictEqual(no.ok, false); assert.strictEqual(no.authError, true); assert(!no.rowCount);
  const m = gs.newosbBridgeRequest({ mode: 'reqMeta', key: KEY }); assert.strictEqual(m.ok, true, m.error); assert.strictEqual(m.service, 'NEWOSB EXIGENCES'); assert.strictEqual(m.rowCount, RREQ.length - 1);
  const c = gs.newosbBridgeRequest({ mode: 'reqChunk', key: KEY, offset: 0, limit: 2 }); assert.strictEqual(c.rows.length, 2); assert.strictEqual(c.done, false);
  const c2 = gs.newosbBridgeRequest({ mode: 'reqChunk', key: KEY, offset: 2, limit: 1500 }); assert.strictEqual(c2.done, true); assert.strictEqual(c.rows.length + c2.rows.length, RREQ.length - 1);
  assert.strictEqual(c.rows[0].moa, 'Promoteur A');
  const anon = opsReqGs({ NEWOSB_ANONYMIZED_ONLY: '1' }); const ca = anon.newosbBridgeRequest({ mode: 'reqChunk', key: KEY, offset: 0, limit: 1500 }); assert(!/Promoteur A|EVA-1/.test(JSON.stringify(ca.rows)));
  const missing = loadGs('Code_Operations.gs', { matrix: MATRIX, properties: { NEWOSB_ACCESS_KEY: KEY } }).newosbBridgeRequest({ mode: 'reqMeta', key: KEY }); assert.strictEqual(missing.ok, false); assert(/NEWOSB_RAPPORT_SPREADSHEET_ID/.test(missing.error));
});
test('V6.17 : l’Observatoire charge les exigences par la connexion OPERATIONS, et les retire à la déconnexion', () => {
  const a = read('app.js'), r = read('requirements.js');
  assert(a.includes('window.NEWOSB_REQUIREMENTS.loadViaOperations((p,t)=>dataAppsScriptRequest(url,p,t))'));
  assert(a.includes("function dataClearPrivateData(){if(window.NEWOSB_REQUIREMENTS?.status?.().via==='operations')window.NEWOSB_REQUIREMENTS.disconnect();"));
  assert(r.includes("async function loadViaOperations(req)") && !/loadViaOperations[\s\S]{0,400}localStorage/.test(r));
});
test('lecture de RAPPORT : bloc identique dans Code_Exigences.gs et Code_Operations.gs', () => {
  const block = f => { const t = read(f); const a = t.indexOf('// >>> LECTURE RAPPORT'), b = t.indexOf('// <<< LECTURE RAPPORT'); assert(a >= 0 && b > a, f); return t.slice(a, b); };
  assert.strictEqual(block('Code_Operations.gs'), block('Code_Exigences.gs'));
});

section('6 bis. Script Apps Script Exigences (Code_Exigences.gs) — sécurité V6.14');
const { RAPPORT_HEADERS, RAPPORT_ROWS, addR, LN, LR } = require('./gs_harness');
addR('OP-001', 'EVA-1', 'Promoteur A', LN, ['1.1.1', '2.1.1', '1.2.1']);
addR('OP-001', 'EVA-1', 'Promoteur A', LN, ['1.1.1']);
addR('OP-002', 'EVA-2', 'Promoteur B', LR, ['1.2.1', '3.1.1'], { validated: 'Non' });
const RMATRIX = [RAPPORT_HEADERS, ...RAPPORT_ROWS];
const reqGs = (props = { NEWOSB_ACCESS_KEY: KEY }) => loadGs('Code_Exigences.gs', { matrix: RMATRIX, sheetName: 'RAPPORT', properties: props });
test('pont + bonne clé : meta puis blocs, colonnes reconnues quel que soit leur ordre', () => { const gs = reqGs(); const m = gs.newosbExigencesBridgeRequest({ mode: 'meta', key: KEY }); assert.strictEqual(m.ok, true); assert.strictEqual(m.rowCount, RAPPORT_ROWS.length); const c = gs.newosbExigencesBridgeRequest({ mode: 'chunk', offset: 0, limit: 3, key: KEY }); assert.strictEqual(c.rows.length, 3); assert.strictEqual(c.rows[0].operationCode, 'OP-001'); assert.strictEqual(c.rows[0].requirementCode, '1.1.1'); const all = gs.newosbExigencesBridgeRequest({ mode: 'chunk', offset: 3, limit: 100, key: KEY }); assert.strictEqual(all.rows.length, RAPPORT_ROWS.length - 3); assert.strictEqual(all.rows.find(r => r.operationCode === 'OP-002').requirementValidated, 'Non'); });
test('clé absente, incorrecte ou non configurée : refus, aucune métadonnée', () => { const gs = reqGs(); for (const k of [undefined, 'faux']) for (const mode of ['meta', 'chunk', 'ping']) { const r = gs.newosbExigencesBridgeRequest({ mode, key: k }); assert.strictEqual(r.ok, false); assert.strictEqual(r.authError, true); assert(!r.rowCount && !r.headers && !r.rows && !r.mapping); } assert.strictEqual(reqGs({}).newosbExigencesBridgeRequest({ mode: 'meta', key: KEY }).ok, false); });
test('clé révoquée refusée', () => { const gs = reqGs(); assert.strictEqual(gs.newosbExigencesBridgeRequest({ mode: 'ping', key: KEY }).ok, true); gs.props.NEWOSB_ACCESS_KEY = 'autre-cle-abcdefghijklmnop'; assert.strictEqual(gs.newosbExigencesBridgeRequest({ mode: 'ping', key: KEY }).ok, false); });
test('GET direct : aucun mode ne renvoie de données (l’ancien doGet exposait RAPPORT)', () => { const gs = reqGs(); for (const mode of ['', 'data', 'meta', 'chunk']) for (const key of [undefined, KEY]) { const r = JSON.parse(gs.doGet({ parameter: { mode, key } }).text); assert.strictEqual(r.ok, false); assert(!r.rows && !r.headers && !r.rowCount && !r.mapping); } const p = JSON.parse(gs.doGet({ parameter: { mode: 'ping' } }).text); assert.deepStrictEqual(Object.keys(p).sort(), ['ok', 'protected', 'service', 'version']); });
test('page du pont Exigences : origine, fenêtre unique, jeton ; aucun « * »', () => { const h = reqGs({ NEWOSB_ACCESS_KEY: KEY, NEWOSB_ALLOWED_ORIGINS: 'https://exemple.github.io' }).doGet({ parameter: { bridge: '1', bridgeToken: 'T1' } }).html; assert(h.includes('var ALLOWED=["https://exemple.github.io"]')); assert(h.includes('ev.source!==PEER||ev.origin!==PEER_ORIGIN')); assert(!/postMessage\([^)]*["']\*["']\)/.test(h)); assert(h.includes('.newosbExigencesBridgeRequest(p)')); });
test('configuration journalisée sans la clé', () => { const gs = reqGs(); gs.configurerSecuriteExigences(); assert(!gs.logs.join('\n').includes(KEY) && /configurée/.test(gs.logs.join('\n'))); });

section('6 ter. Listes à cocher (Mentions × performances, filtres)');
test('CSS : l’attribut hidden masque réellement les lignes des listes à cocher', () => assert(/\.obs-matrix-check-list>label\[hidden\]\{display:none!important\}/.test(read('newosb.css'))));
test('listes à cocher : défilement et recherche conservés lors d’un nouveau rendu', () => { const j = read('newosb.js'); assert(j.includes('data-scroll-key="matrix-list-${kind}"') && j.includes('data-scroll-key="global-filter-${key}"') && j.includes('function restoreInnerScroll(snap)') && j.includes('state.matrixSearch')); });

section('8. Moteur des mentions (newosb-mentions.js + mentions_catalog.js)');
const MEN = require(path.join(ROOT, 'newosb-mentions.js'));
const CAT = require(path.join(ROOT, 'mentions_catalog.js'));
const LN_CTX = 'BEE_LN@2026-05-04', LR_CTX = 'BEE_LR@2025-06-18';
const evalIn = (ctxKey, codes, values = {}) => MEN.analyseContext({ key: ctxKey, top: codes.map(code => ({ code })) }, CAT, values);
const byId = (a, id) => a.results.find(r => r.id === id);
test('paramètre centralisé : bouquet = 20 exigences', () => { assert.strictEqual(MEN.BOUQUET_SIZE, 20); assert(!/\b20\b/.test(read('requirements.js').replace(/20\d\d/g, '').match(/buildBouquets\([^)]*\)/)[0])); });
test('identifiants : espaces, casse, invisibles normalisés ; zéros significatifs conservés', () => {
  assert.strictEqual(MEN.normalizeId(' op-012​ '), 'OP-012'); assert.strictEqual(MEN.normalizeId('OP 012'), 'OP 012'); assert.strictEqual(MEN.normalizeId('OP–012'), 'OP-012');
  assert.notStrictEqual(MEN.normalizeId('OP-012'), MEN.normalizeId('OP-12')); assert.notStrictEqual(MEN.normalizeId('00123'), MEN.normalizeId('123')); assert.notStrictEqual(MEN.normalizeId('OP-0120'), MEN.normalizeId('OP-012'));
});
test('référentiels : 4 familles distinctes, autres non reconnus', () => {
  assert.strictEqual(MEN.referentialFamily('BEE Logement Neuf'), 'BEE_LN'); assert.strictEqual(MEN.referentialFamily('BEE Logement Rénovation'), 'BEE_LR'); assert.strictEqual(MEN.referentialFamily('BEE Tertiaire Neuf'), 'BEE_TN'); assert.strictEqual(MEN.referentialFamily('BEE Tertiaire Exploitation'), 'BEE_TE'); assert.strictEqual(MEN.referentialFamily('NF Habitat'), '');
});
test('famille seule (décision du 06/10/2026) : toutes versions Neuf → règles LN 2026, Rénovation → règles LR 2025 ; jamais mélangées', () => {
  for (const v of ['04/05/2026', '01/02/2023', 'V5', '']) assert.strictEqual(MEN.rowContext({ referential: 'BEE Logement Neuf', referentialVersion: v }, CAT).key, LN_CTX, v);
  for (const v of ['18/06/2025', '04/05/2026', '2019']) assert.strictEqual(MEN.rowContext({ referential: 'BEE Logement Rénovation', referentialVersion: v }, CAT).key, LR_CTX, v);
});
test('famille reconnue avec ou sans « BEE » ; autres référentiels écartés', () => { assert.strictEqual(MEN.referentialFamily('Logement Neuf'), 'BEE_LN'); assert.strictEqual(MEN.referentialFamily('Logement - Rénovation'), 'BEE_LR'); assert.strictEqual(MEN.referentialFamily('NF Habitat Neuf'), ''); });
test('diagnostic : valeurs brutes de référentiel et de version listées (à titre indicatif)', () => { const b = MEN.buildBouquets([mkRow('A', '1.1.1'), mkRow('B', '1.1.1', ['BEE Logement Neuf', 'V5'])], CAT); const v = b.diagnostics.versions; assert.strictEqual(v.length, 2); assert(v.every(x => x.covered && x.context === LN_CTX)); assert.strictEqual(b.contexts.length, 1); assert.strictEqual(b.contexts[0].operations, 2); });
test('codes : Tertiaire / anciennes numérotations acceptés, pas seulement 1 à 4', () => { assert.strictEqual(MEN.codeFrom('4.B.2 - x'), '4.B.2'); assert.strictEqual(MEN.codeFrom('5.1.2 Exploitation'), '5.1.2'); assert.strictEqual(MEN.codeFrom('E1.2.3 - Suivi'), 'E1.2.3'); assert.strictEqual(MEN.codeFrom('4.10.2 - Localisation'), '4.10.2'); });
test('codes contradictoires sur une ligne → non résolu', () => assert.strictEqual(MEN.canonicalCode({ requirementCode: '1.1.1', requirement: '1.1.2 - Diagnostic' }).code, ''));
test('même numéro, référentiels différents : identités distinctes', () => { const a = MEN.resolveRequirement({ referential: 'BEE Logement Neuf', referentialVersion: '04/05/2026', requirementCode: '1.1.7' }, CAT); const b = MEN.resolveRequirement({ referential: 'BEE Logement Rénovation', referentialVersion: '18/06/2025', requirementCode: '1.1.7' }, CAT); assert.notStrictEqual(a.key, b.key); assert.notStrictEqual(a.label, b.label); });
test('code absent du référentiel de sa version → diagnostic, pas de rapprochement approximatif', () => { const r = MEN.resolveRequirement({ referential: 'BEE Logement Neuf', referentialVersion: '04/05/2026', requirement: 'Analyse du site (variante)', requirementCode: '' }, CAT); assert.strictEqual(r.status, 'unresolved'); const r2 = MEN.resolveRequirement({ referential: 'BEE Logement Neuf', referentialVersion: '04/05/2026', requirementCode: '9.9.9' }, CAT); assert.strictEqual(r2.status, 'unresolved'); assert(/absent/.test(r2.reason)); });
const mkRow = (op, code, [ref, ver] = ['BEE Logement Neuf', '04/05/2026'], ev = 'EV-' + op) => ({ operationCode: op, evaluationCode: ev, referential: ref, referentialVersion: ver, requirementCode: code, requirement: `${code} - x` });
test('fréquence par opérations distinctes : doublons et évaluations multiples comptés une fois', () => {
  const rows = [mkRow('A', '1.1.1'), mkRow('A', '1.1.1'), mkRow('A', '1.1.1', undefined, 'EV-A2'), mkRow('B', '1.1.1'), mkRow('B', '2.1.1'), mkRow('C', '2.1.1')];
  const b = MEN.buildBouquets(rows, CAT); const c = b.contexts[0];
  assert.strictEqual(c.operations, 3); const f = Object.fromEntries(c.items.map(i => [i.code, i.operations])); assert.strictEqual(f['1.1.1'], 2); assert.strictEqual(f['2.1.1'], 2); assert.strictEqual(c.items[0].frequency, 2 / 3);
});
test('opérations sans ligne / sans code opération : jamais comptées comme « zéro exigence »', () => { const b = MEN.buildBouquets([mkRow('A', '1.1.1'), { ...mkRow('', '1.1.1') }], CAT); assert.strictEqual(b.contexts[0].operations, 1); assert.strictEqual(b.diagnostics.rowsWithoutOperation, 1); });
test('tri : fréquence décroissante puis code canonique (ordre naturel), Top limité', () => {
  const rows = []; ['4.10.2', '4.9.4', '1.1.1'].forEach(c => ['A', 'B'].forEach(o => rows.push(mkRow(o, c)))); rows.push(mkRow('A', '2.1.1'));
  const c = MEN.buildBouquets(rows, CAT, { size: 3 }).contexts[0]; assert.deepStrictEqual(c.top.map(i => i.code), ['1.1.1', '4.9.4', '4.10.2']); assert.strictEqual(c.items.length, 4);
});
test('moins de 20 exigences : nombre réel utilisé', () => { const c = MEN.buildBouquets([mkRow('A', '1.1.1')], CAT).contexts[0]; assert.strictEqual(c.top.length, 1); });
test('périmètres multiples : un bouquet par référentiel/version, le plus documenté en premier', () => {
  const rows = [mkRow('A', '1.1.1'), mkRow('B', '1.2.1', ['BEE Logement Rénovation', '18/06/2025']), mkRow('C', '1.2.1', ['BEE Logement Rénovation', '18/06/2025'])];
  const b = MEN.buildBouquets(rows, CAT); assert.deepStrictEqual(b.contexts.map(c => [c.key, c.operations]), [[LR_CTX, 2], [LN_CTX, 1]]);
});
test('CAS NORMATIF BEE LN 04/05/2026, collectif RE 2020, PC compatible : Biodiversité 9/10, BEE+ 8/9, Habitat Qualité 6/8', () => {
  const bouquet = '1.1.1 1.1.4 1.2.1 1.2.2 1.2.3 2.1.1 2.1.2 2.1.3 2.2.2 2.3.1 2.4.1 2.4.2 2.4.3 2.4.7 3.3.2 4.1.1 4.1.2 4.3.7 4.3.8 4.6.1'.split(' ');
  assert.strictEqual(bouquet.length, 20);
  const a = evalIn(LN_CTX, bouquet, { 'ln2026.regime': 'RE2020', 'ln2026.buildingType': 'collectif', 'ln2026.permit': '2025_2027' });
  const bio = byId(a, 'BEE_LN_2026_BIODIVERSITE'), plus = byId(a, 'BEE_LN_2026_BEE_PLUS'), hq = byId(a, 'BEE_LN_2026_HABITAT_QUALITE');
  assert.deepStrictEqual([bio.status, bio.covered, bio.required], ['ok', 9, 10]); assert.strictEqual(bio.pct, 90);
  assert(bio.units.find(u => u.code === '2.4.6').state === 'absent');
  assert.deepStrictEqual([plus.status, plus.covered, plus.required], ['ok', 8, 9]); assert.strictEqual(Math.round(plus.pct), 89);
  assert(plus.units.some(u => u.state === 'absent' && (u.codes || []).includes('4.3.4')));
  assert.deepStrictEqual([hq.status, hq.covered, hq.required], ['ok', 6, 8]); assert.strictEqual(hq.pct, 75);
  assert.deepStrictEqual(hq.units.filter(u => u.state === 'absent').map(u => u.id).sort(), ['BEE_LN_2026_ACOUSTIQUE_RENFORCEE', 'BEE_LN_2026_EVALUATION_CHARGES']);
});
test('ET : toutes les conditions obligatoires comptent', () => { const r = byId(evalIn(LN_CTX, ['1.1.1']), 'BEE_LN_2026_BIODIVERSITE'); assert.strictEqual(r.required, 10); assert.strictEqual(r.covered, 1); });
test('OU : une alternative couvre le groupe ; les autres ne deviennent pas manquantes', () => { const r = byId(evalIn(LN_CTX, ['4.3.6'], { 'ln2026.buildingType': 'collectif' }), 'BEE_LN_2026_ACOUSTIQUE_RENFORCEE'); assert.deepStrictEqual([r.covered, r.required, r.pct], [1, 1, 100]); assert.deepStrictEqual(r.units[0].via, ['4.3.6']); });
test('au moins K parmi N : contribution plafonnée à K, jamais > 100 %', () => { const a = evalIn(LN_CTX, ['4.4.1', '4.4.2', '4.4.4'], { 'ln2026.regime': 'RE2020', 'ln2026.concerne.4.4.5': 'non' }); const r = byId(a, 'BEE_LN_2026_QAI'); assert.deepStrictEqual([r.status, r.covered, r.required, r.pct], ['ok', 2, 2, 100]); const one = byId(evalIn(LN_CTX, ['4.4.1'], { 'ln2026.regime': 'RE2020', 'ln2026.concerne.4.4.5': 'non' }), 'BEE_LN_2026_QAI'); assert.deepStrictEqual([one.covered, one.required], [1, 2]); });
test('dépendance : la règle de la mention liée est évaluée (pas sa simple présence)', () => { const ctx = { 'ln2026.regime': 'RE2020', 'ln2026.buildingType': 'collectif' }; const with37 = byId(evalIn(LN_CTX, ['3.7.2'], ctx), 'BEE_LN_2026_HABITAT_QUALITE'); assert(with37.units.find(u => u.id === 'BEE_LN_2026_EVALUATION_CHARGES').state === 'covered'); const without = byId(evalIn(LN_CTX, [], ctx), 'BEE_LN_2026_HABITAT_QUALITE'); assert(without.units.find(u => u.id === 'BEE_LN_2026_EVALUATION_CHARGES').state === 'absent'); });
test('optionnelles et recommandées : sans effet sur le score', () => { const ctx = { 'ln2026.regime': 'RE2020', 'ln2026.concerne.1.1.2': 'oui', 'ln2026.demolition': 'non' }; const a = byId(evalIn(LN_CTX, ['1.1.6'], ctx), 'BEE_LN_2026_ECONOMIE_CIRCULAIRE'), b = byId(evalIn(LN_CTX, ['1.1.6', '1.1.5', '1.1.8', '2.4.7', '4.7.1'], ctx), 'BEE_LN_2026_ECONOMIE_CIRCULAIRE'); assert.strictEqual(a.required, b.required); assert.strictEqual(a.covered, b.covered); });
test('non applicable établi : exclu ; condition inconnue : jamais « non applicable » ni « satisfaite »', () => {
  const na = byId(evalIn(LN_CTX, ['3.7.1'], { 'ln2026.buildingType': 'individuel_isole' }), 'BEE_LN_2026_EVALUATION_CHARGES'); assert.strictEqual(na.status, 'not_applicable');
  const unk = byId(evalIn(LN_CTX, ['3.7.1'], {}), 'BEE_LN_2026_EVALUATION_CHARGES'); assert.strictEqual(unk.status, 'provisional');
  const ecNon = byId(evalIn(LN_CTX, [], { 'ln2026.regime': 'RE2020', 'ln2026.concerne.1.1.2': 'non', 'ln2026.demolition': 'non' }), 'BEE_LN_2026_ECONOMIE_CIRCULAIRE'); const ecOui = byId(evalIn(LN_CTX, [], { 'ln2026.regime': 'RE2020', 'ln2026.concerne.1.1.2': 'oui', 'ln2026.demolition': 'oui' }), 'BEE_LN_2026_ECONOMIE_CIRCULAIRE');
  assert.strictEqual(ecOui.required - ecNon.required, 3); assert.strictEqual(byId(evalIn(LN_CTX, [], { 'ln2026.regime': 'RE2020' }), 'BEE_LN_2026_ECONOMIE_CIRCULAIRE').status, 'provisional');
});
test('condition inconnue ne changeant pas le résultat : calcul fiable (même résultat pour toutes les valeurs)', () => { const r = byId(evalIn(LN_CTX, ['3.2.3']), 'BEE_LN_2026_BONUS_CONSTRUCTIBILITE'); assert.strictEqual(r.status, 'ok'); assert.strictEqual(r.pct, 100); });
test('ambiguïté du référentiel affectant le dénominateur : provisoire, exclue du classement', () => { const a = evalIn(LN_CTX, ['3.1.1'], { 'ln2026.regime': 'RT2012' }); assert.strictEqual(byId(a, 'BEE_LN_2026_BPE').status, 'provisional'); assert(!a.ranked.some(r => r.id === 'BEE_LN_2026_BPE')); });
test('correspondance « à vérifier » (niveau supérieur présumé) : pas de coche verte, résultat provisoire', () => { const r = byId(evalIn(LR_CTX, ['3.1.11']), 'BEE_LR_2025_ECONOMIE_CIRCULAIRE'); const u = r.units.find(x => x.code === '3.1.10'); assert.strictEqual(u.state, 'unresolved'); assert.strictEqual(r.status, 'provisional'); });
test('règle sans critère défini (BPE LR 2025) : « Non calculable », jamais 0 %', () => { const r = byId(evalIn(LR_CTX, ['3.1.2']), 'BEE_LR_2025_BPE'); assert.strictEqual(r.status, 'not_computable'); assert.strictEqual(r.pct, null); assert(r.reason); });
test('Tertiaire (référentiel non fourni) : aucune mention calculée, « règles non disponibles »', () => { const ctx = MEN.rowContext({ referential: 'BEE Tertiaire Neuf', referentialVersion: '2024' }, CAT); const a = evalIn(ctx.key, ['1.2.1']); assert.strictEqual(a.results.length, 0); assert.strictEqual(a.source.status, 'source_missing'); });
test('ancien code absent du référentiel de la famille : écarté au diagnostic, jamais rapproché par similitude', () => { const b = MEN.buildBouquets([mkRow('A', '4.B.2', ['BEE Logement Neuf', '01/02/2018'])], CAT); assert.strictEqual(b.contexts[0].items.length, 0); assert.strictEqual(b.contexts[0].unresolved.length, 1); });
test('classement : couverture décroissante (avant arrondi), puis unités requises, puis nom', () => {
  const fake = [{ id: 'b', name: 'B', status: 'ok', pct: 66.7, required: 3 }, { id: 'a', name: 'A', status: 'ok', pct: 66.66, required: 9 }, { id: 'c', name: 'C', status: 'ok', pct: 50, required: 2 }, { id: 'd', name: 'D', status: 'ok', pct: 50, required: 2 }, { id: 'p', name: 'P', status: 'provisional', pct: 99, required: 1 }];
  assert.deepStrictEqual(MEN.rankMentions(fake).map(r => r.id), ['b', 'a', 'c', 'd']);
});
test('menu : toutes les mentions, regroupées par référentiel et version ; homonymes distincts', () => { const menu = MEN.mentionMenu(CAT); assert(menu.length >= 2); const names = menu.flatMap(g => g.mentions.map(m => m.id)); assert.strictEqual(new Set(names).size, CAT.mentions.length); const bee = CAT.mentions.filter(m => m.name === 'BEE+'); assert.strictEqual(bee.length, 2); assert.notStrictEqual(bee[0].context, bee[1].context); });
test('catalogue : chaque code cité existe dans le référentiel de sa version ; sources et pages présentes', () => {
  const bad = []; const walk = (n, src, id) => { if (!n) return; if (n.type === 'req') [n.code, ...(n.alt || []), ...(n.inferredAlt || [])].forEach(c => { if (!src.requirements.some(r => r.code === c)) bad.push(id + ':' + c); }); (n.items || []).forEach(x => walk(x, src, id)); Object.values(n.cases || {}).forEach(x => walk(x, src, id)); };
  CAT.mentions.forEach(m => { const s = CAT.sources.find(x => x.context === m.context); assert(s, m.id); assert(m.sources && m.sources.every(x => x.pages), m.id); if (s.requirements) walk(m.criteria, s, m.id); });
  assert.deepStrictEqual(bad, []); assert.strictEqual(CAT.sources.find(s => s.context === LN_CTX).requirements.length, 165);
});

section('9. Module Exigences : fiche opération et encart de compatibilité (requirements.js)');
// Charge le vrai requirements.js dans un contexte simulé ; le pont est remplacé par un appel direct au vrai Code_Exigences.gs.
function reqModule(rows, { key = KEY, serverKey = KEY, privacyOn = false } = {}) {
  const matrix = [RAPPORT_HEADERS, ...rows];
  const gs = loadGs('Code_Exigences.gs', { matrix, sheetName: 'RAPPORT', properties: { NEWOSB_ACCESS_KEY: serverKey } });
  const store = {}, events = [];
  const ctx = { console, Promise, setTimeout, clearTimeout, Date, JSON, Math, Map, Set, URL, encodeURIComponent, decodeURIComponent, Intl, Number, String, Array, Object, RegExp, Error };
  ctx.window = ctx;
  ctx.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  ctx.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
  ctx.addEventListener = () => {}; ctx.dispatchEvent = e => events.push(e.type);
  ctx.location = { href: 'https://site.test/' };
  let bridgeKey = '';
  const vmCtx = vm.createContext(ctx);
  vm.runInContext(read('newosb-bridge.js'), vmCtx);
  const realSplit = ctx.NEWOSB_BRIDGE.splitUrl;
  ctx.NEWOSB_BRIDGE = { splitUrl: realSplit, create: () => ({ setKey: v => { bridgeKey = String(v || ''); }, clearKey: () => { bridgeKey = ''; }, hasKey: () => !!bridgeKey, preparePopup: () => null, destroy() {}, closePopupSoon() {},
    request: async (url, params) => { if (!bridgeKey) { const e = new Error('Clé non saisie'); e.authError = true; throw e; } const r = gs.newosbExigencesBridgeRequest(JSON.parse(JSON.stringify({ ...params, key: bridgeKey }))); if (r.ok === false) { const e = new Error(r.error); e.authError = !!r.authError; throw e; } return r; } }) };
  ctx.NEWOSB_PRIVACY = { enabled: () => privacyOn, moa: v => 'MOA ' + String(v).length, operationCode: v => 'OP-' + String(100000 + String(v).trim().toLowerCase().split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 899999, 7)).slice(0, 6), evaluationCode: v => 'EVA-999999' };
  vm.runInContext(read('requirements_catalog.js'), vmCtx); vm.runInContext(read('mentions_catalog.js'), vmCtx); vm.runInContext(read('newosb-mentions.js'), vmCtx); vm.runInContext(read('requirements.js'), vmCtx);
  const api = ctx.NEWOSB_REQUIREMENTS;
  const el = (attrs, extra = {}) => ({ dataset: Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v])), ...extra, closest(sel) { const m = sel.match(/^\[([a-z-]+)\]$/); return m && m[1] in attrs ? this : null; }, matches() { return false; } });
  const check = (key, value, checked = true) => api.handleChange({ target: el({ 'data-req-filter-check': key }, { value, checked }) });
  return { api, gs, ctx, events, setKey: k => { bridgeKey = k; }, check, el, connect: async () => { if (key) bridgeKey = key; await api.load('https://script.google.com/macros/s/EXI/exec'); } };
}
const R1 = []; const addRow = (op, ev, moa, refver, codes, extra = {}) => codes.forEach(c => R1.push([`${c} - Exigence ${c}`, ev, moa, op, refver[0], refver[1], extra.region || 'Nouvelle-Aquitaine', extra.dep || '33', c, extra.validated || '', extra.status || 'En cours', '']));
const BOUQUET = '1.1.1 1.1.4 1.2.1 1.2.2 1.2.3 2.1.1 2.1.2 2.1.3 2.2.2 2.3.1 2.4.1 2.4.2 2.4.3 2.4.7 3.3.2 4.1.1 4.1.2 4.3.7 4.3.8 4.6.1'.split(' ');
['OP-0101', 'OP-0102', 'OP-0103'].forEach((op, i) => addRow(op, 'EVA-' + i, 'Promoteur A', LN, BOUQUET));
addRow('OP-0101', 'EVA-0', 'Promoteur A', LN, ['1.1.1', '1.1.1']);                       // doublons
addRow('OP-0101', 'EVA-OLD', 'Promoteur A', LR, ['1.2.1', '3.1.1'], { validated: 'Non' }); // 2e évaluation, autre référentiel
addRow('OP-101', 'EVA-X', 'Promoteur B', LN, ['2.4.6']);                                  // identifiant proche mais distinct
addRow('OP-0200', 'EVA-B1', 'Promoteur B', LN, ['1.1.1', '2.4.6', '9.9.9']);
addRow('OP-0300', 'EVA-C1', 'Bailleur <b>C</b>', LR, ['1.2.1', '1.2.2']);
R1.push(['Exigence orpheline', 'EVA-Z', 'Promoteur A', '', 'BEE Logement Neuf', '04/05/2026', 'Bretagne', '35', '', '', 'En cours', '']);
atest('source non connectée, clé absente puis clé incorrecte : états explicites, aucune donnée', async () => {
  const m = reqModule(R1, { key: '' });
  assert.strictEqual(m.api.getOperationRequirements('OP-0101').state, 'disconnected');
  await m.api.load('https://script.google.com/macros/s/EXI/exec'); assert.strictEqual(m.api.getOperationRequirements('OP-0101').state, 'unauthorized');
  m.setKey('mauvaise-cle-123456789'); await m.api.load('https://script.google.com/macros/s/EXI/exec');
  const st = m.api.status(); assert.strictEqual(st.connected, false); assert.strictEqual(st.errorKind, 'auth'); assert.strictEqual(st.hasKey, false, 'clé refusée retirée de la mémoire'); assert.strictEqual(st.count, 0);
});
atest('clé correcte : chargement ; aucune clé dans le stockage ni dans l’URL mémorisée', async () => {
  const m = reqModule(R1); await m.api.load('https://script.google.com/macros/s/EXI/exec?key=' + KEY);
  assert.strictEqual(m.api.status().connected, true); const stored = JSON.stringify(m.ctx.localStorage.getItem('newosb_requirements_source_v1')); assert(!stored.includes(KEY), stored); assert(!/key=/.test(stored));
});
atest('fiche : rapprochement par code opération uniquement, zéros significatifs conservés', async () => {
  const m = reqModule(R1); await m.connect();
  const a = m.api.getOperationRequirements('OP-0101'), b = m.api.getOperationRequirements('OP-101');
  assert.strictEqual(a.matched, true); assert.strictEqual(b.matched, true);
  assert(!b.evaluations.some(e => e.requirements.some(r => r.code === '1.2.2')), 'OP-101 ne reçoit pas les exigences de OP-0101');
  assert.strictEqual(m.api.getOperationRequirements(' op-0101 ').matched, true, 'variation de représentation acceptée');
  assert.strictEqual(m.api.getOperationRequirements(' op-0101 ').partial.length > 0, true, 'rapprochement après normalisation signalé');
  assert.strictEqual(m.api.getOperationRequirements('Promoteur A').matched, false, 'jamais par le nom du MOA');
  assert.strictEqual(m.api.getOperationRequirements('EVA-0').matched, false, 'jamais par le code d’évaluation');
  assert.strictEqual(m.api.getOperationRequirements('OP-9999').matched, false);
});
atest('fiche : doublons retirés, évaluations et référentiels séparés, sélection ≠ validation', async () => {
  const m = reqModule(R1); await m.connect(); const a = m.api.getOperationRequirements('OP-0101');
  assert.strictEqual(a.multiple, true); assert.strictEqual(a.evaluations.length, 2);
  const ln = a.evaluations.find(e => /Neuf/.test(e.referential)), lr = a.evaluations.find(e => /Rénovation/.test(e.referential));
  assert.strictEqual(ln.requirements.length, 20); assert.strictEqual(ln.duplicatesRemoved, 2); assert.strictEqual(lr.requirements.length, 2);
  assert.strictEqual(lr.requirements.find(r => r.code === '1.2.1').validated, 'Non');
  assert(Object.isFrozen(a) && Object.isFrozen(a.evaluations[0].requirements), 'instantané figé');
});
atest('fiche : indépendante des filtres temporaires de l’onglet Exigences', async () => {
  const m = reqModule(R1); await m.connect(); const before = JSON.stringify(m.api.getOperationRequirements('OP-0101'));
  m.check('moa', 'Promoteur B'); m.check('referential', 'BEE Logement Rénovation');
  m.api.handleClick({ target: m.el({ 'data-req-requirement': encodeURIComponent('2.4.6 - Exigence 2.4.6') }) });
  assert.strictEqual(JSON.stringify(m.api.getOperationRequirements('OP-0101')), before);
});
atest('encart : Top 20 par opérations distinctes, indépendant de la pagination et des listes visibles', async () => {
  const m = reqModule(R1); await m.connect(); const s = m.api._compatSnapshot();
  const ln = s.contexts.find(c => c.key === 'BEE_LN@2026-05-04'); assert.strictEqual(ln.operations, 5);
  assert.strictEqual(ln.top.length, 20); assert.strictEqual(ln.top.find(t => t.code === '1.1.1').operations, 4);
  m.api.handleClick({ target: m.el({ 'data-req-page': 'topGlobal', 'data-page': '3' }) }); assert.strictEqual(JSON.stringify(m.api._compatSnapshot().contexts), JSON.stringify(s.contexts));
});
atest('encart : multicoche MOA (OU) et croisement avec Référentiel (ET) ; recalcul après changement de MOA', async () => {
  const m = reqModule(R1); await m.connect();
  m.check('moa', 'Promoteur B'); let s = m.api._compatSnapshot(); assert.strictEqual(s.contexts.find(c => c.key === 'BEE_LN@2026-05-04').operations, 2);
  m.check('moa', 'Promoteur A'); s = m.api._compatSnapshot(); assert.strictEqual(s.contexts.find(c => c.key === 'BEE_LN@2026-05-04').operations, 5, 'OU entre MOA');
  m.check('referential', 'BEE Logement Rénovation'); s = m.api._compatSnapshot(); assert.strictEqual(JSON.stringify(s.contexts.map(c => c.key)), JSON.stringify(['BEE_LR@2025-06-18']), 'ET entre familles');
  m.check('moa', 'Promoteur A', false); m.check('moa', 'Promoteur B', false); m.check('referential', 'BEE Logement Rénovation', false);
  m.check('moa', 'Bailleur <b>C</b>'); s = m.api._compatSnapshot(); assert.strictEqual(JSON.stringify(s.contexts.map(c => [c.key, c.operations])), JSON.stringify([['BEE_LR@2025-06-18', 1]]));
});
atest('encart : focus local sur une exigence ou recherche sans effet sur le bouquet', async () => {
  const m = reqModule(R1); await m.connect(); const s = JSON.stringify(m.api._compatSnapshot().contexts);
  m.api.handleClick({ target: m.el({ 'data-req-requirement': encodeURIComponent('2.4.6 - Exigence 2.4.6') }) });
  m.api.handleInput({ target: m.el({ 'data-req-search': '' }, { value: '2.4.6' }) });
  m.api.handleClick({ target: m.el({ 'data-req-info': encodeURIComponent('2.4.6 - Exigence 2.4.6') }) });
  assert.strictEqual(JSON.stringify(m.api._compatSnapshot().contexts), s);
});
atest('encart : 3e carte manuelle conservée lors d’un recalcul, sans toucher aux filtres ni aux cartes 1-2 ; retour à l’automatique', async () => {
  const m = reqModule(R1); await m.connect();
  m.api.handleChange({ target: m.el({ 'data-req-compat-field': '' }, { dataset: { reqCompatField: 'ln2026.regime' }, value: 'RE2020' }) });
  m.api.handleChange({ target: m.el({ 'data-req-compat-field': '' }, { dataset: { reqCompatField: 'ln2026.buildingType' }, value: 'collectif' }) });
  m.api.handleChange({ target: m.el({ 'data-req-compat-field': '' }, { dataset: { reqCompatField: 'ln2026.permit' }, value: '2025_2027' }) });
  const auto = m.api._compatSnapshot(); assert.strictEqual(JSON.stringify(auto.ranked.slice(0, 3).map(r => r.id)), JSON.stringify(['BEE_LN_2026_BIODIVERSITE', 'BEE_LN_2026_BEE_PLUS', 'BEE_LN_2026_HABITAT_QUALITE']));
  m.api.handleChange({ target: m.el({ 'data-req-compat-mention': '' }, { value: 'BEE_LN_2026_HABITAT_SENIOR' }) });
  const html1 = m.api.render(); assert(html1.includes('Comparaison libre') && html1.includes('Habitat sénior et autonomie'));
  m.check('moa', 'Promoteur A'); const after = m.api._compatSnapshot(); assert.strictEqual(after.manual, 'BEE_LN_2026_HABITAT_SENIOR'); assert.strictEqual(JSON.stringify(after.ranked.slice(0, 2).map(r => r.id)), JSON.stringify(auto.ranked.slice(0, 2).map(r => r.id)));
  m.api.handleClick({ target: m.el({ 'data-req-compat-auto': '1' }) }); assert.strictEqual(m.api._compatSnapshot().manual, '');
});
atest('encart : mention d’un autre périmètre → incompatibilité affichée et proposition de changer de périmètre', async () => {
  const m = reqModule(R1); await m.connect();
  m.api.handleChange({ target: m.el({ 'data-req-compat-mention': '' }, { value: 'BEE_LR_2025_BEE_PLUS' }) });
  const html = m.api.render(); assert(html.includes('Contexte différent')); assert(html.includes('data-req-compat-context-go="BEE_LR@2025-06-18"'));
});
atest('encart : menu = toutes les mentions, regroupées par référentiel et version (optgroup)', async () => {
  const m = reqModule(R1); await m.connect(); const html = m.api.render(); const menu = html.slice(html.indexOf('data-req-compat-mention'));
  const opts = (menu.slice(0, menu.indexOf('</select>')).match(/<option value="BEE_/g) || []).length; assert.strictEqual(opts, CAT.mentions.length);
  assert(/<optgroup label="BEE Logement Neuf · 04\/05\/2026"/.test(html) && /<optgroup label="BEE Logement Rénovation · 18\/06\/2025"/.test(html));
});
atest('encart : moins de trois mentions calculables → résultats disponibles + état vide explicite ; légende et mention permanente', async () => {
  const m = reqModule(R1); await m.connect(); const html = m.api.render();
  assert(html.includes('Présente dans le bouquet comparé') && html.includes('Absente du bouquet comparé'));
  assert(html.includes('Compatibilité des sélections ; l’obtention d’une mention reste soumise à la validation des exigences, aux prérequis et aux seuils applicables.'));
  assert(!/jamais sélectionnée/i.test(html)); assert(/Aucun résultat calculable|Seulement \d+ mention|Aucune mention calculable/.test(html) || (html.match(/req-compat-score">/g) || []).length >= 3);
  assert(html.includes('Diagnostic : versions lues et exigences sans correspondance fiable') && html.includes('9.9.9'));
});
atest('encart : tableau de toutes les mentions de la famille avec leur pourcentage ; « Détail » ouvre la 3e carte', async () => {
  const m = reqModule(R1); await m.connect(); m.check('referential', 'BEE Logement Neuf');
  for (const [f, v] of [['ln2026.regime', 'RE2020'], ['ln2026.buildingType', 'collectif'], ['ln2026.permit', '2025_2027']]) m.api.handleChange({ target: m.el({ 'data-req-compat-field': '' }, { dataset: { reqCompatField: f }, value: v }) });
  const html = m.api.render(); const t = html.slice(html.indexOf('req-compat-all'), html.indexOf('</table>', html.indexOf('req-compat-all')));
  assert.strictEqual((t.match(/data-req-compat-see=/g) || []).length, CAT.mentions.filter(x => x.context === 'BEE_LN@2026-05-04').length);
  assert(/Biodiversité<\/b><\/td><td class="req-compat-pct">.*?<b>90 %<\/b>/.test(t));
  m.api.handleClick({ target: m.el({ 'data-req-compat-see': 'BEE_LN_2026_EFFINERGIE_RE2020' }) }); assert.strictEqual(m.api._compatSnapshot().manual, 'BEE_LN_2026_EFFINERGIE_RE2020');
});
atest('encart : taille du bouquet réglable (Top 20 / Top 40 / toutes les exigences filtrées)', async () => {
  const rows = R1.slice(); for (let i = 0; i < 30; i++) rows.push([`4.10.${(i % 8) + 1} - x`, 'EVA-T' + i, 'Promoteur T', 'OP-T' + i, 'BEE Logement Neuf', '04/05/2026', 'Bretagne', '35', `4.10.${(i % 8) + 1}`, '', 'En cours', '']);
  const m = reqModule(rows); await m.connect();
  const top = () => m.api._compatSnapshot().contexts.find(c => c.key === 'BEE_LN@2026-05-04').top.length;
  assert.strictEqual(top(), 20); m.api.handleChange({ target: m.el({ 'data-req-compat-size': '' }, { value: 'all' }) }); assert(top() > 20);
  m.api.handleChange({ target: m.el({ 'data-req-compat-size': '' }, { value: '20' }) }); assert.strictEqual(top(), 20);
});
atest('échappement HTML des contenus du Sheet (MOA, intitulés)', async () => {
  const rows = R1.slice(); rows.push(['<img src=x onerror=alert(1)> - piège', 'EVA-H', '<script>alert(1)</script>', 'OP-<i>X</i>', 'BEE Logement Neuf', '04/05/2026', 'Bretagne', '35', '1.1.1', '', 'En cours', '']);
  const m = reqModule(rows); await m.connect(); m.check('moa', '<script>alert(1)</script>');
  const html = m.api.render(); assert(!html.includes('<script>alert(1)</script>') && !html.includes('<img src=x'));
  const f = m.api.getOperationRequirements('OP-<i>X</i>'); assert.strictEqual(f.matched, true);
});
atest('mode anonymisé : fiche retrouvée par pseudonyme, codes d’évaluation masqués', async () => {
  const m = reqModule(R1, { privacyOn: true }); await m.connect(); const pseudo = m.ctx.NEWOSB_PRIVACY.operationCode('OP-0200');
  const f = m.api.getOperationRequirements(pseudo, { pseudonymized: true }); assert.strictEqual(f.matched, true); assert(f.evaluations.every(e => !e.evaluationCode || e.evaluationCode === 'EVA-999999'));
});
atest('déconnexion : clé et données privées retirées de la mémoire', async () => {
  const m = reqModule(R1); await m.connect(); m.api.disconnect(); const st = m.api.status(); assert.strictEqual(st.connected, false); assert.strictEqual(st.count, 0); assert.strictEqual(st.hasKey, false); assert.strictEqual(m.api.getOperationRequirements('OP-0101').state, 'disconnected');
});
atest('erreur au rechargement : l’ancien jeu de données n’est pas conservé comme s’il était à jour', async () => {
  const m = reqModule(R1); await m.connect(); assert.strictEqual(m.api.status().connected, true); m.gs.props.NEWOSB_ACCESS_KEY = 'cle-revoquee-0000000000000';
  await m.api.load('https://script.google.com/macros/s/EXI/exec'); assert.strictEqual(m.api.status().count, 0); assert.strictEqual(m.api.getOperationRequirements('OP-0101').state, 'unauthorized');
});
section('10. Client du pont sécurisé (newosb-bridge.js)');
function bridgeEnv() {
  const listeners = [], sent = [];
  const mkWin = (name, parent) => { const w = { name, posted: [], postMessage(msg, origin) { this.posted.push({ msg: JSON.parse(JSON.stringify(msg)), origin }); sent.push({ to: name, msg, origin }); }, frames: [] }; w.parent = parent || w; return w; };
  const host = mkWin('iframe-host'); const inner = mkWin('inner', host); host.frames = [inner];
  const ctx = { console, Promise, setTimeout, clearTimeout, setInterval: () => 1, clearInterval: () => {}, URL, Date, Math, JSON, Uint8Array, crypto: require('crypto').webcrypto };
  ctx.window = ctx; ctx.location = { href: 'https://site.test/obs/' };
  ctx.addEventListener = (t, f) => { if (t === 'message') listeners.push(f); }; ctx.removeEventListener = (t, f) => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); };
  ctx.document = { body: { appendChild() {} }, createElement: () => ({ setAttribute() {}, style: {}, remove() {}, contentWindow: host }) };
  vm.createContext(ctx); vm.runInContext(read('newosb-bridge.js'), ctx);
  const deliver = (data, origin, source) => listeners.slice().forEach(f => f({ data, origin, source }));
  return { B: ctx.NEWOSB_BRIDGE, host, inner, sent, deliver };
}
const GOOD = 'https://n-abc123-0lu-script.googleusercontent.com';
const tokenOf = env => env.sent.find(s => s.msg.type === 'NEWOSB_BRIDGE_HELLO').msg.token;
atest('URL : une ancienne clé « ?key= » est retirée de l’URL', async () => { const { B } = bridgeEnv(); const r = B.splitUrl('https://script.google.com/macros/s/X/exec?key=abc&mode=data'); assert.strictEqual(r.key, 'abc'); assert(!/key=|mode=/.test(r.url)); });
atest('sans clé en mémoire : refus immédiat, rien n’est envoyé', async () => { const env = bridgeEnv(); const c = env.B.create('t'); await assert.rejects(c.request('https://script.google.com/macros/s/X/exec', { mode: 'meta' }), e => e.authError === true); assert.strictEqual(env.sent.length, 0); });
atest('READY d’une origine non Google, d’une autre fenêtre ou avec un mauvais jeton : ignoré', async () => {
  const env = bridgeEnv(); const c = env.B.create('t'); c.setKey('k'.repeat(20)); const p = c.ensure('https://script.google.com/macros/s/X/exec', 300); const tok = tokenOf(env);
  const stranger = { parent: null }; stranger.parent = stranger;
  env.deliver({ type: 'NEWOSB_BRIDGE_READY', token: tok }, 'https://evil.example', env.inner);
  env.deliver({ type: 'NEWOSB_BRIDGE_READY', token: tok }, GOOD, stranger);
  env.deliver({ type: 'NEWOSB_BRIDGE_READY', token: 'autre' }, GOOD, env.inner);
  await assert.rejects(p, /ne répond pas/);
});
atest('requête : clé envoyée uniquement à l’origine exacte du pont (jamais « * »), réponse acceptée de cette seule fenêtre', async () => {
  const env = bridgeEnv(); const c = env.B.create('t'); c.setKey('cle-secrete-0123456789'); const ready = c.ensure('https://script.google.com/macros/s/X/exec', 1000); const tok = tokenOf(env);
  env.deliver({ type: 'NEWOSB_BRIDGE_READY', token: tok }, GOOD, env.inner); await ready;
  const req = c.request('https://script.google.com/macros/s/X/exec', { mode: 'ping' }, 1000);
  await new Promise(r => setTimeout(r, 0));
  const withKey = env.sent.filter(s => s.msg.params && s.msg.params.key); assert.strictEqual(withKey.length, 1); assert.strictEqual(withKey[0].origin, GOOD); assert.strictEqual(withKey[0].to, 'inner');
  assert(!env.sent.some(s => s.origin === '*' && JSON.stringify(s.msg).includes('cle-secrete')));
  const id = withKey[0].msg.id;
  env.deliver({ type: 'NEWOSB_BRIDGE_RESPONSE', id, token: tok, payload: { ok: true, faux: 1 } }, 'https://evil.example', env.inner);
  env.deliver({ type: 'NEWOSB_BRIDGE_RESPONSE', id, token: tok, payload: { ok: true, vrai: 1 } }, GOOD, env.inner);
  const res = await req; assert.strictEqual(res.vrai, 1);
});
atest('réponse « accès refusé » du script → AuthError ; déconnexion : clé effacée', async () => {
  const env = bridgeEnv(); const c = env.B.create('t'); c.setKey('cle-secrete-0123456789'); const ready = c.ensure('https://script.google.com/macros/s/X/exec', 1000); const tok = tokenOf(env);
  env.deliver({ type: 'NEWOSB_BRIDGE_READY', token: tok }, GOOD, env.inner); await ready;
  const req = c.request('https://script.google.com/macros/s/X/exec', { mode: 'meta' }, 1000); await new Promise(r => setTimeout(r, 0));
  const id = env.sent.find(s => s.msg.type === 'NEWOSB_BRIDGE_REQUEST').msg.id;
  env.deliver({ type: 'NEWOSB_BRIDGE_RESPONSE', id, token: tok, payload: { ok: false, authError: true, error: 'Clé invalide' } }, GOOD, env.inner);
  await assert.rejects(req, e => e.authError === true);
  c.destroy(); c.clearKey(); assert.strictEqual(c.hasKey(), false);
});
atest('pont refusé par le script (site non autorisé) : erreur explicite, pas de repli', async () => {
  const env = bridgeEnv(); const c = env.B.create('t'); c.setKey('x'.repeat(20)); const ready = c.ensure('https://script.google.com/macros/s/X/exec', 1000); const tok = tokenOf(env);
  env.deliver({ type: 'NEWOSB_BRIDGE_READY', token: tok, refused: true, error: 'Site non autorisé' }, GOOD, env.inner);
  await assert.rejects(ready, /non autorisé/);
});
test('app.js : plus aucun transport JSON/JSONP de secours pour la source privée', () => { const a = read('app.js'); assert(!a.includes('dataLoadAppsScriptJsonp') && !a.includes('dataAppsScriptLegacyRequest') && !a.includes("postMessage({type:'NEWOSB_BRIDGE_REQUEST'")); });
test('aucune clé écrite dans localStorage / sessionStorage par le code', () => { for (const f of ['app.js', 'requirements.js', 'newosb-bridge.js']) { const s = read(f); assert(!/sessionStorage\.setItem/.test(s), f); assert(!/localStorage\.setItem\([^)]*\bkey\b/i.test(s.replace(/STORAGE_KEY|_STORAGE_KEY|SECRET_KEY/g, '')), f); } });

atest('lien de partage : le jeton remplace la clé (jamais les deux), envoyé à la seule origine du pont', async () => {
  const env = bridgeEnv(); const c = env.B.create('t'); c.setKey('cle-secrete-0123456789'); c.setShare('J'.repeat(43)); assert.strictEqual(c.isShare(), true);
  const ready = c.ensure('https://script.google.com/macros/s/X/exec', 1000); const tok = tokenOf(env);
  env.deliver({ type: 'NEWOSB_BRIDGE_READY', token: tok }, GOOD, env.inner); await ready;
  c.request('https://script.google.com/macros/s/X/exec', { mode: 'meta' }, 1000).catch(() => {}); await new Promise(r => setTimeout(r, 0));
  const req = env.sent.find(s => s.msg.type === 'NEWOSB_BRIDGE_REQUEST'); assert.strictEqual(req.msg.params.share, 'J'.repeat(43)); assert(!('key' in req.msg.params)); assert.strictEqual(req.origin, GOOD);
  assert(!JSON.stringify(env.sent).includes('cle-secrete')); c.destroy();
});

section('11. Liens de partage côté navigateur (newosb-share.js, auth.js)');
function shareEnv(hash) {
  const classes = new Set(), store = {};
  const ctx = { console, URLSearchParams, Date, Math, JSON, setTimeout, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } } };
  ctx.window = ctx; ctx.location = { hash, origin: 'https://site.test', pathname: '/obs/index.html' };
  ctx.addEventListener = () => {}; ctx.dispatchEvent = () => true;
  ctx.document = { readyState: 'complete', documentElement: { classList: { add: c => classes.add(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } }, getElementById: () => null };
  ctx.sessionStorage = { setItem: (k, v) => { store[k] = v; }, getItem: k => store[k] ?? null }; ctx.localStorage = ctx.sessionStorage;
  vm.createContext(ctx); vm.runInContext(read('newosb-share.js'), ctx);
  return { S: ctx.NEWOSB_SHARE, classes, ctx, store };
}
const SRC = 'https://script.google.com/macros/s/AKfycbxABC_def-123/exec', TOK = 'aB3'.repeat(14) + 'x';
test('lien construit puis relu : jeton dans le fragment (#), source Apps Script conservée', () => {
  const { S } = shareEnv(''); const link = S.buildLink('https://site.test/obs/index.html#ancien', TOK, SRC);
  assert(link.startsWith('https://site.test/obs/index.html#partage=')); assert(!link.includes('?')); assert(!link.includes('#ancien'));
  const p = S.parseHash(link.slice(link.indexOf('#'))); assert.strictEqual(p.token, TOK); assert.strictEqual(p.src, SRC);
  assert.strictEqual(S.active, false);
});
test('page ouverte par un lien valide : mode partagé ; source non Google ou jeton mal formé : refus', () => {
  const ok = shareEnv(`#partage=${TOK}&src=${encodeURIComponent(SRC)}`); assert.strictEqual(ok.S.active, true); assert.strictEqual(ok.S.status, 'idle'); assert(ok.classes.has('newosb-share-mode'));
  for (const src of ['https://evil.example/macros/s/X/exec', 'https://script.google.com.evil.fr/macros/s/X/exec', 'https://script.google.com/macros/s/X/dev', 'javascript:alert(1)']) { const e = shareEnv(`#partage=${TOK}&src=${encodeURIComponent(src)}`); assert.strictEqual(e.S.status, 'invalid', src); assert.strictEqual(e.S.token, '', src); }
  assert.strictEqual(shareEnv(`#partage=court&src=${encodeURIComponent(SRC)}`).S.status, 'invalid');
  assert.strictEqual(shareEnv(`#partage=${TOK}&src=${encodeURIComponent('https://script.google.com/a/macros/prestaterre.fr/s/AKfy/exec')}`).S.status, 'idle');
});
test('résumé du périmètre : un lien anonymisé ne contient ni MOA, ni recherche, ni filtre analytique nominatif', () => {
  const { S } = shareEnv(''); const scope = { parts: [{ key: 'moa', label: 'Maître d’ouvrage', values: ['Action Logement', 'Bailleur B'] }, { key: 'referential', label: 'Référentiel', values: ['BEE Logement Neuf'] }], cross: [{ key: 'moa', label: 'MOA : Action Logement' }, { key: 'heatingVector', label: 'Chauffage : PAC' }], search: 'Jardins' };
  const anon = S.buildSummary(scope, true); assert(!/Action Logement|Bailleur|Jardins/.test(anon)); assert(/Référentiel : BEE Logement Neuf/.test(anon)); assert(/2 valeurs sélectionnées/.test(anon)); assert(/Chauffage : PAC/.test(anon));
  const clear = S.buildSummary(scope, false); assert(/Action Logement/.test(clear) && /Jardins/.test(clear));
});
test('onglets : seuls ceux accordés sont accessibles ; Exigences partageable, Présentation jamais', () => {
  const { S } = shareEnv(`#partage=${TOK}&src=${encodeURIComponent(SRC)}`); assert(S.SHAREABLE.includes('requirements') && !S.SHAREABLE.includes('presentation'));
  assert.strictEqual(S.allowedPage('overview'), false);
  Object.assign(S, { status: 'ready', info: { tabs: ['carbon', 'energy'], landing: 'energy' } }); assert.strictEqual(S.allowedPage('carbon'), true); assert.strictEqual(S.allowedPage('overview'), false); assert.strictEqual(S.landingPage(), 'energy');
  assert(/Périmètre figé/.test(S.lockedFiltersHtml(3)) && /3 opérations/.test(S.lockedFiltersHtml(3)));
  S.info.label = '<img src=x onerror=alert(1)>'; assert(!S.lockedFiltersHtml(1).includes('<img'));
});
test('écran du lien refusé : message d’expiration, pas de bouton de connexion', () => {
  const { S } = shareEnv(`#partage=${TOK}&src=${encodeURIComponent(SRC)}`); Object.assign(S, { status: 'denied', message: 'Ce lien de partage a expire.' });
  const h = S.gateHtml(); assert(/Accès impossible/.test(h) && /expire/.test(h)); assert(!/data-share-popup/.test(h));
  assert.strictEqual(S.frenchMessage('Ce lien de partage a ete revoque.'), 'Ce lien de partage a été révoqué.'); assert.strictEqual(S.frenchMessage('Ce lien de partage a expire.'), 'Ce lien de partage a expiré.');
});
test('auth.js : un lien de partage n’affiche pas le mot de passe et ne déverrouille pas l’Observatoire complet', () => {
  const store = {}, body = { classList: { add() {}, remove() {} }, style: { removeProperty() {} } };
  const ctx = { location: { hash: `#partage=${TOK}&src=x` }, sessionStorage: { setItem: (k, v) => { store[k] = v; }, getItem: k => store[k] ?? null }, requestAnimationFrame: () => {}, setTimeout: () => {}, window: { dispatchEvent() {} }, Event: class {}, crypto: {}, TextEncoder };
  ctx.document = { body, getElementById: () => null }; vm.createContext(ctx); vm.runInContext(read('auth.js'), ctx);
  assert.strictEqual(Object.keys(store).length, 0);
  const a = read('auth.js'); assert(a.includes('grantAccess(false)'));
});
test('le mode anonymisé imposé par un lien ne modifie pas le réglage du navigateur', () => {
  const store = {}; const ctx = { console, window: null, document: { readyState: 'loading', addEventListener() {}, documentElement: { classList: { toggle() {} } }, querySelectorAll: () => [] }, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }, addEventListener() {}, dispatchEvent() {}, CustomEvent: class {}, TextEncoder, crypto: require('crypto').webcrypto };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read('privacy.js'), ctx);
  assert.strictEqual(ctx.NEWOSB_PRIVACY.enabled(), false); ctx.NEWOSB_SHARE = { forcePrivacy: true }; assert.strictEqual(ctx.NEWOSB_PRIVACY.enabled(), true);
  ctx.NEWOSB_PRIVACY.setEnabled(false); assert.strictEqual(ctx.NEWOSB_PRIVACY.enabled(), true); assert.strictEqual(Object.keys(store).filter(k => /anonymized/.test(k)).length, 0);
});
test('un lien de partage ne reconnecte jamais la source mémorisée ; périmètre calculé sur les vrais codes', () => {
  const a = read('app.js'); assert(a.includes('if (!window.NEWOSB_SHARE?.active) { let src=null;')); assert(a.includes('function dataResolveRealCodes')); assert(a.includes("dataBridge.setShare(token)"));
  const idx = read('index.html'); const s = [...idx.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]); assert(s.indexOf('newosb-share.js') > s.indexOf('newosb-bridge.js') && s.indexOf('newosb-share.js') < s.indexOf('app.js'));
});


section('12. Mini-jeu de chargement « Capte le CO₂ » (newosb-game.js)');
function gameEnv() { const ctx = { console, Math, Date, setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem() {} } }; ctx.window = ctx; ctx.addEventListener = () => {}; ctx.document = {}; vm.createContext(ctx); vm.runInContext(read('newosb-game.js'), ctx); return ctx.NEWOSB_GAME; }
const GM = gameEnv();
const tick = (game, secs, dir) => { for (let t = 0; t < secs; t += 1 / 60) { if (dir) game.input(dir); game.step(1 / 60); } };
test('carte : rues toutes reliées, 14 îlots de bâtiments variés autour de la base', () => {
  const { W, H, walkable, bfs, SPAWN, BLOCKS, isBase, nearBase } = GM._map; const d = bfs(SPAWN);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (walkable(x, y)) assert(d[y * W + x] < Infinity, `${x},${y}`);
  assert.strictEqual(BLOCKS.length, 14); assert(nearBase(SPAWN.x, SPAWN.y));
  const g = GM._createGame({ rng: GM._rng(7) }); assert(new Set(g.state.buildings).size >= 8, 'au moins 8 types de bâtiments');
  assert(g.state.emitters.length === 3 && g.state.emitters.every(e => e.b >= 0 && e.b < 14), 'le CO₂ apparaît dans des bâtiments');
});
test('rien ne bouge avant la première touche ; une flèche lance la partie', () => {
  const g = GM._createGame({ rng: GM._rng(1) }); const e0 = JSON.stringify(g.state.enemies.map(e => [e.x, e.y]));
  tick(g, 3); assert.strictEqual(g.state.phase, 'ready'); assert.strictEqual(JSON.stringify(g.state.enemies.map(e => [e.x, e.y])), e0);
  g.input('left'); assert.strictEqual(g.state.phase, 'play'); tick(g, 0.5); assert(g.state.player.x < 11);
});
test('le personnage ne traverse ni les bâtiments ni la base', () => {
  const g = GM._createGame({ rng: GM._rng(2) }); g.state.enemies = []; tick(g, 1, 'down'); assert.strictEqual(g.state.player.y, 4, 'base au sud'); tick(g, 1, 'up'); assert.strictEqual(g.state.player.y, 4, 'bâtiment au nord');
  g.input('left'); tick(g, 0.1); tick(g, 3, 'up'); assert.strictEqual(g.state.player.x, 9); assert.strictEqual(g.state.player.y, 1, 'virage au premier couloir libre');
  const { walkable } = GM._map; for (let i = 0; i < 400; i++) { g.input(['up', 'down', 'left', 'right'][i % 4]); g.step(1 / 30); const p = g.state.player; assert(walkable(Math.round(p.x), Math.round(p.y))); }
});
test('CO₂ capté en longeant un bâtiment émetteur (3 max) ; dépôt en passant devant la base, même sans s’arrêter', () => {
  const { BLOCKS } = GM._map; const g = GM._createGame({ rng: GM._rng(3) }); const s = g.state; s.enemies = [];
  const east = BLOCKS.findIndex(b => b.x === 14 && b.y === 2); s.emitters = [{ b: east, amount: 2, born: 0 }, { b: BLOCKS.findIndex(b => b.x === 18 && b.y === 2), amount: 2, born: 0 }];
  g.input('right'); for (let t = 0; t < 1.8; t += 1 / 30) { g.input('right'); g.step(1 / 30); }
  assert.strictEqual(s.carried, 3, 'sac plein à 3'); assert.strictEqual(s.emitters.length, 1); assert.strictEqual(s.emitters[0].amount, 1, 'le reste reste dans le bâtiment');
  for (let t = 0; t < 2.2; t += 1 / 24) { g.input('left'); g.step(1 / 24); }
  assert.strictEqual(s.carried, 0, 'déposé en passant'); assert.strictEqual(s.growth, 3); assert.strictEqual(g.treeStage(), 1); assert.strictEqual(s.score, 30);
});
test('arbre adulte à 15 CO₂ : arbre planté, toit végétalisé, niveau suivant avec un engin de plus (2 au niveau 1)', () => {
  const g = GM._createGame({ rng: GM._rng(5) }); const s = g.state; assert.strictEqual(s.enemies.length, 2);
  assert.deepStrictEqual(s.enemies.map(e => e.type.kind).join(','), 'bulldozer,camion');
  g.input('right'); s.enemies = []; s.carried = 3; s.growth = 12; s.emitters = []; tick(g, 0.2, 'right');
  assert.strictEqual(s.trees, 1); assert.strictEqual(s.level, 2); assert.strictEqual(s.growth, 0); assert.strictEqual(s.enemies.length, 3); assert.strictEqual(s.greenRoofs.length, 1);
});
test('engins de chantier : foncent sur le personnage visible dans leur rue ; un choc coûte une vie et le CO₂ ; 3 chocs = fin', () => {
  const g = GM._createGame({ rng: GM._rng(4) }); const s = g.state; g.input('left'); s.player.speed = 0;
  const e = s.enemies[0]; Object.assign(e, { x: 1, y: 4, wait: 0, dir: { dx: 0, dy: 0 } }); s.enemies = [e];
  Object.assign(s.player, { x: 7, y: 4 }); g.step(1 / 60);
  assert(e.charging && e.dir.dx === 1, 'fonce vers la droite'); g.step(1 / 60); assert(e.speed > 2.5 * e.type.speed, 'accélère');
  for (let n = 0; n < 3 && s.phase !== 'over'; n++) { s.carried = 2; s.invuln = 0; Object.assign(e, { x: s.player.x, y: s.player.y, wait: 0 }); g.step(1 / 60); }
  assert.strictEqual(s.lives, 0); assert.strictEqual(s.phase, 'over'); assert.strictEqual(s.carried, 0);
});
test('intégration : jeu ouvert pendant les chargements OPERATIONS, Exigences et lien de partage ; jamais sans chargement', () => {
  const a = read('app.js'), r = read('requirements.js'), sh = read('newosb-share.js');
  assert(a.includes("window.NEWOSB_GAME?.open({title:'Chargement des opérations (OPERATIONS)'") && a.includes('window.NEWOSB_GAME?.done(') && a.includes('window.NEWOSB_GAME?.fail('));
  assert(r.includes("window.NEWOSB_GAME?.open({title:'Chargement des exigences (RAPPORT)'})") && r.includes('window.NEWOSB_GAME?.fail(state.error)'));
  assert(sh.includes('window.NEWOSB_GAME?.open(') && sh.includes('window.NEWOSB_GAME?.done(') && sh.includes('window.NEWOSB_GAME?.fail('));
  const g = read('newosb-game.js'); assert(!/fetch\(|XMLHttpRequest|NEWOSB_ENGINE|NEWOSB_BRIDGE/.test(g), 'le jeu ne lit aucune donnée');
});


section('13. Type de programme (nom du programme + référentiel) — V6.18');
const PT = (() => { const c = { console, Date, JSON, Math, String, Number, Array, Object, RegExp, Error }; vm.createContext(c); vm.runInContext(read('Code_Exigences.gs') + ';this.f=newosbExigencesProgramType_;this.i=newosbExigencesProgramTypeInput_;', c); return c; })();
const TN = 'BEE Tertiaire Neuf', TR = 'BEE Tertiaire Rénovation', LNF = 'BEE Logement Neuf';
const typeOf = (n, r) => PT.f(n, r).type;
test('tertiaire : synonymes et termes proches reconnus (noms réels de RAPPORT)', () => {
  const cases = [['Bureaux - Saint Charles', TR, 'Bureaux'], ['Siège 3 de l’entreprise Kuehne+Nagel', TN, 'Bureaux'], ['Commerce Decathlon', TN, 'Commerces'], ['Hôtel - SCI GUTTI3', TN, 'Hôtelier'],
    ['Groupe Scolaire Jules Ferry', TN, 'Scolaire et enseignement'], ['Micro Crèche - rue des Hêtres', TN, 'Scolaire et enseignement'], ['Rire et Croco - EAJE', TN, 'Scolaire et enseignement'], ['Campus Neoma Business School', TN, 'Scolaire et enseignement'], ['ALSH', TN, 'Scolaire et enseignement'],
    ['EHPAD Valdahon', TN, 'Santé et médico-social (cliniques, EHPAD, centres médicaux)'], ['Centre de Soins Médicaux et de Réadaptation', TN, 'Santé et médico-social (cliniques, EHPAD, centres médicaux)'], ['Suchet - CMS', TN, 'Santé et médico-social (cliniques, EHPAD, centres médicaux)'],
    ['Usine U3 site d’exploitation', TN, 'Locaux d’activité et industrie'], ['Maroquinerie de la Sormonne', TN, 'Locaux d’activité et industrie'], ['Logicor Coignières', TN, 'Logistique (entrepôts, plateformes de distribution)'], ['Entrepôt frigorifique', TN, 'Logistique (entrepôts, plateformes de distribution)'],
    ['Le Piscinatoire', TN, 'Équipements publics (culturels, sportifs, administratifs)'], ['Réhabilitation Bibliothèque Jean-Louis Barrault', TR, 'Équipements publics (culturels, sportifs, administratifs)'], ['POLE EMPLOI - BAT B', TN, 'Équipements publics (culturels, sportifs, administratifs)'], ['Hôtel de Ville', TN, 'Équipements publics (culturels, sportifs, administratifs)'],
    ['Résidence Senior - Partie Tertiaire', TN, 'Résidences gérées (étudiantes, seniors, tourisme)']];
  cases.forEach(([n, r, t]) => assert.strictEqual(typeOf(n, r), t, n));
});
test('le premier terme du nom l’emporte ; une adresse ne compte pas (« Rue de la Mairie - bureaux »)', () => {
  assert.strictEqual(typeOf('Bureaux - Extension de la clinique - Projet Grand-Bé', TN), 'Bureaux');
  assert.strictEqual(typeOf('Rue de la Mairie - bureaux', TR), 'Bureaux');
  assert.strictEqual(typeOf('Micro-crèche - rue des écoles', TR), 'Scolaire et enseignement');
  assert.strictEqual(typeOf('105 rue Réaumur', TR), 'Non déterminé');
  assert.strictEqual(typeOf('Le Sully Santenov - Partie Enseignement Supérieur', TN), 'Scolaire et enseignement', '« santenov » n’est pas « santé »');
});
test('référentiel logement : collectif par défaut, individuel ou résidence gérée si le nom le dit ; « Villa … » ne suffit pas', () => {
  assert.strictEqual(typeOf('Le 24 Clemenceau', LNF), "Logement collectif (immeubles d'appartements)");
  assert.strictEqual(typeOf('Villa Julia - 11coll parmi 33 - 1bat', LNF), "Logement collectif (immeubles d'appartements)");
  assert.strictEqual(typeOf('Lotissement la Marnelle', LNF), 'Logement individuel (maisons, lotissements)');
  assert.strictEqual(typeOf('Rue Condorcet - individuels', LNF), 'Logement individuel (maisons, lotissements)');
  assert.strictEqual(typeOf('Résidence Etudiante - rue de Trans', LNF), 'Résidences gérées (étudiantes, seniors, tourisme)');
  assert.strictEqual(typeOf('Foyer des Jeunes Travailleurs', LNF), 'Résidences gérées (étudiantes, seniors, tourisme)');
  assert.strictEqual(typeOf('Arques de Gaulle Commerce - 8 individuels', LNF), 'Logement individuel (maisons, lotissements)', 'pas de catégorie tertiaire sur un référentiel logement');
  assert.strictEqual(typeOf('Bureaux du centre', LNF), "Logement collectif (immeubles d'appartements)");
});
test('tertiaire sans terme reconnu : « Non déterminé » (aucune catégorie inventée) ; colonne « Type de programme » prioritaire', () => {
  assert.strictEqual(typeOf('Biome', TR), 'Non déterminé'); assert.strictEqual(PT.f('', TR).source, 'nom du programme absent');
  assert.strictEqual(PT.i('Logistique').type, 'Logistique (entrepôts, plateformes de distribution)'); assert.strictEqual(PT.i('Équipements publics').type, 'Équipements publics (culturels, sportifs, administratifs)'); assert.strictEqual(PT.i('n/a'), null); assert.strictEqual(PT.i(''), null);
});
test('le script transmet type et nom du programme ; lien anonymisé : type conservé, nom retiré', () => {
  const H2 = [...RH, 'Évaluation: Opération: Nom du programme (client)'];
  const M2 = [H2, ['1.1.1 - Ex', 'EVA-9', 'Bailleur Z', 'OP-1', TN, '04/05/2026', 'IDF', '75', '1.1.1', '', 'En cours', '', 'Crèche des Lilas']];
  const ex = loadGs('Code_Exigences.gs', { matrix: M2, sheetName: 'RAPPORT', properties: { NEWOSB_ACCESS_KEY: KEY } }).newosbExigencesBridgeRequest({ mode: 'chunk', key: KEY, offset: 0, limit: 10 }).rows[0];
  assert.strictEqual(ex.programName, 'Crèche des Lilas'); assert.strictEqual(ex.programType, 'Scolaire et enseignement'); assert(/creche/.test(ex.programTypeSource));
  const gs = loadGs('Code_Operations.gs', { matrix: MATRIX, properties: { NEWOSB_ACCESS_KEY: KEY }, extraSheets: { RAPPORT: M2 } });
  const tok = gs.newosbBridgeRequest({ mode: 'shareCreate', key: KEY, tabs: ['requirements'], codes: ['OP-1'], codeHeader: CODE_H, expiresAt: Date.now() + 86400000, anonymized: true, reqFilters: { programType: ['Scolaire et enseignement'] } }).token;
  const row = gs.newosbBridgeRequest({ mode: 'reqChunk', share: tok, offset: 0, limit: 10 }).rows[0];
  assert.strictEqual(row.programName, ''); assert.strictEqual(row.programType, 'Scolaire et enseignement'); assert(!JSON.stringify(row).includes('Lilas'));
  assert.strictEqual(JSON.stringify(gs.newosbBridgeRequest({ mode: 'ping', share: tok }).share.reqFilters), '{"programType":["Scolaire et enseignement"]}');
});

test('OPERATIONS : type de programme ajouté à chaque ligne (RAPPORT par code, puis par n° de contrat, sinon nom de l’opération)', () => {
  const H3 = [...RH, 'Évaluation: Opération: Nom du programme (client)', 'Évaluation: Opération: Numéro du contrat'];
  const M3 = [H3,
    ['1.1.1 - Ex', 'EVA-1', 'Promoteur A', 'OP-1', TN, '04/05/2026', 'IDF', '75', '1.1.1', '', 'En cours', '', 'Crèche des Lilas', ''],
    ['1.1.1 - Ex', 'EVA-3', 'Bailleur B', '', TN, '04/05/2026', 'IDF', '75', '1.1.1', '', 'En cours', '', 'Gymnase municipal', 'CT-OP-3']];
  const gs = loadGs('Code_Operations.gs', { matrix: MATRIX, properties: { NEWOSB_ACCESS_KEY: KEY }, extraSheets: { RAPPORT: M3 } });
  const m = gs.newosbBridgeRequest({ mode: 'meta', key: KEY }); assert.deepStrictEqual(m.headers.slice(-2).join('|'), 'Type de programme (calculé)|Type de programme : origine');
  const c = gs.newosbBridgeRequest({ mode: 'chunk', key: KEY, offset: 0, limit: 500, totalRows: m.totalRows, lastColumn: m.lastColumn, firstDataRow: m.firstDataRow });
  const by = Object.fromEntries(c.rows.filter(r => r[0]).map(r => [r[0], r.slice(-2)]));
  assert.strictEqual(by['OP-1'][0], 'Scolaire et enseignement'); assert(/code opération/.test(by['OP-1'][1]));
  assert.strictEqual(by['OP-3'][0], 'Équipements publics (culturels, sportifs, administratifs)'); assert(/contrat/.test(by['OP-3'][1]));
  assert.strictEqual(by['OP-2'][0], "Logement collectif (immeubles d'appartements)"); assert(/OPERATIONS/.test(by['OP-2'][1]));
  assert(c.rows.every(r => r.length === m.headers.length));
  const anon = loadGs('Code_Operations.gs', { matrix: MATRIX, properties: { NEWOSB_ACCESS_KEY: KEY, NEWOSB_ANONYMIZED_ONLY: '1' }, extraSheets: { RAPPORT: M3 } });
  const ca = anon.newosbBridgeRequest({ mode: 'chunk', key: KEY, offset: 0, limit: 500, totalRows: m.totalRows, lastColumn: m.lastColumn, firstDataRow: m.firstDataRow });
  assert(ca.rows.some(r => r[r.length - 2] === 'Scolaire et enseignement')); assert(!JSON.stringify(ca.rows).includes('Lilas'));
  const tok = gs.newosbBridgeRequest({ mode: 'shareCreate', key: KEY, tabs: ['overview'], codes: ['OP-1'], codeHeader: CODE_H, expiresAt: Date.now() + 86400000 }).token;
  const sm = gs.newosbBridgeRequest({ mode: 'meta', share: tok }); const sc = gs.newosbBridgeRequest({ mode: 'chunk', share: tok, offset: 0, limit: 10 });
  assert.strictEqual(sm.headers.slice(-2)[0], 'Type de programme (calculé)'); assert.strictEqual(sc.rows[0][sc.rows[0].length - 2], 'Scolaire et enseignement');
  const none = loadGs('Code_Operations.gs', { matrix: MATRIX, properties: { NEWOSB_ACCESS_KEY: KEY } }); const cn = none.newosbBridgeRequest({ mode: 'chunk', key: KEY, offset: 0, limit: 500, totalRows: m.totalRows, lastColumn: m.lastColumn, firstDataRow: m.firstDataRow });
  assert(cn.rows.every(r => r[r.length - 2]), 'sans RAPPORT : type déduit des seules données OPERATIONS');
});
test('Observatoire : filtre global « Type de programme » (menus issus d’OPERATIONS) et fiche projet', () => {
  const n = read('newosb.js'), a = read('app.js');
  assert(n.includes("['programType','Type de programme',v=>v]") && n.includes("globalFilterMatch('programType',o.programType||PROGRAM_TYPE_MISSING)") && n.includes("projectUxDatum('Type de programme',project.programType)"));
  assert(a.includes("programType:['type de programme (calculé)','type de programme (calcule)']"));
});
atest('onglet Exigences : filtre « Type de programme » (ordre de la liste, cumul avec les autres filtres)', async () => {
  const m = reqModule(R1); await m.connect(); const all = m.api.auditInfo().filteredRows;
  m.check('programType', "Logement collectif (immeubles d'appartements)"); assert.strictEqual(m.api.auditInfo().filteredRows, all - 0);
  m.check('programType', "Logement collectif (immeubles d'appartements)", false); m.check('programType', 'Bureaux'); assert.strictEqual(m.api.auditInfo().filteredRows, 0);
  assert(read('requirements.js').includes("${checkFilter('programType','Type de programme',o.programType)}"));
});

section('7. Cohérence du paquet');
const index = read('index.html'), gen = read('generator.html');
const scripts = h => [...h.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
test('newosb-bridge.js chargé avant app.js ; moteur et catalogue des mentions avant requirements.js', () => { for (const h of [index, gen]) { const s = scripts(h); assert(s.indexOf('newosb-bridge.js') >= 0 && s.indexOf('newosb-bridge.js') < s.indexOf('app.js')); } const s = scripts(index); assert(s.indexOf('mentions_catalog.js') < s.indexOf('requirements.js') && s.indexOf('newosb-mentions.js') < s.indexOf('requirements.js')); });
test('newosb-rules.js chargé avant app.js et newosb-core.js', () => { for (const h of [index, gen]) { const s = scripts(h); assert(s.indexOf('newosb-rules.js') >= 0 && s.indexOf('newosb-rules.js') < s.indexOf('app.js')); } const s = scripts(index); assert(s.indexOf('newosb-rules.js') < s.indexOf('newosb-core.js')); });
test('l’Observatoire et le générateur chargent la même version d’app.js', () => { const v = h => (h.match(/app\.js\?v=([^"]+)/) || [])[1]; assert.strictEqual(v(index), v(gen)); });
test('tous les fichiers référencés existent', () => { for (const h of [index, gen]) for (const f of [...scripts(h), ...[...h.matchAll(/href="([^"?#:]+\.(?:css|png))/g)].map(m => m[1])]) assert(fs.existsSync(path.join(ROOT, f)), f); });
test('un seul script Apps Script OPERATIONS à la racine (pas de doGet en double)', () => assert(!fs.existsSync(path.join(ROOT, 'Code.gs'))));
test('plus de copie périmée du script dans app.js', () => assert(!/NEWOSB V05\.22\\n \* Source OPERATIONS/.test(read('app.js'))));
test('syntaxe JavaScript valide', () => { for (const f of ['app.js', 'newosb.js', 'newosb-core.js', 'newosb-rules.js', 'privacy.js', 'requirements.js', 'auth.js', 'newosb-bridge.js', 'newosb-share.js', 'newosb-game.js', 'newosb-mentions.js', 'mentions_catalog.js']) new vm.Script(read(f), { filename: f }); for (const f of ['Code_Operations.gs', 'Code_Exigences.gs']) new vm.Script(read(f), { filename: f }); });
test('l’avancement n’est plus déduit de « État du dossier » ni du statut commercial', () => { const a = read('app.js'); assert(!a.includes('dataRawValue(r,fields.status)||dataRawValue(r,fields.dossierState)||affairStage')); });

(async () => {
  for (const [name, fn] of asyncTests) {
    if (name === '__section__') { console.log('\n' + fn); continue; }
    try { await fn(); passed++; console.log('  ok  ' + name); } catch (e) { failed++; console.log('  ÉCHEC ' + name + '\n       ' + (e && e.message)); }
  }
  console.log(`\n${passed} tests réussis, ${failed} en échec.`);
  process.exit(failed ? 1 : 0);
})();
