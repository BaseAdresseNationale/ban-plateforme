#!/usr/bin/env bash
set -e

### === Vérification des prérequis ===
check_command() { if ! command -v "$1" &> /dev/null; then echo "❌ '$1' requis. Installez-le : $2"; exit 1; fi; }
check_command gh "https://cli.github.com/"
check_command docker "https://docs.docker.com/get-docker/"
check_command node "https://nodejs.org/"
check_command fzf "https://github.com/junegunn/fzf"
check_command tar "https://www.gnu.org/software/tar/"

# Vérif que Docker est bien démarré
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker n'est pas démarré !"
  echo "👉 Lancez Docker Desktop (Mac/Win) ou démarrez le daemon (Linux: sudo systemctl start docker)."
  exit 1
fi

echo "✅ Prérequis OK."

### === Question : mode de démarrage ===
echo "Comment veux-tu démarrer les services BAN ?"
echo "1) Docker (containers Node isolés)"
echo "2) Local (process Node.js)"
read -p "Choix [1/2]: " START_MODE

### === Sélection du run CI AVANT téléchargement ===
RUN_ID=$(gh run list --workflow "Build & Package BAN Services (Dynamic Matrix)" --limit 20 \
  --json databaseId,headBranch,status,conclusion,createdAt \
  --jq '.[] | "\(.databaseId)\t[\(.status)/\(.conclusion)] \(.headBranch) - \(.createdAt)"' \
  | fzf --prompt="Sélectionne un run à télécharger : " | cut -f1)
[ -z "$RUN_ID" ] && echo "❌ Aucun run sélectionné." && exit 1

echo "🧹 Nettoyage des anciens containers orphelins..."
docker compose -f docker-compose.infra.yml down --remove-orphans || true

ARTIFACT_DIR=".artifacts"
SERVICE_DIR=".services"
GEN_COMPOSE="$SERVICE_DIR/docker-compose.ban.generated.yml"

### === Téléchargement des artifacts ===
echo "📥 Téléchargement des artifacts du run $RUN_ID..."
rm -rf "$ARTIFACT_DIR" "$SERVICE_DIR"
mkdir -p "$ARTIFACT_DIR" "$SERVICE_DIR"
gh run download "$RUN_ID" --dir "$ARTIFACT_DIR"

### === Extraction ===
find "$ARTIFACT_DIR" -name "*.tar.gz" | while read tarfile; do
  base=$(basename "$tarfile" .tar.gz)
  prefix=${base%%-*}
  svc_name=${base#*-}
  echo "  ▶️ $prefix/$svc_name"
  mkdir -p "$SERVICE_DIR/$prefix/$svc_name"
  tar --strip-components=1 -xzf "$tarfile" -C "$SERVICE_DIR/$prefix/$svc_name"
done

### === Démarrage selon le mode choisi ===
if [ "$START_MODE" == "1" ]; then
  # Générer le docker-compose dynamique
  echo "version: '3.9'" > "$GEN_COMPOSE"
  echo "services:" >> "$GEN_COMPOSE"

  find "$SERVICE_DIR/apps" "$SERVICE_DIR/packages" -mindepth 1 -maxdepth 1 -type d | while read svc; do
    name=$(basename "$svc")
    if [ -d "$svc/dist" ]; then
      workdir="/app"
      cmd="node dist/index.js"
    else
      workdir="/app"
      cmd="node index.js"
    fi

    cat >> "$GEN_COMPOSE" <<EOF
  $name:
    image: node:24
    container_name: $name
    working_dir: $workdir
    volumes:
      - ./$(echo $svc):/app
    command: ["sh", "-c", "$cmd"]
    environment:
      RABBIT_URL: amqp://rabbitmq:5672
      PG_URI: postgres://ban:ban@postgres:5432/ban
      MONGO_URI: mongodb://mongo:27017/ban
    depends_on:
      - rabbitmq
      - postgres
      - mongo
EOF
  done

  echo "✅ Docker Compose généré dans $GEN_COMPOSE"
  docker compose -f docker-compose.infra.yml -f "$GEN_COMPOSE" up -d

else
  echo "🚀 Démarrage infra Docker..."
  docker compose -f docker-compose.infra.yml up -d

  echo "🚀 Lancement des services BAN en local..."
  find "$SERVICE_DIR" -mindepth 2 -maxdepth 2 -type d -name dist | while read dist; do
    svc=$(basename "$(dirname "$dist")")
    parent=$(basename "$(dirname "$(dirname "$dist")")")
    echo "▶️ $parent/$svc"
    (cd "$(dirname "$dist")" && node dist/index.js &)
  done
fi

echo "🐇 RabbitMQ UI : http://localhost:15672"
echo "✅ BAN démarré en mode $([ "$START_MODE" == "1" ] && echo Docker || echo Local) !"
