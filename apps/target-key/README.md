# target-key — calcul et registre

`src/keys.ts` prépare et enrichit une enveloppe BAL validée ; `src/registry.ts`
conserve transactionnellement les codes nécessaires au fallback. Le raccord au
consommateur existant est réalisé dans le commit suivant.

## Clés et registre

- `cle_interop` reste la source brute. Une clé BAL prise en charge, conforme et non `x…`
  est redistribuée exactement dans `ban_enrich_retained_cle_interop`.
- Sinon, le service calcule `ban_enrich_deprecated_cle_interop` avec le code conservé ou
  un pseudo-code BAN historique de six caractères. La sélection utilise ce calcul.
- Une clé fournie prioritaire n'exige ni allocation ni commune initialisée. Elle
  n'enseigne pas le registre. Les clés restent non uniques et ne remplacent aucun UUID.
- Résolution : UUID dans la commune, puis libellé non ambigu, puis allocation.
  Normalisation v1 : NFC, espaces et casse ; accents et ponctuation conservés.
  Renommages et anciennes associations restent conservés ; ambiguïté = quarantaine.

Entrée `{id, rows}` : id opaque de 1–128 caractères (format émis par l'API accepté),
1–100000 lignes, JSON total ≤20 Mo, profondeur ≤12. Numéro entier de 0 à2147483647 ;
index de ligne distinct, UUID facultatifs contrôlés, voie ≤512 caractères, suffixe ≤255,
clé fournie ≤512. Les objets décodés ont les mêmes limites que les chaînes JSON.

La migration additive `0014_target_key_registry` appartient au service. Aucune
lecture des objets BAN ni recherche FANTOIR. Le transfert historique et l'initialisation
explicite des communes sont séparés ; une commune non initialisée bloque le fallback,
jamais une clé permanente fournie dont le calcul BAN n'est pas requis.

Le générateur conserve le format BAN historique six caractères ; bornes RNG0 et
notation exponentielle corrigées. Référence `ban-plateforme` :
`37c5b9bf706e19a78ab98b13052e1e1283ce1ae5`, `lib/util/base36.cjs` et
`lib/pseudo-codes-voies.cjs`. Aucun compteur temporaire x ni identifiant lookup inventé.

## Normalisation et tests

`@nivalis/normadresse` passe de 2.0.1 à **3.2.0**, version exacte partagée avec
`beautifier`. La version précédente cherchait son CSV via une API Bun incompatible
Node.js ; 3.2.0 embarque ses règles, sans dépendance runtime ni patch local.
Les API `normalize`/`clearRulesCache` et les résultats de 14 exemples fictifs restent
identiques à 2.0.1 corrigée, sans prétendre à une équivalence exhaustive. La limite
nominale de 32 caractères et le repli si le normaliseur rend une chaîne vide restent
inchangés. [Version NPM](https://registry.npmjs.org/@nivalis%2Fnormadresse/3.2.0), publiée
le 27 février 2026, vérifiée le 20 novembre 2026 ; noms/suffixes longs testés sous Node.js 24.


Sous Node.js24/pnpm10.12.4, après installation des dépendances sans scripts :

```sh
pnpm --filter @ban/target-key test
pnpm --filter @ban/target-key build
RUN_TARGET_KEY_POSTGRES_TESTS=1 pnpm --filter @ban/target-key test:postgres
```

Les unités sont sans services. L'intégration explicite crée uniquement un conteneur
PostGIS dédié (`--pull=never`, image locale `postgis/postgis:17-3.4`), base et port
loopback uniques, tmpfs ; identité contrôlée avant migration/seed et nettoyage par ID.
Jamais de base existante ni `.env` personnel.
