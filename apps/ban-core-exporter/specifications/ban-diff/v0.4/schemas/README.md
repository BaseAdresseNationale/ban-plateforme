# JSON Schemas BAN v0.4

Les fichiers livrables sont :

- `ban-standard-full-v0.4.schema.json` : chaque ligne d'un flux FULL ;
- `ban-standard-diff-v0.4.schema.json` : chaque ligne d'un flux DIFF.

`ban-standard-definitions-v0.4.schema.json` contient les types partagés référencés par les deux schémas publics.

Chaque propriété, même lorsqu'elle utilise un `$ref`, porte une description
avec un « Équivalent conseillé pour un Standard-FR-CNIG » et une correspondance
conceptuelle avec le CNIG ou son caractère d'extension BAN.
Voir [la table documentaire](../analyse/CORRESPONDANCES_STANDARD_ADRESSE.md).

JSON Schema valide chaque ligne. Les contraintes portant sur plusieurs lignes sont contrôlées par `scripts/validate-ban-ndjson.mjs` : position des bornes, période DIFF, cardinalité des états, unicité par objet et exactitude des statistiques.

Les deux schémas publics appliquent les règles suivantes :

- Le numéro d'adresse (`number`) est facultatif, omis si absent,
  et doit être un entier ≥ 0 s'il est présent. `0` reste accepté pour les données
  historiques, mais ne devrait pas être fourni dans les nouvelles données ;
  il pourra être interdit dans une version ultérieure.
- La géométrie d'un toponyme (`geometry`) reste un champ obligatoire,
  mais peut valoir `null` en l'absence de géométrie historique. Une géométrie
  renseignée doit être un `Point` WGS84 valide. Cette tolérance ne s'étend pas
  aux positions d'adresse, dont la géométrie doit être renseignée.

Ces règles concernent les FULL ainsi que chaque état avant/après d'un DIFF.

Un Point renseigné exige exactement deux coordonnées, longitude puis latitude,
avec les bornes WGS84. Un tableau vide, un seul nombre ou un troisième nombre
ne sont pas acceptés. `integratedAt` porte la première intégration explicitement
fournie, ou `null` si elle est inconnue.
