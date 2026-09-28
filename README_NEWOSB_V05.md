# NEWOSB V05

## Évolutions principales

### 1. Mode anonymisé repositionné
Le toggle global d'anonymisation est maintenant placé en haut de la barre latérale et a été réduit. Son état reste persistant et continue de s'appliquer à l'ensemble de NEWOSB et au générateur de rapports.

### 2. Onglet Exigences simplifié
Les anciennes sections 04 « Analyse des marges DRIHL », 05 « Équilibre de l'annexe DRIHL » et 06 « Dossiers de la sélection » ont été retirées de l'interface Exigences.

L'écran conserve :
- la synthèse du panel ;
- le Top 15 des exigences ;
- les 4 cibles avec comparaison Neuf / Rénovation ;
- l'évolution annuelle ;
- les mentions et leurs exigences associées.

La typographie de toute cette rubrique a été agrandie.

### 3. Fiches d'information des exigences
Les deux référentiels applicables à partir du 4 mai 2026 sont intégrés dans NEWOSB :
- BEE Logement Neuf ;
- BEE Logement Rénovation.

Un petit bouton circulaire `i` apparaît à côté des exigences représentées dans les graphiques et tableaux. Il ouvre une fiche indiquant :
- le référentiel ;
- la cible ;
- le thème ;
- la référence et l'intitulé ;
- la description / l'objectif ;
- les pièces justificatives ;
- le nombre d'occurrences dans RAPPORT ;
- le nombre d'occurrences dans la sélection filtrée.

Quand une exigence issue d'une ancienne version ne correspond pas de façon suffisamment fiable au référentiel 2026, NEWOSB l'indique au lieu d'afficher une fiche potentiellement erronée.

### 4. Recherche manuelle d'une exigence
Un moteur de recherche est ajouté dans l'onglet Exigences. La recherche accepte notamment :
- une référence : `3.3.14` ;
- un mot-clé : `IC Construction` ;
- un intitulé : `Analyse de site`.

Pour chaque résultat, NEWOSB affiche :
- occurrences dans RAPPORT complet ;
- occurrences dans la sélection courante ;
- nombre de dossiers ;
- ventilation Neuf / Rénovation ;
- bouton `i` vers la fiche du référentiel.

### 5. Nouveaux filtres analytiques Exigences
La source RAPPORT peut maintenant être filtrée par :
- Référentiel ;
- Période ;
- Nature ;
- Profil ;
- Région ;
- Département ;
- Mention ;
- Secteur MOA ;
- Thème.

Le Département est recalculé en fonction de la Région sélectionnée. Ces filtres agissent sur tous les graphiques et sur la recherche manuelle.

## Source Google Sheet
Le module continue de lire exclusivement l'onglet `RAPPORT` via `Code_Exigences.gs`.

Les colonnes Région, Département et Profil sont déjà prises en charge. Les alias simples `Région`, `Département` et `Profil` sont également acceptés en plus des intitulés complets du fichier type.
