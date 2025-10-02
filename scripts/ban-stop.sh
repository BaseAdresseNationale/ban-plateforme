#!/usr/bin/env bash
set -euo pipefail

echo "🛑 - Arrêt des containers Docker BAN..."
docker compose -f docker-compose.infra.yml down
if [ -f .services/docker-compose.ban.generated.yml ]; then
  docker compose -f docker-compose.infra.yml -f .services/docker-compose.ban.generated.yml down
fi

echo "🛑 - Kill des process Node locaux (si lancés)..."
pkill -f "node dist/index.js" || true

echo "✅ Tout est arrêté proprement."
