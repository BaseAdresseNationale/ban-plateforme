# Template de workflow Prisma migrations

## 0) Pré-requis

- Être en repo root: `cd path/to/project/`
- Avoir `.env` avec `PG_URL` rempli.
- `pnpm` installé.

## 1) Identifier le prochain numéro de migration

- Aller dans `packages/prisma-client/prisma/migrations`
- Le format attendu est : `0000_xxx`, `0001_xxx`, ...
- Prendre le prochain numéro non utilisé (ex. après `0005_...`, utiliser `0006_...`.

## 2) Créer la migration

- Créer un dossier :
  - `packages/prisma-client/prisma/migrations/0006_<nom_kebab>`
- Ajouter `migration.sql` avec le SQL exact à exécuter.
- Exemple :

```bash
mkdir -p packages/prisma-client/prisma/migrations/0006_add_xxx
cat > packages/prisma-client/prisma/migrations/0006_add_xxx/migration.sql <<'SQL'
-- Add your SQL here
SQL
```

## 3) Exemple de contenu SQL (structure)

- Toujours commencer par un commentaire bref :

```sql
-- Description courte
```

- Ensuite uniquement le SQL idempotent nécessaire:

```sql
CREATE FUNCTION ...;
ALTER TABLE ...;
CREATE INDEX ...;
DROP FUNCTION IF EXISTS ...;
```

## 4) Validation locale rapide

- Vérifier l’ordre :
  - `0000_baseline` -> `0001_...` -> `0002_...` -> ...
- Valider le SQL (syntaxe, dépendances, permissions).
- Vérifier que les noms sont en snake_case/kebab-case dans le nom de dossier.

## 5) Déployer

- Génération Prisma client (si besoin) :

```bash
pnpm run db:generate
```

- Déploiement des migrations :

```bash
pnpm --filter @ban/prisma-client run prisma:migrate:deploy
```

- Vérification état :

```bash
pnpm --filter @ban/prisma-client run prisma:migrate:status -- --config prisma.config.ts
```

## 6) Bonnes pratiques

- Utiliser un SQL autonome et ordonné (pas de dépendances implicites).
- Préférer `IF NOT EXISTS` / `DROP FUNCTION IF EXISTS` uniquement si répétabilité voulue.
- Éviter de modifier directement `schema.prisma` si tu utilises ces fonctions SQL (non gérées par Prisma DMMF).
- Ajouter un petit commentaire de contexte en haut du `migration.sql`.

## 7) Template prêt à copier (nom de fichier)

`packages/prisma-client/prisma/migrations/000X_<description>/migration.sql`

- `000X` : nombre à 4 chiffres, incrémenté.
- `<description>` : court et en kebab-case.
- Exemple réel:
  - `0006_add_metrics_indexes_for_diff`
