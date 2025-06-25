# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install && pnpm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
CMD ["node", "dist/index.js"]
