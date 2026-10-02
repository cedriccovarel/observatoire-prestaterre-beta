# Contrôles V6.10

## Périmètre

Base exacte : Observatoire_Prestaterre_V6_9_1.zip fourni dans la conversation.
Les tests d'interface sont exécutés avec Chromium / Playwright sur un DOM local en mémoire et un jeu de données synthétique de contrôle. Le navigateur de test interdit la navigation réseau ; le chargement HTTP et les services Google/GitHub en production n'ont pas été testés. Les ressources locales sont injectées et fetch est simulé uniquement dans le banc de test.

## Résultats

- 18 fichiers JavaScript : syntaxe vérifiée avec node --check.
- 13 contrôles unitaires V6.10 passés.
- Tests V6.1 et V05.29 passés.
- 53 contrôles d'interface passés (ci-dessous), aucune erreur JavaScript de page.
- Export HTML : cinq rubriques, illustration incorporée, absence de scripts et de boutons inactifs. Le contenu produit a été vérifié ; le téléchargement natif est remplacé par un collecteur de Blob dans le test.
- Cas supplémentaires : CEP = 0, base de gain absente, DPE non renseigné, résistances multiples, échappement HTML des noms issus de la source.

## Tests d'interface

- Presentation immediately before Dictionnaire
- Project opens in new UX
- Project title from source
- Project total stays 124 dwellings, not duplicated
- Building A CEP is 68
- Two operations preserved
- Construction and certification years distinct
- No invented environmental score
- Switching tab preserves project scroll
- Three envelope cards retained
- Building A R retained
- Building B CEP is 110, no averaging
- Missing roof value not borrowed from A
- Project totals unchanged after changing building
- energy tab renders
- carbon tab renders
- economics tab renders
- general tab renders
- Distinct electricity and PAC vector colors
- Clicking tag shows linked projects
- Source view is selected building B
- Keyboard navigation across tabs
- Escape closes project
- Background restored on close
- No private hero text retained after close
- No horizontal overflow at 1920px / general
- No horizontal overflow at 1920px / building
- No horizontal overflow at 1920px / energy
- No horizontal overflow at 1920px / carbon
- No horizontal overflow at 1920px / economics
- No horizontal overflow at 1366px / general
- No horizontal overflow at 1366px / building
- No horizontal overflow at 1366px / energy
- No horizontal overflow at 1366px / carbon
- No horizontal overflow at 1366px / economics
- No horizontal overflow at 1024px / general
- No horizontal overflow at 1024px / building
- No horizontal overflow at 1024px / energy
- No horizontal overflow at 1024px / carbon
- No horizontal overflow at 1024px / economics
- No horizontal overflow at 768px / general
- No horizontal overflow at 768px / building
- No horizontal overflow at 768px / energy
- No horizontal overflow at 768px / carbon
- No horizontal overflow at 768px / economics
- No horizontal overflow at 390px / general
- No horizontal overflow at 390px / building
- No horizontal overflow at 390px / energy
- No horizontal overflow at 390px / carbon
- No horizontal overflow at 390px / economics
- Anonymized project retains both buildings
- Anonymized sheet hides identity and address
- No JavaScript page errors

## Non-régression des fichiers protégés

Comparaison binaire avec la V6.9.1 : app.js, auth.js, Code_Operations.gs, Code_Exigences.gs, requirements.js, requirements_catalog.js, privacy.js, privacy.css, newosb-core.js, newosb.css, generator.html et les en-têtes OPERATIONS sont strictement inchangés.

Le correctif JSON `roof`, les mécanismes de stockage local et le mot de passe sont donc conservés. Aucun test ne prétend valider le JSON privé de l'utilisateur, non fourni pour cette mise à jour.
