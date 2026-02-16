# Use the official PostgreSQL image as the base image
FROM postgres:17

# Install PostGIS extension
RUN apt-get update && apt-get install -y postgresql-17-postgis-3

# Copy a script to activate PostGIS
COPY /apps/postal-code/docker/init.sh /docker-entrypoint-initdb.d
