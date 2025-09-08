# @ban/ban-core-api

Service API minimaliste pour uploader des fichiers BAL et les envoyer dans RabbitMQ.

## Endpoints

- `POST /upload-bal`  
  Envoie un fichier BAL (`multipart/form-data`) et le publie sur RabbitMQ (`bal.uploaded`)

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
