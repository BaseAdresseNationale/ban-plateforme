#!/usr/bin/env bash
set -euo pipefail

# Vérif Docker
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker n'est pas démarré !"
  echo "👉 Lancez Docker Desktop ou démarrez le daemon (Linux: sudo systemctl start docker)."
  exit 1
fi

echo "⚫️ - Lancement des outils et services essentiels via Docker…"
docker compose -f docker-compose.dev.ban.yml up -d

# Fonction de vérification de l'état des services
check_health () {
  local name="$1"
  docker inspect -f '{{.State.Health.Status}}' "$name" 2>/dev/null || echo "starting"
}

# Fonction d'attente qu'un service soit "healthy" avec timeout
wait_for () {
  local name="$1"; local timeout="${2:-180}"
  echo -n " ⏳ Attente de $name (timeout ${timeout}s)… "
  local start=$(date +%s)
  while true; do
    status=$(check_health "$name")
    if [[ "$status" == "healthy" ]]; then
      echo "OK ✅"
      break
    fi
    if (( $(date +%s) - start > timeout )); then
      echo "❌ Timeout en attendant $name (dernier statut: $status)"
      docker compose ps
      exit 1
    fi
    sleep 2
  done
}

# Attente des services critiques
echo "🟠 - Attente des services critiques…"
wait_for ban_rabbitmq 180
wait_for ban_postgres 180
wait_for ban_mongo 180

echo "🟢 - Pret à démarrer les services en mode dev…"
echo " ..."
