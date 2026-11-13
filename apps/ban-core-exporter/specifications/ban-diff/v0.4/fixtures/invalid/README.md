# Fixtures invalides v0.4

Ces fichiers sont volontairement non conformes. Un validateur ou le générateur ne doit jamais les accepter comme exports valides.

| Fichier | Règle violée | Résultat attendu |
| --- | --- | --- |
| `ban-standard-full-address-mismatch.ndjson` | Une ligne `address` porte un objet district. | Rejet : le type de ligne ne correspond pas à l'objet. |
| `ban-standard-diff-updated-single-state.ndjson` | Un `updated` ne contient qu'un état. | Rejet : `updated` exige `[après, avant]`. |
| `ban-standard-diff-disabled-active.ndjson` | Un `disabled` porte `status: active`. | Rejet : un objet désactivé doit être `disabled`. |
| `ban-standard-diff-invalid-period.ndjson` | La borne `from` est postérieure à la borne `to`. | Rejet : la période doit vérifier `from < to`. |
