# NEWOSB V05.32

## Filtre Groupe MOA

- Le filtre global **Nature** est remplacé par **Groupe MOA**.
- Source : `Maître d'ouvrage: Groupe principal Nom`.
- Le moteur distingue ce champ du secteur d’activité (`moaType`).
- La sélection d’un ou plusieurs groupes filtre directement les opérations sur leur groupe principal.
- Les maîtres d’ouvrage appartenant aux groupes cochés sont automatiquement cochés dans le filtre **Maître d’ouvrage**.
- Plusieurs groupes = union des MOA rattachés.
- Lorsqu’un groupe est décoché, les MOA ajoutés automatiquement uniquement par ce groupe sont retirés, tandis que les sélections MOA manuelles préexistantes sont conservées.
- Le scroll est préservé pendant ces interactions.
- Le filtre est transmis dans le périmètre NEWOSB vers le générateur, en complément de la liste exacte des opérations filtrées.

## Compatibilité

- `Code_Operations.gs` inchangé.
- Moteur historique V29.7.13 conservé.
