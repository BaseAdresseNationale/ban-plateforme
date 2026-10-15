# Produire une sauvegarde PostgreSQL custom

## Objectif et prérequis

Une archive custom contient la structure et les données d'une base : schémas,
extensions déclarées, tables, historiques, fonctions, contraintes, indexes,
triggers et séquences. Elle se restaure avec `pg_restore` et peut être inspectée
ou restaurée sélectivement. Les rôles et binaires d'extensions sont à préparer
séparément ; suivre le [guide production](sauvegarde-et-reprise-production.md)
pour conserver les propriétaires et droits de l'environnement d'origine.

Vérifier les accès de lecture, les clients PostgreSQL, le montage des backups et
l'espace libre. Utiliser un `pg_dump` compatible avec le serveur source et un
`pg_restore` capable de lire l'archive. Préférer la même version majeure pour
une procédure reproductible ; tester toute montée de version. Une restauration
vers une version majeure antérieure n'est pas garantie.

`SOURCE_DATABASE` est la base à sauvegarder : production autorisée, base locale
ou intermédiaire. Éviter les migrations concurrentes pendant la collecte.
Conserver la version du code, les versions PostgreSQL/extensions et l'état du
registre Prisma avec la sauvegarde. L'authentification utilise le mécanisme
autorisé de l'infrastructure ; aucun mot de passe n'est à ajouter aux commandes.

## Sauvegarde vers un fichier

`BACKUP_DIRECTORY` est un chemin dans le conteneur, correspondant à un volume
ou bind mount durable côté hôte. Vérifier un montage temporaire après chaque
recréation du conteneur ; ne pas supposer que `/backups` existe encore.

```sh
set -euo pipefail
POSTGRES_CONTAINER="<conteneur-source>"
PG_USERNAME="<login-postgresql>"
SOURCE_DATABASE="<base-a-sauvegarder>"
BACKUP_DIRECTORY="<repertoire-dans-le-conteneur>"
HOST_BACKUP_DIRECTORY="<repertoire-correspondant-sur-l-hote>"
BACKUP_FILENAME="ban-$(date -u +%Y-%m-%dT%H%M%SZ).dump"

docker exec "$POSTGRES_CONTAINER" pg_dump --version
docker exec "$POSTGRES_CONTAINER" pg_restore --version
docker exec "$POSTGRES_CONTAINER" df -h "$BACKUP_DIRECTORY"
docker exec "$POSTGRES_CONTAINER" psql --username="$PG_USERNAME" \
  --dbname="$SOURCE_DATABASE" --no-psqlrc --set=ON_ERROR_STOP=1 \
  --command='SELECT current_database(), current_user, version(); SELECT extname, extversion FROM pg_extension;'
docker exec "$POSTGRES_CONTAINER" test ! -e "$BACKUP_DIRECTORY/$BACKUP_FILENAME"

docker exec "$POSTGRES_CONTAINER" pg_dump \
  --username="$PG_USERNAME" --dbname="$SOURCE_DATABASE" \
  --format=custom --no-acl --verbose \
  --file="$BACKUP_DIRECTORY/$BACKUP_FILENAME" \
  2> "$HOST_BACKUP_DIRECTORY/$BACKUP_FILENAME.log"

docker exec "$POSTGRES_CONTAINER" pg_restore \
  --list "$BACKUP_DIRECTORY/$BACKUP_FILENAME" \
  > "$HOST_BACKUP_DIRECTORY/$BACKUP_FILENAME.list"
shasum -a 256 "$HOST_BACKUP_DIRECTORY/$BACKUP_FILENAME" \
  > "$HOST_BACKUP_DIRECTORY/$BACKUP_FILENAME.sha256"
```

`--format=custom` choisit l'archive ; `--no-acl` omet les GRANT/REVOKE pour le
workflow local portable ; `--verbose` alimente le journal. `--no-owner` se passe
à **pg_restore** : il est ignoré par pg_dump pour une archive custom. Les exemples
ne demandent aucun nettoyage préalable (`--clean`). Le format custom permet une
restauration parallèle ; un export `pg_dump --jobs` utilise le format directory.

La vérification d'existence évite un écrasement accidentel en utilisation
séquentielle ; coordonner les sauvegardes concurrentes avec des noms distincts.
Relire les avertissements du journal. `pg_restore --list` contrôle la lisibilité
et l'inventaire, pas la restauration complète : réaliser la
[restauration isolée](restauration-locale.md) avant de déclarer l'archive validée.

## Sauvegarde vers S3

Utiliser AWS CLI v2 et un profil ou rôle IAM autorisé sur le préfixe retenu.
Les identifiants restent dans le gestionnaire de secrets ou le mécanisme IAM.
Préparer les droits, le chiffrement, le versionnement et la rétention du bucket.

### Créer un fichier puis l'envoyer

Le bloc rappelle toutes les variables et commandes de cette variante. `S3_KEY`
doit être nouveau : `aws s3 cp` peut remplacer un objet existant. Pour un service
compatible S3, renseigner son endpoint ; pour AWS, laisser cette variable vide.
Vérifier versions, espace et identité de la source comme dans la rubrique fichier.

```sh
set -euo pipefail
POSTGRES_CONTAINER="<conteneur-source>"
PG_USERNAME="<login-postgresql>"
SOURCE_DATABASE="<base-a-sauvegarder>"
BACKUP_DIRECTORY="<repertoire-dans-le-conteneur>"
HOST_BACKUP_DIRECTORY="<repertoire-correspondant-sur-l-hote>"
BACKUP_FILENAME="ban-$(date -u +%Y-%m-%dT%H%M%SZ).dump"
AWS_PROFILE="" # Renseigner un profil nommé ou laisser vide pour le mécanisme IAM courant.
AWS_REGION="<region>"
S3_BUCKET="<bucket>"
S3_KEY="backups/$BACKUP_FILENAME"
S3_ENDPOINT_URL=""
S3_OPTIONS=(--region "$AWS_REGION")
if [[ -n "$AWS_PROFILE" ]]; then S3_OPTIONS+=(--profile "$AWS_PROFILE"); fi
if [[ -n "$S3_ENDPOINT_URL" ]]; then S3_OPTIONS+=(--endpoint-url "$S3_ENDPOINT_URL"); fi

docker exec "$POSTGRES_CONTAINER" test ! -e "$BACKUP_DIRECTORY/$BACKUP_FILENAME"
docker exec "$POSTGRES_CONTAINER" pg_dump \
  --username="$PG_USERNAME" --dbname="$SOURCE_DATABASE" \
  --format=custom --no-acl --verbose \
  --file="$BACKUP_DIRECTORY/$BACKUP_FILENAME" \
  2> "$HOST_BACKUP_DIRECTORY/$BACKUP_FILENAME.log"
docker exec "$POSTGRES_CONTAINER" pg_restore \
  --list "$BACKUP_DIRECTORY/$BACKUP_FILENAME" \
  > "$HOST_BACKUP_DIRECTORY/$BACKUP_FILENAME.list"
shasum -a 256 "$HOST_BACKUP_DIRECTORY/$BACKUP_FILENAME" \
  > "$HOST_BACKUP_DIRECTORY/$BACKUP_FILENAME.sha256"
aws s3 cp "$HOST_BACKUP_DIRECTORY/$BACKUP_FILENAME" "s3://$S3_BUCKET/$S3_KEY" "${S3_OPTIONS[@]}"
aws s3 cp "$HOST_BACKUP_DIRECTORY/$BACKUP_FILENAME.sha256" "s3://$S3_BUCKET/$S3_KEY.sha256" "${S3_OPTIONS[@]}"
aws s3api head-object --bucket "$S3_BUCKET" --key "$S3_KEY" "${S3_OPTIONS[@]}"
```

Contrôler taille et empreinte après téléchargement ; un ETag multipart n'est pas
nécessairement le MD5 du fichier. Conserver journaux, inventaire et copie locale
tant que l'envoi et la restauration de validation ne sont pas confirmés.

### Stream direct vers S3

Le streaming évite le fichier d'archive temporaire **à l'export**. La sortie
standard de pg_dump alimente AWS CLI ; le journal reste sur stderr. Il faut
ensuite télécharger une copie pour l'inspecter et la restaurer en parallèle.

```sh
set -euo pipefail
POSTGRES_CONTAINER="<conteneur-source>"
PG_USERNAME="<login-postgresql>"
SOURCE_DATABASE="<base-a-sauvegarder>"
HOST_LOG_DIRECTORY="<repertoire-local-existant>"
BACKUP_FILENAME="ban-$(date -u +%Y-%m-%dT%H%M%SZ).dump"
AWS_PROFILE="" # Renseigner un profil nommé ou laisser vide pour le mécanisme IAM courant.
AWS_REGION="<region>"
S3_BUCKET="<bucket>"
S3_KEY="backups/$BACKUP_FILENAME"
S3_ENDPOINT_URL=""
S3_OPTIONS=(--region "$AWS_REGION")
if [[ -n "$AWS_PROFILE" ]]; then S3_OPTIONS+=(--profile "$AWS_PROFILE"); fi
if [[ -n "$S3_ENDPOINT_URL" ]]; then S3_OPTIONS+=(--endpoint-url "$S3_ENDPOINT_URL"); fi

docker exec "$POSTGRES_CONTAINER" pg_dump \
  --username="$PG_USERNAME" --dbname="$SOURCE_DATABASE" \
  --format=custom --no-acl --verbose \
  2> "$HOST_LOG_DIRECTORY/$BACKUP_FILENAME.log" \
| aws s3 cp - "s3://$S3_BUCKET/$S3_KEY" "${S3_OPTIONS[@]}"
aws s3api head-object --bucket "$S3_BUCKET" --key "$S3_KEY" "${S3_OPTIONS[@]}"
```

`pipefail` propage un échec de l'un des deux programmes. Un upload terminé peut
néanmoins contenir un dump tronqué si pg_dump a échoué : conserver le journal et
contrôler tout objet laissé après un échec avant de le déclarer valide.
Pour un flux supérieur à 50 Go, ajouter `--expected-size "<octets-attendus>"`
à `aws s3 cp` selon la taille attendue et les limites multipart du service.

Après téléchargement vers un fichier nouveau : `pg_restore --list`, empreinte
SHA-256 et répétition de restauration. Une lecture S3 sur stdin ne convient pas
à une restauration `pg_restore --jobs` parallèle.

## Références

- [PostgreSQL 17 — pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)
- [PostgreSQL 17 — pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html)
- [AWS CLI — streaming et expected-size](https://docs.aws.amazon.com/cli/latest/reference/s3/cp.html)
