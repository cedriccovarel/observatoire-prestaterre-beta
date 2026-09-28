# NEWOSB V05.26

## Carte Historique : drill-down Région → Départements

- Au niveau France, les régions de la carte Historique sont directement cliquables.
- Un clic sur une région :
  - sélectionne la région dans l'analyse croisée ;
  - zoome automatiquement sur la région ;
  - masque le reste de la France dans le fond Historique ;
  - force le regroupement des opérations au niveau départemental ;
  - affiche les départements composant la région avec leur nombre de projets ;
  - adapte le panneau latéral en « Départements de <Région> ».
- Bouton `← Retour France` pour revenir au niveau national.
- Le même focus est déclenché lorsqu'une seule région est sélectionnée dans les filtres globaux.

## Vues alternatives des tableaux

La vue Liste reste toujours disponible. Les listes sont limitées à 15 lignes par page.

- Territoires : Liste / Barres.
- Acteurs – Maîtres d'ouvrage : Liste / Barres.
- Certification – Statut par année : Liste / Histogramme empilé.
- Labels & performances : Liste / Barres / Tuiles.
- Mentions × performances : Liste / Matrice thermique.
- Opérations : Liste / Tuiles.
- Données source d'une opération : Liste / Tuiles.
- Exigences : conservation des bascules Liste / Barres déjà présentes, avec pagination 15 lignes en mode Liste.

## Règles conservées

- Aucun retour automatique en haut de page après une interaction.
- Filtres multi-sélection par cases à cocher.
- Présentation, Google Slides et OSBslide inchangés.
- `Code_Operations.gs` et `Code_Exigences.gs` inchangés par rapport à V05.25 : aucun redéploiement Apps Script nécessaire.
