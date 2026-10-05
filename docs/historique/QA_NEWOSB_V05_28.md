# QA NEWOSB V05.28

Contrôles réellement effectués :

- `node --check app.js` : OK
- `node --check newosb.js` : OK
- `node --check requirements.js` : OK
- `node --check auth.js` : OK
- `node --check privacy.js` : OK
- parsing HTML de `index.html` avec le parseur standard Python : OK
- test unitaire `Affaire: Étape` : `Abandonné`, `abandonnée`, `PERDU`, `Affaire perdue`, `Projet abandonné`, `Annulé`, `ANNULÉE` sont exclus ; `En cours` et `Analyse réalisée` restent actifs : OK
- test unitaire de normalisation : `BBCA<br>Standard V4.1`, `BBCA Standard V4.1` et `BBCA&lt;br&gt;Standard V4.1` produisent la même clé `bbca standard v4.1` : OK
- vérification statique : les statistiques NEWOSB utilisent `baseOperations()`, qui retire les opérations marquées `analysisExcluded` avant les calculs et agrégations, notamment MOA.
- vérification statique : le filtre MOA contient une recherche instantanée `data-global-filter-search="moa"` qui masque uniquement les choix affichés et ne modifie pas les cases déjà cochées.
- vérification statique : la vue `Exigences > Volume global` propose Liste / Tuiles, limite la vue à 15 tuiles lisibles, dimensionne les tuiles selon le volume, colore selon Cible 1–4 et affiche une légende Cible 1–4.
- vérification statique des tableaux NEWOSB et Exigences : les tableaux dynamiques visibles utilisent la pagination 15 lignes ; la matrice Mentions × performances est volontairement limitée à 6 × 6.
- vérification statique du scroll : les interactions globales utilisent `captureUiScroll()` / `restoreUiScroll()` / `preserveUiScroll()` ; le module Exigences transmet lui aussi le snapshot de scroll avant rerender.
- vérification de `Code_Operations.gs` par comparaison binaire avant/après : inchangé.

Tentative de test navigateur : Chromium headless a été lancé sur un serveur HTTP local, mais n'a pas rendu de DOM avant le timeout dans cet environnement (messages DBus / processus Chromium bloqué). Ce test navigateur n'est donc **pas** compté comme réussi. Les contrôles de syntaxe, parsing, tests unitaires ciblés et contrôles statiques ci-dessus sont ceux effectivement validés.
