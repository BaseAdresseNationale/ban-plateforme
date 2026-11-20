# target-key

Enrichit `bal.enrich` avant écriture BAN et publie `bal.enriched.target-key`.
Les clés de ciblage existantes restent inchangées. Le registre PostgreSQL `target_key`
conserve les codes de voie ; aucune lecture des objets BAN ou recherche FANTOIR.

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

## Démarrage

Node.js 24, pnpm 10.12.4. Fournir explicitement `PG_URL`, `RABBITMQ_HOST`, `RABBITMQ_PORT`,
`RABBITMQ_USER`, `RABBITMQ_PASSWORD` et éventuellement `RABBITMQ_VHOST` (défaut `/`).
Aucun `.env` chargé par ce service. Construire Prisma et RabbitMQ avant le service :

```sh
pnpm --filter @ban/prisma-client build
pnpm --filter @ban/rabbitmq build
pnpm --filter @ban/target-key build
node apps/target-key/dist/index.js
```

La migration additive `0014_target_key_registry` est requise. Le transfert des codes
historiques et l'initialisation explicite des communes sont un chantier distinct,
obligatoire avant allocation en production. Le service ne les initialise jamais depuis
une BAL ; une commune absente/non initialisée bloque seulement son fallback.

## Reprises et limites

Confirmation persistante/routable avant ACK. Trois reprises via `ban.target-key.retry`
(TTL 30 s, échange par défaut vers la seule queue d'entrée), puis
`ban.target-key.dead-letter`. Validation/ambiguïté : quarantaine directe. Si sa publication
échoue, original remis en file. Les arguments de la queue d'entrée sont préservés.

**Activation production bloquée** avant coordination du merger : il publie actuellement
des partiels après 5 s, avant ces reprises. Ni exactement une fois, ni succès du writer ou
de la BAL ne sont garantis. Le rejeu conserve les allocations ; même id avec un autre
contenu est refusé. Pas de purge automatique du registre/journal.

Choix du 20 novembre 2026 : génération directe sans recherche FANTOIR ; priorité à la clé
BAL permanente. Source du pseudo-code : `ban-plateforme`, référence
`37c5b9bf706e19a78ab98b13052e1e1283ce1ae5`, `lib/util/base36.cjs` et
`lib/pseudo-codes-voies.cjs`. Format nominal conservé ; cas RNG 0/exponentiel corrigés.
Validation syntaxique locale BAL 1.4 (code de 4 caractères, pseudo-code de 6 caractères,
UUID et suffixes multi-segments),
sans prétendre valider un référentiel national ni imposer la même commune à la clé.
`quater`/`quinquies` fournis ne sont pas prioritaires : BAL attend `qua`/`qui`.
Le suffixe source et le calcul historique ne sont pas normalisés silencieusement.

`@nivalis/normadresse` passe de 2.0.1 à **3.2.0**, version exacte partagée avec
`beautifier`. La version précédente cherchait son CSV via une API Bun incompatible
Node.js ; 3.2.0 embarque ses règles, sans dépendance runtime ni patch local.
Les API `normalize`/`clearRulesCache` et les résultats de 14 exemples fictifs restent
identiques à 2.0.1 corrigée, sans prétendre à une équivalence exhaustive. La limite
nominale de 32 caractères et le repli si le normaliseur rend une chaîne vide restent
inchangés. [Version NPM](https://registry.npmjs.org/@nivalis%2Fnormadresse/3.2.0), publiée
le 27 février 2026, vérifiée le 20 novembre 2026 ; noms/suffixes longs testés sous Node.js 24.

Tests et environnement jetable : [TESTING.md](TESTING.md).
