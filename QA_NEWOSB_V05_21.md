# QA NEWOSB V05.21

- `node --check app.js` : OK
- `node --check newosb.js` : OK
- JSZip local : présent, version 3.10.1
- Test d’évaluation JSZip + PptxGenJS dans un contexte JavaScript : `JSZip=function`, `PptxGenJS=function`
- `jszip.min.js` chargé avant `pptxgen.min.js` dans `index.html`
- Pont NEWOSB → OSBslide : transfert par jeton local + liste exacte des codes opérations
- Le périmètre est appliqué dans `dataFilterOps`, donc dans tous les modèles DATA CONNECTED du générateur
- Bandeau de périmètre affiché dans la barre de filtres OSBslide
- Suppression du périmètre possible sans déconnecter la source
- `Code_Operations.gs` inchangé par rapport à V05.20
