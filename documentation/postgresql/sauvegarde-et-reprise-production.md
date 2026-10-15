# Préparer une sauvegarde et une reprise de production

## Objectif et responsabilités

L'équipe autorisée prépare et répète la reprise sur une **nouvelle instance
isolée**, selon son plan d'exploitation. La bascule est une décision séparée.

Le kit contient les objets globaux du cluster et une archive custom **structure
et données** : pas de double restauration de structure. Sauvegarder/provisionner
séparément configuration serveur, réseau, secrets, binaires d'extensions et autres
services. Une reprise à un instant précis nécessite une stratégie physique/WAL.

## 1. Produire le kit avec rôles, propriétaires et droits

Vérifier accès à tous les objets/rôles, restrictions du fournisseur, versions et
volumes. Les répertoires doivent être accessibles et les fichiers nouveaux.

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

`--globals-only` inclut rôles, appartenances et tablespaces : adapter leurs chemins
sur la cible. `--roles-only` convient si les autres objets sont traités séparément.
`--no-role-passwords` exige de rétablir les secrets par le mécanisme approuvé.
Garder le kit chiffré, privé et hors Git. Les deux exports n'ont pas de snapshot
commun : coordonner les changements de droits/rôles/schéma pendant la collecte.

Préserver propriétaires et ACL/droits par défaut : **aucun `--no-acl` au dump
ou au restore, aucun `--no-owner` au restore**. Des droits omis exigent une
nouvelle sauvegarde ou une référence de droits pour les reconstituer.

Transmettre fichiers, empreintes, journaux et inventaires sous le même identifiant.
Pour [S3](sauvegarde.md#sauvegarde-vers-s3), utiliser les dumps de **cette page**,
avec ACL. Après streaming, télécharger une copie pour validation/restauration
parallèle. Tester la reprise avant de déclarer le kit utilisable.

## 2. Préparer une nouvelle instance de reprise

Les volumes ne doivent être partagés avec aucun cluster existant. Vérifier
extensions, versions, disque, réseau et secrets. Relire/adapter le SQL global :
rôles de bootstrap déjà présents, attributs et tablespaces. Ne pas ignorer les erreurs.

`--create` restaure le **nom enregistré dans l'archive**, ses ACL et paramètres :
utiliser une instance dédiée, pas `ban_postgres` ni un cluster partagé.

```sh
TARGET_CONTAINER="<nouveau-conteneur-isole>"
TARGET_ADMIN="<role-administrateur-cible>"
TARGET_BACKUP_DIRECTORY="<repertoire-du-kit-dans-le-conteneur-cible>"
GLOBALS_REVIEWED_FILENAME="<copie-relue-et-adaptee-des-globaux.sql>"
BACKUP_FILENAME="<nom-exact-de-l-archive-recue.dump>"
RESTORE_JOBS=2 # Choix d'exemple, à adapter aux ressources.

[[ "$TARGET_CONTAINER" != "$SOURCE_CONTAINER" && "$TARGET_CONTAINER" != "ban_postgres" ]]
docker exec "$TARGET_CONTAINER" psql --username="$TARGET_ADMIN" \
  --dbname=postgres --no-psqlrc --set=ON_ERROR_STOP=1 \
  --command='SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), version(); SELECT datname FROM pg_database ORDER BY datname; SELECT rolname FROM pg_roles ORDER BY rolname;'
docker exec "$TARGET_CONTAINER" pg_restore --list "$TARGET_BACKUP_DIRECTORY/$BACKUP_FILENAME"
```

Comparer empreintes/inventaire, confirmer l'absence de la base source et faire
approuver serveur, rôle et volumes. Un nom de conteneur différent ne prouve pas
l'isolation du stockage ; arrêter en cas de doute.

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
Les rôles préparés permettent d'appliquer propriétaires et ACL. Journaliser les
étapes et garder tout état partiel pour diagnostic ; aucune suppression ni `--clean`.

Pour un nom cible différent, suivre le [workflow local](restauration-locale.md),
avec traitement explicite des ACL/paramètres de base : `--no-owner --no-acl`
ne reprend pas les droits de production.

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

Basculer applications, jobs et DNS selon le plan approuvé. Garder ancienne instance
et kit pendant la fenêtre de retour arrière ; tester avec les vrais rôles applicatifs.

## Références

- [PostgreSQL 17 — pg_dumpall](https://www.postgresql.org/docs/17/app-pg-dumpall.html)
- [PostgreSQL 17 — pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)
- [PostgreSQL 17 — pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html)
