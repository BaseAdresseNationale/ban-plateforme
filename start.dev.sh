# starting all scripts

if [ -f 'data/communes-50m.sqlite' ]; then
    echo "communes-50m.sqlite already exists."
else
    echo "communes-50m.sqlite does not exist."
    echo "downloading communes-50m.sqlite"
    npm run prepare-contours
fi

if [ -f 'data/communes-locaux-adresses.json' ]; then
    echo "communes-locaux-adresses.json already exists."
else
    echo "communes-locaux-adresses.json does not exist."
    echo "downloading communes-locaux-adresses.json"
    npm run download-datasets
fi

npm run import:ign-api-gestion
npm run import:cadastre
npm run import:ftth

# npm run compose
# npm run dist

pm2-runtime process.dev.yml