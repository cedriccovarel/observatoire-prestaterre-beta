# QA — NEWOSB V03

## Contrôles syntaxiques

- `node --check newosb.js` : OK.
- `node --check app.js` : OK.

## Tests fonctionnels automatisés avec moteur DOM simulé

Le fichier NEWOSB V03 a été exécuté avec un moteur de données de test contenant plusieurs départements, zonages, solutions constructives, valeurs CEP et transitions énergétiques.

Validé :

1. Vue d'ensemble rendue.
2. Page Territoires rendue avec barre de couches.
3. Carte : couche zonage + libellés régionaux générés.
4. Activation / désactivation de la couche Département.
5. Page Énergie rendue avec deux diagrammes de flux.
6. KPI CEP enrichis : Cep moyen, Cep max moyen, gain moyen.
7. Sélection du vecteur `Gaz` à gauche.
8. Apparition de plusieurs connexions Gaz → après travaux.
9. Affichage des volumes de transition sous les vecteurs après travaux.
10. Application du cross-filter exact `Gaz → PAC air/eau`.
11. Page Solutions : 4 modules enveloppe rendus.
12. R et épaisseurs présents dans les modules enveloppe.
13. Menuiseries matériau / vitrage / occultations présentes.
14. Systèmes techniques rendus et filtrables.
15. Décomposition du Cep par usage et par vecteur rendue lorsque les colonnes sont disponibles.

## Tests du parser de colonnes

Vérification automatique des résolutions suivantes :

- `Cep projet [kWhep/m².an]` → champ `cep`.
- `Cep Max` → champ `cepMax`.
- `Cep,nr projet` → champ `cepnr`.
- `Cep auxiliaires ventilation` → champ `cepAuxVent`.
- `Cep électricité` → champ `cepElectricity`.
- `Planchers hauts épaisseur isolant` → `roofThickness`.
- `Parois verticales type d’isolant` → `wallInsulation`.
- `Menuiseries vitrage` → `windowGlazing`.
- `Ubat projet` → `ubatAfter`.

Tous les tests passent.

## Note cartographique

Le fond départemental en production continue à utiliser les sources GeoJSON de la V29.7.13. Si ces sources externes sont indisponibles, les listes Région / Département restent exploitables et la carte affiche son état de repli, comme dans la version précédente.
