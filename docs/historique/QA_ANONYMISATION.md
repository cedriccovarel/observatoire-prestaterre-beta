# QA — Mode anonymisé global NEWOSB V04

## Périmètre
Le switch `Mode anonymisé` est fixé au bas de la barre latérale NEWOSB et persiste via `localStorage`.
Le même état est repris par le Générateur de rapports.

## Données neutralisées
- maître d'ouvrage -> pseudonyme `MOA xxxxxx`
- nom d'opération -> `Opération xxxxxx`
- code opération -> `OP-xxxxxx`
- adresse / rue -> supprimée
- code postal -> supprimé
- code INSEE -> supprimé
- latitude / longitude -> supprimées
- champs source identifiants (MOA, société, adresse, contact, nom d'opération/programme, identifiants contractuels ciblés) -> pseudonymisés ou supprimés

## Données territoriales conservées
- ville
- département
- région
- zonage 1 / 2 / 3

## Surfaces couvertes
- Vue d'ensemble
- Territoires
- Acteurs
- Certification
- Labels & performances
- Exigences
- Solutions constructives
- Énergie & transitions
- Carbone & DPE
- Opérations
- fiche opération et onglet Données source
- export CSV de la sélection
- Data Explorer / exports du générateur V29.7.13
- générateur de rapports ouvert dans un autre onglet

## Vérifications réalisées
- syntaxe JS validée (`node --check`) pour privacy.js, app.js, newosb.js et requirements.js
- test unitaire de pseudonymisation : aucune valeur MOA, nom d'opération, rue ou code postal d'origine ne subsiste dans l'objet anonymisé
- activation persistante via la clé `newosb-privacy-anonymized-v1`
- changement de mode réinitialise le filtre MOA et ferme toute fiche/source déjà ouverte pour éviter de laisser une valeur antérieure à l'écran

## Note technique
Le mode anonymisé protège les restitutions, drill-downs et exports de NEWOSB. La source Google Sheet / Apps Script reste la source de vérité et est interrogée par le navigateur ; pour une publication totalement publique avec exigence de confidentialité au niveau réseau, il faudra également publier un endpoint Apps Script dédié ne renvoyant que des données anonymisées.
