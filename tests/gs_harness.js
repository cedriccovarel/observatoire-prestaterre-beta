'use strict';
// Exécute Code_Operations.gs dans Node avec des doublures des services Google,
// sur une feuille OPERATIONS fictive (ligne 1 titre, ligne 2 en-têtes, données dès la ligne 4).
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');

function loadGs(file, { matrix, properties = {} }) {
  const props = { ...properties };
  const sheet = {
    getLastRow: () => matrix.length,
    getLastColumn: () => Math.max(...matrix.map(r => r.length)),
    getRange: (r, c, nr = 1, nc = 1) => ({
      getDisplayValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => String((matrix[r - 1 + i] || [])[c - 1 + j] ?? ''))),
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (matrix[r - 1 + i] || [])[c - 1 + j] ?? ''))
    })
  };
  const ss = { getId: () => 'TEST', getName: () => 'Test', getSheetByName: n => (n === 'OPERATIONS' ? sheet : null) };
  const ctx = {
    console, Date, JSON, Math, String, Number, Array, Object, RegExp, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    SpreadsheetApp: { openById: () => ss, getActiveSpreadsheet: () => ss },
    ContentService: { MimeType: { JSON: 'json', JAVASCRIPT: 'js' }, createTextOutput: t => ({ text: t, setMimeType(m) { this.mime = m; return this; } }) },
    HtmlService: { XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }, createHtmlOutput: h => ({ html: h, setTitle() { return this; }, setXFrameOptionsMode() { return this; } }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      computeHmacSha256Signature: (v, k) => Array.from(crypto.createHmac('sha256', k).update(v).digest()).map(b => (b > 127 ? b - 256 : b)),
      formatDate: d => String(d), base64Decode: s => Buffer.from(s, 'base64'), newBlob: () => ({})
    },
    Logger: { log: () => {} }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8') + '\n;this.__exports={doGet,newosbApiRequest_,newosbBridgeRequest,buildBridgeHtml_,newosbScrubMatrix_,newosbColumnRule_,newosbAllowedOrigins_,configurerSecuriteObservatoire};', ctx);
  return { ...ctx.__exports, props };
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
  ['OP-10', 'Le Bourg', 'Gagnée', 'Analyse réalisée', 'Promoteur D', 'Promoteur', '24', '24000', 'BEE Logement Neuf', '9', '47', '', '', '']
];
// Colonnes de dates (V6.13.1) : deux colonnes « leurres » vérifient qu'aucune autre date n'est utilisée.
const DATE_HEADERS = ['Certification: Date de décision CD', 'Date de décision de certification', 'Affaire: Date de création', 'Date de création'];
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
ROWS.forEach(r => { while (r.length < BASE_LEN) r.push(''); r.push(...DATES[r[0]]); });
HEADERS.push(...DATE_HEADERS);
const MATRIX = [['OBSERVATOIRE'], HEADERS, [], ...ROWS];
const asObjects = (headers, rows) => rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));

module.exports = { loadGs, HEADERS, ROWS, MATRIX, asObjects };
