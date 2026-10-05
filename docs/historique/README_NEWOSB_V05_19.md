# NEWOSB V05.19

Version construite sur V05.18, sans modification du pont OPERATIONS / Apps Script.

## Territoires
- Ajout d'un switch **Département / Région** sur la carte.
- La couche Opérations affiche des bulles agrégées selon le niveau choisi.
- Le clic sur une bulle continue d'appliquer le filtre analytique correspondant.
- Fonctionne avec les fonds Historique, IGN et OSM.

## Vue d'ensemble
- Les chiffres clés peuvent être envoyés individuellement vers l'onglet Présentation via l'icône `▣`.
- Le titre **Position dans le tunnel** devient **Avancement**.
- Mentions et Performances disposent de 3 modes :
  - Liste : 15 éléments par page ;
  - Barres : Top 5 ;
  - Treemap : tuiles proportionnelles.

## Présentation
- Le bouton texte « + Présentation » est remplacé par une petite icône `▣` avec infobulle.
- Les KPI de la Vue d'ensemble sont également capturables.
- Les fonctions V05.18 restent conservées : couverture, édition des textes, polices et tailles, PNG 4K, SVG, PPTX / Google Slides, réorganisation et barre latérale repliable.

## Exigences
- Les principaux tableaux disposent d'un sélecteur **Liste / Barres**.
- En mode Barres : **Top 5**.
- En mode Liste : **15 lignes par page** avec navigation Précédent / Suivant.
- Sont concernés : chronologie par référentiel, volume global des exigences, chaque cible 1 à 4, évolution des exigences, mentions et exigences associées.

## Pagination harmonisée
Toutes les listes principales de NEWOSB sont limitées à 15 lignes par page :
- Territoires ;
- Acteurs / MOA ;
- Labels & performances ;
- Opérations ;
- Vue d'ensemble (Mentions / Performances en mode liste) ;
- Exigences en mode liste.

La navigation est centrée sous le tableau : **‹ Précédent · Page X / Y · Suivant ›**.

## Déploiement
Aucun redéploiement de `Code_Operations.gs` n'est nécessaire par rapport à V05.18 / V05.15.
