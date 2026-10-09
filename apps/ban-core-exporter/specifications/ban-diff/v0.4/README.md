# Contrat BAN/DIFF v0.4

Cette arborescence versionne les artefacts de conformité du générateur
`@ban/ban-core-exporter` pour la version 0.4 du format BAN et DIFF.

La source normative est
[`specifications/SPECIFICATION_BAN_DIFF_V0.4.md`](./specifications/SPECIFICATION_BAN_DIFF_V0.4.md).
Les schémas JSON et les fixtures servent à automatiser sa vérification. La matrice
de décision apporte du contexte, mais ne prévaut pas sur la spécification ni sur les
schémas publics.

Le script `scripts/validate-ban-ndjson.mjs` complète la validation JSON Schema avec
les règles portant sur l'ensemble d'un flux NDJSON. Les fichiers sous
`fixtures/invalid/` doivent systématiquement être rejetés.

Le prompt de mission livré avec l'archive n'est pas versionné ici : il décrit une
instruction de travail, et non le contrat public de l'application.
