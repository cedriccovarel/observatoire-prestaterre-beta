# Observatoire Prestaterre — V6.20

Observatoire du bâtiment durable de Prestaterre Certification : site statique (GitHub Pages, sans build), alimenté par une Google Sheet OPERATIONS via Google Apps Script, avec générateur de slides intégré.

- **Mettre à jour depuis une V6.13.x** : voir `GUIDE_MISE_A_JOUR_V6_14.md` (les deux scripts Apps Script changent ; clé d’accès obligatoire).
- **Partager une vue (V6.15)** : bouton « ⤴ Partager » ; mise en place et fonctionnement dans `GUIDE_MISE_A_JOUR_V6_14.md`, section « V6.15 — Liens de partage ».
- **Règles des mentions** : `docs/reference/TRACABILITE_MENTIONS_V6_14.md`.
- **Historique des versions** : `CHANGELOG.md` (anciens README/QA par version dans `docs/historique/`).
- **Tests** : `node tests/run_all.js` (non-régression, sans dépendance) et `node tests/e2e_browser.js` (navigateur, optionnel).

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Observatoire |
| `generator.html` | Générateur de rapports / slides |
| `newosb-rules.js` | Règles de lecture des données (nombres, épaisseurs, R, avancement) — partagées par tout le site |
| `app.js` | Moteur de données et générateur de slides (V29) |
| `newosb-core.js` | Dictionnaire, contrôles qualité, provenance |
| `newosb.js` | Interface de l'Observatoire |
| `privacy.js` | Mode anonymisé |
| `requirements.js`, `requirements_catalog.*` | Module Exigences (onglet, fiche opération, encart de compatibilité) |
| `newosb-bridge.js` | Client du pont sécurisé Apps Script (clé en mémoire, origine et fenêtre vérifiées) |
| `newosb-game.js` | Mini-jeu 8 bits « Capte le CO₂ » affiché pendant le chargement des données |
| `newosb-share.js` | Liens de partage à durée limitée : fenêtre « Partager » (administration) et page du destinataire (filtres figés, onglets accordés, Exigences comprises) |
| `newosb-mentions.js`, `mentions_catalog.js` | Moteur et catalogue normatif des mentions (BEE LN 04/05/2026, BEE LR 18/06/2025) |
| `auth.js` | Écran de mot de passe (barrière visuelle uniquement) |
| `Code_Operations.gs` | Script Apps Script de la source OPERATIONS (à copier dans Apps Script) |
| `Code_Exigences.gs` | Script Apps Script de la source Exigences |
| `docs/reference/` | Liste des colonnes OPERATIONS, prompt d'extraction, exemple |
| `docs/historique/`, `docs/archives/` | Anciens README/QA, anciens scripts de test, ancien `Code.gs` |

## Propriétés du script Apps Script

| Propriété | Obligatoire | Effet |
|---|---|---|
| `NEWOSB_ALLOWED_ORIGINS` | oui | Adresse(s) du site autorisée(s) à dialoguer avec le pont (OPERATIONS et Exigences) |
| `NEWOSB_ACCESS_KEY` | **oui** (16 caractères min.) | Clé saisie dans l’Observatoire, gardée en mémoire ; jamais dans l’URL. Une clé distincte par projet Apps Script |
| `NEWOSB_ANONYMIZED_ONLY` | non | `1` : le déploiement ne renvoie que des données pseudonymisées |
| `NEWOSB_PSEUDO_SECRET` | automatique | Clé des pseudonymes du mode anonymisé serveur |
