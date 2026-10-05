# Historique

## V6.13.6

**Avancement : restauration du repli sur « État du dossier »**
- Correction d'une erreur introduite en V6.13 : le repli sur la colonne « État du dossier » (AV) avait été supprimé. Sur l'export réel du 30/09/26, 903 lignes historiques sans code interne n'ont aucune valeur en BC et portent leur avancement dans AV (754 « Évaluation conforme », 80 « Visite réalisée », 48 « Analyse réalisée », 16 « Non démarrée », 5 « Dossier incomplet »). Aucune ligne n'a les deux colonnes renseignées. Sans ce repli, elles tombaient en « Non renseigné » (V6.13 à V6.13.3) ou en « Proposition commerciale en cours » (V6.13.4 et V6.13.5), d'où une répartition très différente de la V6.12.
- Règle : BC d'abord ; si BC est vide, « État du dossier » ; une valeur BC non reconnue n'est pas remplacée (signalée en Qualité).
- « Proposition commerciale en cours » = ligne sans code interne ET sans avancement en BC ni en AV (88 lignes sur l'export, toutes annulées ou abandonnées).
- Résultat sur l'export réel (projets actifs) : Non démarrée 745, Dossier incomplet 303, Dossier complet 3, Analyse planifiée 73, Analyse réalisée 1 227, Visite réalisée 853, Évaluation conforme 1 943, Non renseigné 18 — contre 759 / 303 / – / 73 / 1 225 / 851 / 1 928 en V6.12.

**Visibilité**
- Qualité & données : tableau de contrôle avec lignes lues en BC, lignes lues en « État du dossier », lignes sans avancement, projets, annulés / abandonnés, projets dans le tunnel ; valeurs non reconnues listées par colonne.
- Message de connexion : colonnes lues et nombre de lignes lues en repli.
- Note sous le tunnel avec le nombre de projets « Non renseigné » et un lien pour les lister ; « Non renseigné » ajouté au filtre Avancement.
- Bouton « Copier le diagnostic de l'avancement » (version, colonnes, lignes par source, valeurs non reconnues, tunnel ; aucune donnée client).

**Tests** : 67 tests unitaires, 56 vérifications navigateur.

## V6.13.5

**Labels & performances — tableau croisé Mentions × performances**
- Les champs de recherche des deux listes à cocher ne masquaient aucune ligne (une règle CSS annulait le masquage). Ils fonctionnent : tous les mots saisis doivent apparaître, dans n'importe quel ordre, sans tenir compte des accents ni de la casse (« rt2012 -20 » trouve « BEE+ Niveau RT2012 -20% »). Un message « Aucun résultat pour cette recherche » s'affiche si rien ne correspond.
- Cocher une case ne ramène plus la liste en haut : la position de défilement, la recherche saisie et le focus sont conservés à chaque rafraîchissement du tableau.
- « Réinitialiser » efface aussi ces recherches.
- Même défaut corrigé dans les filtres déroulants du haut de page (Maître d'ouvrage, Référentiel…) : la liste revenait en haut à chaque case cochée.

**Tests** : 64 tests unitaires, 52 vérifications navigateur (dont recherche, défilement, focus et clics souris réels sur le tableau croisé).

## V6.13.4

**Avancement**
- Nouvelle première étape « Proposition commerciale en cours » : toute ligne sans code interne (colonne B). Ces lignes sont regroupées par numéro de contrat (et non plus par nom d'opération, qui fusionnait des contrats homonymes).
- Seuil de reconnaissance abaissé à 80 % des valeurs non vides de la colonne BC.
- Liste fermée élargie aux écarts d'écriture : majuscules, accents, espaces multiples ou collés, tirets et ponctuation, pluriels, e muet, numérotation, complément après le libellé, caractères invisibles, fautes de frappe légères (1 à 2 lettres), variantes courantes (« Eval. conforme », « Analyse faite », « Analyse prévue », « Visite »…). « Non conforme » n'est jamais lu comme « Évaluation conforme ».
- Tunnel (Observatoire et slide du générateur) à 8 étapes, sur une seule ligne.
- Dictionnaire mis à jour (il décrivait encore l'ancienne règle des 95 %).

**Performance**
- Connexion de la source fortement accélérée : la normalisation des en-têtes était recalculée des millions de fois. Sur l'export réel (7 003 lignes), le traitement dans le navigateur passe d'environ 85 s à environ 5 s. Pendant ce délai, les graphiques n'étaient pas encore alimentés.

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
