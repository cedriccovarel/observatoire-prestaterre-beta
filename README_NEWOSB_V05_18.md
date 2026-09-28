# NEWOSB V05.18

## Présentation enrichie

V05.18 transforme l'onglet **Présentation** en générateur de restitution compatible avec le langage visuel historique OSBslide.

### 1. Couverture dédiée
- Une couverture est maintenant créée automatiquement et reste en **slide 1**.
- Elle reprend l'esprit de la couverture historique Prestaterre : photo bâtiment, bande verte, logo Prestaterre, mention de confidentialité.
- Les textes restent éditables : titre, sous-titre, date/période, bas de page et confidentialité.
- Police et tailles du titre, sous-titre et date sont réglables.

### 2. Slides de contenu OSBslide
- Logo Prestaterre en haut à gauche.
- Trait vertical vert devant le titre.
- Sur-titre, titre et légende éditables.
- Visuel central issu du graphe ou tableau NEWOSB.
- Périmètre / filtres et note libre en bas.
- Mention de confidentialité et numéro de page.
- Tous les champs texte peuvent être supprimés, réécrits ou modifiés.
- Police et tailles sont réglables slide par slide.

### 3. Export PowerPoint / Google Slides
Le bouton **PPTX / Google Slides** exporte toute la présentation au format `.pptx`.

Dans le PPTX :
- couverture générée ;
- titres, sous-titres, légendes, périmètres, notes et confidentialité restent **éditables** ;
- le graphe / tableau est inséré comme visuel haute définition ;
- le PPTX peut être ouvert dans PowerPoint ou importé dans Google Slides.

Les exports existants sont conservés :
- PNG 4K 3840 × 2160 ;
- SVG ;
- export de toutes les slides.

### 4. Barre latérale repliable
- Nouveau bouton `‹ / ›` sur le bord de la barre latérale.
- Mode compact : seules les icônes restent visibles.
- La préférence est mémorisée localement.
- L'onglet actif, les filtres et les données ne sont pas affectés.

## Ajout d'un visuel à la présentation
Chaque carte / graphe / tableau NEWOSB compatible affiche **+ Présentation**. Le visuel est copié dans une nouvelle slide avec le périmètre de filtres actif au moment de l'ajout.

Les tableaux / graphes de l'onglet **Exigences** sont également pris en charge lorsqu'ils sont rendus dans une carte NEWOSB.

## Migration V05.17
Les slides enregistrées localement par V05.17 sont reprises automatiquement. Si aucune couverture n'existe, V05.18 en insère une en première position.

## Source OPERATIONS
Aucune modification du pont Apps Script n'est nécessaire : `Code.gs` et `Code_Operations.gs` sont identiques à V05.17 / V05.15.
