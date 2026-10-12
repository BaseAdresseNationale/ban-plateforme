# Contrat FULL/DIFF v0.4

Cette arborescence versionne les artefacts de conformité du générateur
`@ban/ban-core-exporter` pour la version 0.4 du contrat des exports FULL et DIFF.

Le format de publication est `ban-standard`. Les descriptions des schémas
proposent des équivalents français inspirés du Standard Adresse CNIG.
Voir les [correspondances du modèle](./analyse/CORRESPONDANCES_STANDARD_ADRESSE.md).

Dans la stack, `feat/ban-diff-v0.4` définit le contrat et valide ses exemples
sans modifier le comportement des services hérités. Son implémentation et les
tests qui importent le générateur sont dans `codex/ban-diff-v0.4-exporter`.
Le [guide de relecture](../../../../../STACK_REVIEW.md) distingue ces périmètres.

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
