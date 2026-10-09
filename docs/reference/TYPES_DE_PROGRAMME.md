# Types de programme (onglet Exigences et filtre global) — V6.19

Le type est déduit par le script Apps Script (bloc « LECTURE RAPPORT », identique dans `Code_Operations.gs` et `Code_Exigences.gs`) à partir de :

1. la colonne facultative **« Type de programme »** de RAPPORT, si elle est renseignée avec une catégorie reconnue (elle l’emporte) ;
2. sinon le **nom du programme (client)**, comparé aux termes ci-dessous (sans accents ni majuscules, mots entiers) ;
3. le **référentiel**, qui limite les catégories possibles.

## Règles

- **Le premier terme rencontré dans le nom l’emporte** : « Bureaux - Extension de la clinique » → Bureaux ; « Crèche - … » → Scolaire et enseignement. À position égale, le terme le plus long gagne (« hôtel de ville » → Équipements publics, pas Hôtelier).
- **Les morceaux du nom qui sont une adresse sont ignorés** (séparés par « - », « , », « / »… et commençant par rue, avenue, boulevard, place, quai, chemin, route, allée, impasse, cours, square, rond-point, faubourg, passage, éventuellement précédés d’un numéro) : « Rue de la Mairie - Bureaux » → Bureaux.
- **Référentiel tertiaire** : catégories tertiaires et résidences gérées. Sans terme reconnu : **Non déterminé** (aucune catégorie inventée ; à compléter par la colonne « Type de programme »).
- **Référentiel logement** : résidences gérées, logement individuel ou logement collectif. Sans terme reconnu : **Logement collectif** (par défaut). « Villa … » et « Pavillon … » ne suffisent pas : ce sont souvent des noms commerciaux d’immeubles ; les mentions « 15coll » / « 2ind » des noms sont lues.
- Les crèches, EAJE, accueils périscolaires et ALSH sont rangés en **Scolaire et enseignement** (pas de catégorie « petite enfance » dans la liste).
- Lien de partage anonymisé : le type est transmis, jamais le nom du programme.

## Termes par catégorie

| Catégorie | Référentiels | Termes reconnus (N = nombre) |
|---|---|---|
| Bureaux | Tertiaire | bureau(x), immeuble(s) de bureaux, siege(s)( sociaux /  social), coworking, espace(s) de travail, plateau(x) tertiaire(s) |
| Commerces | Tertiaire | commerce(s), commercial, commerciale, commerciaux, magasin(s), boutique(s), supermarche(s), hypermarche(s), grande surface, surface(s) de vente, galerie(s) marchande(s), centre(s) commerciaux, centre(s) commercial, retail, decathlon, restaurant(s), brasserie, drive |
| Hôtelier | Tertiaire | hotel(s), hotelier(s), hoteliere, auberge(s), apart hotel(s), appart hotel(s), hostel(s), motel(s) |
| Scolaire et enseignement | Tertiaire | ecole(s), groupe(s) scolaire(s), scolaire(s), periscolaire(s), college(s), lycee(s), campus, universite…, universitaire…, enseignement…, formation, centre(s) de formation, business school, school, maternelle(s), elementaire(s), refectoire(s), cantine(s), restaurant(s) scolaire(s), creche(s), micro creche(s), petite enfance, multi accueil, eaje, jeune(s) enfant(s), assistante(s) maternelle(s), halte garderie, garderie, alsh, accueil(s) de loisirs, centre(s) de loisir(s), maison(s) de l enfance, pole enfance, internat, iut |
| Résidences gérées (étudiantes, seniors, tourisme) | Tous | residence(s) (etudiante(s) / etudiants / senior(s) / service(s) / de services / de tourisme / tourisme / hoteliere(s) / jeunes / jeunes actifs / intergenerationnelle(s) / autonomie / geree(s) / sociale(s)), co living, foyer(s), logement(s) foyer(s), crous, village(s) (de )vacances, hebergement…, pension(s) de famille, maison(s) relais, ehpa, pole(s) senior(s) |
| Santé et médico-social (cliniques, EHPAD, centres médicaux) | Tertiaire | ehpad, clinique(s), hopitaux, hopital, hospitali…, centre(s) hospitalier(s), chu, centre(s) medicaux, centre(s) medical, pole(s) medica…, maison(s) medicale(s), maison(s) de sante, centre(s) de sante, centre(s) de soins, cms, medico…, medical, medicale, soins, readaptation, smr, ssr, sante, pharmacie(s), cabinet(s) medicaux, dialyse, radiologie, village(s) d enfants, protection de l enfance, esat |
| Locaux d’activité et industrie | Tertiaire | usine(s), atelier(s), industri…, locaux d activite(s), locaux d activite, batiment(s) d activite(s), parc(s) d activite(s), zone(s) d activite(s), ad park, manufacture(s), maroquinerie, production, site(s) d exploitation, laboratoire(s), data center(s), datacenter(s), ferme urbaine, artisan…, garage(s), centre(s) technique(s) |
| Logistique (entrepôts, plateformes de distribution) | Tertiaire | entrepot(s), logistique(s), plateforme(s) logistique(s), plateforme(s) de distribution, messagerie, stockage, logicor, cross dock |
| Équipements publics (culturels, sportifs, administratifs) | Tertiaire | mairie(s), hotel de ville, gymnase(s), complexe(s) sporti…, equipement(s) sporti…, equipement(s) public…, salle(s) de sport, salle(s) polyvalente(s), salle(s) des fetes, piscine(s), piscinatoire, stade(s), dojo, cosec, bibliotheque(s), mediatheque(s), musee(s), theatre(s), cinema(s), conservatoire(s), espace(s) cultur…, centre(s) cultur…, culture, sport(s), sportif(s), caserne(s), gendarmerie, commissariat, cite administrative, prefecture, tribunal, palais de justice, pole emploi, france travail, caf, maison(s) du parc, espace(s) multiservice(s), maison(s) des jeunes, mdj, aire(s) de jeux, centre(s) sociaux, centre social, maison(s) de quartier, vie sociale, administrati…, service(s) de l etat, archives |
| Logement individuel (maisons, lotissements) | Logement | maison(s) individuelle(s), maisons, lotissement(s), pavillonnaire, individuel…, habitat individuel, maison(s) groupee(s), logement(s) individuel(s), Nind |
| Logement collectif (immeubles d'appartements) | Logement | logement(s) collectif(s), immeuble(s), appartement(s), residence(s), collectif(s), Ncoll, coll |

Pour ajouter un synonyme : compléter la liste `terms` de la catégorie dans `NEWOSB_PROGRAM_TYPES`, **à l’identique dans les deux scripts** (un test le vérifie), puis redéployer.

## Résultat sur l’export RAPPORT fourni (31 130 lignes)

| Référentiel | Type | Opérations |
|---|---|---|
| Tertiaire | Bureaux | 133 |
| Tertiaire | Scolaire et enseignement | 79 |
| Tertiaire | Équipements publics | 18 |
| Tertiaire | Santé et médico-social | 8 |
| Tertiaire | Locaux d’activité et industrie | 6 |
| Tertiaire | Hôtelier | 4 |
| Tertiaire | Résidences gérées | 3 |
| Tertiaire | Commerces | 2 |
| Tertiaire | Logistique | 1 |
| Tertiaire | **Non déterminé** (nom = adresse ou nom de marque) | 74 |
| Logement | Logement collectif | 2 938 |
| Logement | Logement individuel | 68 |
| Logement | Résidences gérées | 55 |

## Filtre global de l’Observatoire (V6.19)

Pour chaque ligne OPERATIONS, le script calcule le type dans cet ordre : colonne « Type de programme » d’OPERATIONS (si saisie) → RAPPORT par code interne d’opération → RAPPORT par numéro de contrat → nom présent dans OPERATIONS (« Nom du programme (client) », sinon « Nom de l’opération ») avec le référentiel de la ligne. L’origine retenue est indiquée dans la colonne « Type de programme : origine ».
