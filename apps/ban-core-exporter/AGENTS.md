# Exports FULL/DIFF

- Préserver le [contrat v0.4](specifications/ban-diff/v0.4/README.md) : enveloppes NDJSON, bornes temporelles, représentations et compteurs.
- Créer/modifier les parents avant les enfants ; désactiver les enfants avant les parents.
- Une sélection vide valide produit un flux complet à zéro ; une erreur SQL reste une erreur.
- Préserver streaming, ralentissement par les sorties et modes local/S3/both ; aucun succès avant toutes les sorties requises.
- Le rapport localise la sortie ; les clients ne reconstruisent pas chemins ou clés.
- Aucun export national, dump ou import réel pour les tests. Les intégrations restent explicites, sur des ressources dédiées ; localhost ne prouve pas l'isolement.

Procédures et commandes : [README](README.md), [package.json](package.json).
