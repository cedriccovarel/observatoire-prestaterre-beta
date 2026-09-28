# NEWOSB V05.16

Cette version part de NEWOSB V05.15 et conserve le chargement OPERATIONS gros volume et la détection automatique des en-têtes.

## Filtres

- Tous les filtres de l'Observatoire sont maintenant des groupes de cases à cocher multi-sélection : Année, Référentiel, Nature, Avancement, Maître d'ouvrage, Région, Département, Profil et Zonage.
- Les filtres Exigences restent eux aussi en cases à cocher multi-sélection : Référentiel, Période, Nature, Profil, Région, Département, Mention, Secteur MOA, Statut évaluation et Thème.
- Plusieurs valeurs cochées dans une même famille sont combinées en OU ; les familles entre elles sont combinées en ET.
- Quand une seule région est cochée, la carte se centre automatiquement sur elle. Avec plusieurs régions cochées, la carte reste libre et les départements proposés sont limités aux régions sélectionnées.
- Les sélecteurs purement visuels, comme Ubat / TIC / DH, ne sont pas des filtres et restent des sélecteurs.

## Territoires

- Clic sur une région : zoom automatique sur son emprise.
- Le zoom régional conserve le découpage départemental et affiche progressivement les EPCI, les villes, les grandes villes et la répartition des opérations.
- Les grandes villes sont recherchées via l'API géographique officielle, avec prise en charge des régions métropolitaines et ultramarines.
- Bouton `Plein écran` sur la carte.
- Fonds Historique NEWOSB, IGN et OSM conservés.
- Les couches Zonage 1/2/3, Régions, Départements, Intercommunalités, Villes et Opérations restent indépendantes.

## Acteurs

- La famille de maître d'ouvrage utilise en priorité la colonne exacte `Maître d'ouvrage: Groupe principal Secteur d'activité`.
- Le tableau Portefeuilles est compacté.
- Pagination de 15 maîtres d'ouvrage par page avec navigation page 1, page 2, etc.

## Certification

- Suppression du tableau `Statuts sources`.
- La chronologie `Statut par année` occupe désormais toute la largeur disponible.

## Labels & performances

- Suppression du tableau `Nature`.
- Tableau Mentions paginé à 15 lignes par page.
- Tableau Performances paginé à 15 lignes par page.
- Recherche par mot-clé indépendante dans les deux tableaux.

## Source OPERATIONS

Aucune modification Apps Script n'est requise pour passer de V05.15 à V05.16. `Code_Operations.gs` est strictement identique à celui de V05.15.
