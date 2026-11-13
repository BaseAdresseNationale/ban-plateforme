# Fixtures NDJSON v0.4

Une fixture est un petit flux de données fictives, versionné et déterministe. Elle sert à tester le générateur : chaque ligne doit être valide, les références doivent être résolues, les compteurs doivent être exacts et les cas métier exigés par la specification doivent rester couverts.

Les fixtures de base sont `ban-standard-full-v0.4.ndjson` et
`ban-standard-diff-v0.4.ndjson`.

Le FULL illustre notamment une adresse sans libellé propre (`labels: []`).
La fixture complémentaire `ban-standard-created-disabled-v0.4.ndjson` décrit une adresse créée puis
désactivée dans la même fenêtre : une seule ligne `created`, état final désactivé,
compteur `created: 1`, sans ligne `disabled` supplémentaire. Une période suivante
sans modification ne répète pas cet objet ; la vue active reste vide pour cet UUID.

Les tests de contrat couvrent aussi ce cas pour communes et toponymes,
les statuts invalides et la conservation optionnelle d'une trace.
Ces exemples et tests sans base ne démontrent pas à eux seuls l'intégralité des
règles SQL de sélection ou des mouvements administratifs.

Les schémas FULL et DIFF sont distincts ; `ban-standard-definitions-v0.4.schema.json` contient leurs types partagés. Le script `scripts/validate-ban-ndjson.mjs` vérifie les règles inter-lignes, notamment les bornes du flux, les cardinalités DIFF, l'unicité et les statistiques.

Le [scénario administratif](./administrative/README.md) ajoute trois FULL et deux
DIFF successifs. Il illustre une fusion fictive,
un renommage, des créations/désactivations et les références historiques.
Les tests reconstruisent la vue active finale, contrôlent les références et les
compteurs et distinguent les champs techniques exclus du déclenchement.
Il est autonome, sans dépendre du kit développeurs du département 96.
