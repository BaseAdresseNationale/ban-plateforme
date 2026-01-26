#!/usr/bin/env bash
set -euo pipefail

### === Vérification des prérequis ===
check_command() { if ! command -v "$1" &> /dev/null; then echo "❌ '$1' requis. Installez-le : $2"; exit 1; fi; }
check_command gh "https://cli.github.com/"
check_command docker "https://docs.docker.com/get-docker/"
check_command node "https://nodejs.org/"
check_command fzf "https://github.com/junegunn/fzf"
check_command tar "https://www.gnu.org/software/tar/"

# Vérif Docker
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker n'est pas démarré !"
  echo "👉 Lancez Docker Desktop ou démarrez le daemon (Linux: sudo systemctl start docker)."
  exit 1
fi

echo "✅ Prérequis OK."

### === Vars par défaut ===
: "${SERVICE_DIR:=.services}"
: "${ARTIFACTS_DIR:=.artifacts}"
: "${START_MODE:=}"         # docker | local
: "${RUN_ID:=}"
: "${ENV_FILE:=}"

### === Aide ===
usage() {
  cat <<'EOF'
Usage:
  dev-run-artifacts.sh [--mode docker|local] [--run <run-id>]

Options:
  --mode    Mode de lancement des services (docker|local). Si omis, on demandera.
  --run     ID numérique d'un run GitHub Actions. Si omis, sélection interactive via fzf.
  --env-file <path>  Chemin d'un fichier .env à charger et injecter (défaut: .env).

Description:
  - Télécharge les artifacts GitHub d'un run
  - Décompresse chaque service dans .services/<prefix>/<service>
  - Génère docker-compose.ban.generated.yml (apps Node 24)
  - Lance l'infra (docker-compose.infra.yml)
  - Mode docker : lance chaque app dans un container + fusionne les overrides par service (.services/**/compose.override.yml)
  - Mode local  : lance chaque app avec "node dist/index.js" en arrière-plan
EOF
}

### === Parsing des options CLI ===
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) 
      usage
      exit 0
      ;;
    --mode)
      START_MODE="$2"
      shift 2
      ;;
    --run)
      RUN_ID="$2"
      shift 2
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    *)
      echo "❌ Option inconnue: $1"
      usage
      exit 1
      ;;
  esac
done

### === Mode interactif : Sélection du mode si non fourni ===
if [ -z "$START_MODE" ]; then
  echo "Comment veux-tu démarrer les services BAN ?"
  echo "1) Docker (containers Node isolés)"
  echo "2) Local (process Node.js)"
  read -p "Choix [1 / 2] (Defaut = 1): " choice
  START_MODE=$((([ "$choice" == "1" ] || [ "$choice" == "" ]) && echo "docker") || ([ "$choice" == "2" ] && echo "local") || echo "")
fi
if [[ "${START_MODE}" != "docker" && "${START_MODE}" != "local" ]]; then
  echo "❌ Le mode de demarrage (--mode) doit être 'docker' ou 'local'"
  exit 1
fi

### === Mode interactif : Sélection du run si non fourni ===
if [[ -z "${RUN_ID}" ]]; then
  echo "🔎 Récupération des derniers runs GitHub Actions..."
  # On affiche: "<id>\t<title> [branch] status conclusion createdAt"
  run_line=$(gh run list --limit 20 \
    --json databaseId,displayTitle,headBranch,status,conclusion,createdAt \
    --jq '.[] | "\(.databaseId)\t\(.displayTitle) [\(.headBranch)] \(.status) \(.conclusion) \(.createdAt)"' \
    | fzf --with-nth=2.. --prompt="🆔 Sélectionnez un run > " --height=20) || true

  [[ -z "${run_line}" ]] && { echo "❌ Aucun run sélectionné."; exit 1; }
  RUN_ID="${run_line%%$'\t'*}"
fi

echo "➡️  Mode: $START_MODE"
echo "➡️  Run CI: $RUN_ID"


# Choix du fichier d'environnement par défaut selon le mode si non fourni
if [ -z "$ENV_FILE" ]; then
  if [ "$START_MODE" = "docker" ]; then ENV_FILE=".env.docker"; else ENV_FILE=".env"; fi
fi

### === Vérification / création du fichier .env ===
ensure_dotenv() {
  if [[ -f "$ENV_FILE" ]]; then
    echo "✅ $ENV_FILE présent."
    return
  fi
  echo "⚠️ Aucun fichier $ENV_FILE trouvé. Création automatique…"
  if [[ -f ".env.example" ]]; then
    cp .env.example "$ENV_FILE"
    echo "📎 Copie .env.example -> $ENV_FILE"
  else
    cat > "$ENV_FILE" <<EOF
# Généré automatiquement par dev-run-artifacts.sh
# Adaptez ces valeurs si nécessaire.
RABBITMQ_HOST=${RABBITMQ_HOST}
RABBIT_URL=${RABBIT_URL}
PG_HOST=${PG_HOST}
PG_URI=${PG_URI}
PG_URL=${PG_URL}
MONGO_HOST=${MONGO_HOST}
MONGO_URI=${MONGO_URI}

# Exemples de ports d'exposition (utilisés dans les compose.override.yml)
BAN_CORE_API_PORT=8080
EOF
    echo "🆕 $ENV_FILE créé avec des valeurs par défaut."
  fi
}
ensure_dotenv

# Chemin absolu du fichier env pour Compose (env_file par service)
if [[ "$ENV_FILE" = /* ]]; then
  ENV_FILE_ABS="$ENV_FILE"
else
  ENV_FILE_ABS="$(pwd)/$ENV_FILE"
fi

### === Chargement et résolution de l'environnement ===
echo "📖 Chargement des variables depuis $ENV_FILE"
set -a
. "$ENV_FILE"
set +a

# Defaults based on mode for hosts
if [ "$START_MODE" = "docker" ]; then
  : "${RABBITMQ_HOST:=rabbitmq}"
  : "${PG_HOST:=postgres}"
  : "${MONGO_HOST:=mongo}"
else
  : "${RABBITMQ_HOST:=localhost}"
  : "${PG_HOST:=localhost}"
  : "${MONGO_HOST:=localhost}"
fi

: "${RABBITMQ_PORT:=5672}"; : "${RABBITMQ_USER:=guest}"; : "${RABBITMQ_PASSWORD:=guest}"
: "${PG_PORT:=5432}"; : "${PG_DB:=ban}"; : "${PG_USER:=ban}"; : "${PG_PASSWORD:=ban}"
: "${MONGO_PORT:=27017}"; : "${MONGO_DB:=ban}"

: "${RABBIT_URL:="amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST}:${RABBITMQ_PORT}"}"
: "${PG_URI:="postgres://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DB}"}"
: "${PG_URL:="postgres://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DB}?schema=${PG_DB}"}"
: "${MONGO_URI:="mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}"}"

echo ""
echo "🔧 Env (résolue) :"
echo "  - ENV_FILE=$ENV_FILE"
echo "  - RABBIT_URL=$RABBIT_URL"
echo "  - PG_URI=$PG_URI"
echo "  - MONGO_URI=$MONGO_URI"
echo "  - RABBITMQ_HOST=$RABBITMQ_HOST  PG_HOST=$PG_HOST  MONGO_HOST=$MONGO_HOST"
echo ""

### === Nettoyage containers orphelins ===
echo "🧹 Nettoyage containers orphelins..."
docker compose -f docker-compose.infra.yml down --remove-orphans || true

ARTIFACT_DIR=".artifacts"
SERVICE_DIR=".services"
GEN_COMPOSE="$SERVICE_DIR/docker-compose.ban.generated.yml"

### === Téléchargement artifacts ===
echo "📥 Téléchargement des artifacts du run $RUN_ID..."
rm -rf "$ARTIFACT_DIR" "$SERVICE_DIR"
mkdir -p "$ARTIFACT_DIR" "$SERVICE_DIR"
gh run download "$RUN_ID" --dir "$ARTIFACT_DIR"

### === Extraction ===
find "$ARTIFACT_DIR" -name "*.tar.gz" | while read tarfile; do
  base=$(basename "$tarfile" .tar.gz)
  prefix=${base%%-*}
  svc_name=${base#*-}
  echo "▶️  Extraction: $prefix/$svc_name"
  mkdir -p "$SERVICE_DIR/$prefix/$svc_name"
  # tar --strip-components=1 -xzf "$tarfile" -C "$SERVICE_DIR/$prefix/$svc_name"
  tar -xzf "$tarfile" -C "$SERVICE_DIR/$prefix/$svc_name"
done
echo " "

### === Mode Démarrage ===
if [ "$START_MODE" == "docker" ]; then
  echo "🛠 Génération Docker Compose dynamique..."
  rm -f "$GEN_COMPOSE"
  echo "services:" > "$GEN_COMPOSE"

  # Trouver tous les services dans apps et générer les entrées Docker Compose
  find "$SERVICE_DIR/apps" -mindepth 1 -maxdepth 1 -type d | while read svc; do
    name=$(basename "$svc")
    workdir="/app"
    cmd="node dist/index.js"

    cat >> "$GEN_COMPOSE" <<EOF
  $name:
    image: node:24
    container_name: $name
    working_dir: $workdir
    volumes:
      - "./$svc:/app"
    command: ["sh", "-c", "$cmd"]
    env_file:
      - "$ENV_FILE_ABS"
    depends_on:
      rabbitmq:
        condition: service_healthy
      postgres:
        condition: service_healthy
      mongo:
        condition: service_healthy
EOF
  done

  echo "🚀 Démarrage Docker Compose (infra + services)..."
  # Fusion dynamique des overrides par service
  declare -a compose_args
  compose_args=(-f docker-compose.infra.yml -f "$GEN_COMPOSE")
  while IFS= read -r -d '' override_file; do
    echo "  ➕ override: ${override_file}"
    compose_args+=(-f "$override_file")
  done < <(find "$SERVICE_DIR" -type f -name 'compose.override.yml' -print0)

  docker compose --env-file "$ENV_FILE" "${compose_args[@]}" up -d


  # echo "⏳ Health-check des services BAN..."
  # for svc in $(docker compose -f docker-compose.infra.yml -f "$GEN_COMPOSE" ps --services); do
  #   echo "  ⏳ Attente démarrage: $svc"
  #   retries=30
  #   while ! docker logs $svc 2>&1 | grep -q -E "listening|started|ready|connected"; do
  #     sleep 2
  #     retries=$((retries-1))
  #     [ $retries -le 0 ] && echo "  ⚠️ Timeout sur $svc (pas de log 'ready')." && break
  #   done
  #   echo "  ✅ $svc prêt !"
  # done

else
  echo "🚀 Démarrage infra Docker..."
  docker compose --env-file "$ENV_FILE" -f docker-compose.infra.yml up -d


  echo "🚀 Lancement des services BAN en local..."
  find "$SERVICE_DIR" -mindepth 2 -maxdepth 2 -type d -name dist | while read dist; do
    svc=$(basename "$(dirname "$dist")")
    parent=$(basename "$(dirname "$(dirname "$dist")")")
    echo "▶️ $parent/$svc"
    (cd "$(dirname "$dist")" && RABBIT_URL=$RABBIT_URL PG_URI=$PG_URI MONGO_URI=$MONGO_URI node dist/index.js &)
  done
fi

echo "🐇 RabbitMQ UI : http://localhost:15672"
echo "✅ BAN démarré en mode $([ "$START_MODE" == "docker" ] && echo Docker || echo Local) !"
