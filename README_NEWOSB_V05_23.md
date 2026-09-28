# NEWOSB V05.23

## Correctif principal : aucune remontée automatique en haut

Cette version impose une règle globale de navigation : une interaction dans NEWOSB ne doit plus ramener automatiquement l'utilisateur en haut de page.

Le correctif couvre notamment :
- cases à cocher des filtres globaux ;
- Tout cocher / Effacer / Réinitialiser ;
- filtres de l'onglet Exigences ;
- pagination ;
- changement Liste / Barres / Treemap ;
- filtres analytiques croisés ;
- recherche ;
- changements de fond / couche de la cartographie ;
- changements d'onglet NEWOSB ;
- rerenders déclenchés par les données ou le mode anonymisé.

## Technique
- position verticale et horizontale de `#obsPage` mémorisée avant reconstruction DOM ;
- position de fenêtre également conservée ;
- restauration immédiate + double `requestAnimationFrame` + contrôles différés à 60 ms et 140 ms ;
- désactivation de l'ancrage automatique du navigateur (`overflow-anchor:none`) sur les zones dynamiques ;
- recherche Exigences : `focus({preventScroll:true})` ;
- suppression du `resetScroll:true` auparavant utilisé au changement d'onglet.

## Déploiement
Aucun changement du pont OPERATIONS : `Code.gs` / `Code_Operations.gs` sont identiques à V05.22.
Il n'est pas nécessaire de redéployer Apps Script pour ce correctif.
