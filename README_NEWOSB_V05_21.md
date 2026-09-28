# NEWOSB V05.21

## Correctifs et évolutions

### Export PPTX
- Ajout de `jszip.min.js` dans le pack local.
- JSZip est chargé avant `pptxgen.min.js` dans `index.html`.
- L’export PPTX ne dépend donc plus d’un CDN externe.

### Pont NEWOSB → OSBslide
Quand OSBslide est ouvert depuis NEWOSB :
- NEWOSB calcule la population exacte issue des filtres actifs et des filtres analytiques ;
- la liste des codes opérations est transmise via un jeton local ;
- OSBslide recharge la même source OPERATIONS puis limite automatiquement tous les calculs à cette population ;
- un bandeau `Périmètre NEWOSB` rappelle les filtres transmis ;
- le bouton `×` du bandeau permet de revenir à toute la base sans modifier la source.

Le transfert couvre donc aussi les filtres NEWOSB qui n’existent pas comme menus natifs dans OSBslide : région, département, zonage, profil, recherche texte et filtres analytiques croisés.

## Apps Script
`Code_Operations.gs` est inchangé par rapport à V05.20 : aucun redéploiement Apps Script n’est nécessaire.
