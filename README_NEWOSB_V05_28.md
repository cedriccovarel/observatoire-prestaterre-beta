# NEWOSB V05.28

## Évolutions principales

- **Carte Historique** : les noms de villes sont masqués aux niveaux de lecture Région / Département et ne réapparaissent qu'au niveau de détail cartographique fin.
- **Projets perdus / abandonnés** : détection dédiée à partir de `Affaire: Étape`, avec normalisation casse / accents / espaces. Les variantes perdu, abandonné et annulé/annulée portées par cette colonne sont considérées comme sorties définitives.
  - exclusion de toute la population analytique active ;
  - exclusion des KPI, MOA, cartes, labels/mentions, performances, Exigences, énergie, carbone, DPE, moyennes et pourcentages ;
  - aucune assimilation à `Non démarré` ;
  - signalement séparé sous l'évolution des opérations.
- **Mentions / labels / performances** : `<br>`, `<br/>`, `<br />` et `&lt;br&gt;` sont interprétés comme mise en forme du même libellé. `BBCA<br>Standard V4.1` et `BBCA Standard V4.1` sont donc agrégés ensemble, tout en permettant un affichage multi-ligne.
- **Exigences / Volume global** : vue Tuiles/Treemap proportionnelle au volume, palette par Cible 1/2/3/4, légende visible, volume et part affichés, détail natif au survol via `title`.
- **Filtre Maître d'ouvrage** : recherche instantanée dans le menu multi-checkbox, sans décocher les valeurs sélectionnées.
- **Pagination** : contrôle des tableaux/listes dynamiques avec plafond de 15 lignes par page.
- **Scroll** : maintien de la protection existante contre les retours automatiques en haut après filtre, pagination, changement de vue et rerender.

## Déploiement

Le pont Apps Script `Code_Operations.gs` n'a pas été modifié. **Aucun redéploiement Apps Script n'est nécessaire pour cette V05.28.**
