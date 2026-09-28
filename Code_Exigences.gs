/**
 * NEWOSB V05.4 — SOURCE EXIGENCES
 *
 * Ce script est à coller dans Extensions > Apps Script du Google Sheet
 * contenant l'onglet RAPPORT.
 *
 * Principes V05.2 :
 * - l'ordre des colonnes n'a aucune importance ;
 * - les colonnes sont reconnues par leur intitulé et par des alias ;
 * - aucune colonne optionnelle ne bloque l'export ;
 * - le script choisit automatiquement la meilleure colonne disponible ;
 * - l'API renvoie les colonnes reconnues dans `mapping` pour faciliter le diagnostic.
 *
 * Structure attendue :
 * - onglet : RAPPORT
 * - ligne 1 : en-têtes
 * - ligne 2 et suivantes : données
 *
 * Déploiement : Application Web > Exécuter en tant que vous >
 * accès selon le même principe que la source OPERATIONS de NEWOSB.
 * Collez ensuite l'URL /exec dans l'onglet Exigences de NEWOSB.
 */

const NEWOSB_EXIGENCES_CONFIG = {
  SHEET_NAME: 'RAPPORT',
  HEADER_ROW: 1,
  FIRST_DATA_ROW: 2
};

/**
 * Tous les intitulés connus de RAPPORT.
 * Ajouter un alias ici suffit pour rendre une nouvelle variante compatible.
 */
const NEWOSB_EXIGENCES_ALIASES = {
  rowCode: [
    'Code interne'
  ],
  requirementCode: [
    "Code d'exigence",
    'Numéro d\'exigence',
    'Numéro d’exigence',
    'Exigence de référence'
  ],
  rubricCode: [
    'Code de rubrique',
    'Rubrique: Code interne'
  ],
  createdBy: [
    'Créé par: Nom complet'
  ],
  createdAt: [
    'Date de création'
  ],
  lastActivityAt: [
    'Date de dernière activité'
  ],
  modifiedAt: [
    'Date de dernière modification'
  ],
  modifiedBy: [
    'Dernière modification par: Nom complet'
  ],
  description: [
    'Description'
  ],
  evaluationCode: [
    'Évaluation: Code interne',
    'Evaluation: Code interne',
    'Code EVA interne',
    'Rubrique: Évaluation: Code interne',
    'Rubrique: Evaluation: Code interne'
  ],
  associatedRequirementName: [
    'Exigence associée: Nom',
    'Exigence associee: Nom'
  ],
  requirementReference: [
    'Exigence de référence',
    'Exigence de reference',
    "Code d'exigence",
    'Numéro d\'exigence',
    'Numéro d’exigence'
  ],
  requirementValidated: [
    'Exigence validée',
    'Exigence validee'
  ],
  title: [
    'Intitulé',
    'Intitule'
  ],
  name: [
    'Nom'
  ],
  requirementNumber: [
    'Numéro d\'exigence',
    'Numéro d’exigence'
  ],
  profile: [
    'Profil spécifique',
    'Profil specifique',
    'Évaluation: Opération: Profil spécifique',
    'Evaluation: Operation: Profil specifique',
    'Profil'
  ],
  operationCode: [
    'Évaluation: Opération: Code interne',
    'Evaluation: Operation: Code interne'
  ],
  region: [
    'Évaluation: Opération: Région',
    'Evaluation: Operation: Region',
    'Région',
    'Region'
  ],
  department: [
    'Évaluation: Opération: Département',
    'Evaluation: Operation: Departement',
    'Département',
    'Departement'
  ],
  referential: [
    'Évaluation: Opération: Référentiel: Nom du référentiel',
    'Evaluation: Operation: Referentiel: Nom du referentiel',
    'Référentiel',
    'Referentiel'
  ],
  referentialVersion: [
    'Évaluation: Opération: Version du référentiel applicable: Version',
    'Evaluation: Operation: Version du referentiel applicable: Version',
    'Version du référentiel applicable',
    'Version du referentiel applicable'
  ],
  mentions: [
    'Évaluation: Opération: Mentions',
    'Evaluation: Operation: Mentions',
    'Mention',
    'Mentions',
    'Mention '
  ],
  operationProfile: [
    'Évaluation: Opération: Profil spécifique',
    'Evaluation: Operation: Profil specifique'
  ],
  performance: [
    'Évaluation: Opération: Performance',
    'Evaluation: Operation: Performance'
  ],
  rubricEvaluationCode: [
    'Rubrique: Évaluation: Code interne',
    'Rubrique: Evaluation: Code interne'
  ],
  status: [
    'Évaluation: Statut',
    'Evaluation: Statut'
  ],
  moa: [
    "Évaluation: Opération: Maître d'ouvrage: Nom de la société",
    "Evaluation: Operation: Maitre d'ouvrage: Nom de la societe"
  ],
  moaSector: [
    "Évaluation: Opération: Maître d'ouvrage: Secteur d'activité",
    "Evaluation: Operation: Maitre d'ouvrage: Secteur d'activite"
  ],
  group: [
    "Évaluation: Opération: Maître d'ouvrage: Groupe principal Nom",
    "Evaluation: Operation: Maitre d'ouvrage: Groupe principal Nom"
  ],
  groupSector: [
    "Évaluation: Opération: Maître d'ouvrage: Groupe principal Secteur d'activité",
    "Evaluation: Operation: Maitre d'ouvrage: Groupe principal Secteur d'activite"
  ],
  associatedRequirementReferenceTitle: [
    'Exigence associée: Exigence de référence: Intitulé',
    'Exigence associee: Exigence de reference: Intitule'
  ],
  theme: [
    'Thème',
    'Theme'
  ]
};

function doGet(e) {
  try {
    const mode = String((e && e.parameter && e.parameter.mode) || 'data').toLowerCase();
    const result = getNewosbExigences_();

    if (mode === 'ping' || mode === 'meta') {
      return newosbExigencesJson_({
        ok: true,
        generatedAt: new Date().toISOString(),
        sheet: NEWOSB_EXIGENCES_CONFIG.SHEET_NAME,
        rowCount: result.rows.length,
        evaluationCount: result.evaluationCount,
        headers: result.headers,
        mapping: result.mapping,
        warnings: result.warnings
      });
    }

    return newosbExigencesJson_({
      ok: true,
      generatedAt: new Date().toISOString(),
      sheet: NEWOSB_EXIGENCES_CONFIG.SHEET_NAME,
      rowCount: result.rows.length,
      evaluationCount: result.evaluationCount,
      headers: result.headers,
      mapping: result.mapping,
      warnings: result.warnings,
      rows: result.rows
    });
  } catch (error) {
    return newosbExigencesJson_({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}

function newosbExigencesJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Normalise fortement un intitulé afin de reconnaître :
 * - accents / absence d'accents ;
 * - apostrophes droites / typographiques ;
 * - espaces multiples ;
 * - ponctuation et différences de casse.
 */
function newosbExigencesNorm_(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function newosbExigencesHeaderIndex_(headers) {
  const out = {};
  headers.forEach(function(header, index) {
    const key = newosbExigencesNorm_(header);
    if (!key) return;
    // Première occurrence conservée si un export contient deux colonnes homonymes.
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = index;
  });
  return out;
}

function newosbExigencesCol_(index, aliases) {
  for (let i = 0; i < aliases.length; i += 1) {
    const key = newosbExigencesNorm_(aliases[i]);
    if (Object.prototype.hasOwnProperty.call(index, key)) return index[key];
  }
  return -1;
}

function newosbExigencesResolveCols_(headers, index) {
  const cols = {};
  const mapping = {};

  Object.keys(NEWOSB_EXIGENCES_ALIASES).forEach(function(field) {
    const idx = newosbExigencesCol_(index, NEWOSB_EXIGENCES_ALIASES[field]);
    cols[field] = idx;
    mapping[field] = idx >= 0 ? headers[idx] : null;
  });

  return { cols: cols, mapping: mapping };
}

function newosbExigencesValue_(displayRow, idx) {
  return idx >= 0 ? String(displayRow[idx] == null ? '' : displayRow[idx]).trim() : '';
}

function newosbExigencesFirstValue_(displayRow, indices) {
  for (let i = 0; i < indices.length; i += 1) {
    const value = newosbExigencesValue_(displayRow, indices[i]);
    if (value !== '') return value;
  }
  return '';
}

function newosbExigencesDate_(rawRow, displayRow, idx, timezone) {
  if (idx < 0) return { text: '', year: null };
  const raw = rawRow[idx];
  if (Object.prototype.toString.call(raw) === '[object Date]' && !isNaN(raw.getTime())) {
    return {
      text: Utilities.formatDate(raw, timezone, 'yyyy-MM-dd'),
      year: Number(Utilities.formatDate(raw, timezone, 'yyyy'))
    };
  }
  const text = String(displayRow[idx] == null ? '' : displayRow[idx]).trim();
  const y = text.match(/\b(20\d{2})\b/);
  return { text: text, year: y ? Number(y[1]) : null };
}

function newosbExigencesNature_(referential) {
  const s = newosbExigencesNorm_(referential);
  if (s.indexOf('renovation') >= 0) return 'Rénovation';
  if (s.indexOf('neuf') >= 0) return 'Neuf';
  return 'Autre';
}

function newosbExigencesSector_(referential) {
  const s = newosbExigencesNorm_(referential);
  if (s.indexOf('tertiaire') >= 0) return 'Tertiaire';
  if (s.indexOf('logement') >= 0) return 'Logement';
  return 'Autre';
}

/**
 * Extrait un numéro du type 1.1.1 / 3.3.14 depuis un texte si aucune
 * colonne de référence dédiée n'est disponible.
 */
function newosbExigencesReferenceFromText_(text) {
  const s = String(text || '').trim();
  const match = s.match(/(?:^|\s)(\d+(?:\.\d+){1,3})(?:\.|\s|-|$)/);
  return match ? match[1].replace(/\.$/, '') : '';
}

function newosbExigencesThemeFromReference_(reference) {
  const ref = String(reference || '').trim();
  if (!ref) return '';
  const parts = ref.split('.').filter(Boolean);
  if (parts.length >= 2) return parts[0] + '.' + parts[1];
  return parts.length ? parts[0] : '';
}

function newosbExigencesTargetFromTexts_(values) {
  for (let i = 0; i < values.length; i += 1) {
    const s = String(values[i] || '').trim();
    if (!s) continue;
    const m = s.match(/^\s*([1-4])(?=\s*(?:\.|-|–|—|:|$))/);
    if (m) return m[1];
  }
  return '';
}

function newosbExigencesRequirementText_(displayRow, cols) {
  // Priorité : nom de l'exigence associée > intitulé référentiel associé > intitulé > nom > description.
  return newosbExigencesFirstValue_(displayRow, [
    cols.associatedRequirementName,
    cols.associatedRequirementReferenceTitle,
    cols.title,
    cols.name,
    cols.description
  ]);
}

function newosbExigencesEvaluationCode_(displayRow, cols, rowNumber) {
  // Priorité aux identifiants évaluation explicites.
  const code = newosbExigencesFirstValue_(displayRow, [
    cols.evaluationCode,
    cols.rubricEvaluationCode
  ]);
  if (code) return code;

  // À défaut, l'opération sert d'identifiant de regroupement.
  const op = newosbExigencesValue_(displayRow, cols.operationCode);
  if (op) return 'OP:' + op;

  // Dernier recours : le code interne de la ligne. Cela évite de perdre la donnée.
  const rowCode = newosbExigencesValue_(displayRow, cols.rowCode);
  if (rowCode) return 'ROW:' + rowCode;

  return 'LIGNE:' + rowNumber;
}

function getNewosbExigences_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NEWOSB_EXIGENCES_CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Onglet RAPPORT introuvable. Renommez l’onglet source exactement "RAPPORT".');

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < NEWOSB_EXIGENCES_CONFIG.FIRST_DATA_ROW || lastColumn < 1) {
    throw new Error('L’onglet RAPPORT ne contient pas de données exploitables.');
  }

  const headers = sheet
    .getRange(NEWOSB_EXIGENCES_CONFIG.HEADER_ROW, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(function(v) { return String(v || '').trim(); });

  const index = newosbExigencesHeaderIndex_(headers);
  const resolved = newosbExigencesResolveCols_(headers, index);
  const cols = resolved.cols;
  const mapping = resolved.mapping;
  const warnings = [];

  // Il faut seulement pouvoir identifier une exigence d'une manière ou d'une autre.
  const hasRequirementField = [
    cols.associatedRequirementName,
    cols.associatedRequirementReferenceTitle,
    cols.title,
    cols.name,
    cols.description,
    cols.requirementReference,
    cols.requirementCode,
    cols.requirementNumber
  ].some(function(idx) { return idx >= 0; });

  if (!hasRequirementField) {
    throw new Error(
      'Aucune colonne permettant d’identifier les exigences n’a été trouvée dans RAPPORT. ' +
      'Colonnes reconnues : Exigence associée: Nom, Intitulé, Nom, Description, Code d’exigence, Numéro d’exigence ou Exigence de référence.'
    );
  }

  if (cols.evaluationCode < 0 && cols.rubricEvaluationCode < 0) {
    warnings.push('Aucune colonne Évaluation: Code interne trouvée : NEWOSB utilisera le code opération, puis le code interne de ligne, comme identifiant de regroupement.');
  }
  if (cols.referential < 0) warnings.push('Référentiel absent : la nature Neuf/Rénovation ne pourra pas être déterminée avec certitude.');
  if (cols.region < 0) warnings.push('Région absente : le filtre Région restera vide.');
  if (cols.department < 0) warnings.push('Département absent : le filtre Département restera vide.');
  if (cols.profile < 0 && cols.operationProfile < 0) warnings.push('Profil spécifique absent : le filtre Profil restera vide.');

  const count = lastRow - NEWOSB_EXIGENCES_CONFIG.FIRST_DATA_ROW + 1;
  const range = sheet.getRange(NEWOSB_EXIGENCES_CONFIG.FIRST_DATA_ROW, 1, count, lastColumn);
  const rawValues = range.getValues();
  const displayValues = range.getDisplayValues();
  const timezone = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'Europe/Paris';

  const rows = [];
  const evaluations = {};
  let targetCorrections = 0;
  let targetUnclassified = 0;

  for (let i = 0; i < displayValues.length; i += 1) {
    const displayRow = displayValues[i];
    const rawRow = rawValues[i];
    const sourceRowNumber = NEWOSB_EXIGENCES_CONFIG.FIRST_DATA_ROW + i;

    const requirement = newosbExigencesRequirementText_(displayRow, cols);
    let requirementReference = newosbExigencesFirstValue_(displayRow, [
      cols.requirementCode,
      cols.requirementNumber,
      cols.requirementReference
    ]);
    if (!requirementReference) requirementReference = newosbExigencesReferenceFromText_(requirement);

    // Une ligne totalement vide n'est pas exportée.
    if (!requirement && !requirementReference) continue;

    const evaluationCode = newosbExigencesEvaluationCode_(displayRow, cols, sourceRowNumber);
    const referential = newosbExigencesValue_(displayRow, cols.referential);

    // Année : version du référentiel si elle contient une année, sinon date de création.
    const versionText = newosbExigencesValue_(displayRow, cols.referentialVersion);
    let dateInfo = { text: versionText, year: null };
    const versionYear = versionText.match(/\b(20\d{2})\b/);
    if (versionYear) dateInfo.year = Number(versionYear[1]);

    if (!dateInfo.year) {
      dateInfo = newosbExigencesDate_(rawRow, displayRow, cols.createdAt, timezone);
    }

    const mentions = newosbExigencesValue_(displayRow, cols.mentions);
    const profile = newosbExigencesFirstValue_(displayRow, [cols.profile, cols.operationProfile]);
    const sourceTheme = newosbExigencesValue_(displayRow, cols.theme);
    const theme = sourceTheme || newosbExigencesThemeFromReference_(requirementReference);
    const codeTarget = newosbExigencesTargetFromTexts_([
      newosbExigencesValue_(displayRow, cols.requirementCode),
      newosbExigencesValue_(displayRow, cols.requirementNumber),
      newosbExigencesValue_(displayRow, cols.associatedRequirementReferenceTitle),
      newosbExigencesValue_(displayRow, cols.title),
      requirement,
      requirementReference
    ]);
    const themeTarget = newosbExigencesTargetFromTexts_([sourceTheme, theme]);
    const target = codeTarget || themeTarget;
    if (codeTarget && themeTarget && codeTarget !== themeTarget) targetCorrections += 1;
    if (!target) targetUnclassified += 1;

    rows.push({
      sourceRow: sourceRowNumber,
      rowCode: newosbExigencesValue_(displayRow, cols.rowCode),
      evaluationCode: evaluationCode,
      operationCode: newosbExigencesValue_(displayRow, cols.operationCode),
      region: newosbExigencesValue_(displayRow, cols.region),
      department: newosbExigencesValue_(displayRow, cols.department),
      referential: referential,
      referentialVersion: versionText,
      referentialDate: dateInfo.text,
      year: dateInfo.year,
      mentions: mentions,
      profile: profile,
      performance: newosbExigencesValue_(displayRow, cols.performance),
      status: newosbExigencesValue_(displayRow, cols.status),
      moa: newosbExigencesValue_(displayRow, cols.moa),
      moaSector: newosbExigencesValue_(displayRow, cols.moaSector),
      group: newosbExigencesValue_(displayRow, cols.group),
      groupSector: newosbExigencesValue_(displayRow, cols.groupSector),
      requirementReference: requirementReference,
      requirementLabel: newosbExigencesFirstValue_(displayRow, [
        cols.associatedRequirementReferenceTitle,
        cols.associatedRequirementName,
        cols.title,
        cols.name
      ]),
      requirementCode: newosbExigencesValue_(displayRow, cols.requirementCode),
      requirementNumber: newosbExigencesValue_(displayRow, cols.requirementNumber),
      requirementValidated: newosbExigencesValue_(displayRow, cols.requirementValidated),
      rubricCode: newosbExigencesFirstValue_(displayRow, [cols.rubricCode]),
      target: target,
      theme: theme,
      requirement: requirement || requirementReference,
      description: newosbExigencesValue_(displayRow, cols.description),
      createdAt: newosbExigencesValue_(displayRow, cols.createdAt),
      lastActivityAt: newosbExigencesValue_(displayRow, cols.lastActivityAt),
      modifiedAt: newosbExigencesValue_(displayRow, cols.modifiedAt),
      createdBy: newosbExigencesValue_(displayRow, cols.createdBy),
      modifiedBy: newosbExigencesValue_(displayRow, cols.modifiedBy),
      nature: newosbExigencesNature_(referential),
      sector: newosbExigencesSector_(referential)
    });

    evaluations[evaluationCode] = true;
  }

  if (targetCorrections > 0) warnings.push(targetCorrections + ' ligne(s) avaient un Thème incohérent avec le code de l’exigence : le code a été utilisé pour la cible.');
  if (targetUnclassified > 0) warnings.push(targetUnclassified + ' ligne(s) ne peuvent pas être rattachées automatiquement aux cibles 1 à 4.');

  return {
    headers: headers,
    mapping: mapping,
    warnings: warnings,
    evaluationCount: Object.keys(evaluations).length,
    rows: rows
  };
}
