#!/usr/bin/env bash
set -euo pipefail

# chemin du script courant
SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

# Chargement des variable d'environnement depuis le fichier .env
[ ! -f "$SCRIPTPATH/../.env" ] || export $(grep -v '^#' "$SCRIPTPATH/../.env" | xargs)

# lancement du script dev-infra-up.sh
bash "$SCRIPTPATH/dev-infra-up.sh"

echo "🚀 - Démarrage des services Node en mode dev…"
pnpm --recursive --parallel run dev || true
