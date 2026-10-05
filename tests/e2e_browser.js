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

const SHIM = `<script>window.google={script:{run:(function(){function R(ok,ko){this.ok=ok;this.ko=ko;}R.prototype.withSuccessHandler=function(f){return new R(f,this.ko);};R.prototype.withFailureHandler=function(f){return new R(this.ok,f);};R.prototype.newosbBridgeRequest=function(p){var s=this;fetch('/macros/s/TEST/__run',{method:'POST',body:JSON.stringify(p)}).then(function(r){return r.json();}).then(function(j){s.ok&&s.ok(j);}).catch(function(e){s.ko&&s.ko(e);});};return new R();})()}};</script>`;

async function scenario(browser, origin, properties, { jsonFails = false } = {}) {
  const gs = loadGs('Code_Operations.gs', { matrix: MATRIX, properties });
  const context = await browser.newContext();
  await context.route('https://script.google.com/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/__run')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(gs.newosbBridgeRequest(JSON.parse(route.request().postData() || '{}'))) });
    const params = Object.fromEntries(url.searchParams.entries());
    const out = gs.doGet({ parameter: params });
    if (out.html !== undefined) return route.fulfill({ contentType: 'text/html', body: out.html.replace('<script>', SHIM + '<script>') });
    if (jsonFails) return route.fulfill({ status: 403, body: 'Forbidden' });
    return route.fulfill({ contentType: out.mime === 'js' ? 'text/javascript' : 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: out.text });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { sessionStorage.setItem('prestaterre-observatoire-v21-auth', '1'); });
  await page.goto(origin + '/index.html');
  await page.waitForFunction(() => window.NEWOSB_ENGINE && window.NEWOSB_RULES);
  await page.evaluate(url => { document.getElementById('dataMode').value = 'appsScript'; document.getElementById('dataUrl').value = url; return window.NEWOSB_ENGINE.connect(); }, EXEC);
  return { page, context, errors };
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await playwright.chromium.launch();
  try {
    console.log('\nA. Site autorisé : connexion par le pont Apps Script');
    { const { page, context, errors } = await scenario(browser, origin, { NEWOSB_ALLOWED_ORIGINS: origin });
      const rt = await page.evaluate(() => window.NEWOSB_ENGINE.getRuntime());
      check(rt.connected && rt.count === 10, `10 projets chargés (obtenu : ${rt.count})`);
      check(rt.progress && rt.progress.header === 'Opération: Évaluation: Statut' && rt.progress.column === 'BC', `avancement lu dans « Opération: Évaluation: Statut », colonne BC (obtenu : ${rt.progress && rt.progress.column})`);
      const fb = await page.textContent('#dataFeedback'); check(/colonne BC/.test(fb), 'message de connexion : « colonne BC » affiché — ' + fb);
      const ops = await page.evaluate(() => window.NEWOSB_ENGINE.getOperations().map(o => [o.code, o.status, o.progressState]));
      const st = Object.fromEntries(ops.map(o => [o[0], o[1]]));
      check(st['OP-3'] === 'complete' && st['OP-6'] === 'visit' && st['OP-7'] === 'compliant', '« Dossier complet », « Visite réalisée », « Évaluation conforme » reconnus');
      check(st['OP-9'] === 'unknown', 'avancement vide → Non renseigné (plus « Non démarrée » par défaut)');
      await page.click('button[data-page="quality"]'); await page.waitForTimeout(300);
      const recon = await page.textContent('.obs-progress-card');
      check(recon.includes('Contrôle ligne à ligne de la colonne BC') && recon.includes('11 lignes lues dans la Sheet') && recon.includes('10 projets après regroupement'), 'Qualité : contrôle ligne à ligne de la colonne BC (11 lignes → 10 projets)');
      check(recon.includes('1 - Non démarrée') && /1 projet avec des statuts différents/.test(recon) && recon.includes('OP-2'), 'Qualité : valeurs brutes listées et projet à statuts différents signalé (OP-2)');
      check(recon.includes('Lignes Sheet') && recon.includes('Dans le tunnel'), 'Qualité : tableau lignes Sheet → projets → tunnel');
      const op2 = await page.evaluate(() => ({ project: window.NEWOSB_ENGINE.getOperations().find(o => o.code === 'OP-2').status, rows: window.NEWOSB_ENGINE.getTechnicalOperations().filter(o => o.projectCode === 'OP-2').map(o => o.status) }));
      check(op2.project === 'notStarted', `projet à plusieurs lignes : avancement global = étape la moins avancée (obtenu : ${op2.project})`);
      check(op2.rows.join(',') === 'incomplete,notStarted', `opération détaillée : statut exact de chaque ligne (obtenu : ${op2.rows.join(',')})`);
      await page.click('button[data-page="overview"]'); await page.waitForTimeout(200);
      const yrs = Object.fromEntries((await page.evaluate(() => window.NEWOSB_ENGINE.getOperations().map(o => [o.code, [o.year, o.createdYear]]))));
      check(String(yrs['OP-7'][0]) === '2024' && String(yrs['OP-10'][0]) === '2024' && String(yrs['OP-9'][0]) === '2025', 'année de certification lue dans « Date de décision de certification » (15/03/24 → 2024)');
      check(String(yrs['OP-1'][0]) === '', 'pas de décision de certification → pas d’année de certification (plus de repli sur la date CD)');
      check(String(yrs['OP-1'][1]) === '2023' && String(yrs['OP-3'][1]) === '2024' && String(yrs['OP-6'][1]) === '2024', 'année de création lue dans « Date de création » (formats variés)');
      const filterLabels = await page.$$eval('#obsFilters .obs-check-filter summary span', els => els.map(e => e.textContent));
      check(filterLabels.includes('Année certification') && filterLabels.includes('Année de création'), 'filtres « Année certification » et « Année de création » présents');
      const certOpts = await page.$$eval('#obsFilters details:nth-of-type(1) [data-global-filter-check]', els => els.map(e => e.value));
      const createdOpts = await page.$$eval('#obsFilters details:nth-of-type(2) [data-global-filter-check]', els => els.map(e => e.value));
      check(certOpts.join(',') === '2024,2025' && createdOpts.join(',') === '2022,2023,2024', `options : certification ${certOpts.join(',')} · création ${createdOpts.join(',')}`);
      await page.evaluate(() => { const i = document.querySelector('#obsFilters details:nth-of-type(2) [data-global-filter-check][value="2022"]'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
      await page.waitForTimeout(300);
      check((await page.textContent('#obsFilterCount')).trim() === '1', 'filtre « Année de création = 2022 » : 1 projet actif (affaire perdue exclue)');
      await page.click('#obsResetFilters'); await page.waitForTimeout(300);
      const tunnel = await page.evaluate(() => window.NEWOSB_ENGINE.aggregateTunnel(window.NEWOSB_ENGINE.getOperations()));
      check(tunnel.counts.visit === 1 && tunnel.counts.complete === 1 && tunnel.cancelled === 1, `tunnel : 1 visite, 1 dossier complet, 1 affaire perdue (${JSON.stringify(tunnel)})`);
      await page.click('button[data-page="certification"]'); await page.waitForTimeout(300);
      const steps = await page.$$eval('.obs-tunnel-step span', els => els.map(e => e.textContent));
      check(steps.join('|') === 'Non démarrée|Dossier incomplet|Dossier complet|Analyse planifiée|Analyse réalisée|Visite réalisée|Évaluation conforme', 'tunnel affiché avec les 7 étapes dans l’ordre');
      const pageText = await page.textContent('#obsPage');
      check(!/TUNNEL INTERACTIF/i.test(pageText) && /AVANCEMENT/.test(pageText), 'carte « Tunnel interactif » renommée « Avancement »');
      for (const w of [1440, 1100, 900]) {
        await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(250);
        const tops = await page.$$eval('#obsPage .obs-tunnel-oneline', ts => ts.map(t => new Set([...t.querySelectorAll('.obs-tunnel-step')].map(b => Math.round(b.getBoundingClientRect().top))).size));
        check(tops.length && tops.every(n => n === 1), `largeur ${w}px : les 7 étapes tiennent sur une seule ligne`);
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
      check(tops.length === 7 && new Set(tops).size === 1, `slide tunnel : 7 bulles sur une seule ligne (${tops.length})`);
      await context.close(); }

    console.log('\nB. Site non autorisé : le pont refuse de transmettre les données');
    { const { page, context } = await scenario(browser, origin, {}, { jsonFails: true });
      const rt = await page.evaluate(() => window.NEWOSB_ENGINE.getRuntime());
      const msg = await page.textContent('#dataFeedback');
      check(!rt.connected || rt.mode !== 'appsScript', 'aucune donnée chargée');
      check(/NEWOSB_ALLOWED_ORIGINS/.test(msg), 'message explicite : configurer NEWOSB_ALLOWED_ORIGINS');
      await context.close(); }

    console.log('\nC. Clé d’accès : URL sans clé refusée, URL avec clé acceptée');
    { const gs = loadGs('Code_Operations.gs', { matrix: MATRIX, properties: { NEWOSB_ACCESS_KEY: 'K3y', NEWOSB_ALLOWED_ORIGINS: origin } });
      check(JSON.parse(gs.doGet({ parameter: { mode: 'meta' } }).text).ok === false, 'sans clé : refus');
      check(JSON.parse(gs.doGet({ parameter: { mode: 'meta', key: 'K3y' } }).text).ok === true, 'avec clé : accès'); }
  } finally { await browser.close(); server.close(); }
  console.log(`\n${passed} vérifications navigateur réussies, ${failed} en échec.`);
  process.exit(failed ? 1 : 0);
})();
