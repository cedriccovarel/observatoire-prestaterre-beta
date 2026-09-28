# NEWOSB V05.22

## Pont direct Google Slides

V05.22 ajoute un export direct depuis l’onglet **Présentation** vers Google Slides.

Le navigateur n’envoie plus une capture raster au moteur PPTX pour ce mode. Il transmet une description structurée de chaque slide au Web App Apps Script OPERATIONS. `SlidesApp` recrée ensuite la présentation directement dans Google Drive avec des objets Google Slides natifs et modifiables.

### Éléments recréés nativement
- couverture Prestaterre ;
- titres, surtitres, légendes, notes et périmètres ;
- KPI ;
- graphiques à barres ;
- graphiques en lignes multi-séries ;
- tableaux ;
- tunnel de certification ;
- tuiles / treemap simplifiée ;
- jauges ;
- avant / après ;
- flux ;
- DPE ;
- cartographie sous forme native simplifiée avec libellés territoriaux ;
- fallback natif sous forme de liste si un nouveau visuel n’est pas encore reconnu.

### Installation obligatoire
Cette version modifie Apps Script.

1. Remplacer le `Code.gs` du Web App OPERATIONS par `Code_Operations.gs` V05.22.
2. Enregistrer.
3. Exécuter une fois `testerGoogleSlides()` dans l’éditeur Apps Script et accepter les autorisations demandées.
4. Déployer > Gérer les déploiements > Modifier > Nouvelle version > Déployer.
5. Conserver l’URL `/exec` actuelle dans NEWOSB.

### Utilisation
Dans **Présentation**, cliquer sur **Google Slides ↗**. Une petite fenêtre Apps Script s’ouvre le temps de la création puis NEWOSB ouvre automatiquement la nouvelle présentation Google Slides.

### Important
Le bouton PPTX reste disponible comme solution secondaire, mais le nouveau chemin recommandé est Google Slides direct.
