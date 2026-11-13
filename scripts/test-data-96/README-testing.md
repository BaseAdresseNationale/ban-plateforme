# Maintenance et tests du kit département 96

Ce guide est destiné aux développeurs qui modifient les scripts ou vérifient
leur compatibilité avec une nouvelle structure BAN. Pour installer un jeu reçu,
suivre le [guide d'utilisation](README.md) : ces tests ne sont pas un prérequis
pour chaque utilisateur.

## Contrôles sans PostgreSQL

Depuis la racine du dépôt, avec Node.js 24+ :

```sh
node --test scripts/test-data-96/fixture.test.mjs
bash -n scripts/test-data-96/import-test-96.sh
node --check scripts/test-data-96/export-test-96.mjs
node --check scripts/test-data-96/generate-sql.mjs
```

Les onze tests couvrent le périmètre départemental, plusieurs communes 96,
les références, historiques orphelins, doublons, colonnes, dépendances exclues,
échappement du JSON, refus d'écrasement et protection de la base `ban`.

## Préparer les tests PostgreSQL — une seule fois

Les tests utilisent exclusivement `ban_fixture_validation_tmp`, dans
`ban_postgres`, avec `ban_user`. Ces noms sont volontairement verrouillés dans
le helper de test ; ils ne suivent pas les variables configurables des scripts
d'utilisation.

La base doit être vide et posséder la structure minimale décrite dans la rubrique
[Base vide pour les tests des exports](../../packages/prisma-client/tests/README.md#base-vide-pour-les-tests-des-exports).
Elle contient les six tables et les trois triggers `test_historisation`, sans
jeu préchargé. Ce bootstrap synthétique n'est pas une baseline de production.

Avant toute création, vérifier l'absence de cette base et la cible `postgres`.
Si elle existe, examiner ses tables, données et triggers ; ne pas la supprimer,
la vider ou relancer le bootstrap automatiquement. Une base compatible déjà
vide peut être réutilisée. Ne jamais substituer `ban` ou une base applicative.

## Exécuter les tests transactionnels

```sh
RUN_BAN_POSTGRES_TESTS=1 node --test scripts/test-data-96/fixture.postgres.test.mjs
```

Sans `RUN_BAN_POSTGRES_TESTS=1`, ces tests sont ignorés : un résultat « skipped »
ne constitue pas une validation PostgreSQL.

Le jeu par défaut est synthétique. Sept scénarios vérifient les dates d'origine,
un décalage positif à la microseconde, un décalage négatif, l'ancrage, un échec
après désactivation des trois triggers, un doublon et les options incompatibles.
Ils comparent indépendamment toutes les valeurs des six tables et vérifient
l'état des triggers et contraintes après annulation.

Les tests effectuent des INSERT et des ALTER TABLE sur cette seule base.
Même pour un essai réussi, ils remplacent **en mémoire seulement** le COMMIT
final par des contrôles puis ROLLBACK. Ils ne modifient pas les fichiers SQL et
ne qualifient **pas la persistance après un COMMIT réel**. La base reste vide ;
l'état initial des triggers est rétabli. L'échec injecté vérifie aussi
l'annulation à la fermeture de la connexion avec ON_ERROR_STOP.

Ne pas lancer ces tests simultanément avec un import ou un service écrivain.

### Rejouer un export relu, sans l'enregistrer durablement

```sh
export FIXTURE_JSON="/chemin/vers/le-jeu-relu/data.json"
RUN_BAN_POSTGRES_TESTS=1 node --test scripts/test-data-96/fixture.postgres.test.mjs
unset FIXTURE_JSON
```

Cet essai requiert les mêmes six colonnes/types compatibles et la même base
vide. Il ne valide ni la confidentialité du jeu ni l'ensemble des règles métier
des exports. Ne pas ajouter un export réel aux données de test versionnées.

## Validation applicative complémentaire

Pour une évolution du schéma ou des scénarios, contrôler également les endpoints
snapshot/diff aux dates du catalogue. Les contrôles des exports v0.4 sans données
sont documentés dans le [guide de l'exporteur](../../apps/ban-core-exporter/README.md) :
ils appartiennent à l'exporteur, pas au kit.

Un test d'import persistant sur une autre base isolée demande une décision
explicite, avec contrôle de la cible et plan de conservation des données.
Ce guide ne prévoit aucun nettoyage automatique ni remplacement du jeu existant.
