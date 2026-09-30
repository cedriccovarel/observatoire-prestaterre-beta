# Contrôles V6.10

## Tests effectués

106 contrôles interactifs ont réussi dans Chromium avec les vrais fichiers HTML/CSS/JS du paquet et des données synthétiques. Les tests portent sur la nouvelle fiche et sur le rendu des pages principales.

L'environnement interdit la navigation du navigateur vers les URL HTTP et file. Le document a donc été assemblé en mémoire avec ses scripts et styles réels. Le stockage navigateur et la session ont été remplacés uniquement dans le banc de test. Aucune modification de ce type n'est présente dans le paquet livré. Ces tests ne sont pas un test du déploiement GitHub Pages ni des sources Google Sheets de l'utilisateur.

### Scénarios

- Deux lignes techniques pour un projet : logement et bâtiments non doublés, valeurs différentes affichées selon la ligne choisie.
- Champs techniques absents, année de construction manquante et R composé : aucune reprise silencieuse du bâtiment voisin, aucune moyenne fictive.
- Cinq onglets, changements de bâtiment, tags, graphiques, données économiques vides.
- DPE/GES exacts, dépassement du seuil carbone 2031, pas de pourcentage sur les températures Celsius.
- Absence de débordement horizontal à 1920, 1024, 768 et 390 pixels.
- Navigation clavier, maintien du focus dans la fenêtre, fermeture par Échap et retour au contexte.
- Mode anonymisé : masquage des noms MOA et adresses ; les deux opérations techniques restent accessibles.
- Contrôles, comparables et traçabilité conservés à la demande.
- Ordre du menu : Présentation immédiatement avant Dictionnaire.
- Aucune erreur JavaScript pendant les interactions testées.

### Inspection visuelle

Contrôle des captures de la vue d'ensemble, des blocs détaillés, de Bâtiment & équipements et de la version mobile. Les données de ces captures sont des exemples de test, non des données de l'observatoire de production.

### Intégrité

Syntaxe des scripts d'exécution vérifiée avec node --check. Comparaison d'empreintes avec l'archive V6.9.1 : app.js, auth.js, requirements.js, newosb-core.js, Code_Operations.gs, Code_Exigences.gs et COLONNES_OPERATIONS_V6_7.tsv identiques.

Les anciens scripts QA restent dans le paquet pour historique ; certains exigent l'intitulé exact de leur ancienne version. Leurs assertions d'interface ne constituent pas les tests de recette de la V6.10. Le nouveau qa_v610.js vérifie les invariants du paquet actuel.

## Journal des 106 assertions du navigateur

1. Presentation immediately above Dictionnaire
2. Quality remains before presentation
3. Construction and certification years remain distinct
4. Two technical rows remain one project
5. Dialog has an accessible name
6. Background controls inert while sheet open
7. Project housing total is 72, not doubled
8. Building A CEP shown
9. CEP reduction calculated from actual initial value
10. DPE before/after display exact labels
11. Timeline uses declared certification date
12. Generic image explicitly labelled
13. Desktop overview has no overflow
14. Tags open technical-operation results
15. Tag results link to specific technical rows
16. Building change preserves sheet scroll
17. Building B CEP, not building A CEP
18. Project total unchanged when switching buildings
19. Sibling-only tag not inherited
20. Building-specific tag is shown
21. Missing building construction year not inherited as a tag
22. Missing building construction year remains unavailable
23. Compound thermal values preserved as source text
24. No arbitrary numeric bar from an R range
25. Empty ventilation cell does not inherit sibling description
26. Full ECS source description preserved
27. Building view has no horizontal overflow
28. energy no NaN/undefined
29. energy desktop no overflow
30. Energy usage and vector charts present
31. Known heating transition retained
32. Cost assumptions and non-bill disclaimer accessible
33. No misleading percentage calculated on Celsius
34. carbon no NaN/undefined
35. carbon desktop no overflow
36. 2031 exceedance shown separately from other thresholds
37. economics no NaN/undefined
38. economics desktop no overflow
39. Economics remains empty, no fictitious costs
40. Quality, comparables and provenance preserved
41. Keyboard tab navigation works
42. Keyboard focus stays inside the sheet
43. Escape closes sheet
44. Background interaction restored
45. Missing CEP is not displayed as zero
46. Incomplete record renders building
47. Incomplete record renders energy
48. Incomplete record renders carbon
49. Incomplete record renders economics
50. Economics placeholders retained
51. Responsive 1920px general: no overflow []
52. Responsive 1920px general: sheet fits viewport
53. Responsive 1920px building: no overflow []
54. Responsive 1920px building: sheet fits viewport
55. Responsive 1920px energy: no overflow []
56. Responsive 1920px energy: sheet fits viewport
57. Responsive 1920px carbon: no overflow []
58. Responsive 1920px carbon: sheet fits viewport
59. Responsive 1920px economics: no overflow []
60. Responsive 1920px economics: sheet fits viewport
61. Responsive 1024px general: no overflow []
62. Responsive 1024px general: sheet fits viewport
63. Responsive 1024px building: no overflow []
64. Responsive 1024px building: sheet fits viewport
65. Responsive 1024px energy: no overflow []
66. Responsive 1024px energy: sheet fits viewport
67. Responsive 1024px carbon: no overflow []
68. Responsive 1024px carbon: sheet fits viewport
69. Responsive 1024px economics: no overflow []
70. Responsive 1024px economics: sheet fits viewport
71. Responsive 768px general: no overflow []
72. Responsive 768px general: sheet fits viewport
73. Responsive 768px building: no overflow []
74. Responsive 768px building: sheet fits viewport
75. Responsive 768px energy: no overflow []
76. Responsive 768px energy: sheet fits viewport
77. Responsive 768px carbon: no overflow []
78. Responsive 768px carbon: sheet fits viewport
79. Responsive 768px economics: no overflow []
80. Responsive 768px economics: sheet fits viewport
81. Responsive 390px general: no overflow []
82. Responsive 390px general: sheet fits viewport
83. Responsive 390px building: no overflow []
84. Responsive 390px building: sheet fits viewport
85. Responsive 390px energy: no overflow []
86. Responsive 390px energy: sheet fits viewport
87. Responsive 390px carbon: no overflow []
88. Responsive 390px carbon: sheet fits viewport
89. Responsive 390px economics: no overflow []
90. Responsive 390px economics: sheet fits viewport
91. Anonymized sheet does not reveal source MOA/address
92. Both technical rows available in anonymized mode
93. Main page renders: overview
94. Main page renders: stakeholders
95. Main page renders: certification
96. Main page renders: performance
97. Main page renders: solutions
98. Main page renders: energy
99. Main page renders: carbon
100. Main page renders: crossdata
101. Main page renders: operations
102. Main page renders: quality
103. Main page renders: presentation
104. Main page renders: dictionary
105. Main page renders: requirements
106. No JavaScript page errors in tested interactions: []
