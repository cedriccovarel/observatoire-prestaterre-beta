/**
 * PRESTATERRE OBSERVATOIRE - V6.17 (script OPERATIONS, version API 06.17)
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
 * Changements V6.17 : les Exigences (onglet RAPPORT) sont servies par ce script avec la meme cle
 *   (modes reqmeta / reqchunk) : une seule URL et une seule cle pour charger l'Observatoire.
 *   RAPPORT dans un autre classeur : propriete NEWOSB_RAPPORT_SPREADSHEET_ID.
 *
 * Changements V6.15 : liens de partage a duree limitee (onglet masque OBSERVATOIRE_PARTAGES cree
 *   automatiquement). Un lien ne donne acces qu'aux operations de son perimetre, jusqu'a sa date
 *   d'expiration ; il est revocable a tout moment depuis l'Observatoire. Voir newosbShareAdmin_.
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
  VERSION: '06.17',
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
    // V6.15 : lien de partage. Le jeton remplace la cle et limite les donnees au perimetre fige.
    if (input.share !== undefined && input.share !== null && String(input.share) !== '') {
      if (input.key) return { ok: false, authError: true, service: 'NEWOSB OPERATIONS', version: OBSERVATOIRE_CONFIG.VERSION, error: 'Requete refusee : cle et lien de partage fournis ensemble.' };
      const shareAccess = newosbShareAccess_(input.share);
      if (!shareAccess.ok) return { ok: false, authError: true, shareError: true, expired: !!shareAccess.expired, expiresAt: shareAccess.expiresAt || null, service: 'NEWOSB OPERATIONS', version: OBSERVATOIRE_CONFIG.VERSION, error: shareAccess.error };
      const shareParams = {};
      Object.keys(input).forEach(function(k) { if (k !== 'share') shareParams[k] = input[k]; });
      return newosbShareRequest_(shareAccess, shareParams);
    }
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

  // V6.17 : les Exigences (onglet RAPPORT) se chargent avec la meme URL et la meme cle qu'OPERATIONS.
  if (mode === 'reqmeta' || mode === 'reqchunk') {
    return newosbRapportRequest_(params, mode, { anonymized: newosbAnonymizedOnly_() });
  }

  if (mode === 'sharecreate' || mode === 'sharelist' || mode === 'sharerevoke' || mode === 'shareextend') {
    return newosbShareAdmin_(mode, params);
  }

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
<body><div class="wrap"><div class="card"><div class="brand">Observatoire V${OBSERVATOIRE_CONFIG.VERSION}</div><div class="title"><span class="dot"></span>Connexion Google OPERATIONS</div><div class="status" id="status">Connexion au classeur en cours... Cette fenetre se fermera automatiquement.</div><div class="small">Laisse cette fenetre ouverte pendant le chargement. Si Google demande une autorisation, valide-la ici.</div></div></div>
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

// -----------------------------------------------------------------------------
// V6.15 - Liens de partage a duree limitee
// -----------------------------------------------------------------------------
// Un lien de partage donne acces, sans la cle d'acces, a un perimetre fige d'operations
// (liste des codes internes calculee par l'Observatoire au moment de la creation).
// Le controle est fait ici, cote serveur, a chaque requete : jeton connu, non revoque, non expire.
// Seules les lignes du perimetre sont lues et transmises ; un lien « anonymise » recoit des
// donnees pseudonymisees par le serveur. Le jeton n'est jamais stocke : seule son empreinte
// SHA-256 est conservee dans l'onglet masque OBSERVATOIRE_PARTAGES.
const NEWOSB_SHARE_CONFIG = {
  SHEET: 'OBSERVATOIRE_PARTAGES',
  HEADERS: ['Identifiant', 'Empreinte du jeton', 'Nom', 'Cree le (ms)', 'Expire le (ms)', 'Revoque le (ms)', 'Onglets', 'Anonymise', 'Colonne code', 'Perimetre', 'Operations', 'Dernier acces (ms)', "Nombre d'acces", "Page d'ouverture", 'Filtres exigences'],
  CODE_CELLS: 8,
  CODE_CELL_CHARS: 45000,
  MAX_CODES: 20000,
  MIN_MINUTES: 60,
  MAX_DAYS: 366,
  TABS: ['overview', 'territories', 'stakeholders', 'certification', 'performance', 'requirements', 'solutions', 'energy', 'carbon', 'crossdata', 'operations', 'quality', 'dictionary'],
  RAPPORT_PROPERTY: 'NEWOSB_RAPPORT_SPREADSHEET_ID',
  REQ_FILTER_KEYS: ['year', 'referential', 'moaGroup', 'status', 'moa', 'region', 'department', 'profile', 'socialZone', 'period', 'nature', 'mention', 'moaSector', 'theme'],
  REQ_PRIVATE_KEYS: ['moa', 'moaGroup'],
  FAILURE_LIMIT: 60
};

function newosbShareColumns_() {
  const out = NEWOSB_SHARE_CONFIG.HEADERS.slice();
  for (let i = 1; i <= NEWOSB_SHARE_CONFIG.CODE_CELLS; i++) out.push('Codes ' + i);
  return out;
}

function newosbShareSheet_(create) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(NEWOSB_SHARE_CONFIG.SHEET);
  if (!sheet && create) {
    sheet = ss.insertSheet(NEWOSB_SHARE_CONFIG.SHEET);
    const cols = newosbShareColumns_();
    sheet.getRange(1, 1, 1, cols.length).setNumberFormat('@').setValues([cols]);
    try { sheet.hideSheet(); } catch (e) {}
    try { sheet.protect().setDescription('Liens de partage de l Observatoire (gere par le script)').setWarningOnly(true); } catch (e) {}
  }
  return sheet || null;
}

function newosbShareHash_(token) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'newosb-share|' + String(token || ''));
  return bytes.map(function(b) { const h = ((b + 256) % 256).toString(16); return h.length < 2 ? '0' + h : h; }).join('');
}

function newosbShareNewToken_() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const a = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now());
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random());
  let out = '';
  a.concat(b).slice(0, 43).forEach(function(x) { out += alphabet.charAt(((x % 256) + 256) % alphabet.length); });
  return out;
}

function newosbShareNormCode_(value) {
  return String(value == null ? '' : value).replace(/[​-‍﻿]/g, '').replace(/[ \s]+/g, ' ').trim().toUpperCase();
}

// Texte libre ecrit dans la feuille : jamais interprete comme une formule.
function newosbShareText_(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/^[=+\-@\s]+/, '').slice(0, max);
}

function newosbShareRecords_(sheet) {
  if (!sheet) return [];
  const last = sheet.getLastRow();
  const width = NEWOSB_SHARE_CONFIG.HEADERS.length;
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, width).getValues().map(function(r, i) {
    return {
      row: i + 2,
      id: String(r[0] || ''),
      hash: String(r[1] || ''),
      label: String(r[2] || ''),
      createdAt: Number(r[3]) || 0,
      expiresAt: Number(r[4]) || 0,
      revokedAt: Number(r[5]) || 0,
      tabs: String(r[6] || '').split(',').filter(function(t) { return NEWOSB_SHARE_CONFIG.TABS.indexOf(t) >= 0; }),
      anonymized: String(r[7]) === '1',
      codeHeader: String(r[8] || ''),
      summary: String(r[9] || ''),
      operationCount: Number(r[10]) || 0,
      lastAccessAt: Number(r[11]) || 0,
      accessCount: Number(r[12]) || 0,
      landing: String(r[13] || ''),
      reqFilters: newosbShareParseReqFilters_(r[14])
    };
  }).filter(function(rec) { return rec.id && rec.hash; });
}

function newosbShareCodes_(sheet, rec) {
  const start = NEWOSB_SHARE_CONFIG.HEADERS.length + 1;
  const parts = sheet.getRange(rec.row, start, 1, NEWOSB_SHARE_CONFIG.CODE_CELLS).getValues()[0];
  const text = parts.map(function(p) { return String(p || '').replace(/^~/, ''); }).join('');
  if (!text) return [];
  const list = JSON.parse(text);
  return Array.isArray(list) ? list.map(newosbShareNormCode_).filter(Boolean) : [];
}

function newosbShareStatus_(rec, now) {
  if (rec.revokedAt) return 'revoked';
  if (!rec.expiresAt || rec.expiresAt <= now) return 'expired';
  return 'active';
}

function newosbSharePublic_(rec, now) {
  return {
    id: rec.id, label: rec.label, createdAt: rec.createdAt, expiresAt: rec.expiresAt, revokedAt: rec.revokedAt,
    status: newosbShareStatus_(rec, now), tabs: rec.tabs, anonymized: rec.anonymized || newosbAnonymizedOnly_(),
    summary: rec.summary, operationCount: rec.operationCount, lastAccessAt: rec.lastAccessAt, accessCount: rec.accessCount, landing: rec.landing
  };
}

function newosbShareExpiry_(value, now) {
  const t = Number(value);
  if (!Number.isFinite(t)) throw new Error("Date d'expiration invalide.");
  if (t < now + NEWOSB_SHARE_CONFIG.MIN_MINUTES * 60000) throw new Error("La date d'expiration doit etre au moins une heure apres maintenant.");
  if (t > now + NEWOSB_SHARE_CONFIG.MAX_DAYS * 86400000) throw new Error("Duree maximale d'un lien : " + NEWOSB_SHARE_CONFIG.MAX_DAYS + ' jours.');
  return Math.round(t);
}

function newosbShareLock_() {
  try { const lock = LockService.getScriptLock(); if (lock.tryLock(10000)) return lock; } catch (e) {}
  return null;
}

// Administration (cle d'acces deja verifiee par newosbBridgeRequest).
function newosbShareAdmin_(mode, params) {
  const now = Date.now();
  if (mode === 'sharelist') {
    return { ok: true, service: 'NEWOSB OPERATIONS', version: OBSERVATOIRE_CONFIG.VERSION, now: now, anonymizedOnly: newosbAnonymizedOnly_(), shares: newosbShareRecords_(newosbShareSheet_(false)).map(function(r) { return newosbSharePublic_(r, now); }).reverse() };
  }
  if (mode === 'sharecreate') {
    const tabs = (Array.isArray(params.tabs) ? params.tabs : []).map(String).filter(function(t, i, all) { return NEWOSB_SHARE_CONFIG.TABS.indexOf(t) >= 0 && all.indexOf(t) === i; });
    if (!tabs.length) throw new Error('Choisis au moins un onglet a partager.');
    const codes = (Array.isArray(params.codes) ? params.codes : []).map(newosbShareNormCode_).filter(function(c, i, all) { return c && c.length <= 80 && all.indexOf(c) === i; });
    if (!codes.length) throw new Error("Le perimetre ne contient aucune operation avec un code interne : rien a partager.");
    if (codes.length > NEWOSB_SHARE_CONFIG.MAX_CODES) throw new Error('Perimetre trop large (' + codes.length + ' operations, maximum ' + NEWOSB_SHARE_CONFIG.MAX_CODES + ').');
    const meta = getSheetMeta_();
    const codeHeader = String(params.codeHeader || '');
    if (newosbShareCodeIndex_(meta.headers, codeHeader) < 0) throw new Error('Colonne du code interne introuvable dans OPERATIONS : ' + codeHeader);
    const json = JSON.stringify(codes);
    const size = NEWOSB_SHARE_CONFIG.CODE_CELL_CHARS;
    if (json.length > size * NEWOSB_SHARE_CONFIG.CODE_CELLS) throw new Error('Perimetre trop volumineux pour un lien.');
    const slices = [];
    for (let i = 0; i < NEWOSB_SHARE_CONFIG.CODE_CELLS; i++) { const s = json.slice(i * size, (i + 1) * size); slices.push(s ? '~' + s : ''); }
    const token = newosbShareNewToken_();
    const hash = newosbShareHash_(token);
    const id = hash.slice(0, 10);
    const expiresAt = newosbShareExpiry_(params.expiresAt, now);
    const anonymized = !!params.anonymized || newosbAnonymizedOnly_();
    const landing = tabs.indexOf(String(params.landing || '')) >= 0 ? String(params.landing) : tabs[0];
    if (tabs.indexOf('requirements') >= 0) newosbRapportContext_();
    const reqFilters = tabs.indexOf('requirements') >= 0 ? newosbShareCleanReqFilters_(params.reqFilters, anonymized) : {};
    const label = newosbShareText_(params.label, 120) || 'Observatoire partage';
    const summary = newosbShareText_(params.summary, 2000);
    const row = [id, hash, label, String(now), String(expiresAt), '', tabs.join(','), anonymized ? '1' : '0', codeHeader, summary, String(codes.length), '', '0', landing, '~' + JSON.stringify(reqFilters)].concat(slices);
    const lock = newosbShareLock_();
    try {
      const sheet = newosbShareSheet_(true);
      const target = sheet.getLastRow() + 1;
      sheet.getRange(target, 1, 1, row.length).setNumberFormat('@').setValues([row]);
    } finally { if (lock) lock.releaseLock(); }
    const rec = { id: id, label: label, createdAt: now, expiresAt: expiresAt, revokedAt: 0, tabs: tabs, anonymized: anonymized, summary: summary, operationCount: codes.length, lastAccessAt: 0, accessCount: 0, landing: landing, reqFilters: reqFilters };
    // Le jeton n'est renvoye qu'une fois, a la creation ; seule son empreinte est conservee.
    return { ok: true, service: 'NEWOSB OPERATIONS', version: OBSERVATOIRE_CONFIG.VERSION, token: token, share: newosbSharePublic_(rec, now) };
  }
  if (mode === 'sharerevoke' || mode === 'shareextend') {
    const id = String(params.id || '');
    const lock = newosbShareLock_();
    try {
      const sheet = newosbShareSheet_(false);
      const rec = newosbShareRecords_(sheet).filter(function(r) { return r.id === id; })[0];
      if (!rec) throw new Error('Lien de partage introuvable.');
      if (mode === 'sharerevoke') { if (!rec.revokedAt) { rec.revokedAt = now; sheet.getRange(rec.row, 6).setNumberFormat('@').setValue(String(now)); } }
      else {
        if (rec.revokedAt) throw new Error('Un lien revoque ne peut pas etre prolonge : cree un nouveau lien.');
        rec.expiresAt = newosbShareExpiry_(params.expiresAt, now);
        sheet.getRange(rec.row, 5).setNumberFormat('@').setValue(String(rec.expiresAt));
      }
      return { ok: true, service: 'NEWOSB OPERATIONS', version: OBSERVATOIRE_CONFIG.VERSION, share: newosbSharePublic_(rec, now) };
    } finally { if (lock) lock.releaseLock(); }
  }
  throw new Error('Action de partage inconnue.');
}

// Verification d'un jeton de partage (aucune cle d'acces).
function newosbShareAccess_(token) {
  const text = String(token || '');
  if (!/^[A-Za-z0-9]{32,64}$/.test(text)) return { ok: false, error: 'Lien de partage invalide.' };
  try { if (Number(CacheService.getScriptCache().get('newosb_share_failures') || 0) >= NEWOSB_SHARE_CONFIG.FAILURE_LIMIT) return { ok: false, error: 'Trop de tentatives avec des liens invalides : reessaie dans quelques minutes.' }; } catch (e) {}
  const hash = newosbShareHash_(text);
  const sheet = newosbShareSheet_(false);
  const rec = newosbShareRecords_(sheet).filter(function(r) { return newosbSafeEqual_(r.hash, hash); })[0];
  if (!rec) {
    try { const c = CacheService.getScriptCache(); c.put('newosb_share_failures', String(Number(c.get('newosb_share_failures') || 0) + 1), 600); } catch (e) {}
    return { ok: false, error: 'Lien de partage invalide ou supprime.' };
  }
  const status = newosbShareStatus_(rec, Date.now());
  if (status === 'revoked') return { ok: false, error: 'Ce lien de partage a ete revoque.' };
  if (status === 'expired') return { ok: false, expired: true, expiresAt: rec.expiresAt, error: 'Ce lien de partage a expire.' };
  return { ok: true, sheet: sheet, record: rec };
}

// Index de la colonne du code interne ; « Nom [2] » designe la 2e occurrence d'un en-tete en double
// (convention de l'Observatoire : la derniere occurrence garde le nom simple).
function newosbShareCodeIndex_(headers, codeHeader) {
  const list = (headers || []).map(function(h) { return String(h || '').trim(); });
  const name = String(codeHeader || '').trim();
  if (!name) return -1;
  const m = name.match(/^(.*) \[(\d+)\]$/);
  if (m) {
    let seen = 0;
    for (let i = 0; i < list.length; i++) if (list[i] === m[1]) { seen += 1; if (seen === Number(m[2])) return i; }
  }
  return list.lastIndexOf(name);
}

function newosbShareMatches_(access, meta) {
  const rec = access.record;
  const col = newosbShareCodeIndex_(meta.headers, rec.codeHeader);
  if (col < 0) throw new Error('Colonne du code interne introuvable : le lien ne peut plus etre lu. Cree un nouveau lien.');
  const wanted = {};
  newosbShareCodes_(access.sheet, rec).forEach(function(c) { wanted[c] = true; });
  if (!meta.totalRows) return [];
  const values = meta.sheet.getRange(meta.firstDataRow, col + 1, meta.totalRows, 1).getDisplayValues();
  const rows = [];
  values.forEach(function(v, i) { if (wanted[newosbShareNormCode_(v[0])]) rows.push(meta.firstDataRow + i); });
  return rows;
}

function newosbShareInfo_(rec) {
  const anonymized = rec.anonymized || newosbAnonymizedOnly_();
  return { label: rec.label, createdAt: rec.createdAt, expiresAt: rec.expiresAt, tabs: rec.tabs, landing: rec.landing, anonymized: anonymized, summary: rec.summary, operationCount: rec.operationCount, reqFilters: rec.tabs.indexOf('requirements') >= 0 ? newosbShareCleanReqFilters_(rec.reqFilters, anonymized) : {} };
}

// Filtres de l'onglet Exigences figes a la creation (appliques par le navigateur, a l'interieur des
// lignes deja limitees au perimetre). Pour un lien anonymise, jamais de nom de MOA ou de groupe.
function newosbShareCleanReqFilters_(value, anonymized) {
  const out = {};
  const src = value && typeof value === 'object' ? value : {};
  NEWOSB_SHARE_CONFIG.REQ_FILTER_KEYS.forEach(function(k) {
    if (anonymized && NEWOSB_SHARE_CONFIG.REQ_PRIVATE_KEYS.indexOf(k) >= 0) return;
    const list = Array.isArray(src[k]) ? src[k].map(function(v) { return String(v == null ? '' : v).slice(0, 200); }).filter(Boolean).slice(0, 300) : [];
    if (list.length) out[k] = list;
  });
  return out;
}

function newosbShareParseReqFilters_(cell) {
  try { return JSON.parse(String(cell || '').replace(/^~/, '') || '{}') || {}; } catch (e) { return {}; }
}

// Classeur contenant l'onglet RAPPORT : propriete NEWOSB_RAPPORT_SPREADSHEET_ID (identifiant ou URL),
// sinon le classeur OPERATIONS s'il contient un onglet RAPPORT.
function newosbRapportSpreadsheet_() {
  const raw = newosbProp_(NEWOSB_SHARE_CONFIG.RAPPORT_PROPERTY);
  if (raw) {
    const m = raw.match(/\/d\/([A-Za-z0-9_-]{20,})/);
    return SpreadsheetApp.openById(m ? m[1] : raw);
  }
  const ss = getSpreadsheet_();
  if (ss.getSheetByName(NEWOSB_EXIGENCES_CONFIG.SHEET_NAME)) return ss;
  throw new Error("Exigences : renseigne la propriete NEWOSB_RAPPORT_SPREADSHEET_ID (identifiant du classeur qui contient l'onglet RAPPORT) dans le projet Apps Script OPERATIONS.");
}

function newosbRapportContext_() {
  return newosbExigencesContext_(newosbRapportSpreadsheet_());
}

// Lignes RAPPORT du perimetre d'un lien (rattachement par code interne d'operation).
function newosbShareRapport_(access, params, mode) {
  const rec = access.record;
  const wanted = {};
  newosbShareCodes_(access.sheet, rec).forEach(function(c) { wanted[c] = true; });
  const out = newosbRapportRequest_(params, mode, { wanted: wanted, anonymized: rec.anonymized || newosbAnonymizedOnly_() });
  out.shared = true;
  return out;
}

// Lecture de RAPPORT par blocs (reqmeta / reqchunk). options.wanted : codes d'operation autorises
// (lien de partage) ; sans options.wanted, tout RAPPORT (acces avec la cle OPERATIONS).
function newosbRapportRequest_(params, mode, options) {
  const opts = options || {};
  const base = { ok: true, service: NEWOSB_EXIGENCES_CONFIG.SERVICE, version: OBSERVATOIRE_CONFIG.VERSION, via: 'NEWOSB OPERATIONS' };
  const ctx = newosbRapportContext_();
  let matches = null;
  if (opts.wanted) {
    if (ctx.cols.operationCode < 0) throw new Error("Colonne « Evaluation: Operation: Code interne » absente de RAPPORT : les exigences ne peuvent pas etre rattachees aux operations partagees.");
    const values = ctx.sheet.getRange(NEWOSB_EXIGENCES_CONFIG.FIRST_DATA_ROW, ctx.cols.operationCode + 1, ctx.rowCount, 1).getDisplayValues();
    matches = [];
    values.forEach(function(v, i) { if (opts.wanted[newosbShareNormCode_(v[0])]) matches.push(i); });
  }
  const total = matches ? matches.length : ctx.rowCount;
  if (mode === 'reqmeta') {
    base.rowCount = total;
    base.chunkSize = NEWOSB_EXIGENCES_CONFIG.CHUNK_SIZE;
    base.warnings = ctx.warnings;
    return base;
  }
  const offset = clampInteger_(params.offset, 0, total, 0);
  const limit = clampInteger_(params.limit, 1, NEWOSB_EXIGENCES_CONFIG.MAX_CHUNK_SIZE, NEWOSB_EXIGENCES_CONFIG.CHUNK_SIZE);
  let rows = [], physical = 0;
  if (matches) {
    const slice = matches.slice(offset, offset + limit);
    physical = slice.length;
    if (slice.length) {
      const keep = {};
      slice.forEach(function(i) { keep[NEWOSB_EXIGENCES_CONFIG.FIRST_DATA_ROW + i] = true; });
      rows = newosbExigencesRows_(ctx, slice[0], slice[slice.length - 1] - slice[0] + 1).filter(function(r) { return keep[r.sourceRow]; });
    }
  } else {
    physical = Math.max(0, Math.min(limit, total - offset));
    rows = newosbExigencesRows_(ctx, offset, limit);
  }
  if (opts.anonymized) {
    const secret = newosbPseudoSecret_();
    rows = rows.map(function(r) {
      const out = {};
      Object.keys(r).forEach(function(k) { out[k] = r[k]; });
      out.moa = r.moa ? newosbPseudonym_('MOA', r.moa, secret) : '';
      out.group = r.group ? newosbPseudonym_('Groupe', r.group, secret) : '';
      out.operationCode = r.operationCode ? newosbPseudonym_('OP', r.operationCode, secret) : '';
      out.evaluationCode = newosbPseudonym_('EVA', r.evaluationCode, secret);
      out.rowCode = r.rowCode ? newosbPseudonym_('ROW', r.rowCode, secret) : '';
      return out;
    });
  }
  base.offset = offset; base.count = rows.length; base.physicalCount = physical; base.done = offset + physical >= total; base.rows = rows;
  return base;
}

// Requetes autorisees avec un jeton de partage : ping, meta, chunk (lignes du perimetre uniquement), zonage et communes.
function newosbShareRequest_(access, params) {
  const started = Date.now();
  const rec = access.record;
  const mode = String(params.mode || '').toLowerCase();
  const endpoint = String(params.endpoint || '').toLowerCase();
  if (endpoint === 'zone123') return handleZone123Proxy_();
  if (endpoint === 'communes') return handleCommunesProxy_(params);
  const base = { ok: true, service: 'NEWOSB OPERATIONS', version: OBSERVATOIRE_CONFIG.VERSION, shared: true, share: newosbShareInfo_(rec) };
  if (mode === 'ping') {
    const lock = newosbShareLock_();
    try { access.sheet.getRange(rec.row, 12, 1, 2).setNumberFormat('@').setValues([[String(Date.now()), String(rec.accessCount + 1)]]); } catch (e) {} finally { if (lock) lock.releaseLock(); }
    base.transport = 'popup-bridge-ready';
    base.anonymizedOnly = base.share.anonymized;
    return base;
  }
  if (mode === 'reqmeta' || mode === 'reqchunk') {
    if (rec.tabs.indexOf('requirements') < 0) throw new Error("L'onglet Exigences n'est pas inclus dans ce lien.");
    return newosbShareRapport_(access, params, mode);
  }
  if (mode !== 'meta' && mode !== 'chunk') throw new Error("Action non autorisee avec un lien de partage.");
  const meta = getSheetMeta_();
  const matches = newosbShareMatches_(access, meta);
  if (mode === 'meta') {
    base.format = 'matrix-chunks-v2';
    base.headers = meta.headers;
    base.totalRows = matches.length;
    base.lastColumn = meta.lastColumn;
    base.headerRow = meta.headerRow;
    base.firstDataRow = 1;
    base.chunkSize = OBSERVATOIRE_CONFIG.DEFAULT_CHUNK_SIZE;
    base.durationMs = Date.now() - started;
    return base;
  }
  const offset = clampInteger_(params.offset, 0, matches.length, 0);
  const limit = clampInteger_(params.limit, 1, OBSERVATOIRE_CONFIG.MAX_CHUNK_SIZE, OBSERVATOIRE_CONFIG.DEFAULT_CHUNK_SIZE);
  const slice = matches.slice(offset, offset + limit);
  let rows = [];
  if (slice.length) {
    const first = slice[0], last = slice[slice.length - 1];
    const block = meta.sheet.getRange(first, 1, last - first + 1, meta.lastColumn).getDisplayValues();
    rows = slice.map(function(r) { return block[r - first]; });
  }
  if (base.share.anonymized) rows = newosbScrubMatrix_(meta.headers, rows);
  return { ok: true, service: 'NEWOSB OPERATIONS', version: OBSERVATOIRE_CONFIG.VERSION, shared: true, format: 'matrix-chunk-v2', offset: offset, count: rows.length, physicalCount: slice.length, totalRows: matches.length, done: offset + slice.length >= matches.length, rows: rows, durationMs: Date.now() - started };
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

// -----------------------------------------------------------------------------
// V6.15 - Lecture de RAPPORT pour les liens de partage qui incluent l'onglet Exigences.
// Seule la lecture est reprise de Code_Exigences.gs ; l'acces reste controle par le jeton du lien.
// -----------------------------------------------------------------------------
const NEWOSB_EXIGENCES_CONFIG = { SHEET_NAME: 'RAPPORT', HEADER_ROW: 1, FIRST_DATA_ROW: 2, SERVICE: 'NEWOSB EXIGENCES', CHUNK_SIZE: 1500, MAX_CHUNK_SIZE: 3000 };

/**
 * A lancer depuis l'editeur pour verifier que le script OPERATIONS peut lire RAPPORT
 * (necessaire uniquement pour partager l'onglet Exigences).
 */
function verifierPartageExigences() {
  try {
    const ctx = newosbRapportContext_();
    Logger.log('RAPPORT lisible : ' + ctx.rowCount + ' lignes ; colonne code operation : ' + (ctx.cols.operationCode >= 0 ? 'trouvee' : 'ABSENTE'));
    return { ok: true, rows: ctx.rowCount, operationCode: ctx.cols.operationCode >= 0 };
  } catch (e) {
    Logger.log('RAPPORT illisible : ' + (e && e.message ? e.message : e));
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

// >>> LECTURE RAPPORT — bloc partagé : copie identique dans Code_Operations.gs (liens de partage).
// Toute modification doit être reportée à l'identique dans les deux fichiers (contrôlé par les tests).
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
function newosbExigencesContext_(spreadsheet) {
  const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
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
// <<< LECTURE RAPPORT
