#!/usr/bin/env bash
set -euo pipefail

if ! output=$(prisma migrate resolve --config prisma.config.ts --applied 0000_baseline 2>&1); then
  if printf '%s' "$output" | grep -q 'P3008'; then
    echo '⚠️  Baseline déjà enregistré. Ignorer l‘étape de résolution.'
  else
    echo "$output"
    exit 1
  fi
fi

prisma migrate deploy --config prisma.config.ts
prisma generate --config prisma.config.ts
