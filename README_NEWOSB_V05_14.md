# NEWOSB V05.14

Connexion OPERATIONS adaptee aux feuilles volumineuses (~7000 lignes et plus).

- pont Apps Script ouvert en fenetre top-level pour eviter le blocage des cookies/authentifications dans un iframe tiers ;
- la fenetre peut afficher une demande d autorisation Google et se ferme apres connexion ;
- blocs de 500 lignes (max 750) ;
- deux blocs charges en parallele ;
- meta lu une seule fois ; les chunks reutilisent totalRows/lastColumn sans relire les entetes ;
- aucun appel cartographique externe dans ping/meta/chunk ;
- JSON/JSONP reste un secours uniquement.

Apres remplacement de Code.gs, executer initialiserObservatoire une fois puis deployer une nouvelle version de l application Web.

Note 2026: le pont iframe historique n est plus utilise comme transport principal. La connexion ouvre une fenetre Google top-level et sonde aussi l iframe HtmlService interne avec un jeton de session.
