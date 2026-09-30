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

Pour envoyer les fichiers vers S3 ou RustFS :

```env
EXPORT_STORAGE=s3
EXPORT_S3_BUCKET=ban-exports
EXPORT_S3_ENDPOINT=http://localhost:9000
EXPORT_S3_REGION=us-east-1
EXPORT_S3_ACCESS_KEY_ID=rustfsadmin
EXPORT_S3_SECRET_ACCESS_KEY=rustfsadmin
EXPORT_S3_PREFIX=exports
EXPORT_S3_FORCE_PATH_STYLE=true
# Facultatif : durée de conservation des fichiers temporaires en mode S3 (24 h par défaut)
EXPORT_TEMP_FILE_MAX_AGE_HOURS=24
```

En production, après un envoi S3 confirmé, le fichier temporaire local est
supprimé. Le service nettoie aussi au démarrage les fichiers NDJSON temporaires
de plus de 24 heures ; cette durée peut être modifiée avec
`EXPORT_TEMP_FILE_MAX_AGE_HOURS`. Hors production, les fichiers temporaires sont
conservés, y compris après un envoi S3. Une erreur de nettoyage ne met pas
l'export en échec, puisque l'objet est déjà conservé dans S3.

En developpement local, `docker-compose.dev.ban.yml` démarre RustFS :

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

## Contrat BAN/DIFF v0.4

Les formats `raw` et `standard-fr` appliquent le contrat BAN/DIFF v0.4. Il couvre
les exports complets (`ban`) et différentiels (`diff`) des trois types de données :
district/commune, toponym/odonyme et address/adresse.

Les artefacts versionnés du contrat sont dans
[specifications/ban-diff/v0.4](./specifications/ban-diff/v0.4/) :

- la [spécification](./specifications/ban-diff/v0.4/specifications/SPECIFICATION_BAN_DIFF_V0.4.md) ;
- les schémas JSON Schema, qui valident chaque ligne NDJSON ;
- des fixtures valides et invalides ;
- le validateur de flux, qui contrôle les contraintes portant sur plusieurs lignes.

Un flux commence par `stream-start` et se termine par `stream-end`. Pour un DIFF,
un événement `created` ou `disabled` embarque un état, tandis qu'un événement
`updated` embarque l'état après puis l'état avant. Les événements sont écrits dans
l'ordre des dépendances : créations et mises à jour commune → odonyme → adresse,
puis désactivations adresse → odonyme → commune. Les compteurs de fin de flux
correspondent aux lignes effectivement écrites.

Les formats historiques `ban` et `standard-fr-int` restent disponibles, mais ne
font pas partie de ce contrat v0.4.

### Validation

Les tests du service chargent les quatre schémas publics, valident les fixtures et
exécutent le validateur de flux sur les cas valides comme invalides :

```bash
pnpm --filter @ban/ban-core-exporter test
pnpm --filter @ban/ban-core-exporter build
```

Pour contrôler un fichier produit manuellement :

```bash
node specifications/ban-diff/v0.4/scripts/validate-ban-ndjson.mjs <fichier.ndjson>
```

### Limite de volumétrie connue

L'ordonnancement DIFF conserve actuellement les lignes en mémoire avant leur
écriture finale, afin de respecter l'ordre de dépendances. Avant de traiter des
DIFF très volumineux, mesurer cette consommation mémoire et envisager un
ordonnancement SQL global ou un stockage temporaire.

## Commandes utiles

```bash
pnpm --filter @ban/ban-core-exporter dev
pnpm --filter @ban/ban-core-exporter test
pnpm --filter @ban/ban-core-exporter build
```
