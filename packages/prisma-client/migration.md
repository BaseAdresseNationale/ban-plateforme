# Appliquer et faire évoluer les migrations Prisma

Une **migration** est un fichier SQL versionné dans `prisma/migrations/`.
Prisma les exécute dans l’ordre des dossiers et conserve leurs empreintes dans
`ban._prisma_migrations`. Les fonctions SQL d’export et leurs indexes sont
installés par ces migrations, avec leurs dépendances.

## Choisir le parcours

Fournir `PG_URL` via la configuration locale ou le mécanisme de secrets, vérifier
serveur, base et rôle, puis lancer les commandes depuis la racine du dépôt.
Conserver une sauvegarde avant de modifier une base contenant des données.

| État de la base | Parcours |
| --- | --- |
| Base vide, tables modélisées et couche d’export uniquement | `pnpm db:migrate:deploy` applique toutes les migrations. |
| Dump ou schéma BAN déjà chargé, sans registre Prisma | Comparer la structure à la baseline, reconnaître **seulement** `0000_baseline`, puis lancer deploy. |
| Registre déjà présent | Vérifier son état et ses empreintes, puis appliquer les migrations en attente. |
| Écart de structure, empreinte modifiée ou migration en échec | Arrêter et faire examiner l’écart ; conserver les données et les journaux. |

La **baseline** est le fichier `0000_baseline/migration.sql`, qui décrit les
tables modélisées et leurs indexes initiaux. Elle ne reproduit pas l’ensemble
d’un dump de production : triggers d’historisation, tables supplémentaires et
autres objets doivent être conservés lors de la restauration. Pour initialiser
l’application complète, utiliser le schéma BAN ou un dump validé avant Prisma.

Après vérification de l’équivalence de la structure existante :

```sh
pnpm --filter @ban/prisma-client exec prisma migrate resolve --config prisma.config.ts --applied 0000_baseline
pnpm db:migrate:deploy
pnpm --filter @ban/prisma-client exec prisma migrate status --config prisma.config.ts
```

`resolve --applied` enregistre la baseline **sans exécuter son SQL**. Les migrations
suivantes doivent être exécutées par `deploy`, pas reconnues artificiellement.
Le bootstrap `pnpm db:bootstrap` réalise baseline, deploy et génération du client ;
le réserver à un schéma initial déjà contrôlé, pas à la réparation d’une divergence.

## Installation des exports

Les dix fichiers historiques `0000_baseline` à `0009` gardent leurs noms et leurs
empreintes. Les migrations supplémentaires complètent la chaîne :

- `0000a_export_index_prerequisites`, après la baseline et avant `0001` : extension
  `btree_gist` et index `address_h_range_validity_idx` s’il manque dans le dump.
- `0005a_export_metadata_helpers`, après `0005` et avant `0006` : trois auxiliaires
  de métadonnées et de résolution du code INSEE, utilisés par les fonctions suivantes.
- `0010_complete_export_metadata`, après `0009` : métadonnées dans les trois
  enveloppes communes/toponymes restantes, sans remplacer les fonctions optimisées.
- `0011_cache_diff_district_metadata` : résolution des codes commune aux deux
  bornes des DIFF d'adresses/toponymes. Les sélections par UUID restent ciblées.
  Signatures et droits conservés, sans nouvel index ni réécriture des données.

Prisma trie les **noms complets des dossiers**. Les suffixes `a` permettent de
placer les prérequis avant leur première utilisation, sans renommer l’historique.
Sur une base ayant déjà appliqué les dix fichiers historiques, `deploy` applique
les ajouts en attente, y compris ceux intercalés ; les anciennes lignes du registre
restent intactes. Le parcours est couvert par un test PostgreSQL réel.

La migration historique `0001` construit les autres indexes et actualise les
statistiques ; `0002` à `0006` installent/ajustent les fonctions FULL/DIFF, puis
`0007` à `0009` optimisent leurs requêtes. Prévoir du disque et une fenêtre adaptée
au volume : les créations GiST peuvent être longues et bloquer des écritures.

Les migrations ne réinitialisent pas les données et n’ajoutent pas les trois
contraintes historiques d’exclusion absentes de certains dumps. Leur éventuel
ajout exige un audit distinct. Notifications, abonnements et bascule de connexion
restent aussi des décisions séparées.

## Ajouter ou corriger une migration

1. Créer le prochain dossier numéroté, par exemple `0012_description`, avec un
   fichier `migration.sql`. Versionner tout le SQL nécessaire : fonctions,
   dépendances et indexes, même s’ils ne sont pas représentables dans le modèle Prisma.
2. Vérifier l’ordre des dépendances et prévoir une transaction pour les changements
   qui doivent être atomiques. Documenter les coûts et les verrous importants.
3. Tester une installation neuve et une mise à niveau avec données conservées.
4. Ajouter une nouvelle migration plutôt que modifier un fichier déjà appliqué.
   Un prérequis intercalé est exceptionnel : vérifier aussi son application après
   des migrations plus récentes, sans dégrader leurs optimisations.

**Ne pas modifier les anciens registres pour masquer un écart d’empreinte**, ni
réinitialiser une base contenant des données. Les ajouts sont exécutés par
Prisma ; ils ne doivent pas être simplement marqués comme appliqués.

## Tests

```sh
pnpm --filter @ban/prisma-client test
```

Les tests sans base participent également à `pnpm test`. Les tests réels, leur
préparation et leurs protections sont décrits dans [tests/README.md](tests/README.md).

Référence : [baseline Prisma 7](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining).
