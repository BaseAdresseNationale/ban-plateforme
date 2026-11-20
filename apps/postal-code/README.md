# Service postal

Consultation HTTP et alimentation explicite des références postales. Le service possède
sa logique et ses accès SQL ; il réutilise le pool de `@ban/prisma-client`.
Contrat HTTP : [OpenAPI](openapi.yaml). Import : [procédure et formats](IMPORT.md).

## Lancer la consultation

Versions requises : [package.json racine](../../package.json), `engines` et `packageManager`.
Depuis la racine, dépendances et client Prisma préparés :

```sh
pnpm --filter @ban/prisma-client build
pnpm --filter @ban/postal-code build
pnpm --filter @ban/postal-code dev
```

Fournir `PG_URL` et `POSTAL_CODE_ADMIN_TOKEN` : jetons de 36 caractères sans espace,
séparés par des virgules ; le client envoie `Authorization: Token <jeton>`.
Variables dans le [modèle](../../.env.example), aucun `.env` chargé automatiquement.
Défauts : `POSTAL_CODE_HOST=127.0.0.1`, `POSTAL_CODE_PORT=0` (port libre affiché).
Le service local utilise HTTP ; une exposition différente reste une configuration explicite.

La migration additive `0012_postal_reference` crée les tables vides et index, via le runner
Prisma du projet, avec PostGIS. Vérifier la destination avant toute application.
Aucune migration ni alimentation au démarrage : sans références, la consultation répond `503`.

## Alimenter les références

```sh
pnpm --filter @ban/postal-code run import:references --help
```

Les deux fichiers locaux CSV/GeoJSON constituent un jeu complet. Simulation par défaut ;
`--apply` remplace les deux tables ensemble après validation, dans une transaction.
Projection source et base attendue obligatoires ; fichiers et destination contrôlés.
Le rôle d’import nécessite des droits PostgreSQL d’écriture propres au schéma postal ;
le token HTTP n’est pas utilisé. Détails dans [IMPORT.md](IMPORT.md).

## Vérifier

```sh
pnpm --filter @ban/postal-code test
pnpm --filter @ban/postal-code exec tsc --noEmit
pnpm --filter @ban/postal-code test:postgres
```

Unités/contrats sans services ni socket. La dernière commande active le parcours transversal
migration → import → PostGIS → HTTP/CLI réels : conteneur propre, image PostGIS déjà locale,
ports loopback libres, identité vérifiée, fixtures fictives et nettoyage par ID.
Aucune URL de base utilisateur utilisée par ce harnais ; détails dans son en-tête.

## Compatibilité et limites

L’enveloppe et `code_postal` sont conservés ; libellés appariés ajoutés. Paramètres query
uniquement, WGS84 réellement transformé en Lambert-93, absence/ambiguïté/erreurs explicites.
Recherche ponctuelle `ST_Contains`, distincte du tampon historique BAN/ID-Fix de 10 m.
Pas de calcul pour un toponyme complet, worker BAL, raccord merger/writer, audit ou API
d’administration. Aucun référentiel réel fourni, téléchargé ou chargé pendant les tests.

Origine fonctionnelle : PR #747/#749 ; consultation et alimentation reprises, SQL paramétré
via le pool Prisma à la place de Sequelize, migrations Prisma et tests isolés. Les autres
fonctions ci-dessus restent hors périmètre ; leur lecture n’est pas nécessaire à la revue.
