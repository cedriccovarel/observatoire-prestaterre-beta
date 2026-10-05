# NEWOSB V05.2 — correctif Code_Exigences.gs

Le script lit exclusivement l'onglet `RAPPORT`.

## Correctif principal

- Aucun ordre de colonnes imposé.
- Les en-têtes sont reconnus par nom et alias (accents, apostrophes et casse tolérés).
- `Code EVA interne` n'est plus obligatoire.
- `Évaluation: Code interne` est utilisé s'il existe.
- À défaut, le script utilise le code opération, puis le code interne de la ligne comme identifiant de regroupement.
- Une exigence peut être reconnue via :
  - `Exigence associée: Nom`
  - `Exigence associée: Exigence de référence: Intitulé`
  - `Intitulé`
  - `Nom`
  - `Description`
  - `Code d'exigence`
  - `Numéro d'exigence`
  - `Exigence de référence`
- Les colonnes Région, Département, Profil, Mention, Performance, MOA, etc. sont toutes optionnelles.
- `?mode=meta` renvoie le champ `mapping` pour voir exactement quel en-tête a été associé à chaque champ NEWOSB.

## Mise à jour

Remplacer uniquement le contenu de votre Apps Script Exigences par `Code_Exigences.gs`, enregistrer, puis redéployer la Web App avec une **nouvelle version**.
