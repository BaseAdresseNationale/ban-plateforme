# Vérifier et mettre à niveau une base restaurée

## Objectif

Adapter une candidate isolée à une version du dépôt, en préservant historiques
et droits : **contrôler → reconnaître la baseline si nécessaire → appliquer les
migrations Prisma → tester → autoriser la bascule**. Les outils de restauration
ne migrent pas automatiquement la base.

## 1. Vérifier la cible et conserver un état de référence

Noter commit/tag, versions PostgreSQL/extensions, provenance du dump, rôle et cible.
Arrêter les services qui écrivent sur la candidate ; garder sauvegarde validée,
configuration et définitions/propriétaires/ACL des objets concernés.

Auditer en `BEGIN READ ONLY` : colonnes/types/valeurs par défaut, contraintes,
indexes, triggers, fonctions, droits et `_prisma_migrations`. Vérifier les corps
avec `pg_get_functiondef` et les contraintes avec `pg_get_constraintdef`.
Contrôler la cible SQL et `PG_URL` : changer `PG_DB` ne réécrit pas cette URL.
Garder les URL contenant des secrets hors des sorties et de Git.

## 2. Examiner les migrations et leur registre

Une **migration** est un fichier SQL qui fait évoluer la structure ou les fonctions
de la base. Chaque dossier numéroté de
[`prisma/migrations`](../../packages/prisma-client/prisma/migrations) contient un
fichier `migration.sql`. Par exemple, « migration `0000_baseline` » désigne
`0000_baseline/migration.sql`.

Prisma suit leur application dans la table `_prisma_migrations` (le registre).
Une **baseline** représente l'état de départ reconnu par Prisma. Comparer noms
et empreintes SHA-256 des fichiers au registre restauré ; analyser toute différence
ou migration inachevée/annulée avant d'agir.

| Situation | Suite |
| --- | --- |
| Registre présent et cohérent | Examiner puis exécuter les migrations en attente, y compris les nouveaux prérequis intercalés. |
| Schéma déjà chargé, registre absent | Contrôler la baseline, reconnaître seulement `0000_baseline`, puis appliquer les autres fichiers. |
| Registre partiel mais migrations terminées et cohérentes | Vérifier le schéma et les empreintes avant de poursuivre les migrations en attente. |
| Migration en échec, empreinte différente ou écart inexpliqué | Arrêter et faire examiner l’écart ; ne pas réécrire le registre pour le masquer. |

`migrate status` peut retourner un code non nul pour des migrations en attente
ou un historique divergent ; il ne prouve pas l'équivalence du schéma réel.

## 3. Prérequis propres à ce dépôt

Le fichier de migration [`0000_baseline`](../../packages/prisma-client/prisma/migrations/0000_baseline/migration.sql)
décrit les tables modélisées et leurs indexes initiaux, pas l’ensemble d’un dump
BAN. Conserver l’historisation, les tables supplémentaires et les contraintes
restaurées ; documenter les écarts, notamment les colonnes plus strictes `NOT NULL`,
avant de reconnaître cet état de départ. Ne pas assouplir le dump pour le faire coïncider.

Les dix fichiers historiques restent inchangés. Trois migrations additives
complètent l’installation des exports :

- [`0000a_export_index_prerequisites`](../../packages/prisma-client/prisma/migrations/0000a_export_index_prerequisites/migration.sql) :
  extension `btree_gist` et index temporel manquant, avant les indexes de `0001`.
- [`0005a_export_metadata_helpers`](../../packages/prisma-client/prisma/migrations/0005a_export_metadata_helpers/migration.sql) :
  auxiliaires de métadonnées et de code INSEE, avant leur utilisation dans `0006`.
- [`0010_complete_export_metadata`](../../packages/prisma-client/prisma/migrations/0010_complete_export_metadata/migration.sql) :
  métadonnées complémentaires, en conservant les fonctions optimisées.

Prisma trie les noms complets des dossiers. Sur une base ayant déjà appliqué
les dix anciens fichiers, il exécute aussi les nouveaux fichiers intercalés,
sans rejouer ni modifier les anciennes lignes du registre. Les trois parcours
(base vide, schéma restauré, ancien historique) sont décrits et testés dans le
[guide Prisma](../../packages/prisma-client/migration.md).

Les créations d’indexes peuvent consommer beaucoup de disque, produire des WAL
et bloquer des écritures. Réévaluer les ressources avant deploy : les estimations
du script de restauration ne couvrent pas les migrations ultérieures. La migration
`0006` recrée des fonctions ; contrôler également leurs propriétaires et GRANT.
Le support SQL de `tests/support/` reste réservé aux tests, pas à une réparation.

## 4. Appliquer uniquement le plan validé

Exécuter seulement sur la candidate auditée, avec un rôle autorisé et la
[configuration Prisma du dépôt](../../packages/prisma-client/prisma.config.ts).
Préparer `TARGET_PG_URL` en mémoire via le mécanisme de secrets.

Avant **chaque** commande, vérifier l'URL et `TARGET_DATABASE` (nom explicite de la
candidate, sans valeur par défaut). `CURRENT_DATABASE` est la base applicative
avant bascule (`ban` par défaut à l'installation). Le garde-fou exige une cible locale.

```sh
set -euo pipefail
CURRENT_DATABASE="ban"
TARGET_DATABASE="ban_restore"
: "${TARGET_PG_URL:?Configurer TARGET_PG_URL via le mécanisme local de secrets}"

assert_candidate_url() {
  PG_URL="$TARGET_PG_URL" CURRENT_DATABASE="$CURRENT_DATABASE" TARGET_DATABASE="$TARGET_DATABASE" node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import pg from 'pg';
const expected = process.env.TARGET_DATABASE;
const current = process.env.CURRENT_DATABASE;
const url = new URL(process.env.PG_URL);
assert.ok(/^[a-z_][a-z0-9_]{0,62}$/.test(expected));
assert.ok(/^[a-z_][a-z0-9_]{0,62}$/.test(current));
assert.ok(!['ban', current, 'postgres', 'template0', 'template1'].includes(expected));
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
assert.equal(decodeURIComponent(url.pathname.slice(1)), expected);
assert.equal(url.searchParams.get('schema'), 'ban');
assert.ok([...url.searchParams.keys()].every(key => key === 'schema')
  && url.searchParams.getAll('schema').length === 1 && !url.hash);
const client = new pg.Client({connectionString: process.env.PG_URL,
  connectionTimeoutMillis: 10000, options: '-c default_transaction_read_only=on -c statement_timeout=10000'});
await client.connect();
try {
  await client.query('BEGIN READ ONLY');
  const {rows: [identity]} = await client.query('SELECT current_database() AS db, current_user AS role');
  assert.equal(identity.db, expected);
  console.log(identity);
  await client.query('ROLLBACK');
} finally { await client.end(); }
NODE
}
```

Utiliser le port publié sur l'hôte ; ce contrôle d'identité ne remplace pas l'audit.

```sh
# Diagnostic : ne déploie aucune migration.
assert_candidate_url && \
PG_URL="$TARGET_PG_URL" pnpm --filter @ban/prisma-client exec prisma migrate status \
  --config prisma.config.ts
```

`resolve --applied` **enregistre sans exécuter le SQL** : l'utiliser uniquement
pour reconnaître une baseline contrôlée lorsque le registre est absent.
Si elle est déjà enregistrée, passer directement au déploiement après audit.
Ne pas marquer les autres migrations comme appliquées à la place de les exécuter.

```sh
# Registre absent, structure initiale et écarts documentés/approuvés uniquement.
assert_candidate_url && \
PG_URL="$TARGET_PG_URL" pnpm --filter @ban/prisma-client exec prisma migrate resolve \
  --config prisma.config.ts --applied 0000_baseline

# Seulement après revue de TOUTES les migrations en attente et de leurs dépendances.
assert_candidate_url && \
PG_URL="$TARGET_PG_URL" pnpm --filter @ban/prisma-client exec prisma migrate deploy \
  --config prisma.config.ts
```

`deploy` applique **toutes** les migrations en attente. Annoncer cible et opération,
puis journaliser. `db:bootstrap` marque la baseline et lance deploy sans cet audit :
ne pas l'utiliser aveuglément après un dump ancien. Écarter aussi `dev:infra:init`,
`migrate dev` et `migrate reset`, qui peuvent altérer ou réinitialiser une base.

## 5. Valider et préparer la bascule

Comparer avant/après tables et volumes, colonnes, contraintes, indexes et triggers.
Vérifier signatures/corps des fonctions, propriétaires/ACL, registre et empreintes
Prisma. Tester une connexion avec le rôle applicatif puis un FULL, un DIFF et
une sélection vide avec le code correspondant, sur le périmètre autorisé.
Avant de démarrer des services susceptibles d’écrire ou d’émettre des messages,
maîtriser les abonnements et notifications provenant du dump de production.

Les [tests synthétiques](../../packages/prisma-client/tests/README.md) complètent
cette validation sans couvrir toute la candidate ; mesurer les gros volumes séparément.
Faire approuver la bascule selon le [cycle local](cycle-local.md). Garder base et
sauvegardes précédentes ; le retour arrière doit aussi traiter registre Prisma et
changements de données, pas seulement les fonctions SQL.

## Références

- [Prisma 7 — baselining](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining)
- [Prisma 7 — migrate status, resolve et deploy](https://www.prisma.io/docs/orm/v7/reference/prisma-cli-reference)
