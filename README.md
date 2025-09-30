# 📦 BAN Platform Monorepo

Ce dépôt contient les services et librairies de la plateforme **Base Adresse Nationale (BAN)**.

Il est structuré en **monorepo** avec [`pnpm`](https://pnpm.io), utilise **TypeScript**, **ESM**, et suit une approche modulaire :
chaque service ou librairie se trouve dans un dossier indépendant.

---

## 📁 Structure du projet

```shell
ban-platform/
├── apps/
│   ├── bal-parser/         # Service d'import des fichiers BAL
│   └── ...                 # Autres services
├── packages/
│   ├── shared-lib/         # Librairie partagée (utils, helpers, etc.)
│   └── ...                 # Autres Librairies partagées
├── boilerplate/
│   ├── app/                # Exemple de services
│   └── package/            # Exemple de Librairie partagée
│
├── .env.                   # Variable d'environement
├── .eslintrc.cjs           # Config ESLint partagée
├── pnpm-workspace.yaml     # Déclaration des workspaces
└── tsconfig.base.json       # Config TypeScript partagée
```

---

## 🔧 Installation

Assurez-vous d’avoir installé :

- [Node.js (v24+)](https://nodejs.org/)
- [PNPM (v10.12+)](https://pnpm.io/)
- [Docker (v4+)](https://www.docker.com/)

Puis, installer toutes les dépendances requises :

```bash
pnpm install
```

---

## 💻 Développement classique


### pour lancer tous les services
Installer toutes les dépendances
```bash
pnpm install
```

Pour lancer tout les services dans /ban-plateforme :
```bash
pnpm dev:start
```

la connexion à rabbitMQ nécessite d'attendre que rabbitMQ soit lancé prêt.

faire un Ctl+C pour arrêter le process pnpm dev:start
et relancer pnpm dev:start

la connexion a rabbitMQ est désormais réalisé dans les messages de log de la commande

### Pour développer un service en direct avec hot-reload :

```bash
pnpm --filter @ban/bal-parser dev
```

> Note : Les environnements de développement utilisent `tsx` pour exécuter les fichiers sources avec rechargement automatique.

---

## 🚀 Démarrage local complet à partir des `artifacts` de CI

Cette approche permet de récupérer automatiquement les artefacts produits par la CI et de lancer un environnement complet BAN (RabbitMQ, PostgreSQL, MongoDB et tous les services BAN) en local tout en étant au plus proche des environnements de production.

### 🛠️ Prérequis supplémentaires

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac/Win) ou Docker Engine (Linux)
- [GitHub CLI (`gh`)](https://cli.github.com/) + authentification :
- [fzf (menu interactif CLI)](https://github.com/junegunn/fzf)
- `tar` et `unzip` (présents par défaut sur Mac/Linux).

L'authentification est obligatoire pour récupérer les artefacts depuis GitHub :

  ```bash
  gh auth login
  ```

---

### ▶️ Télécharger et démarrer BAN-Platform

```bash
pnpm ban:start
```

Ce script :

1. Vérifie les prérequis (Docker, gh, etc.)
2. Liste les derniers runs CI GitHub (workflow **Build & Package BAN Services**)
3. Télécharge les artefacts `.tar.gz`
4. Extrait les services BAN dans `.services/`
5. Propose un démarrage :
   - **Docker** : chaque service dans un container Node
   - **Local** : chaque service lancé via `node dist/index.js`
6. Lance RabbitMQ, PostgreSQL, MongoDB

**Accès RabbitMQ UI** : [http://localhost:15672](http://localhost:15672)
*(login : guest / pass : guest)*

---

### 🛑 Arrêter BAN-Platform

```bash
pnpm ban:stop
```

Ce script stop :

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

```shell
.artifacts/      # Artifacts CI téléchargés et téléchargé depuis Github
.services/       # Microservices extraits depuis les artifacts apres leurs téléchargements + docker-compose généré
  ├─ apps/
  │   ├─ bal-parser/
  │   └─ beautifier/
  └─ packages/
      ├─ shared-lib/
      └─ config/
```

---

## 🧩 Mode Docker vs Mode Local

- **Docker** → À privilégier : environnement isolé proche de la prod (containers Node)
- **Local** → Exécution directe en Node.js (pour un debug rapide).

---

## 🛠️ Outils dev

### 🧹 Linter

```bash
pnpm lint
```

> Utilise `[eslint-stylistic`](https://eslint.style/) sans `Prettier`.

### 🏗️ Build manuel

```bash
pnpm build
```

*(La CI se charge déjà de builder à chaque push sur `main`.)*

### 🧪 Tests
dans le dossier /ban-plateforme, lancer la commande
```
npx vitest apps/**/*.test.*
```

---

## ➕ Ajouter un nouveau service 

### À partir des boilerplate

Le dossier `/boilerplate` contient un exemple d'application (`/boilerplate/app`) et de package (`/boilerplate/package`).
Vous pouvez les récupérer et les copier dans le dossier adéquat (`/apps` ou `/packages`).

```bash
cp -r /boilerplate/app apps/mon-nouveau-service
cd apps/mon-nouveau-service
```

Dans le fichier `package.json`, renommer le nouveau service (sur la clé `name`) :

```json
{
  "name": "@ban/mon-nouveau-service",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "dev": "tsx watch src/index.ts || true"
  }
}
```

Si besoin, ajouter des dépendances spécifiques à ce service :

```bash
pnpm install --filter @ban/mon-nouveau-service ma-dependance
# exemple : pnpm install --filter @ban/mon-nouveau-service lodash
```

### Vanilia

```bash
mkdir -p apps/mon-nouveau-service/src
cd apps/mon-nouveau-service
pnpm init -y
```

Dans `package.json`, personnaliser le nom du service (sur la clé `name`) et ajouter les scripts essentiels :

```json
{
  "name": "@ban/mon-nouveau-service",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "dev": "tsx watch src/index.ts || true"
  }
}
```

Puis ajouter un `tsconfig.json` :

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

## Initialiser les données

Copier le contenu d'un des fichiers csv du dossier /ban-plateforme/apps/bal-parser/input-samples/ 

Copier par example bal-96001-cocorico.1.4.fra.geo.csv

Après que les containers soient lancés

Lancer le curl suivant :
```
curl --location 'http://localhost:3000/bal/text' \
--header 'Content-Type: text/plain' \
--data '
ici coller le contenu du csv
'
```
ou utiliser un client http comme postman pour lancer la requête

dans mongo express http://localhost:8081/, une nouvelle base 'ban' est ajoutée avec les collections addresses, districts, mainToponyms
