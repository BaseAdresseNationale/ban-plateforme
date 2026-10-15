#!/usr/bin/env bash
set -euo pipefail
# Inventaire SQL en lecture seule ; les rapports sont écrits sur l'hôte hors dry-run.
exec node "$(dirname "$0")/postgresql.mjs" check "$@"
