'use strict';
// Exécute Code_Operations.gs dans Node avec des doublures des services Google,
// sur une feuille OPERATIONS fictive (ligne 1 titre, ligne 2 en-têtes, données dès la ligne 4).
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');

function loadGs(file, { matrix, properties = {}, sheetName = 'OPERATIONS', cache = true, extraSheets = {} }) {
  const props = { ...properties };
  const cacheStore = {};
  // Feuille en mémoire, lecture et écriture (l'onglet OPERATIONS et l'onglet masqué des liens de partage).
  const makeSheet = data => {
    const sh = {
      data, hidden: false, protected: false,
      getLastRow: () => data.length,
      getLastColumn: () => Math.max(0, ...data.map(r => r.length)),
      getRange: (r, c, nr = 1, nc = 1) => {
        const range = {
          getDisplayValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => String((data[r - 1 + i] || [])[c - 1 + j] ?? ''))),
          getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (data[r - 1 + i] || [])[c - 1 + j] ?? '')),
          setValues: vals => { vals.forEach((row, i) => { while (data.length < r + i) data.push([]); row.forEach((v, j) => { data[r - 1 + i][c - 1 + j] = v; }); }); return range; },
          setValue: v => range.setValues([[v]]),
          setNumberFormat: () => range
        };
        return range;
      },
      hideSheet() { sh.hidden = true; return sh; },
      protect() { sh.protected = true; return { setDescription() { return this; }, setWarningOnly() { return this; } }; }
    };
    return sh;
  };
  const sheets = { [sheetName]: makeSheet(matrix) };
  Object.entries(extraSheets).forEach(([n, m]) => { sheets[n] = makeSheet(m); });
  const ss = { getId: () => 'TEST', getName: () => 'Test', getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = makeSheet([])), getSpreadsheetTimeZone: () => 'Europe/Paris' };
  const ctx = {
    console, Date, JSON, Math, String, Number, Array, Object, RegExp, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    SpreadsheetApp: { openById: () => ss, getActiveSpreadsheet: () => ss },
    ContentService: { MimeType: { JSON: 'json', JAVASCRIPT: 'js' }, createTextOutput: t => ({ text: t, setMimeType(m) { this.mime = m; return this; } }) },
    HtmlService: { XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }, createHtmlOutput: h => ({ html: h, setTitle() { return this; }, setXFrameOptionsMode() { return this; } }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      computeHmacSha256Signature: (v, k) => Array.from(crypto.createHmac('sha256', k).update(v).digest()).map(b => (b > 127 ? b - 256 : b)),
      formatDate: d => String(d), base64Decode: s => Buffer.from(s, 'base64'), newBlob: (bytes, type, name) => ({ bytes: bytes && bytes.length, type, name }),
      DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (a, v) => Array.from(crypto.createHash('sha256').update(String(v)).digest()).map(b => (b > 127 ? b - 256 : b))
    },
    Logger: { log: (...a) => { logs.push(a.join(' ')); } },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    Session: { getScriptTimeZone: () => 'Europe/Paris' }
  };
  const logs = [];
  // Doublure minimale de SlidesApp : enregistre les images insérées (rendu fidèle des slides).
  const slidesLog = { presentations: [] };
  const mkSlide = () => ({ images: [], getPageElements: () => [], insertImage(blob) { this.images.push(blob); return {}; }, insertShape: () => ({ getFill: () => ({ setSolidFill() {} }), getBorder: () => ({ setTransparent() {} }) }), insertTextBox: () => ({ getText: () => ({ getTextStyle: () => ({ setFontSize() { return this; }, setBold() { return this; }, setForegroundColor() { return this; }, setFontFamily() { return this; } }), getParagraphStyle: () => ({ setParagraphAlignment() {} }) }), setContentAlignment() {} }) });
  ctx.SlidesApp = { ShapeType: { RECTANGLE: 'R', ROUND_RECTANGLE: 'RR' }, PredefinedLayout: { BLANK: 'B' }, ParagraphAlignment: {}, ContentAlignment: {},
    create(title) { const slides = [mkSlide()]; const pres = { title, slides, getSlides: () => slides, appendSlide() { const sl = mkSlide(); slides.push(sl); return sl; }, getId: () => 'PRES' + slidesLog.presentations.length, getUrl: () => 'https://docs.google.com/presentation/d/PRES' + slidesLog.presentations.length + '/edit' }; slidesLog.presentations.push(pres); return pres; } };
  if (cache) ctx.CacheService = { getScriptCache: () => ({ get: k => (k in cacheStore ? cacheStore[k] : null), put: (k, v) => { cacheStore[k] = String(v); } }) };
  vm.createContext(ctx);
  const names = ['doGet', 'newosbApiRequest_', 'newosbBridgeRequest', 'buildBridgeHtml_', 'newosbScrubMatrix_', 'newosbColumnRule_', 'newosbAllowedOrigins_', 'configurerSecuriteObservatoire', 'genererCleAccesObservatoire',
    'newosbExigencesBridgeRequest', 'newosbExigencesBridgeHtml_', 'configurerSecuriteExigences', 'genererCleAccesExigences', 'verifierPartageExigences'];
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8') + '\n;this.__exports={' + names.map(n => `${n}:typeof ${n}==='function'?${n}:undefined`).join(',') + '};', ctx);
  return { ...ctx.__exports, props, logs, slidesLog, sheets };
}

// Jeu de données de référence partagé par les tests.
const HEADERS = ['Opération: Code interne', "Nom de l'opération", 'Statut', 'Opération: Évaluation: Statut',
  'Nom de la société: Nom de la société', "Nom de la société: Secteur d'activité", "Département de l'opération", 'Code postal',
  'Référentiel', 'Total logements', 'Bbio', 'R toiture', 'Épaisseur isolant toiture', 'Montant HT affaire', 'Cep projet', 'Cep max'];
const ROWS = [
  ['OP-1', 'Les Jardins', 'Gagnée', 'Non démarrée', 'Promoteur A', 'Promoteur', '33', '33400', 'BEE Logement Neuf', '20', '45', 'R=1,5 m2.K/W', '2x100 mm', '12000', '60', '100'],
  ['OP-2', 'Le Parc', 'Gagnée', 'Dossier incomplet', 'Promoteur A', 'Promoteur', '33', '33000', 'BEE Logement Neuf', '30', 'n.c.', '4,5', '120 + 100 mm', '15000', '70', '100'],
  ['OP-3', 'La Rive', 'Gagnée', 'Dossier complet', 'Bailleur B', 'Bailleur social', '64', '64100', 'BEE Logement Neuf', '12', '55', 'U=0,25 W/m².K', '0,14 m', '', '80', '100'],
  ['OP-4', 'Les Vignes', 'Gagnée', 'Analyse planifiée', 'Bailleur B', 'Bailleur social', '40', '40000', 'BEE Logement Rénovation', '40', '12,3 / 15', '6', '160', ''],
  ['OP-5', 'Le Port', 'Gagnée', 'Analyse réalisée', 'Promoteur C', 'Promoteur', '17', '17000', 'BEE Logement Neuf', '8', '60', '7', '200 mm', ''],
  ['OP-6', 'La Dune', 'Gagnée', 'Visite réalisée', 'Promoteur C', 'Promoteur', '17', '17000', 'BEE Logement Neuf', '10', '50', '5', '180', ''],
  ['OP-7', 'Le Phare', 'Soldée', 'Évaluation conforme', 'Promoteur A', 'Promoteur', '33', '33400', 'BEE Logement Neuf', '25', '40', '8', '220', ''],
  ['OP-8', 'Le Moulin', 'Perdue', 'Non démarrée', 'Promoteur D', 'Promoteur', '24', '24000', 'BEE Logement Neuf', '5', '', '', '', ''],
  ['OP-9', 'La Source', 'Gagnée', '', 'Promoteur D', 'Promoteur', '24', '24000', 'BEE Logement Neuf', '6', '48', '', '', ''],
  ['OP-2', 'Le Parc', 'Gagnée', '1 - Non démarrée', 'Promoteur A', 'Promoteur', '33', '33000', 'BEE Logement Neuf', '30', '52', '5', '140', '', '', ''],
  ['', 'Proposition Nord', 'En cours', '', 'Promoteur E', 'Promoteur', '59', '59000', 'BEE Logement Neuf', '15', '', '', '', ''],
  ['', 'Proposition Nord', 'En cours', '', 'Promoteur F', 'Promoteur', '59', '59100', 'BEE Logement Neuf', '22', '', '', '', ''],
  ['', 'Proposition Sud', 'Annulé', '', 'Promoteur G', 'Promoteur', '13', '13000', 'BEE Logement Neuf', '9', '', '', '', ''],
  ['OP-10', 'Le Bourg', 'Gagnée', 'Analyse réalisée', 'Promoteur D', 'Promoteur', '24', '24000', 'BEE Logement Neuf', '9', '47', '', '', '']
];
// Colonnes de dates (V6.13.1) : deux colonnes « leurres » vérifient qu'aucune autre date n'est utilisée.
const DATE_HEADERS = ['Certification: Date de décision CD', 'Date de décision de certification', 'Affaire: Date de création', 'Date de création', 'Numéro du contrat'];
const DATES = {
  'OP-1': ['01/01/2019', '', '01/01/2015', '12/02/2023'],
  'OP-2': ['01/01/2019', '', '01/01/2015', '2023-06-30'],
  'OP-3': ['01/01/2019', '', '01/01/2015', '45366'],
  'OP-4': ['01/01/2019', '', '01/01/2015', '15 mars 2024'],
  'OP-5': ['01/01/2019', '', '01/01/2015', '03/04/2024'],
  'OP-6': ['01/01/2019', '', '01/01/2015', '03/04/24'],
  'OP-7': ['01/01/2019', '15/03/24', '01/01/2015', '10/01/2022'],
  'OP-8': ['01/01/2019', '', '01/01/2015', '10/01/2022'],
  'OP-9': ['01/01/2019', '2025-02-01', '01/01/2015', 'bientôt'],
  'OP-10': ['01/01/2019', '20/12/2024', '01/01/2015', '01/09/2023']
};
// L'avancement est placé en colonne BC, comme dans la Google Sheet réelle :
// on insère des colonnes libres entre « Statut » (C) et « Opération: Évaluation: Statut ».
const FILLERS = Array.from({ length: 51 }, (_, i) => `Colonne libre ${i + 1}`);
HEADERS.splice(3, 0, ...FILLERS);
ROWS.forEach(r => r.splice(3, 0, ...FILLERS.map(() => '')));
const BASE_LEN = HEADERS.length;
const NOCODE = { 'Promoteur E': ['', '', '', '05/05/2026', 'CT-901'], 'Promoteur F': ['', '', '', '06/05/2026', 'CT-902'], 'Promoteur G': ['', '', '', '07/05/2026', 'CT-903'] };
ROWS.forEach(r => { while (r.length < BASE_LEN) r.push(''); r.push(...(r[0] ? [...DATES[r[0]], 'CT-' + r[0]] : NOCODE[r[55]])); });
HEADERS.push(...DATE_HEADERS);
// Mentions et performances (V6.13.5) : assez de valeurs distinctes pour que les listes à cocher défilent.
const MENTION_NAMES = ['BEE+', 'BEE+ Niveau RT2012 -10%', 'BEE+ Niveau RT2012 -20%', 'BEE+ option TFPB', 'BBCA Standard', 'BBCA Excellence', 'BPEC Niveau 1', 'BPEC Niveau 2', 'Biosourcé niveau 1', 'Biosourcé niveau 2', 'Biosourcé niveau 3', 'Énergie positive', 'Bas carbone', 'Réemploi matériaux', 'Confort d’été', 'Qualité de l’air'];
const PERF_NAMES = ['Cep -5%', 'Cep -10%', 'Cep -15%', 'Cep -20%', 'Bbio -10%', 'Bbio -20%', 'Bbio -30%', 'IC Construction 2025', 'IC Construction 2028', 'IC Énergie 2025', 'DH max réduit', 'Ubat -10%', 'Ubat -20%', 'Étanchéité renforcée', 'Ventilation double flux', 'Production ENR'];
HEADERS.push('Opération: Mentions', 'Opération: Performance', 'État du dossier');
ROWS.forEach((r, i) => {
  // « État du dossier » : renseigné uniquement pour les lignes historiques sans code interne (comme dans l'export réel).
  const AV = { 'Promoteur E': 'Évaluation conforme', 'Promoteur G': 'Visite réalisée' };
  r.push([0, 1, 2].map(k => MENTION_NAMES[(i * 3 + k) % MENTION_NAMES.length]).join(' ; '), [0, 1, 2].map(k => PERF_NAMES[(i * 3 + k + 1) % PERF_NAMES.length]).join(' ; '), r[0] ? '' : (AV[r[4 + 51]] || ''));
});
const MATRIX = [['OBSERVATOIRE'], HEADERS, [], ...ROWS];
const asObjects = (headers, rows) => rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));

// Onglet RAPPORT fictif (source Exigences) : ligne 1 en-têtes, données dès la ligne 2.
// Ordre des colonnes volontairement mélangé : il ne doit pas avoir d'importance.
const RAPPORT_HEADERS = ['Exigence associée: Nom', 'Évaluation: Code interne', "Évaluation: Opération: Maître d'ouvrage: Nom de la société", 'Évaluation: Opération: Code interne',
  'Évaluation: Opération: Référentiel: Nom du référentiel', 'Évaluation: Opération: Version du référentiel applicable: Version', 'Évaluation: Opération: Région', 'Évaluation: Opération: Département',
  "Code d'exigence", 'Exigence validée', 'Évaluation: Statut', 'Évaluation: Opération: Mentions'];
const LN = ['BEE Logement Neuf', '04/05/2026'], LR = ['BEE Logement Rénovation', '18/06/2025'];
const RAPPORT_ROWS = [];
const addR = (op, ev, moa, [ref, ver], codes, extra = {}) => codes.forEach(c => RAPPORT_ROWS.push([`${c} - Exigence ${c}`, ev, moa, op, ref, ver, extra.region || 'Nouvelle-Aquitaine', extra.dep || '33', c, extra.validated || '', extra.status || 'En cours', extra.mentions || '']));
module.exports = { loadGs, HEADERS, ROWS, MATRIX, asObjects, RAPPORT_HEADERS, RAPPORT_ROWS, addR, LN, LR };
