-- Keep Full and DIFF address filters in child-to-parent order:
-- ids, common_toponym_ids, district_ids.

-- PostgreSQL does not allow input parameters to be renamed by CREATE OR REPLACE.
-- Drop the dependent wrapper first; the migration is transactional.
DROP FUNCTION IF EXISTS ban.snapshot_address_ndjson(timestamptz, uuid[], uuid[], uuid[], text[]);
DROP FUNCTION IF EXISTS ban.snapshot_address(timestamptz, uuid[], uuid[], uuid[], text[]);

CREATE OR REPLACE FUNCTION ban.snapshot_address(
  as_of timestamptz DEFAULT now(),
  ids uuid[] DEFAULT NULL,
  common_toponym_ids uuid[] DEFAULT NULL,
  district_ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
RETURNS TABLE (type text, nodeKey text, data jsonb)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH dept_districts AS (
    SELECT id FROM ban._snapshot_district_ids(as_of, departements)
  ), candidates AS (
    SELECT a.id, a."districtID" AS district_id, a."mainCommonToponymID" AS main_ct_id,
      a."secondaryCommonToponymIDs" AS secondary_ct_ids, to_jsonb(a) AS row_json, 0 AS prio, a.range_validity
    FROM ban.address a WHERE a.range_validity @> as_of AND (a."isActive" IS DISTINCT FROM false)
    UNION ALL
    SELECT h.id, h."districtID", h."mainCommonToponymID", h."secondaryCommonToponymIDs", to_jsonb(h), 1, h.range_validity
    FROM ban.address_h h WHERE h.range_validity @> as_of AND (h."isActive" IS DISTINCT FROM false)
  ), picked AS (
    SELECT DISTINCT ON (id) id, district_id, main_ct_id, secondary_ct_ids, row_json
    FROM candidates ORDER BY id, prio ASC, upper(range_validity) DESC NULLS LAST
  )
  SELECT 'address'::text, CONCAT('ADDRESS', ':::', p.id)::text, p.row_json
  FROM picked p
  WHERE (ids IS NULL OR p.id = ANY(ids))
    AND (common_toponym_ids IS NULL OR p.main_ct_id = ANY(common_toponym_ids) OR p.secondary_ct_ids && common_toponym_ids)
    AND (district_ids IS NULL OR p.district_id = ANY(district_ids))
    AND (departements IS NULL OR p.district_id IN (SELECT id FROM dept_districts));
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

CREATE OR REPLACE FUNCTION ban.diff_address_ndjson(
  t_from timestamptz, t_to timestamptz, ids uuid[] DEFAULT NULL,
  common_toponym_ids uuid[] DEFAULT NULL, district_ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
RETURNS SETOF text LANGUAGE sql STABLE
AS $$
  SELECT (row_to_json(a)::jsonb || jsonb_build_object(
    'meta', ban.merge_export_line_meta(
      a.datas[1], a.datas[2],
      ban.snapshot_district_cog(CASE WHEN a.event = 'disabled' THEN t_from ELSE t_to END,
        (COALESCE(a.datas[1]->>'districtID', a.datas[2]->>'districtID'))::uuid)
    )
  ))::text
  FROM ban.diff_address(t_from, t_to, ids, common_toponym_ids, district_ids, departements) a;
$$;
