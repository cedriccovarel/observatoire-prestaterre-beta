# NEWOSB V05.6

Cette version poursuit NEWOSB V05.5 avec une refonte ciblée de la cartographie, de la lisibilité générale, des solutions constructives, de l'énergie et du carbone.

## Cartographie progressive

La carte conserve les commandes de navigation de V05.5 : zoom +/−, molette et déplacement par clic droit maintenu.

Le niveau d'information évolue maintenant avec le zoom :

1. Régions
2. Départements
3. Intercommunalités / EPCI
4. Villes / communes
5. Opérations

Le zonage logement social 1 / 1 bis / 2 / 3 reste une couche indépendante. Les couches Régions, Départements, Intercommunalités, Villes et Opérations peuvent être affichées ou masquées.

Quand une opération ne possède pas déjà de coordonnées, NEWOSB tente de positionner la commune à partir du code INSEE, du code postal ou du nom de ville, puis récupère l'EPCI associé. L'adresse exacte n'est pas utilisée pour cette requête de détail cartographique.

Colonnes conseillées pour la meilleure précision :
- Code INSEE commune
- Intercommunalité / EPCI
- Longitude commune
- Latitude commune
- Zonage logement social 1/2/3

## Lisibilité générale

La taille des textes a été augmentée sur l'ensemble des dashboards : titres, KPI, cartes, tableaux, barres, flux, jauges et textes secondaires.

## Solutions constructives

Les indicateurs d'enveloppe sont désormais séparés selon leur vraie nature :

- R toiture moyen : valeur numérique en m².K/W
- R façade moyen : valeur numérique en m².K/W
- R plancher bas moyen : valeur numérique en m².K/W
- épaisseurs : valeurs numériques en mm
- isolants : catégories textuelles standardisées
- structures : catégories textuelles standardisées

Un sélecteur permet d'afficher au choix Ubat, TIC ou DH dans le quatrième KPI.

Les isolants sont regroupés dans des familles cohérentes, par exemple : Laine de verre, Laine de roche, Laine de bois, PSE, XPS, PUR, PIR, Ouate de cellulose, Chanvre, Liège, Paille, etc.

Les structures sont regroupées en catégories telles que Béton, Brique, Parpaing, Ossature bois, Charpente bois, Poutrelles-hourdis, Pierre, Structure métallique, etc.

Les systèmes techniques sont affichés sous forme de dalles puisqu'ils correspondent à des catégories textuelles : chauffage, mode de chauffage, ECS, ventilation et refroidissement.

## Énergie & transitions

Le Cep est maintenant lu directement par rapport au Cep max :
- Cep projet moyen
- Cep max moyen
- marge moyenne
- part des opérations sous le Cep max
- jauge projet / maximum

La section Performance énergétique a été simplifiée en comparaisons projet / référence : Cep,nr, Bbio, DH, TIC et Ubat avant / projet.

Les vecteurs de chauffage et d'ECS sont standardisés avant affichage des transitions : Gaz, Électricité, PAC, CET, RCU, Bois / biomasse, Fioul, Solaire, Hybride, etc.

## Carbone & DPE

Deux jauges principales positionnent :
- IC Énergie projet par rapport à IC Énergie max
- IC Construction projet par rapport à IC Construction max

Les analyses DPE énergie, DPE GES et gains avant/après sont conservées.

## Contrôles réalisés

- syntaxe JavaScript app.js : OK
- syntaxe JavaScript newosb.js : OK
- normalisation isolants / structures / énergie / ventilation / refroidissement : 13 tests sur 13
- contrôles statiques des nouvelles fonctions : 10 sur 10
- cohérence des accolades JS/CSS : OK
