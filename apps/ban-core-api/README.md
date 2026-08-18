# @ban/ban-core-api

Service API minimaliste pour uploader des fichiers BAL et les envoyer dans RabbitMQ.

## Endpoints

- `POST /upload-bal`  
  Envoie un fichier BAL (`multipart/form-data`) et le publie sur RabbitMQ (`bal.uploaded`)
- `GET {API_BASE_URL}/api/data/ban/{dep}`  
  Cree une demande d'export BAN asynchrone et renvoie un token de suivi.
- `GET {API_BASE_URL}/api/data/diff/{dep}`  
  Cree une demande d'export differentiel asynchrone et renvoie un token de suivi.
- `GET {API_BASE_URL}/api/reports/exports/{token}`  
  Retourne le rapport courant d'une demande d'export asynchrone.

La documentation OpenAPI des routes d'export est disponible dans [openapi.yaml](./openapi.yaml).

## Exports asynchrones

Les routes d'export repondent en `202 Accepted`. Elles ne renvoient pas le fichier exporte directement.

Le fonctionnement est le suivant :

1. `ban-core-api` valide la demande.
2. `ban-core-api` cree une ligne `ban.job_status` en `pending`.
3. `ban-core-api` publie `export.requested` dans RabbitMQ.
4. `ban-core-exporter` genere et stocke le fichier.
5. Le client suit la demande via `GET {API_BASE_URL}/api/reports/exports/{token}`.

Exemple :

```bash
API_BASE_URL=http://localhost:3000
TOKEN=<token>

curl "${API_BASE_URL}/api/data/ban/33?format=raw"
curl "${API_BASE_URL}/api/reports/exports/${TOKEN}"
```

## Démarrage

```bash
pnpm install
pnpm --filter @ban/ban-core-api run dev
```

## Variables d'environnement

Le service utilise `@ban/config` pour charger la config RabbitMQ via `.env` :
```env
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
```
