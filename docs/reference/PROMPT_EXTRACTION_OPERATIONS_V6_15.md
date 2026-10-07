# Prompt d’extraction OPERATIONS — Observatoire Prestaterre V6.15

> Remplace le prompt V6.7. Changements principaux : 132 colonnes (26 nouvelles après « Tags », dont le **carbone en rénovation BBCA Rénovation**) ; une carte « où trouver quoi » par type de document ; un **tableau de contrôle obligatoire** des champs thermiques et carbone, qui interdit de laisser un champ vide sans avoir cherché et sans dire pourquoi.

Tu dois analyser **tous** les documents que je te transmets (PDF, tableurs, images, annexes) pour compléter une ou plusieurs lignes de l’onglet **OPERATIONS** de l’Observatoire Prestaterre.

## 1. Sortie attendue

1. Une ligne **TSV** (valeurs séparées par des tabulations) **par bâtiment / opération technique**, **sans en-tête**, avec **exactement 132 colonnes** dans l’ordre de la section 6.
2. Puis le **tableau de contrôle** (section 5), une ligne par champ thermique et carbone, pour chaque bâtiment.
3. Puis une courte note : documents utilisés (nom, version, date), arbitrages entre documents contradictoires, points d’incertitude.

Compte les champs avant de répondre : 132 par ligne, ni plus ni moins. Aucune tabulation ni retour à la ligne à l’intérieur d’une cellule.

## 2. Méthode de travail (à suivre dans cet ordre)

1. **Inventaire** : liste chaque document, son type (section 3), sa date/version, le ou les bâtiments qu’il couvre.
2. **Bâtiments** : identifie les bâtiments / opérations techniques réellement retenus (ex. « bâtiment sur rue » et « bâtiment sur cour »). Produis une ligne par bâtiment ; les données administratives et le `Code interne` sont identiques sur toutes les lignes du projet.
3. **Lecture exhaustive des tableaux** : les valeurs utiles sont presque toujours dans des tableaux (résultats, synthèses, annexes, onglets de calculette). Lis chaque tableau de résultats en entier, **y compris les annexes et les dernières pages**.
4. **Remplissage** champ par champ avec la carte de la section 3, puis **tableau de contrôle** (section 5).
5. **Contrôle croisé** : si deux documents donnent des valeurs différentes, retiens la **plus récente applicable au scénario retenu** (version / date la plus récente), et signale l’écart dans la note.

## 3. Où trouver chaque donnée, selon le document

### Étude RT Existant globale — Th-C-E ex (Pléiades, Climawin, Perrenoud, ClimaWin…)
Rapport type « Résultats RT Existant suivant la méthode THCE-Ex ».
- **Cep projet** et **Cep après travaux final** : tableau « Exigence de résultat : Cep », colonne *Projet*.
- **Cep réf** : même tableau, colonne *Référence*. **Cep max** : colonne *Max(CH,ECS,FR)* ou « Cep max RT-Ex ».
- **Cep initial** : colonne *Initial* (souvent vide dans le rapport projet → la chercher dans la notice thermique ou l’étude « état initial »).
- **Ubat projet / Ubat réf / Ubat max** : tableau « Transmission surfacique… » (lignes *Ubât (hiver)* et *Ubât-max*).
- **TIC projet / TIC ref** : « Exigence de résultat : Tic » (valeur projet la plus défavorable et sa référence, même groupe).
- **Consommation énergie finale projet** : « Détail des consommations (énergie finale) », ligne *Consommation totale* (somme des types d’énergie).
- **Cep électricité / gaz / réseau / bois** : uniquement si les consommations sont ventilées par énergie ; un bâtiment **100 % électrique** (consommations bois et autres = 0 dans le tableau) a son Cep entier en **Cep électricité**.
- Attention à l’ordre des colonnes *Initial / Projet / Référence* : en projet, la colonne *Initial* est souvent vide et le premier nombre lu est le **Projet**.
- Les « étiquettes équivalentes » énergie/CO₂ d’un rapport RT Existant **ne sont pas un DPE** : ne pas les mettre dans les colonnes DPE (les citer dans la note).

### Notice thermique (bureau d’études, phase APD / PRO / DCE)
- Tableau « État initial / Seuils RT existant / Seuils label / Résultats projet » : **Ubat initial**, **Cep initial**, **Ubat max**, **Cep max RT-Ex**, **Cep max label visé**, **Émissions GES exploitation projet** (et initial si donné), **Ubat projet**, **Cep projet**.
- **Label énergétique visé** : BBC Effinergie Rénovation, Rénovation 150 / HPE rénovation, etc. (une valeur par bâtiment).
- Tableaux « compositions avant / après » : **structures, isolants, épaisseurs, R** par paroi, **menuiseries** (matériau, vitrage, Uw), **occultations**.
- Paragraphes « Ventilation », « Chauffage », « ECS » : systèmes **avant** (état existant) et **après**.

### Notice ACV / label **BBCA Rénovation** et **calculette BBCA** (tableur)
- Calculette BBCA (onglet « Résultats BBCA réno ») ou annexe « Fiche de synthèse – résultat BBCA » de la notice :
  **Niveau BBCA** (ex. « BBCA Excellent »), **Surface de plancher (m² SDP)**, **Eges PCE**, **Eges PCENA**, **Eges énergie**, **Eges chantier**, **Eges eau**, **Stockage carbone**, **Eges total** (ligne *Eges*), et dans « Calcul des seuils BBCA réno » : **Eges PCE max**, **Eges PCENA max**, **Eges énergie max**, **Eges chantier max**, **Eges eau max**, **Eges total max** (*Eges max*) ; **Points BBCA** (*TOTAL* des points).
- Tableau « Seuil BBCA Réno / Projet » de la notice : mêmes indicateurs, à utiliser si la calculette n’est pas fournie.
- Priorité : calculette (valeurs non arrondies) > annexe de la notice > tableau de synthèse arrondi.
- Ces indicateurs vont **uniquement** dans les colonnes Eges (119 à 131). **Ne jamais** les recopier dans les colonnes IC (RE 2020).

### RSET / étude RE 2020 (construction neuve)
Bbio, Cep, Cep,nr, DH (projet et max), postes Cep (refroidissement, éclairage, auxiliaires, déplacement), systèmes, enveloppe.

### RSEnv / ACV RE 2020 (construction neuve)
IC énergie, IC composants (construction), leurs maxima, seuils 2028 / 2031.

### DPE / 3CL
Classes énergie et GES **uniquement** depuis un véritable DPE.

### Plans de repérage des isolants, CCTP, notices techniques, DPGF
Confirment ou complètent : type d’isolant, épaisseur, λ, R, localisation (murs, toitures, rampants, combles, planchers bas). La DPGF ne fournit aucun montant aux 132 colonnes.

## 4. Règles de remplissage

1. **N’invente rien** ; mais **cherche partout** avant de laisser vide (annexes, tableurs, légendes de plans). Chaque champ thermique/carbone vide doit être justifié dans le tableau de contrôle.
2. **Données administratives** de ma ligne CRM : conservées telles quelles, jamais reformulées.
3. **Version** : la plus récente applicable au scénario retenu ; écarts signalés.
4. **Année** (col. 48) = année de construction du bâtiment, seulement si documentée ; jamais l’année du dossier, de l’étude ou de la certification.
5. **Neuf (RE 2020)** : remplir Bbio, Cep, Cep,nr, DH, IC… ; laisser vides les colonnes RT Existant et Eges sauf si fournies.
   **Rénovation (RT Existant)** : remplir Ubat/Cep initial et projet, Ubat réf/max, Cep réf/max, TIC, label visé, consommations ; **carbone dans les colonnes Eges (BBCA Rénovation)** ; laisser **vides** DH, Bbio, Cep,nr et IC (RE 2020) sauf s’ils sont explicitement fournis.
6. **Cep max** = un véritable seuil (RT Existant : Max(CH,ECS,FR) / Cep max RT-Ex ; RE 2020 : Cep max). Une **référence** va dans « Cep réf », un seuil de **label** dans « Cep max label visé ».
7. **Enveloppe** : état projet. Plusieurs valeurs pour une même paroi → toutes, séparées par ` / ` (la plus représentative en premier), ex. `140 / 80` mm, `3,9 / 2,2`. Épaisseurs en **mm** (14 cm → 140), R en m².K/W.
8. **Familles de vecteurs** : Gaz, Électricité, RCU, PAC, Bois / biomasse, Fioul, Solaire, Hybride, Aucun, Autre. Ballon thermodynamique → PAC. Description précise du système dans « Mode de chauffage après travaux » / « ECS après travaux ».
9. **Refroidissement** : `Aucun` si l’étude indique 0 consommation de refroidissement.
10. **Virgule décimale**, nombres **sans unité** dans les colonnes numériques.
11. **Tags** (col. 106) : tags courts séparés par `, ` (ex. `Rénovation, Logement collectif, ITI, Fibre de bois, VMC simple flux Hygro A, Tout électrique, BBCA Rénovation, BBCA Excellent, Rénovation 150`).
12. **Sources des données techniques** (col. 132) : texte court, ex. `Pléiades 02/04/2025 ; Notice thermique PRO v4.3 02/2025 ; Calculette BBCA cour ; Notice ACV PRO v2.1 12/2024`.

## 5. Tableau de contrôle obligatoire (après les lignes TSV)

Pour **chaque bâtiment**, un tableau Markdown avec une ligne pour chacun de ces champs :
Ubat initial · Ubat projet · Ubat réf · Ubat max · Cep initial · Cep projet · Cep après travaux final · Cep réf · Cep max · Cep max label visé · Label énergétique visé · TIC projet · TIC ref · Consommation énergie finale projet · Émissions GES exploitation initial / projet · Bbio projet / max · DH projet / max · Cep,nr projet / max · IC énergie / max · IC composants / max · Surface de plancher · Niveau BBCA · Points BBCA · Eges PCE / max · Eges PCENA / max · Eges énergie / max · Eges eau / max · Eges chantier / max · Eges total / max · Stockage carbone · DPE énergie / GES avant / après.

Colonnes du tableau : **Champ | Valeur retenue | Document et page / onglet | Statut** — statut parmi : `Trouvé`, `Calculé (règle 9 ou 4.5)`, `Non applicable (neuf/rénovation)`, `Absent des documents (cherché dans : …)`, `Contradiction (valeurs : … ; retenu : …)`.

Un champ **ne peut être vide** dans la ligne TSV que si son statut est « Non applicable » ou « Absent des documents » avec les documents parcourus.

## 6. Colonnes — ordre exact (132)

```text
Code interne	Nom de l'opération (interne)	Contrat: Statut	Évaluation: Statut	Affaire: Étape	Maître d'ouvrage: Nom de la société	Maître d'ouvrage: Groupe principal Nom	Maître d'ouvrage: Groupe principal Secteur d'activité	Étape	Date de création	Affaire: Nom de l'affaire	Affaire: Date de création	Affaire: Accepté le	Montant HT affaire	Contrat: Numéro du contrat	Contrat: Date de création	Contrat: Date d'activation	Montant HT commande	Évaluation: Code interne	Évaluation: Date de création	Certification: Date de décision AP	Certification: Date de décision CD	Ouvrage	Individuel diffus (maison individuelle)	Individuel groupé - Nombre de logements	Individuel groupé - Nombre de bâtiments	Logement collectif - Nombre de logements	Logement collectif - Nombre de bâtiments	Hab. communautaire - Nombre de logements	Logements non certifiés	Total logements	Total bâtiments	Référentiel: Nom du référentiel	Version du référentiel applicable: Version	Mentions	Performance	Profil choisi	Département	Code postal	Ville	Code INSEE	Intercommunalité	Zonage logement social 1/2/3	Longitude	Latitude	Adresse	Nature	Année	Vecteur chauffage avant travaux	Vecteur chauffage après travaux	Mode de chauffage après travaux	Vecteur ECS avant travaux	Vecteur ECS après travaux	ECS après travaux	Refroidissement après travaux	Ventilation après travaux	Mode constructif	Planchers hauts structure	Planchers hauts type isolant	Planchers hauts épaisseur isolant	Planchers hauts R isolant	Parois verticales structure	Parois verticales type d’isolant	Parois verticales épaisseur isolant	Parois verticales R isolant	Planchers bas structure	Planchers bas type isolant	Planchers bas épaisseur isolant	Planchers bas R isolant	Menuiseries extérieures matériau	Menuiseries extérieures vitrage	Menuiseries extérieures occultations	DH projet	DH max	TIC projet	TIC ref	Bbio projet	Bbio max	Cep projet	Cep max	Cep,nr projet	Cep,nr max	Cep refroidissement	Cep éclairage	Cep auxiliaires ventilation	Cep auxiliaires distribution	Cep déplacement occupants	Cep électricité	Cep gaz	Cep réseau de chaleur	Cep bois / biomasse	Ubat initial	Ubat projet	Cep initial	Cep après travaux final	IC énergie bâtiment	IC énergie max	IC composants bâtiment	IC construction max	IC construction seuil 2028	IC construction seuil 2031	DPE énergie avant travaux	DPE énergie après travaux final	DPE GES avant travaux	DPE GES après travaux final	Tags	Surface de plancher (m² SDP)	Surface habitable (m² SHAB)	Ubat réf	Ubat max	Cep réf	Cep max label visé	Label énergétique visé	Émissions GES exploitation initial (kgCO2/m².an)	Émissions GES exploitation projet (kgCO2/m².an)	Consommation énergie finale projet (kWhEF/an)	Niveau BBCA	Points BBCA	Eges PCE	Eges PCE max	Eges PCENA	Eges PCENA max	Eges énergie	Eges énergie max	Eges eau	Eges eau max	Eges chantier	Eges chantier max	Eges total	Eges total max	Stockage carbone	Sources des données techniques
```

Repères de position : 48 = Année · 94-99 = IC RE 2020 · 106 = Tags · 107-132 = nouvelles colonnes V6.15 (119-131 = Eges BBCA Rénovation, 132 = Sources).
