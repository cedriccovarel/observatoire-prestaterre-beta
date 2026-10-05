# Observatoire Prestaterre V6.12

Évolutions :
- croisement Mentions × Performances en multi-sélection par cases à cocher ;
- la sélection multicoche Mention / Performance devient le périmètre des transitions DPE énergie et DPE GES ;
- transitions DPE lues depuis les colonnes `DPE énergie avant travaux`, `DPE énergie après travaux final`, `DPE GES avant travaux`, `DPE GES après travaux final` ;
- normalisation des épaisseurs d’isolant en mm : valeur sans unité = mm, mm = mm, cm = ×10 ; en présence de plusieurs valeurs, la plus élevée est retenue ;
- pour les colonnes R toiture / façade / plancher bas, en présence de plusieurs valeurs, la plus élevée est retenue ;
- compatibilité conservée avec la structure de colonnes V6.11.

Aucun nouveau champ métier n’est ajouté. Aucun changement requis dans Code_Operations.gs pour ces règles de lecture.
