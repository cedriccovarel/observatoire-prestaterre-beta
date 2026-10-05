# Historique

## V6.13.3

- Projet à plusieurs lignes (même code interne) : avancement global = étape la **moins avancée** parmi ses lignes renseignées. La fiche détaillée de chaque opération garde le statut exact de sa ligne (colonne BC).
- Fiche : libellé « Avancement global (étape la moins avancée) » pour les projets à plusieurs lignes.
- Qualité & données : tableau de contrôle par valeur de la colonne BC — lignes Sheet, projets, dont annulés / abandonnés, dans le tunnel.
- Contrôlé sur l'export réel « Tous contrat 30/09/26 » (7 003 lignes) : les lignes lues par valeur de BC sont identiques à la Sheet.

## V6.13.2

**Avancement : colonne BC uniquement**
- L'avancement est lu exclusivement dans « Opération: Évaluation: Statut » (colonne BC). La recherche d'une autre colonne « par contenu » est supprimée.
- Si l'intitulé a changé, la colonne située en BC est utilisée à condition que son contenu corresponde.
- La colonne n'est plus jamais écartée : si moins de 95 % des valeurs sont reconnues, ou si la colonne n'est plus en BC, une alerte s'affiche à la connexion.
- Valeurs tolérées en plus : numérotation en tête (« 3 - Dossier complet », « 05. Analyse planifiée ») et complément après le libellé (« Analyse réalisée - en attente »).
- Nouveau contrôle ligne à ligne dans Qualité & données : chaque valeur distincte de la colonne BC, comment elle est lue, nombre de lignes ; passage lignes → projets → projets exclus → projets du tunnel ; projets dont les lignes ont des statuts différents.

**Tests** : 58 tests unitaires, 32 vérifications navigateur.

## V6.13.1

**Années**
- Année de certification : uniquement l'année de la colonne « Date de décision de certification » (plus de repli sur les dates CD, AP ou de réception, qui faussaient le filtre).
- Nouveau filtre « Année de création » : année de la colonne « Date de création » (et non « Affaire: Date de création » ou autre).
- Lecture des dates fiabilisée : 15/03/2024, 15/03/24 (année sur 2 chiffres, auparavant ignorée), 2024-03-15, 15 mars 2024, numéro de série Google Sheets.
- Chronologie « Statut par année » : désormais par année de création (un dossier en cours n'a pas d'année de certification).
- Dates illisibles signalées dans Qualité & données ; colonnes de dates absentes ou ambiguës signalées à la connexion.

**Avancement**
- Carte « Tunnel interactif » renommée « Avancement ».
- Les 7 étapes tiennent sur une seule ligne (défilement horizontal seulement sur petit écran).
- La lettre de la colonne utilisée (ex. BC) est affichée à la connexion et dans Qualité & données.

**Tests** : 54 tests unitaires, 30 vérifications navigateur (dont avancement lu en colonne BC, années, filtres, tunnel sur une ligne à 1440, 1100 et 900 px).

## V6.13

**Avancement**
- Lu exclusivement dans `Opération: Évaluation: Statut`, liste fermée de 7 valeurs : Non démarrée, Dossier incomplet, Dossier complet (nouvelle étape), Analyse planifiée, Analyse réalisée, Visite réalisée, Évaluation conforme.
- Colonne validée par son contenu (≥ 95 % de valeurs conformes) ; sinon recherche d'une autre colonne par contenu ; sinon « Non renseigné » avec message.
- Plus de repli sur « État du dossier » ni sur le statut commercial ; une cellule vide n'est plus comptée « Non démarrée ».
- Tunnel (Observatoire et slide du générateur), filtre, chronologie et fiche projet passent à 7 étapes.

**Lecture des données**
- Nouveau module partagé `newosb-rules.js` ; les trois lectures numériques divergentes sont unifiées.
- Corrigé : `n.c.` / `-` comptés 0 dans les moyennes ; « 2 » de `m2.K/W` lu comme R ; `12,3 / 15` lu 12,315 ; `0,14 m` lu 0,14 mm ; `2x100 mm` lu 100 ; `120 + 100 mm` lu 120 ; U en W/m².K lu comme R ; `1.234,5` illisible.
- Plages de vraisemblance (épaisseur 5–1000 mm, R 0,05–20) ; valeurs écartées signalées.
- Année de construction : « avant 1948 » → 1948.

**Qualité & données**
- Encart Avancement (colonne utilisée, colonnes écartées, valeurs hors liste, répartition).
- Encart Valeurs non interprétées (cellule, valeur saisie, raison).
- Contrôles qualité `unreadable:*` et `progress:*`.
- Mention « échantillon faible » sous 5 valeurs.

**Sécurité**
- Pont Apps Script : réponses uniquement aux sites de `NEWOSB_ALLOWED_ORIGINS` (avant : tout site).
- Clé d'accès optionnelle `NEWOSB_ACCESS_KEY` (OPERATIONS et Exigences).
- Mode serveur anonymisé `NEWOSB_ANONYMIZED_ONLY` (pseudonymes HMAC, suppression adresses / contacts / montants).
- Anonymisation navigateur : pseudonymes SHA-256 à clé secrète, sans collision ; montants masqués.
- Fonction de contrôle `configurerSecuriteObservatoire()`.

**Paquet**
- `Code.gs` supprimé (doublon de `Code_Operations.gs`, risque de double `doGet`).
- Copie périmée du script (V05.22) retirée de `app.js` ; l'aide charge `Code_Operations.gs` publié.
- Générateur : chargeait une version d'`app.js` en cache (6.5) ; versions alignées.
- Documentation rangée dans `docs/` ; suite de tests unique `tests/run_all.js` (45 tests) et test navigateur `tests/e2e_browser.js` (17 vérifications).

## Versions précédentes

Voir `docs/historique/` (README et QA de chaque version jusqu'à V6.12).
