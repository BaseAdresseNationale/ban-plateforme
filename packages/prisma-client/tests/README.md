# Support PostgreSQL des tests d'exports

Ce dossier fournit une petite structure et un jeu synthétique pour qualifier les
exports FULL/DIFF sur des bases dédiées. Il ne restaure aucun dump de production,
ne nécessite pas le kit du département fictif 96 et ne prépare aucune base
automatiquement. Les tests JavaScript ordinaires restent utilisables sans Docker.

## Structure et protections

`support/export-schema.sql` reproduit les six tables temporelles, clés étrangères,
exclusions GiST, triggers et fonctions de référence utiles aux exports.
Ce bootstrap est réservé aux tests : ce n'est pas une baseline de production
ni un remplacement des migrations Prisma. `support/synthetic-fixture.mjs`
contient neuf lignes fictives, couvrant création, modification et désactivation.

Le helper `postgres-test-helpers.mjs` impose `RUN_BAN_POSTGRES_TESTS=1`, autorise
uniquement `ban_export_validation_tmp` et `ban_fixture_validation_tmp`, puis
vérifie `current_database()`. Il utilise Docker, le conteneur `ban_postgres` et
le rôle `ban_user`. Il refuse notamment `ban` et toute base applicative.

## Préparer les bases explicitement

Ces commandes se lancent depuis la racine du dépôt. Vérifier d'abord que la
base cible n'existe pas et que la connexion administrative cible `postgres`.
Si elle existe, examiner son état : **ne pas la supprimer ou la réinitialiser
automatiquement**. Le bootstrap ne doit être exécuté qu'une fois sur une base
neuve ; aucune commande ci-dessous ne supprime une base.

### Structure et données synthétiques

```sh
docker exec ban_postgres psql --username=ban_user --dbname=postgres --no-psqlrc \
  --set=ON_ERROR_STOP=1 --command="CREATE DATABASE ban_export_validation_tmp OWNER ban_user TEMPLATE template0;"
RUN_BAN_POSTGRES_TESTS=1 node --input-type=module <<'NODE'
import fs from 'node:fs';
import { sql } from './packages/prisma-client/tests/postgres-test-helpers.mjs';
import { seedSql } from './packages/prisma-client/tests/support/synthetic-fixture.mjs';
sql('ban_export_validation_tmp', fs.readFileSync('packages/prisma-client/tests/support/export-schema.sql', 'utf8'));
sql('ban_export_validation_tmp', seedSql());
NODE
```

### Structure sans données

```sh
docker exec ban_postgres psql --username=ban_user --dbname=postgres --no-psqlrc \
  --set=ON_ERROR_STOP=1 --command="CREATE DATABASE ban_fixture_validation_tmp OWNER ban_user TEMPLATE template0;"
RUN_BAN_POSTGRES_TESTS=1 node --input-type=module <<'NODE'
import fs from 'node:fs';
import { sql } from './packages/prisma-client/tests/postgres-test-helpers.mjs';
sql('ban_fixture_validation_tmp', fs.readFileSync('packages/prisma-client/tests/support/export-schema.sql', 'utf8'));
NODE
```

Ne pas charger `seedSql()` dans cette seconde base : les contrôles de base vide
exigent une structure vide. La procédure applicative est décrite dans le
[guide de l'exporteur](../../../apps/ban-core-exporter/README.md#contrôles-postgresql-isolés-des-exports-v04).
Elle lit les données sans les modifier et ne publie aucun message RabbitMQ/S3.

## Interpréter les contrôles

Une sélection valide sans résultat doit produire un flux complet avec compteurs
à zéro. Une erreur SQL doit rester une erreur, pas devenir un succès vide.
Les tests de reconstruction administrative et de contrat sont sans base ; ce
support SQL qualifie un autre niveau de la chaîne.

Les remplacements temporaires de fonctions effectués par les tests SQL doivent
rester dans leurs transactions et se terminer par `ROLLBACK`. Ne pas exécuter
plusieurs suites modifiant les mêmes fonctions simultanément sur la même base.
Les diagnostics, migrations et retours arrière ne sont jamais déclenchés par
la préparation de ces bases.
