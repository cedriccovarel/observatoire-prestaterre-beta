# NEWOSB V05.30

Évolution ciblée de la V05.29, sans reconstruction de l'application et sans modification du pont Apps Script OPERATIONS.

## Modifications
- Cartographie : suppression des repères de villes (noms + gros points) sur les fonds cartographiques. Les régions, départements, intercommunalités et marqueurs d'opérations restent disponibles.
- Exigences / Volume global : remplacement de la grille de tuiles par une treemap géométrique. L'aire de chaque tuile est proportionnelle à son volume par rapport au total. Les 15 principales exigences restent détaillées et le reliquat est regroupé dans « Autres exigences ».
- Vue d'ensemble / Évolution des opérations : ajout d'un contrôle « Total général » permettant d'afficher ou masquer la courbe du total annuel sans modifier les séries par référentiel.
- Traçabilité : bouton « Source / calcul » réduit à une icône discrète `ⓘ`, avec le même panneau détaillé au clic.
- Protection scroll : le basculement du Total général utilise la restauration de position avant/après rerender.

## Apps Script
`Code_Operations.gs` n'a pas été modifié. Aucun redéploiement Apps Script n'est nécessaire.
