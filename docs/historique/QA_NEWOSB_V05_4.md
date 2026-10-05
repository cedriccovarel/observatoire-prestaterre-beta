# QA NEWOSB V05.4 — Répartition par cible

## Correctif

La répartition par cible ne se base plus directement sur la colonne `Thème` de RAPPORT.

Ordre de résolution :
1. correspondance exacte avec le catalogue des référentiels 2026 (titre + nature Neuf/Rénovation) ;
2. code / numéro de l'exigence ;
3. intitulé / exigence associée / exigence de référence ;
4. colonne `Thème` uniquement en dernier recours.

Cette logique évite de classer une exigence dans une mauvaise cible lorsque les exports historiques utilisent une ancienne numérotation ou contiennent un thème incohérent.

## Test sur le fichier type Exigences DRIHL (4).xlsx

- 5 236 occurrences uniques analysées.
- 5 236 occurrences rattachées à une cible 1 à 4.
- Cible 1 : 1 298 occurrences.
- Cible 2 : 599 occurrences.
- Cible 3 : 1 137 occurrences.
- Cible 4 : 2 202 occurrences.
- 0 occurrence laissée non classée sur ce fichier de test.

Cas détectés et corrigés automatiquement :
- `1.2.2 - Cahier des charges environnemental` était associé à une valeur `Thème` de cible 2 dans une ligne du fichier : il est maintenant classé en cible 1.
- les anciennes références du type `4.A.3 - Niveau RT 2012 -20%` ou `4.B.2 - Niveau Énergie 2 - Carbone 1` sont rattachées sémantiquement à la cible 3 lorsque le titre correspond au référentiel.

## Interface

- Les quatre blocs Cible affichent maintenant des tableaux textuels Neuf / Rénovation plutôt que des mini-graphes tronqués à 5 exigences.
- Chaque ligne conserve le clic de filtrage et le bouton `i` de la fiche référentiel.
- Les totaux d'occurrences et le nombre d'exigences distinctes sont affichés pour Neuf et Rénovation.
- Une alerte apparaît uniquement si une occurrence ne peut réellement pas être classée dans les cibles 1 à 4.
