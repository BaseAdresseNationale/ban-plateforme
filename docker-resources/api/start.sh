#!/bin/sh

set -e

echo "Vérification des données requises..."

if [ ! -f "data/communes-50m.sqlite" ]; then
  echo "Téléchargement des contours..."
  npm run prepare-contours
  echo "Téléchargement des contours terminé."
fi

if [ ! -f "data/communes-locaux-adresses.json" ] || \
   [ ! -f "data/fantoir.sqlite" ] || \
   [ ! -f "data/gazetteer.sqlite" ]; then
  echo "Téléchargement des jeux de données..."
  npm run download-datasets
  echo "Téléchargement des jeux de données terminé."
fi

#echo "Exécution des migrations..."
#npm run migrate:up
#echo "Migrations terminées."
