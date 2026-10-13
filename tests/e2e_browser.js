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

async function scenario(browser, origin, properties, { jsonFails = false, matrix = MATRIX, noKey = false, viewport, extraSheets = {}, delayMs = 0, noConnect = false, beforeGoto = null } = {}) {
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
  if (beforeGoto) await beforeGoto(context);
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
      // --- V6.30 : tuiles colorées et vue camembert (mentions, performances) ---
      for (const kind of ['mention', 'performance']) {
        await page.evaluate(k => document.querySelector(`[data-table-view="${k}"][data-view="tiles"]`).click(), kind); await page.waitForTimeout(300);
        const tiles = await page.evaluate(k => { const b = document.querySelector(`[data-table-view="${k}"]`).closest('.obs-card'); const ts = [...b.querySelectorAll('.obs-table-tiles.is-colored .obs-table-tile')]; return { n: ts.length, colors: new Set(ts.map(t => t.style.getPropertyValue('--tile-color'))).size }; }, kind);
        check(tiles.n > 0 && tiles.colors > Math.min(1, tiles.n - 1), `${kind} : tuiles colorées (${tiles.n} tuiles, ${tiles.colors} couleurs)`);
        await page.evaluate(k => document.querySelector(`[data-table-view="${k}"][data-view="pie"]`).click(), kind); await page.waitForTimeout(300);
        const pie = await page.evaluate(k => { const b = document.querySelector(`[data-table-view="${k}"]`).closest('.obs-card'); return { chart: !!b.querySelector('.obs-pie-chart'), legend: b.querySelectorAll('.obs-pie-legend > *').length, note: !!b.querySelector('.obs-pie-note') }; }, kind);
        check(pie.chart && pie.legend > 0 && pie.note, `${kind} : vue camembert avec légende (${pie.legend} entrées)`);
        await page.evaluate(k => document.querySelector(`[data-table-view="${k}"][data-view="list"]`).click(), kind); await page.waitForTimeout(200);
      }
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

    console.log('\nG. Présentation : boîte de captures, slides composées, exports PPTX, PNG et Google Slides');
    { const { page, context, errors, gs } = await scenario(browser, origin, { NEWOSB_ALLOWED_ORIGINS: origin });
      await page.click('button[data-page="overview"]'); await page.waitForTimeout(300);
      for (let i = 0; i < 4; i++) { await page.locator('[data-add-presentation]').nth(i).click(); await page.waitForTimeout(250); }
      await page.click('button[data-page="presentation"]'); await page.waitForTimeout(500);
      const box = await page.evaluate(() => ({ caps: document.querySelectorAll('[data-pres-capture-check]').length, checked: document.querySelectorAll('[data-pres-capture-check]:checked').length, slides: document.querySelectorAll('[data-pres-select]').length }));
      check(box.caps === 4 && box.checked === 4 && box.slides === 1, `▣ dépose les visuels dans la boîte de captures, sans créer de slide (${JSON.stringify(box)})`);
      const tick = async idx => { await page.click('[data-pres-capture-none]').catch(() => {}); for (const i of idx) { await page.locator('[data-pres-capture-check]').nth(i).check(); await page.waitForTimeout(80); } };
      await tick([0]); await page.click('[data-pres-new-slide]'); await page.waitForTimeout(400);
      await tick([1, 2, 3]); await page.click('[data-pres-new-slide]'); await page.waitForTimeout(500);
      const lay = await page.evaluate(() => { const its = [...document.querySelectorAll('#obsPresentationStage .obs-pres-item')].map(e => ({ x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight })); const area = document.querySelector('#obsPresentationStage .obs-pres-items'); const overlap = its.some((a, i) => its.some((b, j) => i < j && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)); const inside = its.every(a => a.x >= 0 && a.y >= 0 && a.x + a.w <= area.offsetWidth + 1 && a.y + a.h <= area.offsetHeight + 1); const scaled = [...document.querySelectorAll('#obsPresentationStage .obs-pres-item-scaler')].every(e => /scale\(/.test(e.style.transform)); return { n: its.length, overlap, inside, scaled, slides: document.querySelectorAll('[data-pres-select]').length, titles: document.querySelectorAll('#obsPresentationStage .obs-pres-item-head').length }; });
      check(lay.n === 3 && !lay.overlap && lay.inside && lay.scaled && lay.titles === 3 && lay.slides === 3, `nouvelle slide avec 3 captures cochées : disposées sans chevauchement, mises à l’échelle, titrées (${JSON.stringify(lay)})`);
      await page.selectOption('[data-pres-field="layout"]', 'feature'); await page.waitForTimeout(300);
      const feat = await page.evaluate(() => { const its = [...document.querySelectorAll('#obsPresentationStage .obs-pres-item')]; return its.length === 3 && its[0].offsetHeight > its[1].offsetHeight * 1.8 && its[1].offsetLeft > its[0].offsetLeft; });
      check(feat, 'disposition « Mise en avant » : un grand visuel et les autres empilés à côté');
      const order = () => page.$$eval('#obsPresentationStage .obs-pres-item-head b', bs => bs.map(b => b.textContent).join(' | '));
      const o1 = await order();
      await page.dragAndDrop('#obsPresentationStage .obs-pres-item:nth-child(1) [data-pres-drag-item]', '#obsPresentationStage .obs-pres-item:nth-child(3)'); await page.waitForTimeout(400);
      const o2 = await order(), t = o1.split(' | ');
      check(o2 === [t[1], t[2], t[0]].join(' | '), `glisser-déposer sur la slide : le visuel prend la place de celui où il est déposé (${o1} → ${o2})`);
      await page.dragAndDrop('.obs-pres-item-list li:nth-child(3)', '.obs-pres-item-list li:nth-child(1)'); await page.waitForTimeout(400);
      check(await order() === o1, 'glisser-déposer dans la liste de l’éditeur : ordre rétabli');
      const jump = await page.evaluate(async () => { const sc = document.scrollingElement, pg = document.getElementById('obsPage'); pg.scrollTop = 160; sc.scrollTop = 120; const box = document.querySelector('[data-pres-stage-fit]'); const before = [pg.scrollTop, sc.scrollTop, box.offsetHeight]; const cb = document.querySelector('[data-pres-capture-check]'); cb.click(); await new Promise(r => setTimeout(r, 300)); const after = [pg.scrollTop, sc.scrollTop, document.querySelector('[data-pres-stage-fit]').offsetHeight]; const btn = document.querySelector('[data-pres-new-slide]').textContent; cb.click(); return { before, after, btn, same: document.querySelector('[data-pres-stage-fit]') === box }; });
      check(JSON.stringify(jump.before) === JSON.stringify(jump.after) && jump.same && /Nouvelle slide \(1\)/.test(jump.btn), `cocher une capture ne fait plus sauter la page (${JSON.stringify(jump)})`);
      await page.click('[data-pres-item-remove]'); await page.waitForTimeout(300);
      check(await page.evaluate(() => document.querySelectorAll('#obsPresentationStage .obs-pres-item').length === 2 && document.querySelectorAll('[data-pres-capture-check]').length === 4), 'retirer un visuel de la slide le garde dans la boîte');
      await page.click('[data-pres-select]:nth-child(2)'); await page.waitForTimeout(300);
      const dl = page.waitForEvent('download', { timeout: 60000 });
      await page.click('[data-pres-export-pptx]');
      const d = await dl; const fp = await d.path(); const buf = fs.readFileSync(fp);
      const JSZip = require(path.join(ROOT, 'jszip.min.js'));
      const zip = await JSZip.loadAsync(buf); const media = Object.keys(zip.files).filter(f => f.startsWith('ppt/media/'));
      const slide2 = await zip.file('ppt/slides/slide2.xml').async('string');
      const slideFiles = Object.keys(zip.files).filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f));
      check(/\.pptx$/.test(d.suggestedFilename()) && slideFiles.length === 3 && media.length >= 4 && !slide2.includes('Visuel indisponible') && !(await zip.file('ppt/slides/slide3.xml').async('string')).includes('Visuel indisponible'), `PPTX : 3 slides produites avec leurs visuels (${slideFiles.length} slides, ${media.length} images)`);
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
      check(pres.length === 1 && pres[0].slides.length === 3 && pres[0].slides.every(sl => sl.images.length === 1 && sl.images[0].type === 'image/jpeg' && sl.images[0].bytes > 5000), `Google Slides : présentation créée avec ${pres[0]?.slides.length || 0} slides rendues en image`);
      if (popup) await popup.waitForURL(/docs\.google\.com/, { timeout: 10000 }).catch(() => {});
      check(popup && /docs\.google\.com\/presentation/.test(popup.url()), 'Google Slides : la présentation s’ouvre dans la fenêtre du pont (' + (popup && popup.url()) + ')');
      // Générateur de rapports : ouvre la dernière version d'Obslide ; repli sur generator.html si elle ne répond pas.
      let obslideUp = true;
      await context.route('https://cedriccovarel.github.io/obslide/**', r => obslideUp ? r.fulfill({ contentType: 'text/html', body: '<title>Obslide</title>ok' }) : r.fulfill({ status: 404, body: 'Not found' }));
      const openGen = async () => { const pp = context.waitForEvent('page', { timeout: 15000 }); await page.click('#obsGeneratorBtn'); const w = await pp; await w.waitForURL(u => !/^about:blank/.test(String(u)), { timeout: 15000 }).catch(() => {}); const u = w.url(); await w.close(); return u; };
      const genUp = await openGen(); obslideUp = false; const genDown = await openGen();
      check(/^https:\/\/cedriccovarel\.github\.io\/obslide\/\?newosbScope=newosb_/.test(genUp) && /\/generator\.html\?newosbScope=newosb_/.test(genDown), `« Générateur de rapports » ouvre la dernière version d’Obslide, avec repli sur la copie intégrée (${genUp} | ${genDown.replace(origin, '')})`);
      // Présentation enregistrée par une version précédente (un visuel par slide) : reprise sans perte.
      await page.evaluate(() => localStorage.setItem('newosb_v0518_presentation', JSON.stringify({ slides: [{ id: 'cover_1', type: 'cover', title: 'Ancienne' }, { id: 'slide_old', type: 'content', title: 'Ancien graphique', kicker: 'K', legend: 'L', scope: 'S', contentHtml: '<div class="obs-card"><p>Visuel ancien</p></div>' }], activeId: 'slide_old', counter: 2 })));
      await page.reload(); await page.waitForFunction(() => window.NEWOSB_ENGINE); await page.click('button[data-page="presentation"]'); await page.waitForTimeout(500);
      const old = await page.evaluate(() => ({ caps: [...document.querySelectorAll('.obs-pres-capture-text b')].map(b => b.textContent), stage: document.querySelector('#obsPresentationStage .obs-pres-items')?.textContent || '', title: document.querySelector('#obsPresentationStage h2')?.textContent }));
      check(old.caps.length === 1 && old.caps[0] === 'Ancien graphique' && /Visuel ancien/.test(old.stage) && old.title === 'Ancien graphique', `présentation d’une version précédente : la slide garde son visuel, devenu une capture de la boîte (${JSON.stringify(old)})`);
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
      await page.click('[data-share-allowed] > summary');
      await page.check('[data-share-allow-global][value="region"]');
      await page.check('[data-share-allow-req][value="nature"]');
      await page.evaluate(() => document.querySelector('[data-share-allowed]')?.scrollIntoView({ block: 'center' }));
      await page.screenshot({ path: path.join(process.env.SHOT_DIR || require('os').tmpdir(), 'share_admin_allowed.png') }).catch(() => {});
      await page.click('[data-share-create]');
      await page.waitForSelector('[data-share-link]', { timeout: 30000 }).catch(() => {});
      const link = await page.$eval('[data-share-link]', i => i.value).catch(() => '');
      check(/#partage=[A-Za-z0-9]{43}&src=https%3A%2F%2Fscript\.google\.com/.test(link), 'lien créé : jeton dans le fragment (#), source Apps Script jointe');
      const token = (link.match(/partage=([A-Za-z0-9]+)/) || [])[1] || '';
      const sheetTxt = JSON.stringify(gs.sheets.OBSERVATOIRE_PARTAGES?.data || []);
      check(sheetTxt.includes('region') && sheetTxt.includes('nature'), 'serveur : filtres autorisés enregistrés avec le lien (Région, Nature)');
      check(token && !sheetTxt.includes(token) && sheetTxt.includes('OP-1') && sheetTxt.includes('OP-7') && !sheetTxt.includes('OP-3'), 'serveur : empreinte seule, périmètre = codes réels de la sélection');
      const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
      check(token && !stored.includes(token), 'le jeton n’est enregistré ni dans localStorage ni dans sessionStorage');
      check(await page.evaluate(() => document.querySelector('[data-share-allowed]').open && document.querySelector('[data-share-allow-global][value="region"]').checked), 'Partager : les filtres autorisés restent cochés après la création');
      await page.uncheck('[data-share-allow-global][value="region"]');
      await page.uncheck('[data-share-allow-req][value="nature"]');
      await page.check('[data-share-anonymized]');
      await page.fill('[data-share-label]', '');
      await page.click('[data-share-create]');
      await page.waitForFunction(old => { const v = document.querySelector('[data-share-link]')?.value; return v && v !== old; }, link, { timeout: 30000 }).catch(() => {});
      const anonLink = await page.$eval('[data-share-link]', i => i.value).catch(() => '');
      const rows = await page.$$eval('.obs-share-table tbody tr:not(.obs-share-people-row)', trs => trs.filter(tr => !tr.closest('.obs-share-visitors')).length).catch(() => 0);
      check(rows === 2, `liste des liens : ${rows} liens affichés`);
      check(errors.length === 0, 'administration : aucune erreur JavaScript' + (errors.length ? ' : ' + errors.join(' | ') : ''));

      const ID = { lastName: 'Martin', firstName: 'Claire', company: 'Bailleur Test' };
      const openShared = async (url, viewport, { identity = ID, reuse = null } = {}) => {
        const ctx2 = reuse || await browser.newContext({ viewport: viewport || { width: 1280, height: 900 } });
        if (!reuse) await ctx2.route('https://script.google.com/**', async route => {
          const u = new URL(route.request().url()); const run = u.pathname.match(/\/__run\/(\w+)$/);
          if (run) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(gs[run[1]](JSON.parse(route.request().postData() || '{}'))) });
          const out = gs.doGet({ parameter: Object.fromEntries(u.searchParams.entries()) });
          if (out.html !== undefined) return route.fulfill({ contentType: 'text/html', body: out.html.replace('<script>', SHIM + '<script>') });
          return route.fulfill({ contentType: 'application/json', body: out.text });
        });
        const p2 = await ctx2.newPage(); const errs = []; p2.on('pageerror', e => errs.push(e.message));
        await p2.goto(url);
        const settled = () => p2.waitForFunction(() => document.documentElement.classList.contains('newosb-share-ready') || !!document.querySelector('[data-share-identity]') || /Accès impossible|invalide/.test(document.getElementById('obsPage')?.textContent || ''), null, { timeout: 40000 }).catch(() => {});
        await settled();
        const asked = !!(await p2.$('[data-share-identity]'));
        if (asked && identity) {
          await p2.fill('[data-share-identity] [name="lastName"]', identity.lastName); await p2.fill('[data-share-identity] [name="firstName"]', identity.firstName); await p2.fill('[data-share-identity] [name="company"]', identity.company);
          await p2.click('[data-share-identity] button[type="submit"]');
          await p2.waitForFunction(() => document.documentElement.classList.contains('newosb-share-ready') || /Accès impossible|invalide/.test(document.getElementById('obsPage')?.textContent || ''), null, { timeout: 40000 }).catch(() => {});
        }
        return { p2, ctx2, errs, asked };
      };
      { const gate = await openShared(link, null, { identity: null });
        const gateTxt = await gate.p2.textContent('#obsPage');
        check(gate.asked && /Vue Promoteur A/.test(gateTxt) && !(await gate.p2.evaluate(() => window.NEWOSB_ENGINE.getRuntime().connected || window.NEWOSB_ENGINE.getOperations().length > 0)), 'destinataire : nom, prénom et société demandés avant toute donnée');
        await gate.p2.screenshot({ path: path.join(process.env.SHOT_DIR || require('os').tmpdir(), 'share_identity.png') }).catch(() => {});
        await gate.p2.click('[data-share-identity] button[type="submit"]'); await gate.p2.waitForTimeout(200);
        check(/nom, votre prénom et votre société/.test(await gate.p2.textContent('#obsPage')), 'formulaire incomplet : message, aucune donnée chargée');
        await gate.ctx2.close(); }
      let recipientCtx = null;
      { const { p2, ctx2, errs, asked } = await openShared(link);
        recipientCtx = ctx2;
        check(asked && await p2.evaluate(() => document.documentElement.classList.contains('newosb-share-ready')), 'destinataire : identité saisie une fois, Observatoire chargé sans mot de passe ni clé');
        const visitorsSheet = JSON.stringify(gs.sheets.OBSERVATOIRE_PARTAGES_VISITEURS?.data || []);
        check(/Martin/.test(visitorsSheet) && /Claire/.test(visitorsSheet) && /Bailleur Test/.test(visitorsSheet), 'serveur : la personne est enregistrée (nom, prénom, société) dans la feuille cachée des destinataires');
        check(await p2.evaluate(() => !document.querySelector('#authScreen') || getComputedStyle(document.querySelector('#authScreen')).display === 'none'), 'destinataire : écran de mot de passe absent');
        const codes = await p2.evaluate(() => window.NEWOSB_ENGINE.getOperations().map(o => o.code).sort().join(','));
        check(codes === 'OP-1,OP-2,OP-7', `destinataire : uniquement les opérations du périmètre (${codes})`);
        const nav = await p2.$$eval('#obsNav [data-page]', bs => bs.filter(b => getComputedStyle(b).display !== 'none').map(b => b.dataset.page).join(','));
        check(nav === 'overview,requirements,carbon,operations', `destinataire : seuls les onglets accordés sont visibles (${nav})`);
        const hiddenCtl = await p2.evaluate(() => ['#obsSourceBtn', '#obsResetFilters', '#obsShareBtn', '#obsGeneratorBtn', '#obsRefreshBtn'].every(s => { const el = document.querySelector(s); return !el || getComputedStyle(el).display === 'none'; }));
        check(hiddenCtl, 'destinataire : boutons Données, Réinitialiser, Partager, Générateur et Actualiser masqués');
        const lockTxt = await p2.textContent('#obsFilters');
        const allowedKeys = await p2.$$eval('#obsFilters [data-global-filter-check]', is => [...new Set(is.map(i => i.dataset.globalFilterCheck))].join(','));
        check(/Périmètre figé/.test(lockTxt) && /Vue Promoteur A/.test(lockTxt) && /3 opérations/.test(lockTxt) && /Claire Martin · Bailleur Test/.test(lockTxt) && allowedKeys === 'region', `destinataire : périmètre figé + seul le filtre autorisé est modifiable (${allowedKeys})`);
        const regionUse = await p2.evaluate(async () => {
          const box = document.querySelector('#obsFilters [data-global-filter-check="region"]'); box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 150));
          const filtered = document.getElementById('obsFilterCount')?.textContent || '';
          document.querySelector('#obsFilters [data-global-filter-clear="region"]').click(); await new Promise(r => setTimeout(r, 150));
          return { filtered, after: document.getElementById('obsFilterCount')?.textContent || '', codes: window.NEWOSB_ENGINE.getOperations().length };
        });
        check(Number(regionUse.filtered) >= 1 && Number(regionUse.filtered) <= 3 && regionUse.after === '3' && regionUse.codes === 3, `filtre autorisé utilisable, toujours dans le périmètre (${regionUse.filtered} puis ${regionUse.after})`);
        await p2.click('#obsNav [data-page="carbon"]');
        const onCarbon = await p2.evaluate(() => document.querySelector('#obsNav [data-page="carbon"]').classList.contains('is-active') && /Carbone/.test(document.querySelector('#obsPage').textContent));
        check(onCarbon, 'destinataire : navigation entre les onglets accordés');
        await p2.evaluate(() => { const b = document.querySelector('#obsNav [data-page="territories"]'); b.hidden = false; b.click(); });
        const stillAllowed = await p2.evaluate(() => !document.querySelector('#obsNav [data-page="territories"]').classList.contains('is-active'));
        check(stillAllowed, 'destinataire : un onglet non accordé ne s’ouvre pas, même en forçant le bouton');
        await p2.waitForFunction(() => window.NEWOSB_REQUIREMENTS.status().connected || window.NEWOSB_REQUIREMENTS.status().error, null, { timeout: 30000 }).catch(() => {});
        await p2.click('#obsNav [data-page="requirements"]'); await p2.waitForTimeout(400);
        const reqTxt = (await p2.textContent('#obsPage')) + ' ' + (await p2.evaluate(() => document.querySelector('.obs-req-filter-host')?.textContent || '')); const reqSt = await p2.evaluate(() => window.NEWOSB_REQUIREMENTS.status());
        check(reqSt.connected && reqSt.count === 4 && /PÉRIMÈTRE PARTAGÉ/.test(reqTxt) && /Filtres figés/.test(reqTxt) && !(await p2.$('#reqSourceKey')), `Exigences partagées : 4 évaluations des opérations du lien, sans clé ni URL (${reqSt.count}${reqSt.error ? ' · ' + reqSt.error : ''})`);
        const reqKeys = await p2.$$eval('[data-req-filter-check]', is => [...new Set(is.map(i => i.dataset.reqFilterCheck))].join(','));
        check(reqKeys === 'nature', `Exigences partagées : seul le filtre autorisé (Nature) est modifiable (${reqKeys})`);
        check(/Compatibilité/.test(reqTxt), 'Exigences partagées : encart de compatibilité avec les mentions affiché');
        await p2.click('#obsNav [data-page="operations"]'); await p2.waitForTimeout(400);
        await p2.evaluate(() => document.querySelector('[data-op-code="OP-1"]')?.click()); await p2.waitForTimeout(500);
        const fiche = await p2.evaluate(() => document.querySelector('[data-project-requirements]')?.textContent || '');
        check(/Exigences distinctes/.test(fiche) && /2 évaluations ou versions/.test(fiche), 'fiche partagée : exigences de l’opération affichées (2 évaluations pour OP-1)');
        await p2.keyboard.press('Escape');
        const auth = await p2.evaluate(() => sessionStorage.getItem('prestaterre-observatoire-v21-auth'));
        check(auth === null, 'destinataire : l’accès n’ouvre pas l’Observatoire complet (aucune session mémorisée)');
        check(errs.length === 0, 'destinataire : aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
        await p2.close(); }
      { const { p2, asked } = await openShared(link, null, { identity: null, reuse: recipientCtx });
        check(!asked && await p2.evaluate(() => document.documentElement.classList.contains('newosb-share-ready')), 'deuxième ouverture du lien : identité non redemandée');
        await p2.close(); }
      { // Administration : la personne apparaît sous le lien ; révocation individuelle.
        await page.click('.data-close[data-share-close]');
        await page.click('#obsShareBtn');
        await page.waitForFunction(() => /1 personne/.test(document.querySelector('#obsShareModal')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
        await page.evaluate(() => document.querySelectorAll('[data-share-people]').forEach(d => { if (/1 personne/.test(d.querySelector('summary').textContent)) d.open = true; }));
        const people = await page.evaluate(() => document.querySelector('.obs-share-visitors')?.textContent || '');
        const listTxt = await page.textContent('#obsShareModal');
        check(/Martin Claire/.test(people) && /Bailleur Test/.test(people) && /Actif/.test(people) && /1 personne · 1 accès actif · 2 filtres autorisés/.test(listTxt), 'Partager : la personne (nom, prénom, société) et les filtres autorisés sont listés sous le lien');
        await page.evaluate(() => document.querySelector('.obs-share-visitors')?.scrollIntoView({ block: 'center' }));
        await page.screenshot({ path: path.join(process.env.SHOT_DIR || require('os').tmpdir(), 'share_admin_people.png') }).catch(() => {});
        await page.evaluate(() => { window.__confirm = window.confirm; window.confirm = () => true; });
        await page.click('[data-visitor-revoke]');
        await page.waitForFunction(() => /Révoqué/.test(document.querySelector('.obs-share-visitors')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
        check(/Révoqué/.test(await page.evaluate(() => document.querySelector('.obs-share-visitors')?.textContent || '')), 'Partager : accès de la personne révoqué individuellement');
        const { p2 } = await openShared(link, null, { identity: null, reuse: recipientCtx });
        const txt = await p2.textContent('#obsPage');
        check(/Accès impossible/.test(txt) && /révoqué/.test(txt) && !(await p2.evaluate(() => window.NEWOSB_ENGINE.getRuntime().connected)), 'personne révoquée : accès refusé, aucune donnée — ' + txt.slice(0, 120));
        await recipientCtx.close();
        const other = await openShared(link, null, { identity: { lastName: 'Durand', firstName: 'Paul', company: 'Autre Société' } });
        check(await other.p2.evaluate(() => document.documentElement.classList.contains('newosb-share-ready')), 'les autres personnes gardent leur accès au lien');
        await other.ctx2.close(); }
      { const { p2, ctx2, errs } = await openShared(anonLink, { width: 390, height: 844 });
        check(await p2.evaluate(() => !document.querySelector('#obsFilters [data-global-filter-check]')), 'lien sans filtre autorisé : aucune case modifiable');
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
    console.log('\nJ. Carte territoriale : fond neutre, zoom région / département, pastilles (V6.23)');
    { // Géométries synthétiques (carrés) : aucune donnée réelle. Le fichier « détaillé » a plus de points.
      const sq = (code, nom, lon0, lat0, lon1, lat1, n) => { const ring = []; const e = (a, b) => { for (let i = 0; i < n; i++) ring.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); }; e([lon0, lat0], [lon1, lat0]); e([lon1, lat0], [lon1, lat1]); e([lon1, lat1], [lon0, lat1]); e([lon0, lat1], [lon0, lat0]); ring.push([lon0, lat0]); return { type: 'Feature', properties: { code, nom }, geometry: { type: 'Polygon', coordinates: [ring] } }; };
      const DEPS = [['17', 'Charente-Maritime', -1.3, 45.2, -0.2, 46.3], ['24', 'Dordogne', 0.1, 44.6, 1.4, 45.7], ['33', 'Gironde', -1.25, 44.2, 0.0, 45.2], ['40', 'Landes', -1.4, 43.5, 0.1, 44.2], ['64', 'Pyrénées-Atlantiques', -1.7, 42.8, 0.0, 43.5], ['59', 'Nord', 2.2, 50.0, 4.2, 51.0], ['13', 'Bouches-du-Rhône', 4.3, 43.2, 5.7, 43.9]];
      const geo = n => JSON.stringify({ type: 'FeatureCollection', features: DEPS.map(d => sq(d[0], d[1], d[2], d[3], d[4], d[5], n)) });
      const COMMUNES = { type: 'FeatureCollection', features: [sq('33063', 'Bordeaux', -0.7, 44.8, -0.5, 44.95, 3), sq('33522', 'Talence', -0.65, 44.75, -0.5, 44.8, 3)] };
      const centre = { '33000': ['33063', 'Bordeaux', -0.6, 44.87], '33400': ['33522', 'Talence', -0.58, 44.77] };
      const { page, context, errors } = await scenario(browser, origin, { NEWOSB_ALLOWED_ORIGINS: origin });
      const json = body => ({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body });
      await context.route(/githubusercontent|jsdelivr|etalab/, r => { const u = r.request().url(); if (/departements-version-simplifiee/.test(u)) return r.fulfill(json(geo(2))); if (/\/departements\.geojson$/.test(u)) return r.fulfill(json(geo(40))); return r.abort(); });
      await context.route(/geo\.api\.gouv\.fr/, r => { const u = new URL(r.request().url()); if (/departements\/33\/communes/.test(u.pathname)) return r.fulfill(json(JSON.stringify(COMMUNES))); const c = centre[u.searchParams.get('codePostal')]; if (c) return r.fulfill(json(JSON.stringify([{ code: c[0], nom: c[1], codeDepartement: '33', centre: { type: 'Point', coordinates: [c[2], c[3]] } }]))); return r.fulfill(json('[]')); });
      // Le chargement des exigences en arrière-plan rafraîchit la page : on attend qu'il soit terminé.
      await page.waitForFunction(() => !window.NEWOSB_REQUIREMENTS?.status?.().loading, null, { timeout: 30000 }).catch(() => {});
      await page.click('#obsNav [data-page="territories"]');
      await page.waitForSelector('.obs-france-map', { timeout: 20000 }).catch(() => {});
      const bar = await page.evaluate(() => ({ basemaps: document.querySelectorAll('[data-map-basemap]').length, osm: !!document.querySelector('.obs-osm-native'), sw: !!document.querySelector('[data-map-grouping-toggle]'), layers: document.querySelectorAll('[data-map-layer]').length }));
      check(bar.basemaps === 0 && !bar.osm && bar.sw && bar.layers === 5, `fond neutre seul : plus de choix IGN / OSM ; bascule Département / Région et 5 couches conservées (${JSON.stringify(bar)})`);
      const pts = () => page.evaluate(() => { const p = [...document.querySelectorAll('.obs-map-dep')].find(e => /Gironde/.test(e.querySelector('title')?.textContent || '')); return p ? (p.getAttribute('d').match(/[ML]/g) || []).length : 0; });
      const franceDetail = await pts();
      // La fin du chargement des exigences redessine la carte (et ferme la fenêtre) : nouvel essai si besoin.
      for (let attempt = 0; attempt < 4; attempt++) {
        await page.waitForSelector('[data-map-pastille="department"][data-map-pastille-value="33"]', { timeout: 15000 }).catch(() => {});
        await page.evaluate(() => document.querySelector('[data-map-pastille="department"][data-map-pastille-value="33"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
        await page.waitForTimeout(600);
        if (await page.$('.obs-map-pop')) break;
      }
      const pop = await page.evaluate(() => ({ title: document.querySelector('.obs-map-pop h3')?.textContent || '', rows: [...document.querySelectorAll('.obs-map-pop [data-map-pop-op]')].map(b => b.dataset.mapPopOp).sort().join(','), zoom: !!document.querySelector('.obs-map-pop [data-map-pop-zoom]') }));
      check(/Gironde/.test(pop.title) && pop.rows === 'OP-1,OP-2,OP-7' && pop.zoom, `pastille du département : fenêtre avec la liste de ses opérations (${pop.title} : ${pop.rows})`);
      await page.click('.obs-map-pop [data-map-pop-op="OP-2"]'); await page.waitForTimeout(400);
      check(await page.evaluate(() => !document.querySelector('.obs-map-pop') && document.querySelector('.obs-project-window')?.classList.contains('is-open')), 'clic sur une opération de la liste : la fiche s’ouvre');
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      await page.evaluate(() => [...document.querySelectorAll('.obs-map-region-hit')].find(e => /Nouvelle/.test(e.textContent)).dispatchEvent(new MouseEvent('click', { bubbles: true })));
      await page.waitForFunction(() => document.querySelector('.obs-france-map.is-focused'), null, { timeout: 15000 }).catch(() => {});
      const regionDetail = await pts();
      const deps = await page.$$eval('.obs-map-dep', ps => ps.length);
      check(deps === 5 && regionDetail > franceDetail * 5, `zoom région : seuls ses 5 départements, contours détaillés (${franceDetail} → ${regionDetail} points pour la Gironde)`);
      await page.evaluate(() => [...document.querySelectorAll('.obs-map-dep')].find(e => /Gironde/.test(e.querySelector('title')?.textContent || '')).dispatchEvent(new MouseEvent('click', { bubbles: true })));
      await page.waitForFunction(() => document.querySelectorAll('.obs-map-commune').length && document.querySelectorAll('.obs-map-commune-marker').length, null, { timeout: 15000 }).catch(() => {});
      const depView = await page.evaluate(() => ({ deps: document.querySelectorAll('.obs-map-dep').length, communes: document.querySelectorAll('.obs-map-commune').length, withOps: document.querySelectorAll('.obs-map-commune.has-ops').length, markers: [...document.querySelectorAll('.obs-map-commune-marker text')].map(t => t.textContent).sort().join(','), head: document.querySelector('.obs-map-head-actions')?.textContent || '' }));
      check(depView.deps === 1 && depView.communes === 2 && depView.withOps === 2 && depView.markers === '1,2' && /Gironde/.test(depView.head), `zoom département : contours des communes et une pastille par commune (${JSON.stringify(depView)})`);
      await page.evaluate(() => document.querySelector('[data-map-pastille="commune"][data-map-pastille-value="33522"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
      const cpop = await page.evaluate(() => ({ title: document.querySelector('.obs-map-pop h3')?.textContent || '', rows: [...document.querySelectorAll('.obs-map-pop [data-map-pop-op]')].map(b => b.dataset.mapPopOp).sort().join(',') }));
      check(cpop.title === 'Talence' && cpop.rows === 'OP-1,OP-7', `pastille d’une commune : ses opérations (${cpop.title} : ${cpop.rows})`);
      await page.screenshot({ path: path.join(process.env.SHOT_DIR || require('os').tmpdir(), 'map_department_popup.png') }).catch(() => {});
      await page.keyboard.press('Escape');
      check(await page.evaluate(() => !document.querySelector('.obs-map-pop')), 'Échap ferme la fenêtre des opérations');
      await page.click('[data-map-back-region]'); await page.waitForTimeout(500);
      check(await page.evaluate(() => document.querySelectorAll('.obs-map-dep').length === 5 && !document.querySelector('[data-map-back-region]')), '« ← Région » revient au zoom régional');
      await page.click('[data-map-reset-region]'); await page.waitForTimeout(500);
      check(await page.evaluate(() => document.querySelectorAll('.obs-map-dep').length === 7 && !document.querySelector('.obs-france-map.is-focused')), '« ← Retour France » revient à la carte entière');
      check(errors.length === 0, 'carte : aucune erreur JavaScript' + (errors.length ? ' : ' + errors.join(' | ') : ''));
      await context.close(); }
    console.log('\nK. Générateur de rapports : Obslide reçoit les données de l’Observatoire (V6.29)');
    { // Comme en production, l'Observatoire et Obslide sont servis sur la même origine (cedriccovarel.github.io).
      const GH = 'https://cedriccovarel.github.io', OBS = GH + '/observatoire-prestaterre-beta';
      const OBSLIDE_DIR = process.env.OBSLIDE_DIR || '';
      const STUB = `<!doctype html><title>Obslide (simulé)</title><script>window.__got=null;const t=new URLSearchParams(location.search).get('newosbScope');addEventListener('message',e=>{if(e.origin===location.origin&&e.source===opener&&e.data&&e.data.type==='newosb-generator-data')window.__got=e.data;});opener&&opener.postMessage({type:'obslide-ready',token:t},location.origin);<\/script>ok`;
      const serve = async ctx => ctx.route(GH + '/**', r => {
        const u = new URL(r.request().url()); let f = null;
        if (u.pathname.startsWith('/observatoire-prestaterre-beta/')) f = path.join(ROOT, decodeURIComponent(u.pathname.slice('/observatoire-prestaterre-beta/'.length)) || 'index.html');
        else if (u.pathname.startsWith('/obslide/')) { if (!OBSLIDE_DIR) return r.fulfill({ contentType: 'text/html', body: STUB }); f = path.join(OBSLIDE_DIR, decodeURIComponent(u.pathname.slice('/obslide/'.length)) || 'index.html'); }
        if (!f || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
        return r.fulfill({ contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      });
      const { page, context, errors } = await scenario(browser, OBS, { NEWOSB_ALLOWED_ORIGINS: GH }, { extraSheets: { RAPPORT }, beforeGoto: serve });
      await page.waitForFunction(() => window.NEWOSB_REQUIREMENTS?.status?.().connected, null, { timeout: 30000 }).catch(() => {});
      await page.evaluate(() => { const i = [...document.querySelectorAll('[data-global-filter-check="moa"]')].find(x => x.value === 'Promoteur A'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
      const shown = await page.textContent('#obsFilterCount');
      // Filtre propre à l'onglet Exigences : la slide Exigences doit donner les mêmes chiffres que cet onglet.
      await page.click('#obsNav [data-page="requirements"]'); await page.waitForTimeout(400);
      await page.evaluate(() => { const i = document.querySelector('[data-req-filter-check="referential"][value="BEE Logement Neuf"]'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(300);
      const reqKpi = await page.evaluate(() => ({ dossiers: document.querySelector('.req-kpis .obs-kpi strong')?.textContent?.replace(/\s/g, ''), occ: document.querySelectorAll('.req-kpis .obs-kpi strong')[1]?.textContent?.replace(/\s/g, '') }));
      const pp = context.waitForEvent('page', { timeout: 15000 }); await page.click('#obsGeneratorBtn'); const gen = await pp;
      gen.on('pageerror', e => errors.push('Obslide : ' + e.message));
      await gen.waitForURL(/\/obslide\//, { timeout: 15000 }).catch(() => {});
      if (!OBSLIDE_DIR) {
        const got = await gen.waitForFunction(() => window.__got, null, { timeout: 15000 }).then(h => h.jsonValue(), () => null);
        const codes = (got?.operationCodes || []).slice().sort().join(',');
        const evs = new Set((got?.requirements?.rows || []).map(r => r[0])).size;
        check(got && String(got.operationRows.length) === shown && got.operationCount === got.operationRows.length && codes === 'OP-1,OP-2,OP-7' && String(evs) === reqKpi.dossiers && String(got.requirements.evaluations) === reqKpi.dossiers && got.requirements.rows.every(r => r[6] === 'BEE Logement Neuf') && /Référentiel : BEE Logement Neuf/.test(got.requirements.summary) && got.requirements.headers[12] === 'Cible' && got.requirements.rows.every(r => /^[1-4]$/.test(r[12])), `Obslide reçoit les opérations filtrées (${codes}) et les exigences affichées par l’onglet Exigences (${evs} dossiers, onglet : ${reqKpi.dossiers}), sans import, cible 1 à 4 transmise pour chaque ligne`);
        const stored = await page.evaluate(() => Object.keys(localStorage).map(k => k + '=' + localStorage.getItem(k).length).join(' '));
        check(!/Les Jardins|EVA-OP/.test(await page.evaluate(() => JSON.stringify(localStorage))), `aucune donnée d’opération ni d’exigence écrite dans le stockage du navigateur (${stored.slice(0, 160)})`);
        await gen.close();
        await page.evaluate(() => window.NEWOSB_PRIVACY.setEnabled(true)); await page.waitForTimeout(300);
        const pp2 = context.waitForEvent('page', { timeout: 15000 }); await page.click('#obsGeneratorBtn'); const gen2 = await pp2;
        const got2 = await gen2.waitForFunction(() => window.__got, null, { timeout: 15000 }).then(h => h.jsonValue(), () => null);
        const txt = JSON.stringify(got2 || {});
        check(got2 && got2.anonymized && got2.operationRows.length > 0 && !/Promoteur A|Les Jardins|EVA-OP-1/.test(txt) && got2.requirements.rows.every(r => /^OP-\d{6}$/.test(r[1])) && got2.operationCodes.some(c => got2.requirements.rows.some(r => r[1] === c)), 'mode anonymisé : Obslide reçoit des données anonymisées, codes d’opération cohérents entre opérations et exigences');
        await gen2.close();
      } else {
        await gen.waitForFunction(() => /Données de l’Observatoire/.test(document.getElementById('dataFeedback')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
        const fb = await gen.evaluate(() => document.getElementById('dataFeedback')?.textContent || '');
        check(/Données de l’Observatoire : 3 opérations · \d+ dossiers? d’exigences/.test(fb), 'Obslide réel : ' + fb);
        const others = await gen.evaluate(async () => { const out = []; for (const t of [...document.querySelectorAll('.tab')]) { t.click(); await new Promise(r => setTimeout(r, 300)); const c = document.querySelector('.slide-filter-count strong')?.textContent; if (c) out.push(c); } return out; });
        check(others.length >= 10 && others.every(c => c === shown), `Obslide réel : toutes les slides connectées ont les ${shown} opérations de l’Observatoire (${others.join(',')})`);
        await gen.selectOption('#addSlideSelect', 'requirements'); await gen.waitForTimeout(800);
        const req = await gen.evaluate(() => { const svg = document.querySelector('#slide svg, .slide svg, svg'); const txt = svg?.textContent || ''; const parts = [...(svg?.querySelectorAll('text') || [])].map(t => t.textContent.trim()); const after = label => (parts[parts.findIndex(p => p.toUpperCase() === label) + 1] || '').replace(/\s/g, ''); return { txt, dossiers: after('DOSSIERS ANALYSÉS'), occ: after('EXIGENCES RETENUES') }; });
        check(req.dossiers === reqKpi.dossiers && req.occ === reqKpi.occ && !/Importe|importer l’export/i.test(req.txt), `Obslide réel : slide Exigences = onglet Exigences de l’Observatoire (dossiers ${req.dossiers} / ${reqKpi.dossiers}, exigences ${req.occ} / ${reqKpi.occ})`);
        await gen.screenshot({ path: path.join(process.env.SHOT_DIR || require('os').tmpdir(), 'obslide_handoff.png') }).catch(() => {});
      }
      check(errors.length === 0, 'remise des données à Obslide : aucune erreur JavaScript' + (errors.length ? ' : ' + errors.join(' | ') : ''));
      await context.close(); }
    console.log('\nI. Écran de chargement : chantier de rénovation, une seule barre pour OPERATIONS + RAPPORT (V6.23)');
    { const { page, context, errors } = await scenario(browser, origin, { NEWOSB_ALLOWED_ORIGINS: origin }, { noConnect: true, delayMs: 900, extraSheets: { RAPPORT } });
      const startLoad = () => page.evaluate(({ url, key }) => { document.getElementById('dataMode').value = 'appsScript'; document.getElementById('dataUrl').value = url; document.getElementById('dataKey').value = key; window.__load = window.NEWOSB_ENGINE.connect(); }, { url: EXEC, key: KEY });
      await page.evaluate(() => window.NEWOSB_ENGINE.showDataSource());
      await startLoad();
      const shown = await page.waitForFunction(() => window.NEWOSB_LOADER.isOpen(), null, { timeout: 8000 }).then(() => true, () => false);
      check(shown && /OPERATIONS et RAPPORT/.test(await page.textContent('#obsLoaderTitle')), 'l’écran de chargement s’ouvre pendant le chargement (OPERATIONS et RAPPORT)');
      const reqPhase = await page.waitForFunction(() => window.NEWOSB_LOADER._state().phase === 'req' && window.NEWOSB_LOADER.isOpen(), null, { timeout: 30000 }).then(() => page.evaluate(() => ({ ...window.NEWOSB_LOADER._state(), steps: document.querySelector('[data-loader-phases]')?.textContent || '' })), () => null);
      check(reqPhase && reqPhase.target >= 0.3 && reqPhase.target < 1 && /✓ Opérations/.test(reqPhase.steps) && /Exigences/.test(reqPhase.steps), `après OPERATIONS, l’écran reste ouvert pendant RAPPORT et la barre n’est pas pleine (${reqPhase ? Math.round(reqPhase.target * 100) + ' % · ' + reqPhase.steps : 'phase RAPPORT non vue'})`);
      check(!(await page.$('#obsGame')) && await page.evaluate(() => !window.NEWOSB_GAME), 'plus de mini-jeu');
      await page.waitForFunction(() => window.NEWOSB_LOADER._state().target > 0, null, { timeout: 20000 }).catch(() => {});
      const mid = await page.evaluate(() => window.NEWOSB_LOADER._state());
      check(mid.target > 0, `la barre de CO₂ suit l’avancement réel du chargement (${Math.round(mid.target * 100)} %)`);
      await page.screenshot({ path: path.join(process.env.SHOT_DIR || require('os').tmpdir(), 'loader_progress.png') }).catch(() => {});
      await page.evaluate(() => window.__load);
      const closed = await page.waitForFunction(() => !window.NEWOSB_LOADER.isOpen(), null, { timeout: 20000 }).then(() => true, () => false);
      const after = await page.evaluate(() => ({ modal: document.getElementById('dataConnectModal').hidden, connected: window.NEWOSB_ENGINE.getRuntime().connected }));
      check(closed && after.connected && await page.evaluate(() => window.NEWOSB_REQUIREMENTS.status().connected), 'fin du chargement (opérations et exigences) : l’écran se ferme seul, l’Observatoire est affiché');
      await startLoad();
      await page.waitForFunction(() => window.NEWOSB_LOADER.isOpen(), null, { timeout: 8000 }).catch(() => {});
      await page.keyboard.press('Escape');
      const hiddenNow = await page.evaluate(() => !window.NEWOSB_LOADER.isOpen());
      await page.evaluate(() => window.__load);
      check(hiddenNow && await page.evaluate(() => window.NEWOSB_ENGINE.getRuntime().connected), 'Échap : chargement poursuivi en arrière-plan');
      check(errors.length === 0, 'écran de chargement : aucune erreur JavaScript' + (errors.length ? ' : ' + errors.join(' | ') : ''));
      await context.close(); }
  } finally { await browser.close(); server.close(); }
  console.log(`\n${passed} vérifications navigateur réussies, ${failed} en échec.`);
  process.exit(failed ? 1 : 0);
})();
