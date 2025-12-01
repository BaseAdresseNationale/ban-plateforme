#!/usr/bin/env bash
set -euo pipefail

SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
ROOTPATH="$SCRIPTPATH/.."

# 1) Chargement du .env à la racine
if [ -f "$ROOTPATH/.env" ]; then
  export $(grep -v '^#' "$ROOTPATH/.env" | xargs)
else
  echo "⚠️  Aucun fichier .env trouvé à la racine ($ROOTPATH/.env)."
  echo "   Pense à copier .env.example -> .env et à le remplir."
  exit 1
fi

PG_CONTAINER_NAME="${PG_CONTAINER_NAME:-ban_postgres}"
PG_DB="${PG_DB:-ban}"
PG_USER="${PG_USER:-ban_user}"

echo "🧪 Vérification que le conteneur Postgres ($PG_CONTAINER_NAME) tourne…"
if ! docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER_NAME}$"; then
  echo "❌ Le conteneur ${PG_CONTAINER_NAME} ne semble pas démarré."
  echo "👉 Lance d'abord: pnpm dev:infra:up   (ou simplement: pnpm dev)"
  exit 1
fi

BAN_SCHEMA_SQL="$ROOTPATH/ban_schema.sql"
if [ ! -f "$BAN_SCHEMA_SQL" ]; then
  echo "❌ Fichier ban_schema.sql introuvable à la racine du repo."
  exit 1
fi

echo "🔎 Vérification de l'existence de la table ban.district…"
EXISTS=$(docker exec -i "$PG_CONTAINER_NAME" psql -U "$PG_USER" -d "$PG_DB" -tAc "SELECT to_regclass('ban.district') IS NOT NULL;")

if [ "$EXISTS" = "t" ]; then
  echo "✅ La table ban.district existe déjà. On suppose que le schéma BAN est déjà initialisé."
else
  echo "📥 Import du schéma BAN depuis ban_schema.sql dans la base '$PG_DB'…"
  cat "$BAN_SCHEMA_SQL" | docker exec -i "$PG_CONTAINER_NAME" psql -U "$PG_USER" -d "$PG_DB"
  echo "✅ Schéma BAN importé."
fi

# On se place à la racine du repo pour toutes les commandes Prisma
cd "$ROOTPATH"

echo "📌 Enregistrement de la migration Prisma 0000_baseline comme appliquée…"
npx prisma migrate resolve --applied 0000_baseline || echo "ℹ️ Migration 0000_baseline déjà marquée comme appliquée."

echo "🚀 Déploiement des migrations Prisma restantes (s'il y en a)…"
npx prisma migrate deploy

echo "🧬 Regénération du client Prisma…"
cd "$ROOTPATH"
npx prisma generate

echo "✅ Initialisation BDD BAN terminée."
