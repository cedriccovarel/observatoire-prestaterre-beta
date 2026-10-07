# Colonnes OPERATIONS — Observatoire Prestaterre V6.15

**Règle de compatibilité :** les 106 colonnes V6.7 (1 à 106, jusqu’à **Tags**) gardent strictement leur ordre. Les 26 nouvelles colonnes (107 à 132) s’ajoutent **après Tags**. L’Observatoire lit les colonnes par leur intitulé : une Sheet qui n’a pas encore les nouvelles colonnes continue de fonctionner.

**Pourquoi ces colonnes :** les opérations de rénovation sont évaluées en RT Existant (Th-C-E ex) et, pour le carbone, en **BBCA Rénovation** (indicateurs *Eges* en kgCO₂e/m² SDP). Les colonnes 94 à 99 (IC énergie, IC construction…) sont des indicateurs **RE 2020** et restent vides en rénovation : sans les colonnes 119 à 131, le carbone d’une rénovation ne pouvait pas être saisi.

## Colonnes 1 à 106 (inchangées)

1. Code interne
2. Nom de l'opération (interne)
3. Contrat: Statut
4. Évaluation: Statut
5. Affaire: Étape
6. Maître d'ouvrage: Nom de la société
7. Maître d'ouvrage: Groupe principal Nom
8. Maître d'ouvrage: Groupe principal Secteur d'activité
9. Étape
10. Date de création
11. Affaire: Nom de l'affaire
12. Affaire: Date de création
13. Affaire: Accepté le
14. Montant HT affaire
15. Contrat: Numéro du contrat
16. Contrat: Date de création
17. Contrat: Date d'activation
18. Montant HT commande
19. Évaluation: Code interne
20. Évaluation: Date de création
21. Certification: Date de décision AP
22. Certification: Date de décision CD
23. Ouvrage
24. Individuel diffus (maison individuelle)
25. Individuel groupé - Nombre de logements
26. Individuel groupé - Nombre de bâtiments
27. Logement collectif - Nombre de logements
28. Logement collectif - Nombre de bâtiments
29. Hab. communautaire - Nombre de logements
30. Logements non certifiés
31. Total logements
32. Total bâtiments
33. Référentiel: Nom du référentiel
34. Version du référentiel applicable: Version
35. Mentions
36. Performance
37. Profil choisi
38. Département
39. Code postal
40. Ville
41. Code INSEE
42. Intercommunalité
43. Zonage logement social 1/2/3
44. Longitude
45. Latitude
46. Adresse
47. Nature
48. Année
49. Vecteur chauffage avant travaux
50. Vecteur chauffage après travaux
51. Mode de chauffage après travaux
52. Vecteur ECS avant travaux
53. Vecteur ECS après travaux
54. ECS après travaux
55. Refroidissement après travaux
56. Ventilation après travaux
57. Mode constructif
58. Planchers hauts structure
59. Planchers hauts type isolant
60. Planchers hauts épaisseur isolant
61. Planchers hauts R isolant
62. Parois verticales structure
63. Parois verticales type d’isolant
64. Parois verticales épaisseur isolant
65. Parois verticales R isolant
66. Planchers bas structure
67. Planchers bas type isolant
68. Planchers bas épaisseur isolant
69. Planchers bas R isolant
70. Menuiseries extérieures matériau
71. Menuiseries extérieures vitrage
72. Menuiseries extérieures occultations
73. DH projet
74. DH max
75. TIC projet
76. TIC ref
77. Bbio projet
78. Bbio max
79. Cep projet
80. Cep max
81. Cep,nr projet
82. Cep,nr max
83. Cep refroidissement
84. Cep éclairage
85. Cep auxiliaires ventilation
86. Cep auxiliaires distribution
87. Cep déplacement occupants
88. Cep électricité
89. Cep gaz
90. Cep réseau de chaleur
91. Cep bois / biomasse
92. Ubat initial
93. Ubat projet
94. Cep initial
95. Cep après travaux final
96. IC énergie bâtiment
97. IC énergie max
98. IC composants bâtiment
99. IC construction max
100. IC construction seuil 2028
101. IC construction seuil 2031
102. DPE énergie avant travaux
103. DPE énergie après travaux final
104. DPE GES avant travaux
105. DPE GES après travaux final
106. Tags

## Colonnes 107 à 132 (nouvelles)

| N° | Colonne | Contenu | Source habituelle |
|---|---|---|---|
| 107 | Surface de plancher (m² SDP) | Surface de plancher de référence des indicateurs carbone | Notice ACV / calculette BBCA |
| 108 | Surface habitable (m² SHAB) | Surface habitable (SHAB) de l’étude thermique | Étude thermique (RSET, Pléiades, Th-C-E ex) |
| 109 | Ubat réf | Ubat de référence (RT Existant globale) | Étude RT Existant (Pléiades, Climawin…) |
| 110 | Ubat max | Ubat maximal réglementaire (RT Existant) | Étude RT Existant |
| 111 | Cep réf | Cep de référence (Th-C-E ex) | Étude RT Existant |
| 112 | Cep max label visé | Seuil Cep du label énergétique visé (ex. BBC Effinergie Rénovation, Rénovation 150) | Notice thermique |
| 113 | Label énergétique visé | Label énergétique visé ou obtenu (texte) | Notice thermique / CRM |
| 114 | Émissions GES exploitation initial (kgCO2/m².an) | Émissions GES liées aux consommations, avant travaux | Notice thermique / étude |
| 115 | Émissions GES exploitation projet (kgCO2/m².an) | Émissions GES liées aux consommations, après travaux | Notice thermique / étude |
| 116 | Consommation énergie finale projet (kWhEF/an) | Consommation totale en énergie finale après travaux | Étude thermique (détail des consommations) |
| 117 | Niveau BBCA | Niveau BBCA (BBCA, BBCA Performance, BBCA Excellent / Excellence) | Calculette BBCA / notice ACV |
| 118 | Points BBCA | Total des points BBCA | Calculette BBCA |
| 119 | Eges PCE | Produits de construction et équipements | Calculette BBCA / notice ACV |
| 120 | Eges PCE max | Seuil Eges PCE | Calculette BBCA |
| 121 | Eges PCENA | Produits et équipements non amortis | Calculette BBCA |
| 122 | Eges PCENA max | Seuil Eges PCENA | Calculette BBCA |
| 123 | Eges énergie | Consommations d’énergie sur la durée de vie | Calculette BBCA |
| 124 | Eges énergie max | Seuil Eges énergie | Calculette BBCA |
| 125 | Eges eau | Consommations d’eau | Calculette BBCA |
| 126 | Eges eau max | Seuil Eges eau | Calculette BBCA |
| 127 | Eges chantier | Chantier | Calculette BBCA |
| 128 | Eges chantier max | Seuil Eges chantier | Calculette BBCA |
| 129 | Eges total | Total des émissions | Calculette BBCA |
| 130 | Eges total max | Seuil Eges total | Calculette BBCA |
| 131 | Stockage carbone | Stockage carbone (si calculé) | Calculette BBCA |
| 132 | Sources des données techniques | Documents et pages utilisés pour les données techniques (texte court) | Extraction |

Unités : saisir **uniquement le nombre** (virgule décimale), sans unité ; les unités sont celles indiquées ci-dessus (kgCO₂e/m² SDP pour les Eges, W/m².K pour Ubat, kWhEP/m².an pour Cep).

## Ligne d’en-têtes (132 colonnes) à coller dans la ligne 2 de l’onglet OPERATIONS

Pour une Sheet existante, il suffit d’ajouter les **26 dernières** colonnes après « Tags ».

```text
Code interne	Nom de l'opération (interne)	Contrat: Statut	Évaluation: Statut	Affaire: Étape	Maître d'ouvrage: Nom de la société	Maître d'ouvrage: Groupe principal Nom	Maître d'ouvrage: Groupe principal Secteur d'activité	Étape	Date de création	Affaire: Nom de l'affaire	Affaire: Date de création	Affaire: Accepté le	Montant HT affaire	Contrat: Numéro du contrat	Contrat: Date de création	Contrat: Date d'activation	Montant HT commande	Évaluation: Code interne	Évaluation: Date de création	Certification: Date de décision AP	Certification: Date de décision CD	Ouvrage	Individuel diffus (maison individuelle)	Individuel groupé - Nombre de logements	Individuel groupé - Nombre de bâtiments	Logement collectif - Nombre de logements	Logement collectif - Nombre de bâtiments	Hab. communautaire - Nombre de logements	Logements non certifiés	Total logements	Total bâtiments	Référentiel: Nom du référentiel	Version du référentiel applicable: Version	Mentions	Performance	Profil choisi	Département	Code postal	Ville	Code INSEE	Intercommunalité	Zonage logement social 1/2/3	Longitude	Latitude	Adresse	Nature	Année	Vecteur chauffage avant travaux	Vecteur chauffage après travaux	Mode de chauffage après travaux	Vecteur ECS avant travaux	Vecteur ECS après travaux	ECS après travaux	Refroidissement après travaux	Ventilation après travaux	Mode constructif	Planchers hauts structure	Planchers hauts type isolant	Planchers hauts épaisseur isolant	Planchers hauts R isolant	Parois verticales structure	Parois verticales type d’isolant	Parois verticales épaisseur isolant	Parois verticales R isolant	Planchers bas structure	Planchers bas type isolant	Planchers bas épaisseur isolant	Planchers bas R isolant	Menuiseries extérieures matériau	Menuiseries extérieures vitrage	Menuiseries extérieures occultations	DH projet	DH max	TIC projet	TIC ref	Bbio projet	Bbio max	Cep projet	Cep max	Cep,nr projet	Cep,nr max	Cep refroidissement	Cep éclairage	Cep auxiliaires ventilation	Cep auxiliaires distribution	Cep déplacement occupants	Cep électricité	Cep gaz	Cep réseau de chaleur	Cep bois / biomasse	Ubat initial	Ubat projet	Cep initial	Cep après travaux final	IC énergie bâtiment	IC énergie max	IC composants bâtiment	IC construction max	IC construction seuil 2028	IC construction seuil 2031	DPE énergie avant travaux	DPE énergie après travaux final	DPE GES avant travaux	DPE GES après travaux final	Tags	Surface de plancher (m² SDP)	Surface habitable (m² SHAB)	Ubat réf	Ubat max	Cep réf	Cep max label visé	Label énergétique visé	Émissions GES exploitation initial (kgCO2/m².an)	Émissions GES exploitation projet (kgCO2/m².an)	Consommation énergie finale projet (kWhEF/an)	Niveau BBCA	Points BBCA	Eges PCE	Eges PCE max	Eges PCENA	Eges PCENA max	Eges énergie	Eges énergie max	Eges eau	Eges eau max	Eges chantier	Eges chantier max	Eges total	Eges total max	Stockage carbone	Sources des données techniques
```
