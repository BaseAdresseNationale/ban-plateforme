#!/bin/bash
set -e

POSTGRES_DB=${POSTGRES_DB:-base_adresse_nationale}
POSTGRES_BAN_USER=${POSTGRES_BAN_USER:-ban_plateforme}
POSTGRES_BAN_PASSWORD=${POSTGRES_BAN_PASSWORD:-ban_plateforme}

echo "POSTGRES_BAN_USER '$POSTGRES_BAN_USER'..."
echo "POSTGRES_BAN_PASSWORD '$POSTGRES_BAN_PASSWORD'..."
echo "POSTGRES_DB '$POSTGRES_DB'..."


echo "Activating PostGIS extension creating schema 'ban' and ban plateforme user..."
psql -U $POSTGRES_USER -d $POSTGRES_DB <<-EOSQL
    CREATE EXTENSION postgis;
    CREATE USER "$POSTGRES_BAN_USER" WITH PASSWORD '$POSTGRES_BAN_PASSWORD';
    GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO "$POSTGRES_BAN_USER";
EOSQL