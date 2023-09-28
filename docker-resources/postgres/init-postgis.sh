#!/bin/bash
set -e

echo "Activating PostGIS extension..."
psql -U $POSTGRES_USER -d $POSTGRES_DB -c "CREATE EXTENSION postgis;"