# Alimenter le service postal

Commande locale explicite, sans téléchargement ni `.env` automatique. Les deux fichiers
forment une version complète : un `--apply` remplace toutes les anciennes références.
Aucune réparation de données BAN, mise à jour partielle d’une commune ou écriture HTTP.

## Préparer et lancer

Versions requises dans le [package.json racine](../../package.json). Préparer le client
Prisma et les dépendances du projet sans importer de données personnelles/de production.
La destination doit être une base PostGIS dédiée, avec `0012_postal_reference` appliquée.
Ne jamais lancer les tests ou les exemples sur une base existante/restaurée/de production.

Le rôle d’alimentation doit avoir CONNECT/TEMP sur cette base, USAGE sur `postal`,
SELECT/INSERT/DELETE sur ses deux tables et USAGE/SELECT sur leurs séquences.
Il n’a besoin d’aucun UPDATE postal ni droit d’écriture sur les objets BAN.
La consultation HTTP peut utiliser un rôle de lecture distinct. Aucun droit n’est accordé
automatiquement par la commande ; aucun token HTTP n’est requis pour cet import local.

```sh
pnpm --filter @ban/prisma-client build
pnpm --filter @ban/postal-code build

# Remplacer l’URL, les chemins et le nom par ceux de l’environnement de test dédié.
# Sans --apply : validation complète et rapport, sans modification des tables consultées.
PG_URL='<URL PostgreSQL du rôle d’alimentation sur la base de test>' \
pnpm --filter @ban/postal-code run import:references \
  --datanova apps/postal-code/fixtures/datanova.fictional.csv \
  --areas apps/postal-code/fixtures/areas.fictional.geojson \
  --source-srid 4326 \
  --expect-database ban_postal_test
```

Ces exemples embarqués sont entièrement fictifs (deux communes), en WGS84.
Ajouter `--apply` après vérification du rapport pour les publier sur la seule base de test dédiée. `--source-srid` accepte
2154 (Lambert-93) ou 4326 (WGS84 longitude/latitude). `--delimiter` accepte `;` (défaut)
ou `,`. Toute option inconnue/dupliquée est refusée ; `--help` ne demande ni base ni fichiers.
Le nom attendu doit correspondre à `PG_URL` et au serveur, comme l’utilisateur explicite
de l’URL. Ces identifiants et l’URI ne sont pas affichés dans les rapports/erreurs.

## Formats

- CSV UTF-8 : en-têtes `code_commune_insee`, `code_postal`, `libelle_d_acheminement` ;
  casse/accents des noms acceptés, BOM et guillemets CSV gérés, colonnes supplémentaires
  ignorées. Espaces externes retirés, COG en majuscules, codes gardés comme chaînes.
- GeoJSON UTF-8 : `FeatureCollection` non vide, Features avec propriétés textuelles `cp`
  et `insee_com`, géométries Polygon/MultiPolygon 2D à anneaux fermés. Projection source
  obligatoire ; CRS déclaré sur la collection, une Feature ou sa géométrie contrôlé.
  Seules les métadonnées nommées EPSG:2154/4326, leurs URN et CRS84 sont reconnues.
- Les libellés doivent être non vides, ≤512 caractères, sans contrôle ni Unicode isolé
  invalide. Une contradiction pour le même couple commune/code bloque l’import ; les
  doublons CSV identiques sont regroupés. Chaque contour doit correspondre à un code CSV.

Lecture progressive avec ralentissement par PostgreSQL ; une seule Feature assemblée.
Limites : 8 Go/fichier, 1 Mo/ligne CSV, 1 million de caractères/valeur JSON, profondeur JSON 32, coût d’assemblage
borné à 32 Mo/Feature, géométrie encodée ≤16 Mo/1 million de points, 2 millions de lignes
CSV/Features au total. Lecteurs : `csv-parse` et `stream-json`, versions dans le manifeste et le lockfile.

Fichiers réguliers, distincts et bornés uniquement ; liens symboliques refusés.
Ils sont lus par les descripteurs ouverts une fois ; tout changement pendant la lecture
est rejeté. Aucun contenu, chemin ou identifiant métier n’est écrit dans les rapports.

## Publication et rapport

Codes et contours sont préparés en tables temporaires propres à la connexion, puis
validés ensemble par PostGIS. En simulation : rollback, aucun DML sur les tables réelles.
En application : publication sérialisée entre imports, remplacement transactionnel unique,
sans TRUNCATE ; les lectures voient une ancienne ou nouvelle version complète.
Le rejeu ne cumule pas les lignes. Les identifiants/timestamps techniques peuvent changer.

La validation ne prouve pas la couverture géographique/exhaustivité nationale des fichiers.
Les lignes non présentes dans le nouveau jeu disparaissent au remplacement complet.
Un échec avant COMMIT préserve l’ancienne version. Si la confirmation du COMMIT est perdue,
le résultat reste indéterminé : vérifier la destination avant toute nouvelle opération.

Le rapport JSON contient `applied`, `communes`, `codes`, `areas`, puis les comptes d’entrée,
tailles et SHA-256 des deux sources. Une simulation réussie n’annonce pas une publication.
Codes de sortie : 0 succès/aide ; 1 stockage/nettoyage ; 2 paramètres/fichiers invalides ;
3 publication indéterminée ; 130/143 interruption SIGINT/SIGTERM. L’incertitude du
COMMIT reste prioritaire ; interruption/nettoyage sont alors des indications secondaires.

## Tester sans référentiel réel

`pnpm --filter @ban/postal-code test` : unités sans service, fichiers fictifs temporaires.
`pnpm --filter @ban/postal-code test:postgres` : image PostGIS déjà locale, conteneur/base/
rôles/ports/tmpfs propres, identité vérifiée avant écritures et nettoyage par ID.
Le parcours transversal couvre simulation, application, droits restreints, rollback,
rejeu, concurrence, lecture pendant publication et commandes réelles. Aucun import réel
ni accès à une base existante n’est effectué. L’audit et l’administration restent exclus.
