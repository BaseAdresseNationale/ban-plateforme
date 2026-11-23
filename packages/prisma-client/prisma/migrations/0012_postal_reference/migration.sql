-- [POSTAL-SVC-01] Stockage postal vide, sans import ou modification des données BAN.
BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
CREATE SCHEMA postal;

CREATE TABLE postal.datanova (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "inseeCom" varchar(5) NOT NULL UNIQUE CHECK ("inseeCom" ~ '^(?:[0-9]{5}|2[AB][0-9]{3})$'),
  "postalCodes" text[] NOT NULL CHECK (cardinality("postalCodes") > 0),
  "libelleAcheminementWithPostalCodes" jsonb NOT NULL
    CHECK (jsonb_typeof("libelleAcheminementWithPostalCodes") = 'object'),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE postal.postal_area (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "inseeCom" varchar(5) NOT NULL CHECK ("inseeCom" ~ '^(?:[0-9]{5}|2[AB][0-9]{3})$'),
  "postalCode" varchar(5) NOT NULL CHECK ("postalCode" ~ '^[0-9]{5}$'),
  geometry public.geometry(Geometry, 2154) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT postal_area_valid_geometry CHECK (
    public.ST_GeometryType(geometry) IN ('ST_Polygon', 'ST_MultiPolygon')
    AND public.ST_IsValid(geometry) AND NOT public.ST_IsEmpty(geometry)
  )
);
CREATE INDEX postal_area_commune_idx ON postal.postal_area ("inseeCom");
CREATE INDEX postal_area_geometry_idx ON postal.postal_area USING gist (geometry);
COMMIT;
