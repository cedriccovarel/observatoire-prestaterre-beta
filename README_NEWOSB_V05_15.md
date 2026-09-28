# NEWOSB V05.15

Correction du mapping de la source OPERATIONS après le passage au pont Apps Script gros volume.

## Changements

- Détection automatique de la vraie ligne d'en-têtes dans les 12 premières lignes de l'onglet `OPERATIONS`.
- Détection automatique de la première ligne de données (jusqu'à 30 lignes après les en-têtes).
- Le navigateur reçoit `headerRow` et `firstDataRow` depuis Apps Script et utilise cette position pour tous les blocs de 500 lignes.
- Le chargement gros volume V05.14 (pont popup + google.script.run + blocs) est conservé.
- Contrôle de mapping côté NEWOSB : si les lignes sont bien chargées mais que `Code interne` / `Nom opération` ne sont pas reconnus, NEWOSB affiche un diagnostic au lieu de générer des milliers de lignes `Non précisé`.
- Message de succès enrichi : nombre d'opérations, ligne d'en-têtes détectée, nombre de champs reconnus.
- Correctif du scoring MOA conservé.

## Déploiement

Remplacer le `Code.gs` de la source OPERATIONS par `Code_Operations.gs`, enregistrer puis créer une nouvelle version du déploiement Web App. L'URL `/exec` peut rester identique.
