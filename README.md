# Plateforme de la Base Adresse Nationale

## Architecture

La BAN Plateforme contient : 
- Une API synchrone et asynchrone : serveur Express (point d'entrée : server.js).
L'API asynchrone envoit des tâches dans la queue du redis, pris en charge par le worker.
- Un worker (point d'entrée : worker.js) qui récupère les tâches du redis (qui ont été déposées soit par l'API, soit par les scripts).
- Des scripts (imports, consolidation, exports, ...).

La BAN Plateforme import et export des données d'une base MongoDB.

## Installation

### Configuration
Pour mettre en place un environnement fonctionnel, vous pouvez partir du fichier .env.sample et le copier en le renommant .env.

### Deploiement local avec Docker

#### Pré-requis
- Docker
- Docker-compose

#### Commandes
Pour déployer l'environnement, lancer la commande suivante : 

```sh
docker-compose up --build -d
```

--build : permet de builder les images locales.
-d : permet de lancer les conteneurs en arrière plan.

La commande précédente va déployer une architecture locale, interconnectée, avec : 
- un conteneur "db" (image mongo:4.2.23)
- un conteneur "redis" (image redis:4.0.9)
- un conteneur "api" (à partir de l'image définie dans le fichier docker-resources/api/Dockerfile.dev) => Au lancement de ce conteneur, un script d'initialisation (défini dans le fichier docker-resources/api/start.sh) va permettre le téléchargement des données requises au démarrage de la plateforme.

Pour le déploiement avec un proxy, utiliser le fichier docker-compose.dev.yml en lançant le script dev.sh contenant la commande suivante :

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### Deploiement local sans Docker

#### Pré-requis
- Node.js 16 ou supérieur
- MongoDB 4 ou supérieur
- Redis
- yarn ou npm

#### Commandes
Pour installer les dépendances, lancer la commande suivate : 

```sh
yarn
```

Il faut ensuite télécharger les fichiers requis au démarrage de la plateforme avec les commandes suivantes : 

```sh
yarn prepare-contours ## Prepare les contours administratifs de la France entière.
```

```sh
yarn download-datasets ## Télécharge fantoir.sqlite, gazetteer.sqlite, communes-locaux-adresses.json.
```

Pour déployer l'api et le worker, lancer les deux commandes suivantes en parallèle : 

```sh
yarn dev
```

```sh
yarn worker:dev
```

### Autres commandes

```sh
yarn compose ## Consolidation des adresses
```

```sh
yarn dist ## Production des fichiers d'export
```

```sh
yarn apply-batch-certification ## Appliquer la mise à jour de la liste des communes certifiées d'office
```