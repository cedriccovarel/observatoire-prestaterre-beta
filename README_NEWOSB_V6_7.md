# Observatoire Prestaterre V6.7

## Principales évolutions

- Carte : fond `Historique` renommé `Neutre`; compteur d'opérations affiché sous le nom de région avec taille compensée selon le zoom.
- Acteurs : Portefeuilles + Familles en haut, Familles en camembert, Avancement en pleine largeur sous les deux blocs.
- Labels & performances : index/caches pour réduire le temps de rendu; sélection directe d'un couple Mention × Performance dans la matrice.
- Exigences : **aucune modification** de `requirements.js` et `Code_Exigences.gs` par rapport à la V6.6.
- Solutions constructives : grille resserrée et plus lisible; menuiseries réparties en 3 sous-blocs; systèmes techniques en grille optimisée.
- Énergie & transition : `D’où vient le CEP ?` peut être affiché en barres ou en camembert, par usage et par vecteur.
- Projets & opérations : un clic sur un projet ouvre une fenêtre dédiée, avec sélection de l'opération/bâtiment technique puis 4 onglets : Générale, Énergie & transition, Carbone & DPE, Données économiques.
- Générale projet : description automatique, tags cliquables, liste des projets partageant un tag, cadre de certification.
- Tags : nouvelle colonne `Tags` en fin de l'onglet OPERATIONS. Plusieurs tags peuvent être saisis dans une cellule en les séparant par des virgules.
- Énergie projet : indicateurs techniques et estimation simplifiée des charges énergétiques en €/m².an avec hypothèses explicitement affichées.
- Économie projet : structure prête pour DPGF par lot/macro-lot et aides/financements, laissée vide tant que les données ne sont pas connectées.

## Année : règle métier V6.7

La colonne `Année` de l'onglet OPERATIONS reste **l'année de construction du bâtiment**. Elle n'alimente plus le filtre temporel du site.

Le filtre `Année certification` est calculé dans cet ordre :

1. `Certification: Date de décision CD`;
2. à défaut `Certification: Date de décision AP`;
3. à défaut `Évaluation: Date de création`;
4. sinon aucune année de certification n'est inventée.

Les comparables de bâtiments utilisent en priorité l'année de construction.

## Colonne Tags

- Position : **106**, après `DPE GES après travaux final`.
- Syntaxe recommandée : `Rénovation, Logement collectif, ITE, RCU, BBC Effinergie Rénovation`.
- La source Google Apps Script OPERATIONS étant dynamique sur le nombre de colonnes, l'ajout de `Tags` en fin de feuille ne nécessite pas de redéploiement de `Code_Operations.gs`.

Les fichiers `COLONNES_OPERATIONS_V6_7.tsv`, `COLONNES_OPERATIONS_V6_7.md` et `PROMPT_EXTRACTION_OPERATIONS_V6_7.md` sont inclus dans le paquet.
