#!/usr/bin/env bash
set -euo pipefail
# Restaure uniquement dans une nouvelle base ; aucune suppression ni bascule.
exec node "$(dirname "$0")/postgresql.mjs" restore "$@"
