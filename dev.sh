#!/bin/bash
#Lancer l'environnement de dev en local
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
