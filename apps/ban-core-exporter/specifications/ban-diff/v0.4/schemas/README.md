# JSON Schemas BAN v0.4

Les fichiers livrables sont :

- `ban-raw-full-v0.4.schema.json` : chaque ligne d'un flux Full Raw ;
- `ban-raw-diff-v0.4.schema.json` : chaque ligne d'un flux DIFF Raw ;
- `ban-standard-fr-full-v0.4.schema.json` : chaque ligne d'un flux Full Standard FR ;
- `ban-standard-fr-diff-v0.4.schema.json` : chaque ligne d'un flux DIFF Standard FR.

Les fichiers `ban-raw-definitions-v0.4.schema.json` et `ban-standard-fr-definitions-v0.4.schema.json` contiennent les types partagés référencés par les quatre schémas publics. Ils ne valident pas seuls un flux.

JSON Schema valide chaque ligne. Les contraintes portant sur plusieurs lignes sont contrôlées par `scripts/validate-ban-ndjson.mjs` : position des bornes, période DIFF, cardinalité des états, unicité par objet et exactitude des statistiques.
