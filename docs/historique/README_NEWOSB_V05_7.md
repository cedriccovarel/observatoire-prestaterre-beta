# NEWOSB V05.8

## Correctifs principaux

### Navigation sans saut de page
- Les rerendus internes conservent la position verticale de `#obsPage`.
- La position de scroll de la fenêtre est également restaurée sur les affichages mobiles où la page principale n'est pas un conteneur scrollable.
- Les boutons générés sans attribut `type` sont convertis en `type="button"` après rendu pour éviter les soumissions implicites.
- Les changements de page depuis la navigation latérale restent volontairement ouverts en haut de la nouvelle rubrique.

### Fond OpenStreetMap réel
- Fond raster OpenStreetMap standard : `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
- Attribution OpenStreetMap affichée en permanence dans la carte.
- Aucune dépendance JavaScript cartographique externe : le moteur de tuiles est intégré à NEWOSB.
- Zoom `+ / -`, zoom molette centré sur le pointeur, déplacement au clic droit maintenu.
- Niveau d'information progressif : Région → Département → Intercommunalité → Ville → Opérations.
- Les couches NEWOSB restent superposables : zonage 1/2/3, régions, départements, intercommunalités, villes et opérations.
- La vue cartographique est conservée lors de l'activation/désactivation des couches et lors d'un cross-filter.

## Source géographique
La géolocalisation commune/EPCI continue d'utiliser la Geo API française déjà intégrée quand aucune coordonnée exploitable n'est disponible dans la source d'opérations.
