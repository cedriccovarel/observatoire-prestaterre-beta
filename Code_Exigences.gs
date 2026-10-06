/**
 * OBSERVATOIRE PRESTATERRE V6.14 — SOURCE EXIGENCES (onglet RAPPORT) — version API 06.14
 *
 * À coller dans Extensions > Apps Script du Google Sheet contenant l'onglet RAPPORT
 * (projet Apps Script DISTINCT de celui d'OPERATIONS : ses propriétés et sa clé sont propres).
 *
 * Sécurité (Paramètres du projet > Propriétés du script) :
 * - NEWOSB_ALLOWED_ORIGINS : adresse(s) du site autorisées à dialoguer avec le pont (OBLIGATOIRE),
 *   ex. https://prestaterre.github.io — plusieurs valeurs séparées par des virgules ;
 * - NEWOSB_ACCESS_KEY : clé d'accès (OBLIGATOIRE, 16 caractères minimum). Sans clé valide, aucune
 *   ligne, aucun en-tête, aucun volume et aucune métadonnée de RAPPORT n'est transmis.
 *   Changer la valeur révoque immédiatement l'ancienne clé pour les nouvelles requêtes.
 * Lancer configurerSecuriteExigences() pour vérifier ; genererCleAccesExigences() crée une clé si aucune n'existe.
 *
 * Transport : uniquement le pont HtmlService (popup ou iframe) + google.script.run.
 * Plus de lecture directe en GET, JSON ou JSONP (V6.14). Un ping public minimal reste disponible.
 *
 * Principes conservés : l'ordre des colonnes n'a aucune importance ; les colonnes sont reconnues
 * par leur intitulé et des alias ; aucune colonne optionnelle ne bloque l'export.
 */

const NEWOSB_EXIGENCES_CONFIG = {
  SHEET_NAME: 'RAPPORT',
  HEADER_ROW: 1,
  FIRST_DATA_ROW: 2,
  VERSION: '06.14',
  SERVICE: 'NEWOSB EXIGENCES',
  CHUNK_SIZE: 1500,
  MAX_CHUNK_SIZE: 3000,
  MIN_KEY_LENGTH: 16,
  ALLOWED_ORIGINS_PROPERTY: 'NEWOSB_ALLOWED_ORIGINS',
  ACCESS_KEY_PROPERTY: 'NEWOSB_ACCESS_KEY'
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
  operationYear: [
    'Évaluation: Opération: Année',
    'Evaluation: Operation: Annee',
    'Année opération',
    'Annee operation',
    'Année'
  ],
  socialZone: [
    'Évaluation: Opération: Zonage logement social 1/2/3',
    'Evaluation: Operation: Zonage logement social 1/2/3',
    'Zonage logement social 1/2/3',
    'Zonage'
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
  ],
  referentialVersionDate: [
    'Version du ref ( date )',
    'Version du ref (date)',
    'Date de version du référentiel',
    'Date version'
  ]
};

// -----------------------------------------------------------------------------
// Point d'entrée web : aucune donnée de RAPPORT hors du pont authentifié.
// -----------------------------------------------------------------------------
function doGet(e) {
  const params = (e && e.parameter) || {};
  if (String(params.bridge || '') === '1') return newosbExigencesBridgeHtml_(params);
  const mode = String(params.mode || '').toLowerCase();
  if (mode === 'ping') {
    return newosbExigencesJson_({ ok: true, service: NEWOSB_EXIGENCES_CONFIG.SERVICE, version: NEWOSB_EXIGENCES_CONFIG.VERSION, protected: true });
  }
  return newosbExigencesJson_({
    ok: false,
    service: NEWOSB_EXIGENCES_CONFIG.SERVICE,
    version: NEWOSB_EXIGENCES_CONFIG.VERSION,
    protected: true,
    error: "Lecture directe désactivée : les données RAPPORT ne sont transmises qu'à l'Observatoire, par le pont sécurisé et avec la clé d'accès."
  });
}

/**
 * Appelée par google.script.run depuis la page du pont. La clé est vérifiée ici, côté serveur,
 * avant toute lecture du classeur (données, en-têtes, volumes, correspondances de colonnes).
 */
function newosbExigencesBridgeRequest(params) {
  const service = NEWOSB_EXIGENCES_CONFIG.SERVICE, version = NEWOSB_EXIGENCES_CONFIG.VERSION;
  try {
    const input = params || {};
    const access = newosbExigencesCheckAccess_(input);
    if (!access.ok) return { ok: false, authError: true, service: service, version: version, error: access.error };
    const mode = String(input.mode || '').toLowerCase();
    if (mode === 'ping') return { ok: true, service: service, version: version, generatedAt: new Date().toISOString() };
    if (mode === 'meta') {
      const ctx = newosbExigencesContext_();
      return {
        ok: true, service: service, version: version, generatedAt: new Date().toISOString(),
        sheet: NEWOSB_EXIGENCES_CONFIG.SHEET_NAME, rowCount: ctx.rowCount, chunkSize: NEWOSB_EXIGENCES_CONFIG.CHUNK_SIZE,
        headers: ctx.headers, mapping: ctx.mapping, warnings: ctx.warnings
      };
    }
    if (mode === 'chunk') {
      const ctx = newosbExigencesContext_();
      const offset = Math.max(0, Math.min(ctx.rowCount, Math.floor(Number(input.offset) || 0)));
      const limit = Math.max(1, Math.min(NEWOSB_EXIGENCES_CONFIG.MAX_CHUNK_SIZE, Math.floor(Number(input.limit) || NEWOSB_EXIGENCES_CONFIG.CHUNK_SIZE)));
      const rows = newosbExigencesRows_(ctx, offset, limit);
      return { ok: true, service: service, version: version, offset: offset, count: rows.length, physicalCount: Math.min(limit, Math.max(0, ctx.rowCount - offset)), done: offset + limit >= ctx.rowCount, rows: rows };
    }
    return { ok: false, service: service, version: version, error: 'Mode inconnu.' };
  } catch (error) {
    return { ok: false, service: service, version: version, error: String(error && error.message ? error.message : error) };
  }
}

function newosbExigencesJson_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function newosbExigencesProp_(name) {
  try { return String(PropertiesService.getScriptProperties().getProperty(name) || '').trim(); } catch (e) { return ''; }
}

function newosbExigencesAllowedOrigins_() {
  return newosbExigencesProp_(NEWOSB_EXIGENCES_CONFIG.ALLOWED_ORIGINS_PROPERTY)
    .split(/[\s,;]+/)
    .map(function(v) { return v.replace(/\/+$/, ''); })
    .filter(function(v) { return /^https?:\/\/[^\/\s]+$/i.test(v); });
}

function newosbExigencesSafeEqual_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Clé OBLIGATOIRE, vérifiée à chaque requête, jamais journalisée.
function newosbExigencesCheckAccess_(params) {
  const expected = newosbExigencesProp_(NEWOSB_EXIGENCES_CONFIG.ACCESS_KEY_PROPERTY);
  if (!expected) return { ok: false, error: 'Propriété NEWOSB_ACCESS_KEY non configurée dans le projet Apps Script Exigences : toute lecture est refusée.' };
  if (expected.length < NEWOSB_EXIGENCES_CONFIG.MIN_KEY_LENGTH) return { ok: false, error: 'Propriété NEWOSB_ACCESS_KEY trop courte (' + NEWOSB_EXIGENCES_CONFIG.MIN_KEY_LENGTH + ' caractères minimum) : toute lecture est refusée.' };
  let failures = 0;
  try { failures = Number(CacheService.getScriptCache().get('newosb_req_key_failures') || 0); } catch (e) {}
  if (failures >= 30) return { ok: false, error: 'Trop de tentatives avec une clé invalide : réessaie dans quelques minutes.' };
  if (newosbExigencesSafeEqual_(params && params.key, expected)) return { ok: true };
  try { CacheService.getScriptCache().put('newosb_req_key_failures', String(failures + 1), 600); } catch (e) {}
  return { ok: false, error: "Clé d'accès absente ou invalide." };
}

function newosbExigencesBridgeHtml_(params) {
  const interactive = String(params && params.interactive || '') === '1';
  const token = String(params && params.bridgeToken || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
  const allowedJson = JSON.stringify(newosbExigencesAllowedOrigins_()).replace(/</g, '\\u003c');
  const v = NEWOSB_EXIGENCES_CONFIG.VERSION;
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif;background:#f3f7f5;color:#173b3f}.wrap{display:' + (interactive ? 'flex' : 'none') + ';min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}.card{width:min(520px,100%);background:#fff;border:1px solid #d6e2dd;border-radius:18px;padding:28px;box-shadow:0 20px 55px rgba(6,64,43,.12)}.brand{font-size:12px;font-weight:800;letter-spacing:.11em;color:#0b6b4a;text-transform:uppercase}.title{font-size:22px;font-weight:800;margin:8px 0 10px}.status{font-size:14px;line-height:1.5;color:#52666b}.small{margin-top:18px;font-size:12px;color:#7a8a8d}</style></head>' +
    '<body><div class="wrap"><div class="card"><div class="brand">Observatoire V6.14</div><div class="title">Connexion Google · Exigences</div><div class="status" id="status">Connexion au classeur RAPPORT en cours... Cette fenêtre se fermera automatiquement.</div><div class="small">Si Google demande une autorisation, valide-la ici.</div></div></div>' +
    '<script>(function(){' +
    'var TOKEN=' + JSON.stringify(token) + ';var ALLOWED=' + allowedJson + ';var PEER=null,PEER_ORIGIN="";' +
    'var st=document.getElementById("status");function setStatus(t){if(st)st.textContent=t;}' +
    'function send(w,p,o){try{if(w&&w!==window&&o)w.postMessage(p,o);}catch(e){}}' +
    'function ready(w){for(var i=0;i<ALLOWED.length;i++)send(w,{type:"NEWOSB_BRIDGE_READY",version:"' + v + '",token:TOKEN},ALLOWED[i]);}' +
    'function broadcast(){if(PEER)return;try{ready(window.opener);}catch(e){}try{ready(window.parent&&window.parent.opener);}catch(e){}try{ready(window.top&&window.top.opener);}catch(e){}try{if(window.top!==window)ready(window.top);}catch(e){}try{ready(parent);}catch(e){}}' +
    'window.addEventListener("message",function(ev){var m=ev.data||{};if(!TOKEN||!m||m.token!==TOKEN)return;' +
    'if(ALLOWED.indexOf(ev.origin)<0){var r=ALLOWED.length?"Site non autorisé par le script Exigences : "+ev.origin+". Ajoute cette adresse dans la propriété NEWOSB_ALLOWED_ORIGINS.":"Propriété NEWOSB_ALLOWED_ORIGINS non configurée dans le projet Apps Script Exigences : le pont refuse de transmettre les données.";setStatus(r);' +
    'if(m.type==="NEWOSB_BRIDGE_REQUEST"&&m.id)send(ev.source,{type:"NEWOSB_BRIDGE_RESPONSE",id:m.id,error:r,token:TOKEN},ev.origin);else if(m.type==="NEWOSB_BRIDGE_HELLO")send(ev.source,{type:"NEWOSB_BRIDGE_READY",version:"' + v + '",token:TOKEN,refused:true,error:r},ev.origin);return;}' +
    'if(!PEER){PEER=ev.source;PEER_ORIGIN=ev.origin;}if(ev.source!==PEER||ev.origin!==PEER_ORIGIN)return;' +
    'if(m.type==="NEWOSB_BRIDGE_HELLO"){send(PEER,{type:"NEWOSB_BRIDGE_READY",version:"' + v + '",token:TOKEN},PEER_ORIGIN);return;}' +
    'if(m.type==="NEWOSB_BRIDGE_CLOSE"){try{window.close();}catch(e){}return;}' +
    'if(m.type!=="NEWOSB_BRIDGE_REQUEST"||!m.id)return;var p=m.params||{};setStatus("Lecture "+String(p.mode||"requête")+" en cours...");' +
    'google.script.run.withSuccessHandler(function(payload){setStatus(payload&&payload.authError?"Accès refusé par le script.":"Connexion établie.");send(PEER,{type:"NEWOSB_BRIDGE_RESPONSE",id:m.id,payload:payload,token:TOKEN},PEER_ORIGIN);})' +
    '.withFailureHandler(function(err){var t=String(err&&err.message?err.message:err);setStatus("Erreur : "+t);send(PEER,{type:"NEWOSB_BRIDGE_RESPONSE",id:m.id,error:t,token:TOKEN},PEER_ORIGIN);})' +
    '.newosbExigencesBridgeRequest(p);});' +
    'broadcast();var n=0,timer=setInterval(function(){n++;broadcast();if(n>240||PEER)clearInterval(timer);},500);' +
    '})();</script></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('Observatoire - pont Exigences')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * À lancer depuis l'éditeur : affiche la configuration de sécurité (sans jamais écrire la clé).
 */
function configurerSecuriteExigences() {
  const origins = newosbExigencesAllowedOrigins_();
  const key = newosbExigencesProp_(NEWOSB_EXIGENCES_CONFIG.ACCESS_KEY_PROPERTY);
  Logger.log('Version : ' + NEWOSB_EXIGENCES_CONFIG.VERSION);
  Logger.log('Sites autorisés (NEWOSB_ALLOWED_ORIGINS) : ' + (origins.length ? origins.join(', ') : 'AUCUN - le pont refusera de transmettre les données'));
  Logger.log('Clé d accès (NEWOSB_ACCESS_KEY) : ' + (!key ? 'NON CONFIGURÉE - toute lecture est refusée' : (key.length < NEWOSB_EXIGENCES_CONFIG.MIN_KEY_LENGTH ? 'TROP COURTE - toute lecture est refusée' : 'configurée (' + key.length + ' caractères)')));
  return { origins: origins, accessKey: !!key && key.length >= NEWOSB_EXIGENCES_CONFIG.MIN_KEY_LENGTH };
}

/**
 * Crée une clé aléatoire de 40 caractères si aucune n'existe (valeur non journalisée :
 * la lire dans Paramètres du projet > Propriétés du script). Une clé existante n'est jamais remplacée
 * par cette fonction (elle est appelable via google.script.run) : la modifier directement dans les propriétés.
 */
function genererCleAccesExigences() {
  if (newosbExigencesProp_(NEWOSB_EXIGENCES_CONFIG.ACCESS_KEY_PROPERTY)) {
    Logger.log('Une clé existe déjà : modifie-la directement dans les propriétés du script pour la changer.');
    return { ok: false, exists: true };
  }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now())
    .concat(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random()));
  let out = '';
  bytes.slice(0, 40).forEach(function(b) { out += alphabet.charAt(((b % 256) + 256) % alphabet.length); });
  PropertiesService.getScriptProperties().setProperty(NEWOSB_EXIGENCES_CONFIG.ACCESS_KEY_PROPERTY, out);
  Logger.log('Nouvelle clé enregistrée dans NEWOSB_ACCESS_KEY (40 caractères). Consulte-la dans Paramètres du projet > Propriétés du script.');
  return { ok: true, length: out.length };
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

// -----------------------------------------------------------------------------
// Lecture de RAPPORT (appelée uniquement après vérification de la clé)
// -----------------------------------------------------------------------------
function newosbExigencesContext_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NEWOSB_EXIGENCES_CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Onglet RAPPORT introuvable. Renommez l’onglet source exactement "RAPPORT".');
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < NEWOSB_EXIGENCES_CONFIG.FIRST_DATA_ROW || lastColumn < 1) throw new Error('L’onglet RAPPORT ne contient pas de données exploitables.');
  const headers = sheet.getRange(NEWOSB_EXIGENCES_CONFIG.HEADER_ROW, 1, 1, lastColumn).getDisplayValues()[0].map(function(v) { return String(v || '').trim(); });
  const index = newosbExigencesHeaderIndex_(headers);
  const resolved = newosbExigencesResolveCols_(headers, index);
  const cols = resolved.cols;
  const warnings = [];
  const hasRequirementField = [cols.associatedRequirementName, cols.associatedRequirementReferenceTitle, cols.title, cols.name, cols.description, cols.requirementReference, cols.requirementCode, cols.requirementNumber].some(function(idx) { return idx >= 0; });
  if (!hasRequirementField) {
    throw new Error('Aucune colonne permettant d’identifier les exigences n’a été trouvée dans RAPPORT. Colonnes reconnues : Exigence associée: Nom, Intitulé, Nom, Description, Code d’exigence, Numéro d’exigence ou Exigence de référence.');
  }
  if (cols.operationCode < 0) warnings.push('Colonne « Évaluation: Opération: Code interne » absente : les exigences ne pourront pas être rattachées aux opérations ni comptées par opération.');
  if (cols.evaluationCode < 0 && cols.rubricEvaluationCode < 0) warnings.push('Aucune colonne Évaluation: Code interne trouvée : NEWOSB utilisera le code opération, puis le code interne de ligne, comme identifiant de regroupement.');
  if (cols.referential < 0) warnings.push('Référentiel absent : la nature Neuf/Rénovation ne pourra pas être déterminée avec certitude.');
  if (cols.referentialVersion < 0 && cols.referentialVersionDate < 0) warnings.push('Version du référentiel absente : les mentions ne pourront pas être rapprochées d’une version datée.');
  if (cols.region < 0) warnings.push('Région absente : le filtre Région restera vide.');
  if (cols.department < 0) warnings.push('Département absent : le filtre Département restera vide.');
  if (cols.profile < 0 && cols.operationProfile < 0) warnings.push('Profil spécifique absent : le filtre Profil restera vide.');
  return {
    ss: ss, sheet: sheet, headers: headers, cols: cols, mapping: resolved.mapping, warnings: warnings,
    lastColumn: lastColumn, rowCount: lastRow - NEWOSB_EXIGENCES_CONFIG.FIRST_DATA_ROW + 1,
    timezone: ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'Europe/Paris'
  };
}

function newosbExigencesRows_(ctx, offset, limit) {
  const count = Math.max(0, Math.min(limit, ctx.rowCount - offset));
  if (!count) return [];
  const cols = ctx.cols;
  const first = NEWOSB_EXIGENCES_CONFIG.FIRST_DATA_ROW + offset;
  const range = ctx.sheet.getRange(first, 1, count, ctx.lastColumn);
  const rawValues = range.getValues();
  const displayValues = range.getDisplayValues();
  const rows = [];
  for (let i = 0; i < displayValues.length; i += 1) {
    const displayRow = displayValues[i];
    const rawRow = rawValues[i];
    const sourceRowNumber = first + i;
    const requirement = newosbExigencesRequirementText_(displayRow, cols);
    let requirementReference = newosbExigencesFirstValue_(displayRow, [cols.requirementCode, cols.requirementNumber, cols.requirementReference]);
    if (!requirementReference) requirementReference = newosbExigencesReferenceFromText_(requirement);
    if (!requirement && !requirementReference) continue;
    const evaluationCode = newosbExigencesEvaluationCode_(displayRow, cols, sourceRowNumber);
    const referential = newosbExigencesValue_(displayRow, cols.referential);
    const versionText = newosbExigencesValue_(displayRow, cols.referentialVersion);
    let dateInfo = { text: versionText, year: null };
    const versionYear = versionText.match(/\b(20\d{2})\b/);
    if (versionYear) dateInfo.year = Number(versionYear[1]);
    if (!dateInfo.year) dateInfo = newosbExigencesDate_(rawRow, displayRow, cols.createdAt, ctx.timezone);
    const versionDate = newosbExigencesDate_(rawRow, displayRow, cols.referentialVersionDate, ctx.timezone);
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
    rows.push({
      sourceRow: sourceRowNumber,
      rowCode: newosbExigencesValue_(displayRow, cols.rowCode),
      evaluationCode: evaluationCode,
      operationCode: newosbExigencesValue_(displayRow, cols.operationCode),
      operationYear: newosbExigencesValue_(displayRow, cols.operationYear),
      socialZone: newosbExigencesValue_(displayRow, cols.socialZone),
      region: newosbExigencesValue_(displayRow, cols.region),
      department: newosbExigencesValue_(displayRow, cols.department),
      referential: referential,
      referentialVersion: versionText,
      referentialVersionDate: versionDate.text,
      referentialDate: dateInfo.text,
      year: dateInfo.year,
      mentions: newosbExigencesValue_(displayRow, cols.mentions),
      profile: newosbExigencesFirstValue_(displayRow, [cols.profile, cols.operationProfile]),
      performance: newosbExigencesValue_(displayRow, cols.performance),
      status: newosbExigencesValue_(displayRow, cols.status),
      moa: newosbExigencesValue_(displayRow, cols.moa),
      moaSector: newosbExigencesValue_(displayRow, cols.moaSector),
      group: newosbExigencesValue_(displayRow, cols.group),
      groupSector: newosbExigencesValue_(displayRow, cols.groupSector),
      requirementReference: requirementReference,
      requirementLabel: newosbExigencesFirstValue_(displayRow, [cols.associatedRequirementReferenceTitle, cols.associatedRequirementName, cols.title, cols.name]),
      associatedRequirementReferenceTitle: newosbExigencesValue_(displayRow, cols.associatedRequirementReferenceTitle),
      requirementCode: newosbExigencesValue_(displayRow, cols.requirementCode),
      requirementNumber: newosbExigencesValue_(displayRow, cols.requirementNumber),
      requirementValidated: newosbExigencesValue_(displayRow, cols.requirementValidated),
      rubricCode: newosbExigencesFirstValue_(displayRow, [cols.rubricCode]),
      target: codeTarget || themeTarget,
      theme: theme,
      requirement: requirement || requirementReference,
      nature: newosbExigencesNature_(referential),
      sector: newosbExigencesSector_(referential)
    });
  }
  return rows;
}
