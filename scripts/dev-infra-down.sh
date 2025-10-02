#!/usr/bin/env bash
set -euo pipefail

echo "🔴 - Arrêt des outils et services essentiels lancés sur Docker…"
docker compose -f docker-compose.dev.ban.yml down
