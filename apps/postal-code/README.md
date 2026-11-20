# Service postal

Consultation, administration HTTP et alimentation explicite des références postales.
Le service possède sa logique et ses accès SQL ; il réutilise le pool de `@ban/prisma-client`.
Contrat HTTP : [OpenAPI](openapi.yaml). Import : [procédure et formats](IMPORT.md).
Le contrat racine référence le fragment [administration](src/admin-routes.openapi.yaml).

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

## Administrer par HTTP

Routes désactivées par défaut (`404`). Définir `POSTAL_CODE_ADMIN_ENABLED=true` et fournir
un rôle PostgreSQL limité au schéma postal : `USAGE` sur le schéma, `SELECT`/`UPDATE` sur
`postal.datanova` ; `SELECT`/`INSERT`/`DELETE` sur `postal.postal_area` et `USAGE` sur sa
séquence pour les contours. Même en-tête `Authorization: Token <jeton>` que la consultation : les
jetons configurés autorisent alors aussi l'administration. Aucun changement de droits SQL
au démarrage. Préférer une instance séparée avec un rôle de lecture pour la consultation.

Après démarrage sur une base jetable déjà alimentée, adapter le port affiché et utiliser
un jeton fictif de test :

```sh
curl --include --request PUT \
  --header 'Authorization: Token test-only-token-00000000000000000000' \
  --header 'Content-Type: application/json' \
  --data '[{"inseeCom":"96001","postalCodes":["96001"],"libelleAcheminementWithPostalCodes":{"96001":"COMMUNE FICTIVE A"}}]' \
  http://127.0.0.1:54321/postal-code/postal-datanova
```

Attendre `200` et `response.totalUpdated=1` si cette commune existe ; `207` détaille les
communes absentes/échouées et les succès déjà appliqués. Aucune commune créée, aucun
contour modifié. Entrées toutes validées avant écriture, puis transaction par commune.
Import complet et administration partagent le verrou de publication ; les validations
des codes/libellés sont communes. L'import suivant remplace toujours le jeu complet.
Le contrat et les limites sont dans [OpenAPI](openapi.yaml). Les champs historiques
`updatedBy`/`updateNote` sont facultatifs, acceptés mais non enregistrés : aucun audit.
Si une confirmation COMMIT est perdue, `503` indique un résultat indéterminé ; le début
du lot peut déjà être appliqué. Ne pas interpréter cette erreur comme un rollback global.

Pour les contours, utiliser `PUT /postal-code/postal-area/district/cog/:cog` : liste
non vide de `{postalCode, geometry}`, GeoJSON Polygon/MultiPolygon en **EPSG:2154**.
Par exemple, sur la même base fictive (adapter port et token), écrire le corps dans
`/tmp/postal-area-test.json` :

```json
[{"postalCode":"96001","geometry":{"type":"Polygon","coordinates":[[[0,0],[20,0],[20,20],[0,0]]]}}]
```

```sh
curl --include --request PUT \
  --header 'Authorization: Token test-only-token-00000000000000000000' \
  --header 'Content-Type: application/json' \
  --data-binary @/tmp/postal-area-test.json \
  http://127.0.0.1:54321/postal-code/postal-area/district/cog/96001
```

Attendre `200`, `createdCount=1` et le nombre de contours supprimés dans `response`.
Les géométries sont fictives ; ne pas les appliquer à un référentiel existant. Validation
partagée avec l'import puis contrôle de topologie PostGIS avant tout effacement ; le
remplacement est transactionnel et limité à cette commune. Une erreur avant COMMIT
conserve ses anciens contours. Datanova reste inchangé : les codes/libellés nécessaires
à la consultation doivent être alimentés séparément, sans réparation automatique.

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
Pas de calcul pour un toponyme complet, worker BAL, raccord merger/writer ou audit.
Aucun référentiel réel fourni, téléchargé ou chargé pendant les tests.

Origine fonctionnelle : PR #747/#749 ; consultation et alimentation reprises, SQL paramétré
via le pool Prisma à la place de Sequelize, migrations Prisma et tests isolés. Les autres
fonctions ci-dessus restent hors périmètre ; leur lecture n’est pas nécessaire à la revue.
