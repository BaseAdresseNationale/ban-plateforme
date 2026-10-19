# @ban/ban-core-exporter

Microservice charge de traiter les demandes d'export de donnees BAN.

Il consomme les commandes `export.requested`, génère un flux NDJSON vers les destinations choisies, puis met à jour le statut de la demande dans `ban.job_status`.

Les exports FULL et DIFF sont publiés au format `ban-standard`. La sélection
effective est regroupée dans `meta.request` (dates, départements,
types et éventuels UUID).
Les objets obtenus sont les lignes métier, comptées à la clôture.
Les filtres UUID sont réservés aux appels
internes ; les routes HTTP FULL/DIFF ne les exposent pas actuellement.

## Types d'export

- **FULL — export complet** : photographie des objets actifs à l'instant `at`, pour le périmètre sélectionné.
- **DIFF — export différentiel** : changements consolidés entre `from` inclus et `to` exclu : créations, mises à jour et désactivations. Il permet d'actualiser un état de départ compatible.

## Flux

```text
ban-core-api
  publie export.requested -> ban.commands
        │
        ▼
ban-core-exporter
  consomme ban.exporter
  génère le flux NDJSON une seule fois
  écrit dans tmp/exports, vers S3, ou les deux
  met a jour ban.job_status
  publie export.completed ou export.failed -> ban.events
```

## Messages RabbitMQ

Le service consomme :

- `export.requested`

Le service publie :

- `export.completed`
- `export.failed`

La topologie RabbitMQ globale est documentee dans [../../RABBITMQ.md](../../RABBITMQ.md).

## Stockage

Le moteur genere toujours un fichier temporaire local avant stockage.

Par defaut en developpement, le fichier est cree dans :

```text
apps/ban-core-exporter/tmp/exports/
```

Ce dossier est ignore par Git.

### Nom des fichiers et dates de référence

Les exports d'un département, sans filtre UUID, sont nommés ainsi :

```text
full--dep-<code-departement>--<date>--<token>.ndjson
diff--dep-<code-departement>--<date-début>_<date-fin>--<token>.ndjson
```

Par exemple, un FULL au 1er juin et un DIFF hebdomadaire du 4 au 11 mai :

```text
full--dep-31--2026-06-01--<token>.ndjson
diff--dep-31--2026-05-04_2026-05-11--<token>.ndjson
```

Les dates sont celles de la **demande**, converties en `Europe/Paris`, et non
la date de génération. À minuit exactement, elles sont écrites `AAAA-MM-JJ`.
À une autre heure, elles incluent l'heure et le décalage UTC sans `:` :
`2026-06-01T14-30-00+0200`. Une fraction de seconde non nulle est conservée
après les secondes, par exemple `T14-30-00-123456+0200`. Le décalage distingue
les deux occurrences d'une même heure lors du passage à l'heure d'hiver.
Les bornes du DIFF gardent leur signification définie dans la spécification ;
le nom ne change pas leur inclusivité/exclusivité.

Le token est l'identifiant du job : son suffixe
distingue deux demandes identiques. Une nouvelle tentative du **même job** garde
le même nom lorsque ses paramètres effectifs restent identiques.

Pour les appels internes, plusieurs départements ou des filtres UUID utilisent
`selection` à la place de `dep-<code>` ; une sélection sans département ni UUID
utilise `france`. Cela évite des noms très longs ou un intitulé départemental
trompeur. Ces libellés n'ajoutent pas de nouveaux filtres aux routes HTTP.
Les types d'objets sélectionnés ne sont pas détaillés dans le nom : la sélection
exacte reste dans le rapport du job et les métadonnées d'ouverture du fichier.

### Choisir les destinations

`EXPORT_STORAGE` choisit les sorties, indépendamment de `NODE_ENV` :

| Valeur | Destination |
|---|---|
| `local` | Fichier dans `tmp/exports` (ou `EXPORT_OUTPUT_DIR`) |
| `s3` | Streaming direct vers S3 |
| `both` | Même flux vers S3 et le fichier local |

Les copies locales sont conservées dans les modes `local` et `both`, en développement
comme en production. Pendant l'écriture, elles portent le suffixe `.partial` ; le nom
final est publié après réussite de toutes les destinations. Un échec conserve le
`.partial` pour diagnostic. Le nettoyage de ces fichiers est manuel.

### Stockage S3

Pour envoyer les fichiers vers S3 ou RustFS :

```env
EXPORT_STORAGE=s3
EXPORT_S3_BUCKET=ban-exports
EXPORT_S3_ENDPOINT=http://localhost:9000
EXPORT_S3_REGION=us-east-1
EXPORT_S3_ACCESS_KEY_ID=rustfsadmin
EXPORT_S3_SECRET_ACCESS_KEY=rustfsadmin
EXPORT_S3_PREFIX=exports
EXPORT_S3_FORCE_PATH_STYLE=true
```

Les objets sont regroupés par mois de référence dans le bucket :

```text
<EXPORT_S3_PREFIX>/<AAAA-MM>/<nom-du-fichier>
<EXPORT_S3_PREFIX>/<AAAA-MM>/diff_<date-fin-exclue>/<nom-du-fichier-DIFF>
exports/2026-05/diff_2026-05-11/diff--dep-31--2026-05-04_2026-05-11--<token>.ndjson
exports/2026-06/full--dep-31--2026-06-01--<token>.ndjson
```

Le mois est celui de `at` pour FULL et de **`to` pour DIFF**, toujours en heure
de Paris, même si cette borne est exclusive. Un DIFF du 25 mai au 1er juin
est donc rangé sous `2026-06/diff_2026-06-01/`. Les FULL restent directement dans
le dossier mensuel ; les sous-dossiers DIFF portent le préfixe `diff_` suivi de la date de fin exclue.
Le token figure également dans les métadonnées S3.
Le préfixe est configurable (`exports` par défaut).

La destination enregistrée dans `report.output` est la référence pour retrouver
un export. Les consommateurs doivent l'utiliser, et non reconstruire une clé S3
à partir du token.

Le SDK envoie des parties de 8 388 608 octets (8,39 Mo), avec au plus deux envois simultanés par
export. La sortie la plus lente ralentit la lecture PostgreSQL. Le tampon
d'ordonnancement des événements DIFF reste en mémoire.

Chaque requête S3 utilise un checksum SHA-256. Après l'upload, le service vérifie
la taille, l'ETag et les métadonnées de l'objet. `output.sha256` est l'empreinte du
flux complet, utilisable pour vérifier un téléchargement ; l'ETag multipart
n'est pas cette empreinte. En cas d'échec, la connexion SQL dédiée est interrompue
et les parties S3 incomplètes sont abandonnées. Un avertissement signale un
échec de ce nettoyage. Un objet déjà finalisé peut rester présent si un contrôle
ultérieur ou la publication locale échoue ; le job reste en erreur.

En developpement local, `docker-compose.dev.ban.yml` démarre RustFS :

- API S3 : `http://localhost:9000`
- Console : [http://localhost:9002](http://localhost:9002)
- Bucket par defaut : `ban-exports`

### Stockage local

Pour conserver uniquement les fichiers locaux :

```env
EXPORT_STORAGE=local
```

Les modes explicites `s3` et `both` exigent une configuration S3 complète.
Sans mode explicite, une configuration S3 complète sélectionne `s3` ; sinon,
le développement utilise `local` avec un avertissement et la production échoue.

## Statuts

Le service met a jour `ban.job_status` :

- `processing` lorsque le traitement commence ;
- `success` lorsque le fichier est genere et stocke ;
- `error` en cas d'echec.

Le rapport final contient notamment :

- `params` : parametres de la demande ;
- `stats` : compteurs par type de donnees ;
- `count` : nombre total de lignes exportees ;
- `output` : mode (`local`, `s3`, `both`), taille en octets et SHA-256 du flux ;
  `path` pour la copie locale, `bucket`/`key`/`endpoint` et éventuellement `url`
  pour S3. Le mode `both` fournit les deux emplacements.

Le rapport est consultable via :

```text
GET {API_BASE_URL}/api/reports/exports/{token}
```

## Tester les sorties

`pnpm --filter @ban/ban-core-exporter test` couvre les destinations, le
ralentissement des écritures et les erreurs SQL/disque/S3, sans réseau ni base.

Avec RustFS démarré et les variables S3 locales configurées :

```shell
pnpm --filter @ban/ban-core-exporter run test:storage:s3
```

Les tests unitaires et les tests S3 sont regroupés dans `src/export/storage.test.ts`.
La commande ordinaire exécute les tests unitaires ; `test:storage:s3` sélectionne
uniquement le groupe d’intégration S3, avec le vrai client AWS à la place du transport simulé.

Ces tests réels refusent les endpoints distants. Ils utilisent un préfixe unique
`exports/_checks/`, vérifient les téléchargements et l'abandon multipart, puis
suppriment uniquement leurs propres objets et fichiers. Ils ne touchent pas à
PostgreSQL ni à RabbitMQ. Ils sont désactivés dans la commande de test ordinaire.

## Contrat FULL/DIFF v0.4

Le contrat FULL/DIFF v0.4 couvre les exports FULL (`full`) et DIFF (`diff`) des trois types de données :
district/commune, toponym/odonyme et address/adresse.

Les artefacts versionnés du contrat sont dans
[specifications/ban-diff/v0.4](./specifications/ban-diff/v0.4/) :

- la [spécification](./specifications/ban-diff/v0.4/specifications/SPECIFICATION_BAN_DIFF_V0.4.md) ;
- les schémas JSON Schema, qui valident chaque ligne NDJSON ;
- des fixtures valides et invalides ;
- le validateur de flux, qui contrôle les contraintes portant sur plusieurs lignes.

Un flux commence par `stream-start` et se termine par `stream-end`. Pour un DIFF,
un événement `created` ou `disabled` embarque un état, tandis qu'un événement
`updated` embarque l'état après puis l'état avant. Les événements sont écrits dans
l'ordre des dépendances : créations et mises à jour commune → odonyme → adresse,
puis désactivations adresse → odonyme → commune. Les compteurs de fin de flux
correspondent aux lignes effectivement écrites.

Les descriptions des JSON Schema proposent un « Équivalent conseillé pour un
Standard-FR-CNIG » pour chaque propriété. Les correspondances conceptuelles avec
le Standard Adresse sont détaillées dans
[le guide du modèle](./specifications/ban-diff/v0.4/analyse/CORRESPONDANCES_STANDARD_ADRESSE.md).

`integratedAt` porte la date d'intégration explicitement fournie, sinon `null`.

### Validation

Les tests du service chargent les trois schémas (définitions, FULL et DIFF), valident les fixtures et
exécutent le validateur de flux sur les cas valides comme invalides :

```bash
pnpm --filter @ban/ban-core-exporter test
pnpm --filter @ban/ban-core-exporter build
```

Pour contrôler un fichier produit manuellement :

```bash
node specifications/ban-diff/v0.4/scripts/validate-ban-ndjson.mjs <fichier.ndjson>
```

### Limite de volumétrie connue

L'ordonnancement DIFF conserve actuellement les lignes en mémoire avant leur
écriture finale, afin de respecter l'ordre de dépendances. Avant de traiter des
DIFF très volumineux, mesurer cette consommation mémoire et envisager un
ordonnancement SQL global ou un stockage temporaire.

## Commandes utiles

### Contrôles PostgreSQL isolés des exports v0.4

Les contrôles suivants s'exécutent **depuis la racine du dépôt**, avec les
dépendances du workspace installées et ses paquets nécessaires construits.
Préparer les deux petites bases selon
[le guide PostgreSQL](../../packages/prisma-client/tests/README.md) :
`ban_export_validation_tmp` contient neuf lignes synthétiques,
`ban_fixture_validation_tmp` garde une structure vide. Ces tests ne nécessitent
aucun script d'extraction/import de jeu de données et ne restaurent aucun dump.

```sh
# Choisir deux dossiers de résultat nouveaux à chaque exécution.
RUN_BAN_POSTGRES_TESTS=1 node_modules/.bin/tsx apps/ban-core-exporter/scripts/check-empty-exports.mts \
  ban_fixture_validation_tmp working/exports-base-vide-NOUVEAU
RUN_BAN_POSTGRES_TESTS=1 node_modules/.bin/tsx apps/ban-core-exporter/scripts/check-empty-exports.mts \
  ban_export_validation_tmp working/exports-selection-absente-NOUVEAU
node --test apps/ban-core-exporter/specifications/ban-diff/v0.4/scripts/validate-empty-stream.node.mjs
```

Le script lit la connexion locale de `.env` en mémoire, sans modifier ce fichier,
impose `ban_user`, vérifie la cible et force les sessions SQL en lecture seule.
Il ne démarre aucun worker ni publication RabbitMQ/S3. Les schémas AJV et le
validateur sémantique vérifient les flux `ban-standard` sur base vide, département
ou UUID absent et périodes sans événement. Une sélection valide sans résultat
produit un flux complet et les compteurs à zéro.

Une vraie erreur PostgreSQL `42883` est aussi provoquée par substitution de
requête en mémoire, sans supprimer d'objet : l'absence d'une fonction est une
erreur, pas un succès vide. Ce cas ne couvre pas toutes les structures
incompatibles. `results.json` distingue flux validés et erreurs attendues ; les
fichiers `missing-*` éventuels sont des diagnostics incomplets sans clôture,
jamais des exports réutilisables. Aucun fichier ou base n'est effacé.

### Exécution de l'application

```bash
pnpm --filter @ban/ban-core-exporter dev
pnpm --filter @ban/ban-core-exporter test
pnpm --filter @ban/ban-core-exporter build
```
