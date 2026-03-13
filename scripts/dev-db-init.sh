#!/usr/bin/env bash
set -euo pipefail

require_command() {
  local cmd="$1"
  local desc="$2"

  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "❌ Commande manquante : $desc ($cmd)"
    echo "   Installez-la avant de relancer ce script."
    exit 1
  fi
}

require_command docker "Docker CLI"
require_command pnpm "PNPM"
require_command node "Node.js"

SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
ROOTPATH="$SCRIPTPATH/.."

# 1) Chargement du .env à la racine
if [ -f "$ROOTPATH/.env" ]; then
  export $(grep -v '^#' "$ROOTPATH/.env" | xargs)
else
  echo "⚠️  Aucun fichier .env trouvé à la racine ($ROOTPATH/.env)."
  echo "   Veuillez copier .env.example -> .env et le remplir."
  exit 1
fi

PG_CONTAINER_NAME="${PG_CONTAINER_NAME:-ban_postgres}"
PG_DB="${PG_DB:-ban}"
PG_USER="${PG_USER:-ban_user}"

# variable locale pour indiquer si on doit automatiquement démarrer l'infra docker
START_DOCKER_INFRA=${START_DOCKER_INFRA:-"true"}
START_DOCKER_INFRA_STATUS="false"

echo "🧪 Vérification que le conteneur Postgres ($PG_CONTAINER_NAME) tourne…"
if ! docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER_NAME}$"; then
  echo "❌ Le conteneur ${PG_CONTAINER_NAME} ne semble pas démarré."
  if [ "$START_DOCKER_INFRA" = "true" ]; then
    echo "🚀 Démarrage des services de dev via Docker…"
    ./scripts/dev-infra-up.sh
    START_DOCKER_INFRA_STATUS="true"
  else
    echo "👉 Lancez d'abord : pnpm dev:infra:up (ou simplement : pnpm dev)"
    exit 1
  fi
fi

BAN_SCHEMA_SQL="$ROOTPATH/ban_schema.sql"
if [ ! -f "$BAN_SCHEMA_SQL" ]; then
  echo "❌ Fichier ban_schema.sql introuvable à la racine du repo."
  exit 1
fi

BASELINE_MIGRATION_SQL="$ROOTPATH/packages/prisma-client/prisma/migrations/0000_baseline/migration.sql"

echo "🔎 Vérification de l'existence de la table ban.district…"
EXISTS=$(docker exec -i "$PG_CONTAINER_NAME" psql -U "$PG_USER" -d "$PG_DB" -tAc "SELECT to_regclass('ban.district') IS NOT NULL;")

if [ "$EXISTS" = "t" ]; then
  echo "✅ La table ban.district existe déjà. On suppose que le schéma BAN est déjà initialisé."
else
  echo "📥 Import du schéma BAN depuis ban_schema.sql dans la base '$PG_DB'…"
  cat "$BAN_SCHEMA_SQL" | docker exec -i "$PG_CONTAINER_NAME" psql -U "$PG_USER" -d "$PG_DB"
  echo "✅ Schéma BAN importé."
fi

# On se place à la racine du repo pour lancer le flux Prisma unique
cd "$ROOTPATH"

BOOTSTRAP_SCRIPT_CMD="pnpm --silent run db:bootstrap"

check_bootstrap_script_exists() {
  node - <<'NODE'
const fs = require('fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))

if (!pkg.scripts || !pkg.scripts['db:bootstrap']) {
  process.exit(1)
}
NODE
}

if ! check_bootstrap_script_exists; then
  echo "❌ Script db:bootstrap introuvable dans package.json racine."
  echo "   Vérifiez la présence de \"db:bootstrap\" dans la section scripts."
  exit 1
fi

if [ ! -f "$BASELINE_MIGRATION_SQL" ]; then
  echo "⚠️  La migration 0000_baseline est absente : $BASELINE_MIGRATION_SQL"
  echo "   Ce n'est pas bloquant si la baseline a déjà été préparée par votre workflow de maintenance."
  echo "   Sinon, l'étape de migration d'initialisation peut être nécessaire côté mainteneurs."
fi

echo "🚀 Lancement du bootstrap Prisma (baseline + migrations + generate)…"
if ! eval "$BOOTSTRAP_SCRIPT_CMD"; then
  echo "❌ Échec du bootstrap Prisma."
  echo "💡 Vérifiez :"
  echo "   - la base PostgreSQL '$PG_DB' est bien accessible,"
  echo "   - PG_URL dans .env est bien défini,"
  echo "   - la base a bien le schéma attendu."
  echo "   - le script `pnpm db:bootstrap` est exécuté depuis la racine du repo."
  exit 1
fi

if [ "$START_DOCKER_INFRA_STATUS" = "true" ]; then
  echo "🚀 Arret des services de dev sur Docker…"
  ./scripts/dev-infra-stop.sh
  START_DOCKER_INFRA_STATUS="false"
fi

echo "✅ Initialisation BDD BAN terminée."
