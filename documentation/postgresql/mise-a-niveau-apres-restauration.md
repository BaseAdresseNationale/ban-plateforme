# Vérifier et mettre à niveau une base restaurée

## Objectif

Faire correspondre une base restaurée à une version précise du dépôt, sans
rejeter les objets historiques utiles ni perdre les droits attendus. La mise à
niveau se prépare sur une candidate isolée ; elle n'est pas une seconde
restauration et n'implique pas de basculer l'application.

## 1. Vérifier la cible et conserver un état de référence

Identifier commit/tag de l'application, version PostgreSQL et extensions,
provenance du dump, rôle et base cible. Arrêter les écrivains sur cette candidate.
Conserver une sauvegarde validée et les définitions/propriétaires/ACL des objets
qui seront modifiés, ainsi que la configuration précédente.

Effectuer l'audit sur la cible explicitement choisie, avec des sessions
`BEGIN READ ONLY` : colonnes/types/defaults, contraintes, indexes, triggers,
fonctions et signatures, droits et `_prisma_migrations` si elle existe.
`pg_get_functiondef` et `pg_get_constraintdef` permettent d'inventorier les
définitions réelles. La présence d'un nom de fonction ne valide pas son corps.

Ne pas afficher ni committer d'URL contenant des secrets. `PG_URL` est utilisée
par le client Prisma et son pool ; `PG_DB` ne suffit pas à la modifier. Vérifier
la même cible via la connexion SQL et l'URL transmise à Prisma.

## 2. Examiner les migrations et leur registre

Le dépôt versionne les migrations dans
[`packages/prisma-client/prisma/migrations`](../../packages/prisma-client/prisma/migrations).
Comparer noms et empreintes SHA-256 des fichiers au registre restauré. Examiner
les migrations inachevées ou marquées annulées ; une empreinte différente exige
une analyse avant toute action, pas une correction manuelle du registre.

| Situation | Suite |
| --- | --- |
| Registre présent, migrations et structure cohérentes | Examiner les migrations en attente et leurs prérequis. |
| Structure déjà présente, registre absent/incomplet | Auditer chaque migration ; préparer une baseline et une reprise du registre. |
| Fonctions manquantes, empreintes différentes ou structure divergente | Arrêter le déploiement automatique et préparer un plan mainteneur spécifique. |

`migrate status` est un outil de diagnostic et peut retourner un code non nul
pour des migrations en attente ou un historique divergent. Il ne valide pas
l'équivalence de tout le schéma réel avec les fichiers du dépôt.

## 3. Prérequis propres à ce dépôt

Les migrations actuelles ne doivent pas être présentées comme une reconstruction
autonome garantie de toutes les versions historiques de BAN :

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

Si une candidate ne fournit pas les helpers requis, **ne pas lancer deploy**.
Obtenir des définitions de référence relues, préparer leur versionnement et
leur ordre d'installation, puis tester le plan sur une copie isolée. Le petit
bootstrap de `packages/prisma-client/tests/support/` sert uniquement aux tests :
il ne doit pas être utilisé pour réparer une base métier.

Les migrations `0001` peuvent construire des indexes coûteux ; `0002` à `0006`
installent/ajustent les fonctions d'export ; `0007` à `0009` optimisent leurs
requêtes. Consulter le [guide des tests de performance](../../packages/prisma-client/tests/README-performance.md)
pour les prérequis et retours arrière des optimisations.

## 4. Appliquer uniquement le plan validé

Les commandes suivantes sont conditionnelles : leur cible doit être la candidate
isolée auditée, et le rôle doit posséder les droits requis. La configuration
Prisma est [`prisma.config.ts`](../../packages/prisma-client/prisma.config.ts).
Préparer `TARGET_PG_URL` en mémoire via le mécanisme local de secrets ; ne pas
coller une URL avec mot de passe dans un terminal enregistré ou dans Git.

Pour cette procédure locale, vérifier l'URL avant **chaque** commande Prisma.
Renseigner `TARGET_DATABASE` avec le nom de la nouvelle base auditée ; le garde-fou
ci-dessous exige une connexion locale et la même base des deux côtés.

```sh
set -euo pipefail
TARGET_DATABASE="ban_restore_new"
: "${TARGET_PG_URL:?Configurer TARGET_PG_URL via le mécanisme local de secrets}"

assert_candidate_url() {
  PG_URL="$TARGET_PG_URL" TARGET_DATABASE="$TARGET_DATABASE" node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import pg from 'pg';
const expected = process.env.TARGET_DATABASE;
const url = new URL(process.env.PG_URL);
assert.ok(/^[a-z_][a-z0-9_]{0,62}$/.test(expected));
assert.ok(!['ban', 'ban_restore_validation', 'postgres', 'template0', 'template1'].includes(expected));
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

L'URL utilise le port publié sur la machine hôte. Cette vérification valide
l'identité, pas la compatibilité du schéma : l'audit précédent reste requis.

```sh
# Diagnostic : ne déploie aucune migration.
assert_candidate_url && \
PG_URL="$TARGET_PG_URL" pnpm --filter @ban/prisma-client exec prisma migrate status \
  --config prisma.config.ts
```

Un `migrate resolve --applied` **enregistre** une migration sans exécuter son SQL.
Il n'est autorisé qu'après démonstration de son application réelle ou de
l'équivalence de la baseline. Il modifie le registre et ne doit pas servir à
masquer une migration manquante ou échouée.

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

`deploy` applique les migrations en attente ; il ne choisit pas arbitrairement
une seule migration. Chaque opération doit être annoncée avec sa cible et
journalisée. Le script `db:bootstrap` marque la baseline puis lance deploy ;
il ne fait pas cet audit à votre place. Ne pas l'exécuter aveuglément après un
dump ancien. Éviter aussi `dev:infra:init`, `migrate dev` ou `migrate reset` pour
adapter une base restaurée : leurs objectifs sont différents et certains peuvent
réinitialiser ou altérer une base.

## 5. Valider et préparer la bascule

Comparer avant/après tables et volumes, colonnes, contraintes, indexes et triggers.
Vérifier signatures/corps des fonctions, propriétaires/ACL, registre et empreintes
Prisma. Tester une connexion avec le rôle applicatif puis un FULL, un DIFF et
une sélection vide avec le code correspondant, sur le périmètre autorisé.

Les [tests PostgreSQL synthétiques](../../packages/prisma-client/tests/README.md)
et leurs suites d'équivalence sont un complément : ils ne valident pas une
candidate entière ni toutes ses données. Mesurer séparément les gros volumes.

Une fois la candidate validée, faire approuver la bascule des services et la
fenêtre de retour arrière. Garder les sauvegardes et la base précédente. Une
annulation SQL de fonctions ne rétablit pas automatiquement le registre Prisma ;
inclure ce registre et les changements de données dans le plan de retour arrière.

## Références

- [Prisma 7 — baselining](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining)
- [Prisma 7 — migrate status, resolve et deploy](https://www.prisma.io/docs/orm/v7/reference/prisma-cli-reference)
