# 🏛️ BAN Platform — Développement & Architecture

BAN-Plateforme est l’infrastructure technique permettant la gestion, l’enrichissement et la diffusion de **l’Adresse en France**, opérée dans le cadre de la **Base Adresse Nationale (BAN)** et portée par l’État français, sous le pilotage de l'**Institut national de l’information géographique et forestière (IGN)**.

Elle fournit un écosystème cohérent de microservices capables de :

- traiter des fichiers BAL/BAN,
- orchestrer les enrichissements,
- historiser les données d’adresse,
- exposer des API performantes,
- garantir la qualité et la traçabilité des informations adressées.

La BAN-Platform est un environnement **multi-services** permettant :

- le parsing, l’enrichissement et l’écriture de fichiers BAL/BAN,
- l’orchestration via RabbitMQ,
- l’enregistrement en base PostgreSQL (schéma BAN complet + triggers d’historisation),
- l’exposition des données via des APIs (MongoDB).

La topologie RabbitMQ est documentée dans [RABBITMQ.md](./RABBITMQ.md).

Les exports asynchrones BAN et differentiels sont documentes dans la section [Exports asynchrones](#-exports-asynchrones).

Ce document explique **comment lancer le projet en local** et comment fonctionne l’infrastructure technique pour les développeurs.

---

## 🚀 Démarrage du projet

Cette section explique comment lancer BAN-Platform en local.

Bienvenue sur la BAN Platform !\
Ce guide devrait vous offrir un demarrage rapide, même sur une machine vierge.

### 1. 🧩 Prérequis

- **Node.js ≥ 24**
- **PNPM ≥ 10**
- **Docker / Docker Desktop**

### 2. 📦 Installation du projet

```shell
git clone <repo>
cd ban-platform
pnpm install
```

### 3. ⚙️ Configuration de l’environnement

Copiez le fichier d’exemple :

```shell
cp .env.example .env
```

Puis ajustez les valeurs selon vos besoins :

```shell
PG_DB=ban
PG_USER=ban_user
PG_PASSWORD=ban_password
PG_PORT=5432

PGADMIN_PORT=8082
PGADMIN_DEFAULT_EMAIL=admin@ban.fr
PGADMIN_DEFAULT_PASSWORD=admin

MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9002
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

EXPORT_STORAGE=s3
EXPORT_S3_BUCKET=ban-exports
EXPORT_S3_ENDPOINT=http://localhost:9000
EXPORT_S3_REGION=us-east-1
EXPORT_S3_ACCESS_KEY_ID=minioadmin
EXPORT_S3_SECRET_ACCESS_KEY=minioadmin
EXPORT_S3_PREFIX=exports
EXPORT_S3_FORCE_PATH_STYLE=true
```

> Ces variables alimentent `docker-compose.dev.ban.yml` ainsi que les scripts de développement.
> Pensez à maintenir votre `.env` local aligné avec `.env.example` lorsque de nouvelles variables sont ajoutées.

### 4. 🚀 Démarrer l’infrastructure + services Node

```shell
pnpm dev
```

Ce script :

- charge automatiquement les variables de `.env`,
- démarre Postgres, Mongo, RabbitMQ, MinIO, pgAdmin et Mongo-Express,
- lance **toutes les apps Node** en mode `dev` avec hot-reload.

### 🔁 Démarrage quotidien (workflow développeur)

Pour travailler chaque jour sur la BAN Platform :

1. Assurez-vous d’être dans la racine du repo :

  ```shell
  cd ban-platform
  ```

2. Vérifiez les dépendances (si le repo a changé depuis votre dernier pull) :

  ```shell
  pnpm install
  ```

3. Démarrez l’environnement complet :

  ```shell
  pnpm dev
  ```

C’est tout 🎉

> Si la base est déjà initialisée, **aucune autre action n’est nécessaire**. Le script `pnpm dev` démarre automatiquement toute l’infra + les services en hot-reload.

## 5. 🗄️ Initialiser la base BAN *(première installation uniquement)*

BAN utilise un schéma PostgreSQL complexe :

- extensions (`postgis`, `btree_gist`)
- triggers d’historisation
- fonction `historisation()`
- contraintes `EXCLUDE`
- colonnes `tstzrange`
- tables historiques `*_h`

👉 Ce schéma **ne peut pas être créé par Prisma**, d’où le fichier racine : `ban_schema.sql`

Initialisez la base avec :

```shell
pnpm run dev:infra:init
```

Ce script :

1. lance './scripts/dev-db-init.sh', qui...
2. Vérifie que Postgres tourne,
3. Vérifie si `ban.district` existe,
4. Si nécessaire → importe `ban_schema.sql`,
5. Lance le bootstrap Prisma (`pnpm db:bootstrap`) qui :
   - marque `0000_baseline` comme appliquée,
   - applique les migrations Prisma restantes,
   - régénère le client Prisma.

`pnpm db:bootstrap` s’occupe de tout le cycle Prisma après l’import du schéma BAN.


Après ça, votre base BAN locale est entièrement fonctionnelle.

## 6. 🔧 Outils disponibles

| Outil         | URL                                                                     | Notes                                   |
| ------------- | ----------------------------------------------------------------------- | --------------------------------------- |
| RabbitMQ UI   | [http://localhost:15672](http://localhost:15672)                        | guest / guest                           |
| Mongo Express | [http://localhost:8081](http://localhost:8081)                          | inspection Mongo                        |
| pgAdmin       | [http://localhost:\${PGADMIN\_PORT}](http://localhost:\${PGADMIN_PORT}) | identifiants dans `.env`                |
| MinIO Console | [http://localhost:9002](http://localhost:9002)                          | stockage S3 local, bucket `ban-exports` |
| PostgreSQL    | localhost:\${PG\_PORT}                                                  | utilisateur / DB configurés dans `.env` |

---

## 📤 Exports asynchrones

Les exports BAN et differentiels ne sont pas renvoyes directement par `ban-core-api`.
L'API cree une demande d'export, renvoie un token de suivi, puis publie une commande RabbitMQ consommee par `ban-core-exporter`.

```text
client HTTP
  GET {API_BASE_URL}/api/data/ban/{dep}
  ou GET {API_BASE_URL}/api/data/diff/{dep}
        │
        ▼
ban-core-api
  cree ban.job_status en pending
  publie export.requested -> ban.commands
        │
        ▼
ban-core-exporter
  genere le fichier NDJSON
  stocke le fichier localement ou sur S3
  met a jour ban.job_status
  publie export.completed ou export.failed -> ban.events
        │
        ▼
client HTTP
  GET {API_BASE_URL}/api/reports/exports/{token}
```

Dans les exemples suivants, `API_BASE_URL` designe l'URL du service `ban-core-api`.
En local, elle vaut generalement `http://localhost:3000`.

### Demander un export BAN

```shell
API_BASE_URL=http://localhost:3000

curl "${API_BASE_URL}/api/data/ban/33?format=raw"
```

Parametres principaux :

- `dep` : code departement, ou plusieurs codes separes par des virgules ;
- `format` : `raw`, `ban`, `standard-fr` ou `standard-fr-int` ; par defaut `raw` ;
- `dataTypes` : `district`, `toponym`, `address`, separes par des virgules ; par defaut tous les types ;
- `at` : date de snapshot BAN ; par defaut la date courante.

### Demander un export differentiel

```shell
API_BASE_URL=http://localhost:3000

curl "${API_BASE_URL}/api/data/diff/33?from=2026-01-01T00:00:00.000Z&format=raw"
```

Parametres principaux :

- `dep` : code departement, ou plusieurs codes separes par des virgules ;
- `from` : date de debut du differentiel, obligatoire ;
- `to` : date de fin du differentiel ; par defaut la date courante ;
- `format` : `raw`, `ban`, `standard-fr` ou `standard-fr-int` ; par defaut `raw` ;
- `dataTypes` : `district`, `toponym`, `address`, separes par des virgules ; par defaut tous les types.

Les routes de demande repondent en `202 Accepted` avec un token :

```json
{
  "response": {
    "token": "V1StGXR8_Z5jdHi6B-myT",
    "exportType": "ban",
    "status": "pending"
  }
}
```

### Suivre un export

```shell
API_BASE_URL=http://localhost:3000
TOKEN=V1StGXR8_Z5jdHi6B-myT

curl "${API_BASE_URL}/api/reports/exports/${TOKEN}"
```

La route retourne le statut courant de la demande :

- `pending` : demande creee, pas encore traitee ;
- `processing` : export en cours ;
- `success` : fichier genere et stocke ;
- `error` : generation ou stockage en erreur.

Lorsque le stockage S3 est configure, le rapport contient les informations de sortie :

```json
{
  "response": {
    "token": "V1StGXR8_Z5jdHi6B-myT",
    "status": "success",
    "exportType": "ban",
    "count": 42,
    "report": {
      "output": {
        "storage": "s3",
        "bucket": "ban-exports",
        "key": "exports/ban/V1StGXR8_Z5jdHi6B-myT/V1StGXR8_Z5jdHi6B-myT.ban.raw.ndjson"
      }
    }
  }
}
```

En developpement local, MinIO fournit une API S3 compatible sur `http://localhost:9000` et une console sur [http://localhost:9002](http://localhost:9002). Le bucket local cree par defaut est `ban-exports`.

La documentation OpenAPI des routes d'export est disponible dans [apps/ban-core-api/openapi.yaml](./apps/ban-core-api/openapi.yaml).

---

## 🏗️ Architecture du monorepo

```shell
ban-platform/
│
├── apps/
│   ├── ban-core-writer/
│   ├── ban-core-api/
│
├── packages/
│   └── prisma-client/
│       ├── prisma.config.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── extensions/
│       │   └── migrations/
│       └── generated/
│           └── client/
│
├── ban_schema.sql
├── scripts/
│   ├── dev-start.sh
│   ├── dev-infra-up.sh
│   └── dev-db-init.sh
│
├── docker-compose.dev.ban.yml
└── package.json
```

---

## 🧬 Prisma, baseline & migrations

### Pourquoi Prisma ne gère pas l’initialisation BAN ?

Prisma ne peut **pas** initialiser la base BAN car le schéma utilise des éléments PostgreSQL avancés :

- types `tstzrange`,
- triggers d’historisation,
- fonction `historisation()`,
- contraintes `EXCLUDE USING gist`,
- extensions `postgis`, `btree_gist`,
- tables d’historique `*_h`.

Ces mécanismes ne peuvent **pas** être créés via Prisma.

👉 L’initialisation de la base passe donc **obligatoirement** par le fichier SQL complet : `ban_schema.sql`

Ce fichier contient l’intégralité du schéma PostgreSQL BAN (tables, clés, triggers, extensions…).

L’initialisation réelle est assurée automatiquement par :

```shell
./scripts/dev-db-init.sh
```

Ce script :

- vérifie si la base doit être initialisée,
- applique `ban_schema.sql` si nécessaire,
- regénère le client Prisma.

👉 Prisma prend ensuite le relais **uniquement pour les évolutions futures du schéma**.

---

### Migration 0 Prisma

> ℹ️ Cette opération est réalisée **une seule fois par les mainteneurs** pour définir l’état initial du schéma côté Prisma. Les autres développeurs n’ont **pas** à relancer ces commandes manuellement.

Pour créer la migration de base (`0000_baseline`) à partir du schéma actuel :


```shell
pnpm db:migrate:diff:baseline
```

Puis enregistrer cette migration comme "déjà appliquée" auprès de Prisma :

```shell
pnpm db:migrate:resolve -- 0000_baseline
```

Dans les environnements de développement, l’alignement Prisma ⇔ base est ensuite géré automatiquement par :

```
./scripts/dev-db-init.sh
```

Ce script :

- initialise le schéma BAN via `ban_schema.sql` si nécessaire,
- génère le client Prisma,
- et peut marquer la migration `0000_baseline` comme appliquée dans la base locale.

---

## 🧪 Tester Prisma

```shell
pnpm --filter @ban/ban-core-writer test:prisma
```

---

## 🔥 Mode Artifacts CI

```shell
pnpm ban:start
```

Lance l’infra + les services Node buildés (archives CI/CD).
