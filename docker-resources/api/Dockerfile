# using an optimized node image
FROM node:18.19.0-alpine

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install

# creating /data and /dist folder
RUN mkdir -p data dist

# copying the root folder into the workdir
COPY . .

# Exposer le port utilisé par l'application
EXPOSE 5000

# Point d'entrée défini à l'exécution (dans les deployments)
CMD ["node", "server.js"]
