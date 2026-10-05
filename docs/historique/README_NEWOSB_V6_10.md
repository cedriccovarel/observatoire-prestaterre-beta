# Observatoire Prestaterre V6.10

## Fiches projets / opérations - option 1

La fiche reprend la composition éditoriale validée : bandeau illustré, indicateurs, cartes thématiques et colonne « En synthèse ». L'illustration générique est explicitement identifiée et ne représente pas une photographie du projet.

Le cercle indique le nombre de champs techniques renseignés sur une liste explicite de 14 champs. Ce n'est ni un score de performance environnementale, ni un certificat de conformité.

Les cinq rubriques restent disponibles :
1. Vue d'ensemble.
2. Bâtiment & équipements.
3. Énergie & transition.
4. Carbone & DPE.
5. Données économiques, toujours sans montants fictifs.

Le sélecteur de bâtiment pilote les données techniques. Les compteurs logements et bâtiments en tête restent les totaux du projet. Les valeurs techniques absentes d'une ligne ne sont pas remplacées par celles d'une autre ligne. Les classes DPE sont lues dans la source, pas déduites du CEP.

Les tags restent cliquables. Le bouton Données source donne accès à la ligne sélectionnée. L'export crée une fiche HTML autonome contenant les cinq rubriques et l'illustration incorporée. Il ne publie rien en ligne. Une fiche exportée peut contenir des informations internes : vérifier le mode anonymisé avant diffusion.

Les onglets sont accessibles au clavier. Échap ferme la fiche. La position de défilement est conservée lors des changements de rubrique et au retour à l'observatoire.

## Navigation

Présentation est placé juste au-dessus de Dictionnaire, après Qualité & données.

## Installation

Paquet complet : copier le CONTENU du dossier Observatoire_Prestaterre_V6_10 dans le dossier local du dépôt, au même niveau que index.html. Conserver les fichiers de configuration propres au dépôt (notamment .git, CNAME et les workflows personnalisés). Effectuer Commit puis Push origin dans GitHub Desktop.

Patch depuis la V6.9.1 uniquement : remplacer index.html et newosb.js, et ajouter project-ux.css. Aucun autre fichier de production n'a changé. Les URL de ces ressources comportent une version de cache V6.10.

Aucune nouvelle colonne dans OPERATIONS. Aucun redéploiement Apps Script. Le mot de passe reste inchangé. Le correctif JSON V6.9.1 et le fonctionnement du stockage local sont conservés. Exigences est inchangé.

Après le déploiement GitHub Pages, recharger une fois avec Cmd + Shift + R sur Mac.

## Vérifications

Voir QA_NEWOSB_V6_10.md. Exécuter `node qa_v610.js` depuis la racine du paquet pour les contrôles unitaires.
