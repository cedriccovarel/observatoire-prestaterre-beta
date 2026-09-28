# NEWOSB V03 — Observatoire du bâtiment durable

NEWOSB V03 poursuit la transformation du générateur Prestaterre V29.7.13 en observatoire analytique en ligne. Le moteur de données et le générateur historique restent conservés ; la V03 renforce la cartographie, le traitement technique / enveloppe / CEP et la lecture des transitions énergétiques.

## 1. Carte multicouche Territoires

La carte NEWOSB remplace la carte de densité simple par une carte à couches cumulables :

- **Zonage 1 / 2 / 3** : fond cartographique coloré à partir du zonage des opérations localisées. Lorsqu'un département contient plusieurs zones, le fond utilise un dégradé proportionnel aux opérations de chaque zone.
- **Régions** : contours et libellés régionaux interactifs.
- **Départements** : limites départementales interactives.
- **Opérations** : bulles par département avec nombre d'opérations.

Les clics Région et Département alimentent les filtres analytiques persistants de NEWOSB.

## 2. Solutions constructives : traitement enrichi

La page Solutions est maintenant séparée en deux lectures.

### Enveloppe

- Toitures / planchers hauts : structure, isolant, R moyen, épaisseur moyenne.
- Façades / parois verticales : structure, isolant, R moyen, épaisseur moyenne.
- Planchers bas : structure, isolant, R moyen, épaisseur moyenne.
- Menuiseries extérieures : matériau, vitrage et occultations.
- Ubat avant / après et gain moyen lorsque disponibles.

### Systèmes techniques

- Chauffage après travaux.
- Mode de chauffage après travaux.
- ECS après travaux.
- Ventilation.
- Refroidissement.
- Structure principale.

Tous les éléments catégoriels restent cliquables pour le cross-filtering.

## 3. CEP : nouvelle lecture analytique

Le bloc énergie distingue désormais :

- Cep moyen.
- Cep max moyen.
- Marge moyenne `Cep max - Cep`.
- Gain moyen `(Cep max - Cep) / Cep max`.
- Part d'opérations sous le Cep max.
- Jauge agrégée Cep projet / Cep max.
- Distribution Cep.
- Distribution Cep,nr.
- Distribution Bbio.
- DH / DH max.
- Ubat avant / après et gain Ubat.
- Décomposition du Cep par usage (refroidissement, éclairage, auxiliaires de ventilation, auxiliaires de distribution, mobilité occupants) lorsque disponible.
- Décomposition du Cep par vecteur (électricité, gaz, réseau de chaleur, bois/biomasse) lorsque disponible.

Les alias de colonnes ont été renforcés pour éviter notamment de confondre `Cep projet` et `Cep max` lorsque les intitulés contiennent des unités ou des variantes de libellé.

## 4. Transitions énergétiques : diagramme interactif avant → après

Les matrices chauffage et ECS sont remplacées par un système de flux :

- colonne gauche = vecteurs **avant travaux** ;
- effectif total sous chaque vecteur avant ;
- colonne droite = vecteurs **après travaux** ;
- un clic sur un vecteur de gauche révèle uniquement ses connexions ;
- l'épaisseur d'une connexion traduit le nombre d'opérations ;
- le nombre de transitions est affiché sur la liaison et sous chaque vecteur après travaux ;
- un clic sur un vecteur de droite applique le filtre analytique exact `avant → après` à l'ensemble de NEWOSB.

Exemple : sélectionner **Gaz** à gauche fait apparaître les branches Gaz → PAC air/eau, Gaz → RCU, etc., avec leur nombre d'opérations.

## 5. Données / compatibilité

- Source Google Sheet / Apps Script inchangée.
- `Code.gs` inchangé : il renvoie toutes les colonnes disponibles.
- En-têtes techniques existants toujours compatibles.
- Nouveaux alias reconnus pour les variantes Toiture / Façade / Plancher / Menuiseries / Cep / Cep,nr / Ubat.
- Générateur V29.7.13 conservé dans `generator.html`.

## Fichiers principaux

- `index.html` : NEWOSB V03.
- `newosb.js` : dashboards, cross-filtering, carte multicouche et flux énergétiques.
- `newosb.css` : interface V03.
- `app.js` : moteur historique + parser de données enrichi.
- `generator.html` : générateur de rapports V29.7.13 conservé.
- `Code.gs` : passerelle Google Apps Script.
