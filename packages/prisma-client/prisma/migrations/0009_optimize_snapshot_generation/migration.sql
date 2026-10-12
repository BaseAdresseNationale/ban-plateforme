-- Cache commune metadata once per unbounded snapshot, rather than once per row.
-- Preselect departmental toponym IDs before sorting their valid versions.
-- Existing signatures, current/history priority, owners and ACL are preserved.
-- No business data writes, new indexes or DROP FUNCTION.
BEGIN;

CREATE OR REPLACE FUNCTION ban.snapshot_common_toponym(
  as_of timestamptz DEFAULT now(), ids uuid[] DEFAULT NULL,
  district_ids uuid[] DEFAULT NULL, departements text[] DEFAULT NULL
)
RETURNS TABLE (type text, nodeKey text, data jsonb)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH dept_districts AS MATERIALIZED (
    SELECT id FROM ban._snapshot_district_ids(as_of, departements)
  ), department_toponym_ids AS MATERIALIZED (
    SELECT ct.id FROM ban.common_toponym ct
    WHERE departements IS NOT NULL
      AND ct."districtID" = ANY(ARRAY(SELECT id FROM dept_districts))
      AND ct.range_validity @> as_of AND (ct."isActive" IS DISTINCT FROM false)
      AND (ids IS NULL OR ct.id = ANY(ids))
    UNION
    SELECT h.id FROM ban.common_toponym_h h
    WHERE departements IS NOT NULL
      AND h."districtID" = ANY(ARRAY(SELECT id FROM dept_districts))
      AND h.range_validity @> as_of AND (h."isActive" IS DISTINCT FROM false)
      AND (ids IS NULL OR h.id = ANY(ids))
  ), source_rows AS NOT MATERIALIZED (
    SELECT ct.id, ct."districtID" AS district_id, to_jsonb(ct) AS row_json,
      0 AS prio, ct.range_validity
    FROM ban.common_toponym ct
    WHERE ct.range_validity @> as_of AND (ct."isActive" IS DISTINCT FROM false)
    UNION ALL
    SELECT h.id, h."districtID", to_jsonb(h), 1, h.range_validity
    FROM ban.common_toponym_h h
    WHERE h.range_validity @> as_of AND (h."isActive" IS DISTINCT FROM false)
  ), candidates AS (
    SELECT s.* FROM source_rows s WHERE departements IS NULL
    UNION ALL
    -- Fetch ALL valid active versions of eligible IDs, not just those matching
    -- the department; otherwise a lower-priority historical row could reappear.
    SELECT s.* FROM department_toponym_ids d
    CROSS JOIN LATERAL (SELECT r.* FROM source_rows r WHERE r.id = d.id OFFSET 0) s
    WHERE departements IS NOT NULL
  ), picked AS (
    SELECT DISTINCT ON (id) id, district_id, row_json
    FROM candidates ORDER BY id, prio ASC, upper(range_validity) DESC NULLS LAST
  )
  SELECT 'toponym'::text, CONCAT('COMMON_TOPONYM', ':::', p.id)::text, p.row_json
  FROM picked p
  WHERE (ids IS NULL OR p.id = ANY(ids))
    AND (district_ids IS NULL OR p.district_id = ANY(district_ids))
    AND (departements IS NULL OR p.district_id = ANY(ARRAY(SELECT id FROM dept_districts)));
$$;

CREATE OR REPLACE FUNCTION ban.snapshot_common_toponym_ndjson(
  as_of timestamptz DEFAULT now(), ids uuid[] DEFAULT NULL,
  district_ids uuid[] DEFAULT NULL, departements text[] DEFAULT NULL
)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH district_cogs AS MATERIALIZED (
    -- No department filter here: COG resolution must match the unfiltered
    -- snapshot_district_cog helper, even when current/history departments differ.
    SELECT (d.data->>'id')::uuid AS id, d.data->'meta'->'insee'->>'cog' AS cog
    FROM ban.snapshot_district(as_of, district_ids, NULL) d
    WHERE ids IS NULL
  )
  SELECT jsonb_build_object(
    'type', t.type, 'nodeKey', t.nodeKey, 'data', t.data,
    'meta', ban.export_line_meta(t.data, CASE WHEN ids IS NULL THEN d.cog
      ELSE ban.snapshot_district_cog(as_of, (t.data->>'districtID')::uuid) END)
  )::text
  FROM ban.snapshot_common_toponym(as_of, ids, district_ids, departements) t
  LEFT JOIN district_cogs d ON d.id = (t.data->>'districtID')::uuid;
$$;

CREATE OR REPLACE FUNCTION ban.snapshot_address_ndjson(
  as_of timestamptz DEFAULT now(), ids uuid[] DEFAULT NULL,
  common_toponym_ids uuid[] DEFAULT NULL, district_ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH district_cogs AS MATERIALIZED (
    SELECT (d.data->>'id')::uuid AS id, d.data->'meta'->'insee'->>'cog' AS cog
    FROM ban.snapshot_district(as_of, district_ids, NULL) d
    WHERE ids IS NULL
  )
  SELECT jsonb_build_object(
    'type', t.type, 'nodeKey', t.nodeKey, 'data', t.data,
    'meta', ban.export_line_meta(t.data, CASE WHEN ids IS NULL THEN d.cog
      ELSE ban.snapshot_district_cog(as_of, (t.data->>'districtID')::uuid) END)
  )::text
  FROM ban.snapshot_address(as_of, ids, common_toponym_ids, district_ids, departements) t
  LEFT JOIN district_cogs d ON d.id = (t.data->>'districtID')::uuid;
$$;

COMMIT;
