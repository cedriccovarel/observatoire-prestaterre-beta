# QA — NEWOSB V04

## Source RAPPORT testée

Classeur : `Exigences DRIHL (4).xlsx`
Onglet utilisé : **RAPPORT uniquement**.

Structure détectée :
- en-têtes A:U en ligne 1 ;
- données à partir de la ligne 2 ;
- 483 évaluations exploitables dans le fichier test ;
- 5 236 couples Évaluation × Exigence exploitables après exclusion des lignes sans Intitulé.

## Contrôles réalisés

- chargement et normalisation de la réponse du futur `Code_Exigences.gs` ;
- dédoublonnage des occurrences par Code EVA + Intitulé ;
- calcul des évaluations uniques ;
- filtres Référentiel / période / nature / profil / mention / secteur MOA / thème ;
- filtre par clic sur une exigence ;
- chronologie par année de version du référentiel ;
- Top 15 ;
- vues par thèmes 1 à 4 ;
- évolution annuelle ;
- mentions et Top 5 par mention ;
- marges DRIHL ;
- pondération annexe ;
- drill-down évaluations ;
- syntaxe JavaScript vérifiée avec `node --check` sur `newosb.js` et `requirements.js`.

## Contrôle de cohérence notable

Sur le fichier test, la sélection BEE Logement Neuf avec une version de référentiel 2025 ou 2026 renvoie **90 évaluations**, ce qui permet de vérifier le mécanisme de période utilisé par la partie Marges DRIHL.

## Non-régression

La source OPERATIONS, la cartographie multicouche, les flux de transition, les pages analytiques et le générateur V29.7.13 restent séparés du module Exigences.
