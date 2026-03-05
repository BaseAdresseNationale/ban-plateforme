# Service de calcul des code postaux
Ce service calcule le code postal d'une adresse lors de la réception de la BAL à partir des contours postaux et de la base des codes postaux Datanova fournis par Laposte. N'est pas calculé pour le moment, le code postal d'une voie.

## Installation
Pour déployer le service, s'assurer que les fichiers `contours-postaux.geojson` et `datanova.csv` sont bien présents dans le dossier `/postal-code/db-migrations/data/`, puis lancer la commande suivante :
```bash
cd /apps/postal-code
npx sequelize-cli db:migrate
```
Ceci va monter les tables `datanova` et `postal-area` qui vont permettre de calculer correctement le code postal d'une adresse selon si la commune est mono -ou multi- distribuée. 

## Important
Le fichier des contours postaux `contours-postaux.geojson` est une **donnée restreinte à la diffusion interne** à l'ign et ne doit pas être commitée sur ce dépôt public.
