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

## V6.15 — Ajouter les colonnes thermique / carbone rénovation (5 min, une seule fois)

Aucun changement d’Apps Script. Dans l’onglet de la Sheet OPERATIONS, **après la colonne « Tags »**, coller sur la ligne d’en-tête les 26 intitulés de `docs/reference/COLONNES_OPERATIONS_V6_15.tsv` (colonnes 107 à 132, à partir de « Surface de plancher (m² SDP) »), dans cet ordre et sans les renommer. Les colonnes existantes ne bougent pas. Le bouton **Colonnes Excel** de la fenêtre Données copie aussi la liste complète. Utiliser ensuite le prompt `docs/reference/PROMPT_EXTRACTION_OPERATIONS_V6_15.md` pour les nouvelles extractions.

## Retour arrière

Apps Script : Gérer les déploiements → Modifier → choisir la version précédente. GitHub : Revert du commit V6.14. Attention : revenir à l’ancien `Code_Exigences.gs` ré-expose RAPPORT sans contrôle.
