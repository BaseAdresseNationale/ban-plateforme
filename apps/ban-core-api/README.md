# @ban/ban-core-api

Service API minimaliste pour uploader des fichiers BAL et les envoyer dans RabbitMQ.

## Endpoints

- `POST /upload-bal`  
  Envoie un fichier BAL (`multipart/form-data`) et le publie sur RabbitMQ (`bal.uploaded`)
- `GET /api/data/ban/:dep`  
  Cree une demande d'export BAN asynchrone et renvoie un token de suivi.
- `GET /api/data/diff/:dep`  
  Cree une demande d'export differentiel asynchrone et renvoie un token de suivi.

La documentation OpenAPI des routes d'export est disponible dans [openapi.yaml](./openapi.yaml).

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
