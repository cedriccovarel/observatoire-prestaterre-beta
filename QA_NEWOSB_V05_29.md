# QA NEWOSB V05.29

## Tests executes
- `node --check newosb.js` : OK
- `node --check newosb-core.js` : OK
- `node --check app.js` : OK
- `node --check requirements.js` : OK
- `node --check privacy.js` : OK
- `node --check auth.js` : OK
- parsing HTML `index.html` : OK
- `node qa_v0529.js` : tous les tests passent

## Tests metier couverts
- Abandonne / abandonnee / PERDU / Affaire perdue / Projet abandonne / Annulee => exclus
- En cours => actif
- BBCA avec `<br>` / `&lt;br&gt;` => meme cle normalisee
- couverture CEP 2/3
- mediane statistique
- creation d'une population comparable
- detection CEP > CEP max
- presence du CEP dans le dictionnaire

## Integrite Apps Script
SHA-256 de `Code_Operations.gs` identique a la V05.28 :
`de50041d2cd7a8483befd6b3f5badb043c48014f3ad639d024281979323d5cf5`

Aucun redeploiement Apps Script OPERATIONS n'est requis.

## Test navigateur
Une tentative Chromium headless a ete lancee. Chromium n'a pas produit de DOM avant le timeout dans cet environnement et a remonte des erreurs DBus propres au conteneur. Ce test n'est donc pas compte comme un test navigateur reussi.
