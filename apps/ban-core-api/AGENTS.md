# API HTTP

- Vérifier montages, middlewares et clients pour établir le contrat réel ; OpenAPI seul ne suffit pas.
- Préserver méthodes, chemins, champs, codes HTTP et distinction null/absent ; documenter et tester les divergences.
- Ne pas exposer les routes internes de test. Vérifier les protections effectives avant toute nouvelle exposition.
- Valider paramètres, corps, dates, limites et propriétés modifiables ; masquer les erreurs SQL/configuration brutes.
- Distinguer acceptation, réussite et validité métier des traitements asynchrones ; tester publication et suivi, y compris leurs échecs.
- Tester les handlers sans démarrer l'application complète ; actualiser OpenAPI.

Références : [README](README.md), [OpenAPI](openapi.yaml), [commandes](package.json).
