# Prompt d’extraction OPERATIONS — Observatoire Prestaterre V6.7

Tu dois analyser les documents que je te transmets pour compléter une ou plusieurs lignes de l’onglet **OPERATIONS** de l’Observatoire Prestaterre.

## Objectif

Produis une ligne TSV directement collable dans Google Sheets/Excel pour **chaque opération technique / bâtiment analysé**, en respectant **strictement les 106 colonnes ci-dessous, dans cet ordre, sans créer, déplacer, renommer ni supprimer aucune colonne**.

Un même projet peut avoir plusieurs lignes techniques : dans ce cas, conserve le **même `Code interne`** et les mêmes données administratives/projet sur toutes les lignes, mais renseigne les données techniques propres à chaque bâtiment/opération lorsque les documents les distinguent.

## Sources à exploiter en priorité

Analyse **tous les documents transmis**, y compris les tableaux et pages visuelles/annexes. Croise les sources sans écraser une donnée plus fiable par une donnée moins précise. En pratique :

- **ligne CRM / export Prestaterre** : données administratives, contrat, évaluation, certification, maître d’ouvrage, ouvrage, référentiel, mentions/performance ;
- **RSET / récapitulatif standardisé d’étude thermique** : Bbio, Cep, Cep,nr, DH/TIC, systèmes, enveloppe, surfaces et données réglementaires ;
- **TH-C ex / RT Existant / étude thermique rénovation** : Ubat, Cep initial/final, TIC, systèmes avant/après, enveloppe et scénarios retenus ;
- **RSEnv / récapitulatif environnemental / ACV** : IC énergie, IC construction, maxima et seuils 2028/2031 ;
- **DPE / 3CL** : classes DPE énergie et GES avant/après lorsque le document est un véritable DPE ;
- **CCTP / notices techniques** : matériaux, structures, isolants, épaisseurs, R, menuiseries, chauffage, ECS, ventilation, refroidissement ;
- **DPGF** : n’injecte pas de montants dans les 106 colonnes actuelles faute de colonne dédiée ; utilise seulement les informations techniques certaines si elles corroborent les autres documents. Les données DPGF serviront au futur onglet économique du projet.

## Règles impératives

1. **N’invente aucune donnée.** Si une information n’est pas trouvée avec un niveau de certitude suffisant, laisse la cellule vide.
2. **Préserve les données administratives déjà fournies** dans ma ligne source : ne les reformule pas et ne les remplace pas par des valeurs approchantes trouvées ailleurs, sauf demande explicite.
3. Si plusieurs versions d’une étude existent, utilise en priorité **la version finale/la plus récente applicable au scénario retenu**.
4. **Colonne `Année` = année de construction du bâtiment.** En rénovation, renseigne l’année/période de construction uniquement si elle est documentée. **Ne jamais y mettre l’année de création du dossier, du contrat, de l’étude ou de la certification.**
5. L’Observatoire calcule séparément l’**année de certification** à partir des colonnes de dates métier. Ne crée pas de nouvelle colonne pour cela.
6. **Tags** : dernière colonne. Ajoute plusieurs tags représentatifs séparés par `, ` (virgule + espace). Utilise des tags courts, stables et exploitables pour le filtrage, uniquement s’ils sont documentés ou déductibles sans ambiguïté. Exemples : `Rénovation`, `Neuf`, `Logement collectif`, `Individuel groupé`, `ITE`, `ITI`, `RCU`, `PAC air/eau`, `VMC Hygro B`, `BBC Effinergie Rénovation`, `RE2020`, `Biosourcé`. Évite les doublons et les phrases longues.
7. Pour les vecteurs énergétiques, normalise vers les familles : **Gaz, Électricité, RCU, PAC, Bois / biomasse, Fioul, Solaire, Hybride, Aucun, Autre**. Un chauffe-eau thermodynamique / ballon thermodynamique est rattaché à **PAC** pour la transition de vecteur.
8. Conserve une description plus précise du système dans `Mode de chauffage après travaux` ou `ECS après travaux` lorsque la source la fournit.
9. Pour TIC/DH : lorsqu’il existe plusieurs zones/groupes, utilise la **valeur projet la plus défavorable** et la valeur de référence/max de **la même ligne/zone**. Ne mélange jamais une valeur projet d’une zone avec une référence d’une autre.
10. `Cep max`, `Bbio max`, `DH max`, etc. doivent être de véritables **seuils réglementaires/maxima**. Ne transforme pas une simple valeur de référence en maximum si le document ne l’indique pas comme tel.
11. En RT Existant / Th-C-E ex, laisse **DH, Bbio, IC** vides s’ils ne sont pas explicitement fournis. Respecte la sémantique propre au rapport ; ne force pas des indicateurs RE2020 dans une étude RT existant.
12. Pour les colonnes `Cep électricité`, `Cep gaz`, `Cep réseau de chaleur`, `Cep bois / biomasse`, renseigne uniquement des consommations **explicitement ventilées par vecteur énergétique** dans la source. Ne redistribue pas arbitrairement un détail par usage (chauffage/ECS/éclairage/auxiliaires) en vecteurs.
13. Les colonnes DPE doivent être remplies à partir d’un **DPE réel ou d’une classe explicitement donnée comme DPE**. Une simple étiquette indicative issue d’une simulation thermique ne suffit pas.
14. Pour l’enveloppe, privilégie l’état **projet/après travaux** dans les colonnes de solutions constructives, en conservant les informations représentatives : structure, grande famille d’isolant, épaisseur, R, matériau de menuiserie, vitrage, occultations.
15. Dans les champs isolants/structures, reste fidèle à la source mais emploie si possible une formulation compatible avec les grandes familles de l’Observatoire : laine minérale, polystyrène, PU/PIR, fibre de bois, ouate, biosourcé, béton, parpaing, brique, bois, pierre/pisé, etc.
16. Utilise la **virgule décimale** dans la sortie TSV lorsque les valeurs sont numériques françaises (`0,823`, `103,06`).
17. N’insère aucun retour à la ligne dans une cellule. Pour des valeurs multiples, utilise ` / ` ou `; ` selon le besoin. Dans `Tags`, utilise exclusivement la virgule comme séparateur de tags.
18. Avant de répondre, **compte les champs** : chaque ligne doit contenir exactement **106 colonnes**.
19. Si les documents distinguent plusieurs bâtiments/scénarios réellement retenus, produis **une ligne par bâtiment/opération technique**. Ne crée pas plusieurs lignes pour de simples variantes non retenues.
20. Après le ou les blocs TSV, donne une **courte note de contrôle** indiquant les principales sources/valeurs utilisées et les champs importants laissés vides faute de preuve.

## Colonnes — ordre exact (106)

```text
Code interne	Nom de l'opération (interne)	Contrat: Statut	Évaluation: Statut	Affaire: Étape	Maître d'ouvrage: Nom de la société	Maître d'ouvrage: Groupe principal Nom	Maître d'ouvrage: Groupe principal Secteur d'activité	Étape	Date de création	Affaire: Nom de l'affaire	Affaire: Date de création	Affaire: Accepté le	Montant HT affaire	Contrat: Numéro du contrat	Contrat: Date de création	Contrat: Date d'activation	Montant HT commande	Évaluation: Code interne	Évaluation: Date de création	Certification: Date de décision AP	Certification: Date de décision CD	Ouvrage	Individuel diffus (maison individuelle)	Individuel groupé - Nombre de logements	Individuel groupé - Nombre de bâtiments	Logement collectif - Nombre de logements	Logement collectif - Nombre de bâtiments	Hab. communautaire - Nombre de logements	Logements non certifiés	Total logements	Total bâtiments	Référentiel: Nom du référentiel	Version du référentiel applicable: Version	Mentions	Performance	Profil choisi	Département	Code postal	Ville	Code INSEE	Intercommunalité	Zonage logement social 1/2/3	Longitude	Latitude	Adresse	Nature	Année	Vecteur chauffage avant travaux	Vecteur chauffage après travaux	Mode de chauffage après travaux	Vecteur ECS avant travaux	Vecteur ECS après travaux	ECS après travaux	Refroidissement après travaux	Ventilation après travaux	Mode constructif	Planchers hauts structure	Planchers hauts type isolant	Planchers hauts épaisseur isolant	Planchers hauts R isolant	Parois verticales structure	Parois verticales type d’isolant	Parois verticales épaisseur isolant	Parois verticales R isolant	Planchers bas structure	Planchers bas type isolant	Planchers bas épaisseur isolant	Planchers bas R isolant	Menuiseries extérieures matériau	Menuiseries extérieures vitrage	Menuiseries extérieures occultations	DH projet	DH max	TIC projet	TIC ref	Bbio projet	Bbio max	Cep projet	Cep max	Cep,nr projet	Cep,nr max	Cep refroidissement	Cep éclairage	Cep auxiliaires ventilation	Cep auxiliaires distribution	Cep déplacement occupants	Cep électricité	Cep gaz	Cep réseau de chaleur	Cep bois / biomasse	Ubat initial	Ubat projet	Cep initial	Cep après travaux final	IC énergie bâtiment	IC énergie max	IC composants bâtiment	IC construction max	IC construction seuil 2028	IC construction seuil 2031	DPE énergie avant travaux	DPE énergie après travaux final	DPE GES avant travaux	DPE GES après travaux final	Tags
```

## Sortie attendue

Réponds d’abord par le ou les blocs TSV **sans en-tête**, directement collables dans le tableau. Exemple de structure :

```text
valeur col.1	valeur col.2	...	valeur col.106
```

Si deux bâtiments techniques sont présents : deux lignes TSV, avec le même `Code interne` et les données projet conservées.

Ensuite seulement, ajoute une brève note de vérification des sources et des éventuelles incertitudes.
