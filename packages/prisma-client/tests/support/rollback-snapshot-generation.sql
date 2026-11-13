-- Reference immediately before 0009 (after 0008). Compare with the actual
-- deployed definitions before any authorised rollback; Prisma state is separate.
BEGIN;

CREATE OR REPLACE FUNCTION ban.snapshot_common_toponym(
  as_of timestamptz DEFAULT now(), ids uuid[] DEFAULT NULL,
  district_ids uuid[] DEFAULT NULL, departements text[] DEFAULT NULL
)
RETURNS TABLE (type text, nodeKey text, data jsonb)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH dept_districts AS (
    SELECT id FROM ban._snapshot_district_ids(as_of, departements)
  ), candidates AS (
    SELECT ct.id, ct."districtID" AS district_id, to_jsonb(ct) AS row_json, 0 AS prio, ct.range_validity
    FROM ban.common_toponym ct
    WHERE ct.range_validity @> as_of AND (ct."isActive" IS DISTINCT FROM false)
    UNION ALL
    SELECT h.id, h."districtID" AS district_id, to_jsonb(h) AS row_json, 1 AS prio, h.range_validity
    FROM ban.common_toponym_h h
    WHERE h.range_validity @> as_of AND (h."isActive" IS DISTINCT FROM false)
  ), picked AS (
    SELECT DISTINCT ON (id) id, district_id, row_json
    FROM candidates ORDER BY id, prio ASC, upper(range_validity) DESC NULLS LAST
  )
  SELECT 'toponym'::text AS type, CONCAT('COMMON_TOPONYM', ':::', p.id)::text AS nodeKey, p.row_json AS data
  FROM picked p
  WHERE (ids IS NULL OR p.id = ANY(ids))
    AND (district_ids IS NULL OR p.district_id = ANY(district_ids))
    AND (departements IS NULL OR p.district_id IN (SELECT id FROM dept_districts));
$$;

CREATE OR REPLACE FUNCTION ban.snapshot_common_toponym_ndjson(
  as_of timestamptz DEFAULT now(), ids uuid[] DEFAULT NULL,
  district_ids uuid[] DEFAULT NULL, departements text[] DEFAULT NULL
)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT jsonb_build_object(
    'type', t.type, 'nodeKey', t.nodeKey, 'data', t.data,
    'meta', ban.export_line_meta(t.data,
      ban.snapshot_district_cog(as_of, (t.data->>'districtID')::uuid))
  )::text
  FROM ban.snapshot_common_toponym(as_of, ids, district_ids, departements) t;
$$;

CREATE OR REPLACE FUNCTION ban.snapshot_address_ndjson(
  as_of timestamptz DEFAULT now(), ids uuid[] DEFAULT NULL,
  common_toponym_ids uuid[] DEFAULT NULL, district_ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT jsonb_build_object(
    'type', t.type, 'nodeKey', t.nodeKey, 'data', t.data,
    'meta', ban.export_line_meta(t.data, ban.snapshot_district_cog(as_of, (t.data->>'districtID')::uuid))
  )::text
  FROM ban.snapshot_address(as_of, ids, common_toponym_ids, district_ids, departements) t;
$$;

COMMIT;
