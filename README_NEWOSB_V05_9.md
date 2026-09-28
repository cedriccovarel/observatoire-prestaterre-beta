# NEWOSB V05.9

## Correctif reconnaissance Maître d’ouvrage

- Le mapping de la source `OPERATIONS` ne dépend toujours pas de l’ordre des colonnes.
- La détection du champ **Maître d’ouvrage** privilégie désormais les en-têtes contenant `Nom de la société` / `Société principale` et ne confond plus le nom avec `Hiérarchie`, `Secteur d’activité` ou `Groupe principal`.
- Sont reconnus notamment : `Maître d’ouvrage: Nom de la société`, `Maître d'ouvrage: Société principale: Nom de la société`, leurs variantes typographiques et les intitulés préfixés par `Évaluation: Opération:`.
- `MOA` et `Maître d’ouvrage` restent acceptés comme intitulés courts.
- `Code_Operations.gs` et `Code_Exigences.gs` sont fournis séparément.
