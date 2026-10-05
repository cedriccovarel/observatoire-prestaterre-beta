# QA Observatoire Prestaterre V6.7

Contrôles effectués avant livraison :

- syntaxe JS de `app.js`, `newosb.js`, `newosb-core.js`, `requirements.js`, `auth.js`;
- tests historiques `qa_v0529.js`, `qa_v61.js`, `qa_v65.js`;
- test spécifique `qa_v67.js`;
- 106 colonnes exactement dans le nouveau modèle OPERATIONS, avec `Année` conservée en colonne 48 et `Tags` ajouté en colonne 106;
- séparation Année de construction / Année de certification;
- absence de fallback vers la date de création générique pour le filtre année certification;
- présence des 4 onglets de la fenêtre projet et de la sélection par opération technique/bâtiment;
- `requirements.js` et `Code_Exigences.gs` identiques bit à bit à la V6.6;
- mot de passe V6.4+ conservé dans `auth.js` sous forme de hash;
- cache-busting V6.7 sur `app.js`, `newosb.js`, `newosb.css`.
