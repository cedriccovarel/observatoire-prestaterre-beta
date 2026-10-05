# QA NEWOSB V05.8

## Contrôles statiques
- [x] `node --check newosb.js`
- [x] `node --check app.js`
- [x] `node --check requirements.js`
- [x] URL des tuiles OSM conforme : `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- [x] Attribution OSM visible dans le DOM de la carte
- [x] aucun CDN Leaflet/MapLibre requis
- [x] boutons OSM `+ / -` en `type="button"`
- [x] gestion `wheel` avec `preventDefault()`
- [x] gestion `contextmenu` et déplacement `pointer` bouton droit
- [x] position de scroll conservée par `renderPage()`
- [x] remise à zéro du scroll uniquement lors d'un changement explicite de rubrique
- [x] couches NEWOSB conservées : zonage, régions, départements, EPCI, villes, opérations

## Détail cartographique
- zoom ≤ 5 : Régions
- zoom 6–7 : Départements
- zoom 8–9 : Intercommunalités
- zoom 10–11 : Villes
- zoom ≥ 12 : Opérations

Le fond OSM lui-même fournit en parallèle les routes, communes, quartiers et toponymes disponibles au niveau de zoom courant.
