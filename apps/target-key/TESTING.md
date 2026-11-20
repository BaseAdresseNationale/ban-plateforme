# Vérifier target-key

Depuis la racine, avec Node.js 24/pnpm 10.12.4 et les dépendances installées sans scripts :

```sh
pnpm --filter @ban/target-key test
pnpm --filter @ban/target-key build
pnpm --filter @ban/rabbitmq test
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

