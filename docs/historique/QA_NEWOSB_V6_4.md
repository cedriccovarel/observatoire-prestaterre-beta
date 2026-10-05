# QA NEWOSB V6.4

- [x] Syntaxe JavaScript vérifiée avec `node --check` sur `app.js` et `auth.js`.
- [x] Le nouveau mot de passe est enregistré uniquement sous forme de hash SHA-256.
- [x] Les agrégats connectés sont exclus du payload `prestaterre-slide-generator-v1`.
- [x] Le snapshot manuel n'est plus écrit dans `localStorage`.
- [x] Une saturation de `localStorage` est interceptée et n'interrompt plus la connexion des données.
- [x] Nettoyage automatique de l'ancien snapshot volumineux.
- [x] Cache-busting GitHub Pages mis à jour.
- [x] `Code_Operations.gs` et `Code_Exigences.gs` inchangés par rapport à V6.3.
