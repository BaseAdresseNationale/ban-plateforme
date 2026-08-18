# @ban/ban-core-exporter

Microservice charge de traiter les demandes d'export de donnees BAN.

Il consomme les commandes `export.requested`, genere un fichier NDJSON, stocke le fichier localement ou sur S3, puis met a jour le statut de la demande dans `ban.job_status`.

## Flux

```text
ban-core-api
  publie export.requested -> ban.commands
        │
        ▼
ban-core-exporter
  consomme ban.exporter
  genere tmp/exports/<token>.<type>.<format>.ndjson
  stocke le fichier localement ou sur S3
  met a jour ban.job_status
  publie export.completed ou export.failed -> ban.events
```

## Messages RabbitMQ

Le service consomme :

- `export.requested`

Le service publie :

- `export.completed`
- `export.failed`

La topologie RabbitMQ globale est documentee dans [../../RABBITMQ.md](../../RABBITMQ.md).

## Stockage

Le moteur genere toujours un fichier temporaire local avant stockage.

Par defaut en developpement, le fichier est cree dans :

```text
apps/ban-core-exporter/tmp/exports/
```

Ce dossier est ignore par Git.

### Stockage S3

Pour envoyer les fichiers vers S3 ou MinIO :

```env
EXPORT_STORAGE=s3
EXPORT_S3_BUCKET=ban-exports
EXPORT_S3_ENDPOINT=http://localhost:9000
EXPORT_S3_REGION=us-east-1
EXPORT_S3_ACCESS_KEY_ID=minioadmin
EXPORT_S3_SECRET_ACCESS_KEY=minioadmin
EXPORT_S3_PREFIX=exports
EXPORT_S3_FORCE_PATH_STYLE=true
```

En developpement local, `docker-compose.dev.ban.yml` demarre MinIO :

- API S3 : `http://localhost:9000`
- Console : [http://localhost:9002](http://localhost:9002)
- Bucket par defaut : `ban-exports`

### Stockage local

Pour conserver uniquement les fichiers locaux :

```env
EXPORT_STORAGE=local
```

Sans configuration S3 complete, le traitement d'export echoue en production. Hors production, le service conserve le fichier localement et journalise un warning.

## Statuts

Le service met a jour `ban.job_status` :

- `processing` lorsque le traitement commence ;
- `success` lorsque le fichier est genere et stocke ;
- `error` en cas d'echec.

Le rapport final contient notamment :

- `params` : parametres de la demande ;
- `stats` : compteurs par type de donnees ;
- `count` : nombre total de lignes exportees ;
- `output` : destination du fichier local ou S3.

Le rapport est consultable via :

```text
GET {API_BASE_URL}/api/reports/exports/{token}
```

## Commandes utiles

```bash
pnpm --filter @ban/ban-core-exporter dev
pnpm --filter @ban/ban-core-exporter test
pnpm --filter @ban/ban-core-exporter build
```
