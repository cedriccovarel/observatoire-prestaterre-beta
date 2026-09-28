# QA NEWOSB V05

## Tests réalisés

- Validation syntaxique `requirements.js` : OK
- Validation syntaxique `newosb.js` : OK
- Validation syntaxique `requirements_catalog.js` : OK
- Catalogue référentiels : 257 exigences au total
  - 165 BEE Logement Neuf
  - 92 BEE Logement Rénovation
- 257/257 exigences avec description extraite : OK
- 257/257 exigences avec au moins une pièce justificative extraite : OK
- Chargement simulé de 3 500 lignes de l'onglet RAPPORT : OK
- Détection de 328 évaluations uniques sur l'échantillon : OK
- Filtres Profil / Région / Département : OK
- Cascade Région -> Département : OK
- Recherche manuelle par référence (`3.3.14`) : OK
- Compteur RAPPORT complet + compteur sélection filtrée : OK
- Boutons d'information `i` : OK
- Fiche cible / thème / description / pièces justificatives : OK
- Gestion Neuf / Rénovation dans les fiches : OK
- Sections Exigences 04 / 05 / 06 retirées : OK
- Toggle anonymisation unique dans NEWOSB : OK
- Catalogue chargé avant `requirements.js` : OK

## Remarque
Le catalogue d'information est construit à partir des référentiels BEE Logement Neuf et BEE Logement Rénovation applicables à partir du 04/05/2026. Les lignes RAPPORT issues de versions plus anciennes sont comptabilisées normalement ; si leur libellé ne peut pas être rapproché de façon fiable du référentiel 2026, la fiche d'information signale l'absence de correspondance fiable.
