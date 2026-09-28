# NEWOSB V05.8

Correctif cartographique :

- Plan IGN (Géoplateforme) devient le fond par défaut, sans clé API.
- Fallback automatique vers OpenStreetMap DE puis OpenStreetMap Standard si le fournisseur courant échoue.
- Bouton IGN/OSM dans les contrôles de carte pour changer manuellement de fond.
- Referrer-Policy explicite pour éviter les blocages de tuiles dus à un Referer supprimé.
- Les couches NEWOSB, le zonage, le zoom et le déplacement restent inchangés.
