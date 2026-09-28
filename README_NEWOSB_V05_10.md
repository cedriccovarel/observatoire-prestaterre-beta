# NEWOSB V05.10

Correctif connexion Google Apps Script OPERATIONS.

## Changements
- Connexion JSON classique conservee.
- Secours automatique JSONP si le navigateur bloque `fetch()` / CORS / redirection Apps Script.
- Nouveau `Code.gs` / `Code_Operations.gs` compatible JSONP avec le parametre `prefix`.
- Endpoint de test : `/exec?mode=ping`.
- Le serveur ne geolocalise plus chaque operation une par une avant de repondre : la reponse OPERATIONS est beaucoup plus rapide.
- Le zonage 1 / 1 bis / 2 / 3 reste enrichi par correspondance Ville + Departement / code INSEE.
- Les coordonnees, villes et EPCI manquants restent hydrates cote NEWOSB par la carte.
- Correctif MOA de V05.9 conserve.

## Mise a jour Apps Script
1. Remplacer le contenu de `Code.gs` par `Code_Operations.gs`.
2. Enregistrer.
3. Deployer > Gerer les deploiements > Modifier > Nouvelle version > Deployer.
4. Conserver la meme URL `/exec`.
5. Tester `URL_EXEC?mode=ping` dans le navigateur : la reponse doit contenir `"ok":true` et `"version":"05.10"`.
6. Dans NEWOSB, cliquer sur `Connecter / actualiser`.
