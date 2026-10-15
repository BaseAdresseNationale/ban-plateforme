# Produire une sauvegarde PostgreSQL custom

## Objectif et prérequis

Une archive custom contient structure et données : tables/historiques, fonctions,
contraintes, indexes, triggers et séquences. Rôles et binaires d'extensions se
préparent séparément ; pour les propriétaires et droits, voir le
[guide production](sauvegarde-et-reprise-production.md).

Vérifier accès, espace, montage et compatibilité des clients/serveurs PostgreSQL.
Préférer la même version majeure et tester les montées de version ; restaurer
vers une version antérieure n'est pas garanti.

`SOURCE_DATABASE` désigne la base à sauvegarder : `ban` par défaut à l'installation,
puis la base courante après bascule. Éviter les migrations concurrentes et conserver
versions du code/PostgreSQL/extensions et état Prisma avec l'archive. Utiliser
l'authentification de l'infrastructure, sans mot de passe dans les commandes.

Alternative aux commandes ci-dessous : [backup.sh](../../scripts/postgresql/README.md),
avec estimation d'espace, confirmation et `--dry-run`.

## Sauvegarde vers un fichier

`BACKUP_DIRECTORY` est dans le conteneur ; `HOST_BACKUP_DIRECTORY` est le chemin
correspondant sur l'hôte. Vérifier le montage après toute recréation du conteneur.

```sh
set -euo pipefail
POSTGRES_CONTAINER="<conteneur-source>"
PG_USERNAME="<login-postgresql>"
SOURCE_DATABASE="ban" # Adapter au nom de la base courante après une bascule.
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

`--format=custom` permet la restauration parallèle ; `--no-acl` omet les droits
pour l'usage local ; `--verbose` journalise. Passer `--no-owner` à **pg_restore** :
pg_dump l'ignore pour une archive custom. Aucun `--clean` n'est nécessaire.
`pg_dump --jobs` exige le format directory.

Utiliser des noms distincts pour les sauvegardes concurrentes : le test d'existence
ci-dessus n'est pas atomique. Relire le journal et tester une
[restauration isolée](restauration-locale.md) ; `--list` vérifie seulement la lisibilité.

## Sauvegarde vers S3

Utiliser AWS CLI v2 et un profil/rôle IAM autorisé. Préparer droits, chiffrement,
versionnement et rétention ; garder les identifiants dans le mécanisme de secrets.

### Créer un fichier puis l'envoyer

`S3_KEY` doit être nouveau : l'envoi peut écraser un objet. Renseigner l'endpoint
pour un service compatible S3 ; pour AWS, le laisser vide. Vérifier versions,
espace et identité source comme ci-dessus. Voici toutes les commandes de cette variante.

```sh
set -euo pipefail
POSTGRES_CONTAINER="<conteneur-source>"
PG_USERNAME="<login-postgresql>"
SOURCE_DATABASE="ban" # Adapter au nom de la base courante après une bascule.
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

Contrôler taille et SHA-256 après téléchargement : un ETag multipart n'est pas
forcément un MD5. Garder copie locale et journaux jusqu'à validation de l'envoi et du restore.

### Stream direct vers S3

Le streaming évite le fichier local **à l'export**. Télécharger ensuite une copie
pour l'inspecter et la restaurer en parallèle.

```sh
set -euo pipefail
POSTGRES_CONTAINER="<conteneur-source>"
PG_USERNAME="<login-postgresql>"
SOURCE_DATABASE="ban" # Adapter au nom de la base courante après une bascule.
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

`pipefail` signale l'échec de l'un des programmes ; un objet S3 peut malgré tout
rester tronqué si pg_dump échoue. Garder le journal et vérifier cet objet.
Au-delà de 50 Go, ajouter `--expected-size "<octets-attendus>"` à `aws s3 cp`.
Après téléchargement dans un nouveau fichier : `--list`, SHA-256 et restauration
de validation. `pg_restore --jobs` ne fonctionne pas sur stdin.

## Références

- [PostgreSQL 17 — pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)
- [PostgreSQL 17 — pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html)
- [AWS CLI — streaming et expected-size](https://docs.aws.amazon.com/cli/latest/reference/s3/cp.html)
