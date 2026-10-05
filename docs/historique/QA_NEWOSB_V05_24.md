# QA NEWOSB V05.24

Contrôles réalisés :
- `node --check newosb.js` : OK.
- Version/cache-busting `V05.24` / `5.0.24` : OK.
- `Code_Operations.gs` et `Code.gs` : SHA-256 identiques à V05.23.
- Présence des nouveaux composants : KPI visuels, barres visuelles, évolution enrichie, tunnel visuel, jauges R, synthèse DPE : OK.
- Les fonctions de filtres et le verrou de scroll V05.23 n'ont pas été remplacés.
- Tentative de capture Chromium headless : non concluante dans l'environnement de génération (processus Chromium ne termine pas), sans erreur de syntaxe JavaScript détectée.
