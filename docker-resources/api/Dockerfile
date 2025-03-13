FROM node:18.19.0-alpine

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install

RUN mkdir -p data dist && chown -R node:node /app

COPY . .

RUN chown -R node:node /app

USER node

EXPOSE 5000

CMD ["node", "server.js"]
