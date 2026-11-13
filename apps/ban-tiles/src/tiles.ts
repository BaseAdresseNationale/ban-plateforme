import type { Pool } from 'pg';
import type { TileCoordinates } from './coordinates.js';

export const tileQuery = `
  WITH bounds AS (
    SELECT ST_TileEnvelope($1::integer, $2::integer, $3::integer) AS mercator
  ),
  addresses AS (
    SELECT
      COALESCE(NULLIF(a.meta->'ban'->>'DEPRECATED_cleInterop', ''), a.id::text) AS id,
      a.number AS numero, a.suffix AS suffixe,
      COALESCE((SELECT label->>'value' FROM unnest(t.labels) AS label WHERE label->>'isoCode' = 'fra' LIMIT 1), t.labels[1]->>'value') AS "nomVoie",
      COALESCE((SELECT label->>'value' FROM unnest(a.labels) AS label WHERE label->>'isoCode' = 'fra' LIMIT 1), a.labels[1]->>'value') AS "lieuDitComplementNom",
      array_to_string(ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(a.meta->'dgfip'->'cadastre') = 'array' THEN a.meta->'dgfip'->'cadastre' ELSE '[]'::jsonb END)), '|') AS parcelles,
      d.meta->'insee'->>'cog' AS "codeCommune",
      COALESCE((SELECT label->>'value' FROM unnest(d.labels) AS label WHERE label->>'isoCode' = 'fra' LIMIT 1), d.labels[1]->>'value') AS "nomCommune",
      a.meta->'ban'->'oldDistrict'->>'code' AS "codeAncienneCommune",
      a.meta->'ban'->'oldDistrict'->'labels'->0->>'value' AS "nomAncienneCommune",
      a.meta->'ban'->>'sourcePosition' AS "sourcePosition",
      t.meta->'ban'->>'sourceNomVoie' AS "sourceNomVoie",
      a.certified AS certifie, a."updateDate"::text AS "dateMAJ",
      ST_AsMVTGeom(ST_Transform(ban.tile_point(a.positions[1]->'geometry'), 3857), bounds.mercator, 4096, 0, true) AS geom
    FROM ban.address a
    JOIN ban.common_toponym t ON t.id = a."mainCommonToponymID" AND t."isActive"
    JOIN ban.district d ON d.id = a."districtID" AND d."isActive"
    CROSS JOIN bounds
    WHERE a."isActive" AND ban.tile_point(a.positions[1]->'geometry') && ST_Transform(bounds.mercator, 4326)
  ),
  toponyms AS (
    SELECT
      t.id::text AS id, COALESCE(NULLIF(t.meta->'ban'->>'category', ''), 'voie') AS type,
      COALESCE((SELECT label->>'value' FROM unnest(t.labels) AS label WHERE label->>'isoCode' = 'fra' LIMIT 1), t.labels[1]->>'value') AS "nomVoie",
      array_to_string(ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(t.meta->'dgfip'->'cadastre') = 'array' THEN t.meta->'dgfip'->'cadastre' ELSE '[]'::jsonb END)), '|') AS parcelles,
      d.meta->'insee'->>'cog' AS "codeCommune",
      COALESCE((SELECT label->>'value' FROM unnest(d.labels) AS label WHERE label->>'isoCode' = 'fra' LIMIT 1), d.labels[1]->>'value') AS "nomCommune",
      t.meta->'ban'->>'sourceNomVoie' AS "sourceNomVoie",
      (SELECT count(*) FROM ban.address a WHERE a."mainCommonToponymID" = t.id AND a."isActive") AS "nbNumeros",
      t."updateDate"::text AS "dateMAJ",
      ST_AsMVTGeom(ST_Transform(ban.tile_point(t.geometry), 3857), bounds.mercator, 4096, 0, true) AS geom
    FROM ban.common_toponym t
    JOIN ban.district d ON d.id = t."districtID" AND d."isActive"
    CROSS JOIN bounds
    WHERE t."isActive" AND ban.tile_point(t.geometry) && ST_Transform(bounds.mercator, 4326)
  )
  SELECT COALESCE((SELECT ST_AsMVT(addresses, 'adresses', 4096, 'geom') FROM addresses), ''::bytea)
      || COALESCE((SELECT ST_AsMVT(toponyms, 'toponymes', 4096, 'geom') FROM toponyms), ''::bytea) AS tile
`;

export async function getTile(pool: Pick<Pool, 'query'>, { z, x, y }: TileCoordinates): Promise<Buffer> {
  const result = await pool.query<{ tile: Buffer }>(tileQuery, [z, x, y]);
  return result.rows[0].tile;
}