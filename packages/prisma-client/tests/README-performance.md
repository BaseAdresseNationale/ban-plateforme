# Qualification des optimisations PostgreSQL des exports

Le support commun et la préparation explicite des bases sont décrits dans
[README.md](README.md). Les commandes ci-dessous ne sont pas des installations
sur une base applicative. Les mesures datées sont conservées comme références
historiques, pas comme résultats de la réorganisation de la stack.

## Une optimisation durable, des outils de vérification séparés

La migration `0007_optimize_address_diff_filters` est un changement applicatif,
pas un script ponctuel destiné au seul poste local. Elle remplace la définition
de `ban.diff_address`, appelée par `ban.diff_address_ndjson` lors des exports
DIFF d'adresses. Elle reformule les filtres pour permettre au planificateur
PostgreSQL de mieux exploiter les index existants, notamment pour une sélection
par département ou UUID, sans changer les résultats attendus.

La migration s'applique une fois par base via le workflow de migrations Prisma.
La nouvelle définition reste ensuite en base et sert à chaque appel de cette
fonction, localement ou dans un environnement déployé. Elle ne crée aucun index,
ne réécrit aucune donnée métier et ne modifie pas les droits ou le propriétaire
de la fonction existante. Elle ne concerne pas le kit d'extraction/import 96.

Les fichiers de ce dossier ont un autre rôle : les tests d'équivalence et le
jeu synthétique sont réutilisables pour prévenir les régressions ; le SQL de
retour arrière sert à préparer une éventuelle annulation de la migration.
Ils ne sont pas exécutés à chaque export ni par la migration elle-même.
Le benchmark est un diagnostic spécifique à la candidate et aux périodes de
l'export local indiqué ci-dessous, pas un composant requis en fonctionnement
normal ni une mesure de performance nationale. Son adaptation à une autre base
ou à d'autres scénarios doit être explicite.

Les validations isolées et mesures locales ne remplacent pas la qualification
applicative après installation. L'installation sur la candidate reste une
opération distincte, soumise à relecture et autorisation ; ces commandes de test
ne l'effectuent pas.

## Tests d'équivalence de 0007

Préparer la petite base synthétique selon le [guide commun](README.md), puis,
depuis la racine du dépôt :

```sh
RUN_BAN_POSTGRES_TESTS=1 node --test packages/prisma-client/tests/address-diff.postgres.test.mjs
```

Sans opt-in, les tests PostgreSQL sont ignorés. Les cibles sont verrouillées par
nom et vérification de `current_database()`. Chaque comparaison remplace la
fonction dans une transaction de test puis effectue un **ROLLBACK**. Aucun test
ne réinitialise automatiquement les bases.

Les tests comparent exactement l'ancienne fonction et la nouvelle, ainsi que
leur wrapper NDJSON : quatre périodes et huit combinaisons de filtres. Ils
vérifient création, modification, désactivation, absence de résultat et retour
arrière. Une équivalence ne démontre pas à elle seule toute la conformité métier
de la fonction historique ; cette migration ne modifie pas la classification.

Cas de consolidation confirmé sur le jeu synthétique : une période commençant
avant la création d'une adresse et finissant après sa désactivation renvoie
`created` avec `isActive=false`. Cette classification est conservée : la création
décrit l'apparition de l'objet pendant la période, son statut décrit l'état final.
Le contrat v0.4 autorise donc `created` avec `status: "disabled"` (ou `statut`
en Standard FR). La migration de performance ne change pas cette règle métier.

## Benchmark de la candidate, en lecture seule

```sh
RUN_BAN_POSTGRES_TESTS=1 node packages/prisma-client/tests/benchmark-address-diff.mjs \
  PG-Dump.backUp/ban-database-doc/test-data-96/export-2026-10-08/data.json \
  working/address-diff-benchmark-2026-10-09.json
```

Le fichier de résultat doit être nouveau. Le script exige la candidate
`ban_restore_validation` et l'ancienne définition comme référence. Il exécute
uniquement des SELECT/EXPLAIN dans des transactions READ ONLY, avec un délai de
30 secondes, compare les états réels du jeu 96 et vérifie la fonction inchangée.
Les fenêtres sont celles de cet export daté : adapter ce benchmark explicitement
pour un autre jeu. Aucun résultat national n'est extrapolé et aucun index créé.

Mesures locales du 9 octobre 2026 : les 33 tests PostgreSQL passent. Sur la
candidate, la variante SELECT renvoie exactement 21 créations en **1 033 ms**
avec le département seul, et **11 ms** avec les UUID du jeu. La transition
renvoie exactement une modification (259 ms / 11 ms) et la période stable
aucun événement (environ 3 ms). Ces durées ne comprennent pas l'export complet
et varient avec le cache, la charge et la planification. La définition de la
fonction candidate a été vérifiée inchangée après les mesures.

## Application future et retour arrière

La migration conserve la signature, les droits/propriétaire de la fonction
existante et son comportement. Elle expose `params` au planificateur avec
`NOT MATERIALIZED`, puis rend la sélection des communes indexable avec
`= ANY(ARRAY(...))`. Elle ne crée aucun index et n'écrit aucune donnée métier.

Son application à une candidate ou à une autre base demande une relecture et
une autorisation distinctes. Avant application, vérifier la cible, sauvegarder
sa définition réelle et s'assurer que les index de support sont présents.
`support/rollback-address-diff.sql` contient la définition de référence du lot
précédent ; ne l'appliquer qu'après comparaison avec la définition sauvegardée.
Un retour arrière SQL n'efface pas automatiquement l'entrée de migration Prisma :
traiter le registre selon le workflow de déploiement retenu, sans le réécrire
aveuglément. Aucun retour arrière n'est automatique.

