#!/usr/bin/env bash
set -euo pipefail

check_command() { 
  if ! command -v "$1" &> /dev/null; then 
    echo "Erreur: '$1' requis. Installez-le : $2"
    exit 1
  fi
}

check_command docker "https://docs.docker.com/get-docker/"
check_command pnpm "https://pnpm.io/installation"

if ! docker info > /dev/null 2>&1; then
  echo "Erreur: Docker n'est pas demarre"
  exit 1
fi

COMMAND="${1:-plan}"
NODE_VERSION="24"
GEN_COMPOSE="docker-compose.local.generated.yml"

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
  
  find apps -mindepth 1 -maxdepth 1 -type d -exec test -f "{}/package.json" ';' -print | sort
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

  for svc_path in "${services[@]}"; do
    svc_name=$(basename "$svc_path")
    image="ban-local/$svc_name:local"
    
    cat <<COMPOSEEOF
  $svc_name:
    image: $image
    container_name: $svc_name
    command: ["sh", "-c", "node dist/index.js"]
    env_file: $ENV_FILE
COMPOSEEOF

    # Exposer le port seulement pour ban-core-api
    if [[ "$svc_name" == "ban-core-api" ]]; then
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

# Build un service en local
build_service() {
  local svc_path="$1"
  local svc_name=$(basename "$svc_path")
  
  echo ""
  echo "=========================================="
  echo "BUILD: $svc_name"
  echo "=========================================="
  
  # Build avec pnpm
  echo "Building packages..."
  pnpm --filter "./packages/**" run build
  
  echo "Building service $svc_name..."
  pnpm --filter "./$svc_path" build
  
  # Préparer le dossier deploy
  echo "Preparing deploy folder..."
  rm -rf deploy
  pnpm deploy --filter "./$svc_path" --prod --legacy deploy
  
  # Copier fichiers additionnels si présents
  if [[ -f "$svc_path/compose.override.yml" ]]; then
    cp "$svc_path/compose.override.yml" deploy/
  fi
  if [[ -f "$svc_path/.env.example" ]]; then
    cp "$svc_path/.env.example" deploy/
  fi
  
  # Générer ou copier Dockerfile
  if [[ ! -f "$svc_path/Dockerfile" ]]; then
    echo "Generating Dockerfile..."
    cat > deploy/Dockerfile <<EOF
FROM node:${NODE_VERSION}-alpine
WORKDIR /app
COPY . .
RUN mkdir -p data dist uploads && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
EOF
  else
    echo "Using existing Dockerfile"
    cp "$svc_path/Dockerfile" deploy/Dockerfile
  fi
  
  # Build l'image Docker
  echo "Building Docker image: ban-local/$svc_name:local"
  docker build -t "ban-local/$svc_name:local" ./deploy
  
  # Nettoyer
  rm -rf deploy
  
  echo "✓ $svc_name built successfully"
}

# Commande DOCKERFILES
if [[ "$COMMAND" == "dockerfiles" ]]; then
  echo "=========================================="
  echo "DOCKERFILES: Apercu des Dockerfiles"
  echo "=========================================="
  echo ""
  
  mapfile -t SERVICES < <(detect_services)
  
  if [[ ${#SERVICES[@]} -eq 0 ]]; then
    echo "Erreur: Aucun service detecte dans apps/"
    exit 1
  fi
  
  for svc_path in "${SERVICES[@]}"; do
    svc_name=$(basename "$svc_path")
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Service: $svc_name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [[ -f "$svc_path/Dockerfile" ]]; then
      echo "Source: $svc_path/Dockerfile (personnalisé)"
      echo ""
      cat "$svc_path/Dockerfile"
    else
      echo "Source: Dockerfile généré automatiquement"
      echo ""
      cat <<EOF
FROM node:${NODE_VERSION}-alpine
WORKDIR /app
COPY . .
RUN mkdir -p data dist uploads && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
EOF
    fi
    echo ""
    echo ""
  done
  
  exit 0
fi

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
  svc_name=$(basename "$svc")
  echo "  - $svc_name"
done
echo ""

# Commande PLAN
if [[ "$COMMAND" == "plan" ]]; then
  echo "=========================================="
  echo "PLAN: Docker Compose LOCAL genere"
  echo "=========================================="
  echo ""
  echo "Mode: BUILD LOCAL (dev)"
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
  
  echo "=========================================="
  echo "DOCKERFILES qui seront utilises"
  echo "=========================================="
  echo ""
  for svc_path in "${SERVICES[@]}"; do
    svc_name=$(basename "$svc_path")
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Service: $svc_name"
    
    if [[ -f "$svc_path/Dockerfile" ]]; then
      echo "Source: $svc_path/Dockerfile (personnalisé)"
    else
      echo "Source: Dockerfile généré automatiquement"
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [[ -f "$svc_path/Dockerfile" ]]; then
      cat "$svc_path/Dockerfile"
    else
      cat <<EOF
FROM node:${NODE_VERSION}-alpine
WORKDIR /app
COPY . .
RUN mkdir -p data dist uploads && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
EOF
    fi
    echo ""
  done
  
  echo ""
  echo "=========================================="
  echo "DOCKER COMPOSE qui sera genere"
  echo "=========================================="
  echo ""
  echo "Fichier: $GEN_COMPOSE"
  echo ""
  generate_compose "${SERVICES[@]}"
  echo ""
  echo "Pour appliquer, lancez:"
  echo "  $0 apply"
  echo ""
  exit 0
fi

# Commande APPLY
if [[ "$COMMAND" == "apply" ]]; then
  echo "=========================================="
  echo "APPLY: Build LOCAL et demarrage BAN"
  echo "=========================================="
  echo ""
  echo "Mode: DEV (build local)"
  echo "Env file: $ENV_FILE"
  echo ""

  echo "Arret des services existants..."
  docker compose -f "$GEN_COMPOSE" down --remove-orphans 2>/dev/null || true

  echo ""
  echo "Installation des dependances..."
  pnpm install --frozen-lockfile

  echo ""
  echo "Build de tous les services..."
  for svc_path in "${SERVICES[@]}"; do
    build_service "$svc_path"
  done

  echo ""
  echo "Generation de $GEN_COMPOSE..."
  generate_compose "${SERVICES[@]}" > "$GEN_COMPOSE"

  echo ""
  echo "Demarrage de tout (infra + services)..."
  docker compose -f "$GEN_COMPOSE" up -d

  echo ""
  echo "======================================="
  echo "BAN demarre avec succes (LOCAL)"
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
echo "  $0 plan   # Affiche les Dockerfiles et le docker-compose qui sera genere"
echo "  $0 apply  # Build les images en local et lance le docker-compose"
echo "  $0 down   # Arrete tous les services"
echo ""
echo "Exemples:"
echo "  $0 plan"
echo "  $0 apply"
echo "  $0 down"