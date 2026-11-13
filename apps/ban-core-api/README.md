# @ban/ban-core-api

Service HTTP de BAN Platform : santé, exports FULL/DIFF et acheminement des BAL.
Les entrées BAL de démonstration restent internes.

## Documentation des API

Les contrats HTTP (paramètres, réponses et exemples) sont décrits dans
[openapi.yaml](openapi.yaml), avec un YAML par famille près du code des routes.
Le README décrit uniquement l’utilisation du service et de ses outils.

Depuis la racine du monorepo, avec Node.js 24 et pnpm 10 :

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @ban/ban-core-api docs:check
pnpm --filter @ban/ban-core-api docs:build
```

`docs:check` valide le contrat et ses références locales. `docs:build` produit
`dist/docs/openapi.json`, généré et ignoré par Git.

## Tests et démarrage

Tests documentaires sans service ni configuration métier :

```sh
pnpm --filter @ban/ban-core-api exec vitest run src/documentation src/routes/openapi-export-contract.test.ts
```

Le démarrage de l’API complète nécessite les packages internes construits et
la configuration des services du projet (voir [le modèle d’environnement](../../.env.example)) :

```sh
pnpm --filter @ban/ban-core-api dev
```
