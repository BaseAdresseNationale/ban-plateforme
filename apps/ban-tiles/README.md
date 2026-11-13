# Service de tuiles BAN

Ce microservice HTTP produit des tuiles vectorielles MVT/PBF a la demande depuis PostgreSQL/PostGIS. Il n'utilise ni MongoDB ni RabbitMQ.

## Installation et lancement

Appliquer les migrations du projet (`pnpm db:migrate:deploy`) sur une base BAN initialisee avec PostGIS, puis lancer `pnpm --filter @ban/ban-tiles dev` depuis la racine. `pnpm dev` lance aussi le service automatiquement.

La migration cree deux index spatiaux sur les tables d'adresses et de toponymes. Sur une base volumineuse, prevoir le temps de construction et les verrous d'ecriture lors de son deploiement.

Variables d'environnement :

- `PG_URI` : URL PostgreSQL ; `PG_URL` est utilisee si `PG_URI` est absente.
- `BAN_TILES_PORT` : port HTTP, `3002` par defaut.

En developpement local, les variables sont chargees par `pnpm dev`. Pour un lancement individuel, les exporter avant d'executer la commande. Le service fournit `GET /health` et `GET /tiles/ban/{z}/{x}/{y}.pbf` pour les zooms 10 a 14. La reponse PBF est compressee en gzip et les requetes entre origines sont autorisees. Les tuiles vides sont des PBF valides. Aucun cache n'est actuellement configure.

## Donnees

Les couches `adresses` et `toponymes` utilisent les enregistrements actifs et les communes actives. Les adresses liees a un toponyme inactif sont exclues. La premiere position d'une adresse et la geometrie du toponyme sont utilisees si ce sont des points WGS84 valides. Les etiquettes francaises sont privilegiees, avec repli sur la premiere etiquette disponible.

Les noms de proprietes reproduisent ceux de l'ancienne API lorsque les donnees correspondantes existent dans le nouveau modele. L'identifiant d'adresse utilise `meta.ban.DEPRECATED_cleInterop` s'il est renseigne, sinon l'UUID ; l'identifiant du toponyme est son UUID. Les anciennes sources et les anciennes communes ne sont disponibles que si elles sont renseignees dans les metadonnees. Les tuiles ne sont donc pas garanties identiques a celles de l'ancienne plateforme.

## Tests

`pnpm --filter @ban/ban-tiles test` execute les tests unitaires. Pour verifier la migration et le contenu MVT sur PostgreSQL/PostGIS, fournir `BAN_TILES_TEST_PG_URI` avec les droits de creation de base et lancer `RUN_BAN_TILES_POSTGRES_TESTS=1 pnpm --filter @ban/ban-tiles test`. Le test cree une base temporaire au nom aleatoire et supprime uniquement celle qu'il a creee.