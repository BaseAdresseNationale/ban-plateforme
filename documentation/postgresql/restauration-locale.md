# Restaurer une archive custom dans une base locale isolée

## Objectif et prérequis

Installer une sauvegarde de confiance dans une **nouvelle base**, sans remplacer
la base utilisée par l'application. La source est conservée. Pour restaurer les
droits de production, suivre plutôt le [guide de reprise](sauvegarde-et-reprise-production.md).

Prévoir l'espace pour les données, indexes, fichiers temporaires et WAL, pas
seulement la taille compressée du dump. Vérifier les versions du serveur et des
clients, ainsi que la disponibilité des versions d'extensions requises par
l'archive (`postgis`, `btree_gist`). Le rôle doit pouvoir créer cette base et
les objets/extensions nécessaires ; faire préparer ces derniers par un
administrateur si ses permissions sont insuffisantes.

Une archive custom se restaure avec `pg_restore`. Un dump SQL plain text relève
de `psql` et nécessite sa propre analyse : ne pas appliquer ces commandes à un
fichier SQL. Ne pas mélanger le bootstrap applicatif avec une restauration.

## 1. Configurer et inspecter

Les chemins d'archive sont **dans le conteneur** ; les journaux sont sur l'hôte.
Le nombre de jobs est configurable. Les exemples de noms SQL sont limités à
des identifiants ASCII simples pour sécuriser leur interpolation.

```sh
set -euo pipefail
TARGET_CONTAINER="<conteneur-postgresql-local>"
RESTORE_USERNAME="<role-de-restauration>"
TARGET_DATABASE="ban_restore_new"
ARCHIVE_PATH="<chemin-dans-le-conteneur/backup.dump>"
HOST_LOG_DIRECTORY="<repertoire-local-existant>"
RESTORE_JOBS=2

require_isolated_target() {
  case "$TARGET_DATABASE" in
    ban|ban_restore_validation|postgres|template0|template1|"")
      echo "Cible protégée : arrêt" >&2; return 1 ;;
  esac
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

Comparer l'empreinte SHA-256 à celle reçue par un canal de confiance. Contrôler
les versions et schémas dans l'inventaire, le montage Docker et l'espace libre
du volume de données (`docker exec ... df -h <chemin-du-volume-de-donnees>`).
Pour inspecter le SQL d'une archive suspecte, utiliser `pg_restore --file` hors
de toute connexion cible ; l'inventaire seul ne révèle pas tout le SQL exécuté.

## 2. Créer une base neuve

Vérifier d'abord que la base est absente. Si elle existe, **arrêter** : examiner
son état et choisir un autre nom, sans la supprimer ni relancer le bootstrap.

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

La restauration locale attribue les objets au rôle de restauration et ignore
les ACL d'origine. Cela facilite l'installation sans recréer les comptes de
production ; cela ne constitue pas une reprise de leurs droits.

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

`--exit-on-error` arrête la restauration à la première erreur ; il faut aussi
vérifier le code de sortie et le journal. Un échec peut laisser une base
partiellement chargée : la conserver pour diagnostic puis décider explicitement
de la suite. Il n'y a ni `--clean` ni `--create` : la base cible est celle créée
à l'étape précédente, pas le nom d'origine enregistré dans l'archive.

### Adapter les ressources

Les contraintes d'exclusion GiST des tables historiques peuvent dominer la
durée. Leur coût reste élevé même avec plusieurs jobs. Commencer prudemment
puis adapter CPU, mémoire et I/O aux limites réelles du conteneur.

Sur une nouvelle tentative explicitement préparée, des options de session
peuvent être passées à la commande, par exemple :

```sh
# Variante de la commande précédente, pas une seconde exécution sur la même base.
RESTORE_PGOPTIONS="-c maintenance_work_mem=256MB -c work_mem=16MB"
# Remplacer « docker exec "$TARGET_CONTAINER" pg_restore » par :
# docker exec --env "PGOPTIONS=$RESTORE_PGOPTIONS" "$TARGET_CONTAINER" pg_restore ...
```

La mémoire se cumule entre opérations et connexions ; ne pas multiplier les
jobs et augmenter simultanément la mémoire sans budget global. Aucun réglage
global du serveur ni désactivation de contrainte/trigger n'est requis ici.

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

Un trigger désactivé ou une contrainte non validée doit être expliqué par
comparaison avec la source, pas corrigé automatiquement. Les séquences doivent
être cohérentes avec les identifiants chargés ; ne pas les réinitialiser à l'aveugle.

Exemple d'inventaire en lecture seule. Les comptes exacts concernent les tables
BAN principales présentes ; adapter la sélection à l'inventaire source. Les
résultats et journaux sont à garder dans le stockage de travail, hors Git.

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

Après réussite du restore, l'actualisation des statistiques est une écriture
de maintenance réservée à la cible vérifiée :

```sh
require_isolated_target
echo "ANALYZE sur $TARGET_CONTAINER / $TARGET_DATABASE"
docker exec "$TARGET_CONTAINER" psql --username="$RESTORE_USERNAME" \
  --dbname="$TARGET_DATABASE" --no-psqlrc --set=ON_ERROR_STOP=1 --command='ANALYZE;'
```

Passer ensuite à la [mise à niveau et validation applicative](mise-a-niveau-apres-restauration.md).
Tester le rôle réellement utilisé par l'application : un accès administrateur
réussi ne prouve pas les permissions du rôle applicatif. Conserver l'ancienne
configuration et la base précédente jusqu'à décision de bascule et retour arrière.

Référence : [PostgreSQL 17 — pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).
