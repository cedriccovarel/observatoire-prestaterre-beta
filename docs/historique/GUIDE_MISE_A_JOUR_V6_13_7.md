# Guide de mise à jour — Observatoire Prestaterre V6.13.7

> **Tu as déjà installé une V6.13.x ?** Les scripts Apps Script n'ont pas changé : fais seulement l'**étape 5** (site GitHub) puis l'**étape 6** (vérifications).

Durée totale : environ 20 minutes. Les étapes 1 à 3 sont obligatoires et doivent être faites dans l'ordre.
L'étape 4 est recommandée. L'étape 5 sert à contrôler le résultat.

> **Important** : la mise à jour comporte une partie **Apps Script** (côté Google) et une partie **site** (côté GitHub).
> Si tu mets à jour le site sans le script, l'Observatoire fonctionne mais sans les protections.
> Si tu mets à jour le script sans renseigner l'adresse du site (étape 2), le pont refuse de transmettre les données : c'est voulu.

---

## Étape 1 — Mettre à jour le script Apps Script OPERATIONS (5 min)

1. Ouvre la Google Sheet OPERATIONS, puis **Extensions → Apps Script**.
2. Dans la liste des fichiers à gauche, repère le ou les fichiers qui contiennent l'Observatoire (souvent `Code.gs`, parfois aussi `Code_Operations.gs`).
   - **Il ne doit en rester qu'un seul** qui contient `function doGet`. Si tu en as deux, supprime l'un des deux (menu ⋮ → Supprimer).
3. Ouvre le fichier restant, sélectionne tout son contenu (Ctrl/Cmd + A) et remplace-le par le contenu de **`Code_Operations.gs`** du paquet V6.13.
   - Le fichier `Code.gs` n'est plus livré : il faisait doublon avec `Code_Operations.gs`. Son ancienne version est archivée dans `docs/archives/`.
4. Enregistre (icône disquette).

## Étape 2 — Autoriser l'adresse de ton site (2 min)

C'est la protection principale : le script ne transmet plus les données qu'au site que tu déclares.

1. Dans Apps Script, clique sur l'icône **⚙ Paramètres du projet** (barre de gauche).
2. Descends jusqu'à **Propriétés du script** → **Ajouter une propriété du script**.
3. Renseigne :
   - Propriété : `NEWOSB_ALLOWED_ORIGINS`
   - Valeur : l'adresse de ton site **sans chemin ni barre finale**. Exemples :
     - site `https://prestaterre.github.io/observatoire/` → valeur `https://prestaterre.github.io`
     - domaine personnalisé `https://observatoire.prestaterre.fr` → valeur `https://observatoire.prestaterre.fr`
   - Plusieurs adresses possibles, séparées par des virgules (ex. le site + un site de test).
4. **Enregistrer les propriétés du script**.
5. Retourne dans l'éditeur, choisis la fonction **`configurerSecuriteObservatoire`** dans la liste en haut, clique **Exécuter**, puis ouvre le **Journal d'exécution** : il doit afficher ton adresse sur la ligne « Sites autorisés ».

## Étape 3 — Redéployer le script (2 min)

1. **Déployer → Gérer les déploiements**.
2. Sur le déploiement existant, clique sur le **crayon (Modifier)**.
3. Version : **Nouvelle version**. Description : `V6.13`.
4. Vérifie « Qui a accès » (voir étape 4), puis **Déployer**.
5. L'URL `/exec` ne change pas : rien à modifier dans l'Observatoire.

> Si tu crées un **nouveau** déploiement au lieu de modifier l'existant, l'URL `/exec` change : il faudra la recoller dans l'Observatoire (bouton **Données**).

## Étape 4 — Choisir le niveau d'accès (recommandé, 3 min)

Deux cas, selon le réglage **« Qui a accès »** du déploiement :

**Cas A — « Toute personne de [ton domaine Google] » (recommandé)**
Seules les personnes connectées à un compte Prestaterre peuvent lire les données. Combiné à l'étape 2, aucun site tiers ne peut les récupérer. Rien d'autre à faire.

**Cas B — « Tout le monde »**
Dans ce cas, n'importe qui connaissant l'URL `/exec` peut lire les données en JSON : la protection de l'étape 2 ne suffit pas. Ajoute une clé d'accès :

1. Propriétés du script → ajoute `NEWOSB_ACCESS_KEY` avec une valeur longue et aléatoire (ex. 30 caractères, sans espace ni `&`).
2. Redéploie (étape 3).
3. Dans l'Observatoire, bouton **Données** : l'URL de la source devient
   `https://script.google.com/macros/s/…/exec?key=TA_CLE`
   puis **Connecter / actualiser**.
4. Fais de même pour le script **Exigences** si tu lui mets une clé (même propriété `NEWOSB_ACCESS_KEY` dans son propre projet Apps Script, contenu de `Code_Exigences.gs` à jour, redéploiement, et `?key=…` ajouté à son URL).

La clé n'est jamais écrite dans le code du site : elle reste dans l'URL mémorisée par chaque navigateur. Ne la colle pas dans un document partagé.

**Option — publier un jour un observatoire public**
Crée une **copie** du projet Apps Script (déploiement séparé) et ajoute la propriété `NEWOSB_ANONYMIZED_ONLY` = `1`. Ce déploiement ne renvoie plus que des données pseudonymisées côté serveur : MOA, groupes, noms et codes d'opération remplacés par des pseudonymes ; adresses, codes postaux, INSEE, coordonnées, contacts, numéros de contrat et montants supprimés. La ville, le département, la région, le secteur d'activité du MOA et toutes les données techniques sont conservés.

## Étape 5 — Mettre à jour le site sur GitHub (5 min)

1. Dans le dossier local du dépôt (GitHub Desktop → *Show in Finder/Explorer*) :
   - **Supprime** à la racine tous les anciens fichiers `README_NEWOSB_*.md`, `QA_NEWOSB_*.md`, `QA_HASHES_*.txt`, `qa_*.js`, `qa_v053.html`, `README_V29_7_13_ORIGINAL.md`, `README_CODE_EXIGENCES_*.md`, `PROMPT_EXTRACTION_*.md`, `COLONNES_OPERATIONS_*`, `OPERATIONS_EXEMPLE.txt`, `CHANGELOG_V05_17.txt` et **`Code.gs`**. Ils sont désormais rangés dans `docs/`.
   - Ne touche pas à `.git`, `CNAME` ni aux workflows personnels.
2. Copie **le contenu** du dossier `Observatoire_Prestaterre_V6_13` à la racine du dépôt (remplacer les fichiers existants).
3. GitHub Desktop : vérifie que `newosb-rules.js` apparaît bien comme **nouveau fichier** (sans lui, le site ne démarre pas), puis **Commit** (`V6.13`) et **Push origin**.
4. Attends 1 à 2 minutes, ouvre l'Observatoire et recharge **une fois** en forçant le cache : Cmd + Shift + R (Mac) ou Ctrl + F5 (Windows).

## Étape 6 — Vérifier (3 min)

1. Le bandeau affiche **V6.13**.
2. Bouton **Données → Connecter / actualiser** : le message doit indiquer le nombre de projets chargés **et** « Avancement : « Opération: Évaluation: Statut » (colonne BC) ». La lettre doit correspondre à la colonne de la Google Sheet : si elle est différente, une colonne a été insérée ou déplacée.
   - S'il affiche « ⚠ colonne « Date de décision de certification » introuvable » (ou « Date de création ») : l'intitulé de la colonne dans la Sheet est différent ; il doit être exactement celui-ci (majuscules et accents indifférents).
   - Si le message contient « NEWOSB_ALLOWED_ORIGINS » : l'adresse déclarée à l'étape 2 ne correspond pas exactement à celle du site (vérifie https, sous-domaine, absence de / final), ou le script n'a pas été redéployé.
   - Si le message contient « Clé d'accès absente ou invalide » : ajoute `?key=…` à l'URL (étape 4, cas B).
3. Page **Certification** : la carte **Avancement** affiche les 8 étapes sur une seule ligne, de « Proposition commerciale en cours » à « Évaluation conforme ». Les chiffres doivent être proches de ceux de l'ancienne V6.12 (« Évaluation conforme » environ 1 900 sur l'export du 30/09/26).
4. Filtres en haut : **Année certification** ne propose que les années présentes dans « Date de décision de certification » ; **Année de création** celles de « Date de création ». Un projet sans décision de certification n'apparaît plus quand une année de certification est cochée : c'est normal.
5. Page **Qualité & données**, en bas :
   - encart **Avancement** : colonne utilisée et sa lettre (BC), valeurs hors liste éventuelles, colonnes de dates utilisées ;
   - encart **Valeurs non interprétées** : cellules numériques à corriger dans la Sheet.
   Corrige ces cellules dans la Google Sheet puis **Actualiser** : elles disparaissent de la liste.

---

## Vérifier que l'avancement correspond à la colonne BC

1. Observatoire → **Qualité & données** → encart **Avancement**, partie « Contrôle ligne à ligne de l'avancement ».
2. Dans la Google Sheet, active un filtre sur la colonne BC et note, pour chaque valeur, le nombre de lignes.
3. La colonne « Lignes en BC » doit être identique au filtre de la colonne BC dans la Sheet, et « Lignes en AV (État du dossier) » au filtre de la colonne AV pour les lignes dont BC est vide. Une valeur « non reconnue » (listée sous le tableau) signifie que son libellé n'est pas l'un des 8 admis : corrige-la dans la Sheet, ou envoie-moi le libellé exact pour qu'il soit accepté.
4. Les chiffres du tunnel sont des **projets** et non des lignes (colonnes « Projets » → « dont annulés / abandonnés » → « Dans le tunnel ») ; un projet à plusieurs lignes prend l'étape la moins avancée de ses lignes : l'encart détaille le passage de l'un à l'autre (lignes sans code ignorées, plusieurs lignes d'un même code interne regroupées en un projet, projets perdus / abandonnés / annulés retirés du tunnel). Les filtres actifs en haut de page réduisent encore les chiffres affichés.

**Retrouver les chiffres bruts de la colonne BC** : page Certification, carte Avancement, coche **« Inclure annulés / abandonnés »**. Les cartes affichent alors le nombre de lignes de ta Sheet par étape (annulés et abandonnés compris). Décochée, le tunnel ne compte que les projets actifs, et une note indique combien d'affaires annulées / abandonnées en sont exclues.

**Si l'avancement te paraît encore faux** : dans l'encart Avancement de la page Qualité, clique sur **Copier le diagnostic de l'avancement** et colle le texte dans la conversation. Il contient la version, les colonnes lues, le nombre de lignes lues par colonne, les valeurs non reconnues et le tunnel, sans aucune donnée client.

## Vérifier que l'accès est bien restreint au domaine Prestaterre

À faire une fois après l'étape 3, avec l'URL `/exec` du script (bouton **Données** de l'Observatoire, champ « URL de la source »). Ajoute `?mode=ping` à la fin (ou `&mode=ping` si l'URL contient déjà `?key=`).

| Test | Comment | Résultat attendu si l'accès est restreint |
|---|---|---|
| 1. Compte Prestaterre | Ouvre `…/exec?mode=ping` dans ton navigateur habituel, connecté à ton compte Prestaterre | Une ligne de texte commençant par `{"ok":true,"service":"NEWOSB OPERATIONS","version":"06.13"` |
| 2. Personne non connectée | Même URL dans une **fenêtre de navigation privée** (Chrome : Cmd/Ctrl + Shift + N) | Une page de **connexion Google** s'affiche, pas le texte `{"ok":true…` |
| 3. Compte extérieur | Dans la fenêtre privée, connecte-toi avec un compte Gmail personnel, puis rouvre l'URL | Message Google du type « Vous n'avez pas l'autorisation d'accéder à ce fichier » / « Impossible d'ouvrir le fichier » |
| 4. Observatoire, compte extérieur | Toujours dans la fenêtre privée, ouvre l'Observatoire, puis **Données → Connecter / actualiser** | Échec de connexion ; aucune opération chargée |
| 5. Observatoire, compte Prestaterre | Fenêtre normale, **Données → Connecter / actualiser** | Connexion réussie (une petite fenêtre Google peut s'ouvrir brièvement : c'est le pont, c'est normal) |

Si le test 2 ou 3 affiche le texte `{"ok":true…`, le déploiement est encore ouvert à « Tout le monde » : refais l'étape 3 en vérifiant « Qui a accès », **et** que tu as bien modifié le déploiement dont l'URL est utilisée par l'Observatoire (Déployer → Gérer les déploiements : un seul déploiement actif est recommandé ; archive les anciens).

Points à ne pas changer : « Exécuter en tant que : **Moi** ». Si tu choisis « Utilisateur accédant à l'application », chaque collègue devra en plus avoir accès à la Google Sheet elle-même.

La protection « site autorisé » (étape 2) est vérifiée par les tests automatiques ; tu peux la contrôler toi-même en exécutant `configurerSecuriteObservatoire` (journal d'exécution).

## Ce qui change pour les utilisateurs

**Avancement**
- Lu uniquement dans la colonne `Opération: Évaluation: Statut`.
- Valeurs admises (liste fermée) : Proposition commerciale en cours · Non démarrée · Dossier incomplet · Dossier complet · Analyse planifiée · Analyse réalisée · Visite réalisée · Évaluation conforme. Majuscules, accents, espaces, ponctuation, pluriels, numérotation et fautes de frappe légères sont tolérés.
- **Colonne lue** : « Opération: Évaluation: Statut » (colonne BC) en priorité. **Si BC est vide pour une ligne, la colonne « État du dossier » (colonne AV) est utilisée** : sur l'export du 30/09/26, les 903 lignes historiques sans code interne n'ont aucune valeur en BC et leur avancement est dans AV (aucune ligne n'a les deux colonnes renseignées). Une valeur BC renseignée mais non reconnue n'est pas remplacée par AV : elle est signalée en Qualité.
- **« Proposition commerciale en cours »** : ligne sans code interne ET sans avancement ni en BC ni en AV (88 lignes sur l'export, toutes annulées ou abandonnées donc hors tunnel). Une ligne sans code mais avec un avancement en AV garde cet avancement.
- Si moins de 80 % des valeurs non vides de BC sont reconnues, une alerte s'affiche à la connexion. Les lignes avec code interne mais sans avancement exploitable sont « Non renseigné » : une note sous le tunnel les compte et le filtre Avancement permet de les lister.
- Une cellule vide n'est plus comptée « Non démarrée » : elle est « Non renseigné ».
- Le statut commercial (colonne `Statut` : gagnée, perdue, soldée…) n'est plus jamais utilisé comme avancement. Il sert toujours à exclure les affaires perdues, abandonnées ou annulées.

**Années (V6.13.1)**
- **Année certification** = année de la colonne « Date de décision de certification », sans repli sur une autre date. Un projet sans décision n'a pas d'année de certification.
- **Année de création** (nouveau filtre) = année de la colonne « Date de création ».
- Formats acceptés : 15/03/2024, 15/03/24, 2024-03-15, 15 mars 2024, date Google Sheets. Une date illisible est listée en Qualité.
- La courbe « Évolution des projets » suit l'année de certification ; la chronologie « Statut par année de création » suit l'année de création.

**Lecture des nombres**
- Une cellule `n.c.`, `-`, `NC`, `sans objet` est vide : elle n'est plus comptée 0 dans les moyennes.
- Une cellule ambiguë (`12,3 / 15`, `45-50`, `< 50`) n'est plus transformée en chiffre : elle est exclue des moyennes et listée en Qualité.
- Épaisseurs et R : `/` ou `;` → valeur la plus élevée (règle V6.12 inchangée) ; `+` → couches additionnées (`120 + 100 mm` = 220 mm) ; `x` → nombre de couches × épaisseur (`2x100 mm` = 200 mm) ; épaisseur sans unité = mm, `cm` ×10, `m` ×1000.
- R : le « 2 » de `m2.K/W` n'est plus lu comme une valeur ; une valeur en `W/m².K` (coefficient U) est refusée ; une valeur hors 0,05–20 m².K/W ou une épaisseur hors 5–1000 mm est écartée et signalée.
- Les moyennes calculées sur moins de 5 valeurs portent la mention « ⚠ échantillon faible (n = …) ».

**Listes à cocher (V6.13.7)**
- Page **Labels & performances**, tableau « Mentions × performances » : la recherche dans les listes Mentions et Performances masque maintenant les lignes qui ne correspondent pas (plusieurs mots possibles, accents et casse ignorés), et la liste ne revient plus en haut quand tu coches une case.
- Les filtres déroulants du haut de page gardent aussi leur position quand tu coches une valeur.

**Anonymisation (bouton Anonymiser)**
- Les pseudonymes `MOA 123456` sont désormais calculés avec une clé secrète propre au navigateur : on ne peut plus retrouver un MOA en testant une liste de noms. Deux noms différents ne peuvent plus recevoir le même numéro.
- Les montants (montant HT affaire, commande…) sont masqués dans les données source et les exports anonymisés.
- Conséquence : deux postes différents affichent des pseudonymes différents pour un même MOA. Pour obtenir les mêmes pseudonymes dans toute l'équipe, chacun saisit une fois la même phrase secrète dans la console du navigateur (F12 → Console) :
  `NEWOSB_PRIVACY.setSecret('phrase-secrete-equipe')`

**Ce qui ne change pas**
- Aucune colonne à ajouter ou renommer dans la Google Sheet.
- Mot de passe d'accès, sauvegardes JSON, stockage local, module Exigences, fiches projets, exports : inchangés.

---

## Tests automatiques

Depuis la racine du paquet :

```
node tests/run_all.js
```

68 tests : lecture des nombres, dates et années, épaisseurs et R, avancement (liste fermée de 8 étapes, seuil 80 %, variantes d’écriture, lignes sans code, statut commercial refusé), moteur Observatoire, anonymisation, script Apps Script (clé, pont, mode anonymisé) et cohérence du paquet. Aucun test ne dépend du numéro de version : la suite reste valable aux versions suivantes et constitue la non-régression.

Test navigateur complet (optionnel, nécessite `npm install playwright` puis `npx playwright install chromium`) :

```
node tests/e2e_browser.js
```

62 vérifications dans un vrai Chromium (feuille de test avec l'avancement en colonne BC), avec le vrai `Code_Operations.gs` simulé : connexion par le pont, avancement lu en colonne BC, années et filtres, recherche et défilement des listes à cocher, carte Avancement sur une seule ligne à 3 largeurs d'écran, page Qualité, petits échantillons, anonymisation, absence d'erreur JavaScript sur toutes les pages, slide tunnel du générateur, refus du pont pour un site non autorisé, clé d'accès.

## Retour arrière

En cas de problème : redéploie dans Apps Script la version précédente (Gérer les déploiements → Modifier → choisir l'ancienne version), et dans GitHub Desktop fais **Revert** du commit V6.13 puis Push. Le mode d'accès par mot de passe et les données ne sont pas modifiés par la mise à jour.

## Limites connues (non traitées dans cette version)

- Le mot de passe de l'écran d'accueil reste une simple barrière visuelle (vérifiée dans le navigateur). La vraie protection des données est désormais le script Apps Script (étapes 2 et 4). Pour protéger aussi le code et le catalogue d'exigences, il faut un dépôt GitHub privé ou un hébergement derrière une authentification (ex. Cloudflare Access).
- Le mode « Google Sheet public (CSV) » rend les données lisibles par toute personne ayant l'URL de la Sheet : ne l'utiliser qu'avec une feuille déjà anonymisée.
- `app.js` reste volumineux (1,7 Mo, dont 1,2 Mo d'images intégrées). Le découpage en modules est prévu dans une version ultérieure, pour ne pas mélanger refonte et correctifs.
