# NEWOSB V05.25

## Objectif
Passe de simplification et de lisibilité après V05.24.

## Modifications
- Onglet Exigences : suppression des chevauchements de textes, cartes de cibles en pleine largeur, libellés multilignes robustes, matrices et recherche plus lisibles.
- Territoires : suppression du tableau « Zonage logement social » ; le zonage reste disponible comme couche cartographique optionnelle et est désactivé par défaut.
- Carte : carte agrandie, panneau latéral « Top territoires » dynamique selon le switch Département / Région, pagination 15 éléments.
- Référentiels : suppression des répétitions de répartition par référentiel dans Territoires, Acteurs, Certification et Labels & performances. La lecture multi-référentiels reste principalement dans Vue d’ensemble ; Exigences conserve sa chronologie spécialisée.
- Acteurs : le panneau Référentiels est remplacé par Avancement ; familles MOA limitées à 15 lignes visuelles.
- Certification : suppression du bloc Référentiels redondant ; tunnel + chronologie deviennent la lecture principale.
- Labels & performances : suppression du bloc Référentiels redondant ; matrice Mentions × performances élargie.
- Pagination : tous les tableaux/listes tabulaires sont limités à 15 lignes par page ; ajout de pagination également aux données source d’une opération.
- Scroll : conservation de la règle V05.23, aucun retour automatique en haut lors d’un rerender.

## Déploiement
Le pont Apps Script n’est pas modifié par V05.25. Aucun redéploiement de Code_Operations.gs n’est nécessaire.
