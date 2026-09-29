# NEWOSB V6.4

Mise à jour ciblée de la V6.3.

## Correctifs
- Les données et agrégats reconstruits depuis OPERATIONS ne sont plus enregistrés dans `localStorage`.
- Le stockage local ne conserve en mode connecté que la configuration légère de l'interface et de la présentation.
- Le snapshot du mode manuel est conservé uniquement en mémoire pendant la session.
- Un ancien snapshot volumineux `prestaterre-v29-manual-snapshot` est nettoyé automatiquement.
- Si le quota du navigateur est malgré tout atteint, NEWOSB continue de fonctionner et ignore la sauvegarde locale au lieu de bloquer le chargement des données.
- Nouveau mot de passe d'accès ajouté sous forme de hash SHA-256 ; aucun mot de passe en clair n'est stocké dans les fichiers.
- Cache-busting de `app.js` et `auth.js` mis à jour pour GitHub Pages.

## Compatibilité
- Aucune modification de `Code_Operations.gs` ni `Code_Exigences.gs`.
- Les sources Apps Script / Google Sheets existantes restent compatibles.
- La normalisation et les camemberts de la V6.3 sont conservés.
