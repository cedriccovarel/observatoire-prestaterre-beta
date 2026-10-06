/**
 * PRESTATERRE OBSERVATOIRE - V6.14 (script OPERATIONS, version API 06.14)
 *
 * Securite V6.14 (proprietes du script : Parametres du projet > Proprietes du script) :
 * - NEWOSB_ALLOWED_ORIGINS : adresse(s) du site autorisees a dialoguer avec le pont,
 *   separees par des virgules, ex. https://prestaterre.github.io  (OBLIGATOIRE)
 * - NEWOSB_ACCESS_KEY      : cle d'acces (OBLIGATOIRE, 16 caracteres minimum). Elle est saisie dans
 *   l'Observatoire, gardee en memoire du navigateur et transmise uniquement par le pont ; elle n'est
 *   jamais placee dans une URL. Sans cle configuree, le script refuse toute lecture.
 *   Changer la valeur revoque immediatement l'ancienne cle pour toutes les nouvelles requetes.
 * - NEWOSB_ANONYMIZED_ONLY : 1 pour un deploiement qui ne renvoie que des donnees pseudonymisees
 * - NEWOSB_PSEUDO_SECRET   : cree automatiquement ; sert aux pseudonymes du mode anonymise
 * Lancer une fois configurerSecuriteObservatoire() pour verifier la configuration
 * (genererCleAccesObservatoire() peut creer une cle aleatoire, lisible ensuite dans les proprietes).
 *
 * Changements V6.14 :
 * - plus aucune donnee du classeur par GET direct, JSON ou JSONP : seul un ping minimal est public ;
 * - chaque requete du pont (google.script.run) verifie la cle cote serveur avant toute lecture ;
 * - le pont ne parle qu'a une seule fenetre, d'une origine autorisee, avec le jeton de session ;
 *   aucun message n'est envoye vers « * » ;
 * - les fonctions Google Slides, zonage et communes sont conservees.
 *
 * Historique NEWOSB V05.22
 * Source OPERATIONS robuste pour Google Apps Script.
 *
 * Nouveautes V05.22 :
 * - pont HtmlService + google.script.run pour OPERATIONS
 * - creation directe de presentations Google Slides via SlidesApp
 * - graphiques, tableaux, KPI, tunnel, jauges, tuiles et flux recrees en objets natifs
 * - JSON / JSONP conserves comme secours pour la lecture OPERATIONS
 * - chargement par blocs de 500 lignes
 */
const OBSERVATOIRE_CONFIG = {
  SHEET_NAME: 'OPERATIONS',
  PREFERRED_HEADER_ROW: 2,
  HEADER_SCAN_ROWS: 12,
  DATA_SCAN_ROWS: 30,
  DEFAULT_CHUNK_SIZE: 500,
  MAX_CHUNK_SIZE: 750,
  VERSION: '06.14',
  MIN_KEY_LENGTH: 16,
  ALLOWED_ORIGINS_PROPERTY: 'NEWOSB_ALLOWED_ORIGINS',
  ACCESS_KEY_PROPERTY: 'NEWOSB_ACCESS_KEY',
  ANONYMIZED_PROPERTY: 'NEWOSB_ANONYMIZED_ONLY',
  PSEUDO_SECRET_PROPERTY: 'NEWOSB_PSEUDO_SECRET',
  SPREADSHEET_PROPERTY: 'NEWOSB_SPREADSHEET_ID',
  ZONE123_URLS: [
    'https://gitlab.com/pidila/sp-simulateurs-data/-/raw/master/donnees-de-reference/Zone123.json',
    'https://www.data.gouv.fr/api/1/datasets/r/eedf8bf6-052f-4354-b80c-fe9c1065693a'
  ],
  COMMUNES_API: 'https://geo.api.gouv.fr/communes'
};

function doGet(e) {
  const request = e || { parameter: {} };
  const params = request.parameter || {};

  // Page du pont : elle ne contient aucune donnee ; chaque lecture passe ensuite par newosbBridgeRequest (cle verifiee).
  if (String(params.bridge || '') === '1') return buildBridgeHtml_(params);

  const mode = String(params.mode || '').toLowerCase();
  const endpoint = String(params.endpoint || '').toLowerCase();

  // Proxys de donnees publiques (zonage 1/2/3, communes) : aucune donnee du classeur.
  if (endpoint === 'zone123' || endpoint === 'communes') {
    try { return jsonOutput_(endpoint === 'zone123' ? handleZone123Proxy_() : handleCommunesProxy_(params)); }
    catch (error) { return jsonOutput_({ ok: false, error: String(error && error.message ? error.message : error) }); }
  }

  // Ping public minimal : aucune donnee metier, aucun en-tete, aucun volume.
  if (mode === 'ping') return jsonOutput_({ ok: true, service: 'NEWOSB OPERATIONS', version: OBSERVATOIRE_CONFIG.VERSION, protected: true });

  return jsonOutput_({
    ok: false,
    service: 'NEWOSB OPERATIONS',
    version: OBSERVATOIRE_CONFIG.VERSION,
    protected: true,
    error: "Lecture directe desactivee : les donnees ne sont transmises qu'a l'Observatoire, par le pont securise et avec la cle d'acces."
  });
}

/**
 * Fonction appelee par google.script.run depuis le pont HtmlService.
 * La cle d'acces est verifiee ici, cote serveur, avant toute lecture du classeur.
 */
function newosbBridgeRequest(params) {
  try {
    const input = params || {};
    const access = newosbCheckAccess_(input);
    if (!access.ok) {
      return { ok: false, authError: true, service: 'NEWOSB OPERATIONS', version: OBSERVATOIRE_CONFIG.VERSION, error: access.error };
    }
    const clean = {};
    Object.keys(input).forEach(function(k) { if (k !== 'key') clean[k] = input[k]; });
    return newosbApiRequest_(clean);
  } catch (error) {
    return {
      ok: false,
      service: 'NEWOSB OPERATIONS',
      version: OBSERVATOIRE_CONFIG.VERSION,
      error: String(error && error.message ? error.message : error)
    };
  }
}

function newosbApiRequest_(params) {
  const started = Date.now();
  const mode = String(params.mode || '').toLowerCase();
  const endpoint = String(params.endpoint || '').toLowerCase();

  if (mode === 'ping') {
    return {
      ok: true,
      service: 'NEWOSB OPERATIONS',
      version: OBSERVATOIRE_CONFIG.VERSION,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      transport: 'popup-bridge-ready',
      anonymizedOnly: newosbAnonymizedOnly_()
    };
  }

  // External services never block the OPERATIONS connection path.
  if (endpoint === 'zone123') return handleZone123Proxy_();
  if (endpoint === 'communes') return handleCommunesProxy_(params);

  if (mode === 'createslides') {
    if (newosbAnonymizedOnly_()) throw new Error('Creation Google Slides desactivee sur un deploiement anonymise.');
    return newosbCreateGoogleSlides_(params.presentation || {});
  }

  if (mode === 'meta') {
    const meta = getSheetMeta_();
    return {
      ok: true,
      service: 'NEWOSB OPERATIONS',
      version: OBSERVATOIRE_CONFIG.VERSION,
      format: 'matrix-chunks-v2',
      generatedAt: new Date().toISOString(),
      headers: meta.headers,
      totalRows: meta.totalRows,
      lastRow: meta.lastRow,
      lastColumn: meta.lastColumn,
      headerRow: meta.headerRow,
      firstDataRow: meta.firstDataRow,
      headerScore: meta.headerScore,
      recognizedHeaderHints: meta.recognizedHeaderHints,
      chunkSize: OBSERVATOIRE_CONFIG.DEFAULT_CHUNK_SIZE,
      maxChunkSize: OBSERVATOIRE_CONFIG.MAX_CHUNK_SIZE,
      durationMs: Date.now() - started,
      zone123Status: {
        ok: true,
        source: 'OPERATIONS / cartographie asynchrone',
        message: 'Le zonage externe ne bloque pas la connexion OPERATIONS.'
      }
    };
  }

  if (mode === 'chunk' || mode === 'data') {
    // Do not reread headers for each block. The browser sends the metadata
    // received during the single meta call.
    const spreadsheet = getSpreadsheet_();
    const sheet = spreadsheet.getSheetByName(OBSERVATOIRE_CONFIG.SHEET_NAME);
    if (!sheet) throw new Error('Onglet OPERATIONS introuvable.');
    const fallbackMeta = getSheetMeta_();
    const fallbackLastColumn = fallbackMeta.lastColumn;
    const lastColumn = clampInteger_(params.lastColumn, 1, Math.max(1, fallbackLastColumn), fallbackLastColumn);
    const firstDataRow = clampInteger_(params.firstDataRow, 1, Math.max(1, fallbackMeta.lastRow + 1), fallbackMeta.firstDataRow);
    const fallbackTotalRows = Math.max(0, fallbackMeta.lastRow - firstDataRow + 1);
    const totalRows = clampInteger_(params.totalRows, 0, Math.max(fallbackTotalRows, Number(params.totalRows) || 0), fallbackTotalRows);
    const offset = clampInteger_(params.offset, 0, Math.max(0, totalRows), 0);
    const requestedLimit = clampInteger_(params.limit, 1, OBSERVATOIRE_CONFIG.MAX_CHUNK_SIZE, OBSERVATOIRE_CONFIG.DEFAULT_CHUNK_SIZE);
    const meta = { sheet: sheet, lastColumn: lastColumn, totalRows: totalRows, firstDataRow: firstDataRow };
    const chunk = getRowsChunk_(sheet, meta, offset, requestedLimit);
    if (newosbAnonymizedOnly_()) chunk.rows = newosbScrubMatrix_(fallbackMeta.headers, chunk.rows);
    return {
      ok: true,
      service: 'NEWOSB OPERATIONS',
      version: OBSERVATOIRE_CONFIG.VERSION,
      format: 'matrix-chunk-v2',
      offset: offset,
      count: chunk.rows.length,
      physicalCount: chunk.physicalCount,
      totalRows: totalRows,
      done: offset + chunk.physicalCount >= totalRows,
      rows: chunk.rows,
      durationMs: Date.now() - started
    };
  }

  // Direct /exec preview kept deliberately small.
  const meta = getSheetMeta_();
  const safeLimit = Math.min(meta.totalRows, 50);
  const first = getRowsChunk_(meta.sheet, meta, 0, safeLimit);
  if (newosbAnonymizedOnly_()) first.rows = newosbScrubMatrix_(meta.headers, first.rows);
  return {
    ok: true,
    service: 'NEWOSB OPERATIONS',
    version: OBSERVATOIRE_CONFIG.VERSION,
    format: 'matrix-preview',
    generatedAt: new Date().toISOString(),
    headers: meta.headers,
    headerRow: meta.headerRow,
    firstDataRow: meta.firstDataRow,
    rows: first.rows,
    count: first.rows.length,
    totalRows: meta.totalRows,
    truncated: meta.totalRows > safeLimit,
    durationMs: Date.now() - started
  };
}

function buildBridgeHtml_(params) {
  const interactive = String(params && params.interactive || '') === '1';
  const token = String(params && params.bridgeToken || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
  // V6.13 : le pont ne repond qu'aux sites declares dans NEWOSB_ALLOWED_ORIGINS.
  const allowedJson = JSON.stringify(newosbAllowedOrigins_()).replace(/</g, '\\u003c');
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif;background:#f3f7f5;color:#173b3f}
.wrap{display:${interactive ? 'flex' : 'none'};min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
.card{width:min(520px,100%);background:#fff;border:1px solid #d6e2dd;border-radius:18px;padding:28px;box-shadow:0 20px 55px rgba(6,64,43,.12)}
.brand{font-size:12px;font-weight:800;letter-spacing:.11em;color:#0b6b4a;text-transform:uppercase}.title{font-size:22px;font-weight:800;margin:8px 0 10px}.status{font-size:14px;line-height:1.5;color:#52666b}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#0b8f61;margin-right:8px;box-shadow:0 0 0 5px rgba(11,143,97,.1)}
.small{margin-top:18px;font-size:12px;color:#7a8a8d}
</style></head>
<body><div class="wrap"><div class="card"><div class="brand">Observatoire V6.14</div><div class="title"><span class="dot"></span>Connexion Google OPERATIONS</div><div class="status" id="status">Connexion au classeur en cours... Cette fenetre se fermera automatiquement.</div><div class="small">Laisse cette fenetre ouverte pendant le chargement. Si Google demande une autorisation, valide-la ici.</div></div></div>
<script>
(function(){
  var TOKEN = '${token}';
  var ALLOWED = ${allowedJson};
  var PEER = null, PEER_ORIGIN = '';
  var statusEl = document.getElementById('status');
  function setStatus(text){ if(statusEl) statusEl.textContent = text; }
  // Envoi toujours cible sur une origine precise, jamais vers « * ».
  function send(target, payload, origin){ try { if(target && target !== window && origin) target.postMessage(payload, origin); } catch(e) {} }
  function ready(target){ for (var i = 0; i < ALLOWED.length; i++) send(target, {type:'NEWOSB_BRIDGE_READY', version:'${OBSERVATOIRE_CONFIG.VERSION}', token:TOKEN}, ALLOWED[i]); }
  function broadcastReady(){
    if (PEER) return;
    try { ready(window.opener); } catch(e) {}
    try { ready(window.parent && window.parent.opener); } catch(e) {}
    try { ready(window.top && window.top.opener); } catch(e) {}
    try { if (window.top !== window) ready(window.top); } catch(e) {}
    try { ready(parent); } catch(e) {}
  }
  window.addEventListener('message', function(event){
    var msg = event.data || {};
    if (!TOKEN || !msg || msg.token !== TOKEN) return;
    if (ALLOWED.indexOf(event.origin) < 0) {
      // Reponse sans donnees, uniquement pour expliquer le refus, adressee a l'origine qui a ecrit.
      var refusal = ALLOWED.length ? 'Site non autorise par le script : ' + event.origin + '. Ajoute cette adresse dans la propriete NEWOSB_ALLOWED_ORIGINS.' : 'Propriete NEWOSB_ALLOWED_ORIGINS non configuree dans Apps Script : le pont refuse de transmettre les donnees.';
      setStatus(refusal);
      if (msg.type === 'NEWOSB_BRIDGE_REQUEST' && msg.id) send(event.source, {type:'NEWOSB_BRIDGE_RESPONSE', id:msg.id, error:refusal, token:TOKEN}, event.origin);
      else if (msg.type === 'NEWOSB_BRIDGE_HELLO') send(event.source, {type:'NEWOSB_BRIDGE_READY', version:'${OBSERVATOIRE_CONFIG.VERSION}', token:TOKEN, refused:true, error:refusal}, event.origin);
      return;
    }
    // Une seule fenetre interlocutrice par pont : la premiere fenetre autorisee qui se presente.
    if (!PEER) { PEER = event.source; PEER_ORIGIN = event.origin; }
    if (event.source !== PEER || event.origin !== PEER_ORIGIN) return;
    if (msg.type === 'NEWOSB_BRIDGE_HELLO') { send(PEER, {type:'NEWOSB_BRIDGE_READY', version:'${OBSERVATOIRE_CONFIG.VERSION}', token:TOKEN}, PEER_ORIGIN); return; }
    if (msg.type === 'NEWOSB_BRIDGE_CLOSE') { try { window.close(); } catch(e) {} return; }
    if (msg.type !== 'NEWOSB_BRIDGE_REQUEST' || !msg.id) return;
    var params = msg.params || {};
    var mode = String(params.mode || params.endpoint || 'requete');
    setStatus('Lecture ' + mode + ' en cours...');
    google.script.run
      .withSuccessHandler(function(payload){
        setStatus(payload && payload.authError ? 'Acces refuse par le script.' : (mode === 'chunk' ? 'Bloc recu. Chargement suivant...' : 'Connexion etablie.'));
        send(PEER, {type:'NEWOSB_BRIDGE_RESPONSE', id:msg.id, payload:payload, token:TOKEN}, PEER_ORIGIN);
      })
      .withFailureHandler(function(error){
        var text = String(error && error.message ? error.message : error);
        setStatus('Erreur : ' + text);
        send(PEER, {type:'NEWOSB_BRIDGE_RESPONSE', id:msg.id, error:text, token:TOKEN}, PEER_ORIGIN);
      })
      .newosbBridgeRequest(params);
  });
  broadcastReady();
  var ticks = 0;
  var timer = setInterval(function(){ ticks += 1; broadcastReady(); if(ticks > 240 || PEER) clearInterval(timer); }, 500);
})();
</script></body></html>`;
  return HtmlService
    .createHtmlOutput(html)
    .setTitle('NEWOSB OPERATIONS Bridge')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// V6.14 : plus de JSONP (aucun parametre « prefix ») ; JSON uniquement, sans donnee du classeur hors pont.
function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// -----------------------------------------------------------------------------
// V6.13 - Securite : origines autorisees, cle d'acces, mode anonymise
// -----------------------------------------------------------------------------
function newosbProp_(name) {
  try { return String(PropertiesService.getScriptProperties().getProperty(name) || '').trim(); } catch (e) { return ''; }
}

function newosbAllowedOrigins_() {
  return newosbProp_(OBSERVATOIRE_CONFIG.ALLOWED_ORIGINS_PROPERTY)
    .split(/[\s,;]+/)
    .map(function(v) { return v.replace(/\/+$/, ''); })
    .filter(function(v) { return /^https?:\/\/[^\/\s]+$/i.test(v); });
}

function newosbSafeEqual_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// V6.14 : cle OBLIGATOIRE et verifiee a chaque requete. Jamais journalisee.
function newosbCheckAccess_(params) {
  const expected = newosbProp_(OBSERVATOIRE_CONFIG.ACCESS_KEY_PROPERTY);
  if (!expected) return { ok: false, error: "Propriete NEWOSB_ACCESS_KEY non configuree dans Apps Script : le script refuse toute lecture." };
  if (expected.length < OBSERVATOIRE_CONFIG.MIN_KEY_LENGTH) return { ok: false, error: 'Propriete NEWOSB_ACCESS_KEY trop courte (' + OBSERVATOIRE_CONFIG.MIN_KEY_LENGTH + ' caracteres minimum) : le script refuse toute lecture.' };
  if (newosbTooManyFailures_()) return { ok: false, error: "Trop de tentatives avec une cle invalide : reessaie dans quelques minutes." };
  if (newosbSafeEqual_(params && params.key, expected)) return { ok: true };
  newosbRecordFailure_();
  return { ok: false, error: "Cle d'acces absente ou invalide." };
}

// Limitation simple des essais de cle (10 minutes, 30 echecs), sans conserver aucune valeur saisie.
function newosbTooManyFailures_() {
  try { return Number(CacheService.getScriptCache().get('newosb_key_failures') || 0) >= 30; } catch (e) { return false; }
}
function newosbRecordFailure_() {
  try { const c = CacheService.getScriptCache(); const n = Number(c.get('newosb_key_failures') || 0) + 1; c.put('newosb_key_failures', String(n), 600); } catch (e) {}
}

function newosbAnonymizedOnly_() {
  return /^(1|true|oui|yes)$/i.test(newosbProp_(OBSERVATOIRE_CONFIG.ANONYMIZED_PROPERTY));
}

function newosbPseudoSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = String(props.getProperty(OBSERVATOIRE_CONFIG.PSEUDO_SECRET_PROPERTY) || '');
  if (!secret) { secret = Utilities.getUuid() + Utilities.getUuid(); props.setProperty(OBSERVATOIRE_CONFIG.PSEUDO_SECRET_PROPERTY, secret); }
  return secret;
}

function newosbPseudonym_(prefix, value, secret) {
  const v = normalizeHeader_(value);
  if (!v) return '';
  const bytes = Utilities.computeHmacSha256Signature(prefix + '|' + v, secret);
  const hex = bytes.slice(0, 4).map(function(b) { return ((b + 256) % 256).toString(16); }).map(function(h) { return h.length < 2 ? '0' + h : h; }).join('');
  return prefix + ' ' + hex.toUpperCase();
}

// Regle de traitement d'une colonne en mode anonymise : 'keep', 'drop' ou un prefixe de pseudonyme.
function newosbColumnRule_(header) {
  const h = normalizeHeader_(header);
  if (/secteur d activite|hierarchie/.test(h)) return 'keep';
  if (/montant|chiffre d affaires|honoraires|\bprix\b/.test(h)) return 'drop';
  if (/adresse|code postal|postal code|\binsee\b|longitude|latitude|contact|courriel|e mail|email|telephone|\btel\b|numero du contrat|contrat numero/.test(h)) return 'drop';
  if (/groupe principal/.test(h)) return 'Groupe';
  if (/maitre d ouvrage|maitre ouvrage|\bmoa\b|nom de la societe|societe principale|raison sociale/.test(h)) return 'MOA';
  if (/nom de l operation|nom operation|nom du programme|nom programme|nom de l affaire|affaire nom/.test(h)) return 'Operation';
  if (/code interne/.test(h)) return 'OP';
  return 'keep';
}

function newosbScrubMatrix_(headers, rows) {
  const secret = newosbPseudoSecret_();
  const rules = (headers || []).map(newosbColumnRule_);
  return (rows || []).map(function(row) {
    return (row || []).map(function(cell, i) {
      const rule = rules[i] || 'keep';
      if (rule === 'keep') return cell;
      if (rule === 'drop') return '';
      return newosbPseudonym_(rule, cell, secret);
    });
  });
}

function buildBridgeErrorHtml_(message) {
  const safe = String(message || '').replace(/[&<>"']/g, function(c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; });
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><body style="font-family:Arial;padding:24px;color:#7d2219">' + safe + '</body>')
    .setTitle('Observatoire - acces refuse');
}

/**
 * A lancer une fois depuis l'editeur Apps Script apres avoir renseigne les proprietes.
 * Affiche la configuration de securite dans le journal d'execution.
 */
function configurerSecuriteObservatoire() {
  const origins = newosbAllowedOrigins_();
  const key = newosbProp_(OBSERVATOIRE_CONFIG.ACCESS_KEY_PROPERTY);
  Logger.log('Version : ' + OBSERVATOIRE_CONFIG.VERSION);
  Logger.log('Sites autorises (NEWOSB_ALLOWED_ORIGINS) : ' + (origins.length ? origins.join(', ') : 'AUCUN - le pont refusera de transmettre les donnees'));
  // La valeur de la cle n'est jamais ecrite dans le journal.
  Logger.log('Cle d acces (NEWOSB_ACCESS_KEY) : ' + (!key ? 'NON CONFIGUREE - toute lecture est refusee' : (key.length < OBSERVATOIRE_CONFIG.MIN_KEY_LENGTH ? 'TROP COURTE - toute lecture est refusee' : 'configuree (' + key.length + ' caracteres)')));
  Logger.log('Mode anonymise (NEWOSB_ANONYMIZED_ONLY) : ' + (newosbAnonymizedOnly_() ? 'ACTIF' : 'inactif'));
  if (newosbAnonymizedOnly_()) newosbPseudoSecret_();
  return { origins: origins, accessKey: !!key && key.length >= OBSERVATOIRE_CONFIG.MIN_KEY_LENGTH, anonymizedOnly: newosbAnonymizedOnly_() };
}

/**
 * Cree la cle d'acces (si aucune n'existe) avec une valeur aleatoire de 40 caracteres.
 * La valeur n'est pas journalisee : la lire dans Parametres du projet > Proprietes du script.
 * Remplacer ensuite la valeur dans les proprietes revoque l'ancienne cle pour toutes les nouvelles requetes.
 */
function genererCleAccesObservatoire() {
  // Les fonctions publiques d'un projet Apps Script sont appelables par google.script.run :
  // pour qu'un tiers ne puisse pas remplacer une cle existante, cette fonction ne cree une cle que si aucune n'existe.
  // Pour changer (revoquer) une cle, modifie directement la propriete NEWOSB_ACCESS_KEY.
  if (newosbProp_(OBSERVATOIRE_CONFIG.ACCESS_KEY_PROPERTY)) {
    Logger.log('Une cle existe deja : modifie-la directement dans Parametres du projet > Proprietes du script pour la changer.');
    return { ok: false, exists: true };
  }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now());
  const more = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random());
  bytes.concat(more).slice(0, 40).forEach(function(b) { out += alphabet.charAt(((b % 256) + 256) % alphabet.length); });
  PropertiesService.getScriptProperties().setProperty(OBSERVATOIRE_CONFIG.ACCESS_KEY_PROPERTY, out);
  Logger.log('Nouvelle cle enregistree dans la propriete NEWOSB_ACCESS_KEY (40 caracteres). Consulte-la dans Parametres du projet > Proprietes du script.');
  return { ok: true, length: out.length };
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = String(props.getProperty(OBSERVATOIRE_CONFIG.SPREADSHEET_PROPERTY) || '').trim();
  if (savedId) return SpreadsheetApp.openById(savedId);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('Classeur Google Sheet non initialise. Dans Apps Script, execute une fois la fonction initialiserObservatoire(), puis redeploie.');
  }

  try { props.setProperty(OBSERVATOIRE_CONFIG.SPREADSHEET_PROPERTY, active.getId()); } catch (e) {}
  return active;
}

function normalizeHeader_(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'`´]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreHeaderRow_(values) {
  const normalized = (values || []).map(normalizeHeader_).filter(Boolean);
  if (!normalized.length) return { score: 0, hints: [] };
  const joined = ' | ' + normalized.join(' | ') + ' | ';
  const groups = [
    ['code', [/^code interne$/, /operation code interne/, /code operation/, /id operation/]],
    ['nom', [/nom de l operation/, /nom operation/, /nom du programme/, /^operation$/]],
    ['territoire', [/departement/, /^ville$/, /commune/, /code postal/, /region/]],
    ['referentiel', [/referentiel/]],
    ['moa', [/maitre d ouvrage/, /^moa$/]],
    ['statut', [/evaluation statut/, /statut/, /avancement/, /etape/]],
    ['logements', [/logement/]],
    ['batiments', [/batiment/]],
    ['profil', [/profil specifique/, /profil choisi/]],
    ['energie', [/chauffage/, /ecs/, /cep/, /bbio/, /ubat/, /^dh\b/, /^tic\b/]],
    ['carbone', [/ic energie/, /ic construction/, /ic composants/, /dpe/]]
  ];
  let score = Math.min(30, normalized.length) * 0.25;
  const hints = [];
  groups.forEach(function(group) {
    const key = group[0], patterns = group[1];
    const hit = normalized.some(function(h) { return patterns.some(function(re) { return re.test(h); }); });
    if (hit) { score += (key === 'code' || key === 'nom' ? 8 : 5); hints.push(key); }
  });
  // A real export header row usually contains several long labels and little numeric content.
  const longLabels = normalized.filter(function(h) { return h.length >= 12; }).length;
  const numericOnly = normalized.filter(function(h) { return /^\d+(?:[.,]\d+)?$/.test(h); }).length;
  score += Math.min(8, longLabels * 0.5);
  score -= Math.min(20, numericOnly * 2);
  if (joined.indexOf(' | code interne | ') >= 0 || joined.indexOf(' | operation code interne | ') >= 0) score += 12;
  return { score: score, hints: hints };
}

function detectHeaderMeta_(sheet, lastRow, lastColumn) {
  const scanRows = Math.min(Math.max(1, OBSERVATOIRE_CONFIG.HEADER_SCAN_ROWS || 12), Math.max(1, lastRow));
  const scanCols = Math.min(Math.max(1, lastColumn), 300);
  const matrix = sheet.getRange(1, 1, scanRows, scanCols).getDisplayValues();
  let best = { row: Math.min(OBSERVATOIRE_CONFIG.PREFERRED_HEADER_ROW || 2, scanRows), score: -Infinity, hints: [] };
  matrix.forEach(function(values, index) {
    const scored = scoreHeaderRow_(values);
    let adjusted = scored.score;
    if (index + 1 === OBSERVATOIRE_CONFIG.PREFERRED_HEADER_ROW) adjusted += 1.5;
    if (adjusted > best.score) best = { row: index + 1, score: adjusted, hints: scored.hints };
  });
  return best;
}

function detectFirstDataRow_(sheet, headerRow, lastRow, lastColumn) {
  if (headerRow >= lastRow) return headerRow + 1;
  const start = headerRow + 1;
  const count = Math.min(OBSERVATOIRE_CONFIG.DATA_SCAN_ROWS || 30, lastRow - headerRow);
  const scanCols = Math.min(Math.max(1, lastColumn), 300);
  const headers = sheet.getRange(headerRow, 1, 1, scanCols).getDisplayValues()[0].map(normalizeHeader_);
  const identityColumns = [];
  headers.forEach(function(h, index) {
    if (/^code interne$|operation code interne|code operation|id operation|nom de l operation|nom operation|nom du programme/.test(h)) identityColumns.push(index);
  });
  const matrix = sheet.getRange(start, 1, count, scanCols).getDisplayValues();
  // Prefer a row carrying an operation identifier/name. This avoids treating a
  // note/spacer row just below the headers as the first operation.
  if (identityColumns.length) {
    for (let i = 0; i < matrix.length; i += 1) {
      const row = matrix[i];
      const hasIdentity = identityColumns.some(function(index) { return String(row[index] || '').trim() !== ''; });
      const nonEmpty = row.filter(function(cell) { return String(cell || '').trim() !== ''; }).length;
      if (hasIdentity && nonEmpty >= 3) return start + i;
    }
  }
  for (let i = 0; i < matrix.length; i += 1) {
    const nonEmpty = matrix[i].filter(function(cell) { return String(cell || '').trim() !== ''; }).length;
    if (nonEmpty >= 2) return start + i;
  }
  return start;
}

function getSheetMeta_() {
  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(OBSERVATOIRE_CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Onglet "' + OBSERVATOIRE_CONFIG.SHEET_NAME + '" introuvable.');

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1 || lastRow < 1) {
    return { sheet: sheet, headers: [], lastRow: lastRow, lastColumn: lastColumn, totalRows: 0, headerRow: 1, firstDataRow: 2, headerScore: 0, recognizedHeaderHints: [] };
  }

  const detected = detectHeaderMeta_(sheet, lastRow, lastColumn);
  const headerRow = detected.row;
  const headers = sheet
    .getRange(headerRow, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(function(header) { return String(header || '').trim(); });
  const firstDataRow = detectFirstDataRow_(sheet, headerRow, lastRow, lastColumn);
  const totalRows = Math.max(0, lastRow - firstDataRow + 1);
  return {
    sheet: sheet,
    headers: headers,
    lastRow: lastRow,
    lastColumn: lastColumn,
    totalRows: totalRows,
    headerRow: headerRow,
    firstDataRow: firstDataRow,
    headerScore: Math.round(detected.score * 10) / 10,
    recognizedHeaderHints: detected.hints || []
  };
}

function getRowsChunk_(sheet, meta, offset, limit) {
  if (!meta.totalRows || !meta.lastColumn || offset >= meta.totalRows) {
    return { rows: [], physicalCount: 0 };
  }

  const physicalCount = Math.min(limit, meta.totalRows - offset);
  const startRow = (meta.firstDataRow || 1) + offset;
  const rawRows = sheet.getRange(startRow, 1, physicalCount, meta.lastColumn).getDisplayValues();
  const rows = rawRows.filter(function(row) {
    return row.some(function(cell) { return String(cell || '').trim() !== ''; });
  });
  return { rows: rows, physicalCount: physicalCount };
}

function clampInteger_(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function fetchJson_(url) {
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { Accept: 'application/json,text/plain,*/*' }
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) throw new Error('HTTP ' + status + ' sur ' + url);
  return JSON.parse(response.getContentText('UTF-8'));
}

function handleZone123Proxy_() {
  const errors = [];
  for (let i = 0; i < OBSERVATOIRE_CONFIG.ZONE123_URLS.length; i += 1) {
    const url = OBSERVATOIRE_CONFIG.ZONE123_URLS[i];
    try {
      const json = fetchJson_(url);
      const rows = Array.isArray(json)
        ? json
        : (Array.isArray(json.zone123) ? json.zone123 : (Array.isArray(json.data) ? json.data : []));
      if (!rows.length) throw new Error('Aucune ligne Zone123 trouvee');
      return { ok: true, version: OBSERVATOIRE_CONFIG.VERSION, zone123: rows };
    } catch (error) {
      errors.push(String(error && error.message ? error.message : error));
    }
  }
  return { ok: false, version: OBSERVATOIRE_CONFIG.VERSION, error: 'Referentiel Zone123 indisponible : ' + errors.join(' | ') };
}

function handleCommunesProxy_(params) {
  const allowed = ['nom', 'codePostal', 'codeDepartement', 'fields', 'boost', 'limit', 'format', 'geometry'];
  const query = [];
  allowed.forEach(function(key) {
    const value = params[key];
    if (value === undefined || value === null || String(value) === '') return;
    query.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
  });
  const url = OBSERVATOIRE_CONFIG.COMMUNES_API + (query.length ? '?' + query.join('&') : '');
  try {
    return { ok: true, version: OBSERVATOIRE_CONFIG.VERSION, data: fetchJson_(url) };
  } catch (error) {
    return { ok: false, version: OBSERVATOIRE_CONFIG.VERSION, error: String(error && error.message ? error.message : error) };
  }
}

/**
 * A executer UNE FOIS depuis l'editeur Apps Script apres avoir colle ce code.
 * Cela memorise l'ID du classeur pour les executions Web App.
 */
function initialiserObservatoire() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Ouvre Apps Script depuis le Google Sheet OPERATIONS puis relance initialiserObservatoire().');
  PropertiesService.getScriptProperties().setProperty(OBSERVATOIRE_CONFIG.SPREADSHEET_PROPERTY, ss.getId());
  const sheet = ss.getSheetByName(OBSERVATOIRE_CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Onglet OPERATIONS introuvable.');
  Logger.log('NEWOSB initialise sur le classeur : ' + ss.getName());
  Logger.log('ID : ' + ss.getId());
  Logger.log('OPERATIONS : ' + sheet.getLastRow() + ' lignes / ' + sheet.getLastColumn() + ' colonnes');
  return true;
}

function verifierObservatoire() {
  const meta = getSheetMeta_();
  Logger.log('Version : ' + OBSERVATOIRE_CONFIG.VERSION);
  Logger.log('Onglet : ' + OBSERVATOIRE_CONFIG.SHEET_NAME);
  Logger.log('Ligne en-tetes detectee : ' + meta.headerRow);
  Logger.log('Premiere ligne de donnees detectee : ' + meta.firstDataRow);
  Logger.log('Score en-tetes : ' + meta.headerScore + ' / indices : ' + JSON.stringify(meta.recognizedHeaderHints));
  Logger.log('Lignes physiques detectees : ' + meta.totalRows);
  Logger.log('Colonnes detectees : ' + meta.lastColumn);
  Logger.log('Exemple en-tetes : ' + JSON.stringify(meta.headers.slice(0, 20)));
}

function testerObservatoireConnexion() {
  const ping = newosbApiRequest_({mode:'ping'});
  const meta = newosbApiRequest_({mode:'meta'});
  const chunk = newosbApiRequest_({mode:'chunk', offset:0, limit:500, totalRows:meta.totalRows, lastColumn:meta.lastColumn, firstDataRow:meta.firstDataRow});
  Logger.log(JSON.stringify({ping:ping, meta:{ok:meta.ok,totalRows:meta.totalRows,lastColumn:meta.lastColumn,durationMs:meta.durationMs}, chunk:{ok:chunk.ok,count:chunk.count,durationMs:chunk.durationMs}}));
}

// -----------------------------------------------------------------------------
// NEWOSB V05.22 - Pont direct vers Google Slides (objets natifs editables)
// -----------------------------------------------------------------------------
function newosbCreateGoogleSlides_(spec) {
  if (!spec || !Array.isArray(spec.slides) || !spec.slides.length) {
    throw new Error('Presentation NEWOSB vide ou invalide.');
  }
  const title = String(spec.title || ('NEWOSB - ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Paris', 'yyyy-MM-dd')));
  const presentation = SlidesApp.create(title);
  const slides = presentation.getSlides();
  const first = slides[0];
  newosbClearSlide_(first);
  const logoBlob = newosbDataUrlBlob_(spec.assets && spec.assets.logoData, 'prestaterre.png');

  spec.slides.forEach(function(model, index) {
    const slide = index === 0 ? first : presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    newosbClearSlide_(slide);
    if (String(model.type || '') === 'snapshot') newosbRenderSnapshotSlide_(slide, model);
    else if (String(model.type || '') === 'cover') newosbRenderCoverSlide_(slide, model, logoBlob);
    else newosbRenderContentSlide_(slide, model, logoBlob, index + 1, spec.slides.length);
  });
  return {
    ok: true,
    service: 'NEWOSB GOOGLE SLIDES',
    version: OBSERVATOIRE_CONFIG.VERSION,
    presentationId: presentation.getId(),
    url: presentation.getUrl(),
    title: title,
    slides: spec.slides.length
  };
}


function newosbRenderSnapshotSlide_(slide, model) {
  newosbRect_(slide, 0, 0, 720, 405, '#FFFFFF');
  const blob = newosbDataUrlBlob_(model && model.imageData, 'newosb-slide.jpg');
  if (!blob) {
    newosbText_(slide, 'Le rendu fidèle de cette slide n’a pas pu être transmis.', 60, 165, 600, 60, {size:18,bold:true,color:'#06402B',align:'center'});
    return;
  }
  try { slide.insertImage(blob, 0, 0, 720, 405); }
  catch (e) { newosbText_(slide, 'Erreur de rendu : ' + String(e && e.message || e), 40, 160, 640, 80, {size:12,color:'#B84E4E',align:'center'}); }
}

function newosbClearSlide_(slide) {
  try { slide.getPageElements().forEach(function(el) { try { el.remove(); } catch (e) {} }); } catch (e) {}
}

function newosbDataUrlBlob_(dataUrl, name) {
  const s = String(dataUrl || '');
  const m = s.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  try { return Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name || 'asset'); } catch (e) { return null; }
}

function newosbFont_(font) {
  return String(font || 'Arial').split(',')[0].replace(/["']/g, '').trim() || 'Arial';
}

function newosbText_(slide, text, x, y, w, h, style) {
  style = style || {};
  const shape = slide.insertTextBox(String(text == null ? '' : text), x, y, w, h);
  try { shape.getFill().setTransparent(); } catch (e) {}
  try { shape.getBorder().setTransparent(); } catch (e) {}
  try {
    const range = shape.getText();
    const ts = range.getTextStyle();
    ts.setFontFamily(newosbFont_(style.font || 'Arial'));
    ts.setFontSize(Number(style.size) || 12);
    ts.setForegroundColor(style.color || '#173B2E');
    ts.setBold(Boolean(style.bold));
    if (style.italic) ts.setItalic(true);
    const ps = range.getParagraphStyle();
    if (style.align === 'center') ps.setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
    if (style.align === 'right') ps.setParagraphAlignment(SlidesApp.ParagraphAlignment.END);
    if (style.align === 'left') ps.setParagraphAlignment(SlidesApp.ParagraphAlignment.START);
  } catch (e) {}
  try { if (style.valign === 'middle') shape.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE); } catch (e) {}
  return shape;
}

function newosbRect_(slide, x, y, w, h, fill, radius) {
  const type = radius ? SlidesApp.ShapeType.ROUND_RECTANGLE : SlidesApp.ShapeType.RECTANGLE;
  const shape = slide.insertShape(type, x, y, Math.max(1, w), Math.max(1, h));
  try { shape.getFill().setSolidFill(fill || '#F3F7F5'); } catch (e) {}
  try { shape.getBorder().setTransparent(); } catch (e) {}
  return shape;
}

function newosbLine_(slide, x1, y1, x2, y2, color, weight) {
  const line = slide.insertLine(SlidesApp.LineCategory.STRAIGHT, x1, y1, x2, y2);
  try { line.getLineFill().setSolidFill(color || '#C9D8D1'); } catch (e) {}
  try { line.setWeight(Number(weight) || 1); } catch (e) {}
  return line;
}

function newosbImage_(slide, blob, x, y, w, h) {
  if (!blob) return null;
  try { return slide.insertImage(blob, x, y, w, h); } catch (e) { return null; }
}

function newosbRenderCoverSlide_(slide, model, logoBlob) {
  newosbRect_(slide, 0, 0, 720, 405, '#FFFFFF');
  newosbRect_(slide, 0, 0, 720, 18, '#06402B');
  newosbRect_(slide, 0, 308, 720, 97, '#06402B');
  if (!newosbImage_(slide, logoBlob, 34, 30, 110, 38)) {
    newosbText_(slide, 'PRESTATERRE\nCERTIFICATION', 34, 30, 120, 36, {size:14,bold:true,color:'#06402B'});
  }
  const font = newosbFont_(model.fontFamily);
  newosbText_(slide, String(model.title || 'Observatoire du bâtiment durable'), 44, 148, 555, 72, {font:font,size:Math.max(26,Math.min(46,(Number(model.titleSize)||64)*.62)),bold:true,color:'#06402B'});
  newosbText_(slide, String(model.subtitle || ''), 46, 224, 520, 46, {font:font,size:Math.max(14,Math.min(24,(Number(model.subtitleSize)||28)*.7)),color:'#315D50'});
  newosbText_(slide, String(model.dateText || ''), 500, 256, 165, 30, {font:font,size:Math.max(12,Math.min(20,(Number(model.dateSize)||26)*.68)),bold:true,color:'#111111',align:'right'});
  newosbText_(slide, String(model.footerText || 'Prestaterre Certifications'), 38, 338, 280, 24, {font:font,size:11,bold:true,color:'#FFFFFF'});
  newosbText_(slide, String(model.confidentialText || ''), 518, 338, 152, 24, {font:font,size:10,bold:true,color:'#FFFFFF',align:'right'});
}

function newosbRenderContentSlide_(slide, model, logoBlob, slideNumber, slideCount) {
  newosbRect_(slide, 0, 0, 720, 405, '#FFFFFF');
  if (!newosbImage_(slide, logoBlob, 26, 12, 82, 29)) {
    newosbText_(slide, 'PRESTATERRE', 26, 14, 92, 20, {size:10,bold:true,color:'#06402B'});
  }
  newosbRect_(slide, 126, 19, 3, 51, '#06402B');
  const font = newosbFont_(model.fontFamily);
  newosbText_(slide, String(model.kicker || 'OBSERVATOIRE DU BÂTIMENT DURABLE'), 139, 12, 410, 16, {font:font,size:7.5,bold:true,color:'#648075'});
  newosbText_(slide, String(model.title || 'Slide'), 139, 29, 480, 36, {font:font,size:Math.max(18,Math.min(30,(Number(model.titleSize)||50)*.54)),bold:true,color:'#102D25'});
  newosbText_(slide, String(model.legend || ''), 139, 67, 480, 25, {font:font,size:Math.max(8,Math.min(13,(Number(model.legendSize)||20)*.58)),color:'#315D50'});
  if (String(model.confidentialText || '')) {
    newosbRect_(slide, 624, 12, 70, 20, '#06402B', true);
    newosbText_(slide, String(model.confidentialText), 625, 13, 68, 17, {font:font,size:7,bold:true,color:'#FFFFFF',align:'center',valign:'middle'});
  }
  newosbRenderVisual_(slide, model.visual || {type:'empty'}, 28, 104, 664, 224, font);
  newosbLine_(slide, 28, 340, 692, 340, '#C9D8D1', 1);
  newosbText_(slide, String(model.scope || ''), 28, 347, 455, 38, {font:font,size:8.5,color:'#38544A'});
  newosbText_(slide, String(model.notes || ''), 491, 347, 145, 38, {font:font,size:8.5,color:'#38544A',align:'right'});
  newosbText_(slide, String(slideNumber) + ' / ' + String(slideCount), 646, 381, 46, 12, {font:font,size:7,color:'#7A8882',align:'right'});
}

function newosbRenderVisual_(slide, visual, x, y, w, h, font) {
  const type = String(visual && visual.type || 'list');
  if (type === 'kpi') return newosbRenderKpis_(slide, visual.items || [], x, y, w, h, font);
  if (type === 'bars') return newosbRenderBars_(slide, visual.items || [], x, y, w, h, font);
  if (type === 'line') return newosbRenderLineChart_(slide, visual.series || [], x, y, w, h, font);
  if (type === 'table') return newosbRenderTable_(slide, visual.headers || [], visual.rows || [], x, y, w, h, font);
  if (type === 'tunnel') return newosbRenderTunnel_(slide, visual.items || [], x, y, w, h, font);
  if (type === 'tiles') return newosbRenderTiles_(slide, visual.items || [], x, y, w, h, font);
  if (type === 'gauge') return newosbRenderGauge_(slide, visual, x, y, w, h, font);
  if (type === 'beforeAfter') return newosbRenderBeforeAfter_(slide, visual, x, y, w, h, font);
  if (type === 'flow') return newosbRenderFlow_(slide, visual, x, y, w, h, font);
  if (type === 'dpe') return newosbRenderDpe_(slide, visual.items || [], x, y, w, h, font);
  if (type === 'map') return newosbRenderMap_(slide, visual, x, y, w, h, font);
  return newosbRenderList_(slide, visual.items || [], x, y, w, h, font);
}

function newosbRenderKpis_(slide, items, x, y, w, h, font) {
  const list = (items || []).slice(0, 8);
  if (!list.length) return newosbRenderList_(slide, ['Aucune donnée'], x, y, w, h, font);
  const cols = Math.min(4, list.length), rows = Math.ceil(list.length / cols), gap = 10;
  const cw = (w - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1)) / rows;
  list.forEach(function(it, i) {
    const c = i % cols, r = Math.floor(i / cols), xx = x + c * (cw + gap), yy = y + r * (ch + gap);
    newosbRect_(slide, xx, yy, cw, ch, '#F3F7F5', true);
    newosbText_(slide, String(it.label || ''), xx + 10, yy + 10, cw - 20, 20, {font:font,size:9,bold:true,color:'#557064'});
    newosbText_(slide, String(it.value || '—'), xx + 10, yy + 32, cw - 20, 34, {font:font,size:22,bold:true,color:'#06402B'});
    newosbText_(slide, String(it.note || ''), xx + 10, yy + ch - 30, cw - 20, 22, {font:font,size:8,color:'#73857D'});
  });
}

function newosbRenderBars_(slide, items, x, y, w, h, font) {
  const list = (items || []).slice(0, 15);
  const nums = list.map(function(i) { const n = Number(i.value); return Number.isFinite(n) ? n : 0; });
  const max = Math.max.apply(null, [1].concat(nums));
  const rh = Math.max(12, Math.min(25, h / Math.max(1, list.length)));
  list.forEach(function(it, i) {
    const yy = y + i * rh;
    newosbText_(slide, String(it.label || ''), x, yy + 1, w * .34, rh - 2, {font:font,size:8.5,color:'#244A3E'});
    newosbRect_(slide, x + w*.36, yy + 5, w*.46, Math.max(5,rh-10), '#E7EFEB', true);
    const n = Number(it.value); const ratio = Number.isFinite(n) ? Math.max(.01,n/max) : .08;
    newosbRect_(slide, x + w*.36, yy + 5, w*.46*ratio, Math.max(5,rh-10), '#18845E', true);
    newosbText_(slide, String(it.valueText || it.value || ''), x + w*.83, yy + 1, w*.17, rh - 2, {font:font,size:8.5,bold:true,color:'#173B2E',align:'right'});
  });
}

function newosbRenderLineChart_(slide, series, x, y, w, h, font) {
  const list = (series || []).slice(0, 10);
  const years = {};
  let max = 1;
  list.forEach(function(s) { (s.points || []).forEach(function(p) { years[String(p.x)] = true; max = Math.max(max, Number(p.y)||0); }); });
  const cats = Object.keys(years).sort();
  if (!cats.length) return newosbRenderList_(slide, ['Aucune série exploitable'], x, y, w, h, font);
  const colors = ['#06402B','#18845E','#2C6E9B','#D18B2C','#8055A2','#B84E4E','#579A37','#257C83','#B45C8A','#65707A'];
  const chartX=x+36, chartY=y+14, chartW=w-50, chartH=h-52;
  for (let g=0;g<=4;g+=1) {
    const yy=chartY+chartH-chartH*g/4;newosbLine_(slide,chartX,yy,chartX+chartW,yy,'#E2EAE6',.7);
    newosbText_(slide,String(Math.round(max*g/4)),x,yy-6,30,12,{font:font,size:7,color:'#74867F',align:'right'});
  }
  cats.forEach(function(cat,i){const xx=cats.length===1?chartX+chartW/2:chartX+i*chartW/(cats.length-1);newosbText_(slide,cat,xx-18,chartY+chartH+5,36,12,{font:font,size:7,color:'#667B72',align:'center'});});
  list.forEach(function(s,si){
    const map={};(s.points||[]).forEach(function(p){map[String(p.x)]=Number(p.y)||0;});let prev=null;
    cats.forEach(function(cat,i){const xx=cats.length===1?chartX+chartW/2:chartX+i*chartW/(cats.length-1),v=map[cat]||0,yy=chartY+chartH-(v/max)*chartH;if(prev)newosbLine_(slide,prev.x,prev.y,xx,yy,colors[si%colors.length],2);newosbRect_(slide,xx-2.5,yy-2.5,5,5,colors[si%colors.length],true);prev={x:xx,y:yy};});
    const lx=x+(si%5)*(w/5), ly=y+h-18+Math.floor(si/5)*11;newosbRect_(slide,lx,ly+2,7,7,colors[si%colors.length],true);newosbText_(slide,String(s.name||''),lx+10,ly,w/5-12,11,{font:font,size:6.8,color:'#40594F'});
  });
}

function newosbRenderTable_(slide, headers, rows, x, y, w, h, font) {
  let cols = Math.max((headers||[]).length, (rows[0]||[]).length, 1); cols = Math.min(cols, 9);
  const body = (rows||[]).slice(0,15).map(function(r){return r.slice(0,cols);});
  const head = (headers||[]).slice(0,cols);
  const totalRows = body.length + (head.length ? 1 : 0);
  if (!totalRows) return newosbRenderList_(slide,['Aucune ligne'],x,y,w,h,font);
  const table=slide.insertTable(totalRows,cols,x,y,w,h);
  let rr=0;
  if(head.length){head.forEach(function(v,c){const cell=table.getCell(0,c);cell.getText().setText(String(v||''));try{cell.getFill().setSolidFill('#06402B');}catch{};try{cell.getText().getTextStyle().setFontFamily(font).setFontSize(7.2).setForegroundColor('#FFFFFF').setBold(true);}catch{}});rr=1;}
  body.forEach(function(row,r){for(let c=0;c<cols;c+=1){const cell=table.getCell(r+rr,c);cell.getText().setText(String(row[c]||''));try{cell.getFill().setSolidFill(r%2?'#F7FAF8':'#FFFFFF');}catch{};try{cell.getText().getTextStyle().setFontFamily(font).setFontSize(6.8).setForegroundColor('#244A3E');}catch{}}});
}

function newosbRenderTunnel_(slide, items, x, y, w, h, font) {
  const list=(items||[]).slice(0,8), gap=7, cw=(w-gap*Math.max(0,list.length-1))/Math.max(1,list.length);
  list.forEach(function(it,i){const xx=x+i*(cw+gap);newosbRect_(slide,xx,y+22,cw,h-44,i===list.length-1?'#06402B':'#EAF2EE',true);newosbText_(slide,String(it.label||''),xx+5,y+32,cw-10,40,{font:font,size:7.5,bold:true,color:i===list.length-1?'#FFFFFF':'#38544A',align:'center'});newosbText_(slide,String(it.value||''),xx+5,y+79,cw-10,34,{font:font,size:20,bold:true,color:i===list.length-1?'#FFFFFF':'#06402B',align:'center'});newosbText_(slide,String(it.note||''),xx+5,y+h-55,cw-10,28,{font:font,size:6.7,color:i===list.length-1?'#DDEBE5':'#70827A',align:'center'});});
}

function newosbRenderTiles_(slide, items, x, y, w, h, font) {
  const list=(items||[]).slice(0,15), cols=list.length<=4?2:(list.length<=9?3:5), rows=Math.ceil(list.length/cols), gap=8, cw=(w-gap*(cols-1))/cols, ch=(h-gap*(rows-1))/Math.max(1,rows);
  list.forEach(function(it,i){const c=i%cols,r=Math.floor(i/cols),xx=x+c*(cw+gap),yy=y+r*(ch+gap);newosbRect_(slide,xx,yy,cw,ch,'#F2F7F4',true);newosbText_(slide,String(it.label||''),xx+8,yy+8,cw-16,Math.max(18,ch*.34),{font:font,size:8,bold:true,color:'#315D50'});newosbText_(slide,String(it.value||''),xx+8,yy+ch*.43,cw-16,24,{font:font,size:16,bold:true,color:'#06402B'});newosbText_(slide,String(it.note||''),xx+8,yy+ch-24,cw-16,18,{font:font,size:6.5,color:'#75857E'});});
}

function newosbRenderGauge_(slide, v, x, y, w, h, font) {
  newosbText_(slide,String(v.left||''),x+20,y+35,w*.25,20,{font:font,size:9,color:'#61756C'});
  newosbText_(slide,String(v.right||''),x+w*.62,y+35,w*.34,20,{font:font,size:9,color:'#61756C',align:'right'});
  newosbRect_(slide,x+40,y+85,w-80,26,'#E6EFEA',true);newosbRect_(slide,x+40,y+85,(w-80)*.62,26,'#79A98F',true);
  newosbRect_(slide,x+40+(w-80)*.60,y+77,5,42,'#06402B',true);
  newosbText_(slide,String(v.label||''),x+80,y+130,w-160,22,{font:font,size:10,bold:true,color:'#315D50',align:'center'});
  newosbText_(slide,String(v.value||''),x+80,y+153,w-160,34,{font:font,size:22,bold:true,color:'#06402B',align:'center'});
  newosbText_(slide,String(v.note||''),x+70,y+188,w-140,28,{font:font,size:8,color:'#6C7F76',align:'center'});
}

function newosbRenderBeforeAfter_(slide, v, x, y, w, h, font) {
  const list=(v.items||[]).slice(0,2);list.forEach(function(it,i){const yy=y+28+i*72;newosbText_(slide,String(it.label||''),x+20,yy,w*.33,24,{font:font,size:10,bold:true,color:'#315D50'});newosbText_(slide,String(it.value||''),x+w*.36,yy,w*.22,24,{font:font,size:15,bold:true,color:'#06402B'});newosbRect_(slide,x+w*.58,yy+5,w*.34,14,'#E6EFEA',true);newosbRect_(slide,x+w*.58,yy+5,w*.34*(i===0?.9:.6),14,i===0?'#9FB8AD':'#18845E',true);});newosbText_(slide,String(v.note||''),x+20,y+h-45,w-40,28,{font:font,size:9,color:'#61756C',align:'center'});
}

function newosbRenderFlow_(slide, v, x, y, w, h, font) {
  const before=(v.before||[]).slice(0,8),after=(v.after||[]).slice(0,8),rows=Math.max(before.length,after.length,1),rh=Math.min(24,(h-20)/rows);
  newosbText_(slide,'AVANT',x,y,w*.28,16,{font:font,size:8,bold:true,color:'#648075'});newosbText_(slide,'APRÈS',x+w*.72,y,w*.28,16,{font:font,size:8,bold:true,color:'#648075',align:'right'});
  before.forEach(function(it,i){const yy=y+22+i*rh;newosbRect_(slide,x,yy,w*.30,rh-3,'#EDF4F0',true);newosbText_(slide,String(it.label||'')+'  '+String(it.value||''),x+6,yy+2,w*.30-12,rh-6,{font:font,size:7.2,color:'#315D50'});});
  after.forEach(function(it,i){const yy=y+22+i*rh;newosbRect_(slide,x+w*.70,yy,w*.30,rh-3,'#E7F2EC',true);newosbText_(slide,String(it.label||'')+'  '+String(it.value||''),x+w*.70+6,yy+2,w*.30-12,rh-6,{font:font,size:7.2,color:'#315D50',align:'right'});});
  const links=Math.min(before.length,after.length);for(let i=0;i<links;i+=1){const yy=y+22+i*rh+(rh-3)/2;newosbLine_(slide,x+w*.30,yy,x+w*.70,yy,'#79A98F',1.4);}
}

function newosbRenderDpe_(slide, items, x, y, w, h, font) {
  const list=(items||[]).slice(0,7),max=Math.max.apply(null,[1].concat(list.map(function(i){return Math.max(Number(i.before)||0,Number(i.after)||0);}))),rh=h/Math.max(1,list.length);
  list.forEach(function(it,i){const yy=y+i*rh;newosbText_(slide,String(it.label||''),x,yy,w*.08,rh-2,{font:font,size:10,bold:true,color:'#173B2E',align:'center'});const b=Number(it.before)||0,a=Number(it.after)||0;newosbRect_(slide,x+w*.10,yy+4,w*.34,rh*.28,'#E5ECE8',true);newosbRect_(slide,x+w*.10,yy+4,w*.34*(b/max),rh*.28,'#9BAEA6',true);newosbRect_(slide,x+w*.50,yy+4,w*.34,rh*.28,'#E5ECE8',true);newosbRect_(slide,x+w*.50,yy+4,w*.34*(a/max),rh*.28,'#18845E',true);newosbText_(slide,String(it.before||''),x+w*.45,yy+1,w*.04,rh*.3,{font:font,size:7,color:'#61756C',align:'right'});newosbText_(slide,String(it.after||''),x+w*.85,yy+1,w*.04,rh*.3,{font:font,size:7,color:'#06402B',align:'right'});});
}

function newosbRenderMap_(slide, v, x, y, w, h, font) {
  newosbRect_(slide,x,y,w,h,'#F3F7F5',true);newosbRect_(slide,x+18,y+18,w*.63,h-36,'#E5EEE9',true);
  const labels=(v.labels||[]).slice(0,15);labels.forEach(function(label,i){const col=i%3,row=Math.floor(i/3),xx=x+34+col*(w*.18),yy=y+40+row*30;newosbText_(slide,String(label),xx,yy,w*.16,18,{font:font,size:7.2,bold:true,color:'#315D50',align:'center'});newosbRect_(slide,xx+w*.07,yy+18,6,6,'#18845E',true);});
  newosbText_(slide,'Répartition territoriale',x+w*.70,y+28,w*.26,20,{font:font,size:10,bold:true,color:'#06402B'});newosbText_(slide,'Carte reconstruite dans Google Slides avec des objets natifs. Les libellés territoriaux et marqueurs restent modifiables.',x+w*.70,y+56,w*.26,h-80,{font:font,size:8,color:'#61756C'});
}

function newosbRenderList_(slide, items, x, y, w, h, font) {
  const list=(items||[]).slice(0,22);if(!list.length)list.push('Aucun contenu exploitable.');const rh=Math.min(18,h/Math.max(1,list.length));list.forEach(function(item,i){newosbRect_(slide,x,y+i*rh+2,5,5,'#18845E',true);newosbText_(slide,String(item),x+12,y+i*rh,w-12,rh,{font:font,size:8,color:'#315D50'});});
}

/** A executer une fois apres deploiement pour autoriser SlidesApp. */
function testerGoogleSlides() {
  const p = SlidesApp.create('NEWOSB - test autorisation Google Slides');
  Logger.log('Google Slides OK : ' + p.getUrl());
  return p.getUrl();
}
