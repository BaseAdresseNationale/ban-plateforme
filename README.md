# Monorepo NPM + TypeScript

Ce dépôt est une base pour un **monorepo utilisant NPM workspaces**, avec deux applications (`app-a`, `app-b`) et une librairie partagée (`@tonscope/shared-lib`).

---

## 📦 Structure

```
monorepo/
├── apps/
│   ├── app-a/
│   └── app-b/
└── packages/
    └── shared-lib/
```

---

## 🔧 Commandes principales

```bash
npm install          # Installe tout
npm run build        # Build la lib puis les apps
npm run dev:a        # Lance app-a avec ts-node
npm run dev:b        # Lance app-b avec ts-node
```

---

## 📁 Composants

- `@tonscope/shared-lib` : Lib TypeScript réutilisable (publikable sur NPM).
- `app-a` / `app-b` : Deux applis qui consomment la lib partagée.

---
