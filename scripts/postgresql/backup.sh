#!/usr/bin/env bash
set -euo pipefail
# Archive locale custom ; --dry-run inspecte, -y remplace uniquement la confirmation.
exec node "$(dirname "$0")/postgresql.mjs" backup "$@"
