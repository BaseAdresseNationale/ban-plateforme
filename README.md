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

## 🛠️ Installation (une seule fois)

Assurez-vous d’avoir Node.js ≥ 20 et [pnpm](https://pnpm.io) :

```bash
pnpm install
```

---

## 🧪 Commandes principales

### 🔍 Dev d’un service

Exemple : lancer `bal-parser` en mode développement (watch)

```bash
pnpm --filter @ban/bal-parser run dev
```

> Cette commande utilise `tsx` pour exécuter le fichier source avec rechargement automatique.

### 🏗️ Build complet (toutes les apps/libs)

```bash
pnpm build
```

### 🧪 Tests (à venir)

```bash
pnpm test
```

---

## 📦 Ajouter un nouveau service

```bash
mkdir -p apps/mon-nouveau-service/src
cd apps/mon-nouveau-service
pnpm init -y
```

Ajoutez dans `package.json` :

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

Et un `tsconfig.json` :

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

## 🧹 Linter

```bash
pnpm lint
```

> Utilise [eslint-stylistic](https://eslint.style/) sans Prettier.

---

## 🔎 Quelques rappels sur pnpm

### Installer une dépendance dans une app

```bash
pnpm add ma-dependance --filter @ban/mon-app
```

### Ajouter une devDependency partagée au monorepo

```bash
pnpm add -Dw nom-du-paquet
```

### Exécuter une commande dans tous les workspaces

```bash
pnpm -r run build     # build toutes les apps/libs
pnpm -r run test      # (plus tard) run tous les tests
```

---

## 🔄 Conventions

- Les packages sont nommés sous la forme `@ban/<nom>`
- Tout est en ESM (`"type": "module"`)
- Les alias TypeScript sont disponibles via `@ban/` dans `tsconfig.base.json`

---

## ✨ Astuce dev

Si vous quittez une commande avec `Ctrl+C`, `pnpm` peut afficher un warning inutile — vous pouvez l’ignorer.

---

## ✅ Prêt pour démarrer !

> 🚀 N’hésitez pas à pinguer Nicolas pour ajouter un nouveau service ou une nouvelle lib.
