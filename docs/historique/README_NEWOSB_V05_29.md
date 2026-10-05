# NEWOSB V05.29

Cette version prolonge strictement V05.28 et ajoute un socle de fiabilite / tracabilite sans modifier le pont Apps Script OPERATIONS.

## Nouveautes

1. Source / calcul : bouton de tracabilite sur les cartes et KPI, population active, exclusions, couverture, source, definition et methode. La date de derniere actualisation est conservee cote navigateur lors d'une connexion de source.
2. Qualite des donnees : nouvel onglet `Qualite & donnees`, controles de completude, seuils incoherents, valeurs atypiques et donnees essentielles manquantes.
3. Fiche operation 360 : synthese enrichie, chronologie des dates source, onglets Qualite, Comparables et Tracabilite.
4. Couverture statistique : disponibilite des indicateurs cle et affichage de la couverture sur les jauges energetiques / thermiques principales.
5. Comparables : selection descriptive d'operations proches par referentiel, nature, annee, taille, famille MOA et territoire ; mediane et Q1-Q3 sur les indicateurs disponibles.
6. Regles metier centralisees : nouveau module `newosb-core.js` pour exclusions, lecture des valeurs, qualite, dictionnaire et statistiques.
7. Tests automatiques : `qa_v0529.js` teste notamment perdu/abandonne/annule, `En cours`, normalisation br, couverture, statistiques, comparables et controles de seuil.
8. Separation architecture : les nouveaux calculs analytiques sont isoles du rendu de `newosb.js`.
9. Dictionnaire des donnees : definitions, unite, source, nature et methode pour les principaux indicateurs.

## Exigences
La tracabilite des cartes Exigences utilise bien la source dediee RAPPORT et ne la confond pas avec OPERATIONS.

## Apps Script
`Code_Operations.gs` est strictement identique a la V05.28. Aucun redeploiement n'est necessaire.
