# QA NEWOSB V05.30

Contrôles effectués avant livraison :

- syntaxe JavaScript : `newosb.js`, `requirements.js`, `newosb-core.js`, `app.js`, `auth.js`, `privacy.js` ;
- parsing HTML de `index.html` ;
- contrôle statique de la suppression de la couche Villes dans la barre de couches ;
- contrôle du rendu cartographique : `citySvg` et `majorCitySvg` neutralisés ;
- contrôle du toggle « Total général » et de l'utilisation de `preserveUiScroll` ;
- contrôle de la treemap : découpage binaire récursif et surface totale de 100 % ;
- contrôle du bouton Source / calcul réduit à une icône ;
- comparaison SHA-256 de `Code_Operations.gs` avec la V05.29 ;
- test d'intégrité du ZIP.
