# Rapport de tests — Observatoire Prestaterre V6.14

Exécuté le 06/10/2026 dans un conteneur Linux (Node 22, Chromium 1.56 via Playwright), sur le paquet livré.

## 1. Ce qui a été exécuté

| Suite | Commande | Résultat |
|---|---|---|
| Tests unitaires (règles, moteur, Apps Script simulé, moteur des mentions, module Exigences, client du pont) | `node tests/run_all.js` | **134 tests réussis, 0 en échec.** |
| Tests navigateur (Chromium réel, vrais `Code_Operations.gs` et `Code_Exigences.gs` exécutés dans Node derrière une doublure de Google) | `node tests/e2e_browser.js` | **92 vérifications navigateur réussies, 0 en échec.** |
| Vérification visuelle | captures de l’encart et de la fiche à 1440, 900 et 390 px | conformes : 3 cartes côte à côte, puis 2 + 1, puis empilées ; aucun défilement horizontal |

Avant modification, la suite existante donnait 67/68 (le test « un seul script OPERATIONS » échouait à cause du doublon `Code.gs`) et 62/62 en navigateur ; l’export PPTX produisait une slide « Visuel indisponible » (reproduit dans Chromium).

## 2. Points de recette couverts par un test exécuté

- Rapprochement par code opération ; identifiants proches mais distincts (OP-0101 / OP-101) ; zéros significatifs ; variations d’écriture ; jamais par MOA ni code d’évaluation.
- Doublons de lignes ; plusieurs évaluations d’une opération (séparées) ; séparation des référentiels et versions ; exigence sélectionnée mais « Exigence validée = Non ».
- Source absente, clé absente, clé incorrecte, clé révoquée, déconnexion (clé et données effacées), erreur au rechargement (aucun ancien jeu conservé).
- Rappel projet non contaminé par les filtres Exigences, le focus local, la recherche ou la pagination.
- Fréquences par opérations distinctes ; Top 20 indépendant de la pagination ; multicoche MOA (OU) × Référentiel (ET) ; recalcul après changement de MOA.
- ET, OU, au moins K parmi N, dépendance à une autre mention, optionnelles hors score, non applicable établi, condition inconnue (provisoire), ambiguïté du référentiel, correspondance « à vérifier », règle non définie (« Non calculable », jamais 0 %), version non couverte (aucune transposition).
- Classement et égalités ; 3e carte manuelle conservée lors d’un recalcul, retour à l’automatique ; mention d’un autre périmètre (incompatibilité affichée) ; menu contenant les 33 entrées du catalogue, regroupées par référentiel et version ; homonymes distincts (BEE+ LN / BEE+ LR).
- Cas normatif BEE Logement Neuf 04/05/2026, logements collectifs RE 2020, PC 2025-2027, bouquet de 20 exigences fourni : **Biodiversité 9/10 = 90 %** (2.4.6 absente), **BEE+ 8/9 ≈ 89 %** (acoustique 4.3.4-4.3.6 absente), **Habitat Qualité 6/8 = 75 %** (Évaluation des charges et Acoustique renforcée absentes). Dans ce contexte, ce sont aussi les trois premières de l’encart.
- Échappement HTML (MOA et intitulés piégés) ; mode anonymisé (fiche par pseudonyme, codes d’évaluation masqués, aucun nom de MOA dans l’onglet Exigences).
- Défilement et focus conservés : fiche mise à jour à l’arrivée des exigences, menus de conditions et de 3e carte, filtres.
- Ponts : clé absente / incorrecte / non configurée / trop courte → refus ; clé correcte → chargement ; clé révoquée → refus ; GET direct `data/meta/chunk` (même avec `?key=`) → aucune donnée ; JSONP supprimé ; ping minimal ; origine, fenêtre source ou jeton incorrects → rejet ; clé envoyée uniquement à l’origine exacte du pont, jamais vers « * » ; clé absente des URL, de localStorage et de sessionStorage ; pas de reconnexion silencieuse après rechargement ; 30 essais invalides → blocage temporaire ; journal sans clé.
- Exports Présentation : PPTX avec visuels, PNG 4K produit, Google Slides créé (2 slides en image) et ouvert dans la fenêtre Google ouverte au clic.
- Aucune erreur JavaScript sur les pages parcourues.

## 3. Vérifications statiques (relecture, sans exécution dédiée)

- Les fonctions publiques d’un projet Apps Script sont appelables par `google.script.run` : `genererCleAcces…` ne remplace jamais une clé existante ; les autres fonctions d’éditeur ne renvoient pas de données.
- Le générateur (`generator.html`) utilise le même `app.js` et le même champ de clé que l’Observatoire.

## 4. Contrôles qui nécessitent un vrai déploiement Google (non réalisés ici)

- Comportement réel du pont dans les iframes `*.googleusercontent.com` de HtmlService (popup et iframe), autorisations Google au premier lancement.
- Partage « Restreint » des classeurs, arrêt de la publication sur le Web, archivage des anciens déploiements.
- Test en fenêtre privée sans compte autorisé ; test avec un compte extérieur au domaine.
- Création effective d’une présentation Google Slides dans Drive (la doublure de SlidesApp vérifie l’appel, pas le rendu Google).
- Volumétrie réelle de RAPPORT (chargement par blocs de 1 500 lignes) et taille maximale acceptée par `google.script.run` pour les images de slides.

## 5. Journal complet

### Tests unitaires
```
1. Lecture des nombres
  ok  décimale française et séparateur de milliers
  ok  unités ignorées (m², CO2, kWh/m2)
  ok  valeurs vides ou non communiquées → null, jamais 0
  ok  zéro reste une valeur valide
  ok  cellule ambiguë → null + motif
  ok  nombre négatif

2. Épaisseurs et résistances R
  ok  « / » ou « ; » : valeur la plus élevée (règle V6.12)
  ok  « + » : couches additionnées
  ok  « x » : nombre de couches × épaisseur
  ok  unités d’épaisseur : sans unité = mm, cm ×10, m ×1000
  ok  R : le « 2 » de m2 n’est pas une valeur
  ok  R : une épaisseur en mm est ignorée
  ok  R : un coefficient U est refusé
  ok  valeurs invraisemblables écartées et signalées

3. Avancement (liste fermée de 8 étapes)
  ok  les 8 valeurs admises, dans l’ordre
  ok  tolère accents, majuscules et pluriels
  ok  valeur hors liste → unknown + invalid
  ok  cellule vide → unknown + empty (plus « Non démarrée » par défaut)
  ok  colonne BC = index 54 ; l’avancement de la feuille de test est bien en BC
  ok  colonne « Opération: Évaluation: Statut » retenue
  ok  seuil de 80 % : 8 valeurs reconnues sur 10 suffisent, 7 sur 10 déclenchent une alerte
  ok  une faute de frappe sur 40 lignes n’invalide pas la colonne
  ok  colonne au bon nom mais au contenu inattendu → utilisée quand même, avec alerte
  ok  aucune autre colonne n’est utilisée, même si son contenu ressemble à un avancement
  ok  colonne BC renommée : utilisée si son contenu correspond
  ok  colonne au bon nom mais pas en BC → utilisée, avec alerte « déplacée »
  ok  feuille de test : colonne trouvée en BC sans alerte
  ok  numérotation et compléments tolérés (« 3 - Dossier complet », « Analyse réalisée - en attente »)
  ok  orthographe, majuscules, espaces et fautes légères tolérés
  ok  « non conforme » et les statuts commerciaux ne sont jamais lus comme un avancement
  ok  repli « État du dossier » : lu seulement quand BC est vide
  ok  colonne de repli retrouvée par son intitulé (accents et casse ignorés), jamais par son contenu
  ok  nom de colonne dupliqué : la colonne en position BC est lue (clé unique), pas la dernière
  ok  moteur : la lecture ligne à ligne utilise BC puis le repli
  ok  le statut commercial (Gagnée/Perdue) n’est jamais pris pour l’avancement

3 bis. Années de certification et de création
  ok  formats de date acceptés
  ok  date vide → aucune année ; date illisible → signalée
  ok  « Date de décision de certification » choisie, jamais « Date de décision CD »
  ok  « Date de création » choisie, jamais « Affaire: Date de création »
  ok  intitulé préfixé accepté s’il est unique
  ok  plusieurs colonnes possibles → aucune n’est devinée
  ok  règle « étape la moins avancée » présente dans le moteur

4. Moteur Observatoire (newosb-core.js)
  ok  compatibilité V6.12 : maximum entre lignes et unités
  ok  une cellule « n.c. » ne masque pas la valeur de la ligne suivante
  ok  valeurs illisibles listées pour la page Qualité
  ok  Qualité : avancement hors liste signalé
  ok  dictionnaire : avancement documenté avec la liste fermée
  ok  dictionnaire : années documentées (décision de certification / création)
  ok  date illisible listée pour la page Qualité

5. Anonymisation côté navigateur (privacy.js)
  ok  pseudonyme stable pour un même nom
  ok  aucune collision sur 20 000 codes
  ok  pseudonymes dépendants de la clé secrète (non devinables)
  ok  montants et adresses supprimés, secteur d’activité conservé

6. Script Apps Script OPERATIONS (Code_Operations.gs) — sécurité V6.14
  ok  pont + bonne clé : lecture meta + bloc de données
  ok  clé absente, incorrecte ou non configurée : refus (authError), aucune donnée
  ok  clé révoquée : les nouvelles requêtes avec l’ancienne clé sont refusées
  ok  accès direct GET aux modes data/meta/chunk : aucune donnée, même avec ?key=
  ok  ping public minimal : ni volume, ni en-tête, ni donnée métier
  ok  plus de transport JSONP (paramètre prefix ignoré)
  ok  la clé n’est jamais transmise au traitement ni journalisée
  ok  limitation des essais : 30 clés invalides bloquent temporairement
  ok  genererCleAcces : ne remplace jamais une clé existante
  ok  page du pont : sans site autorisé, refus ; jamais d’envoi vers « * »
  ok  page du pont : un seul interlocuteur (fenêtre + origine), jeton exigé
  ok  Google Slides et proxys publics conservés
  ok  mode anonymisé : noms pseudonymisés, montants/CP supprimés, statut et chiffres conservés

6 bis. Script Apps Script Exigences (Code_Exigences.gs) — sécurité V6.14
  ok  pont + bonne clé : meta puis blocs, colonnes reconnues quel que soit leur ordre
  ok  clé absente, incorrecte ou non configurée : refus, aucune métadonnée
  ok  clé révoquée refusée
  ok  GET direct : aucun mode ne renvoie de données (l’ancien doGet exposait RAPPORT)
  ok  page du pont Exigences : origine, fenêtre unique, jeton ; aucun « * »
  ok  configuration journalisée sans la clé

6 ter. Listes à cocher (Mentions × performances, filtres)
  ok  CSS : l’attribut hidden masque réellement les lignes des listes à cocher
  ok  listes à cocher : défilement et recherche conservés lors d’un nouveau rendu

8. Moteur des mentions (newosb-mentions.js + mentions_catalog.js)
  ok  paramètre centralisé : bouquet = 20 exigences
  ok  identifiants : espaces, casse, invisibles normalisés ; zéros significatifs conservés
  ok  référentiels : 4 familles distinctes, autres non reconnus
  ok  versions : contexte = famille + date ; versions différentes jamais fusionnées
  ok  codes : Tertiaire / anciennes numérotations acceptés, pas seulement 1 à 4
  ok  codes contradictoires sur une ligne → non résolu
  ok  même numéro, référentiels différents : identités distinctes
  ok  code absent du référentiel de sa version → diagnostic, pas de rapprochement approximatif
  ok  fréquence par opérations distinctes : doublons et évaluations multiples comptés une fois
  ok  opérations sans ligne / sans code opération : jamais comptées comme « zéro exigence »
  ok  tri : fréquence décroissante puis code canonique (ordre naturel), Top limité
  ok  moins de 20 exigences : nombre réel utilisé
  ok  périmètres multiples : un bouquet par référentiel/version, le plus documenté en premier
  ok  CAS NORMATIF BEE LN 04/05/2026, collectif RE 2020, PC compatible : Biodiversité 9/10, BEE+ 8/9, Habitat Qualité 6/8
  ok  ET : toutes les conditions obligatoires comptent
  ok  OU : une alternative couvre le groupe ; les autres ne deviennent pas manquantes
  ok  au moins K parmi N : contribution plafonnée à K, jamais > 100 %
  ok  dépendance : la règle de la mention liée est évaluée (pas sa simple présence)
  ok  optionnelles et recommandées : sans effet sur le score
  ok  non applicable établi : exclu ; condition inconnue : jamais « non applicable » ni « satisfaite »
  ok  condition inconnue ne changeant pas le résultat : calcul fiable (même résultat pour toutes les valeurs)
  ok  ambiguïté du référentiel affectant le dénominateur : provisoire, exclue du classement
  ok  correspondance « à vérifier » (niveau supérieur présumé) : pas de coche verte, résultat provisoire
  ok  règle sans critère défini (BPE LR 2025) : « Non calculable », jamais 0 %
  ok  version non couverte (LR 04/05/2026) : aucune mention calculée, aucune transposition des règles 2025
  ok  classement : couverture décroissante (avant arrondi), puis unités requises, puis nom
  ok  menu : toutes les mentions, regroupées par référentiel et version ; homonymes distincts
  ok  catalogue : chaque code cité existe dans le référentiel de sa version ; sources et pages présentes

9. Module Exigences : fiche opération et encart de compatibilité (requirements.js)
  ok  source non connectée, clé absente puis clé incorrecte : états explicites, aucune donnée
  ok  clé correcte : chargement ; aucune clé dans le stockage ni dans l’URL mémorisée
  ok  fiche : rapprochement par code opération uniquement, zéros significatifs conservés
  ok  fiche : doublons retirés, évaluations et référentiels séparés, sélection ≠ validation
  ok  fiche : indépendante des filtres temporaires de l’onglet Exigences
  ok  encart : Top 20 par opérations distinctes, indépendant de la pagination et des listes visibles
  ok  encart : multicoche MOA (OU) et croisement avec Référentiel (ET) ; recalcul après changement de MOA
  ok  encart : focus local sur une exigence ou recherche sans effet sur le bouquet
  ok  encart : 3e carte manuelle conservée lors d’un recalcul, sans toucher aux filtres ni aux cartes 1-2 ; retour à l’automatique
  ok  encart : mention d’un autre périmètre → incompatibilité affichée et proposition de changer de périmètre
  ok  encart : menu = toutes les mentions, regroupées par référentiel et version (optgroup)
  ok  encart : moins de trois mentions calculables → résultats disponibles + état vide explicite ; légende et mention permanente
  ok  échappement HTML des contenus du Sheet (MOA, intitulés)
  ok  mode anonymisé : fiche retrouvée par pseudonyme, codes d’évaluation masqués
  ok  déconnexion : clé et données privées retirées de la mémoire
  ok  erreur au rechargement : l’ancien jeu de données n’est pas conservé comme s’il était à jour

10. Client du pont sécurisé (newosb-bridge.js)
  ok  URL : une ancienne clé « ?key= » est retirée de l’URL
  ok  sans clé en mémoire : refus immédiat, rien n’est envoyé
  ok  READY d’une origine non Google, d’une autre fenêtre ou avec un mauvais jeton : ignoré
  ok  requête : clé envoyée uniquement à l’origine exacte du pont (jamais « * »), réponse acceptée de cette seule fenêtre
  ok  réponse « accès refusé » du script → AuthError ; déconnexion : clé effacée
  ok  pont refusé par le script (site non autorisé) : erreur explicite, pas de repli
  ok  app.js : plus aucun transport JSON/JSONP de secours pour la source privée
  ok  aucune clé écrite dans localStorage / sessionStorage par le code

7. Cohérence du paquet
  ok  newosb-bridge.js chargé avant app.js ; moteur et catalogue des mentions avant requirements.js
  ok  newosb-rules.js chargé avant app.js et newosb-core.js
  ok  l’Observatoire et le générateur chargent la même version d’app.js
  ok  tous les fichiers référencés existent
  ok  un seul script Apps Script OPERATIONS à la racine (pas de doGet en double)
  ok  plus de copie périmée du script dans app.js
  ok  syntaxe JavaScript valide
  ok  l’avancement n’est plus déduit de « État du dossier » ni du statut commercial

134 tests réussis, 0 en échec.
```

### Tests navigateur
```
A. Site autorisé : connexion par le pont Apps Script
  ok  13 projets chargés : 10 codes internes + 3 propositions sans code, non fusionnées malgré un nom identique (obtenu : 13)
  ok  avancement lu dans « Opération: Évaluation: Statut », colonne BC (obtenu : BC)
  ok  message de connexion : « colonne BC » affiché — 13 projets chargés. L’Observatoire Prestaterre et le générateur utilisent cette source. Avancement : « Opération: Évaluation: Statut » (colonne BC), puis « État du dossier » (colonne BW) quand BC est vide (2 lignes).
  ok  « Dossier complet », « Visite réalisée », « Évaluation conforme » reconnus
  ok  avancement vide → Non renseigné (plus « Non démarrée » par défaut)
  ok  ligne sans code interne dont BC est vide : avancement lu dans « État du dossier » (comme en V6.12)
  ok  ligne sans code interne ET sans avancement → « Proposition commerciale en cours »
  ok  message de connexion : repli sur « État du dossier » annoncé —  et le générateur utilisent cette source. Avancement : « Opération: Évaluation: Statut » (colonne BC), puis « État du dossier » (colonne BW) quand BC est vide (2 lignes).
  ok  liste Mentions défilante (16 valeurs)
  ok  recherche « RT2012 » : 2 mentions visibles sur 16 (attendu 2)
  ok  recherche à plusieurs mots (ordre libre, casse ignorée) : « rt2012 -20 » → 1 mention
  ok  recherche sans accent : « biosource » → 3 mentions « Biosourcé »
  ok  aucun résultat : message affiché
  ok  recherche effacée : toutes les mentions reviennent
  ok  recherche dans la liste Performances : « ubat » → 2 valeurs
  ok  cocher une mention garde la position dans la liste (150 → 150)
  ok  cocher une deuxième mention à la souris : position conservée (150)
  ok  deux mentions cochées et comptées
  ok  cocher pendant une recherche : filtre « cep » conservé (4 valeurs visibles)
  ok  le focus reste sur la case cochée
  ok  « Tout afficher » décoche les mentions
  ok  Réinitialiser efface aussi les recherches
  ok  filtre Référentiel : recherche « renovation » → 1 valeur visible
  ok  Qualité : contrôle ligne à ligne (14 lignes dont 3 sans code : 2 lues en État du dossier, 1 sans avancement → 13 projets)
  ok  Qualité : projet à statuts différents signalé (OP-2)
  ok  Qualité : tableau lignes BC / État du dossier → projets → tunnel
  ok  bouton « Copier le diagnostic de l’avancement » présent
  ok  diagnostic copiable : colonnes, lignes lues par source, propositions
  ok  projet à plusieurs lignes : avancement global = étape la moins avancée (obtenu : notStarted)
  ok  opération détaillée : statut exact de chaque ligne (obtenu : incomplete,notStarted)
  ok  année de certification lue dans « Date de décision de certification » (15/03/24 → 2024)
  ok  pas de décision de certification → pas d’année de certification (plus de repli sur la date CD)
  ok  année de création lue dans « Date de création » (formats variés)
  ok  filtres « Année certification » et « Année de création » présents
  ok  options : certification 2024,2025 · création 2022,2023,2024,2026
  ok  filtre « Année de création = 2022 » : 1 projet actif (affaire perdue exclue)
  ok  tunnel : 1 proposition, 1 visite, 1 dossier complet, 2 conformes (dont 1 ligne historique), 2 annulés/perdus ({"counts":{"proposal":1,"notStarted":2,"incomplete":0,"complete":1,"planned":1,"analysis":2,"visit":1,"compliant":2},"cancelled":2,"sold":1,"unknown":1})
  ok  tunnel affiché avec les 8 étapes dans l’ordre
  ok  « Inclure annulés / abandonnés » : cartes 1/2/0/1/1/2/1/2 → 1/3/0/1/1/2/2/2 (chiffres bruts de la colonne BC)
  ok  note explicative affichée quand l’option est cochée
  ok  option décochée : retour aux chiffres du tunnel actif
  ok  note : nombre d’affaires annulées hors tunnel indiqué
  ok  carte « Tunnel interactif » renommée « Avancement »
  ok  largeur 1440px : les 8 étapes tiennent sur une seule ligne
  ok  largeur 1100px : les 8 étapes tiennent sur une seule ligne
  ok  largeur 900px : les 8 étapes tiennent sur une seule ligne
  ok  chronologie de l’avancement par année de création
  ok  Qualité : colonne d’avancement affichée avec sa lettre (BC)
  ok  Qualité : valeurs illisibles listées (Bbio « 12,3 / 15 », R en W/m².K)
  ok  Qualité : colonnes d’années affichées et date illisible signalée
  ok  Énergie : Cep moyen sur 3 valeurs signalé « échantillon faible »
  ok  mode anonymisé : tous les MOA pseudonymisés
  ok  aucune erreur JavaScript en parcourant toutes les pages
  ok  générateur : chargé sans erreur avec les règles partagées
  ok  slide tunnel : 8 bulles sur une seule ligne (8)

B. Site non autorisé : le pont refuse de transmettre les données
  ok  aucune donnée chargée
  ok  message explicite : configurer NEWOSB_ALLOWED_ORIGINS

E. Colonne d’avancement dont le nom est dupliqué dans la Sheet
  ok  deux colonnes « Opération: Évaluation: Statut » : BC reste lue (Non démarrée, Dossier complet, Visite réalisée)
  ok  Qualité : le doublon de nom est signalé

D. Performance : 6 000 lignes chargées en moins de 40 s
  ok  6 000 lignes : 4719 projets en 4 s

C. Clé d’accès : obligatoire, jamais dans l’URL ni dans le stockage
  ok  sans clé : aucune donnée chargée
  ok  sans clé : message demandant la clé
  ok  clé incorrecte : refus explicite, aucune donnée
  ok  clé correcte : connexion
  ok  clé absente de localStorage et sessionStorage
  ok  clé jamais présente dans une URL (5 requêtes vers Apps Script)
  ok  après rechargement : clé oubliée, pas de reconnexion silencieuse
  ok  GET direct avec ?key= : refusé (lecture uniquement par le pont)

F. Exigences : fiche opération, encart de compatibilité, défilement, focus, largeurs d’écran
  ok  fiche : « Source Exigences non connectée » tant que la source n’est pas chargée
  ok  fiche déjà ouverte : mise à jour à l’arrivée des exigences (2 évaluations séparées pour OP-1)
  ok  fiche : défilement conservé lors de la mise à jour (400 → 400)
  ok  fiche : codes et intitulés affichés ; sélection ≠ validation
  ok  encart présent en bas de page, pleine largeur (1012 / 1052 px)
  ok  périmètre par défaut : le plus documenté (BEE LN 04/05/2026), effectif affiché
  ok  légende et mention permanente affichées
  ok  focus conservé sur le menu de condition après recalcul
  ok  trois cartes (Biodiversité 90 % | BEE+ 89 % | Habitat Qualité 75 %)
  ok  choix d’une mention : pas de retour en haut (5571 → 5571)
  ok  focus conservé sur le menu de la 3e carte
  ok  mention d’un autre référentiel : incompatibilité de contexte affichée
  ok  bouquet recalculé après filtre MOA (44 → 3 opérations documentées)
  ok  largeur 1440px : cartes côte à côte sans défilement horizontal
  ok  largeur 900px : cartes empilées sans défilement horizontal
  ok  largeur 390px : cartes empilées sans défilement horizontal
  ok  mode anonymisé : aucun nom de MOA dans l’onglet Exigences
  ok  aucune erreur JavaScript (Exigences, fiche, encart)

G. Présentation : exports PPTX, PNG et Google Slides
  ok  PPTX : fichier produit avec le visuel de la slide (4 images, auparavant « Visuel indisponible »)
  ok  PNG 4K : image produite (253 Ko)
  ok  Google Slides : la fenêtre Google s’ouvre pendant le clic (non bloquée)
  ok  Google Slides : présentation créée avec 2 slides rendues en image
  ok  Google Slides : la présentation s’ouvre dans la fenêtre du pont (https://docs.google.com/presentation/d/PRES1/edit)
  ok  aucune erreur JavaScript pendant les exports

92 vérifications navigateur réussies, 0 en échec.
```
