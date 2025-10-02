#!/usr/bin/env bash
set -euo pipefail

# Ce script permet de demmarer les services BAN en local, en mode production.
# Il telecharge et installe les artefacts ncessaires de BAN-Platform depuis le repository GitHub.
# Ensuite, il lance les containers Docker ncessaires, puis les services Node.
# > Pour stoper les services, utiliser le script ban-stop.sh

# chemin du script courant
SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

# Lancement du script run-artifacts.sh
bash "$SCRIPTPATH/run-artifacts.sh"
