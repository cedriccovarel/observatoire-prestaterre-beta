# QA — NEWOSB V05.16

Contrôles réalisés avant livraison :

- `node --check newosb.js` : OK.
- `node --check app.js` : OK.
- Version et cache-busting V05.16 présents dans `index.html` : OK.
- Barre de filtres NEWOSB rendue uniquement en cases à cocher multi-sélection : OK.
- Filtres Exigences rendus en cases à cocher multi-sélection : OK.
- Région → liste Département dépendante des régions cochées : OK.
- Clic / sélection d'une région → préparation du zoom régional : OK.
- Zoom régional IGN/OSM et fond historique : fonctions présentes et syntaxiquement valides.
- Grandes villes : récupération par code région, métropole + outre-mer, avec échec non bloquant.
- Plein écran carte : bouton + gestion `requestFullscreen` / `fullscreenchange` : OK.
- Mapping famille MOA sur `Maître d'ouvrage: Groupe principal Secteur d'activité` : OK.
- Portefeuilles MOA : pagination 15 lignes : OK.
- Certification : `Statuts sources` supprimé : OK.
- Labels & performances : tableau `Nature` supprimé : OK.
- Mentions : recherche + pagination 15 : OK.
- Performances : recherche + pagination 15 : OK.
- Préservation de la position de scroll lors des rerendus : OK.
- `Code_Operations.gs` identique à V05.15 : OK, aucun redéploiement Apps Script requis.

Note : le menu Ubat / TIC / DH est un choix d'indicateur d'affichage et non un filtre de population ; il reste donc volontairement sous forme de sélecteur.
