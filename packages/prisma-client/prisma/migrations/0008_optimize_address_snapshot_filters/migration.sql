-- Preselect department address IDs before sorting, then retain all versions of
-- those IDs so current/history priority and post-selection filters are unchanged.
-- No data writes, new indexes, ownership changes or DROP FUNCTION.
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
  WITH dept_districts AS MATERIALIZED (
    SELECT id FROM ban._snapshot_district_ids(as_of, departements)
  ), department_address_ids AS MATERIALIZED (
    SELECT a.id FROM ban.address a
    WHERE departements IS NOT NULL
      AND a."districtID" = ANY(ARRAY(SELECT id FROM dept_districts))
      AND a.range_validity @> as_of AND (a."isActive" IS DISTINCT FROM false)
      AND (ids IS NULL OR a.id = ANY(ids))
    UNION
    SELECT h.id FROM ban.address_h h
    WHERE departements IS NOT NULL
      AND h."districtID" = ANY(ARRAY(SELECT id FROM dept_districts))
      AND h.range_validity @> as_of AND (h."isActive" IS DISTINCT FROM false)
      AND (ids IS NULL OR h.id = ANY(ids))
  ), source_rows AS NOT MATERIALIZED (
    SELECT a.id, a."districtID" AS district_id, a."mainCommonToponymID" AS main_ct_id,
      a."secondaryCommonToponymIDs" AS secondary_ct_ids, to_jsonb(a) AS row_json, 0 AS prio, a.range_validity
    FROM ban.address a WHERE a.range_validity @> as_of AND (a."isActive" IS DISTINCT FROM false)
    UNION ALL
    SELECT h.id, h."districtID", h."mainCommonToponymID", h."secondaryCommonToponymIDs", to_jsonb(h), 1, h.range_validity
    FROM ban.address_h h WHERE h.range_validity @> as_of AND (h."isActive" IS DISTINCT FROM false)
  ), candidates AS (
    -- The unrestricted path bypasses the department preselection entirely.
    SELECT s.* FROM source_rows s WHERE departements IS NULL
    UNION ALL
    -- Include every valid active version of each eligible ID, even if another
    -- version has a different district/toponym. Apply final filters after picking.
    -- OFFSET 0 keeps this ID-bound lookup lateral: historical dates must not
    -- turn the join back into a scan of every address valid nationwide.
    SELECT s.* FROM department_address_ids d
    CROSS JOIN LATERAL (SELECT r.* FROM source_rows r WHERE r.id = d.id OFFSET 0) s
    WHERE departements IS NOT NULL
  ), picked AS (
    SELECT DISTINCT ON (id) id, district_id, main_ct_id, secondary_ct_ids, row_json
    FROM candidates ORDER BY id, prio ASC, upper(range_validity) DESC NULLS LAST
  )
  SELECT 'address'::text, CONCAT('ADDRESS', ':::', p.id)::text, p.row_json
  FROM picked p
  WHERE (ids IS NULL OR p.id = ANY(ids))
    AND (common_toponym_ids IS NULL OR p.main_ct_id = ANY(common_toponym_ids) OR p.secondary_ct_ids && common_toponym_ids)
    AND (district_ids IS NULL OR p.district_id = ANY(district_ids))
    AND (departements IS NULL OR p.district_id = ANY(ARRAY(SELECT id FROM dept_districts)));
$$;
