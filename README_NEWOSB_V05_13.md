# NEWOSB V05.13

Correction de la connexion OPERATIONS lorsque Google Apps Script ne repond pas correctement aux appels cross-origin ContentService.

## Transport principal

NEWOSB utilise maintenant un pont `HtmlService` charge dans un iframe invisible. Le pont appelle le serveur avec `google.script.run`, puis renvoie les donnees a NEWOSB avec `postMessage`.

Cela evite que le chargement principal depende des redirections ContentService vers `script.googleusercontent.com`.

Les modes JSON et JSONP restent disponibles en secours.

## Installation Apps Script

1. Remplacer integralement `Code.gs` par `Code_Operations.gs` V05.13.
2. Dans l'editeur Apps Script, executer une fois `initialiserObservatoire()`.
3. Autoriser l'acces si Google le demande.
4. Executer `testerObservatoireConnexion()` : le journal doit montrer `ping`, `meta` et `chunk` avec `ok:true`.
5. Deployer > Gerer les deploiements > Modifier > Nouvelle version > Deployer.
6. Conserver l'URL `/exec` du meme deploiement.

## Chargement

- blocs de 100 lignes par defaut ;
- aucune requete Internet externe dans ping/meta/chunk ;
- zonage et communes restent asynchrones pour la cartographie ;
- memorisation de l'ID du classeur dans Script Properties pour fiabiliser le Web App.
