# Références postales — stockage

La migration additive `0012_postal_reference` crée les tables `postal.datanova` et
`postal.postal_area`, leurs contraintes et les index communal et spatial.
Les géométries Polygon/MultiPolygon sont en Lambert-93 (EPSG:2154).

Elle utilise le runner de migrations Prisma du projet et nécessite PostGIS.
Les tables restent vides : aucun téléchargement, import ni modification des données BAN.
Vérifier explicitement la destination avant toute application sur un environnement dédié.

Contrôles du schéma et préservation des migrations historiques :

```sh
node --test packages/prisma-client/tests/migrations.test.mjs packages/prisma-client/tests/diff-metadata.test.mjs
```

Ce commit prépare le stockage ; la résolution et son interface HTTP sont livrées séparément.
