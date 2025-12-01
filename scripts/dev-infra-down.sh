#!/usr/bin/env bash
set -euo pipefail

echo "🔴 - Arrêt edes outils et services essentiels lancés sur Docker et suppression des conteneurs…"
docker compose -f docker-compose.dev.ban.yml down