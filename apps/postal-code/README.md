# Service postal

Consultation HTTP en lecture seule. Le service possède sa logique et son accès SQL ;
il utilise le pool PostgreSQL existant, sans Sequelize ni worker BAL.
Contrat : [OpenAPI](openapi.yaml).

## Lancer

Utiliser les versions Node.js et pnpm déclarées dans le [package.json racine](../../package.json)
(`engines` et `packageManager`). Construire les packages nécessaires :

```sh
pnpm --filter @ban/prisma-client build
pnpm --filter @ban/postal-code build
pnpm --filter @ban/postal-code dev
```

Les variables sont décrites dans le [modèle de configuration](../../.env.example).
Fournir explicitement `PG_URL` et `POSTAL_CODE_ADMIN_TOKEN` (valeurs de 36 caractères,
séparées par des virgules). Aucun `.env` n’est chargé par ce service.
`POSTAL_CODE_HOST` vaut `127.0.0.1` et `POSTAL_CODE_PORT` vaut `0` : port libre affiché au
lancement. Une autre interface ou un port fixe doit être configuré explicitement.

La migration additive `0012_postal_reference` crée les tables vides de schéma `postal`
et requiert PostGIS disponible côté PostgreSQL. Elle passe par le runner Prisma du projet ;
aucune migration n’est lancée au démarrage HTTP. Vérifier la destination avant toute application.
Aucun référentiel réel n’est fourni ou téléchargé : sans alimentation autorisée, les calculs
retournent `503`. La commande d’alimentation est ajoutée séparément ; l’administration reste hors périmètre.

## Vérifier

```sh
pnpm --filter @ban/postal-code test
pnpm --filter @ban/postal-code exec tsc --noEmit
pnpm --filter @ban/postal-code test:postgres
```

Les unités, handlers et OpenAPI fonctionnent sans service ni socket. La dernière commande
active une intégration transversale migration → PostGIS → résolution → vrai serveur HTTP : le test crée
son conteneur dédié depuis l’image déjà locale `postgis/postgis:17-3.4`, sans téléchargement,
vérifie son identité avant écriture et le supprime par son seul ID. Fixtures fictives uniquement.
Les variables de connexion utilisateur ne sont jamais utilisées par cette intégration.

## Compatibilité et limites

L’enveloppe et `code_postal` sont conservés ; les libellés appariés sont une extension.
Les paramètres sont exclusivement query ; les anciens segments optionnels non exploités
ne sont pas exposés. Les coordonnées sont réellement transformées de 4326 vers 2154.
Les cas vides/ambigus et erreurs SQL ne donnent plus un succès vide ou un premier résultat
arbitraire ; les statuts et règles de frontière figurent dans OpenAPI.

Ce mode ponctuel `ST_Contains` est distinct du calcul historique BAN/ID-Fix par tampon de 10 m.
Toponymes complets, administration, import réel, enrichissement BAL et coordination restent exclus.

Origine fonctionnelle : PR #747 et #749. La consultation HTTP est reprise avec SQL paramétré
via le pool de `@ban/prisma-client`, migrations Prisma et tests isolés. Les anciens imports,
worker BAL, adaptations merger/writer, audit et routes d’administration ne sont pas repris.

## Écriture des références

`reference-writer.ts` prépare les codes et contours dans des tables temporaires propres
à sa connexion. La simulation est le défaut : validation PostGIS puis rollback, sans DML
sur les références consultées. L’application remplace les deux tables ensemble, sous
verrou de publication, par une transaction unique ; les lecteurs voient une version complète.
Codes et libellés contradictoires, contours invalides ou sans code correspondant sont refusés.
Le rejeu remplace le jeu complet sans accumulation. Aucun audit ou import n’est déclenché ici.
Un échec avant COMMIT conserve l’ancienne version ; une confirmation de COMMIT perdue
est signalée comme indéterminée, jamais comme un succès. Les droits d’écriture du schéma
postal sont réservés au futur lancement explicite de l’import, pas requis par la lecture HTTP.
