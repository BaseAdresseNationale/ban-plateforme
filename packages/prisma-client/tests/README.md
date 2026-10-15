# Support PostgreSQL des tests d'exports

Ce dossier fournit une petite structure et un jeu synthétique pour qualifier les
exports FULL/DIFF sur des bases dédiées. Il ne restaure aucun dump de production,
ne nécessite pas le kit du département fictif 96 et ne prépare aucune base
automatiquement. Les tests JavaScript ordinaires restent utilisables sans Docker.

## Tester la chaîne de migrations Prisma

`pnpm --filter @ban/prisma-client test` vérifie les dépendances sans base.
Les tests réels passent exclusivement par Prisma (`resolve`/`deploy`) et couvrent :

- une base vide, avec les treize fichiers de migration ;
- une structure déjà présente avec des données synthétiques et un index manquant,
  puis reconnaissance de la baseline et application des douze autres migrations ;
- une base ayant réellement appliqué les dix fichiers historiques via Prisma,
  avec les auxiliaires anciennement installés à part, puis application des trois
  ajouts : anciennes lignes du registre, données et fonctions optimisées intactes ;
- les 17 fonctions et les indexes de référence, le registre et ses empreintes,
  les enveloppes FULL/DIFF, les sélections vides et la conservation des objets existants ;
- une deuxième commande `deploy` sans changement de l’état installé.

Ces tests utilisent uniquement `ban_migrations_additive_empty_tmp`,
`ban_migrations_additive_restore_tmp` et `ban_migrations_additive_legacy_tmp`.
Ils exigent trois bases **neuves**, marquées comme
bases de test, et refusent de nettoyer/réinitialiser une cible existante.
Le scénario représente un schéma préexistant ; il n’importe aucune donnée de production
et ne remplace pas les contrôles sur la vraie candidate restaurée.

Après vérification que ces trois noms sont libres, créer explicitement les bases :

```sh
docker exec ban_postgres psql --host=/var/run/postgresql --username=ban_user --dbname=postgres --no-psqlrc --set=ON_ERROR_STOP=1 \
  --command='CREATE DATABASE ban_migrations_additive_empty_tmp OWNER ban_user TEMPLATE template0;' \
  --command="COMMENT ON DATABASE ban_migrations_additive_empty_tmp IS 'BAN isolated migration test';" \
  --command='CREATE DATABASE ban_migrations_additive_restore_tmp OWNER ban_user TEMPLATE template0;' \
  --command="COMMENT ON DATABASE ban_migrations_additive_restore_tmp IS 'BAN isolated migration test';" \
  --command='CREATE DATABASE ban_migrations_additive_legacy_tmp OWNER ban_user TEMPLATE template0;' \
  --command="COMMENT ON DATABASE ban_migrations_additive_legacy_tmp IS 'BAN isolated migration test';"
```

Fournir `PG_URL` **en mémoire** vers `ban_migrations_additive_empty_tmp` sur localhost, rôle
`ban_user`, `?schema=ban`, via votre mécanisme de secrets. Ne pas changer les `.env`
partagés. Le test contrôle l’identité de l’instance Docker par socket et TCP.

```sh
RUN_BAN_MIGRATION_TESTS=1 pnpm --filter @ban/prisma-client test:migrations:postgres
```

Les bases sont conservées pour inspection. Les journaux et empreintes vont dans
`working/prisma-migration-tests/`, hors Git. Une nouvelle exécution exige à nouveau
trois bases neuves ; décider explicitement du nettoyage des anciennes avant de les
recréer. Aucun `reset`, aucune suppression ni correction du registre n’est automatique.
Pour conserver un ancien essai, un suffixe de 1 à 12 caractères alphanumériques
minuscules peut être fourni dans `BAN_MIGRATION_TEST_SUFFIX` : par exemple `r2`
demande trois noms terminant par `_r2`. Créer ces bases explicitement et adapter
`PG_URL` ; les autres protections restent identiques.

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

Les tests d'équivalence, diagnostics et retours arrière des optimisations sont
décrits séparément dans [README-performance.md](README-performance.md), sur la
branche enfant `codex/ban-export-sql-optimizations`.
