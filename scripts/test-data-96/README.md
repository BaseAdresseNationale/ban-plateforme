# Export et import du jeu de test BAN — département fictif 96

## Objectif et périmètre

Ce kit permet de sauvegarder et partager **l'ensemble des communes fictives
du département lui aussi fictif 96**, avec leurs toponymes, leurs adresses et
leurs historiques,
puis de réinstaller ce jeu sur une base de développement BAN de structure
compatible. Il n'est pas limité à une commune particulière : les nouvelles
communes du département sont incluses au prochain export.

Il sert à disposer d'un même jeu de données dans l'équipe, tester les états
à différentes dates et leurs différences, et actualiser les dates des
scénarios sans casser leur chronologie. Ce kit est destiné au développement,
**pas à une reprise de production**.

Le JSON et le SQL du kit transportent les lignes des tables, historiques inclus.
Pour tester les exports applicatifs après installation du jeu, suivre le
[guide de l'exporteur](../../apps/ban-core-exporter/README.md).

Le contenu métier et les scénarios sont décrits séparément dans
[inventaire-et-evenements.md](inventaire-et-evenements.md).

L'export couvre six tables du schéma `ban` :

| Données métier | Historique |
| --- | --- |
| `district` : communes | `district_h` |
| `common_toponym` : toponymes | `common_toponym_h` |
| `address` : adresses | `address_h` |

Le critère de sélection est `left(meta->'insee'->>'cog', 2) = '96'` sur les
communes actuelles **et historiques**. Les UUID trouvés servent à prendre tous
les états de ces communes, de leurs toponymes et de leurs adresses. Un objet
ayant quitté ce périmètre ou une référence extérieure fait échouer les
contrôles plutôt que d'élargir silencieusement l'export.

Il n'y a aucun filtre sur un nom de commune ni liste fixe d'UUID. Les versions
de communes dont le code sort du département 96 sont refusées. Les événements
de fusion ou division entièrement internes au département peuvent être
documentés dans le catalogue ; un changement de département nécessite
d'examiner et d'adapter le périmètre séparément.

Les UUID, tableaux de références, métadonnées, valeurs NULL, microsecondes et
périodes `tstzrange` sont conservés. Les objets inactifs ne sont pas filtrés.

Les actions/certificats associés sont comptés mais exclus ; s'il en apparaît,
l'export s'arrête pour revoir ce choix.
Les sessions/comptes, droits, propriétaires, extensions, fonctions, index,
registre Prisma et autres communes ne sont pas exportés. Les tables
`district_config`, `district_config_h` et préférences supplémentaires de certaines
restaurations ne sont pas dans ce jeu. La configuration incluse est celle de
`district.config` ; si l'application requiert des tables de configuration
séparées, prévoir leur initialisation et vérifier son comportement.

## Prérequis

- Node.js 24+ et Docker ; aucune dépendance npm supplémentaire.
- `psql` dans le conteneur PostgreSQL. La version de référence est PostgreSQL 17 ;
  ne pas présumer la compatibilité d'autres versions.
- Source lisible avec les six tables métier et les tables `action` et
  `certificate` utilisées pour vérifier les dépendances exclues.
- Cible locale déjà restaurée avec les mêmes colonnes/types, contraintes et
  les trois triggers appelant `public.historisation()`.
  Les six tables ne doivent avoir aucun autre trigger utilisateur : une structure
  différente est refusée et demande une adaptation relue du kit.
- Compte d'import propriétaire des six tables, ou droits administratifs
  appropriés, pour désactiver/rétablir les triggers d'historisation.

Le kit utilise `docker exec` et la connexion interne au conteneur. Il n'inclut
aucun mot de passe et ne lit/modifie pas `.env`. Si l'authentification interne
demande un secret, la configurer séparément sans mettre ce secret dans le kit.

## Scripts principaux

| Script | Objectif |
| --- | --- |
| `export-test-96.mjs` | Extraire le département 96 en lecture seule, vérifier les données et produire un nouvel export JSON et SQL. |
| `generate-sql.mjs` | Générer un nouveau SQL depuis un JSON modifié, sans connexion PostgreSQL. |
| `import-test-96.sh` | Importer le SQL dans une cible explicitement confirmée, avec contrôles et transaction. |

Toutes les commandes partent de la racine du projet. Les noms du conteneur,
du compte PostgreSQL, des bases et les chemins sont configurables. Les noms
de connexion acceptent lettres, chiffres, `_`, `.` et `-`.

## J'ai reçu un jeu : comment l'installer ?

1. Récupérer les scripts du kit et un `test-96.sql` relu. Conserver également
   `data.json` et le catalogue du jeu pour comprendre les scénarios.
2. Préparer une base locale BAN de structure compatible. Elle peut contenir
   d'autres départements, mais **aucune donnée 96 ni UUID du jeu à importer**.
   Le kit ne restaure pas la structure et ne remplace pas un jeu déjà installé.
3. Vérifier le nom de la cible, les droits et les triggers avant d'importer.

Depuis la racine du projet :

```sh
export POSTGRES_CONTAINER="ban_postgres"
export PG_USERNAME="ban_user"
export TARGET_DATABASE="ban_dev_tests"
export CONFIRM_TARGET="$TARGET_DATABASE"
export SQL_INPUT="/chemin/vers/le-jeu-relu/test-96.sql"
export SHIFT_SECONDS="0"
export ANCHOR_TIMESTAMP=""

# Lecture seule : vérifier que la connexion arrive sur la cible prévue.
docker exec "$POSTGRES_CONTAINER" psql --username="$PG_USERNAME" \
  --dbname="$TARGET_DATABASE" --no-psqlrc --set=ON_ERROR_STOP=1 \
  --command='BEGIN READ ONLY; SELECT current_database(), current_user; COMMIT;'

# Cette commande insère le jeu et valide la transaction en cas de succès.
bash scripts/test-data-96/import-test-96.sh --apply "$SQL_INPUT"
```

**Ne pas utiliser `ban` comme cible**, même sur un poste de développement :
ce nom est protégé. L'import effectue un vrai COMMIT ; il n'existe pas de mode
simulation dans ce wrapper. En cas de doute, ne pas lancer la seconde commande.

Vérifier le code de sortie zéro et le `COMMIT`, puis consulter les communes et
historiques via l'application aux dates du catalogue. Les compteurs affichés
ne suffisent pas seuls à prouver la réussite. Pour actualiser les dates, voir
[Dates d'origine ou dates actualisées](#dates-dorigine-ou-dates-actualisées).

## Configuration

| Variable | Usage et valeur |
| --- | --- |
| `POSTGRES_CONTAINER` | Nom du conteneur Docker ; défaut `ban_postgres`. |
| `PG_USERNAME` | Rôle PostgreSQL ; défaut `ban_user`. |
| `SOURCE_DATABASE` | Base à lire pour l'export ; défaut `ban`, pas nécessairement une base intermédiaire. |
| `TARGET_DATABASE` | Base existante d'import ; obligatoire, sans défaut. |
| `CONFIRM_TARGET` | Confirmation identique à `TARGET_DATABASE` ; obligatoire. |
| `EXPORT_DIRECTORY` | Variable de chemin des exemples, passée comme argument à l'export ; nouveau dossier dont le parent existe. |
| `SQL_INPUT` | Variable de chemin des exemples, passée comme argument à l'import ; fichier SQL relu existant. |
| `SQL_OUTPUT` | Variable de chemin des exemples, passée comme argument au générateur ; nouveau fichier dont le parent existe. |
| `SHIFT_SECONDS` | Décalage uniforme signé en secondes, maximum six décimales ; défaut `0`. |
| `ANCHOR_TIMESTAMP` | Ancre temporelle finie, avec fuseau explicite recommandé ; défaut vide. |

Les trois variables de chemin ne sont pas lues automatiquement par les scripts :
les arguments `"$EXPORT_DIRECTORY"`, `"$SQL_INPUT"` et `"$SQL_OUTPUT"` sont
nécessaires. Les valeurs des exemples sont à adapter à votre environnement.

## Exporter le département 96 — lecture seule

```sh
export POSTGRES_CONTAINER="ban_postgres"
export PG_USERNAME="ban_user"
export SOURCE_DATABASE="ban"
export EXPORT_DIRECTORY="PG-Dump.backUp/test-data-96/export-equipe-v1"

node scripts/test-data-96/export-test-96.mjs \
  "$EXPORT_DIRECTORY"
```

Le dossier de sortie doit être nouveau ; son parent doit exister. Aucun fichier
existant n'est écrasé. Les valeurs par défaut de connexion sont `ban_postgres`,
`ban_user` et `ban` ; les expliciter évite les ambiguïtés.

Le script vérifie la base source, puis lit les tables dans une transaction
`REPEATABLE READ READ ONLY` : une photographie cohérente sans écriture sur
la source. Il contrôle les références, les orphelins historiques, les doublons
et les colonnes. Il produit :

- `data.json` : données modifiables, description des colonnes, date d'export
  et nom de la base source ;
- `test-96.sql` : fichier SQL plain text contenant les mêmes données et l'import.

Il n'y a ni `pg_dump` complet ni montage `/backups` nécessaire. Le SQL utilise
du JSON lisible avec `jsonb_populate_recordset` pour conserver les types
PostgreSQL sans construire manuellement des littéraux complexes de tableaux.

## Préparer et partager un export

Une commune fictive ne garantit pas des métadonnées entièrement fictives.
Vérifier en particulier `meta`, `config`, les labels et positions : noms,
adresses électroniques, tokens, identifiants d'utilisateurs, URLs internes,
coordonnées éventuellement réelles, etc. Anonymiser si nécessaire dans une
copie du JSON ; examiner aussi le nom de la source dans les métadonnées
d'export. Ne pas partager automatiquement les données ni les secrets.

Modifier de préférence `data.json`, puis créer un **nouveau** SQL :

```sh
export EXPORT_DIRECTORY="PG-Dump.backUp/test-data-96/export-equipe-v1"
export SQL_OUTPUT="$EXPORT_DIRECTORY/test-96-revised.sql"

node scripts/test-data-96/generate-sql.mjs \
  "$EXPORT_DIRECTORY/data.json" "$SQL_OUTPUT"
```

`SQL_OUTPUT` ne doit pas exister. Le script contrôle les données mais ne les
importe pas. Partager le JSON et le SQL relus avec le kit et cette documentation,
et tenir à jour l'inventaire et les événements pour expliquer les scénarios
présents dans cette version du jeu.

Le schéma du JSON décrit la source ; ne pas le changer simplement pour
contourner une incompatibilité cible. Modifier les UUID implique de répercuter
toutes les références, y compris historiques et celles dans les métadonnées.
Les contrôles explicites couvrent les références structurées et
`meta.insee.mainId`, mais pas tous les liens libres possibles dans les JSON.

Le SQL est aussi modifiable directement, mais sa régénération remplacera ces
modifications dans un autre fichier. Ne jamais exécuter un SQL non relu : le
wrapper n'est pas un bac à sable pour du SQL arbitraire ou malveillant.

## Ce que fait l’import

Choisir une base locale isolée **existante**. Cet exemple ne la crée pas et ne
la restaure pas. La base `ban` est interdite par le wrapper et par le SQL,
y compris chez un développeur ; utiliser un nom dédié pour ce workflow.

```sh
export POSTGRES_CONTAINER="ban_postgres"
export PG_USERNAME="ban_user"
export TARGET_DATABASE="ban_dev_tests"
export CONFIRM_TARGET="ban_dev_tests"
export SQL_INPUT="PG-Dump.backUp/test-data-96/export-equipe-v1/test-96.sql"
export SHIFT_SECONDS="0"
export ANCHOR_TIMESTAMP=""

bash scripts/test-data-96/import-test-96.sh --apply \
  "$SQL_INPUT"
```

`--apply` et `CONFIRM_TARGET` sont obligatoires. Les bases `postgres`,
`template0` et `template1` sont également protégées.
L'import affiche la commande et la base, puis vérifie `current_database()`
avant exécution et de nouveau dans la transaction. Il ne crée/supprime/renomme
aucune base. Il refuse tout département 96 déjà présent ou collision d'UUID :
pas de suppression d'objets métier ni remplacement automatique. Les tables
temporaires de travail sont supprimées en fin de transaction.

Fonctionnement : vérifier les colonnes/types, charger les données dans des
tables temporaires, vérifier les références, calculer le décalage, verrouiller
les six tables, désactiver seulement les trois triggers d'historisation,
insérer les données, rétablir l'état original des triggers et comparer les
lignes importées au staging avant `COMMIT`.

Les clés étrangères, CHECK et contraintes d'exclusion GiST restent actives.
Les contraintes différées sont forcées avant validation. `ON_ERROR_STOP=1`
est volontaire ici : toute erreur annule la transaction à la fermeture de
la connexion, y compris les modifications des triggers. Un succès est signalé
par `COMMIT` et le code de sortie zéro, pas par les seuls compteurs affichés.

Le délai d'attente des verrous est 5 secondes, celui de chaque instruction
120 secondes. Les écritures sur les six tables sont bloquées durant l'import,
pas les `SELECT` simples. Préférer une cible sans services écrivains actifs.
Aucun réglage global PostgreSQL n'est modifié.

Le jeu se partage avec ce dossier de scripts/documentation et l'export relu.
Il ne constitue pas une sauvegarde complète ni une sauvegarde des droits.

## Dates d'origine ou dates actualisées

Par défaut, aucun changement de date. Deux options **alternatives** :

```sh
# Décaler toutes les dates typées de 24 heures exactement.
export SHIFT_SECONDS="86400"
export ANCHOR_TIMESTAMP=""
```

```sh
# Positionner la date finie la plus récente du jeu sur cette date UTC.
export SHIFT_SECONDS="0"
export ANCHOR_TIMESTAMP="2027-01-15T12:00:00Z"
```

Puis lancer la même commande d'import. L'ancre se calcule sur `updateDate` et
les bornes finies des périodes dans les six tables. Le décalage est
calculé comme `ANCHOR_TIMESTAMP - date finie la plus récente du jeu` : ce n'est
pas une recherche de la dernière action métier. Les tables d'actions/certificats
ne sont pas importées. Si la date la plus récente est le 1er octobre à 12 h UTC
et l'ancre le 11 octobre à 12 h UTC, toutes les dates typées sont avancées de
dix jours, y compris celles des historiques.

Ce même intervalle est
appliqué partout, en timezone UTC : durées, ordre, contiguïté et bornes
ouvertes/fermées restent cohérents. Les bornes infinies et ranges vides restent
préservés ; les NULL restent NULL. Les débordements de dates sont des erreurs.

Les dates libres **dans les JSON** (`meta`, `config`, etc.) ne sont pas
réécrites : il faut décider lesquelles modifier après examen de leur sens.

`SHIFT_SECONDS` accepte un nombre signé, avec au maximum six décimales.
Une ancre non vide ne peut pas être combinée à un décalage non nul. Donner
explicitement un fuseau UTC pour l'ancre et adapter la date au scénario.
Si le jeu est décalé, indiquer l'option utilisée avec les résultats des tests ;
les dates du catalogue décrivent le jeu avant décalage.

## Erreurs usuelles et limites

| Situation | Que faire ? |
| --- | --- |
| Dossier/fichier de sortie déjà présent | Choisir un nouveau chemin ; ne pas écraser un export existant. |
| Aucune commune fictive trouvée | Vérifier la source et ses codes INSEE ; un département absent n'est pas exporté comme un jeu vide. |
| Actions, certificats ou référence hors du jeu | Revoir le périmètre avec l'équipe ; ne pas supprimer les références pour contourner le contrôle. |
| Structure incompatible ou triggers inattendus | Comparer les versions du schéma ; ne pas modifier le JSON ou désactiver d'autres triggers pour forcer l'import. |
| Département 96 ou UUID déjà présent | Utiliser une autre cible compatible ; pas de remplacement ni nettoyage automatique. |
| Droits insuffisants | Vérifier le propriétaire des tables et les permissions avec le responsable de la base. |
| Options de dates incompatibles | Choisir un décalage ou une ancre, pas les deux avec un décalage non nul. |
| Verrou, délai SQL ou contrainte | Vérifier l'annulation et analyser l'erreur ; ne pas répéter aveuglément ni désactiver les contraintes. |

L'export est chargé en mémoire avec une limite de sortie de 16 Mio et un délai
SQL de 120 secondes : ce kit vise un petit jeu départemental, pas une copie
nationale. Une évolution de ces limites nécessite de revoir les scripts et tests.

La compatibilité du schéma et la cohérence des références ne démontrent pas
la validité de tous les scénarios métier. Vérifier les libellés, périodes et
résultats attendus dans l'application. Les comptes, droits et autres tables
exclus ne sont pas recréés ; leur préparation reste distincte.

## Maintenance des scripts

Les tests unitaires et les essais PostgreSQL transactionnels sont décrits dans
[README-testing.md](README-testing.md). Ce guide précise la préparation des petites
bases, les contrôles de décalage et rollback, ainsi que leur limite : aucun
COMMIT persistant n'est testé automatiquement.

Tenir le [catalogue métier](inventaire-et-evenements.md) à jour pour chaque jeu
partagé. Ne pas déduire un renommage, une fusion ou une division du seul nombre
de versions historiques.
