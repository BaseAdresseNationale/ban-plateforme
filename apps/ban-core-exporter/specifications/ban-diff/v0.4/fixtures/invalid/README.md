# Fixtures invalides v0.4

Ces fichiers sont volontairement non conformes. Un validateur ou le générateur ne doit jamais les accepter comme exports valides.

| Fichier | Règle violée | Résultat attendu |
| --- | --- | --- |
| `raw-full-address-mismatch.ndjson` | Une ligne `address` porte un objet district. | Rejet : le type de ligne ne correspond pas à l'objet. |
| `raw-diff-updated-single-state.ndjson` | Un `updated` ne contient qu'un état. | Rejet : `updated` exige `[après, avant]`. |
| `raw-diff-disabled-active.ndjson` | Un `disabled` porte `status: active`. | Rejet : un objet désactivé doit être `disabled`. |
| `standard-fr-diff-invalid-period.ndjson` | La borne `de` est postérieure à la borne `a`. | Rejet : la période doit vérifier `de < a`. |
