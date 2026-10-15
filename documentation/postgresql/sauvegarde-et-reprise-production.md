# Préparer une sauvegarde et une reprise de production

## Objectif et responsabilités

L'équipe disposant des accès production prépare et répète une reprise sur une
**nouvelle instance isolée**. Ce guide complète le plan d'exploitation : il
ne déclenche ni bascule des applications ni modification de l'instance en service.

Le kit comporte un export des objets globaux du cluster et une archive custom
de la base. **La structure est déjà dans cette archive** : il n'y a pas deux
restaurations successives de la structure. Les fichiers de configuration du
serveur, règles réseau, secrets, binaires d'extensions et données des autres
services sont provisionnés/sauvegardés séparément. La sauvegarde logique ne
remplace pas une stratégie physique/WAL pour une reprise à un instant précis.

## 1. Produire le kit avec rôles, propriétaires et droits

Utiliser un compte autorisé à lire tous les objets/rôles, adapter les rôles
système aux restrictions d'un fournisseur managé et vérifier versions/volumes.
Les répertoires doivent être accessibles et les fichiers nouveaux.

```sh
set -euo pipefail
SOURCE_CONTAINER="<conteneur-source-autorise>"
SOURCE_ADMIN="<role-administrateur-source>"
SOURCE_DATABASE="<base-a-sauvegarder>"
BACKUP_DIRECTORY="<repertoire-dans-le-conteneur-source>"
HOST_BACKUP_DIRECTORY="<repertoire-correspondant-sur-l-hote>"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
GLOBALS_FILENAME="postgres-globals-$STAMP.sql"
BACKUP_FILENAME="ban-production-$STAMP.dump"

docker exec "$SOURCE_CONTAINER" psql --username="$SOURCE_ADMIN" \
  --dbname="$SOURCE_DATABASE" --no-psqlrc --set=ON_ERROR_STOP=1 \
  --command='SELECT current_database(), current_user, version(); SELECT extname, extversion FROM pg_extension;'
docker exec "$SOURCE_CONTAINER" test ! -e "$BACKUP_DIRECTORY/$GLOBALS_FILENAME"
docker exec "$SOURCE_CONTAINER" test ! -e "$BACKUP_DIRECTORY/$BACKUP_FILENAME"
docker exec "$SOURCE_CONTAINER" pg_dumpall \
  --username="$SOURCE_ADMIN" --database=postgres \
  --globals-only --no-role-passwords --verbose \
  --file="$BACKUP_DIRECTORY/$GLOBALS_FILENAME" \
  2> "$HOST_BACKUP_DIRECTORY/$GLOBALS_FILENAME.log"
docker exec "$SOURCE_CONTAINER" pg_dump \
  --username="$SOURCE_ADMIN" --dbname="$SOURCE_DATABASE" \
  --format=custom --verbose --file="$BACKUP_DIRECTORY/$BACKUP_FILENAME" \
  2> "$HOST_BACKUP_DIRECTORY/$BACKUP_FILENAME.log"
docker exec "$SOURCE_CONTAINER" pg_restore --list "$BACKUP_DIRECTORY/$BACKUP_FILENAME" \
  > "$HOST_BACKUP_DIRECTORY/$BACKUP_FILENAME.list"
shasum -a 256 "$HOST_BACKUP_DIRECTORY/$GLOBALS_FILENAME" "$HOST_BACKUP_DIRECTORY/$BACKUP_FILENAME" \
  > "$HOST_BACKUP_DIRECTORY/kit-$STAMP.sha256"
```

`--globals-only` inclut rôles, appartenances et tablespaces. Adapter les chemins
de tablespaces sur la cible ; si seuls les rôles sont requis, examiner l'option
`--roles-only` et documenter les autres objets globaux séparément.
`--no-role-passwords` impose de rétablir les secrets via le mécanisme approuvé.
Les attributs des comptes restent sensibles : conserver le kit hors Git, chiffré
et à accès restreint. Les deux exports ne partagent pas un snapshot commun de
cluster : coordonner les changements de droits, rôles et schéma pendant la collecte.

Le dump de base conserve les propriétaires et ACL/default ACL : **ne pas passer
`--no-acl`**. À la restauration, conserver aussi les propriétaires en n'utilisant
pas `--no-owner`. Une archive produite sans ACL ne permet pas de reconstituer
les droits absents : obtenir une nouvelle sauvegarde ou une référence de droits.

Transmettre les deux fichiers, empreintes, journaux et inventaires sous le même
identifiant de kit. Pour S3, suivre les principes du [guide sauvegarde](sauvegarde.md#sauvegarde-vers-s3),
en utilisant les commandes de dump de cette page qui conservent les ACL.
Le streaming nécessite également une copie téléchargée pour validation et
restauration parallèle. Tester la reprise avant de considérer le kit utilisable.

## 2. Préparer une nouvelle instance de reprise

Préparer une instance dont les volumes ne sont partagés ni avec la production
en service ni avec le cluster de développement. Vérifier extensions, versions,
capacité disque, réseau et politique des secrets. Relire le SQL global : les rôles
de bootstrap déjà présents peuvent entrer en conflit avec ses CREATE ROLE.
Préparer une copie adaptée, en examinant aussi les attributs des comptes et les
tablespaces ; ne pas ignorer globalement les erreurs.

Cette variante utilise `pg_restore --create`, qui restaure le **nom de base
enregistré dans l'archive**, ainsi que ses ACL et paramètres. C'est pourquoi
elle exige une nouvelle instance dédiée, pas `ban_postgres` ni un cluster partagé.

```sh
TARGET_CONTAINER="<nouveau-conteneur-isole>"
TARGET_ADMIN="<role-administrateur-cible>"
TARGET_BACKUP_DIRECTORY="<repertoire-du-kit-dans-le-conteneur-cible>"
GLOBALS_REVIEWED_FILENAME="<copie-relue-et-adaptee-des-globaux.sql>"
BACKUP_FILENAME="<nom-exact-de-l-archive-recue.dump>"
RESTORE_JOBS=2

[[ "$TARGET_CONTAINER" != "$SOURCE_CONTAINER" && "$TARGET_CONTAINER" != "ban_postgres" ]]
docker exec "$TARGET_CONTAINER" psql --username="$TARGET_ADMIN" \
  --dbname=postgres --no-psqlrc --set=ON_ERROR_STOP=1 \
  --command='SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), version(); SELECT datname FROM pg_database ORDER BY datname; SELECT rolname FROM pg_roles ORDER BY rolname;'
docker exec "$TARGET_CONTAINER" pg_restore --list "$TARGET_BACKUP_DIRECTORY/$BACKUP_FILENAME"
```

Comparer empreintes et inventaire au kit reçu. Confirmer l'absence de la base
source sur cette instance, inspecter les volumes et faire approuver l'identité
du serveur et le rôle cible. Un nom de conteneur différent ne prouve pas, à lui
seul, l'isolation du stockage. Ne pas poursuivre si ces conditions sont incertaines.

## 3. Restaurer les globaux puis la base

Après ces contrôles et autorisation explicite :

```sh
echo "Objets globaux puis archive sur l'instance isolée $TARGET_CONTAINER"
docker exec "$TARGET_CONTAINER" psql --username="$TARGET_ADMIN" \
  --dbname=postgres --no-psqlrc --set=ON_ERROR_STOP=1 \
  --file="$TARGET_BACKUP_DIRECTORY/$GLOBALS_REVIEWED_FILENAME"
docker exec "$TARGET_CONTAINER" pg_restore \
  --username="$TARGET_ADMIN" --dbname=postgres --create \
  --exit-on-error --jobs="$RESTORE_JOBS" --verbose \
  "$TARGET_BACKUP_DIRECTORY/$BACKUP_FILENAME"
```

`postgres` sert à la connexion initiale ; l'archive détermine la base créée.
Les propriétaires et ACL sont appliqués avec leurs rôles préalablement préparés.
Journaliser les deux étapes dans le stockage sécurisé de l'exploitation.
Un échec peut laisser un état partiel : conserver les journaux et analyser avant
toute reprise. Aucune suppression/option `--clean` n'est prévue.

Pour une restauration locale sous un nom différent, choisir le
[workflow local](restauration-locale.md), avec une politique de droits locale.
Les ACL et paramètres propres à la base d'origine nécessitent alors un traitement
explicite ; les options `--no-owner --no-acl` ne sont pas une reprise des droits.

## 4. Valider puis décider de la remise en service

- Comparer schémas/extensions, tables, volumes, fonctions, indexes, contraintes,
  triggers, séquences et historiques `tstzrange`/GiST avec les inventaires source.
- Contrôler propriétaires, GRANT, droits par défaut et appartenances de rôles.
- Réinjecter les secrets et vérifier une vraie connexion avec chaque rôle
  applicatif, ainsi que ses opérations de lecture/écriture autorisées.
- Auditer le registre Prisma et la version du code selon le
  [guide de mise à niveau](mise-a-niveau-apres-restauration.md).
- Prévoir ANALYZE et des tests fonctionnels/performance adaptés ; les historiques
  et exclusions GiST peuvent rendre la restauration longue.

La bascule des applications, jobs et DNS relève du plan de reprise validé par
l'équipe. Garder l'ancienne instance et le kit jusqu'à la fin de la fenêtre de
retour arrière. Aucun test administrateur ne remplace un test du rôle applicatif.

## Références

- [PostgreSQL 17 — pg_dumpall](https://www.postgresql.org/docs/17/app-pg-dumpall.html)
- [PostgreSQL 17 — pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)
- [PostgreSQL 17 — pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html)
