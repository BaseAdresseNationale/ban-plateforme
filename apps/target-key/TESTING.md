# Vérifier target-key

Depuis la racine, avec Node.js 24/pnpm 10.12.4 et les dépendances installées sans scripts :

```sh
pnpm --filter @ban/target-key test
pnpm --filter @ban/target-key build
pnpm --filter @ban/rabbitmq test
pnpm --filter @ban/api exec vitest run
pnpm --filter @ban/ban-core-writer exec vitest run src/helper.test.ts
pnpm --filter @ban/prisma-client test
```

Les unités n'ouvrent aucun service. Les packages workspace utilisés doivent être
construits. Le client Prisma doit être généré localement au préalable ; sa génération
n'autorise pas une migration. Ne pas copier un `.env` personnel.
L'installation figée doit conserver `normadresse` 3.2.0 pour les deux consommateurs ;
utiliser `--ignore-scripts` (et `npm_config_ignore_scripts=true` si une commande installe).

Les intégrations sont ignorées par défaut. Avec Docker local et les images **déjà
présentes** `postgis/postgis:17-3.4` et `rabbitmq:3.13-management` :

```sh
RUN_TARGET_KEY_POSTGRES_TESTS=1 pnpm --filter @ban/target-key test:postgres
RUN_TARGET_KEY_SERVICE_TESTS=1 pnpm --filter @ban/target-key test:service
```

Chaque harness crée ses conteneurs (`--pull=never`), ports loopback libres, tmpfs,
base/vhost/files/labels uniques et données synthétiques. Il vérifie daemon local,
identité du conteneur et destination avant migration/seed ; nettoyage par ID après
vérification de propriété. Aucun endpoint existant n'est accepté en argument. Une
interruption brutale exige de vérifier les ressources de son lancement avant de les
supprimer ; ne jamais lancer un nettoyage Docker général.

`registry.postgres.test.ts` qualifie concurrence, collisions, rejeu, ambiguïtés,
renommages et transferts. `service.integration.test.ts` est transversal : même
consommateur que le bootstrap, registre et Rascal 20 réels ; confirmations, publication
non routable, reprise ciblée et quarantaine. Seul son délai retry est réduit à 100 ms.

Le test transversal writer → schémas reste hors des `rootDir` applicatifs. Lui et les
exports existants requièrent une configuration factice pour leurs imports historiques :

```sh
export PG_HOST=127.0.0.1 PG_PORT=1 PG_DB=ban_target_key_unit PG_USER=test PG_PASSWORD=test
export MONGO_HOST=127.0.0.1 MONGO_PORT=1 MONGO_DB=ban_target_key_unit
export RABBITMQ_HOST=127.0.0.1 RABBITMQ_PORT=1 RABBITMQ_USER=test RABBITMQ_PASSWORD=test
pnpm exec vitest run tests/contracts/target-key-writer.contract.test.ts
pnpm --filter @ban/ban-core-exporter test
```

Ces commandes ne démarrent aucun service ni worker. Le contrat vérifie que les champs
produits passent les vrais validateurs sans perte ; les tests export vérifient que
ciblage/sélection privés ne fuient pas et ne produisent pas de faux DIFF. Mongo et la
chaîne complète parser/merger/writer ne sont pas démarrés par ces tests.
