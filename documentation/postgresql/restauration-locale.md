# Restaurer une archive custom dans une base locale isolée

## Objectif et prérequis

Restaurer une archive custom de confiance dans une **nouvelle base**, en conservant
la base applicative. Pour les droits de production, suivre le
[guide de reprise](sauvegarde-et-reprise-production.md).

Vérifier versions clients/serveur, extensions (`postgis`, `btree_gist`), espace
données/index/temporaires/WAL et droits de création du rôle. Faire préparer les
extensions par un administrateur si nécessaire. Un dump SQL plain text demande
une procédure `psql` distincte ; ne pas utiliser le bootstrap applicatif ici.

## Variante avec les scripts

Les [outils locaux](../../scripts/postgresql/README.md) affichent cibles,
ressources et espace requis estimé, puis demandent confirmation par défaut.
`--dry-run` n'écrit rien ; `-y` accepte la confirmation sans lever les protections.

```sh
CURRENT_DATABASE="ban" # Nom réellement utilisé par les services, à vérifier dans leur configuration.
TARGET_DATABASE="ban_restore" # Exemple ; préférer un suffixe daté pour distinguer les générations.
bash scripts/postgresql/restore.sh --current "$CURRENT_DATABASE" \
  --target "$TARGET_DATABASE" --archive /backups/backup.dump --dry-run
# Après lecture du bilan : même commande sans --dry-run pour demander la confirmation.
```

Choisir **les scripts ou les commandes manuelles**, jamais les deux sur une même
cible. Voir le [cycle local](cycle-local.md) pour l'impact machine et la bascule.

## 1. Configurer et inspecter

Archive **dans le conteneur**, journaux sur l'hôte ; noms SQL ASCII simples.
`RESTORE_JOBS=2` est un choix d'exemple, modifiable selon les ressources.

```sh
set -euo pipefail
TARGET_CONTAINER="<conteneur-postgresql-local>"
RESTORE_USERNAME="<role-de-restauration>"
CURRENT_DATABASE="ban"
TARGET_DATABASE="ban_restore"
ARCHIVE_PATH="<chemin-dans-le-conteneur/backup.dump>"
HOST_LOG_DIRECTORY="<repertoire-local-existant>"
RESTORE_JOBS=2

require_isolated_target() {
  case "$TARGET_DATABASE" in
    ban|postgres|template0|template1|"")
      echo "Cible protégée : arrêt" >&2; return 1 ;;
  esac
  [[ "$CURRENT_DATABASE" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || return 1
  [[ "$TARGET_DATABASE" != "$CURRENT_DATABASE" ]] || { echo "Base applicative protégée" >&2; return 1; }
  [[ "$TARGET_DATABASE" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || return 1
  [[ "$RESTORE_USERNAME" =~ ^[a-z_][a-z0-9_]{0,62}$ ]]
}
require_isolated_target
docker exec "$TARGET_CONTAINER" test -r "$ARCHIVE_PATH"
docker exec "$TARGET_CONTAINER" pg_restore --version
docker exec "$TARGET_CONTAINER" pg_restore --list "$ARCHIVE_PATH"
docker exec "$TARGET_CONTAINER" psql --username="$RESTORE_USERNAME" \
  --dbname=postgres --no-psqlrc --set=ON_ERROR_STOP=1 \
  --command="SELECT current_database(), current_user, version(); SELECT datname FROM pg_database ORDER BY datname; SELECT name, default_version FROM pg_available_extensions WHERE name IN ('postgis', 'btree_gist');"
```

Comparer le SHA-256 reçu par un canal de confiance, contrôler l'inventaire et
l'espace (`docker exec ... df -h <volume-de-donnees>`). Pour examiner le SQL,
utiliser `pg_restore --file` hors connexion cible : l'inventaire ne montre pas tout.

## 2. Créer une base neuve

Si la cible existe, **arrêter** et choisir un autre nom, sans suppression.

```sh
require_isolated_target
EXISTS=$(docker exec "$TARGET_CONTAINER" psql --username="$RESTORE_USERNAME" \
  --dbname=postgres --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --command="SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname='$TARGET_DATABASE');")
[[ "$EXISTS" == "f" ]] || { echo "Base déjà présente : arrêt" >&2; exit 1; }
echo "Création de $TARGET_DATABASE dans $TARGET_CONTAINER, connexion administrative postgres"
docker exec "$TARGET_CONTAINER" psql --username="$RESTORE_USERNAME" \
  --dbname=postgres --no-psqlrc --set=ON_ERROR_STOP=1 \
  --command="CREATE DATABASE \"$TARGET_DATABASE\" OWNER \"$RESTORE_USERNAME\" TEMPLATE template0;"
```

## 3. Restaurer

Ce profil attribue les objets au rôle de restauration et ignore les ACL d'origine.
Il facilite l'installation locale, sans reprendre les droits de production.

```sh
require_isolated_target
CONNECTED_DATABASE=$(docker exec "$TARGET_CONTAINER" psql --username="$RESTORE_USERNAME" \
  --dbname="$TARGET_DATABASE" --no-psqlrc --set=ON_ERROR_STOP=1 \
  --tuples-only --no-align --command='SELECT current_database();')
[[ "$CONNECTED_DATABASE" == "$TARGET_DATABASE" ]]
echo "Restauration dans $TARGET_CONTAINER / $TARGET_DATABASE uniquement"
docker exec "$TARGET_CONTAINER" pg_restore \
  --username="$RESTORE_USERNAME" --dbname="$TARGET_DATABASE" \
  --no-owner --no-acl --exit-on-error --jobs="$RESTORE_JOBS" --verbose \
  "$ARCHIVE_PATH" > "$HOST_LOG_DIRECTORY/$TARGET_DATABASE-restore.log" 2>&1
```

`--exit-on-error` arrête à la première erreur. Vérifier sortie et journal ; garder
toute cible partielle pour diagnostic. Sans `--clean`/`--create`, la restauration
vise la base créée ci-dessus, pas le nom enregistré dans l'archive.

### Adapter les ressources

Les exclusions GiST historiques peuvent dominer la durée malgré les jobs.
Sur une nouvelle tentative préparée, adapter les sessions aux ressources Docker :

```sh
# Variante de la commande précédente, pas une seconde exécution sur la même base.
RESTORE_PGOPTIONS="-c maintenance_work_mem=256MB -c work_mem=16MB"
# Remplacer « docker exec "$TARGET_CONTAINER" pg_restore » par :
# docker exec --env "PGOPTIONS=$RESTORE_PGOPTIONS" "$TARGET_CONTAINER" pg_restore ...
```

La mémoire se cumule entre opérations et connexions : évaluer la consommation
totale avant d'augmenter jobs et mémoire. Garder contraintes et triggers actifs.

## 4. Contrôler avant utilisation

Sur la seule cible vérifiée, relever et comparer à la sauvegarde :

- Schémas et extensions/version : `pg_namespace`, `pg_extension`.
- Tables, tailles et nombre exact de lignes des principales tables ; un
  `count(*)` sur de grosses tables historiques peut être long.
- Tables `ban.address`, `address_h`, `common_toponym`, `common_toponym_h`,
  `district`, `district_h` et tables de configuration si présentes dans la source.
- Contraintes non validées (`pg_constraint.convalidated`), indexes non valides
  (`pg_index.indisvalid`), triggers (`pg_trigger.tgenabled`) et séquences.
- Plages `tstzrange`, indexes GiST et contraintes d'exclusion des historiques.
- Fonctions, propriétaires/droits locaux et registre des migrations Prisma.

Comparer les anomalies à la source avant toute correction ; vérifier les séquences
sans réinitialisation aveugle. Exemple d'inventaire en lecture seule, avec comptes
exacts des tables BAN présentes : conserver résultats et journaux hors Git.

```sh
require_isolated_target
docker exec -i "$TARGET_CONTAINER" psql --username="$RESTORE_USERNAME" \
  --dbname="$TARGET_DATABASE" --no-psqlrc --set=ON_ERROR_STOP=1 --file=- <<'SQL'
BEGIN READ ONLY;
SELECT current_database(), current_user;
SELECT nspname FROM pg_namespace
  WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema' ORDER BY 1;
SELECT extname, extversion FROM pg_extension ORDER BY 1;
SELECT schemaname, relname,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
  FROM pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;
SELECT format('SELECT %L AS table_name, count(*) AS rows FROM %I.%I;',
              schemaname || '.' || tablename, schemaname, tablename)
  FROM pg_tables WHERE schemaname = 'ban' AND tablename IN
    ('address','address_h','common_toponym','common_toponym_h',
     'district','district_h','district_config','district_config_h')
  ORDER BY tablename
\gexec
SELECT conrelid::regclass AS relation, conname, convalidated,
       pg_get_constraintdef(oid) AS definition
  FROM pg_constraint WHERE connamespace = 'ban'::regnamespace ORDER BY 1, 2;
SELECT i.indrelid::regclass AS relation, i.indexrelid::regclass AS index_name,
       i.indisvalid, i.indisready, pg_get_indexdef(i.indexrelid)
  FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid
  WHERE t.relnamespace = 'ban'::regnamespace ORDER BY 1, 2;
SELECT t.tgrelid::regclass AS relation, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid)
  FROM pg_trigger t JOIN pg_class r ON r.oid = t.tgrelid
  WHERE r.relnamespace = 'ban'::regnamespace AND NOT t.tgisinternal ORDER BY 1, 2;
SELECT schemaname, sequencename, sequenceowner, last_value
  FROM pg_sequences WHERE schemaname = 'ban';
SELECT p.oid::regprocedure AS signature, pg_get_userbyid(p.proowner) AS owner, p.proacl
  FROM pg_proc p WHERE p.pronamespace = 'ban'::regnamespace ORDER BY 1;
SELECT to_regclass('ban._prisma_migrations'), to_regclass('public._prisma_migrations');
COMMIT;
SQL
```

Après réussite, actualiser les statistiques sur la cible vérifiée :

```sh
require_isolated_target
echo "ANALYZE sur $TARGET_CONTAINER / $TARGET_DATABASE"
docker exec "$TARGET_CONTAINER" psql --username="$RESTORE_USERNAME" \
  --dbname="$TARGET_DATABASE" --no-psqlrc --set=ON_ERROR_STOP=1 --command='ANALYZE;'
```

Poursuivre avec la [mise à niveau et les tests applicatifs](mise-a-niveau-apres-restauration.md),
avec le vrai rôle applicatif. Garder base et configuration précédentes pour le retour arrière.

Référence : [PostgreSQL 17 — pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).
