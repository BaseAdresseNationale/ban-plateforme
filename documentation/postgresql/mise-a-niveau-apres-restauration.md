# Vérifier et mettre à niveau une base restaurée

## Objectif

Adapter une candidate isolée à une version du dépôt, en préservant historiques
et droits. La bascule applicative reste une étape séparée.

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

Le dépôt versionne les migrations dans
[`packages/prisma-client/prisma/migrations`](../../packages/prisma-client/prisma/migrations).
Comparer noms et SHA-256 au registre restauré. Analyser les empreintes différentes
et migrations inachevées/annulées avant toute action ; ne pas masquer une divergence.

| Situation | Suite |
| --- | --- |
| Registre présent, migrations et structure cohérentes | Examiner les migrations en attente et leurs prérequis. |
| Structure déjà présente, registre absent/incomplet | Auditer chaque migration ; préparer une baseline et une reprise du registre. |
| Fonctions manquantes, empreintes différentes ou structure divergente | Arrêter le déploiement automatique et préparer un plan mainteneur spécifique. |

`migrate status` peut retourner un code non nul pour des migrations en attente
ou un historique divergent ; il ne prouve pas l'équivalence du schéma réel.

## 3. Prérequis propres à ce dépôt

Points à vérifier avant tout déploiement :

- `0000_baseline` crée des tables et indexes ; elle ne reproduit pas toute
  l'historisation, les extensions et les exclusions nécessaires aux dumps BAN.
  Son schéma SQL doit être relu avec le `search_path` et la structure restaurée.
- `0006` et `0009` appellent `ban.export_line_meta`,
  `ban.merge_export_line_meta` et `ban.snapshot_district_cog`, dont les définitions
  de création ne sont pas versionnées dans la chaîne des migrations actuelle.
- Les wrappers de `0003` et `0005` ne décrivent pas à eux seuls toutes les
  variantes de métadonnées rencontrées dans les bases utilisées par l'application.
- `0006` remplace certaines signatures et supprime/recrée des fonctions : vérifier
  dépendances, propriétaires et GRANT, pas seulement les résultats métier.

Si les fonctions auxiliaires requises manquent, **ne pas lancer deploy**. Obtenir
leurs définitions relues, versionner l'installation et tester sur copie isolée.
Le bootstrap de `packages/prisma-client/tests/support/` est réservé aux tests,
pas à la réparation d'une base métier.

Les migrations `0001` peuvent construire des indexes coûteux ; `0002` à `0006`
installent/ajustent les fonctions d'export ; `0007` à `0009` optimisent leurs
requêtes. Consulter le [guide des tests de performance](../../packages/prisma-client/tests/README-performance.md)
pour les prérequis et retours arrière des optimisations.

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
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
assert.equal(decodeURIComponent(url.pathname.slice(1)), expected);
const client = new pg.Client({connectionString: process.env.PG_URL});
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
après preuve d'application ou d'équivalence de la baseline, jamais pour masquer un échec.

```sh
# Exemple : seulement si l'équivalence de 0000 a été démontrée et approuvée.
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

Les [tests synthétiques](../../packages/prisma-client/tests/README.md) complètent
cette validation sans couvrir toute la candidate ; mesurer les gros volumes séparément.
Faire approuver la bascule selon le [cycle local](cycle-local.md). Garder base et
sauvegardes précédentes ; le retour arrière doit aussi traiter registre Prisma et
changements de données, pas seulement les fonctions SQL.

## Références

- [Prisma 7 — baselining](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining)
- [Prisma 7 — migrate status, resolve et deploy](https://www.prisma.io/docs/orm/v7/reference/prisma-cli-reference)
