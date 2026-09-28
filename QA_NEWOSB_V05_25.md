# QA NEWOSB V05.25

Contrôles effectués :
- `newosb.js` : syntaxe Node OK.
- `requirements.js` : syntaxe Node OK.
- `app.js` : syntaxe Node OK.
- `Code_Operations.gs` : strictement identique à V05.24.
- Version/cache dans `index.html` : V05.25 / 5.0.25.
- Aucun bloc « Zonage logement social » restant dans `newosb.js`.
- Aucun bloc de répartition par référentiel restant dans Territoires, Acteurs, Certification ou Labels & performances.
- Tables principales NEWOSB : pagination 15 lignes.
- Tables/listes Exigences : pagination 15 lignes.
- Données source d’une opération : pagination 15 lignes.
- Panneau Top territoires : pagination 15 lignes.

Limite de test : le navigateur headless de l’environnement a bloqué la navigation locale (`ERR_BLOCKED_BY_ADMINISTRATOR`), donc aucun test visuel automatisé navigateur n’est revendiqué pour cette passe. Les contrôles de syntaxe et de structure ont été réalisés.
