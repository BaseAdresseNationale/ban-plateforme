# @ban/ban-core-api

Service API minimaliste pour envoyer des fichiers BAL dans RabbitMQ.

## Endpoints

- `POST /upload-bal`  
  Route interne de test : parse un fichier BAL (`multipart/form-data`) puis publie `{ id, rows }` sur RabbitMQ (`bal.parsed`).

- `POST /send-bal`  
  Route interne de test : parse un corps texte CSV puis publie `{ id, rows }` sur RabbitMQ (`bal.parsed`).

- `POST /bal/file`  
  Envoie un fichier BAL (`multipart/form-data`) brut au parser via `{ id, payload, filename }` sur RabbitMQ (`bal.uploaded`).

- `POST /bal/text`  
  Envoie un corps texte CSV brut au parser via `{ id, payload, filename }` sur RabbitMQ (`bal.uploaded`).

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
