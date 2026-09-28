# QA NEWOSB V05.22

- `node -c app.js` : OK
- `node -c newosb.js` : OK
- `node -c` sur copie de `Code.gs` : OK
- chargement Chromium headless sans erreur JS détectée : OK
- test serveur simulé `newosbCreateGoogleSlides_` avec couverture + barres + tableau : OK
- `Code.gs` et `Code_Operations.gs` synchronisés : à vérifier au packaging
- export ZIP : à vérifier après création

Limite connue : le rendu cartographique Google Slides est volontairement reconstruit sous une forme native simplifiée, car Google Slides ne permet pas d’insérer directement les chemins SVG arbitraires du fond cartographique via `SlidesApp`.
