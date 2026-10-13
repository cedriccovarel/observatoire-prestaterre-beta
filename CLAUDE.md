# Consignes pour Claude — Observatoire Prestaterre

## Règle permanente : chaque mise à jour améliore l'écran de chargement

Demandée par l'utilisateur (octobre 2026) : **toute nouvelle version de l'Observatoire doit inclure une petite
amélioration de l'animation de chargement** (`newosb-loader.js`), quelle que soit la demande principale :
qualité du rendu, nouvel élément, mouvement plus vivant, accessibilité, performance…

- Garder la ligne générale : chantier de rénovation en 5 étapes lié à l'avancement réel ; une seule barre
  pour OPERATIONS puis RAPPORT ; sobre et professionnel (pas de jeu).
- Ne jamais afficher de chiffres inventés (pas de « −xx % de CO₂ ») ni de règle normative.
- Respecter `prefers-reduced-motion` ; ne rien lire ni transmettre de données.
- Vérifier le rendu (captures aux 5 étapes) et les tests `node tests/run_all.js` et
  `NODE_PATH=/opt/node22/lib/node_modules node tests/e2e_browser.js` (scénario I).
- Noter l'amélioration dans le journal ci-dessous et dans `CHANGELOG.md`.

### Journal des améliorations de l'animation

| Version | Amélioration |
|---|---|
| V6.22 | Écran de chargement : bâtiment de 1955, technicien, CO₂ capté dans la barre. |
| V6.23 | Chantier en 5 étapes, ciel qui s'éclaircit, arbres, oiseaux ; barre unique OPERATIONS + RAPPORT. |
| V6.27 | Grue de chantier : montée avec l'isolation, livre le matériau de l'étape (isolant, fenêtre, panneau solaire), démontée à la végétalisation ; feu clignotant. |

## Autres consignes du projet

- Développer sur la branche indiquée par la session ; ne pousser sur `main` qu'à la demande de l'utilisateur.
- Aucune clé d'accès dans le code, l'URL, `localStorage` ou `sessionStorage` ; pas de repli vers une source
  publique en cas d'échec d'authentification ; pas de stockage lourd de jeux de données dans `localStorage`.
- Respecter le mode anonymisé partout. Ne pas introduire Supabase. Ne pas inventer de règles normatives.
- Les données client (exports RAPPORT, fichiers Excel transmis) ne sont jamais versionnées.
- Le bouton « Générateur de rapports » ouvre Obslide (dépôt `cedriccovarel/obslide`) : Obslide demande à la fenêtre de
  l'Observatoire (postMessage, même origine) les opérations filtrées et les lignes RAPPORT ; rien n'est stocké.
