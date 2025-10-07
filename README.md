# 📦 BAN Platform Monorepo

Ce dépôt contient les services et librairies de la plateforme **Base Adresse Nationale (BAN)**.

Il est structuré en **monorepo** avec [`pnpm`](https://pnpm.io), utilise **TypeScript**, **ESM**, et suit une approche modulaire :  
chaque service et chaque lib est dans un dossier indépendant.

---

## 📁 Structure du projet

```
ban-platform/
├── apps/
│   ├── bal-parser/         # Service d'import des fichiers BAL
│   └── ...                 # Autres services
├── packages/
│   ├── shared-lib/         # Librairie partagée (utils, helpers, etc.)
│   └── ...                 # Autres libs
├── tsconfig.base.json      # Config TypeScript partagée
├── .eslintrc.cjs           # Config ESLint partagée
├── pnpm-workspace.yaml     # Déclaration des workspaces
```

---

## 🔧 Installation

Assurez-vous d’avoir installé :
- [Node.js 24+](https://nodejs.org/)
- [PNPM](https://pnpm.io/)

Puis :
```bash
pnpm install
```

---

## 💻 Développement classique

Pour développer un service en direct avec hot-reload :

```bash
pnpm --filter @ban/bal-parser dev
```

> Utilise `tsx` pour exécuter les fichiers sources avec rechargement automatique.

---

## 🚀 Démarrage local complet via artifacts CI

Cette approche permet de récupérer automatiquement les artifacts produits par la CI et de lancer un environnement complet BAN (RabbitMQ, PostgreSQL, MongoDB et tous les services BAN) en local.

### 🛠️ Prérequis supplémentaires
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac/Win) ou Docker Engine (Linux)
- [GitHub CLI (`gh`)](https://cli.github.com/) + authentification :
  ```bash
  gh auth login
  ```
- [fzf (menu interactif CLI)](https://github.com/junegunn/fzf)
- `tar` et `unzip` (présents par défaut sur Mac/Linux).

---

### ▶️ Lancer BAN
```bash
pnpm ban:start
```

Ce script :
1. Vérifie les prérequis (Docker, gh, etc.)
2. Liste les derniers runs CI GitHub (workflow **Build & Package BAN Services**)
3. Télécharge les artifacts `.tar.gz`
4. Extrait les services BAN dans `.services/`
5. Propose un démarrage :
   - **Docker** : chaque service dans un container Node
   - **Local** : chaque service lancé via `node dist/index.js`
6. Lance RabbitMQ, PostgreSQL, MongoDB

**Accès RabbitMQ UI** : [http://localhost:15672](http://localhost:15672)  
*(login : guest / pass : guest)*

---

### 🛑 Arrêter BAN
```bash
pnpm ban:stop
```
Ce script stoppe :
- RabbitMQ, PostgreSQL, MongoDB
- Les containers BAN (mode Docker)
- Les processus Node locaux (mode Local)

---

### 🔗 Flux CI → Artifacts → Script

```mermaid
flowchart LR
    A[CI GitHub Actions<br/>(Build Matrix)] --> B[Artifacts<br/>(.tar.gz)]
    B --> C[Script<br/>(dev-run-artifacts.sh)]
    C --> D[Docker<br/>(Containers Node)]
    C --> E[Local<br/>(Process Node.js)]

    style A fill:#4CAF50,stroke:#333,stroke-width:1px,color:#fff
    style B fill:#FF9800,stroke:#333,stroke-width:1px,color:#fff
    style C fill:#03A9F4,stroke:#333,stroke-width:1px,color:#fff
    style D fill:#9C27B0,stroke:#333,stroke-width:1px,color:#fff
    style E fill:#9C27B0,stroke:#333,stroke-width:1px,color:#fff

    linkStyle default stroke:#333,stroke-width:1.5px
```

---

### 🔎 Structure générée
Le script crée deux dossiers ignorés par Git :
```
.artifacts/      # Artifacts CI téléchargés
.services/       # Microservices extraits + docker-compose généré
  ├─ apps/
  │   ├─ bal-parser/
  │   └─ beautifier/
  └─ packages/
      ├─ shared-lib/
      └─ config/
```

---

## 🧩 Mode Docker vs Mode Local

- **Docker** → environnement isolé proche de la prod (containers Node).
- **Local** → exécution directe en Node.js (pratique pour debug rapide).

---

## 🛠️ Outils dev

### 🧹 Linter
```bash
pnpm lint
```
> Utilise [eslint-stylistic](https://eslint.style/) sans Prettier.

### 🏗️ Build manuel
```bash
pnpm build
```
*(La CI se charge déjà de builder à chaque push sur `main`.)*

### 🧪 Tests
À venir.

---

## ➕ Ajouter un nouveau service

```bash
mkdir -p apps/mon-nouveau-service/src
cd apps/mon-nouveau-service
pnpm init -y
```

Dans `package.json` :
```json
{
  "name": "@ban/mon-nouveau-service",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsx watch src/index.ts"
  }
}
```

Puis un `tsconfig.json` :
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

## ✅ Prêt pour démarrer !

- Dev classique : `pnpm --filter @ban/mon-service dev`
- Environnement complet (CI artifacts) : `pnpm ban:start`

---

### Mode DEV - Build local (`deploy-dev.sh`)

**Pour développer et tester vos modifications en local**

Ce mode build les images Docker directement depuis votre code source local.

#### Prérequis
- Docker en cours d'exécution
- PNPM installé
- Fichier `.env.docker` ou `.env` configuré

#### Commandes

```bash
# Voir ce qui sera généré (Dockerfiles + docker-compose)
./deploy-dev.sh plan

# Build les images localement et démarrer tous les services
./deploy-dev.sh apply

# Arrêter tous les services
./deploy-dev.sh down
```
-

### Mode PROD - Images depuis GitHub Registry (`deploy-prod.sh`)

**Pour utiliser les images de production depuis GitHub Container Registry**

Ce mode pull les images Docker pré-buildées par la CI/CD GitHub Actions.

#### Prérequis
- Docker en cours d'exécution
- Accès au GitHub Container Registry (ghcr.io)
- Fichier `.env.docker` ou `.env` configuré

#### Commandes

```bash
# Voir ce qui sera généré avec le tag "latest"
./deploy-prod.sh latest plan

# Pull les images et démarrer tous les services
./deploy-prod.sh latest apply

# Utiliser un tag spécifique (branche, version)
./deploy-prod.sh feat-add-docker-latest apply
./deploy-prod.sh v1.2.3 apply

# Arrêter tous les services
./deploy-prod.sh down
```

**Tags disponibles :**
- `latest` : Dernière version de la branche `main`
- `feat-branch-name-latest` : Dernière version d'une feature branch
- `v1.2.3` : Version taguée spécifique