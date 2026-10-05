# QA NEWOSB V05.26

Contrôles réalisés :

- Syntaxe JavaScript : `newosb.js`, `requirements.js`, `privacy.js`, `auth.js`, `app.js` validés avec `node --check`.
- Présence du drill-down cartographique régional et du bouton Retour France.
- Le clic Région force le niveau Département dans la carte détaillée.
- Le fond Historique limite les géométries affichées à la région sélectionnée.
- Vues alternatives présentes sur Territoires, Acteurs, Certification, Mentions, Performances, matrice Mentions × performances, Opérations et Données source.
- Pagination à 15 lignes contrôlée sur les principales listes NEWOSB et dans Exigences.
- Conservation du mécanisme de restauration du scroll.
- `Code_Operations.gs` identique à V05.25.
- `Code_Exigences.gs` identique à V05.25.

Note : les contrôles automatisés de cette passe sont des contrôles de syntaxe et de structure du code. Le navigateur Chromium disponible dans l'environnement n'a pas fourni de sortie DOM exploitable pour un test end-to-end headless.
