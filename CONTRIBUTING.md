# Conventions et qualité du code

Le monorepo utilise **Biome 2.6.7**, verrouillé dans pnpm, pour le lint, le
formatage et le tri des imports. TypeScript et les tests restent nécessaires
pour vérifier les types et les comportements.

## Conventions communes

- Deux espaces, guillemets simples en JavaScript/TypeScript, fins de ligne LF,
  largeur de 100 caractères et points-virgules uniquement si nécessaires.
  Ce style est inspiré de StandardJS, sans en reproduire toutes les règles.
- Règles recommandées Biome, `const` préféré à `let`, pas de `var`, égalité
  stricte, imports/variables inutilisés refusés et modules natifs en `node:`.
- Les imports réservés aux types utilisent `import type` ou le modificateur
  `type` déterminé par Biome. Les imports `.js` requis par NodeNext sont conservés.
- Les imports sont regroupés dans cet ordre, séparés par une ligne vide :
  modules Node.js, dépendances externes, packages `@ban/*`, chemins locaux.
  Les identifiants importés sont triés lexicographiquement.
- Les imports à effets de bord, comme `import 'dotenv/config.js'`, conservent
  leur ordre et séparent les blocs de tri. Ne pas les déplacer automatiquement.
- `any` et les règles expérimentales sur les promesses sont signalés en
  avertissement pendant la migration. Leur correction et leur éventuel passage
  en erreur se décident app par app, sans masquer les diagnostics.

## Travailler sur une app

Installer l’extension VS Code recommandée **Biome** pour activer formatage,
corrections sûres et tri des imports lors d’une sauvegarde explicite.

```sh
pnpm check apps/ban-core-writer/src
pnpm check:fix apps/ban-core-writer/src
pnpm test:quality
pnpm build
```

`check:fix` applique seulement les corrections considérées sûres par Biome.
Relire le diff, puis lancer les tests du composant. Les corrections automatiques
ne garantissent ni le comportement métier ni l’absence de secrets dans les logs.
Les logs doivent exclure credentials, URI de connexion et payloads complets.

Pour traiter uniquement des fichiers déjà ajoutés à l’index Git :

```sh
pnpm check --staged
```

## Migration progressive et CI

Cette première étape installe les conventions **sans reformater tout le dépôt**.
`pnpm lint` et `pnpm check` sans chemin inspectent le dépôt entier ; ils peuvent
échouer sur la dette des apps qui n’ont pas encore été migrées. Ne pas lancer
un formatage global au milieu des travaux en cours.

La CI vérifie chaque fichier modifié par une PR dans son intégralité, comparé à
la branche cible réelle. Elle ne prétend pas valider les fichiers inchangés.
Les avertissements restent visibles ; les erreurs et écarts de formatage/tri
bloquent le contrôle. Une PR documentaire sans fichier pris en charge peut passer.

Pour reproduire ce contrôle après un commit, fournir la bonne base :

```sh
pnpm check:changed --since=origin/codex/poc-export-schema-docs
```

`--changed` vise les changements **committés** ; utiliser `--staged` ou un chemin
explicite pour le travail non committé. Sans `--since`, la référence est `main`.
Les sources générées, sorties de build, migrations SQL, données, lockfile et
Markdown sont exclus de Biome. Les schémas JSON maintenus à la main restent inclus.

Pour chaque app, séparer si possible le commit de formatage/tri des corrections
de logs et de code. Une fois toutes les apps migrées, le contrôle CI pourra
porter sur le dépôt entier.
