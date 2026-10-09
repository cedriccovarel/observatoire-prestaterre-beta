# Guide de mise à jour — Observatoire Prestaterre V6.14

Durée : environ 30 minutes. Les **deux** scripts Apps Script changent (OPERATIONS et Exigences) : ils doivent être mis à jour **avant** ou **en même temps** que le site, sinon l’Observatoire ne pourra plus charger les données (c’est voulu : l’ancien fonctionnement exposait les données).

> Rien dans ce guide n’a été effectué sur votre compte Google : les étapes ci-dessous sont à réaliser par une personne disposant des droits sur les classeurs et les projets Apps Script. Les contrôles automatiques de ce paquet ont été faits avec une simulation d’Apps Script, pas sur un déploiement réel.

## Ce qui change

| Domaine | Avant (V6.13) | Maintenant (V6.14) |
|---|---|---|
| Clé d’accès | facultative, collée dans l’URL (`?key=…`) et donc mémorisée dans le navigateur | **obligatoire** (16 caractères minimum), saisie dans un champ, gardée **en mémoire uniquement** pendant la session ; jamais dans l’URL, localStorage, sessionStorage ni GitHub |
| Lecture directe `…/exec?mode=data` | OPERATIONS : protégée par clé optionnelle ; **Exigences : RAPPORT entier lisible sans contrôle** | plus aucune donnée par GET, JSON ou JSONP, même avec une clé ; seul un `?mode=ping` minimal répond (sans volume ni en-tête) |
| Pont popup / iframe | contrôle d’origine (OPERATIONS seulement) ; refus envoyés vers « * » | les deux scripts : origine autorisée + fenêtre unique + jeton de session ; la clé est vérifiée **côté serveur à chaque requête** ; aucun envoi vers « * » |
| Clé incorrecte | — | refus explicite ; les données privées en mémoire sont retirées ; 30 essais invalides bloquent 10 minutes |
| Exigences | — | rappel des exigences dans la fiche opération ; encart « Compatibilité des exigences sélectionnées avec les mentions » |
| Présentation | export PPTX sans visuel, PNG sans fichier, Google Slides en erreur ou bloqué | exports PPTX, PNG/SVG et Google Slides rétablis |

Une clé partagée protège l’accès à la source ; elle ne donne **pas** de droits individuels par MOA. Le mot de passe d’accueil et le mode anonymisé ne sont **pas** des protections serveur.

---

## Étape 1 — Protéger les Google Sheets (5 min, une seule fois)

Pour **chacun** des deux classeurs (OPERATIONS et celui qui contient l’onglet RAPPORT) :

1. **Partager** → Accès général : **Restreint**. Ne garder que les personnes qui doivent réellement ouvrir le classeur.
2. **Fichier → Partager → Publier sur le Web** : si une publication existe, cliquer **Arrêter la publication**. (Une publication rend les données lisibles sans connexion, quel que soit le script.)
3. Vérifier qu’aucun lien « Toute personne disposant du lien » n’est actif.

> Un Sheet restreint ne suffit pas si un ancien déploiement Apps Script public retransmet ses données : voir l’étape 4.

## Étape 2 — Script OPERATIONS (10 min)

1. Ouvrir la Google Sheet OPERATIONS → **Extensions → Apps Script**.
2. Remplacer tout le contenu du fichier qui contient `function doGet` par **`Code_Operations.gs`** de ce paquet (un seul fichier doit contenir `doGet`). Enregistrer.
3. **⚙ Paramètres du projet → Propriétés du script** :
   - `NEWOSB_ALLOWED_ORIGINS` = adresse du site, sans chemin ni `/` final (ex. `https://prestaterre.github.io`). Déjà présente si vous aviez installé la V6.13.
   - `NEWOSB_ACCESS_KEY` = une clé longue et aléatoire (au moins 16 caractères ; 30 à 40 recommandés). Pour en créer une : choisir la fonction **`genererCleAccesObservatoire`** et cliquer **Exécuter** (elle ne crée une clé que s’il n’en existe pas) ; la valeur apparaît ensuite dans les propriétés du script. La clé n’est jamais écrite dans le journal.
4. Exécuter **`configurerSecuriteObservatoire`** → Journal : « Sites autorisés : … » et « Clé d’accès : configurée (NN caractères) ».
5. Si la clé existait déjà et figurait dans une URL partagée, **changez-la** (nouvelle valeur dans la propriété) : l’ancienne est immédiatement refusée.

## Étape 3 — Script Exigences (10 min)

C’est un **projet Apps Script distinct** (celui du classeur RAPPORT) : ses propriétés ne sont pas partagées avec OPERATIONS.

1. Ouvrir le classeur RAPPORT → **Extensions → Apps Script**, remplacer le contenu par **`Code_Exigences.gs`**. Enregistrer.
2. Propriétés du script :
   - `NEWOSB_ALLOWED_ORIGINS` = la même adresse de site ;
   - `NEWOSB_ACCESS_KEY` = une clé **différente** de celle d’OPERATIONS (fonction `genererCleAccesExigences` possible).
3. Exécuter **`configurerSecuriteExigences`** et vérifier le journal.

## Étape 4 — Redéployer et archiver les anciens déploiements (5 min, pour chaque script)

1. **Déployer → Gérer les déploiements** → crayon sur le déploiement utilisé par l’Observatoire → Version : **Nouvelle version** (description `V6.14`) → **Déployer**. L’URL `/exec` ne change pas.
2. « Exécuter en tant que » : **Moi** (compte ayant accès au classeur). « Qui a accès » : de préférence **Toute personne de votre domaine** ; « Tout le monde » reste possible car la clé est désormais obligatoire.
3. Dans la même liste, **archiver** tout autre déploiement actif (anciennes versions publiques non protégées).

## Étape 5 — Mettre à jour le site (5 min)

1. Remplacer le contenu du dépôt par celui du paquet V6.14 (ou appliquer le patch). Fichiers **nouveaux** à bien inclure : `newosb-bridge.js`, `newosb-mentions.js`, `mentions_catalog.js`, `GUIDE_MISE_A_JOUR_V6_14.md`, `docs/reference/TRACABILITE_MENTIONS_V6_14.md`.
2. Les anciens doublons à la racine (`README_NEWOSB_*`, `QA_*`, `qa_*.js`, `Code.gs`, anciens guides…) sont supprimés : ils sont tous conservés à l’identique dans `docs/`.
3. Commit + push, attendre 1 à 2 minutes, recharger une fois avec Ctrl + F5 (Cmd + Shift + R).

## Étape 6 — Se connecter depuis l’Observatoire

- **OPERATIONS** : bouton **Données** → mode « Google Apps Script privé » → URL `/exec` (sans `?key=`) → **Clé d’accès** → **Connecter / actualiser**. Une petite fenêtre Google s’ouvre (le pont) puis se ferme.
- **Exigences** : onglet **Exigences** → encart « Source Exigences · privée » → URL `/exec` du script Exigences → clé Exigences → **Connecter**.
- La clé est redemandée à chaque ouverture de l’Observatoire (et dans le générateur ouvert dans un autre onglet). Si une ancienne URL contenant `?key=` était mémorisée, la clé en est retirée automatiquement et n’est gardée qu’en mémoire.
- **Déconnecter** efface la clé et les données privées de la session.

## Étape 7 — Vérifier (5 min)

| Test | Comment | Résultat attendu |
|---|---|---|
| Ping public | `…/exec?mode=ping` | `{"ok":true,"service":"…","version":"06.14","protected":true}` et rien d’autre |
| Lecture directe | `…/exec?mode=data` puis `…/exec?mode=meta&key=VOTRE_CLE` | `"ok":false` « Lecture directe désactivée », aucune ligne ni en-tête |
| Fenêtre privée sans droits | Navigation privée, sans compte autorisé : ouvrir l’Observatoire, Données → Connecter | Échec ; aucune opération chargée (selon « Qui a accès », Google peut aussi demander une connexion) |
| Mauvaise clé | Saisir une clé erronée | « Accès refusé » ; aucune donnée |
| Bonne clé | Saisir la clé | Chargement normal ; le message affiche la colonne d’avancement BC comme avant |
| Exigences | Onglet Exigences avec la clé Exigences | Encarts habituels, puis tout en bas l’encart « Compatibilité… » ; une fiche projet affiche « Exigences sélectionnées pour cette opération » |
| Présentation | Onglet Présentation → PPTX, PNG 4K, Google Slides | Fichiers téléchargés avec les visuels ; Google Slides ouvre la présentation créée dans la fenêtre Google |

## Utiliser l’encart « Compatibilité des exigences sélectionnées avec les mentions »

- Il compare les mentions au **bouquet** des 20 exigences les plus sélectionnées (paramètre `BOUQUET_SIZE` de `newosb-mentions.js`) dans le périmètre des filtres de l’onglet Exigences. Une opération compte une fois par exigence (doublons et évaluations multiples ignorés) ; le dénominateur est le nombre d’opérations disposant de lignes RAPPORT dans le périmètre.
- Les référentiels et versions ne sont jamais mélangés : si plusieurs périmètres sont présents, le plus documenté est choisi par défaut et un menu permet d’en changer.
- **Conditions d’application** : régime RT 2012 / RE 2020, type d’ouvrage, date de dépôt du PC, article de taxinomie, « si concerné »… Tant qu’une condition qui change les critères n’est pas renseignée, la mention est affichée « provisoire » et exclue du classement automatique.
- Le pourcentage est une **couverture des critères par les sélections**, pas une probabilité ni une validation : l’obtention d’une mention reste soumise à la validation des exigences, aux prérequis et aux seuils.
- Règles disponibles : **BEE Logement Neuf 04/05/2026** (24 mentions) et **BEE Logement Rénovation 18/06/2025** (7 mentions). Non disponibles : BEE Logement Rénovation **04/05/2026**, BEE Tertiaire Neuf, BEE Tertiaire Exploitation → « Version non couverte ». Détail règle par règle : `docs/reference/TRACABILITE_MENTIONS_V6_14.md`.

## V6.19 — Filtre « Type de programme » sur tout l’Observatoire

Coller le nouveau **`Code_Operations.gs`** (06.19) puis **Nouvelle version** du déploiement. Rien d’autre : le type est calculé par le script (RAPPORT par code d’opération ou n° de contrat, sinon nom de l’opération). Sans mise à jour du script, le filtre affiche « Non disponible (script à mettre à jour) ».

## V6.18 — Filtre « Type de programme » (onglet Exigences)

1. Script OPERATIONS : coller le nouveau **`Code_Operations.gs`** (06.18) puis **Nouvelle version** du déploiement. Si tu utilises encore la source Exigences séparée, faire de même avec **`Code_Exigences.gs`**.
2. RAPPORT doit contenir la colonne **« Évaluation: Opération: Nom du programme (client) »** (déjà ajoutée).
3. Facultatif : ajouter une colonne **« Type de programme »** dans RAPPORT pour corriger une opération (valeur reprenant une des catégories, ex. « Bureaux », « Équipements publics ») : elle l’emporte sur la déduction.

## V6.17 — Une seule connexion pour les opérations et les exigences

1. Script OPERATIONS : remplacer le code par le nouveau **`Code_Operations.gs`** (version 06.17), puis **Déployer → Gérer les déploiements → crayon → Nouvelle version**.
2. Si RAPPORT est dans un autre classeur que OPERATIONS et que ce n’est pas déjà fait : propriété `NEWOSB_RAPPORT_SPREADSHEET_ID` dans le projet OPERATIONS, puis `verifierPartageExigences` (voir la section V6.15).
3. Dans l’Observatoire : bouton **Données** → URL et clé OPERATIONS → Connecter. Les exigences se chargent ensuite toutes seules (onglet Exigences : « Source Exigences · avec OPERATIONS »). La clé et l’URL Exigences ne sont plus nécessaires ; le script Exigences peut rester en place (source séparée facultative).

## V6.15 — Liens de partage à durée limitée

### Mise à jour (10 min)

1. Script OPERATIONS : remplacer le contenu par le nouveau **`Code_Operations.gs`** (version 06.15), enregistrer, puis **Déployer → Gérer les déploiements → crayon → Nouvelle version → Déployer**. L’URL `/exec` ne change pas. Le script Exigences ne change pas.
2. Site : publier les fichiers de la V6.15 (dont le nouveau `newosb-share.js`), puis recharger une fois avec Ctrl + F5.
3. Au premier lien créé, le script ajoute un onglet **masqué** `OBSERVATOIRE_PARTAGES` dans le classeur OPERATIONS. Ne pas le modifier à la main (il ne contient que des empreintes de jetons, jamais les liens eux-mêmes).
4. **Partager l’onglet Exigences** (facultatif) : le script OPERATIONS lit lui-même l’onglet RAPPORT pour les liens. Si RAPPORT est dans un autre classeur que OPERATIONS, ajouter dans les propriétés du projet **OPERATIONS** `NEWOSB_RAPPORT_SPREADSHEET_ID` = identifiant du classeur RAPPORT (la partie entre `/d/` et `/edit` de son adresse ; l’adresse complète est aussi acceptée). Le compte qui exécute le script doit pouvoir ouvrir ce classeur. Exécuter ensuite **`verifierPartageExigences`** : le journal doit indiquer « RAPPORT lisible ». Google peut demander une nouvelle autorisation à la première exécution. Le script Exigences n’a rien à changer (le nouveau `Code_Exigences.gs` ne fait que réorganiser le code ; sa mise à jour est facultative).
5. **Destinataires extérieurs** : le déploiement doit être accessible à « **Tout le monde** » (Déployer → Gérer les déploiements → « Qui a accès »). Avec « Toute personne de votre domaine », seuls les comptes Google de votre organisation peuvent ouvrir un lien. La clé reste obligatoire pour tout le reste : « Tout le monde » ne donne accès à aucune donnée sans clé ou lien valide.

### Créer un lien

1. Connecter l’Observatoire (bouton Données, clé OPERATIONS), appliquer les filtres voulus.
2. **⤴ Partager** : nommer le lien, cocher les onglets accessibles, choisir l’onglet d’ouverture et la durée, cocher « Anonymiser » si besoin, puis **Créer le lien**.
3. **Copier le lien** tout de suite : il n’est affiché qu’une fois. Pour le retrouver plus tard, il faut en créer un nouveau.

Pour l’onglet **Exigences** : appliquer d’abord, dans l’onglet Exigences, les filtres voulus (ils sont figés avec le lien ; pour un lien anonymisé, les filtres MOA et Groupe MOA sont retirés). Le destinataire voit les exigences des opérations du lien, l’encart de compatibilité avec les mentions et, dans chaque fiche projet, les exigences de l’opération — sans clé ni URL Exigences. La **Présentation** n’est pas partageable (exports Google Slides).

### Gérer les liens

La même fenêtre liste les liens : statut, expiration, nombre d’ouvertures, dernier accès. **Prolonger** fixe une nouvelle durée à partir de maintenant ; **Révoquer** coupe l’accès immédiatement (au prochain chargement de la page). Changer la clé `NEWOSB_ACCESS_KEY` ne révoque pas les liens : utiliser **Révoquer**.

### Ce qui est garanti, et ce qui ne l’est pas

| Garanti par le script, à chaque requête | Restriction d’affichage seulement |
|---|---|
| Jeton valide, non révoqué, non expiré | Choix des onglets visibles |
| Seules les opérations du périmètre (et leurs lignes RAPPORT) sont transmises | Filtres verrouillés dans l’interface (y compris ceux de l’onglet Exigences) |
| Données pseudonymisées si le lien est anonymisé | |
| Aucun accès à l’administration des liens, à Google Slides ni à la lecture complète | |

Toute personne qui possède le lien voit le périmètre jusqu’à son expiration : le transmettre comme un document confidentiel. Le nom du lien est affiché tel quel au destinataire (ne pas y mettre de nom de MOA pour un lien anonymisé).

### Vérifier

| Test | Résultat attendu |
|---|---|
| Ouvrir le lien dans une fenêtre de navigation privée | Pas de mot de passe ; panneau « Périmètre figé » ; seuls les onglets choisis |
| Révoquer le lien puis recharger la page du destinataire | « Accès impossible — Ce lien de partage a été révoqué » ; aucune donnée |
| Lien anonymisé | Aucun nom de MOA ni d’opération, aucune adresse |

## Retour arrière

Apps Script : Gérer les déploiements → Modifier → choisir la version précédente (revenir avant la V6.15 rend tous les liens de partage inutilisables). GitHub : Revert du commit V6.14. Attention : revenir à l’ancien `Code_Exigences.gs` ré-expose RAPPORT sans contrôle.
