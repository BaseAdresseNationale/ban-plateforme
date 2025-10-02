#!/usr/bin/env bash
set -euo pipefail

# chemin du script courant
SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

# lancement du script dev-infra-down.sh
bash "$SCRIPTPATH/dev-infra-down.sh"
