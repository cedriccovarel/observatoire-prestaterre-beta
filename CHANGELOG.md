# Historique

## V6.21.1

- Correctif : un menu de filtre ouvert d’un clic (panneau de droite, Observatoire et onglet Exigences) se refermait dès que les filtres étaient redessinés — par exemple pendant le chargement des exigences en arrière-plan, qui rafraîchit la page à chaque bloc. Le menu ouvert est maintenant mémorisé et reste ouvert.

## V6.21

**Filtres dans un panneau vertical à droite, repliable**
- Les filtres ne sont plus au-dessus des pages : ils sont dans un panneau à droite (nombre d’opérations, « Réinitialiser », un filtre par ligne ; le menu à cases s’ouvre sur place). Un filtre actif affiche sa valeur dans une étiquette verte.
- Bouton « › Filtres » pour replier le panneau en une fine bande (badge = nombre de filtres actifs) et « ‹ » pour le rouvrir ; le choix est retenu dans le navigateur. Replié par défaut sur les écrans de moins de 1 180 px ; sur téléphone, le panneau s’ouvre par-dessus la page.
- L’onglet Exigences utilise le même panneau pour ses propres filtres (y compris les filtres figés d’un lien de partage).

## V6.19

**Filtre « Type de programme » dans tous les menus issus d’OPERATIONS**
- Nouveau filtre global (barre de filtres, après « Référentiel ») : Vue d’ensemble, Territoires, Acteurs, Certification, Labels, Solutions, Énergie, Carbone, Croiser, Projets & opérations, Qualité ; il se combine avec les autres filtres et peut être figé dans un lien de partage. Le type figure aussi dans la fiche projet (Identité du projet).
- Le script OPERATIONS ajoute à chaque ligne deux colonnes calculées : « Type de programme (calculé) » et « Type de programme : origine ». Rapprochement avec RAPPORT par **code interne d’opération**, puis par **numéro de contrat** (si RAPPORT contient une colonne « Numéro du contrat ») ; à défaut, le nom présent dans OPERATIONS (« Nom du programme (client) » ou « Nom de l’opération ») est classé avec le même dictionnaire, selon le référentiel. Une colonne « Type de programme » saisie dans OPERATIONS l’emporte.
- Calcul fait par le script avant toute anonymisation : un lien anonymisé conserve le filtre sans transmettre de nom. Index RAPPORT mis en cache 10 minutes.

## V6.18

**Exigences : nouveau filtre « Type de programme »**
- Le script lit la colonne « Évaluation: Opération: Nom du programme (client) » de RAPPORT et en déduit le type de programme : Bureaux, Commerces, Hôtelier, Scolaire et enseignement, Logement collectif, Logement individuel, Résidences gérées, Santé et médico-social, Locaux d’activité et industrie, Logistique, Équipements publics.
- Reconnaissance par synonymes et termes proches (ex. crèche, EAJE, ALSH, groupe scolaire → Scolaire ; EHPAD, CMS, centre de soins → Santé ; gymnase, médiathèque, CAF, Pôle emploi → Équipements publics). Le premier terme du nom l’emporte ; les morceaux du nom qui sont une adresse (« Rue de la Mairie - Bureaux ») sont ignorés.
- Le référentiel limite la recherche : référentiel tertiaire → catégories tertiaires (et résidences gérées) ; référentiel logement → logement collectif (par défaut), individuel (lotissement, maisons, « individuels », « 2ind ») ou résidence gérée (résidence étudiante / senior, foyer, coliving…). « Villa … » / « Pavillon … » ne suffisent pas (noms commerciaux d’immeubles).
- Sans terme reconnu en tertiaire : « Non déterminé » (aucune catégorie inventée). Une colonne facultative « Type de programme » dans RAPPORT permet de corriger ou compléter : sa valeur l’emporte.
- Le type est calculé par le script : un lien de partage anonymisé conserve le filtre mais ne transmet jamais le nom du programme. Le filtre peut être figé dans un lien de partage.
- Liste des termes : `docs/reference/TYPES_DE_PROGRAMME.md`.

## V6.17

**Une seule connexion : opérations et exigences avec la même URL et la même clé**
- Le script OPERATIONS sert aussi l’onglet RAPPORT (modes `reqMeta` / `reqChunk`, clé OPERATIONS vérifiée à chaque requête ; données pseudonymisées si `NEWOSB_ANONYMIZED_ONLY`). À la connexion OPERATIONS (bouton Données), les exigences sont chargées dans la foulée : plus besoin de saisir l’URL et la clé Exigences.
- Si RAPPORT est dans un autre classeur : propriété `NEWOSB_RAPPORT_SPREADSHEET_ID` du projet OPERATIONS (déjà utilisée par les liens de partage). Sans elle, l’onglet Exigences l’explique.
- L’ancienne source Exigences séparée reste disponible (encart repliable « Utiliser une source Exigences séparée »). La déconnexion OPERATIONS retire aussi les exigences chargées par elle.

**Mini-jeu « Capte le CO₂ » : nouvelle version**
- Correctif : le dépôt du CO₂ à la base ne se déclenchait que si le personnage s’arrêtait pile au centre d’une case ; il se fait maintenant en passant devant la base (cases de dépôt surlignées quand on transporte du CO₂).
- Bâtiments variés : logements collectifs, maisons, tours, bureaux, usine, école, commerce, hôpital (disposition tirée au hasard à chaque partie).
- Le CO₂ s’échappe au hasard des bâtiments (bulle « CO2 », « CO2x2 » pour l’usine) ; on le capte en longeant le bâtiment.
- Adversaires : engins de chantier polluants (bulldozer, camion-benne, toupie béton, pelleteuse) avec fumées d’échappement ; ils roulent dans les rues, ne tournent qu’aux carrefours et foncent (gyrophare) quand ils voient le personnage dans leur rue. 2 engins au niveau 1, un de plus à chaque arbre planté.
- Le jeu reste ouvert jusqu’à la fin du chargement des exigences.

## V6.16

**Mini-jeu pendant le chargement des données : « Capte le CO₂ »**
- Pendant le chargement depuis la Google Sheet (OPERATIONS, Exigences, ouverture d’un lien de partage), un jeu 8 bits remplace l’écran d’attente : le personnage ramasse les nuages de CO₂ émis par les bâtiments (3 au maximum), les rapporte à la base pour faire pousser l’arbre du logo Prestaterre (6 stades), et évite les nuages de pollution qui le poursuivent. Un arbre adulte = un arbre planté, un toit végétalisé, un niveau de plus (pollueurs plus nombreux et plus rapides). 3 vies ; record gardé dans le navigateur.
- Commandes : flèches (ou ZQSD / WASD), P pour la pause, Espace pour rejouer ; croix directionnelle et glissement du doigt sur mobile.
- La barre de progression et le nombre de lignes restent affichés au-dessus du jeu. Quand les données sont prêtes : si l’on n’a pas joué, l’Observatoire s’affiche aussitôt ; sinon le bouton « Accéder à l’Observatoire » (ou Entrée) permet de quitter la partie à tout moment. « Masquer le jeu » / Échap : le chargement continue en arrière-plan. En cas d’erreur, le message s’affiche et le jeu se ferme.
- Un chargement très rapide (moins d’une demi-seconde) n’affiche pas le jeu. Le jeu ne lit ni ne transmet aucune donnée.

## V6.15

**Liens de partage à durée limitée**
- Nouveau bouton **⤴ Partager** (barre du haut, Observatoire connecté avec la clé OPERATIONS) : crée un lien unique vers une vue de l’Observatoire avec le périmètre actuel (filtres, filtres analytiques, recherche) figé, les onglets choisis, un onglet d’ouverture et une durée (24 h, 7 jours, 30 jours, 3 mois, 6 mois, 1 an ou date précise ; 366 jours au maximum). Option « Anonymiser les données pour le destinataire ».
- Le destinataire ouvre le lien sans mot de passe ni clé : il navigue dans les onglets accordés, ouvre les fiches et les détails, utilise les filtres analytiques et la recherche à l’intérieur du périmètre, mais ne peut pas modifier les filtres. Boutons Données, Réinitialiser, Générateur et Présentation absents.
- Contrôle côté serveur (Code_Operations.gs) à chaque requête : jeton connu, non révoqué, non expiré ; seules les lignes du périmètre sont lues et transmises ; un lien anonymisé reçoit des données pseudonymisées par le serveur (adresses, contacts, montants retirés). Un lien ne donne accès ni à l’administration, ni à Google Slides, ni à la lecture complète.
- Le jeton (43 caractères aléatoires) n’est affiché qu’une fois ; le script n’en conserve que l’empreinte SHA-256, dans un onglet masqué `OBSERVATOIRE_PARTAGES` créé automatiquement. Dans le navigateur, il reste dans le fragment de l’URL (`#partage=…`) : jamais envoyé à GitHub Pages, jamais écrit dans localStorage ou sessionStorage.
- **Exigences incluses** : l’onglet Exigences peut être accordé. Les lignes RAPPORT des opérations du lien sont lues par le script OPERATIONS (même jeton, aucune clé ni URL Exigences pour le destinataire) ; les filtres de l’onglet Exigences affichés à la création sont figés (sans MOA ni groupe pour un lien anonymisé). La fiche projet du destinataire affiche les exigences de l’opération, y compris en mode anonymisé (pseudonymes identiques des deux côtés). Configuration : propriété `NEWOSB_RAPPORT_SPREADSHEET_ID` du projet OPERATIONS si RAPPORT est dans un autre classeur.
- Code_Exigences.gs : la lecture de RAPPORT est regroupée dans un bloc commun, copié à l’identique dans Code_Operations.gs (vérifié par les tests) ; aucun changement de comportement.
- Liste des liens dans la même fenêtre : statut (actif, expiré, révoqué), date d’expiration, nombre d’ouvertures et dernier accès ; **Prolonger** et **Révoquer** (effet immédiat).
- Le périmètre est la liste des codes internes affichés à la création : les valeurs restent à jour à chaque ouverture, mais une opération créée ensuite n’est pas ajoutée (créer un nouveau lien). Les opérations sans code interne ne peuvent pas être partagées (signalé dans la fenêtre).
- Correctif du pont : une fenêtre Google réutilisée juste après une connexion n’est plus fermée par la fermeture différée de la connexion précédente.

## V6.14.2

**Vue d’ensemble : graphique « Évolution des projets » rétabli avec les filtres**
- Depuis la V6.13.1, la courbe ne lisait que l’année de *certification* : dès qu’un filtre ne gardait que des projets en cours (un MOA, la Rénovation, un avancement, un département…), le graphique disparaissait (« Aucune année exploitable »).
- Choix de l’année : Automatique (certification, ou création si la sélection n’a aucune décision de certification), Certification, Création. Une note indique l’année utilisée et le nombre de projets non représentés.

**Compatibilité des mentions : par famille de référentiel, toutes versions**
- Décision Prestaterre : la date de version n’intervient plus. Les lignes *Logement Neuf* sont comparées aux règles BEE Logement Neuf 04/05/2026 et les lignes *Logement Rénovation* aux règles du 18/06/2025, par code d’exigence. Neuf et Rénovation ne sont jamais mélangés.
- Nouveau tableau « Compatibilité des opérations filtrées avec chaque mention » : pourcentage, critères couverts, statut (calculée / provisoire / non applicable) pour toutes les mentions de la famille ; bouton « Détail » vers la carte de la mention.
- Taille du bouquet réglable : Top 20 (par défaut), Top 40, ou toutes les exigences du périmètre filtré.

## V6.14.1

**Compatibilité des mentions : rattachement des lignes RAPPORT aux versions des référentiels**
- La version est lue dans plus de formats : 04/05/2026, 4/5/26, 04.05.2026, 2026-05-04, « 4 mai 2026 », numéro de série Google Sheets, date contenue dans un texte (« Version du 04/05/2026 »), puis colonne « Version du ref ( date ) ».
- Si RAPPORT ne porte que le mois et l’année (« mai 2026 ») ou l’année (« 2026 », « V2026 »), la ligne est rattachée à la version du catalogue **seulement si une seule version de ce référentiel correspond** ; l’encart le signale.
- La famille de référentiel est reconnue avec ou sans le mot « BEE » (« Logement Neuf », « Logement Rénovation »).
- Périmètre affiché par défaut : le plus documenté **parmi ceux dont les règles sont disponibles** (auparavant le plus documenté, même sans règles, d’où « Version non couverte »).
- Diagnostic : tableau des valeurs « Référentiel » et « Version » réellement lues dans RAPPORT, avec le nombre d’opérations et le rattachement obtenu (ou la raison du refus).

## V6.14

**Exigences dans la fiche opération**
- Nouvel encart « Exigences sélectionnées pour cette opération » (onglet Vue d’ensemble de la fiche, repris dans l’export de la fiche) : rapprochement par **code interne d’opération** uniquement (espaces, casse et caractères invisibles normalisés ; zéros significatifs conservés ; jamais par nom, MOA, contrat ou code d’évaluation).
- Nombre d’exigences distinctes, code, intitulé, référentiel et version, regroupement par cible quand il est fiable. Plusieurs évaluations ou versions restent séparées (aucune n’est désignée « actuelle »). Doublons retirés par évaluation. La colonne « Exigence validée » est affichée telle quelle : une sélection n’est pas une validation.
- États explicites : source non connectée, chargement, accès refusé, source indisponible, aucune ligne associée (sans conclure à « aucune exigence »), correspondance partielle, plusieurs évaluations. Mise à jour d’une fiche déjà ouverte sans perte du défilement. Mode anonymisé respecté.
- Données lues via une interface figée (`NEWOSB_REQUIREMENTS.getOperationRequirements`), indépendante des filtres de l’onglet Exigences.

**Compatibilité des exigences sélectionnées avec les mentions** (bas de l’onglet Exigences, pleine largeur)
- Bouquet des 20 exigences les plus sélectionnées (opérations distinctes, filtres généraux de l’onglet, jamais la pagination ni le focus local). Trois cartes : 1re, 2e mention la plus compatible, 3e au choix (menu de toutes les mentions, regroupées par référentiel et version). Bouquet consultable, diagnostic des exigences sans correspondance fiable.
- Nouveau moteur `newosb-mentions.js` (ET, OU, au moins K parmi N, dépendances, conditions d’application, optionnelles/recommandées hors score, ambiguïtés) et catalogue `mentions_catalog.js` : BEE Logement Neuf 04/05/2026 (24 mentions) et BEE Logement Rénovation 18/06/2025 (7 mentions). Versions non fournies (LR 04/05/2026, Tertiaire Neuf, Tertiaire Exploitation) : « Version non couverte ».
- Cas de contrôle BEE LN 04/05/2026, collectif RE 2020 : Biodiversité 9/10 (90 %), BEE+ 8/9 (89 %), Habitat Qualité 6/8 (75 %).

**Sécurité des sources Google (les deux scripts changent)**
- Clé d’accès obligatoire et vérifiée côté serveur à chaque requête du pont ; plus aucune donnée par GET, JSON ou JSONP ; ping public minimal ; limitation des essais.
- `Code_Exigences.gs` : RAPPORT n’est plus exposé sans contrôle ; même pont sécurisé qu’OPERATIONS, chargement par blocs.
- Navigateur : clé saisie dans un champ et gardée en mémoire seulement (jamais dans l’URL ni le stockage) ; envoi ciblé vers l’origine exacte du pont ; fenêtre source et jeton vérifiés ; refus = suppression des données privées en mémoire ; plus de repli JSON/JSONP. Nouveau module partagé `newosb-bridge.js`.
- Mode anonymisé : les filtres MOA et Groupe MOA de l’onglet Exigences n’affichent plus de nom réel.

**Présentation : exports rétablis**
- PPTX (visuels de nouveau présents), PNG 4K / SVG (fichiers de nouveau produits) et Google Slides : le rendu passait par une image SVG en URL `blob:` qui bloquait le canvas dans Chrome ; la fenêtre Google était ouverte trop tard et bloquée comme pop-up. La présentation créée s’ouvre dans la fenêtre Google ouverte au clic.

**Rangement** : les copies d’anciens README/QA/scripts présentes à la racine (identiques à celles de `docs/`) et l’ancien `Code.gs` sont supprimées ; les guides V6.13.x sont déplacés dans `docs/historique/`.

**Tests** : 134 tests unitaires, 92 vérifications navigateur.

## V6.13.7

**Avancement : chiffres de la colonne BC et lecture renforcée**
- Page Certification, carte Avancement : nouvelle case **« Inclure annulés / abandonnés »**. Décochée (par défaut), le tunnel compte les projets actifs, comme avant. Cochée, les cartes reprennent les chiffres bruts de la colonne BC (annulés, abandonnés et perdus compris). Sur l'export du 30/09/26 : Non démarrée 745 → 1 264, Dossier incomplet 303 → 346, Analyse réalisée 1 227 → 1 351. Une note sous le tunnel indique combien d'affaires sont hors tunnel.
- En-têtes en double : si deux colonnes portent le même nom, la dernière écrasait silencieusement les autres. La colonne d'avancement est maintenant lue **par sa position (BC)**, même si son nom est dupliqué ; le doublon est signalé dans Qualité & données et dans le diagnostic.
- Diagnostic copiable : ajoute le nombre de lignes annoncées par la Sheet, le nombre de colonnes et les en-têtes en double.

**Tests** : 68 tests unitaires, 62 vérifications navigateur.

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
