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
| V6.62 | Minuscule pastille de repère en laiton scellée dans l'enduit à droite du compteur d'eau. |
| V6.61 | Minuscule éclat d'enduit plus clair, avec son ombre fine, à gauche du compteur d'eau. |
| V6.60 | Minuscule tache d'humidité sur l'enduit, sous le robinet du compteur d'eau. |
| V6.59 | Fine ligne de joint sur l'enduit au-dessus du compteur d'eau. |
| V6.58 | Minuscule point de rouille au pied de la vis droite du compteur d'eau. |
| V6.57 | Fine ombre portée sous le boîtier du compteur d'eau. |
| V6.56 | Petit reflet clair sur le collier bleu du raccord du compteur d'eau. |
| V6.55 | Petit joint noir entre le collier bleu et le tuyau du compteur d'eau. |
| V6.54 | Petite étiquette blanche « relevé » suspendue par un fil à la vis gauche du compteur d'eau. |
| V6.53 | Fine flèche bleue « sens d'écoulement » sur le côté droit du boîtier du compteur d'eau. |
| V6.52 | Petite plaque de numéro de série sombre en haut du boîtier du compteur d'eau, entre les deux vis. |
| V6.51 | Vanne d'arrêt sous le compteur d'eau : poignée rouge le long du tuyau (ouverte) pendant l'arrosage, en travers (fermée) sinon. |
| V6.50 | Petit plomb de scellé rouge accroché par un fil au raccord du compteur d'eau. |
| V6.49 | Petit moyeu sombre au pivot de l'aiguille du compteur d'eau. |
| V6.48 | Quatre repères de graduation autour du cadran du compteur d'eau. |
| V6.47 | Collier de raccord bleu à la sortie du tuyau du compteur d'eau. |
| V6.46 | Deux vis de fixation en haut du boîtier du compteur d'eau. |
| V6.45 | Reflet fixe sur la vitre du cadran du compteur d'eau. |
| V6.44 | Petite étiquette « m³ » sous le cadran du compteur d'eau. |
| V6.43 | Halo bleu pâle autour du cadran du compteur d'eau pendant l'arrosage. |
| V6.42 | Goutte qui perle au robinet du compteur d'eau pendant l'arrosage (absente si mouvements réduits). |
| V6.41 | Totaliseur du compteur d'eau qui se remplit pendant l'arrosage (à moitié et fixe si mouvements réduits). |
| V6.40 | Voyant bleu qui clignote sur le compteur d'eau pendant l'arrosage (fixe si mouvements réduits). |
| V6.39 | Compteur d'eau en façade à la végétalisation, aiguille qui tourne vite pendant l'arrosage (immobile si mouvements réduits). |
| V6.38 | Reflet de soleil qui balaie le panneau Prestaterre Certification une fois planté (absent si mouvements réduits). |
| V6.37 | Ombre du papillon au sol, plus nette quand il descend vers les fleurs. |
| V6.36 | Papillon qui butine le massif fleuri une fois les fleurs écloses (posé, ailes ouvertes, si mouvements réduits). |
| V6.35 | En fin de végétalisation, le technicien plante un panneau Prestaterre Certification (logo `assets/prestaterre_logo_green.png`) ; le poteau sort du sol, terre retournée au pied. |
| V6.34.1 | Pompe à chaleur en marche : voyant vert qui pulse et souffle d'air rejeté par le ventilateur. |
| V6.34 | Massif fleuri au pied de la façade : les tiges poussent puis fleurissent pendant la végétalisation (couleurs variées, léger balancement, immobile si mouvements réduits). |
| V6.33 | Camion de livraison (arrive, bras de grue auxiliaire qui dépose le matériau de l'étape sur la palette, repart ; roues, chauffeur, feux stop, poussière) ; palette livrée et en volume ; grue en relief avec lest et moufle ; cônes de chantier. |
| V6.32 | Ombres des nuages qui glissent sur le sol et la façade, plus nettes quand le soleil perce. |
| V6.31 | Rendu tendant vers le photoréalisme : textures procédurales (enduit, pierre, trottoir, gazon), lumière chaude du soleil et rayons, vignettage, ombre adoucie, second plan de ville et brume d'horizon, reflets de nuages sur les vitrages. |
| V6.30 | Rendu plus réaliste : ciel dégradé et soleil, silhouette de ville, bâtiment en relief (mur latéral, tuiles, reflets des fenêtres), ombres, fumée diffuse, technicien en gilet haute visibilité avec ombre et balancement des bras. |
| V6.29 | Palette de matériaux au pied de la grue (isolant, fenêtres, panneaux solaires) qui se vide avec l'avancement de l'étape. |
| V6.28 | Clôture de chantier (grillage) et panneau « Rénovation en cours », posés avec l'échafaudage, retirés à la végétalisation. |
| V6.27 | Grue de chantier : montée avec l'isolation, livre le matériau de l'étape (isolant, fenêtre, panneau solaire), démontée à la végétalisation ; feu clignotant. |

## Autres consignes du projet

- Développer sur la branche indiquée par la session ; ne pousser sur `main` qu'à la demande de l'utilisateur.
- Aucune clé d'accès dans le code, l'URL, `localStorage` ou `sessionStorage` ; pas de repli vers une source
  publique en cas d'échec d'authentification ; pas de stockage lourd de jeux de données dans `localStorage`.
- Respecter le mode anonymisé partout. Ne pas introduire Supabase. Ne pas inventer de règles normatives.
- Les données client (exports RAPPORT, fichiers Excel transmis) ne sont jamais versionnées.
- Le bouton « Générateur de rapports » ouvre Obslide (dépôt `cedriccovarel/obslide`) : Obslide demande à la fenêtre de
  l'Observatoire (postMessage, même origine) les lignes source des opérations affichées (converties par Obslide) et
  les lignes RAPPORT affichées par l'onglet Exigences (ses propres filtres) ; rien n'est stocké. Scénario e2e K
  (`OBSLIDE_DIR=/chemin/obslide` pour tester avec le vrai Obslide).
- Complément TotalRecoll (V6.49, `newosb-recoll.js`) : TotalRecoll (dépôt `cedriccovarel/TotalRecoll`, même origine) envoie par
  postMessage les valeurs ExtracTerre par bâtiment à l'onglet Observatoire qui l'a ouvert ; elles ne remplissent que les cellules
  vides du Sheet, en mémoire seulement (jamais stockées, jamais envoyées au script). Les liens partagés lisent le Sheet seul.
  Scénario e2e L (`TOTALRECOLL_DIR=/chemin/TotalRecoll` pour tester avec le vrai TotalRecoll).
  V6.50 : bouche-trous = vides ; CP / INSEE / lat / lon / année illisibles du Sheet corrigés (comptés à part) ; bâtiments en plus
  = lignes ajoutées marquées `__recollExtra` (non énumérable), exclues du contrôle ligne à ligne de l'avancement ;
  `dataRecollGains` affiche les opérations renseignées avant → après par champ.
- V6.51–V6.54 : calculs testables dans `newosb-core.js` (barre de marge, DPE en escalier, menuiseries, Croiser les données,
  carte de la Vue d'ensemble). En mode anonymisé, afficher les codes avec `core.displayCode(op)` (le `projectCode` d'une
  opération technique n'est pas pseudonymisé par privacy.js). Scénarios e2e M, N, O, P, Q.
- V6.56 : `NEWOSB_RULES.realignShiftedRows` recale à l'import (app.js `dataMatrixRowsToObjects`) les lignes dont le bloc
  « Zonage logement social » → « TAG » est collé une colonne trop à gauche dans la Sheet (l'utilisateur ne peut pas déplacer
  les colonnes) ; nombre affiché dans la fenêtre Données. Règle métier : RCU avant → autre vecteur après = alerte.
- V6.59 (règle validée par l'utilisateur) : Statut « Version préliminaire » = Proposition commerciale en cours (prioritaire sur BC
  « Non démarrée » / vide). L'avancement affiche toujours les sorties commerciales et un rapprochement : chaque opération de la
  sélection doit se retrouver (étapes + sans avancement + annulées + abandonnées + perdues ; lignes Sheet → opérations).
- V6.60 : encarts « Marge au seuil » (Énergie, Carbone) : quartiles des valeurs (25 / 50 / 75 % des opérations), opérations sous la
  médiane, moitié centrale (min–max, définition au survol) ; jauges masquables depuis ⓘ (`newosb.marginHidden.v1`, préférence locale).
- V6.61 : Stock C (`stockC`, colonne « Stock C/m² » d'ExtracTerre via TotalRecoll) dans l'encart « Marge au seuil » Carbone : pas de seuil
  réglementaire, donc jauge de répartition (`core.valueSpread` : min, quartiles, max), jamais de marge ni de seuil inventé.
- V6.61 : Présentation, slide standard : `presSlideMetrics` / `presStageVars` (hauteur d'en-tête et de bas de page selon les tailles,
  zone des visuels entre les deux, `--pres-fit` réduit `.obs-pres-items` sans changer sa mise en page 1160×450) ; export PPTX aligné.
- V6.62 : carte de la Vue d'ensemble sur fond Plan IGN v2 (Leaflet, `leaflet.js` local ; OSM en secours), export PDF avec liens
  pastille → fiche en annexe (jsPDF local, chargé au premier export). Les tuiles ne reçoivent que zoom / x / y. En e2e, toutes les tuiles
  sont servies localement (`TILE_PNG` dans `scenario()`). Territoires : Départements / Villes (`core.cityGroups`, filtre croisé `commune`).
