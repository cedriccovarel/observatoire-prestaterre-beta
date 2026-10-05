# QA NEWOSB V05.1

## Correctifs ciblés

- Typographie de l'onglet Exigences encore agrandie.
- Largeur/hauteur visuelle des barres graphiques réduite au profit des libellés.
- Libellés longs autorisés sur plusieurs lignes au lieu d'être tronqués.
- Tableaux et fiches d'information `i` agrandis pour améliorer la lecture.
- Correction du menu `Exigences associées` : le changement de mention conserve la position verticale de la page.
- Cache-busting des fichiers NEWOSB passé en `5.0.1`.

## Contrôles techniques

- `newosb.js` : syntaxe JavaScript valide (`node --check`).
- `requirements.js` : syntaxe JavaScript valide (`node --check`).
- `requirements_catalog.js` : syntaxe JavaScript valide (`node --check`).
- La conservation du scroll est appliquée à tous les rerendus du module Exigences afin d'éviter les retours intempestifs en haut de page lors d'une interaction locale.
