# QA NEWOSB V05.32

Contrôles effectués :

- syntaxe JS (`app.js`, `newosb.js`, `newosb-core.js`) ;
- présence de l’alias `Maître d'ouvrage: Groupe principal Nom` ;
- mapping distinct `moaGroup` / `moaType` ;
- filtre Nature absent des filtres globaux NEWOSB ;
- filtre Groupe MOA présent ;
- synchronisation Groupe MOA -> MOA présente ;
- union multi-groupes ;
- conservation des sélections MOA manuelles hors sélection automatique ;
- filtre effectif sur `o.moaGroup` ;
- transmission `moaGroup` au périmètre générateur ;
- préservation du scroll via `preserveUiScroll` ;
- ZIP vérifié.
