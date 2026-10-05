# NEWOSB V05.3

Évolution ciblée de l'onglet **Exigences**.

## Filtres multi-sélection

Les filtres Exigences utilisent désormais des cases à cocher et acceptent plusieurs valeurs simultanément :

- Référentiel
- Période
- Nature
- Profil spécifique
- Région
- Département
- Mention
- Secteur MOA
- Statut de l'évaluation
- Thème

Les valeurs cochées dans un même filtre sont combinées en **OU**. Les familles de filtres sont croisées entre elles en **ET**.

Exemple : `(Île-de-France OU Nouvelle-Aquitaine) ET (Profil DRIHL OU Profil Ville) ET (Conforme OU En cours)`.

Le filtre Département reste dépendant des régions cochées.

## Recherche d'exigence enrichie

Pour chaque exigence trouvée par code ou mots-clés, NEWOSB affiche :

- nombre d'occurrences dans RAPPORT ;
- nombre d'occurrences dans la sélection filtrée ;
- profil dans lequel l'exigence apparaît le plus, avec son nombre d'occurrences ;
- région dominante et nombre d'occurrences ;
- département dominant et nombre d'occurrences ;
- référentiel dominant et nombre d'occurrences ;
- mention dominante et nombre d'occurrences.

Les statistiques dominantes sont recalculées sur la sélection active.

## Source RAPPORT

Aucune nouvelle colonne n'est obligatoire. Le filtre de statut utilise le champ déjà reconnu par `Code_Exigences.gs` : `Évaluation: Statut`.
