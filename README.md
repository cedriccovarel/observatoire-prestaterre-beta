# Observatoire Prestaterre — V6.13.3

Observatoire du bâtiment durable de Prestaterre Certification : site statique (GitHub Pages, sans build), alimenté par une Google Sheet OPERATIONS via Google Apps Script, avec générateur de slides intégré.

- **Mettre à jour depuis la V6.12 ou une V6.13.x** : voir `GUIDE_MISE_A_JOUR_V6_13_3.md`.
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
| `requirements.js`, `requirements_catalog.*` | Module Exigences |
| `auth.js` | Écran de mot de passe (barrière visuelle uniquement) |
| `Code_Operations.gs` | Script Apps Script de la source OPERATIONS (à copier dans Apps Script) |
| `Code_Exigences.gs` | Script Apps Script de la source Exigences |
| `docs/reference/` | Liste des colonnes OPERATIONS, prompt d'extraction, exemple |
| `docs/historique/`, `docs/archives/` | Anciens README/QA, anciens scripts de test, ancien `Code.gs` |

## Propriétés du script Apps Script

| Propriété | Obligatoire | Effet |
|---|---|---|
| `NEWOSB_ALLOWED_ORIGINS` | oui | Adresse(s) du site autorisée(s) à recevoir les données par le pont |
| `NEWOSB_ACCESS_KEY` | si déploiement « Tout le monde » | L'URL de la source doit finir par `?key=…` |
| `NEWOSB_ANONYMIZED_ONLY` | non | `1` : le déploiement ne renvoie que des données pseudonymisées |
| `NEWOSB_PSEUDO_SECRET` | automatique | Clé des pseudonymes du mode anonymisé serveur |
