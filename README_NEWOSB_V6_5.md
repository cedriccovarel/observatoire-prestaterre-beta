# NEWOSB V6.5

## Changements

- Tous les filtres déroulants de NEWOSB disposent désormais d'un champ de recherche directement dans le menu.
- La recherche n'empêche pas la multi-sélection : on peut taper, filtrer la liste puis cocher plusieurs valeurs.
- Le bouton **Tout cocher** agit sur les valeurs actuellement visibles lorsque la liste est recherchée.
- L'onglet **Exigences** reprend les filtres généraux de l'Observatoire : Année, Référentiel, Groupe MOA, Avancement, Maître d'ouvrage, Région, Département, Profil et Zonage, avec le même fonctionnement multi-sélection + recherche. Les filtres métier Exigences restent disponibles.
- `Code_Exigences.gs` reconnaît en plus l'année opération et le zonage si ces colonnes sont présentes dans RAPPORT.
- Dans **Carbone & DPE**, les transitions DPE énergie et GES utilisent le même diagramme avant → après que les vecteurs énergétiques. Les classes A à G conservent leurs couleurs.
- Le logo Prestaterre de la barre supérieure est légèrement réduit pour éviter le débordement.
- Le mot de passe ajouté en V6.4 est conservé et la correction localStorage V6.4 reste active.

## Déploiement

Remplacer les fichiers GitHub par le contenu du dossier `NEWOSB_V6_5`. Pour profiter des nouveaux champs Année/Zonage dans l'onglet Exigences si RAPPORT les contient, recopier puis redéployer `Code_Exigences.gs`. Les autres fonctionnalités fonctionnent sans modification du script Apps Script.
