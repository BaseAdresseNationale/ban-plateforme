#!/usr/bin/env bash
set -euo pipefail

check_command() { 
  if ! command -v "$1" &> /dev/null; then 
    echo "Erreur: '$1' requis. Installez-le : $2"
    exit 1
  fi
}

check_command docker "https://docs.docker.com/get-docker/"

if ! docker info > /dev/null 2>&1; then
  echo "Erreur: Docker n'est pas demarre"
  exit 1
fi

# Gestion spéciale pour la commande down
if [[ "${1:-}" == "down" ]]; then
  COMMAND="down"
  TAG="latest"
else
  TAG="${1:-latest}"
  COMMAND="${2:-plan}"
fi

REGISTRY="ghcr.io"
REPO_OWNER="baseadressenationale"
REPO_NAME="ban-plateforme"
GEN_COMPOSE="docker-compose.prod.generated.yml"

# Priorité à .env.docker
if [[ -f ".env.docker" ]]; then
  ENV_FILE=".env.docker"
  echo "Utilisation de .env.docker"
elif [[ -f ".env" ]]; then
  ENV_FILE=".env"
  echo "Utilisation de .env"
else
  echo "Erreur: aucun fichier .env ou .env.docker trouve"
  exit 1
fi

# Charger les variables depuis le fichier .env
set -a
source "$ENV_FILE"
set +a

# Vérifier que les variables essentielles sont définies
if [[ -z "${PG_USER:-}" ]] || [[ -z "${PG_PASSWORD:-}" ]] || [[ -z "${RABBITMQ_USER:-}" ]]; then
  echo "Erreur: variables manquantes dans $ENV_FILE"
  echo "Variables requises: PG_USER, PG_PASSWORD, PG_DB, RABBITMQ_USER, RABBITMQ_PASSWORD"
  exit 1
fi

# Valeurs par défaut si non définies
: "${PGADMIN_PORT:=8082}"
: "${PGADMIN_EMAIL:=admin@ban.fr}"
: "${PGADMIN_PASSWORD:=admin}"
: "${MONGO_EXPRESS_PORT:=8081}"
: "${MONGO_EXPRESS_USER:=admin}"
: "${MONGO_EXPRESS_PASSWORD:=admin}"
: "${RABBITMQ_MANAGEMENT_PORT:=15672}"
: "${PORT:=3000}"

# Detection des services depuis le repo local
detect_services() {
  echo "Detection des services depuis apps/..." >&2
  
  if [[ ! -d "apps" ]]; then
    echo "Erreur: dossier apps/ introuvable" >&2
    exit 1
  fi
  
  find apps -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort
}

# Generer le docker-compose complet (infra + services)
generate_compose() {
  local services=("$@")
  
  cat <<COMPOSEEOF
services:
  rabbitmq:
    image: rabbitmq:3-management
    container_name: rabbitmq
    ports:
      - "${RABBITMQ_PORT}:5672"
      - "${RABBITMQ_MANAGEMENT_PORT}:15672"
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "check_port_connectivity"]
      interval: 5s
      timeout: 10s
      retries: 5
    restart: unless-stopped
    networks:
      - ban-network

  postgres:
    image: postgres:15
    container_name: postgres
    environment:
      POSTGRES_USER: ${PG_USER}
      POSTGRES_PASSWORD: ${PG_PASSWORD}
      POSTGRES_DB: ${PG_DB}
    ports:
      - "${PG_PORT}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${PG_USER} -d ${PG_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - ban-network

  pgadmin:
    image: dpage/pgadmin4
    container_name: pgadmin
    ports:
      - "${PGADMIN_PORT}:80"
    environment:
      PGADMIN_DEFAULT_EMAIL: ${PGADMIN_EMAIL}
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD}
    depends_on:
      - postgres
    restart: unless-stopped
    networks:
      - ban-network

  mongo:
    image: mongo:6
    container_name: mongo
    ports:
      - "${MONGO_PORT}:27017"
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - ban-network

  mongo-express:
    image: mongo-express
    container_name: mongo-express
    ports:
      - "${MONGO_EXPRESS_PORT}:8081"
    environment:
      ME_CONFIG_MONGODB_SERVER: mongo
      ME_CONFIG_BASICAUTH_USERNAME: ${MONGO_EXPRESS_USER}
      ME_CONFIG_BASICAUTH_PASSWORD: ${MONGO_EXPRESS_PASSWORD}
    depends_on:
      - mongo
    restart: unless-stopped
    networks:
      - ban-network

COMPOSEEOF

  for svc in "${services[@]}"; do
    image="$REGISTRY/$REPO_OWNER/$REPO_NAME/apps/$svc:$TAG"
    
    cat <<COMPOSEEOF
  $svc:
    image: $image
    container_name: $svc
    command: ["sh", "-c", "node dist/index.js"]
    env_file: $ENV_FILE
COMPOSEEOF

    # Exposer le port seulement pour ban-core-api
    if [[ "$svc" == "ban-core-api" ]]; then
      cat <<COMPOSEEOF
    ports:
      - "\${PORT}:\${PORT}"
COMPOSEEOF
    fi

    cat <<COMPOSEEOF
    depends_on:
      rabbitmq:
        condition: service_healthy
      postgres:
        condition: service_healthy
      mongo:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - ban-network

COMPOSEEOF
  done
  
  cat <<'COMPOSEEOF'
volumes:
  postgres_data:
  mongo_data:

networks:
  ban-network:
    driver: bridge
COMPOSEEOF
}

# Commande DOWN
if [[ "$COMMAND" == "down" ]]; then
  echo "=========================================="
  echo "DOWN: Arret de tous les services"
  echo "=========================================="
  echo ""
  
  if [[ ! -f "$GEN_COMPOSE" ]]; then
    echo "Erreur: $GEN_COMPOSE n'existe pas"
    echo "Rien a arreter"
    exit 1
  fi
  
  echo "Arret et suppression des containers..."
  docker compose -f "$GEN_COMPOSE" down --remove-orphans
  
  echo ""
  echo "Services arretes avec succes"
  echo ""
  exit 0
fi

# Detection des services
echo "Detection des services disponibles..."
mapfile -t SERVICES < <(detect_services)

if [[ ${#SERVICES[@]} -eq 0 ]]; then
  echo "Erreur: Aucun service detecte dans apps/"
  exit 1
fi

echo "Services detectes: ${#SERVICES[@]}"
for svc in "${SERVICES[@]}"; do
  echo "  - $svc"
done
echo ""

# Commande PLAN
if [[ "$COMMAND" == "plan" ]]; then
  echo "=========================================="
  echo "PLAN: Docker Compose genere"
  echo "=========================================="
  echo ""
  echo "Tag: $TAG"
  echo "Env file: $ENV_FILE"
  echo "Services: ${#SERVICES[@]}"
  echo ""
  echo "Variables chargees depuis $ENV_FILE:"
  echo "  PG_HOST=$PG_HOST"
  echo "  PG_PORT=$PG_PORT"
  echo "  PG_USER=$PG_USER"
  echo "  PG_DB=$PG_DB"
  echo "  PGADMIN_PORT=$PGADMIN_PORT"
  echo "  PGADMIN_EMAIL=$PGADMIN_EMAIL"
  echo "  MONGO_HOST=$MONGO_HOST"
  echo "  MONGO_PORT=$MONGO_PORT"
  echo "  MONGO_EXPRESS_PORT=$MONGO_EXPRESS_PORT"
  echo "  RABBITMQ_HOST=$RABBITMQ_HOST"
  echo "  RABBITMQ_PORT=$RABBITMQ_PORT"
  echo "  RABBITMQ_MANAGEMENT_PORT=$RABBITMQ_MANAGEMENT_PORT"
  echo "  RABBITMQ_USER=$RABBITMQ_USER"
  echo "  PORT=$PORT"
  echo ""
  echo "Fichier qui sera genere: $GEN_COMPOSE"
  echo ""
  echo "Contenu:"
  echo "------------------------------------------"
  generate_compose "${SERVICES[@]}"
  echo "------------------------------------------"
  echo ""
  echo "Pour appliquer, lancez:"
  echo "  $0 $TAG apply"
  echo ""
  exit 0
fi

# Commande APPLY
if [[ "$COMMAND" == "apply" ]]; then
  echo "=========================================="
  echo "APPLY: Demarrage BAN avec images Docker"
  echo "=========================================="
  echo ""
  echo "Tag: $TAG"
  echo "Env file: $ENV_FILE"

  echo "Arret des services existants..."
  docker compose -f "$GEN_COMPOSE" down --remove-orphans 2>/dev/null || true

  echo "Generation de $GEN_COMPOSE..."
  generate_compose "${SERVICES[@]}" > "$GEN_COMPOSE"

  echo "Pull des images des services..."
  for svc in "${SERVICES[@]}"; do
    image="$REGISTRY/$REPO_OWNER/$REPO_NAME/apps/$svc:$TAG"
    echo "  Pull: $image"
    docker pull "$image" 2>/dev/null || echo "    Warning: impossible de pull $image"
  done

  echo ""
  echo "Demarrage de tout (infra + services)..."
  docker compose -f "$GEN_COMPOSE" up -d

  echo ""
  echo "======================================="
  echo "BAN demarre avec succes"
  echo "======================================="
  echo ""
  echo "Services disponibles:"
  echo "  RabbitMQ UI:    http://localhost:${RABBITMQ_MANAGEMENT_PORT} (${RABBITMQ_USER}/${RABBITMQ_PASSWORD})"
  echo "  PostgreSQL:     localhost:${PG_PORT} (${PG_USER}/${PG_PASSWORD})"
  echo "  pgAdmin:        http://localhost:${PGADMIN_PORT} (${PGADMIN_EMAIL}/${PGADMIN_PASSWORD})"
  echo "  MongoDB:        localhost:${MONGO_PORT}"
  echo "  Mongo Express:  http://localhost:${MONGO_EXPRESS_PORT} (${MONGO_EXPRESS_USER}/${MONGO_EXPRESS_PASSWORD})"
  echo "  Ban Core API:   http://localhost:${PORT}"
  echo ""
  echo "Commandes utiles:"
  echo "  docker compose -f $GEN_COMPOSE logs -f"
  echo "  docker compose -f $GEN_COMPOSE ps"
  echo "  $0 down"
  echo ""
  exit 0
fi

# Aide
echo "Usage:"
echo "  $0 [TAG] plan   # Affiche le docker-compose qui sera genere"
echo "  $0 [TAG] apply  # Genere et lance le docker-compose"
echo "  $0 down         # Arrete tous les services"
echo ""
echo "Exemples:"
echo "  $0 latest plan"
echo "  $0 latest apply"
echo "  $0 down"