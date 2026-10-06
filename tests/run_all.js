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
test('versions : contexte = famille + date ; versions différentes jamais fusionnées', () => {
  assert.strictEqual(MEN.rowContext({ referential: 'BEE Logement Neuf', referentialVersion: 'Version du 04/05/2026' }).key, LN_CTX);
  assert.notStrictEqual(MEN.rowContext({ referential: 'BEE Logement Neuf', referentialVersion: '01/02/2023' }).key, LN_CTX);
  assert.strictEqual(MEN.rowContext({ referential: 'BEE Logement Rénovation', referentialVersion: '18-06-2025' }).key, LR_CTX);
});
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
test('version non couverte (LR 04/05/2026) : aucune mention calculée, aucune transposition des règles 2025', () => { const a = evalIn('BEE_LR@2026-05-04', ['1.2.1', '1.2.2']); assert.strictEqual(a.results.length, 0); assert.strictEqual(a.source.status, 'source_missing'); assert.strictEqual(MEN.mentionsForContext(CAT, 'BEE_LR@2026-05-04').length, 0); });
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
  assert(html.includes('Diagnostic : exigences sans correspondance fiable') && html.includes('9.9.9'));
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

section('7. Cohérence du paquet');
const index = read('index.html'), gen = read('generator.html');
const scripts = h => [...h.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
test('newosb-bridge.js chargé avant app.js ; moteur et catalogue des mentions avant requirements.js', () => { for (const h of [index, gen]) { const s = scripts(h); assert(s.indexOf('newosb-bridge.js') >= 0 && s.indexOf('newosb-bridge.js') < s.indexOf('app.js')); } const s = scripts(index); assert(s.indexOf('mentions_catalog.js') < s.indexOf('requirements.js') && s.indexOf('newosb-mentions.js') < s.indexOf('requirements.js')); });
test('newosb-rules.js chargé avant app.js et newosb-core.js', () => { for (const h of [index, gen]) { const s = scripts(h); assert(s.indexOf('newosb-rules.js') >= 0 && s.indexOf('newosb-rules.js') < s.indexOf('app.js')); } const s = scripts(index); assert(s.indexOf('newosb-rules.js') < s.indexOf('newosb-core.js')); });
test('l’Observatoire et le générateur chargent la même version d’app.js', () => { const v = h => (h.match(/app\.js\?v=([^"]+)/) || [])[1]; assert.strictEqual(v(index), v(gen)); });
test('tous les fichiers référencés existent', () => { for (const h of [index, gen]) for (const f of [...scripts(h), ...[...h.matchAll(/href="([^"?#:]+\.(?:css|png))/g)].map(m => m[1])]) assert(fs.existsSync(path.join(ROOT, f)), f); });
test('un seul script Apps Script OPERATIONS à la racine (pas de doGet en double)', () => assert(!fs.existsSync(path.join(ROOT, 'Code.gs'))));
test('plus de copie périmée du script dans app.js', () => assert(!/NEWOSB V05\.22\\n \* Source OPERATIONS/.test(read('app.js'))));
test('syntaxe JavaScript valide', () => { for (const f of ['app.js', 'newosb.js', 'newosb-core.js', 'newosb-rules.js', 'privacy.js', 'requirements.js', 'auth.js', 'newosb-bridge.js', 'newosb-mentions.js', 'mentions_catalog.js']) new vm.Script(read(f), { filename: f }); for (const f of ['Code_Operations.gs', 'Code_Exigences.gs']) new vm.Script(read(f), { filename: f }); });
test('l’avancement n’est plus déduit de « État du dossier » ni du statut commercial', () => { const a = read('app.js'); assert(!a.includes('dataRawValue(r,fields.status)||dataRawValue(r,fields.dossierState)||affairStage')); });

(async () => {
  for (const [name, fn] of asyncTests) {
    if (name === '__section__') { console.log('\n' + fn); continue; }
    try { await fn(); passed++; console.log('  ok  ' + name); } catch (e) { failed++; console.log('  ÉCHEC ' + name + '\n       ' + (e && e.message)); }
  }
  console.log(`\n${passed} tests réussis, ${failed} en échec.`);
  process.exit(failed ? 1 : 0);
})();
