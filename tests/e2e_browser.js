'use strict';
// Test navigateur de bout en bout (optionnel) : node tests/e2e_browser.js
// Prérequis : npm install playwright && npx playwright install chromium
// Sert le site en local, simule le déploiement Apps Script avec le VRAI Code_Operations.gs
// (exécuté dans Node), puis vérifie la connexion, l'avancement, la page Qualité et la sécurité du pont.
const http = require('http'), fs = require('fs'), path = require('path');
let playwright;
try { playwright = require('playwright'); } catch { try { playwright = require(path.join(process.env.HOME || '', '.npm-global/lib/node_modules/playwright')); } catch { console.log('Playwright absent : test navigateur ignoré (npm install playwright).'); process.exit(0); } }
const { loadGs, MATRIX } = require('./gs_harness');
const ROOT = path.join(__dirname, '..');
const EXEC = 'https://script.google.com/macros/s/TEST/exec';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.gs': 'text/plain', '.json': 'application/json' };
let passed = 0, failed = 0;
const check = (cond, label) => { if (cond) { passed++; console.log('  ok  ' + label); } else { failed++; console.log('  ÉCHEC ' + label); } };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

const RUN_FNS = ['newosbBridgeRequest', 'newosbExigencesBridgeRequest'];
const SHIM = `<script>window.google={script:{run:(function(){function R(ok,ko){this.ok=ok;this.ko=ko;}R.prototype.withSuccessHandler=function(f){return new R(f,this.ko);};R.prototype.withFailureHandler=function(f){return new R(this.ok,f);};${RUN_FNS.map(fn => `R.prototype.${fn}=function(p){var s=this;fetch(location.pathname.replace(/\\/exec$/,'')+'/__run/${fn}',{method:'POST',body:JSON.stringify(p)}).then(function(r){return r.json();}).then(function(j){s.ok&&s.ok(j);}).catch(function(e){s.ko&&s.ko(e);});};`).join('')}return new R();})()}};</script>`;
const KEY = 'cle-e2e-0123456789abcdef';
const EXI = 'https://script.google.com/macros/s/EXI/exec';
const { RAPPORT_HEADERS } = require('./gs_harness');
// RAPPORT de test, rattaché aux codes OPERATIONS de la feuille de test (OP-1…OP-7).
const BOUQUET = '1.1.1 1.1.4 1.2.1 1.2.2 1.2.3 2.1.1 2.1.2 2.1.3 2.2.2 2.3.1 2.4.1 2.4.2 2.4.3 2.4.7 3.3.2 4.1.1 4.1.2 4.3.7 4.3.8 4.6.1'.split(' ');
const RAPPORT = [RAPPORT_HEADERS];
const rr = (op, ev, moa, ref, ver, codes, validated = '') => codes.forEach(c => RAPPORT.push([`${c} - Exigence ${c}`, ev, moa, op, ref, ver, 'Nouvelle-Aquitaine', '33', c, validated, 'En cours', '']));
['OP-1', 'OP-2', 'OP-7'].forEach((op, i) => rr(op, 'EVA-' + op, 'Promoteur A', 'BEE Logement Neuf', '04/05/2026', BOUQUET));
rr('OP-3', 'EVA-OP-3', 'Bailleur B', 'BEE Logement Neuf', '04/05/2026', ['1.1.1', '2.4.6']);
rr('OP-4', 'EVA-OP-4', 'Bailleur B', 'BEE Logement Rénovation', '18/06/2025', ['1.2.1', '1.2.2', '3.1.1'], 'Non');
rr('OP-1', 'EVA-OP-1-ANC', 'Promoteur A', 'BEE Logement Neuf', '01/02/2023', ['1.1.1', '4.B.2']);
for (let i = 0; i < 40; i++) rr('OP-X' + i, 'EVA-X' + i, 'Promoteur Z', 'BEE Logement Neuf', '04/05/2026', ['1.1.1', '2.1.1']);

async function scenario(browser, origin, properties, { jsonFails = false, matrix = MATRIX, noKey = false, viewport, extraSheets = {}, delayMs = 0, noConnect = false } = {}) {
  const gs = loadGs('Code_Operations.gs', { matrix, properties: { NEWOSB_ACCESS_KEY: KEY, ...properties }, extraSheets });
  const gsReq = loadGs('Code_Exigences.gs', { matrix: RAPPORT, sheetName: 'RAPPORT', properties: { NEWOSB_ACCESS_KEY: KEY, ...properties } });
  const context = await browser.newContext({ acceptDownloads: true, viewport: viewport || { width: 1280, height: 900 } });
  const requests = [];
  await context.route('https://script.google.com/**', async route => {
    const url = new URL(route.request().url());
    requests.push(url.toString());
    const target = url.pathname.includes('/EXI/') ? gsReq : gs;
    const run = url.pathname.match(/\/__run\/(\w+)$/);
    if (run && delayMs) await new Promise(r => setTimeout(r, delayMs));
    if (run) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(target[run[1]](JSON.parse(route.request().postData() || '{}'))) });
    const params = Object.fromEntries(url.searchParams.entries());
    const out = target.doGet({ parameter: params });
    if (out.html !== undefined) return route.fulfill({ contentType: 'text/html', body: out.html.replace('<script>', SHIM + '<script>') });
    if (jsonFails) return route.fulfill({ status: 403, body: 'Forbidden' });
    return route.fulfill({ contentType: out.mime === 'js' ? 'text/javascript' : 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: out.text });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { errors.push('DIALOG ' + d.message()); d.dismiss().catch(() => {}); });
  await page.addInitScript(() => { sessionStorage.setItem('prestaterre-observatoire-v21-auth', '1'); });
  await page.goto(origin + '/index.html');
  await page.waitForFunction(() => window.NEWOSB_ENGINE && window.NEWOSB_RULES);
  if (!noConnect) await page.evaluate(({ url, key }) => { document.getElementById('dataMode').value = 'appsScript'; document.getElementById('dataUrl').value = url; document.getElementById('dataKey').value = key; return window.NEWOSB_ENGINE.connect(); }, { url: EXEC, key: noKey ? '' : KEY });
  return { page, context, errors, gs, gsReq, requests };
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await playwright.chromium.launch();
  try {
    console.log('\nA. Site autorisé : connexion par le pont Apps Script');
    { const { page, context, errors } = await scenario(browser, origin, { NEWOSB_ALLOWED_ORIGINS: origin });
      const rt = await page.evaluate(() => window.NEWOSB_ENGINE.getRuntime());
      check(rt.connected && rt.count === 13, `13 projets chargés : 10 codes internes + 3 propositions sans code, non fusionnées malgré un nom identique (obtenu : ${rt.count})`);
      check(rt.progress && rt.progress.header === 'Opération: Évaluation: Statut' && rt.progress.column === 'BC', `avancement lu dans « Opération: Évaluation: Statut », colonne BC (obtenu : ${rt.progress && rt.progress.column})`);
      const fb = await page.textContent('#dataFeedback'); check(/colonne BC/.test(fb), 'message de connexion : « colonne BC » affiché — ' + fb);
      const pt = await page.evaluate(() => { const opts = [...document.querySelectorAll('[data-global-filter-check="programType"]')].map(i => i.value); const types = [...new Set(window.NEWOSB_ENGINE.getOperations().map(o => o.programType))]; return { opts, types }; });
      check(pt.opts.length > 0 && pt.types.every(t => t && !/Non disponible/.test(t)) && pt.opts.includes("Logement collectif (immeubles d'appartements)"), `filtre global « Type de programme » alimenté par le script (${pt.opts.join(' | ')})`);
      const ops = await page.evaluate(() => window.NEWOSB_ENGINE.getOperations().map(o => [o.code, o.status, o.progressState]));
      const st = Object.fromEntries(ops.map(o => [o[0], o[1]]));
      check(st['OP-3'] === 'complete' && st['OP-6'] === 'visit' && st['OP-7'] === 'compliant', '« Dossier complet », « Visite réalisée », « Évaluation conforme » reconnus');
      check(st['OP-9'] === 'unknown', 'avancement vide → Non renseigné (plus « Non démarrée » par défaut)');
      const noCodeOps = Object.fromEntries(await page.evaluate(() => window.NEWOSB_ENGINE.getOperations().filter(o => !o.code).map(o => [o.moa, o.status])));
      check(noCodeOps['Promoteur E'] === 'compliant' && noCodeOps['Promoteur G'] === 'visit', 'ligne sans code interne dont BC est vide : avancement lu dans « État du dossier » (comme en V6.12)');
      check(noCodeOps['Promoteur F'] === 'proposal', 'ligne sans code interne ET sans avancement → « Proposition commerciale en cours »');
      const fbMsg = await page.textContent('#dataFeedback');
      check(fbMsg.includes('puis « État du dossier » (colonne BW) quand BC est vide (2 lignes)'), 'message de connexion : repli sur « État du dossier » annoncé — ' + fbMsg.slice(-170));
      // --- Labels & performances : tableau croisé Mentions × performances (V6.13.5) ---
      await page.click('button[data-page="performance"]'); await page.waitForTimeout(400);
      const mlist = '[data-matrix-check-list="mention"]', plist = '[data-matrix-check-list="performance"]';
      const stat = (sel) => page.evaluate(s => { const l = document.querySelector(s); const all = [...l.querySelectorAll('[data-matrix-option]')]; return { total: all.length, shown: all.filter(e => getComputedStyle(e).display !== 'none').length, scrollTop: l.scrollTop, scrollable: l.scrollHeight > l.clientHeight + 20 }; }, sel);
      const s0 = await stat(mlist);
      check(s0.total >= 12 && s0.scrollable, `liste Mentions défilante (${s0.total} valeurs)`);
      await page.fill('[data-matrix-search="mention"]', 'RT2012'); await page.waitForTimeout(150);
      const s1 = await stat(mlist);
      check(s1.shown === 2 && s1.total === s0.total, `recherche « RT2012 » : ${s1.shown} mentions visibles sur ${s1.total} (attendu 2)`);
      await page.fill('[data-matrix-search="mention"]', 'rt2012 -20'); await page.waitForTimeout(150);
      check((await stat(mlist)).shown === 1, 'recherche à plusieurs mots (ordre libre, casse ignorée) : « rt2012 -20 » → 1 mention');
      await page.fill('[data-matrix-search="mention"]', 'biosource'); await page.waitForTimeout(150);
      check((await stat(mlist)).shown === 3, 'recherche sans accent : « biosource » → 3 mentions « Biosourcé »');
      await page.fill('[data-matrix-search="mention"]', 'zzzz'); await page.waitForTimeout(150);
      check((await stat(mlist)).shown === 0 && await page.evaluate(() => !document.querySelector('[data-matrix-empty="mention"]').hidden), 'aucun résultat : message affiché');
      await page.fill('[data-matrix-search="mention"]', ''); await page.waitForTimeout(150);
      check((await stat(mlist)).shown === s0.total, 'recherche effacée : toutes les mentions reviennent');
      await page.fill('[data-matrix-search="performance"]', 'ubat'); await page.waitForTimeout(150);
      check((await stat(plist)).shown === 2, 'recherche dans la liste Performances : « ubat » → 2 valeurs');
      await page.fill('[data-matrix-search="performance"]', ''); await page.waitForTimeout(150);
      // défilement conservé quand on coche
      await page.evaluate(s => { document.querySelector(s).scrollTop = 150; }, mlist);
      const beforeScroll = (await stat(mlist)).scrollTop;
      await page.evaluate(s => { const l = document.querySelector(s); const b = [...l.querySelectorAll('input[type=checkbox]')].find(x => x.getBoundingClientRect().top > l.getBoundingClientRect().top + 20); b.click(); }, mlist);
      await page.waitForTimeout(500);
      const afterScroll = (await stat(mlist)).scrollTop;
      check(beforeScroll > 100 && Math.abs(afterScroll - beforeScroll) <= 2, `cocher une mention garde la position dans la liste (${Math.round(beforeScroll)} → ${Math.round(afterScroll)})`);
      await page.locator('[data-matrix-check-list="mention"] input[type=checkbox]:not(:checked)').nth(5).click(); // vrai clic souris
      await page.waitForTimeout(500);
      check(Math.abs((await stat(mlist)).scrollTop - beforeScroll) <= 6, `cocher une deuxième mention à la souris : position conservée (${Math.round((await stat(mlist)).scrollTop)})`);
      check(await page.evaluate(() => document.querySelectorAll('[data-matrix-check-list="mention"] input:checked').length === 2 && /2 sélectionnées/.test(document.querySelector('.obs-matrix-check-panel header b').textContent)), 'deux mentions cochées et comptées');
      // la recherche et la position survivent à une case cochée
      await page.evaluate(s => { document.querySelector(s).scrollTop = 0; }, plist);
      await page.fill('[data-matrix-search="performance"]', 'cep'); await page.waitForTimeout(150);
      await page.locator('[data-matrix-check-list="performance"] [data-matrix-option]:not([hidden]) input[type=checkbox]').nth(2).click(); // vrai clic souris : la case prend le focus
      await page.waitForTimeout(500);
      const sp = await stat(plist);
      check(sp.shown === 4 && await page.inputValue('[data-matrix-search="performance"]') === 'cep', `cocher pendant une recherche : filtre « cep » conservé (${sp.shown} valeurs visibles)`);
      check(await page.evaluate(() => document.activeElement && document.activeElement.matches('[data-performance-matrix-check]')), 'le focus reste sur la case cochée');
      await page.evaluate(() => document.querySelector('[data-matrix-clear="mention"]').click()); await page.waitForTimeout(400);
      check(await page.evaluate(() => document.querySelectorAll('[data-matrix-check-list="mention"] input:checked').length === 0), '« Tout afficher » décoche les mentions');
      await page.evaluate(() => document.querySelector('[data-matrix-clear="performance"]').click()); await page.waitForTimeout(300);
      await page.click('#obsResetFilters'); await page.waitForTimeout(400);
      check(await page.inputValue('[data-matrix-search="performance"]') === '', 'Réinitialiser efface aussi les recherches');
      // --- Filtres du haut de page : même défaut de défilement corrigé ---
      await page.evaluate(() => { const d = [...document.querySelectorAll('#obsFilters details')].find(x => x.querySelector('[data-global-filter-search="referential"]')); d.open = true; });
      await page.waitForTimeout(200);
      await page.fill('[data-global-filter-search="referential"]', 'renovation'); await page.waitForTimeout(250);
      const gShown = await page.evaluate(() => [...document.querySelectorAll('[data-filter-option="referential"]')].filter(e => getComputedStyle(e).display !== 'none').length);
      check(gShown === 1, `filtre Référentiel : recherche « renovation » → ${gShown} valeur visible`);
      await page.fill('[data-global-filter-search="referential"]', ''); await page.waitForTimeout(250);
      await page.click('#obsResetFilters'); await page.waitForTimeout(300);
      await page.click('button[data-page="quality"]'); await page.waitForTimeout(300);
      const recon = await page.textContent('.obs-progress-card');
      check(recon.includes('Contrôle ligne à ligne de l’avancement') && recon.includes('14 lignes lues dans la Sheet') && recon.includes('3 sans code interne') && recon.includes('2 ont leur avancement dans « État du dossier »') && recon.includes('13 projets après regroupement'), 'Qualité : contrôle ligne à ligne (14 lignes dont 3 sans code : 2 lues en État du dossier, 1 sans avancement → 13 projets)');
      check(/1 projet avec des statuts différents/.test(recon) && recon.includes('OP-2'), 'Qualité : projet à statuts différents signalé (OP-2)');
      check(recon.includes('Lignes en BC') && recon.includes('Lignes en BW (État du dossier)') && recon.includes('Dans le tunnel'), 'Qualité : tableau lignes BC / État du dossier → projets → tunnel');
      check(await page.evaluate(() => !!document.querySelector('[data-copy-progress-report]')), 'bouton « Copier le diagnostic de l’avancement » présent');
      await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('refusé')) }, configurable: true }); });
      await page.click('[data-copy-progress-report]'); await page.waitForTimeout(400);
      const report = await page.inputValue('[data-progress-report-text]').catch(() => '');
      check(report.includes('DIAGNOSTIC AVANCEMENT') && report.includes('Colonne principale : « Opération: Évaluation: Statut » colonne BC') && report.includes('Colonne de repli : « État du dossier » colonne BW') && report.includes('Sans code ni avancement (→ proposition commerciale) : 1'), 'diagnostic copiable : colonnes, lignes lues par source, propositions');
      const op2 = await page.evaluate(() => ({ project: window.NEWOSB_ENGINE.getOperations().find(o => o.code === 'OP-2').status, rows: window.NEWOSB_ENGINE.getTechnicalOperations().filter(o => o.projectCode === 'OP-2').map(o => o.status) }));
      check(op2.project === 'notStarted', `projet à plusieurs lignes : avancement global = étape la moins avancée (obtenu : ${op2.project})`);
      check(op2.rows.join(',') === 'incomplete,notStarted', `opération détaillée : statut exact de chaque ligne (obtenu : ${op2.rows.join(',')})`);
      // Vue d'ensemble : le graphique « Évolution des projets » reste affiché quel que soit le filtre (V6.14.2)
      await page.click('button[data-page="overview"]'); await page.waitForTimeout(200);
      { const res = [];
        for (const [k, v] of [['moa', 'Bailleur B'], ['referential', 'BEE Logement Rénovation'], ['status', 'notStarted']]) {
          await page.evaluate(([k, v]) => { const i = [...document.querySelectorAll(`[data-global-filter-check="${k}"]`)].find(x => x.value === v); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); }, [k, v]); await page.waitForTimeout(250);
          res.push(await page.evaluate(() => !!document.querySelector('.obs-evolution-multi svg')));
          await page.click('#obsResetFilters'); await page.waitForTimeout(200);
        }
        check(res.every(Boolean), `Vue d’ensemble : graphique affiché avec un filtre MOA, Référentiel ou Avancement (${res.join(',')})`); }
      await page.click('button[data-page="overview"]'); await page.waitForTimeout(200);
      const yrs = Object.fromEntries((await page.evaluate(() => window.NEWOSB_ENGINE.getOperations().map(o => [o.code, [o.year, o.createdYear]]))));
      check(String(yrs['OP-7'][0]) === '2024' && String(yrs['OP-10'][0]) === '2024' && String(yrs['OP-9'][0]) === '2025', 'année de certification lue dans « Date de décision de certification » (15/03/24 → 2024)');
      check(String(yrs['OP-1'][0]) === '', 'pas de décision de certification → pas d’année de certification (plus de repli sur la date CD)');
      check(String(yrs['OP-1'][1]) === '2023' && String(yrs['OP-3'][1]) === '2024' && String(yrs['OP-6'][1]) === '2024', 'année de création lue dans « Date de création » (formats variés)');
      const filterLabels = await page.$$eval('#obsFilters .obs-check-filter summary span', els => els.map(e => e.textContent));
      check(filterLabels.includes('Année certification') && filterLabels.includes('Année de création'), 'filtres « Année certification » et « Année de création » présents');
      const certOpts = await page.$$eval('#obsFilters details:nth-of-type(1) [data-global-filter-check]', els => els.map(e => e.value));
      const createdOpts = await page.$$eval('#obsFilters details:nth-of-type(2) [data-global-filter-check]', els => els.map(e => e.value));
      check(certOpts.join(',') === '2024,2025' && createdOpts.join(',') === '2022,2023,2024,2026', `options : certification ${certOpts.join(',')} · création ${createdOpts.join(',')}`);
      await page.evaluate(() => { const i = document.querySelector('#obsFilters details:nth-of-type(2) [data-global-filter-check][value="2022"]'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
      await page.waitForTimeout(300);
      check((await page.textContent('#obsFilterCount')).trim() === '1', 'filtre « Année de création = 2022 » : 1 projet actif (affaire perdue exclue)');
      await page.click('#obsResetFilters'); await page.waitForTimeout(300);
      const tunnel = await page.evaluate(() => window.NEWOSB_ENGINE.aggregateTunnel(window.NEWOSB_ENGINE.getOperations()));
      check(tunnel.counts.visit === 1 && tunnel.counts.complete === 1 && tunnel.counts.proposal === 1 && tunnel.counts.compliant === 2 && tunnel.cancelled === 2, `tunnel : 1 proposition, 1 visite, 1 dossier complet, 2 conformes (dont 1 ligne historique), 2 annulés/perdus (${JSON.stringify(tunnel)})`);
      await page.click('button[data-page="certification"]'); await page.waitForTimeout(300);
      const steps = await page.$$eval('.obs-tunnel-step span', els => els.map(e => e.textContent));
      check(steps.join('|') === 'Proposition commerciale en cours|Non démarrée|Dossier incomplet|Dossier complet|Analyse planifiée|Analyse réalisée|Visite réalisée|Évaluation conforme', 'tunnel affiché avec les 8 étapes dans l’ordre');
      const cardNumbers = () => page.$$eval('.obs-tunnel-oneline .obs-tunnel-step strong', els => els.map(e => parseInt(e.textContent.replace(/\s/g, ''), 10)));
      const offNumbers = await cardNumbers();
      await page.check('[data-tunnel-excluded-toggle]', { force: true }); await page.waitForTimeout(400);
      const onNumbers = await cardNumbers();
      check(onNumbers.reduce((a, b) => a + b, 0) > offNumbers.reduce((a, b) => a + b, 0) && onNumbers.every((n, i) => n >= offNumbers[i]), `« Inclure annulés / abandonnés » : cartes ${offNumbers.join('/')} → ${onNumbers.join('/')} (chiffres bruts de la colonne BC)`);
      check((await page.textContent('#obsPage')).includes('elles reprennent les chiffres de la colonne BC'), 'note explicative affichée quand l’option est cochée');
      await page.uncheck('[data-tunnel-excluded-toggle]', { force: true }); await page.waitForTimeout(300);
      check((await cardNumbers()).join('/') === offNumbers.join('/'), 'option décochée : retour aux chiffres du tunnel actif');
      check(/ne sont pas comptées dans le tunnel|n’est pas comptée dans le tunnel|ne est pas|sont pas comptées/.test(await page.textContent('#obsPage')), 'note : nombre d’affaires annulées hors tunnel indiqué');
      const pageText = await page.textContent('#obsPage');
      check(!/TUNNEL INTERACTIF/i.test(pageText) && /AVANCEMENT/.test(pageText), 'carte « Tunnel interactif » renommée « Avancement »');
      for (const w of [1440, 1100, 900]) {
        await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(250);
        const tops = await page.$$eval('#obsPage .obs-tunnel-oneline', ts => ts.map(t => new Set([...t.querySelectorAll('.obs-tunnel-step')].map(b => Math.round(b.getBoundingClientRect().top))).size));
        check(tops.length && tops.every(n => n === 1), `largeur ${w}px : les 8 étapes tiennent sur une seule ligne`);
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      check(/Statut par année de création/.test(pageText), 'chronologie de l’avancement par année de création');
      await page.click('button[data-page="quality"]'); await page.waitForTimeout(300);
      const q = await page.textContent('#obsPage');
      check(q.includes('Colonne utilisée : « Opération: Évaluation: Statut » · colonne BC de la Sheet'), 'Qualité : colonne d’avancement affichée avec sa lettre (BC)');
      check(q.includes('12,3 / 15') && q.includes('U=0,25 W/m².K'), 'Qualité : valeurs illisibles listées (Bbio « 12,3 / 15 », R en W/m².K)');
      check(q.includes('bientôt') && q.includes('colonne « Date de décision de certification »') && q.includes('colonne « Date de création »'), 'Qualité : colonnes d’années affichées et date illisible signalée');
      await page.click('button[data-page="energy"]'); await page.waitForTimeout(300);
      const en = await page.textContent('#obsPage');
      check(/échantillon faible \(n = 3\)/.test(en), 'Énergie : Cep moyen sur 3 valeurs signalé « échantillon faible »');
      await page.check('#obsPrivacyToggle', { force: true }); await page.waitForTimeout(300);
      const anon = await page.evaluate(() => window.NEWOSB_ENGINE.getOperations().map(o => o.moa));
      check(anon.every(m => /^MOA \d{6}$/.test(m)), 'mode anonymisé : tous les MOA pseudonymisés');
      for (const p of ['overview', 'territories', 'stakeholders', 'performance', 'energy', 'carbon', 'crossdata', 'operations', 'dictionary']) { await page.click(`button[data-page="${p}"]`); await page.waitForTimeout(150); }
      check(errors.length === 0, 'aucune erreur JavaScript en parcourant toutes les pages' + (errors.length ? ' : ' + errors.slice(0, 3).join(' | ') : ''));
      const gen = await context.newPage(); const genErrors = []; gen.on('pageerror', e => genErrors.push(e.message));
      await gen.goto(origin + '/generator.html'); await gen.waitForTimeout(800);
      check(genErrors.length === 0 && await gen.evaluate(() => !!window.NEWOSB_RULES), 'générateur : chargé sans erreur avec les règles partagées');
      await gen.evaluate(() => { document.getElementById('dataMode').value = 'demo'; return window.NEWOSB_ENGINE.connect(); });
      await gen.evaluate(() => { const el = [...document.querySelectorAll('#tabsNav *')].find(e => e.children.length === 0 && /Tunnel de certification/.test(e.textContent)); el && el.click(); }); await gen.waitForTimeout(500);
      const tops = await gen.$$eval('.tunnel-bubbles .tunnel-status', els => els.map(e => Math.round(e.getBoundingClientRect().top)));
      check(tops.length === 8 && new Set(tops).size === 1, `slide tunnel : 8 bulles sur une seule ligne (${tops.length})`);
      await context.close(); }

    console.log('\nB. Site non autorisé : le pont refuse de transmettre les données');
    { const { page, context } = await scenario(browser, origin, {}, { jsonFails: true });
      const rt = await page.evaluate(() => window.NEWOSB_ENGINE.getRuntime());
      const msg = await page.textContent('#dataFeedback');
      check(!rt.connected || rt.mode !== 'appsScript', 'aucune donnée chargée');
      check(/NEWOSB_ALLOWED_ORIGINS/.test(msg), 'message explicite : configurer NEWOSB_ALLOWED_ORIGINS');
      await context.close(); }

    console.log('\nE. Colonne d’avancement dont le nom est dupliqué dans la Sheet');
    { const dup = MATRIX.map((r, i) => (i === 1 ? [...r, 'Opération: Évaluation: Statut'] : [...r, i >= 3 && /^(Visite|Évaluation)/.test(r[54]) ? r[54] : '']));
      const { page, context } = await scenario(browser, origin, { NEWOSB_ALLOWED_ORIGINS: origin }, { matrix: dup });
      const st = Object.fromEntries(await page.evaluate(() => window.NEWOSB_ENGINE.getOperations().map(o => [o.code, o.status])));
      check(st['OP-1'] === 'notStarted' && st['OP-3'] === 'complete' && st['OP-6'] === 'visit', 'deux colonnes « Opération: Évaluation: Statut » : BC reste lue (Non démarrée, Dossier complet, Visite réalisée)');
      await page.click('button[data-page="quality"]'); await page.waitForTimeout(400);
      const qd = await page.textContent('#obsPage');
      check(qd.includes('nom de colonne en double') && qd.includes('Opération: Évaluation: Statut') && qd.includes('lue par sa position'), 'Qualité : le doublon de nom est signalé');
      await context.close(); }

    console.log('\nD. Performance : 6 000 lignes chargées en moins de 40 s');
    { const big = [MATRIX[0], MATRIX[1], MATRIX[2]]; const data = MATRIX.slice(3);
      for (let i = 0; i < 6000; i++) { const r = [...data[i % data.length]]; if (r[0]) r[0] = 'OP-' + (1000 + i); big.push(r); }
      const t0 = Date.now(); const { page, context } = await scenario(browser, origin, { NEWOSB_ALLOWED_ORIGINS: origin }, { matrix: big }); const ms = Date.now() - t0;
      const rt = await page.evaluate(() => window.NEWOSB_ENGINE.getRuntime());
      check(rt.connected && rt.count > 4000 && ms < 40000, `6 000 lignes : ${rt.count} projets en ${Math.round(ms / 1000)} s`);
      await context.close(); }

    console.log('\nC. Clé d’accès : obligatoire, jamais dans l’URL ni dans le stockage');
    { const { page, context, requests } = await scenario(browser, origin, { NEWOSB_ALLOWED_ORIGINS: origin }, { noKey: true });
      check(!(await page.evaluate(() => window.NEWOSB_ENGINE.getRuntime().connected)), 'sans clé : aucune donnée chargée');
      check(/clé d’accès/.test(await page.textContent('#dataFeedback')), 'sans clé : message demandant la clé');
      await page.evaluate(() => { document.getElementById('dataKey').value = 'mauvaise-cle-123456789'; }); await page.evaluate(() => window.NEWOSB_ENGINE.connect());
      check(!(await page.evaluate(() => window.NEWOSB_ENGINE.getRuntime().connected)) && /Accès refusé/.test(await page.textContent('#dataFeedback')), 'clé incorrecte : refus explicite, aucune donnée');
      await page.evaluate(k => { document.getElementById('dataKey').value = k; }, KEY); await page.evaluate(() => window.NEWOSB_ENGINE.connect());
      check(await page.evaluate(() => window.NEWOSB_ENGINE.getRuntime().connected), 'clé correcte : connexion');
      const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
      check(!storage.includes(KEY), 'clé absente de localStorage et sessionStorage');
      check(requests.every(u => !u.includes(KEY)), `clé jamais présente dans une URL (${requests.length} requêtes vers Apps Script)`);
      await page.reload(); await page.waitForFunction(() => window.NEWOSB_ENGINE);
      await page.waitForTimeout(400);
      check(!(await page.evaluate(() => window.NEWOSB_ENGINE.getRuntime().connected)), 'après rechargement : clé oubliée, pas de reconnexion silencieuse');
      await context.close(); }
    { const gs = loadGs('Code_Operations.gs', { matrix: MATRIX, properties: { NEWOSB_ACCESS_KEY: KEY, NEWOSB_ALLOWED_ORIGINS: origin } });
      check(JSON.parse(gs.doGet({ parameter: { mode: 'meta', key: KEY } }).text).ok === false, 'GET direct avec ?key= : refusé (lecture uniquement par le pont)'); }

    console.log('\nF. Exigences : fiche opération, encart de compatibilité, défilement, focus, largeurs d’écran');
    { const { page, context, errors } = await scenario(browser, origin, { NEWOSB_ALLOWED_ORIGINS: origin });
      // Fiche ouverte AVANT la connexion Exigences : état « non connectée », puis mise à jour sans perte du défilement.
      await page.click('button[data-page="operations"]'); await page.waitForTimeout(400);
      await page.evaluate(() => document.querySelector('[data-op-code="OP-1"]').click()); await page.waitForTimeout(400);
      let fiche = await page.evaluate(() => document.querySelector('[data-project-requirements]')?.textContent || '');
      check(/non connectée|indisponible/.test(fiche), 'fiche : état explicite (non connectée / indisponible) tant que les exigences ne sont pas chargées');
      await page.evaluate(() => { const sc = document.querySelector('[data-project-scroll]'); sc.scrollTop = 400; });
      const before = await page.evaluate(() => document.querySelector('[data-project-scroll]').scrollTop);
      // Connexion de la source Exigences (champs URL + clé de l'encart Source, simulés ici car la fiche est au premier plan).
      await page.evaluate(({ url, key }) => { const u = document.createElement('input'); u.id = 'reqSourceUrl'; u.value = url; const k = document.createElement('input'); k.id = 'reqSourceKey'; k.value = key; document.body.append(u, k); window.NEWOSB_REQUIREMENTS.handleClick({ target: { closest: s => s === '[data-req-connect]' ? {} : null, matches: () => false } }); u.remove(); k.remove(); }, { url: EXI, key: KEY });
      await page.waitForFunction(() => window.NEWOSB_REQUIREMENTS.status().connected, null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(300);
      fiche = await page.evaluate(() => document.querySelector('[data-project-requirements]')?.textContent || '');
      const after = await page.evaluate(() => document.querySelector('[data-project-scroll]').scrollTop);
      check(/Exigences distinctes/.test(fiche) && /2 évaluations ou versions/.test(fiche), 'fiche déjà ouverte : mise à jour à l’arrivée des exigences (2 évaluations séparées pour OP-1)');
      check(Math.abs(after - before) <= 2, `fiche : défilement conservé lors de la mise à jour (${before} → ${after})`);
      check(/1\.1\.1/.test(fiche) && /sélection documentée/.test(fiche) && !/aucune exigence sélectionnée/i.test(fiche), 'fiche : codes et intitulés affichés ; sélection ≠ validation');
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      // Onglet Exigences : encart en bas de page, pleine largeur.
      await page.click('button[data-page="requirements"]'); await page.waitForTimeout(500);
      const pos = await page.evaluate(() => { const c = document.querySelector('.req-compat-card'), pg = document.getElementById('obsPage'); const cards = [...pg.querySelectorAll('.obs-card')]; return { exists: !!c, last: cards[cards.length - 1] === c || cards.indexOf(c) >= cards.length - 1, width: c && c.getBoundingClientRect().width, pageW: pg.clientWidth }; });
      check(pos.exists && pos.last && pos.width > pos.pageW * 0.85, `encart présent en bas de page, pleine largeur (${Math.round(pos.width)} / ${pos.pageW} px)`);
      const txt = await page.textContent('.req-compat-card');
      check(/Référentiel comparé/.test(txt) && /BEE Logement Neuf/.test(txt) && /appliquées à toutes les versions/.test(txt) && /Opérations documentées/.test(txt), 'périmètre par défaut : BEE Logement Neuf (le plus documenté), toutes versions, effectif affiché');
      check(/Compatibilité des opérations filtrées avec chaque mention/.test(txt), 'tableau du pourcentage de compatibilité pour chaque mention');
      check(/Présente dans le bouquet comparé/.test(txt) && /Absente du bouquet comparé/.test(txt) && /l’obtention d’une mention reste soumise/.test(txt), 'légende et mention permanente affichées');
      // Conditions de contexte : régime, type, permis → 3 cartes calculées
      await page.click('.req-compat-fields > summary'); await page.waitForTimeout(150);
      for (const [f, v] of [['ln2026.regime', 'RE2020'], ['ln2026.buildingType', 'collectif'], ['ln2026.permit', '2025_2027']]) { await page.selectOption(`[data-req-compat-field="${f}"]`, v); await page.waitForTimeout(250); }
      check(await page.evaluate(() => document.activeElement && document.activeElement.matches('[data-req-compat-field="ln2026.permit"]')), 'focus conservé sur le menu de condition après recalcul');
      const cards = await page.$$eval('.req-compat-mention', els => els.map(e => ({ h: e.querySelector('h3')?.textContent, s: e.querySelector('.req-compat-score strong')?.textContent })));
      check(cards.length === 3, `trois cartes (${cards.map(c => c.h + ' ' + c.s).join(' | ')})`);
      // Choix manuel 3e carte : défilement et focus conservés
      await page.evaluate(() => { document.querySelector('.req-compat-card').scrollIntoView(); });
      const sTop = await page.evaluate(() => document.getElementById('obsPage').scrollTop);
      await page.selectOption('[data-req-compat-mention]', 'BEE_LR_2025_BEE_PLUS'); await page.waitForTimeout(400);
      const sAfter = await page.evaluate(() => document.getElementById('obsPage').scrollTop);
      check(Math.abs(sAfter - sTop) <= 4, `choix d’une mention : pas de retour en haut (${Math.round(sTop)} → ${Math.round(sAfter)})`);
      check(await page.evaluate(() => document.activeElement && document.activeElement.matches('[data-req-compat-mention]')), 'focus conservé sur le menu de la 3e carte');
      check(/Contexte différent/.test(await page.textContent('.req-compat-card')), 'mention d’un autre référentiel : incompatibilité de contexte affichée');
      // Filtre MOA (multicoche) → recalcul du bouquet, défilement conservé
      const nOps = async () => page.evaluate(() => window.NEWOSB_REQUIREMENTS._compatSnapshot().contexts.find(c => c.key === 'BEE_LN@2026-05-04')?.operations || 0);
      const all = await nOps();
      await page.evaluate(() => { const i = [...document.querySelectorAll('[data-req-filter-check="moa"]')].find(x => x.value === 'Promoteur A'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(300);
      const onlyA = await nOps();
      check(all === 44 && onlyA === 3, `bouquet recalculé après filtre MOA (${all} → ${onlyA} opérations documentées)`);
      // Responsive : aucune barre de défilement horizontale
      for (const [w, cols] of [[1440, 3], [900, 2], [390, 1]]) {
        await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(300);
        const r = await page.evaluate(() => { const g = document.querySelector('.req-compat-grid'); const tops = new Set([...g.children].map(c => Math.round(c.getBoundingClientRect().top))); const pg = document.getElementById('obsPage'); return { rows: tops.size, overflow: document.documentElement.scrollWidth > window.innerWidth + 1 || g.scrollWidth > g.clientWidth + 1 }; });
        check(!r.overflow && (w < 1100 ? r.rows >= 2 : r.rows === 1), `largeur ${w}px : cartes ${w < 1100 ? 'empilées' : 'côte à côte'} sans défilement horizontal`);
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.check('#obsPrivacyToggle', { force: true }).catch(() => {}); await page.waitForTimeout(300);
      const anonHtml = await page.innerHTML('#obsPage');
      check(!anonHtml.includes('Promoteur A'), 'mode anonymisé : aucun nom de MOA dans l’onglet Exigences');
      check(errors.length === 0, 'aucune erreur JavaScript (Exigences, fiche, encart)' + (errors.length ? ' : ' + errors.slice(0, 3).join(' | ') : ''));
      await context.close(); }

    console.log('\nG. Présentation : exports PPTX, PNG et Google Slides');
    { const { page, context, errors, gs } = await scenario(browser, origin, { NEWOSB_ALLOWED_ORIGINS: origin });
      await page.click('button[data-page="overview"]'); await page.waitForTimeout(300);
      await page.locator('[data-add-presentation]').first().click(); await page.waitForTimeout(300);
      await page.click('button[data-page="presentation"]'); await page.waitForTimeout(500);
      const dl = page.waitForEvent('download', { timeout: 60000 });
      await page.click('[data-pres-export-pptx]');
      const d = await dl; const fp = await d.path(); const buf = fs.readFileSync(fp);
      const JSZip = require(path.join(ROOT, 'jszip.min.js'));
      const zip = await JSZip.loadAsync(buf); const media = Object.keys(zip.files).filter(f => f.startsWith('ppt/media/'));
      const slide2 = await zip.file('ppt/slides/slide2.xml').async('string');
      check(/\.pptx$/.test(d.suggestedFilename()) && media.length >= 3 && !slide2.includes('Visuel indisponible'), `PPTX : fichier produit avec le visuel de la slide (${media.length} images, auparavant « Visuel indisponible »)`);
      const dl2 = page.waitForEvent('download', { timeout: 60000 });
      await page.click('[data-pres-export="png"]');
      const d2 = await dl2; const png = fs.readFileSync(await d2.path());
      check(/\.png$/.test(d2.suggestedFilename()) && png.length > 20000 && png.slice(1, 4).toString() === 'PNG', `PNG 4K : image produite (${Math.round(png.length / 1024)} Ko)`);
      await context.route('https://docs.google.com/**', r => r.fulfill({ contentType: 'text/html', body: '<title>Slides</title>ok' }));
      const popupP = context.waitForEvent('page', { timeout: 15000 }).catch(() => null);
      await page.click('[data-pres-google-slides]');
      const popup = await popupP;
      check(!!popup, 'Google Slides : la fenêtre Google s’ouvre pendant le clic (non bloquée)');
      await page.waitForFunction(() => !document.querySelector('[data-pres-google-slides]')?.disabled, null, { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(500);
      const pres = gs.slidesLog.presentations;
      check(pres.length === 1 && pres[0].slides.length === 2 && pres[0].slides.every(sl => sl.images.length === 1 && sl.images[0].type === 'image/jpeg' && sl.images[0].bytes > 5000), `Google Slides : présentation créée avec ${pres[0]?.slides.length || 0} slides rendues en image`);
      if (popup) await popup.waitForURL(/docs\.google\.com/, { timeout: 10000 }).catch(() => {});
      check(popup && /docs\.google\.com\/presentation/.test(popup.url()), 'Google Slides : la présentation s’ouvre dans la fenêtre du pont (' + (popup && popup.url()) + ')');
      check(errors.length === 0, 'aucune erreur JavaScript pendant les exports' + (errors.length ? ' : ' + errors.slice(0, 3).join(' | ') : ''));
      await context.close(); }
    console.log('\nH. Liens de partage à durée limitée (V6.15)');
    { const { page, context, errors, gs } = await scenario(browser, origin, { NEWOSB_ALLOWED_ORIGINS: origin }, { extraSheets: { RAPPORT } });
      await page.evaluate(() => { const i = [...document.querySelectorAll('[data-global-filter-check="moa"]')].find(x => x.value === 'Promoteur A'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
      await page.waitForFunction(() => window.NEWOSB_REQUIREMENTS.status().connected || window.NEWOSB_REQUIREMENTS.status().error, null, { timeout: 30000 }).catch(() => {});
      const viaSt = await page.evaluate(() => window.NEWOSB_REQUIREMENTS.status());
      check(viaSt.via === 'operations' && viaSt.connected && viaSt.count > 0, `une seule connexion : les exigences sont chargées avec l’URL et la clé OPERATIONS (${viaSt.count} évaluations${viaSt.error ? ' · ' + viaSt.error : ''})`);
      const keepOpen = await page.evaluate(async () => {
        const find = sel => [...document.querySelectorAll(sel)].find(d => /Type de programme/.test(d.textContent));
        find('#obsFilters details').querySelector('summary').click(); await new Promise(r => setTimeout(r, 50));
        window.dispatchEvent(new CustomEvent('newosb:datachange')); await new Promise(r => setTimeout(r, 50));
        const globalOpen = !!find('#obsFilters details')?.open;
        document.querySelector('#obsNav [data-page="requirements"]').click(); await new Promise(r => setTimeout(r, 200));
        find('.obs-req-filter-host details').querySelector('summary').click(); await new Promise(r => setTimeout(r, 50));
        window.dispatchEvent(new CustomEvent('newosb:requirementschange')); await new Promise(r => setTimeout(r, 100));
        const reqOpen = !!find('.obs-req-filter-host details')?.open;
        const opts = find('.obs-req-filter-host details')?.querySelectorAll('[data-req-filter-check]').length || 0;
        document.querySelector('#obsNav [data-page="overview"]').click(); await new Promise(r => setTimeout(r, 100));
        return { globalOpen, reqOpen, opts };
      });
      check(keepOpen.globalOpen && keepOpen.reqOpen && keepOpen.opts > 0, `menu « Type de programme » : reste ouvert quand les filtres sont redessinés (global ${keepOpen.globalOpen}, Exigences ${keepOpen.reqOpen}, ${keepOpen.opts} choix)`);
      await page.evaluate(() => document.querySelectorAll('details[open]').forEach(d => { d.open = false; }));
      const adminCount = await page.textContent('#obsFilterCount');
      const pagesBefore = context.pages().length;
      const popupP = context.waitForEvent('page', { timeout: 15000 }).catch(() => null);
      await page.click('#obsShareBtn');
      const popup = await popupP;
      const listed = await page.waitForFunction(() => /Aucun lien créé/.test(document.querySelector('#obsShareModal')?.textContent || ''), null, { timeout: 30000 }).then(() => true, () => false);
      check(listed && (popup || pagesBefore > 1), 'Partager : fenêtre Google ouverte (ou réutilisée) pendant le clic, liste des liens lue par le pont');
      const scopeTxt = await page.textContent('.obs-share-scope');
      check(/\b3\b\s*opérations/.test(scopeTxt) && /Promoteur A/.test(scopeTxt), `Partager : périmètre figé = sélection affichée (${adminCount} opérations, MOA Promoteur A)`);
      await page.check('[data-share-tab][value="carbon"]');
      await page.check('[data-share-tab][value="requirements"]');
      await page.check('[data-share-tab][value="operations"]');
      await page.fill('[data-share-label]', 'Vue Promoteur A');
      await page.selectOption('[data-share-duration]', '7');
      await page.click('[data-share-create]');
      await page.waitForSelector('[data-share-link]', { timeout: 30000 }).catch(() => {});
      const link = await page.$eval('[data-share-link]', i => i.value).catch(() => '');
      check(/#partage=[A-Za-z0-9]{43}&src=https%3A%2F%2Fscript\.google\.com/.test(link), 'lien créé : jeton dans le fragment (#), source Apps Script jointe');
      const token = (link.match(/partage=([A-Za-z0-9]+)/) || [])[1] || '';
      const sheetTxt = JSON.stringify(gs.sheets.OBSERVATOIRE_PARTAGES?.data || []);
      check(token && !sheetTxt.includes(token) && sheetTxt.includes('OP-1') && sheetTxt.includes('OP-7') && !sheetTxt.includes('OP-3'), 'serveur : empreinte seule, périmètre = codes réels de la sélection');
      const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
      check(token && !stored.includes(token), 'le jeton n’est enregistré ni dans localStorage ni dans sessionStorage');
      await page.check('[data-share-anonymized]');
      await page.fill('[data-share-label]', '');
      await page.click('[data-share-create]');
      await page.waitForFunction(old => { const v = document.querySelector('[data-share-link]')?.value; return v && v !== old; }, link, { timeout: 30000 }).catch(() => {});
      const anonLink = await page.$eval('[data-share-link]', i => i.value).catch(() => '');
      const rows = await page.$$eval('.obs-share-table tbody tr', trs => trs.length).catch(() => 0);
      check(rows === 2, `liste des liens : ${rows} liens affichés`);
      check(errors.length === 0, 'administration : aucune erreur JavaScript' + (errors.length ? ' : ' + errors.join(' | ') : ''));

      const openShared = async (url, viewport) => {
        const ctx2 = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 } });
        await ctx2.route('https://script.google.com/**', async route => {
          const u = new URL(route.request().url()); const run = u.pathname.match(/\/__run\/(\w+)$/);
          if (run) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(gs[run[1]](JSON.parse(route.request().postData() || '{}'))) });
          const out = gs.doGet({ parameter: Object.fromEntries(u.searchParams.entries()) });
          if (out.html !== undefined) return route.fulfill({ contentType: 'text/html', body: out.html.replace('<script>', SHIM + '<script>') });
          return route.fulfill({ contentType: 'application/json', body: out.text });
        });
        const p2 = await ctx2.newPage(); const errs = []; p2.on('pageerror', e => errs.push(e.message));
        await p2.goto(url);
        await p2.waitForFunction(() => document.documentElement.classList.contains('newosb-share-ready') || /Accès impossible|invalide/.test(document.getElementById('obsPage')?.textContent || ''), null, { timeout: 40000 }).catch(() => {});
        return { p2, ctx2, errs };
      };
      { const { p2, ctx2, errs } = await openShared(link);
        check(await p2.evaluate(() => document.documentElement.classList.contains('newosb-share-ready')), 'destinataire : Observatoire chargé sans mot de passe ni clé');
        check(await p2.evaluate(() => !document.querySelector('#authScreen') || getComputedStyle(document.querySelector('#authScreen')).display === 'none'), 'destinataire : écran de mot de passe absent');
        const codes = await p2.evaluate(() => window.NEWOSB_ENGINE.getOperations().map(o => o.code).sort().join(','));
        check(codes === 'OP-1,OP-2,OP-7', `destinataire : uniquement les opérations du périmètre (${codes})`);
        const nav = await p2.$$eval('#obsNav [data-page]', bs => bs.filter(b => getComputedStyle(b).display !== 'none').map(b => b.dataset.page).join(','));
        check(nav === 'overview,requirements,carbon,operations', `destinataire : seuls les onglets accordés sont visibles (${nav})`);
        const hiddenCtl = await p2.evaluate(() => ['#obsSourceBtn', '#obsResetFilters', '#obsShareBtn', '#obsGeneratorBtn', '#obsRefreshBtn'].every(s => { const el = document.querySelector(s); return !el || getComputedStyle(el).display === 'none'; }));
        check(hiddenCtl, 'destinataire : boutons Données, Réinitialiser, Partager, Générateur et Actualiser masqués');
        const lockTxt = await p2.textContent('#obsFilters');
        check(/Périmètre figé/.test(lockTxt) && /Vue Promoteur A/.test(lockTxt) && /3 opérations/.test(lockTxt) && !(await p2.$('#obsFilters [data-global-filter-check]')), 'destinataire : filtres remplacés par le périmètre figé (aucune case modifiable)');
        await p2.click('#obsNav [data-page="carbon"]');
        const onCarbon = await p2.evaluate(() => document.querySelector('#obsNav [data-page="carbon"]').classList.contains('is-active') && /Carbone/.test(document.querySelector('#obsPage').textContent));
        check(onCarbon, 'destinataire : navigation entre les onglets accordés');
        await p2.evaluate(() => { const b = document.querySelector('#obsNav [data-page="territories"]'); b.hidden = false; b.click(); });
        const stillAllowed = await p2.evaluate(() => !document.querySelector('#obsNav [data-page="territories"]').classList.contains('is-active'));
        check(stillAllowed, 'destinataire : un onglet non accordé ne s’ouvre pas, même en forçant le bouton');
        await p2.waitForFunction(() => window.NEWOSB_REQUIREMENTS.status().connected || window.NEWOSB_REQUIREMENTS.status().error, null, { timeout: 30000 }).catch(() => {});
        await p2.click('#obsNav [data-page="requirements"]'); await p2.waitForTimeout(400);
        const reqTxt = (await p2.textContent('#obsPage')) + ' ' + (await p2.evaluate(() => document.querySelector('.obs-req-filter-host')?.textContent || '')); const reqSt = await p2.evaluate(() => window.NEWOSB_REQUIREMENTS.status());
        check(reqSt.connected && reqSt.count === 4 && /PÉRIMÈTRE PARTAGÉ/.test(reqTxt) && /Filtres figés/.test(reqTxt) && !(await p2.$('[data-req-filter-check]')) && !(await p2.$('#reqSourceKey')), `Exigences partagées : 4 évaluations des opérations du lien, sans clé ni URL, filtres verrouillés (${reqSt.count}${reqSt.error ? ' · ' + reqSt.error : ''})`);
        check(/Compatibilité/.test(reqTxt), 'Exigences partagées : encart de compatibilité avec les mentions affiché');
        await p2.click('#obsNav [data-page="operations"]'); await p2.waitForTimeout(400);
        await p2.evaluate(() => document.querySelector('[data-op-code="OP-1"]')?.click()); await p2.waitForTimeout(500);
        const fiche = await p2.evaluate(() => document.querySelector('[data-project-requirements]')?.textContent || '');
        check(/Exigences distinctes/.test(fiche) && /2 évaluations ou versions/.test(fiche), 'fiche partagée : exigences de l’opération affichées (2 évaluations pour OP-1)');
        await p2.keyboard.press('Escape');
        const auth = await p2.evaluate(() => sessionStorage.getItem('prestaterre-observatoire-v21-auth'));
        check(auth === null, 'destinataire : l’accès n’ouvre pas l’Observatoire complet (aucune session mémorisée)');
        check(errs.length === 0, 'destinataire : aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
        await ctx2.close(); }
      { const { p2, ctx2, errs } = await openShared(anonLink, { width: 390, height: 844 });
        const body = await p2.evaluate(() => document.body.innerText);
        const ok = await p2.evaluate(() => document.documentElement.classList.contains('newosb-share-ready'));
        check(ok && !/Promoteur A|Les Jardins|33400/.test(body), 'lien anonymisé : ni MOA, ni nom d’opération, ni code postal dans la page' + (ok ? ' ' + (body.match(/.{0,60}(Promoteur A|Les Jardins|33400).{0,60}/) || [''])[0] : ' (non chargé)'));
        check(await p2.evaluate(() => getComputedStyle(document.querySelector('.obs-privacy-dock')).display === 'none'), 'lien anonymisé : interrupteur d’anonymisation masqué (mode imposé)');
        await p2.waitForFunction(() => window.NEWOSB_REQUIREMENTS.status().connected || window.NEWOSB_REQUIREMENTS.status().error, null, { timeout: 30000 }).catch(() => {});
        await p2.evaluate(() => document.querySelector('#obsNav [data-page="requirements"]').click()); await p2.waitForTimeout(400);
        const reqBody = await p2.evaluate(() => document.body.innerText); const reqN = await p2.evaluate(() => window.NEWOSB_REQUIREMENTS.status().count);
        check(reqN === 4 && !/Promoteur A|EVA-OP-1/.test(reqBody), `lien anonymisé : Exigences chargées (${reqN} évaluations) sans nom de MOA ni code d’évaluation réel`);
        await p2.evaluate(() => document.querySelector('#obsNav [data-page="operations"]').click()); await p2.waitForTimeout(400);
        await p2.evaluate(() => document.querySelector('[data-op-code]')?.click()); await p2.waitForTimeout(500);
        const anonFiche = await p2.evaluate(() => document.querySelector('[data-project-requirements]')?.textContent || '');
        check(/Exigences distinctes/.test(anonFiche) && !/Promoteur A/.test(anonFiche), 'lien anonymisé : la fiche retrouve les exigences de l’opération (pseudonymes identiques des deux côtés)');
        await p2.keyboard.press('Escape');
        check(await p2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'lien partagé lisible sur téléphone (pas de défilement horizontal)');
        check(errs.length === 0, 'lien anonymisé : aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
        await ctx2.close(); }
      const list = gs.newosbBridgeRequest({ mode: 'shareList', key: KEY }).shares;
      gs.newosbBridgeRequest({ mode: 'shareRevoke', key: KEY, id: list.find(s => !s.anonymized).id });
      { const { p2, ctx2 } = await openShared(link);
        const txt = await p2.textContent('#obsPage'); const n = await p2.evaluate(() => window.NEWOSB_ENGINE.getOperations().length);
        check(/Accès impossible/.test(txt) && /révoqué/.test(txt) && !(await p2.evaluate(() => window.NEWOSB_ENGINE.getRuntime().connected)), `lien révoqué : accès refusé, aucune donnée réelle — ${txt.slice(0, 200)}`);
        await ctx2.close(); }
      gs.sheets.OBSERVATOIRE_PARTAGES.data.slice(1).forEach(r => { r[4] = String(Date.now() - 1000); });
      { const { p2, ctx2 } = await openShared(anonLink);
        const txt = await p2.textContent('#obsPage');
        check(/Accès impossible/.test(txt) && /expiré/.test(txt), 'lien expiré : accès refusé avec un message clair — ' + txt.slice(0, 200));
        await ctx2.close(); }
      await context.close(); }
    console.log('\nI. Mini-jeu pendant le chargement des données (V6.16)');
    { const { page, context, errors } = await scenario(browser, origin, { NEWOSB_ALLOWED_ORIGINS: origin }, { noConnect: true, delayMs: 900 });
      const startLoad = () => page.evaluate(({ url, key }) => { document.getElementById('dataMode').value = 'appsScript'; document.getElementById('dataUrl').value = url; document.getElementById('dataKey').value = key; window.__load = window.NEWOSB_ENGINE.connect(); }, { url: EXEC, key: KEY });
      await page.evaluate(() => window.NEWOSB_ENGINE.showDataSource());
      await startLoad();
      const shown = await page.waitForSelector('#obsGame:not([hidden])', { timeout: 8000 }).then(() => true, () => false);
      check(shown && /OPERATIONS/.test(await page.textContent('#obsGameTitle')), 'le jeu s’ouvre pendant le chargement OPERATIONS');
      await page.bringToFront();
      const x0 = (await page.evaluate(() => window.NEWOSB_GAME._state())).player.x;
      await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(350); await page.keyboard.up('ArrowLeft');
      const st = await page.evaluate(() => window.NEWOSB_GAME._state());
      check(st.phase === 'play' && st.player.x < x0, `flèches du clavier : le personnage se déplace (${x0} → ${st.player.x.toFixed(2)})`);
      check(await page.$eval('[data-game-enter]', b => b.disabled), 'accès à l’Observatoire désactivé tant que les données ne sont pas chargées');
      check(await page.evaluate(() => document.documentElement.scrollTop === 0 && window.scrollY === 0), 'les flèches ne font pas défiler la page');
      await page.screenshot({ path: path.join(process.env.SHOT_DIR || require('os').tmpdir(), 'game_play.png') }).catch(() => {});
      await page.waitForFunction(() => !document.querySelector('[data-game-enter]').disabled, null, { timeout: 60000 }).catch(() => {});
      const statusTxt = await page.textContent('[data-game-status]');
      check(await page.evaluate(() => !document.getElementById('obsGame').hidden) && /✓/.test(statusTxt), `données chargées pendant la partie : le jeu reste ouvert, bouton d’accès actif (${statusTxt.trim()})`);
      await page.screenshot({ path: path.join(process.env.SHOT_DIR || require('os').tmpdir(), 'game_loaded.png') }).catch(() => {});
      await page.keyboard.press('Enter');
      const after = await page.evaluate(() => ({ game: document.getElementById('obsGame').hidden, modal: document.getElementById('dataConnectModal').hidden, connected: window.NEWOSB_ENGINE.getRuntime().connected }));
      check(after.game && after.modal && after.connected, 'Entrée : on quitte la partie et on arrive sur l’Observatoire (fenêtre Données refermée)');
      await startLoad();
      await page.waitForSelector('#obsGame:not([hidden])', { timeout: 8000 }).catch(() => {});
      await page.evaluate(() => window.__load);
      const autoClosed = await page.waitForFunction(() => document.getElementById('obsGame').hidden, null, { timeout: 20000 }).then(() => true, () => false);
      check(autoClosed, 'sans avoir joué : l’Observatoire s’affiche dès la fin du chargement');
      await startLoad();
      await page.waitForSelector('#obsGame:not([hidden])', { timeout: 8000 }).catch(() => {});
      await page.keyboard.press('Escape');
      const hiddenNow = await page.evaluate(() => document.getElementById('obsGame').hidden);
      await page.evaluate(() => window.__load);
      check(hiddenNow && await page.evaluate(() => window.NEWOSB_ENGINE.getRuntime().connected), 'Échap masque le jeu ; le chargement continue');
      check(errors.length === 0, 'mini-jeu : aucune erreur JavaScript' + (errors.length ? ' : ' + errors.join(' | ') : ''));
      await context.close(); }
  } finally { await browser.close(); server.close(); }
  console.log(`\n${passed} vérifications navigateur réussies, ${failed} en échec.`);
  process.exit(failed ? 1 : 0);
})();
