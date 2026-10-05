# QA NEWOSB V05.15

- [x] Syntaxe `app.js` validée par Node.
- [x] Syntaxe `Code_Operations.gs` validée après copie en `.js`.
- [x] Détection d'en-têtes testée aux lignes 1, 2, 3 et 5.
- [x] Détection de la première ligne de données testée avec une ligne vide intermédiaire.
- [x] Une ligne de note sous les en-têtes n'est plus prise pour une opération si une vraie ligne d'opération suit.
- [x] Mapping client testé sur `Code interne`, `Nom opération`, `Ville`, `Département`, `Référentiel`, `Maître d'ouvrage`, `Statut`, logements/bâtiments, profil, chauffage et CEP.
- [x] Le pont V05.14, les blocs de 500 lignes et le chargement parallèle sont conservés.
- [x] Un mauvais mapping d'en-têtes produit maintenant une erreur explicite au lieu de valeurs de secours silencieuses.
