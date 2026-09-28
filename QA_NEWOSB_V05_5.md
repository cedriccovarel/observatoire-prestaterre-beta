# QA NEWOSB V05.5 - Carte interactive

Controles realises :

- `newosb.js` valide avec `node --check` ;
- boutons + / - presents dans la carte ;
- viewBox SVG pilote par un etat persistant `mapView` ;
- zoom molette en listener non-passif afin d'eviter le scroll de page pendant le zoom ;
- clic droit + glisser gere avec Pointer Events et pointer capture ;
- menu contextuel neutralise sur le SVG ;
- limites de zoom et de pan bornees au canevas cartographique ;
- cache-busting NEWOSB porte en 5.0.5 ;
- aucune modification du moteur de filtres, des couches, des Exigences ou de l'anonymisation.

Note : l'environnement de test automatise bloque l'ouverture d'URL locale dans Chromium. Le controle d'integration a donc ete complete par validation syntaxique et inspection des handlers/elements generes.
