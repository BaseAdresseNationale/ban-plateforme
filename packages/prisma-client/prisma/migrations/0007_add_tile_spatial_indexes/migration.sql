CREATE OR REPLACE FUNCTION ban.tile_point(input jsonb)
RETURNS geometry
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE
  longitude double precision;
  latitude double precision;
BEGIN
  IF input->>'type' IS DISTINCT FROM 'Point' THEN
    RETURN NULL;
  END IF;
  longitude := (input->'coordinates'->>0)::double precision;
  latitude := (input->'coordinates'->>1)::double precision;
  IF longitude IS NULL OR latitude IS NULL OR longitude NOT BETWEEN -180 AND 180
     OR latitude NOT BETWEEN -85.0511287798066 AND 85.0511287798066 THEN
    RETURN NULL;
  END IF;
  RETURN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS address_tile_point_idx ON ban.address
  USING gist (ban.tile_point(positions[1]->'geometry')) WHERE "isActive";

CREATE INDEX IF NOT EXISTS common_toponym_tile_point_idx ON ban.common_toponym
  USING gist (ban.tile_point(geometry)) WHERE "isActive";