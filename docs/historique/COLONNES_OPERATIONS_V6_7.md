# Colonnes OPERATIONS — Observatoire Prestaterre V6.7

**Règle de compatibilité :** les 105 colonnes existantes conservent strictement leur ordre. La seule nouvelle colonne est **106. Tags**, ajoutée à la fin.

**Important :** la colonne **48. Année** correspond à **l’année de construction du bâtiment**. En rénovation, elle ne doit jamais être remplacée par une année de certification. Le filtre « Année certification » de l’Observatoire est calculé à partir des dates métier de certification (CD, puis AP, puis création de l’évaluation en repli).

**Tags :** une cellule peut contenir plusieurs tags séparés par des virgules, par exemple `Rénovation, Logement collectif, ITE, RCU, BBC Effinergie Rénovation`.

## Liste complète

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

## Ligne d’en-têtes à coller dans Google Sheets / Excel

```text
Code interne	Nom de l'opération (interne)	Contrat: Statut	Évaluation: Statut	Affaire: Étape	Maître d'ouvrage: Nom de la société	Maître d'ouvrage: Groupe principal Nom	Maître d'ouvrage: Groupe principal Secteur d'activité	Étape	Date de création	Affaire: Nom de l'affaire	Affaire: Date de création	Affaire: Accepté le	Montant HT affaire	Contrat: Numéro du contrat	Contrat: Date de création	Contrat: Date d'activation	Montant HT commande	Évaluation: Code interne	Évaluation: Date de création	Certification: Date de décision AP	Certification: Date de décision CD	Ouvrage	Individuel diffus (maison individuelle)	Individuel groupé - Nombre de logements	Individuel groupé - Nombre de bâtiments	Logement collectif - Nombre de logements	Logement collectif - Nombre de bâtiments	Hab. communautaire - Nombre de logements	Logements non certifiés	Total logements	Total bâtiments	Référentiel: Nom du référentiel	Version du référentiel applicable: Version	Mentions	Performance	Profil choisi	Département	Code postal	Ville	Code INSEE	Intercommunalité	Zonage logement social 1/2/3	Longitude	Latitude	Adresse	Nature	Année	Vecteur chauffage avant travaux	Vecteur chauffage après travaux	Mode de chauffage après travaux	Vecteur ECS avant travaux	Vecteur ECS après travaux	ECS après travaux	Refroidissement après travaux	Ventilation après travaux	Mode constructif	Planchers hauts structure	Planchers hauts type isolant	Planchers hauts épaisseur isolant	Planchers hauts R isolant	Parois verticales structure	Parois verticales type d’isolant	Parois verticales épaisseur isolant	Parois verticales R isolant	Planchers bas structure	Planchers bas type isolant	Planchers bas épaisseur isolant	Planchers bas R isolant	Menuiseries extérieures matériau	Menuiseries extérieures vitrage	Menuiseries extérieures occultations	DH projet	DH max	TIC projet	TIC ref	Bbio projet	Bbio max	Cep projet	Cep max	Cep,nr projet	Cep,nr max	Cep refroidissement	Cep éclairage	Cep auxiliaires ventilation	Cep auxiliaires distribution	Cep déplacement occupants	Cep électricité	Cep gaz	Cep réseau de chaleur	Cep bois / biomasse	Ubat initial	Ubat projet	Cep initial	Cep après travaux final	IC énergie bâtiment	IC énergie max	IC composants bâtiment	IC construction max	IC construction seuil 2028	IC construction seuil 2031	DPE énergie avant travaux	DPE énergie après travaux final	DPE GES avant travaux	DPE GES après travaux final	Tags
```
