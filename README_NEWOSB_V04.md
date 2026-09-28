# NEWOSB V04 — module Exigences

## Principe

NEWOSB V04 ajoute un onglet **Exigences** indépendant de la source OPERATIONS.

La source Exigences est un second Google Sheet / Apps Script. Le traitement part **exclusivement de l’onglet `RAPPORT`** du classeur type transmis :

- ligne 1 : en-têtes ;
- ligne 2 et suivantes : données ;
- les onglets de TCD, comparatifs et rapports pré-calculés ne sont pas utilisés par NEWOSB.

Le fichier `Code_Exigences.gs` est à installer dans le projet Apps Script du Google Sheet Exigences. Ne pas le fusionner avec le `Code.gs` de la source OPERATIONS : il s’agit d’un second endpoint.

## Connexion

1. Ouvrir le Google Sheet Exigences.
2. Vérifier que l’onglet source s’appelle exactement `RAPPORT`.
3. Ouvrir **Extensions > Apps Script**.
4. Remplacer le contenu du script par `Code_Exigences.gs`.
5. Déployer comme **Application Web**.
6. Copier l’URL terminant par `/exec`.
7. Dans NEWOSB > **Exigences**, coller cette URL dans le champ **Source Exigences** puis cliquer sur **Connecter**.

L’URL est mémorisée localement dans le navigateur et la source est rechargée automatiquement lors des visites suivantes.

## Colonnes lues dans RAPPORT

Le script utilise les en-têtes et non les positions fixes. Il exploite notamment :

- Code EVA interne ;
- code opération ;
- région / département ;
- référentiel et version ;
- Version du ref (date) ;
- mentions ;
- profil spécifique ;
- performance ;
- statut ;
- maître d’ouvrage / secteur / groupe ;
- Exigence de référence ;
- INTITULE SANS REF ;
- Thème ;
- Intitulé.

Les colonnes obligatoires sont `Code EVA interne`, `Évaluation: Opération: Référentiel: Nom du référentiel` et `Intitulé`.

## Retraitements disponibles

Le dashboard reconstruit directement depuis RAPPORT :

- nombre de dossiers analysés (évaluations uniques) ;
- volume d’occurrences d’exigences ;
- répartition Neuf / Rénovation ;
- structure du panel par référentiel et année de version ;
- Top 15 des exigences ;
- lecture des thèmes 1 à 4, séparée Neuf / Rénovation ;
- évolution des exigences par année ;
- mentions les plus demandées et Top 5 d’exigences par mention ;
- analyse des marges DRIHL par période (avant 2024 / 2024 / 2025-2026) ;
- analyse brute et pondérée de l’annexe DRIHL ;
- drill-down jusqu’aux évaluations utilisées dans les calculs.

## Filtres Exigences

Les filtres de ce module sont indépendants des filtres OPERATIONS :

- Référentiel ;
- Période ;
- Nature ;
- Profil spécifique ;
- Mention ;
- Secteur MOA ;
- Thème ;
- exigence choisie par clic dans un graphique/tableau.

Le filtre **Profil spécifique** permet notamment d’isoler les profils présents dans la colonne J de RAPPORT.

## Règles de calcul

- **Dossier** = code EVA unique.
- **Occurrence** = couple unique `Code EVA + Intitulé`.
- **Année** = `Version du ref ( date )`; en secours, l’année est extraite du libellé de version du référentiel.
- **Neuf / Rénovation** = déduit du nom du référentiel.
- **Thème** = colonne `Thème`; en secours, le premier chiffre de `Intitulé`.
- **% pondéré de l’annexe** = `(occurrences / nombre d’exigences disponibles)` puis normalisation des quatre thèmes à 100 %.

Les disponibilités de l’annexe DRIHL reprises pour la pondération sont 7 / 4 / 3 / 18, conformément à la logique de l’analyse fournie.

## Mode anonymisé global
NEWOSB V04 comprend un switch permanent `Mode anonymisé` dans la barre latérale. Son état est mémorisé et partagé avec le Générateur de rapports. Lorsqu'il est actif, les MOA, noms et codes d'opérations sont pseudonymisés ; les adresses exactes, codes postaux, codes INSEE et coordonnées sont masqués. La ville, le département, la région et le zonage restent disponibles pour les analyses géographiques. Les exports CSV et le drill-down Exigences utilisent le même mode.
