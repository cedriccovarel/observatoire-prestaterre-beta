# QA NEWOSB V05.3

Contrôles effectués sur le module Exigences :

- syntaxe JavaScript `requirements.js` : OK ;
- 10 groupes de filtres multi-sélection présents : OK ;
- sélection simultanée de 2 régions : OK ;
- filtre `Statut évaluation` : OK ;
- croisement Région + Statut : OK ;
- recherche par mots-clés après filtrage : OK ;
- nombre d'occurrences RAPPORT / sélection : OK ;
- profil dominant + occurrence : OK ;
- région dominante + occurrence : OK ;
- département dominant + occurrence : OK ;
- référentiel dominant + occurrence : OK ;
- mention dominante + occurrence : OK ;
- conservation de l'ouverture du groupe de cases pendant les sélections multiples : OK ;
- cache-busting porté à 5.0.3 : OK.

Test synthétique : 2 régions cochées + statut `Conforme`, recherche `IC Énergie 2028` => 3 occurrences dans la sélection ; région dominante Île-de-France (3), département Paris (2), profil DRIHL (2), référentiel BEE Logement Neuf (3), mention BEE+ (2).
