# QA NEWOSB V05.12

- Syntaxe `app.js` : OK (`node --check`).
- Syntaxe `newosb.js` : OK (`node --check`).
- Syntaxe Apps Script contrôlée après copie en `.js` : OK (`node --check`).
- `doGet(mode=ping)` ne lit pas la feuille et ne fait aucun appel réseau externe.
- `doGet(mode=meta)` lit uniquement les métadonnées + la ligne d'en-têtes.
- `doGet(mode=chunk)` lit uniquement le bloc demandé.
- Aucun appel Zone123 n'est effectué sur le chemin `ping/meta/chunk`.
- Compatibilité JSONP conservée via `prefix`.
- Détection d'une ancienne source Apps Script (< 05.12) ajoutée côté navigateur.
