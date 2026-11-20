# Résolution postale

Le stockage de référence est préparé par la migration additive `0012_postal_reference`.
Aucun référentiel réel n’est fourni, téléchargé ou chargé automatiquement.

`lookup.ts` valide commune et/ou position WGS84 et résout les codes postaux avec leurs
libellés. Les résultats absents, ambigus et les références indisponibles sont distingués.
`repository.ts` fournit des requêtes SQL paramétrées, avec transformation vers Lambert-93
et recherche `ST_Contains`. Le lecteur SQL est injecté ; aucun pool n’est créé à l’import.
Ces modules n’ouvrent aucun serveur HTTP ni connexion.

Versions Node.js/pnpm : [package.json racine](../../package.json).
Depuis la racine, dépendances installées :

```sh
pnpm --filter @ban/postal-code test
pnpm --filter @ban/postal-code build
```

Les tests homonymes de résolution et d’accès SQL fonctionnent sans service.
L’interface HTTP, son authentification et l’intégration complète sont livrées séparément.
