#!/bin/bash
#Lancer l'environnement de dev en local
unset NO_PROXY no_proxy
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
