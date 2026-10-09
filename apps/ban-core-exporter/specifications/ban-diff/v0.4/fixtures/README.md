# Fixtures NDJSON v0.4

Une fixture est un petit flux de données fictives, versionné et déterministe. Elle sert à tester le générateur : chaque ligne doit être valide, les références doivent être résolues, les compteurs doivent être exacts et les cas métier exigés par la specification doivent rester couverts.

Les quatre fixtures livrées sont : `ban-raw-full-v0.4.ndjson`, `ban-raw-diff-v0.4.ndjson`, `ban-standard-fr-full-v0.4.ndjson` et `ban-standard-fr-diff-v0.4.ndjson`.

Les schémas Full et DIFF sont distincts dans chaque sérialisation. Les fichiers `*-definitions-*` contiennent uniquement les types partagés. Le script `scripts/validate-ban-ndjson.mjs` vérifie les règles inter-lignes, notamment les bornes du flux, les cardinalités DIFF, l'unicité et les statistiques.
