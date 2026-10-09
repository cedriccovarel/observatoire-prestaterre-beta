/*
 * Observatoire Prestaterre — V6.15 — liens de partage à durée limitée.
 *
 * Deux usages :
 * 1. Administrateur (Observatoire connecté avec la clé OPERATIONS) : bouton « Partager ».
 *    Le périmètre affiché (filtres, filtres analytiques, recherche) est figé sous forme de liste
 *    de codes internes ; le script Apps Script crée un jeton, n'en garde que l'empreinte et
 *    renvoie le lien une seule fois. Liste des liens, prolongation, révocation.
 * 2. Destinataire (page ouverte avec « #partage=… ») : pas de mot de passe ni de clé ; le script
 *    vérifie le jeton et sa date d'expiration à chaque requête et ne renvoie que les lignes du
 *    périmètre (pseudonymisées si le lien est anonymisé). Les filtres sont verrouillés ; seuls les
 *    onglets accordés sont visibles ; fiches, détails et filtres analytiques restent disponibles.
 *
 * Le jeton figure dans le fragment de l'URL (#…) : il n'est envoyé ni à GitHub Pages ni dans
 * l'en-tête Referer. Il n'est jamais écrit dans localStorage ou sessionStorage.
 */
(() => {
  'use strict';

  const PAGE_LABELS = {
    overview: 'Vue d’ensemble', territories: 'Territoires', stakeholders: 'Acteurs', certification: 'Certification',
    performance: 'Labels & performances', requirements: 'Exigences', solutions: 'Solutions constructives', energy: 'Énergie & transitions',
    carbon: 'Carbone & DPE', crossdata: 'Croiser les données', operations: 'Projets & opérations',
    quality: 'Qualité & données', dictionary: 'Dictionnaire'
  };
  const SHAREABLE = Object.keys(PAGE_LABELS);
  const SRC_RE = /^https:\/\/script\.google\.com\/(?:a\/macros\/[^/?#\s]+\/|macros\/)s\/[A-Za-z0-9_-]+\/exec$/;
  const TOKEN_RE = /^[A-Za-z0-9]{32,64}$/;
  const DAY = 86400000;
  const DURATIONS = [['1', '24 heures'], ['7', '7 jours'], ['30', '30 jours'], ['90', '3 mois'], ['180', '6 mois'], ['365', '1 an'], ['date', 'Jusqu’à une date…']];
  const HIDDEN_KEYS_WHEN_ANONYMIZED = ['moa', 'moaGroup', 'code', 'name', 'operation', 'city', 'address'];

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmtDate = ms => { const d = new Date(Number(ms) || 0); return Number(ms) ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'; };
  const fmtShort = ms => Number(ms) ? new Date(Number(ms)).toLocaleDateString('fr-FR') : '—';
  const plural = (n, one, many) => `${Number(n || 0).toLocaleString('fr-FR')} ${Number(n) > 1 ? many : one}`;

  function parseHash(hash) {
    const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    return { token: String(p.get('partage') || ''), src: String(p.get('src') || '') };
  }
  function isValidSource(src) { return SRC_RE.test(String(src || '')); }
  function isValidToken(token) { return TOKEN_RE.test(String(token || '')); }
  function buildLink(base, token, src) { return `${String(base).split('#')[0]}#partage=${encodeURIComponent(token)}&src=${encodeURIComponent(src)}`; }

  // Résumé lisible du périmètre. Pour un lien anonymisé, aucun nom de MOA, d'opération ni texte de recherche.
  function buildSummary(scope, anonymized) {
    const out = [];
    (scope.parts || []).forEach(p => {
      if (!p.values || !p.values.length) return;
      if (anonymized && HIDDEN_KEYS_WHEN_ANONYMIZED.includes(p.key)) out.push(`${p.label} : ${plural(p.values.length, 'valeur sélectionnée', 'valeurs sélectionnées')}`);
      else out.push(`${p.label} : ${p.values.join(', ')}`);
    });
    (scope.cross || []).forEach(c => { out.push(anonymized && HIDDEN_KEYS_WHEN_ANONYMIZED.includes(c.key) ? 'Filtre analytique (valeur masquée)' : `Analyse : ${c.label}`); });
    if (String(scope.search || '').trim()) out.push(anonymized ? 'Recherche textuelle appliquée' : `Recherche : ${String(scope.search).trim()}`);
    return out.join(' · ') || 'Toutes les opérations de la base';
  }

  // ---------------------------------------------------------------------------
  // Mode destinataire
  // ---------------------------------------------------------------------------
  const parsed = parseHash(location.hash);
  const share = {
    active: !!parsed.token,
    token: '', src: '', status: 'off', message: '', info: null, progress: null, forcePrivacy: false, attempt: 0,
    PAGE_LABELS, SHAREABLE, parseHash, buildLink, buildSummary, isValidSource, isValidToken
  };
  if (share.active) {
    if (isValidToken(parsed.token) && isValidSource(parsed.src)) Object.assign(share, { token: parsed.token, src: parsed.src, status: 'idle' });
    else Object.assign(share, { status: 'invalid', message: 'Ce lien de partage est incomplet ou mal copié.' });
    document.documentElement.classList.add('newosb-share-mode');
  }

  function emit() { try { window.dispatchEvent(new CustomEvent('newosb:sharestate', { detail: { status: share.status } })); } catch {} }

  async function start(usePopup) {
    const engine = window.NEWOSB_ENGINE;
    if (!share.active || !share.token || !engine?.connectShare) return;
    if (share.status === 'ready' || share.status === 'denied') return;
    const attempt = ++share.attempt;
    if (usePopup) {
      // Appelé dans le gestionnaire du clic : sinon le navigateur bloque la fenêtre Google.
      const warm = engine.prepareShareBridge(share.src);
      if (!warm) { Object.assign(share, { status: 'error', message: 'La fenêtre Google a été bloquée par le navigateur. Autorisez les fenêtres pop-up pour ce site, puis réessayez.' }); emit(); return; }
    }
    Object.assign(share, { status: 'loading', message: usePopup ? 'Connexion Google ouverte. Chargement des données…' : 'Connexion à la source de données…', progress: null });
    emit();
    try {
      const res = await engine.connectShare(share.src, share.token, (loaded, total) => { if (attempt !== share.attempt) return; share.progress = { loaded, total }; emit(); });
      if (attempt !== share.attempt) return;
      share.info = res.share || {};
      share.info.tabs = (share.info.tabs || []).filter(t => SHAREABLE.includes(t));
      if (!share.info.tabs.length) share.info.tabs = ['overview'];
      document.documentElement.classList.add('newosb-share-ready');
      document.documentElement.classList.toggle('newosb-share-anonymized', !!share.info.anonymized);
      Object.assign(share, { status: 'ready', message: '' });
      emit();
      if (share.info.tabs.includes('requirements')) startRequirements(false);
    } catch (err) {
      if (attempt !== share.attempt) return;
      const denied = !!err?.authError;
      Object.assign(share, { status: denied ? 'denied' : 'error', message: frenchMessage(String(err?.message || err || 'Erreur inconnue.')) });
      emit();
    }
  }

  // Le script Apps Script répond sans accents : messages connus réécrits pour le destinataire.
  function frenchMessage(text) {
    if (/revoqu/i.test(text)) return 'Ce lien de partage a été révoqué.';
    if (/a expire/i.test(text)) return 'Ce lien de partage a expiré.';
    if (/invalide ou supprime/i.test(text)) return 'Ce lien de partage est invalide ou a été supprimé.';
    if (/Trop de tentatives/i.test(text)) return 'Trop de tentatives avec des liens invalides : réessayez dans quelques minutes.';
    if (/Colonne du code interne introuvable/i.test(text)) return 'La source a changé de structure : ce lien ne peut plus être lu. Demandez un nouveau lien.';
    return text;
  }

  // Exigences : lignes RAPPORT servies par le même script, avec le même jeton (aucune clé Exigences).
  function startRequirements(usePopup) {
    if (share.status !== 'ready' || !(share.info?.tabs || []).includes('requirements')) return;
    window.NEWOSB_REQUIREMENTS?.loadShare?.(share.src, share.token, share.info.reqFilters || {}, !!usePopup);
  }

  function gateHtml() {
    const s = share.status;
    const head = '<span class="obs-share-gate-kicker">OBSERVATOIRE PARTAGÉ</span>';
    let title = 'Chargement de l’Observatoire partagé…', body = '', actions = '';
    if (s === 'invalid') { title = 'Lien de partage invalide'; body = `<p>${esc(share.message)} Vérifiez que le lien a été copié en entier, ou demandez-en un nouveau.</p>`; }
    else if (s === 'denied') { title = 'Accès impossible'; body = `<p>${esc(share.message)}</p><p>Les liens de partage ont une durée limitée et peuvent être révoqués. Demandez un nouveau lien à la personne qui vous l’a transmis.</p>`; }
    else if (s === 'error') {
      title = 'Connexion non établie';
      body = `<p>${esc(share.message)}</p><p>La source est un script Google : une petite fenêtre Google s’ouvre le temps du chargement, puis se ferme.</p>`;
      actions = '<button type="button" class="obs-btn obs-btn-primary" data-share-popup="1">Ouvrir la connexion Google</button>';
    } else {
      const p = share.progress;
      body = `<p role="status">${esc(share.message || 'Connexion à la source de données…')}${p && p.total ? ` ${esc(Math.min(p.loaded, p.total))} / ${esc(p.total)} lignes.` : ''}</p><p class="obs-share-gate-hint">Si le chargement ne démarre pas, ouvrez la connexion Google (une petite fenêtre s’ouvre puis se ferme).</p>`;
      actions = '<button type="button" class="obs-btn obs-btn-soft" data-share-popup="1">Ouvrir la connexion Google</button>';
    }
    return `<section class="obs-share-gate" aria-live="polite">${head}<h2>${esc(title)}</h2>${body}${actions ? `<div class="obs-share-gate-actions">${actions}</div>` : ''}</section>`;
  }

  function lockedFiltersHtml(count) {
    const info = share.info || {};
    const tabs = (info.tabs || []).map(t => PAGE_LABELS[t] || t).join(', ');
    return `<div class="obs-share-lock" role="note"><div class="obs-share-lock-main"><span class="obs-share-lock-badge">🔒 Périmètre figé</span><b>${esc(info.label || 'Observatoire partagé')}</b><span>${esc(info.summary || '')}</span></div><div class="obs-share-lock-meta"><span>${esc(plural(count ?? info.operationCount, 'opération', 'opérations'))}</span><span>Accès valable jusqu’au ${esc(fmtDate(info.expiresAt))}</span>${info.anonymized ? '<span>Données anonymisées</span>' : ''}<span title="${esc(tabs)}">${esc(plural((info.tabs || []).length, 'onglet', 'onglets'))}</span></div></div>`;
  }

  function allowedPage(page) { return !share.active || (share.status === 'ready' && (share.info?.tabs || []).includes(page)); }
  function landingPage() { const t = share.info?.tabs || []; return t.includes(share.info?.landing) ? share.info.landing : (t[0] || 'overview'); }

  Object.assign(share, { start, startRequirements, frenchMessage, gateHtml, lockedFiltersHtml, allowedPage, landingPage });
  window.NEWOSB_SHARE = share;

  // ---------------------------------------------------------------------------
  // Mode administrateur : fenêtre « Partager »
  // ---------------------------------------------------------------------------
  const admin = { modal: null, prepared: null, shares: [], lastLink: '', busy: false, error: '', listError: '', listLoading: false };

  function engine() { return window.NEWOSB_ENGINE; }
  function app() { return window.NEWOSB_APP; }

  function scopeInfo(anonymized) {
    const scope = app()?.shareScope?.() || { displayCodes: [], parts: [], cross: [], search: '', page: 'overview', privacy: false };
    const resolved = engine()?.resolveRealCodes?.(scope.displayCodes) || { codes: [], missing: scope.displayCodes.length, codeHeader: '' };
    // Filtres de l'onglet Exigences tels qu'affichés (sans MOA ni groupe pour un lien anonymisé).
    const reqFilters = { ...(window.NEWOSB_REQUIREMENTS?.shareFilters?.() || {}) };
    if (anonymized) { delete reqFilters.moa; delete reqFilters.moaGroup; }
    return { scope, resolved, reqFilters, summary: buildSummary(scope, anonymized) };
  }

  function prepare() {
    // Ouvre (ou réutilise) la fenêtre Google dans le gestionnaire du clic.
    try { admin.prepared = engine().shareAdminPrepare(); admin.error = ''; return true; }
    catch (err) { admin.prepared = null; admin.error = String(err?.message || err); return false; }
  }

  async function call(params) {
    const res = await engine().shareAdminRequest(admin.prepared, params);
    return res;
  }

  function ensureModal() {
    if (admin.modal) return admin.modal;
    const m = document.createElement('div');
    m.id = 'obsShareModal';
    m.className = 'data-modal obs-share-modal';
    m.hidden = true;
    m.innerHTML = '<div class="data-modal-backdrop" data-share-close="1"></div><section class="data-modal-card obs-share-card" role="dialog" aria-modal="true" aria-labelledby="obsShareTitle"><div class="data-modal-head"><div><span class="data-kicker">LIEN DE PARTAGE À DURÉE LIMITÉE</span><h2 id="obsShareTitle">Partager une vue de l’Observatoire</h2><p>Le destinataire voit uniquement les opérations du périmètre actuel, dans les onglets choisis, jusqu’à la date d’expiration. Il ne peut pas modifier les filtres.</p></div><button type="button" class="data-close" data-share-close="1" aria-label="Fermer">×</button></div><div class="obs-share-body" data-share-body></div></section>';
    document.body.appendChild(m);
    m.addEventListener('click', onModalClick);
    m.addEventListener('change', onModalChange);
    admin.modal = m;
    return m;
  }

  function formValues() {
    const m = admin.modal;
    const tabs = [...m.querySelectorAll('[data-share-tab]:checked')].map(i => i.value);
    const durationSel = m.querySelector('[data-share-duration]')?.value || '30';
    let expiresAt = 0;
    if (durationSel === 'date') {
      const v = m.querySelector('[data-share-date]')?.value || '';
      const d = v ? new Date(`${v}T23:59:00`) : null;
      expiresAt = d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
    } else expiresAt = Date.now() + Number(durationSel) * DAY;
    return {
      label: String(m.querySelector('[data-share-label]')?.value || '').trim(),
      tabs, landing: m.querySelector('[data-share-landing]')?.value || tabs[0] || 'overview',
      durationSel, expiresAt, anonymized: !!m.querySelector('[data-share-anonymized]')?.checked
    };
  }

  function statusLabel(s) { return s.status === 'active' ? 'Actif' : (s.status === 'revoked' ? `Révoqué le ${fmtShort(s.revokedAt)}` : 'Expiré'); }

  function listHtml() {
    if (admin.listLoading) return '<p class="obs-share-muted" role="status">Chargement des liens existants…</p>';
    if (admin.listError) return `<p class="data-feedback is-error">${esc(admin.listError)}</p>`;
    if (!admin.shares.length) return '<p class="obs-share-muted">Aucun lien créé pour l’instant.</p>';
    const rows = admin.shares.map(s => {
      const tabs = (s.tabs || []).map(t => PAGE_LABELS[t] || t).join(', ');
      const actions = s.status === 'revoked' ? '' : `<span class="obs-share-extend"><select data-share-extend-sel="${esc(s.id)}" aria-label="Nouvelle durée">${DURATIONS.filter(d => d[0] !== 'date').map(d => `<option value="${d[0]}"${d[0] === '30' ? ' selected' : ''}>${esc(d[1])}</option>`).join('')}</select><button type="button" class="btn btn-secondary btn-small" data-share-extend="${esc(s.id)}">Prolonger</button></span><button type="button" class="btn btn-secondary btn-small obs-share-revoke" data-share-revoke="${esc(s.id)}">Révoquer</button>`;
      return `<tr class="is-${esc(s.status)}"><td><b>${esc(s.label)}</b><small>${esc(s.summary || '')}</small></td><td title="${esc(tabs)}">${esc(plural((s.tabs || []).length, 'onglet', 'onglets'))}${s.anonymized ? '<small>anonymisé</small>' : ''}</td><td>${esc((s.operationCount || 0).toLocaleString('fr-FR'))}</td><td>${esc(fmtShort(s.createdAt))}</td><td>${esc(fmtDate(s.expiresAt))}</td><td><span class="obs-share-status is-${esc(s.status)}">${esc(statusLabel(s))}</span></td><td>${esc(String(s.accessCount || 0))}${s.lastAccessAt ? `<small>dernier : ${esc(fmtShort(s.lastAccessAt))}</small>` : ''}</td><td class="obs-share-actions">${actions}</td></tr>`;
    }).join('');
    return `<div class="obs-share-table-wrap"><table class="obs-share-table"><thead><tr><th>Lien</th><th>Onglets</th><th>Opérations</th><th>Créé le</th><th>Expire le</th><th>Statut</th><th>Ouvertures</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function render(keepForm) {
    const m = ensureModal();
    const body = m.querySelector('[data-share-body]');
    const previous = keepForm && body.querySelector('[data-share-form]') ? formValues() : null;
    const currentPage = app()?.currentPage?.() || 'overview';
    const privacyOn = !!window.NEWOSB_PRIVACY?.enabled?.();
    const anonymized = previous ? previous.anonymized : privacyOn;
    const { scope, resolved, summary } = scopeInfo(anonymized);
    const defaultTabs = previous ? previous.tabs : [...new Set(['overview', SHAREABLE.includes(currentPage) ? currentPage : 'overview'])];
    const duration = previous ? previous.durationSel : '30';
    const minDate = new Date(Date.now() + DAY).toISOString().slice(0, 10);
    const maxDate = new Date(Date.now() + 365 * DAY).toISOString().slice(0, 10);
    const tabsHtml = SHAREABLE.map(t => `<label class="obs-share-tab"><input type="checkbox" data-share-tab value="${t}"${defaultTabs.includes(t) ? ' checked' : ''}><span>${esc(PAGE_LABELS[t])}</span></label>`).join('');
    const landingOptions = (defaultTabs.length ? defaultTabs : ['overview']).map(t => `<option value="${t}"${(previous?.landing || currentPage) === t ? ' selected' : ''}>${esc(PAGE_LABELS[t] || t)}</option>`).join('');
    const count = resolved.codes.length;
    const warn = resolved.missing ? `<p class="obs-share-warn">${esc(plural(resolved.missing, 'opération sans code interne n’est pas incluse', 'opérations sans code interne ne sont pas incluses'))} (le lien s’appuie sur le code interne).</p>` : '';
    const linkBox = admin.lastLink ? `<div class="obs-share-result" role="status"><b>Lien créé.</b> Copiez-le maintenant : il n’est affiché qu’une fois (seule son empreinte est conservée). Toute personne qui possède ce lien peut consulter ce périmètre jusqu’à la date d’expiration.<div class="obs-share-link-row"><input type="text" readonly value="${esc(admin.lastLink)}" data-share-link aria-label="Lien de partage"><button type="button" class="btn btn-primary" data-share-copy="1">Copier le lien</button><a class="btn btn-secondary" href="${esc(admin.lastLink)}" target="_blank" rel="noopener noreferrer">Ouvrir</a></div></div>` : '';
    body.innerHTML = `${admin.error ? `<p class="data-feedback is-error">${esc(admin.error)}</p>` : ''}
<div class="obs-share-grid" data-share-form>
  <div class="data-source-card">
    <label for="obsShareLabel">Nom du lien <small>(visible par le destinataire)</small></label>
    <input id="obsShareLabel" type="text" maxlength="120" data-share-label value="${esc(previous?.label || '')}" placeholder="${anonymized ? 'Ex. Bailleurs sociaux · Logement Neuf' : 'Ex. Action Logement · Logement Neuf'}">
    ${anonymized ? '<small class="obs-share-hint">Lien anonymisé : le nom du lien est affiché tel quel au destinataire, n’y mettez pas de nom de MOA ou d’opération. Laissé vide, il reprend le résumé anonymisé du périmètre.</small>' : ''}
    <label>Onglets accessibles</label>
    <div class="obs-share-tabs">${tabsHtml}</div>
    ${defaultTabs.includes('requirements') ? `<p class="obs-share-muted obs-share-req-note">Exigences : les lignes RAPPORT des opérations du périmètre sont lues par le script OPERATIONS (aucune clé Exigences pour le destinataire). ${Object.keys(scopeInfo(anonymized).reqFilters).length ? 'Les filtres de l’onglet Exigences affichés maintenant sont figés avec le lien.' : 'Aucun filtre de l’onglet Exigences n’est figé : toutes les exigences des opérations partagées.'}</p>` : ''}
    <label for="obsShareLanding">Onglet d’ouverture</label>
    <select id="obsShareLanding" data-share-landing>${landingOptions}</select>
    <label for="obsShareDuration">Durée d’accès</label>
    <div class="obs-share-duration"><select id="obsShareDuration" data-share-duration>${DURATIONS.map(d => `<option value="${d[0]}"${d[0] === duration ? ' selected' : ''}>${esc(d[1])}</option>`).join('')}</select><input type="date" data-share-date min="${minDate}" max="${maxDate}" value="${esc(previous && previous.durationSel === 'date' && previous.expiresAt ? new Date(previous.expiresAt).toISOString().slice(0, 10) : '')}" ${duration === 'date' ? '' : 'hidden'} aria-label="Date d’expiration"></div>
    <label class="obs-share-check"><input type="checkbox" data-share-anonymized${anonymized ? ' checked' : ''}><span><b>Anonymiser les données pour le destinataire</b><small>MOA, noms d’opérations et codes pseudonymisés par le serveur ; adresses, contacts et montants retirés.</small></span></label>
  </div>
  <div class="data-source-card obs-share-scope">
    <label>Périmètre figé</label>
    <p class="obs-share-count"><b>${esc(count.toLocaleString('fr-FR'))}</b> ${count > 1 ? 'opérations' : 'opération'}</p>
    <p class="obs-share-summary">${esc(summary)}</p>
    ${warn}
    <p class="obs-share-muted">Le périmètre est la liste des opérations affichées maintenant. Leurs données restent à jour à chaque ouverture du lien ; une opération créée plus tard n’y est pas ajoutée. Pour l’élargir, créez un nouveau lien.</p>
    <div class="data-actions"><button type="button" class="btn btn-primary" data-share-create="1"${count && !admin.busy ? '' : ' disabled'}>${admin.busy ? 'Création…' : 'Créer le lien'}</button></div>
    ${linkBox}
  </div>
</div>
<h3 class="obs-share-h3">Liens existants</h3>
${listHtml()}
<p class="obs-share-muted obs-share-foot">Le contrôle (jeton, périmètre, expiration, révocation, anonymisation) est fait par le script Apps Script à chaque ouverture. Le choix des onglets est une restriction d’affichage : les données transmises sont celles du périmètre. Pour un destinataire extérieur à votre organisation, le déploiement Apps Script doit être accessible à « Tout le monde ».</p>`;
  }

  async function refreshList() {
    admin.listLoading = true; admin.listError = ''; render(true);
    try { const res = await call({ mode: 'shareList' }); admin.shares = res.shares || []; }
    catch (err) { admin.listError = String(err?.message || err); }
    admin.listLoading = false; render(true);
  }

  function open() {
    ensureModal();
    admin.lastLink = ''; admin.error = ''; admin.shares = []; admin.listError = '';
    const ok = prepare();
    admin.modal.hidden = false;
    render(false);
    if (ok) refreshList();
  }

  function close() {
    if (!admin.modal) return;
    admin.modal.hidden = true;
    admin.lastLink = '';
    try { engine()?.shareAdminClose?.(); } catch {}
  }

  async function create() {
    const v = formValues();
    if (!v.tabs.length) { admin.error = 'Choisissez au moins un onglet.'; render(true); return; }
    if (!v.expiresAt || v.expiresAt < Date.now() + 3600000) { admin.error = 'Choisissez une date d’expiration future.'; render(true); return; }
    const { resolved, summary, reqFilters } = scopeInfo(v.anonymized);
    if (!resolved.codes.length) { admin.error = 'Aucune opération avec un code interne dans le périmètre actuel.'; render(true); return; }
    admin.busy = true; admin.error = ''; render(true);
    try {
      const res = await call({ mode: 'shareCreate', label: v.label || summary.slice(0, 120), tabs: v.tabs, landing: v.tabs.includes(v.landing) ? v.landing : v.tabs[0], expiresAt: v.expiresAt, anonymized: v.anonymized, codes: resolved.codes, codeHeader: resolved.codeHeader, summary, reqFilters: v.tabs.includes('requirements') ? reqFilters : {} });
      if (!isValidToken(res.token)) throw new Error('Réponse du script inattendue : lien non créé.');
      admin.lastLink = buildLink(location.origin + location.pathname, res.token, admin.prepared.sourceUrl);
      admin.shares = [res.share, ...admin.shares.filter(s => s.id !== res.share.id)];
    } catch (err) { admin.error = String(err?.message || err); }
    admin.busy = false; render(true);
  }

  async function revoke(id) {
    const s = admin.shares.find(x => x.id === id);
    if (!window.confirm(`Révoquer le lien « ${s?.label || id} » ? Il cessera immédiatement de fonctionner.`)) return;
    try { const res = await call({ mode: 'shareRevoke', id }); admin.shares = admin.shares.map(x => x.id === id ? res.share : x); admin.error = ''; }
    catch (err) { admin.error = String(err?.message || err); }
    render(true);
  }

  async function extend(id, days) {
    try { const res = await call({ mode: 'shareExtend', id, expiresAt: Date.now() + Number(days) * DAY }); admin.shares = admin.shares.map(x => x.id === id ? res.share : x); admin.error = ''; }
    catch (err) { admin.error = String(err?.message || err); }
    render(true);
  }

  function onModalClick(e) {
    if (e.target.closest('[data-share-close]')) { close(); return; }
    if (e.target.closest('[data-share-copy]')) {
      const input = admin.modal.querySelector('[data-share-link]');
      const done = () => { const b = admin.modal.querySelector('[data-share-copy]'); if (b) b.textContent = 'Copié ✓'; };
      try { navigator.clipboard.writeText(input.value).then(done, () => { input.select(); document.execCommand('copy'); done(); }); } catch { input.select(); try { document.execCommand('copy'); done(); } catch {} }
      return;
    }
    // Chaque action réseau est déclenchée par un clic : la fenêtre Google peut être (ré)ouverte.
    if (e.target.closest('[data-share-create]')) { if (prepare()) create(); else render(true); return; }
    const rv = e.target.closest('[data-share-revoke]'); if (rv) { if (prepare()) revoke(rv.dataset.shareRevoke); else render(true); return; }
    const ex = e.target.closest('[data-share-extend]'); if (ex) { const sel = admin.modal.querySelector(`[data-share-extend-sel="${CSS.escape(ex.dataset.shareExtend)}"]`); if (prepare()) extend(ex.dataset.shareExtend, sel?.value || '30'); else render(true); }
  }

  function onModalChange(e) {
    if (e.target.matches('[data-share-duration]')) { const d = admin.modal.querySelector('[data-share-date]'); if (d) d.hidden = e.target.value !== 'date'; return; }
    if (e.target.matches('[data-share-tab]') || e.target.matches('[data-share-anonymized]')) render(true);
  }

  function bindAdmin() {
    if (share.active) return;
    document.getElementById('obsShareBtn')?.addEventListener('click', open);
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && admin.modal && !admin.modal.hidden) close(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindAdmin, { once: true }); else bindAdmin();

  share.admin = { open, close, render, scopeInfo };
})();
