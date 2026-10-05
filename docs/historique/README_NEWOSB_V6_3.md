# NEWOSB V6.3

Base : V6.2.

## Normalisation des solutions constructives
Les données brutes restent inchangées dans OPERATIONS. L'affichage « Solutions constructives » applique une couche de normalisation à la volée pour produire des statistiques comparables :
- mode constructif : béton, parpaing/bloc béton, brique, bois/ossature bois, pierre/terre, métal, mixte, autre ;
- isolants toiture/façade/plancher : laines minérales, polystyrène, polyuréthane/PIR, fibre de bois, ouate de cellulose, biosourcés, verre cellulaire, isolant mince, sans isolant, mixte, autre ;
- planchers : terre-plein, vide sanitaire, sous-sol/cave/parking, local non chauffé, plancher bois, dalle/plancher béton, mixte, autre ;
- menuiseries : matériau, vitrage et occultations regroupés en grandes familles.

## Normalisation des systèmes techniques
- vecteur chauffage : Gaz, Électricité, RCU, PAC, Bois/biomasse, Fioul, Solaire, Hybride, Aucun, Autre ;
- famille chauffage : réseau de chaleur, PAC par type, chaudière gaz/fioul/bois, électrique direct, etc. ;
- vecteur ECS et famille ECS ;
- ventilation ;
- refroidissement.

## Visualisation
Chaque encart d'enveloppe et de systèmes dispose d'un sélecteur Barres / Camembert. Le changement de vue conserve la position de défilement.

## Population
Les distributions techniques restent calculées sur les opérations techniques (une ligne OPERATIONS = une observation technique) conformément à la logique Projet / Opération introduite en V6.1.
