# NEWOSB V05.12

Correctif de connexion OPERATIONS pour les erreurs de type `Failed to fetch` / délai Apps Script dépassé.

## Ce qui change

- le chargement OPERATIONS ne lance plus aucune requête Internet externe avant de répondre ;
- le référentiel Zone123 n'est plus téléchargé pendant la connexion des opérations ;
- les données sont chargées par blocs de 250 lignes ;
- les en-têtes ne sont envoyés qu'une fois, puis les lignes sont transférées sous forme de matrice compacte ;
- JSON classique puis secours JSONP restent disponibles ;
- le navigateur affiche la progression `Chargement OPERATIONS… x/y lignes` ;
- si un ancien Code.gs V05.10/V05.11 est encore déployé, NEWOSB l'indique immédiatement au lieu d'attendre le timeout ;
- les proxys Zone123 / communes restent disponibles mais uniquement lorsqu'une fonction cartographique les demande explicitement.

## Mise à jour Apps Script obligatoire

Remplacer le contenu de `Code.gs` du Google Sheet OPERATIONS par `Code_Operations.gs` de ce pack, enregistrer, puis :

`Déployer > Gérer les déploiements > Modifier > Nouvelle version > Déployer`.

L'URL `/exec` peut rester identique.

Test rapide :

`URL_EXEC?mode=ping`

doit renvoyer une réponse contenant `"version":"05.12"`.
