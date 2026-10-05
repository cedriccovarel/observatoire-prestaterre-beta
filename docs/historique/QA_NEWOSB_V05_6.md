# QA NEWOSB V05.6

## Contrôles syntaxiques

- `node --check app.js` : OK
- `node --check newosb.js` : OK

## Normalisation des données

13/13 cas de contrôle validés :

- Fibre de bois -> Laine de bois
- Laine de verre 160 mm -> Laine de verre
- PSE 120 mm -> PSE
- Dalle béton armé -> Béton
- Plancher poutrelles-hourdis -> Poutrelles-hourdis
- PAC air/eau -> PAC
- Ballon thermodynamique -> CET
- Chaudière gaz condensation -> Gaz
- Chauffage électrique direct -> Électricité
- Radiateur électrique -> Électricité
- Réseau de chaleur urbain -> RCU
- VMC hygro B -> VMC hygro B
- Split multisplit -> Split / multisplit

## Contrôles fonctionnels statiques

10/10 contrôles validés :

- version et cache-busting V05.6
- zoom cartographique progressif
- couches EPCI et villes
- jauge Cep projet / Cep max
- jauges IC Énergie et IC Construction projet / max
- KPI numériques R toiture / façade / plancher bas
- sélecteur Ubat / TIC / DH
- dalles systèmes techniques
- typographie générale agrandie
- enrichissement géographique commune / EPCI disponible

## Remarque de test

Le contrôle automatisé de rendu dans le navigateur headless de l'environnement de construction n'a pas produit de résultat exploitable. Les validations de cette passe sont donc des contrôles syntaxiques, unitaires sur les normalisations et statiques sur les composants générés. Aucun résultat de test visuel navigateur n'est revendiqué ici.
