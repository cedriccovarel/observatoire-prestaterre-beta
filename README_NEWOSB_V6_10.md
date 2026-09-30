# Observatoire Prestaterre V6.10

## Fiches projets / opérations : direction visuelle de l'option 1

Nouvelle fiche éditoriale : bandeau projet, indicateurs clés, cartes d'information et colonne de synthèse. Les cinq rubriques et le sélecteur du bâtiment/opération technique restent disponibles.

- Vue d'ensemble : identité, tags cliquables, jalons réels de certification, aperçus de l'enveloppe et des équipements, CEP et DPE/GES avant-après, menuiseries, description et certification.
- Bâtiment & équipements : structure, parois, isolants, épaisseurs, R, Ubat, menuiseries et équipements CVC.
- Énergie & transitions : vecteurs colorés, comparaisons, ventilations du CEP et estimation indicative avec hypothèses explicites.
- Carbone & DPE : indicateurs et seuils disponibles, DPE et GES déclarés.
- Données économiques : emplacements DPGF, lots, macro-lots et aides, sans montants fictifs.

Le bandeau distingue les totaux du projet des indicateurs du bâtiment sélectionné. La jauge « Données disponibles » mesure le remplissage de 18 champs techniques, pas la performance environnementale. L'image est explicitement une illustration générique, pas une photographie du projet.

Les champs absents restent signalés. Les R comportant plusieurs valeurs restent textuels. Aucun DPE n'est déduit du CEP. Une cellule technique vide d'un bâtiment n'est pas remplie par celle de son voisin.

Navigation clavier, fermeture par Échap, retour au contexte de la page, conservation du défilement, mise en page adaptative et impression de l'onglet affiché. Les contrôles, comparables et données sources sont accessibles dans les sections dépliables en bas de la fiche.

## Navigation principale

Présentation est placé immédiatement au-dessus de Dictionnaire, après Qualité & données.

## Compatibilité et périmètre

- Aucune nouvelle colonne : les 106 en-têtes V6.7 sont inchangés.
- Code_Operations.gs et Code_Exigences.gs inchangés : aucun redéploiement Apps Script pour cette version.
- Exigences, moteur, authentification et mots de passe conservés.
- app.js est identique à la V6.9.1 : correctifs de stockage et de migration des anciens JSON conservés.
- Cette version ne constitue pas une nouvelle sécurisation serveur des données.

Fichiers d'exécution modifiés : index.html, newosb.js. Nouveau fichier : project-fiche.css. Les autres fichiers de l'archive précédente sont conservés.

## Installation avec GitHub Desktop

1. Décompresser Observatoire_Prestaterre_V6_10.zip.
2. Ouvrir le dossier local du dépôt newobs depuis GitHub Desktop.
3. Copier le CONTENU du dossier Observatoire_Prestaterre_V6_10 dans la racine du dépôt en remplaçant les fichiers. Ne pas supprimer le dossier .git.
4. Vérifier que index.html et project-fiche.css sont directement à la racine, puis Commit et Push origin.
5. Une fois le déploiement terminé, recharger le site avec Cmd + Shift + R.

Le ZIP fournit les fichiers à déployer ; il ne modifie pas lui-même le dépôt ni le site en ligne.

## Vérifications

Voir QA_NEWOSB_V6_10.md. Pour les contrôles statiques portables : node qa_v610.js depuis ce dossier.
