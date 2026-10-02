# Observatoire Prestaterre V6.11

Mise à jour du mapping OPERATIONS vers la nouvelle structure d'export, sans ajout de nouvelle donnée métier.

Principaux raccordements :
- projet : `Opération: Code interne`, `Nom de l'opération` ;
- MOA : `Nom de la société: Nom de la société`, groupe principal et secteur d'activité ;
- territoire : `Région de l'opération`, `Département de l'opération`, Code postal, Ville, Code INSEE ;
- certification : `Référentiel`, `Version`, `Opération: Mentions`, `Opération: Performance`, `Opération: Profil choisi` ;
- avancement : priorité à `Opération: Évaluation: Statut`, puis `État du dossier` ;
- sorties définitives / soldé : colonne `Statut` ;
- année de certification : décision CD, décision de certification, AP, puis première réception du dossier ;
- année de construction : `Année de construction`, avec alias `Année` pour le fichier d'export actuel ;
- toutes les colonnes techniques existantes restent raccordées sans changement de sens.

La région source est utilisée directement quand elle existe, avec repli sur le département. Les lignes sans code interne ne reçoivent plus de faux code automatique : le nom d'opération devient la clé de repli.

`Code_Operations.gs` et `Code.gs` reconnaissent désormais `Opération: Code interne` / `Nom de l'opération` lors de l'auto-détection des en-têtes. Un redéploiement Apps Script OPERATIONS est donc recommandé pour fiabiliser la nouvelle structure. `Code_Exigences.gs` et `requirements.js` sont inchangés.
