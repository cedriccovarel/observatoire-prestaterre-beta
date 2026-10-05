# QA NEWOSB V05.13

- `app.js` : syntaxe JavaScript valide (`node --check`).
- `newosb.js` : syntaxe JavaScript valide (`node --check`).
- `Code_Operations.gs` : syntaxe JavaScript/V8 valide apres copie en `.js` (`node --check`).
- Pont HtmlService present : `bridge=1`, `NEWOSB_BRIDGE_READY`, `NEWOSB_BRIDGE_REQUEST`, `NEWOSB_BRIDGE_RESPONSE`.
- Appel serveur du pont : `google.script.run.newosbBridgeRequest(...)`.
- Secours JSON/JSONP conserve.
- Chargement OPERATIONS par blocs de 100 lignes, maximum 200.
- `ping` ne lit pas le classeur et ne fait aucun appel Internet externe.
- `meta/chunk` n'appellent aucun service geographique externe.
- Cache-busting V05.13 applique dans `index.html` et `generator.html`.
