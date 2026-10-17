# Qualification des optimisations PostgreSQL des exports

Le support commun et la préparation explicite des bases sont décrits dans
[README.md](README.md). Les commandes ci-dessous ne sont pas des installations
sur une base applicative. Les mesures datées sont conservées comme références
historiques, pas comme résultats de la réorganisation de la stack.

## Cache des métadonnées DIFF (migration 0011)

`0011_cache_diff_district_metadata` remplace les deux enveloppes NDJSON des
adresses et toponymes. Pour les sélections sans UUID, deux dictionnaires internes
à la requête résolvent les codes commune : borne de début pour `disabled`, borne
de fin pour les autres événements. Les communes sont résolues sans filtre
départemental pour conserver les références croisées et la priorité des états.
Avec des UUID explicites, la recherche ciblée existante est conservée.

La migration ne change ni les fonctions de consolidation métier, ni les FULL,
ni les données ni les index. Elle conserve signatures et droits. Les treize fichiers
déjà partagés restent inchangés. Les tests Prisma couvrent aussi une base ayant
déjà appliqué ces treize migrations, puis un second deploy sans effet.

Sur les petites bases synthétiques préparées selon [README.md](README.md) :

```sh
RUN_BAN_POSTGRES_TESTS=1 node --test packages/prisma-client/tests/diff-metadata.postgres.test.mjs
```

Les comparaisons ancien/nouveau portent sur cinq périodes, les filtres NULL,
UUID/communes/toponymes/départements, les tableaux vides, les bornes temporelles,
les trois événements, les codes historiques, DROM et valeurs de repli. Chaque
essai se termine par `ROLLBACK`, y compris les contrôles des droits et du schéma.
Les mesures de performance sur données réelles restent distinctes : caches,
concurrence et transport S3 doivent être précisés ; ce cache ne résout pas à lui
seul tous les coûts d'accès aux historiques denses.

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
Le contrat v0.4 autorise donc `created` avec `status: "disabled"`.
La migration de performance ne change pas cette règle métier.

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

## Optimisation des snapshots d'adresses (0008)

`0008_optimize_address_snapshot_filters` remplace uniquement `ban.snapshot_address`.
L'objectif est d'éviter un parcours et un tri nationaux avant d'appliquer un
filtre départemental. Elle utilise les index existants, sans nouvelle table,
index, réécriture de données, changement de signature, propriétaire ou droits.
Le wrapper NDJSON reste inchangé et utilise la fonction après son installation.

La fonction présélectionne les **identifiants** ayant une version active valide
dans les départements demandés à la date du snapshot. Pour chaque identifiant,
elle recherche ensuite toutes ses versions actives valides, puis applique la
priorité existante (table actuelle avant historique) et les filtres finaux.
Elle ne filtre pas directement toutes les versions avant leur sélection : cela
pourrait faire réapparaître un état historique si l'état courant ne correspond
plus au département ou au toponyme demandé. Un accès `LATERAL` avec `OFFSET 0`
conserve les recherches par identifiant, y compris aux dates historiques, au
lieu de laisser le planificateur reformer un parcours global. Sans filtre
départemental (`NULL`), le chemin non restreint conserve la sélection précédente.

### Tests d'équivalence isolés

Utiliser la petite base `ban_export_validation_tmp` préparée plus haut, avec
le jeu synthétique ; ne pas la recréer ni la réinitialiser si elle existe.
Depuis la racine du dépôt :

```sh
RUN_BAN_POSTGRES_TESTS=1 node --test packages/prisma-client/tests/address-snapshot.postgres.test.mjs
```

Les **88 tests** couvrent six dates et quatorze combinaisons de filtres, les
bornes temporelles à la microseconde, les tableaux vides et sélections absentes,
l'équivalence exacte fonction/wrapper NDJSON, les valeurs nulles et libellés
vides, les droits et le retour arrière.
Un scénario supplémentaire crée uniquement dans la transaction des versions
actuelle/historique qui se chevauchent entre les deux tables : la version actuelle
reste prioritaire même si sa commune ou son toponyme ne correspond pas au filtre.
Ces chevauchements inter-tables sont permis par la structure de test ; aucune
contrainte d'exclusion historique n'est désactivée. Chaque essai se termine par
**ROLLBACK** ; aucun changement n'est conservé sur cette base de tests. Sans
opt-in, seul le contrôle statique s'exécute et les essais PostgreSQL sont ignorés.

### Mesurer le SELECT proposé sans installer la fonction

```sh
RUN_BAN_POSTGRES_TESTS=1 node packages/prisma-client/tests/benchmark-address-snapshot.mjs \
  /chemin/vers/jeu-96/data.json \
  /chemin/vers/un-nouveau-rapport.json
```

Ce diagnostic est explicitement limité à la candidate locale
`ban_restore_validation`, rôle `ban_user`, dans `ban_postgres`, avant installation
de 0008 : il exige huit migrations terminées, 17 fonctions et la définition de
référence de 0006. Il ne fonctionne pas tel quel sur une autre base ou après
0008 ; adapter explicitement ce diagnostic si sa cible/référence change.

Il exécute la variante **SELECT** dans des transactions `READ ONLY`, bornées à
30 secondes, et ne crée aucune fonction. Le jeu JSON doit couvrir le département
96 et comporter des versions historiques : ses UUID bornent une référence
indépendante des états réels. Les douze comparaisons portent sur six dates,
département seul puis département avec UUID. L'ancienne variante sans UUID
reçoit uniquement un `EXPLAIN` sans exécution ; la nouvelle reçoit un
`EXPLAIN ANALYZE`. Les sorties sont comparées aux états des tables et à la
fonction installée appelée avec UUID. Fonctions, propriétaires/ACL et registre
Prisma sont contrôlés identiques avant/après. Le rapport doit être nouveau ;
ne pas remplacer une tentative précédente. Les erreurs et cas interrompus sont
consignés, pas comptés comme validations réussies.

Mesures locales du 9 octobre 2026 : douze comparaisons exactes réussies.
La sélection départementale seule prend environ **0,94 à 0,98 seconde** selon
la date, et retrouve notamment 21 adresses actuelles ou trois historiques.
Les sélections avec UUID prennent environ **5 à 18 ms**. Ce sont des durées
de SELECT local, pas celles d'un export complet ni une garantie nationale ;
la charge, le cache et la taille des départements influencent les résultats.
La comparaison sur ce jeu ne garantit pas les performances de tous les filtres.

Le département fictif 96 est un jeu de **couverture des cas d'usage**, pas un jeu
représentatif de performance. Les mesures ci-dessus servent au diagnostic du
plan SQL. La qualification de performance de l'équipe doit faire l'objet d'un
lot distinct sur le département 31, avec périodes, volumes et sélections définis.

### Installation et retour arrière distincts

La préparation et ces tests **n'installent pas 0008 sur la candidate**. Après
relecture et autorisation de déploiement, contrôler la base cible, les migrations
déjà terminées et les index de support, puis sauvegarder sa définition réelle.
Appliquer via le workflow Prisma et rejouer les exports applicatifs sans UUID,
les cas absents, les schémas et la sémantique dans les formats concernés.

Ne pas modifier 0006/0007 déjà appliquées : leurs empreintes sont enregistrées.
`support/rollback-address-snapshot.sql` fournit la définition de référence ;
la comparer à la sauvegarde réelle avant une utilisation autorisée. Le retour
arrière conserve la signature et le wrapper, mais n'annule pas automatiquement
l'entrée Prisma : traiter le registre selon la procédure de déploiement retenue.
Ni installation ni retour arrière ne sont automatiques.

## Optimisation de la génération des snapshots (0009)

`0009_optimize_snapshot_generation` est une optimisation durable des fonctions
appelées par les exports FULL, pas un script à exécuter pour chaque fichier.
Elle complète 0008 et remplace seulement :

- `ban.snapshot_common_toponym` : présélection des identifiants des toponymes
  du département avant la sélection/tri des versions valides ;
- `ban.snapshot_common_toponym_ndjson` et `ban.snapshot_address_ndjson` :
  résolution des codes communes une fois par requête non bornée par UUID,
  au lieu de rappeler `snapshot_district_cog` pour chaque ligne.

La résolution des communes est matérialisée dans un CTE : c'est un résultat
temporaire interne à **une requête**, pas une table, une vue matérialisée ni
un cache applicatif durable. Elle utilise la date demandée et les mêmes règles
de priorité courant/historique que `snapshot_district`. Elle ne filtre pas les
communes par département : cela pourrait changer le COG associé à un enfant
lorsque des versions de commune se chevauchent entre les deux tables.
Un éventuel filtre explicite de communes (`district_ids`) borne la résolution.
Avec des UUID d'objets explicites (`ids` non `NULL`), les wrappers conservent
la recherche ciblée par ligne, sans charger la résolution globale des communes.

Le toponyme sélectionné conserve la priorité courant avant historique et le tri
sur la borne supérieure de validité. La présélection concerne des **identifiants**,
pas uniquement les versions qui correspondent au département. Les filtres finaux
restent appliqués après le choix de la version, comme dans 0008 pour les adresses.
Le fallback des métadonnées et les statuts sont inchangés.

La migration est atomique (`BEGIN` / `COMMIT`). Elle n'ajoute ni index ni fonction,
ne réécrit aucune donnée métier et conserve signatures, propriétaires et droits
avec `CREATE OR REPLACE FUNCTION`. Elle ne touche pas aux fonctions DIFF,
à `snapshot_address` (0008), à l'API ou au sérialiseur.
Les requêtes applicatives existantes bénéficient du changement après installation.

### Vérifier l'équivalence sur les petites bases existantes

Utiliser `ban_export_validation_tmp` avec le jeu synthétique et
`ban_fixture_validation_tmp` sans données, préparées plus haut. Examiner d'abord
leur état ; ne pas les supprimer ou les réinitialiser automatiquement.

```sh
RUN_BAN_POSTGRES_TESTS=1 node --test packages/prisma-client/tests/snapshot-generation.postgres.test.mjs
```

Les 164 tests couvrent six dates, douze sélections de toponymes, quatorze
sélections d'adresses, les bornes à la microseconde, les UUID et tableaux vides,
les versions courant/historique, les COG historiques et conflits de départements,
les parents désactivés ou `NULL`, les métadonnées de fallback, les libellés
d'adresse facultatifs, la base vide, les droits et le retour arrière.
Les résultats métier sont comparés exactement ; l'ordre des lignes est normalisé
pour la comparaison SQL, puisque ces fonctions n'exposent pas de garantie `ORDER BY`.

Les tests installent la référence 0008 et les définitions proposées uniquement
dans leurs transactions, puis les annulent. Ils extraient les trois définitions
sans le `BEGIN` / `COMMIT` du fichier de migration afin que celui-ci ne puisse
pas valider les jeux temporaires créés par un test. Un contrôle statique vérifie
qu'aucune autre instruction n'est omise lors de cette extraction.
Sans `RUN_BAN_POSTGRES_TESTS=1`, seul ce contrôle statique s'exécute.

Pour lancer les trois suites PostgreSQL dans une même commande, utiliser
`--test-concurrency=1` : elles partagent la petite base et modifient des fonctions
dans leurs transactions. Ne pas lancer plusieurs suites opt-in indépendantes
simultanément sur la même base.

### Diagnostic SQL du 31, sans installation

Depuis la racine du dépôt :

```sh
RUN_BAN_POSTGRES_TESTS=1 node packages/prisma-client/tests/benchmark-snapshot-generation.mjs \
  working/snapshot-generation-diagnostic-NOUVEAU.json
```

Ce diagnostic est volontairement limité à la candidate locale
`ban_restore_validation`, dans `ban_postgres`, rôle `ban_user`, **avant 0009**.
Il exige 17 fonctions, neuf migrations terminées et les définitions de référence
de 0008. Sa date est le 1er juin 2026 à minuit Europe/Paris ; son département est
le 31. Pour une autre cible, date ou version, adapter explicitement le diagnostic.

Il exécute seulement des `SELECT` et `EXPLAIN` dans des transactions `READ ONLY`
avec un délai de 30 secondes par requête. Le rapport doit être nouveau.
Les définitions SQL proposées sont évaluées comme sous-requêtes : **aucune
fonction n'est créée ou remplacée sur la candidate**, aucun export n'est demandé.
Les catalogues et migrations sont comparés avant/après.

Le diagnostic inspecte les plans départementaux sans exécuter la sélection large
historique. Il compare ensuite deux modes sur au plus 200 identifiants réellement
présents dans chaque table métier :

- `departmentalCacheProbe` : source bornée à l'échantillon mais cache de communes
  actif, pour isoler le coût de résolution des métadonnées ; ce n'est pas un appel
  départemental complet ;
- `explicitUuidRequest` : sélection UUID effective, cache global contourné.

La comparaison de contenu est exacte. Les mesures d'exécution incluent aussi la
sélection et la fabrication SQL des lignes NDJSON de l'échantillon ; elles ne
mesurent pas les en-têtes, la sérialisation applicative, RabbitMQ ou S3.
Enfin, seule la nouvelle sélection départementale des toponymes reçoit un
`EXPLAIN ANALYZE`, toujours avec le même délai maximum.
Ce diagnostic ne chronomètre pas un export FULL. Les caches et la charge
ne sont pas contrôlés et aucun facteur de gain national n'est extrapolé.

### Installation, qualification et retour arrière

Après relecture et autorisation distinctes, sauvegarder les définitions réelles,
vérifier la cible et appliquer via le workflow de migrations Prisma. Ne pas
modifier les migrations 0000 à 0008 déjà appliquées. Rejouer ensuite un export
FULL du 31 au 1er juin 2026 et comparer ses objets/métadonnées métier et ses
volumes avec une référence conforme au contrat, hors timestamps de génération.
Les exports utilisent les fonctions optimisées ; leurs tests de contrat
complètent les contrôles SQL. La comparaison porte également sur `integratedAt`,
qui représente la première intégration explicitement fournie, ou `null`.

`support/rollback-snapshot-generation.sql` contient les trois définitions de
référence avant 0009 et une transaction atomique. Ce retour arrière doit être
comparé aux définitions sauvegardées, puis explicitement autorisé. Il ne remet
pas automatiquement à jour le registre Prisma et ne remplace pas une procédure
de déploiement. La qualification de l'export complet reste une étape distincte
des tests de préparation et du diagnostic SQL.
