-- =========================================================
-- Snapshot functions (current + history)
-- Returns a row "as of" a given timestamp, by looking in the
-- live table first, then the _h table if needed.
--
-- Output shape matches your export/diff conventions:
--   (type, nodeKey, data)
--
-- NOTE:
-- - We keep SECURITY INVOKER (recommended).
-- - These are STABLE (depend on DB contents + as_of).
-- =========================================================

-- ---------------------------------------------------------
-- Helper: district ids matching departements "as of" date
-- (used by other snapshot functions)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION ban._snapshot_district_ids(
  as_of timestamptz,
  departements text[]
)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  -- If no departements filter, return empty set; caller should
  -- bypass usage when departements is NULL.
  SELECT DISTINCT s.id
  FROM (
    SELECT d.id, d.meta, d."isActive", d.range_validity, 0 AS prio
    FROM ban.district d
    WHERE d.range_validity @> as_of

    UNION ALL

    SELECT h.id, h.meta, h."isActive", h.range_validity, 1 AS prio
    FROM ban.district_h h
    WHERE h.range_validity @> as_of
  ) s
  WHERE departements IS NOT NULL
    AND (s."isActive" IS DISTINCT FROM false)
    AND ban.dept_code_from_cog(s.meta->'insee'->>'cog') = ANY(departements);
$$;

-- ---------------------------------------------------------
-- 1) DISTRICT snapshot
-- ---------------------------------------------------------
DROP FUNCTION IF EXISTS ban.snapshot_district(timestamptz, uuid[], text[]);

CREATE OR REPLACE FUNCTION ban.snapshot_district(
  as_of timestamptz DEFAULT now(),
  ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
RETURNS TABLE (
  type text,
  nodeKey text,
  data jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH candidates AS (
    SELECT d.id, to_jsonb(d) AS row_json, 0 AS prio, d.range_validity
    FROM ban.district d
    WHERE d.range_validity @> as_of
      AND (d."isActive" IS DISTINCT FROM false)

    UNION ALL

    SELECT h.id, to_jsonb(h) AS row_json, 1 AS prio, h.range_validity
    FROM ban.district_h h
    WHERE h.range_validity @> as_of
      AND (h."isActive" IS DISTINCT FROM false)
  ),
  picked AS (
    -- If overlaps ever happen, prefer live table; otherwise, either is fine.
    SELECT DISTINCT ON (id) id, row_json
    FROM candidates
    ORDER BY id, prio ASC, upper(range_validity) DESC NULLS LAST
  )
  SELECT
    'district'::text AS type,
    CONCAT('DISTRICT', ':::', p.id)::text AS nodeKey,
    p.row_json AS data
  FROM picked p
  WHERE (ids IS NULL OR p.id = ANY(ids))
    AND (
      departements IS NULL
      OR ban.dept_code_from_cog(p.row_json->'meta'->'insee'->>'cog') = ANY(departements)
    );
$$;

-- ---------------------------------------------------------
-- 2) COMMON_TOPONYM snapshot
-- ---------------------------------------------------------
DROP FUNCTION IF EXISTS ban.snapshot_common_toponym(timestamptz, uuid[], uuid[], text[]);

CREATE OR REPLACE FUNCTION ban.snapshot_common_toponym(
  as_of timestamptz DEFAULT now(),
  ids uuid[] DEFAULT NULL,
  district_ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
RETURNS TABLE (
  type text,
  nodeKey text,
  data jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH dept_districts AS (
    SELECT id
    FROM ban._snapshot_district_ids(as_of, departements)
  ),
  candidates AS (
    SELECT ct.id, ct."districtID" AS district_id, to_jsonb(ct) AS row_json, 0 AS prio, ct.range_validity
    FROM ban.common_toponym ct
    WHERE ct.range_validity @> as_of
      AND (ct."isActive" IS DISTINCT FROM false)

    UNION ALL

    SELECT h.id, h."districtID" AS district_id, to_jsonb(h) AS row_json, 1 AS prio, h.range_validity
    FROM ban.common_toponym_h h
    WHERE h.range_validity @> as_of
      AND (h."isActive" IS DISTINCT FROM false)
  ),
  picked AS (
    SELECT DISTINCT ON (id) id, district_id, row_json
    FROM candidates
    ORDER BY id, prio ASC, upper(range_validity) DESC NULLS LAST
  )
  SELECT
    'toponym'::text AS type,
    CONCAT('COMMON_TOPONYM', ':::', p.id)::text AS nodeKey,
    p.row_json AS data
  FROM picked p
  WHERE (ids IS NULL OR p.id = ANY(ids))
    AND (district_ids IS NULL OR p.district_id = ANY(district_ids))
    AND (
      departements IS NULL
      OR p.district_id IN (SELECT id FROM dept_districts)
    );
$$;

-- ---------------------------------------------------------
-- 3) ADDRESS snapshot
-- ---------------------------------------------------------
DROP FUNCTION IF EXISTS ban.snapshot_address(timestamptz, uuid[], uuid[], uuid[], text[]);

CREATE OR REPLACE FUNCTION ban.snapshot_address(
  as_of timestamptz DEFAULT now(),
  ids uuid[] DEFAULT NULL,
  district_ids uuid[] DEFAULT NULL,
  common_toponym_ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
RETURNS TABLE (
  type text,
  nodeKey text,
  data jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH dept_districts AS (
    SELECT id
    FROM ban._snapshot_district_ids(as_of, departements)
  ),
  candidates AS (
    SELECT
      a.id,
      a."districtID" AS district_id,
      a."mainCommonToponymID" AS main_ct_id,
      a."secondaryCommonToponymIDs" AS secondary_ct_ids,
      to_jsonb(a) AS row_json,
      0 AS prio,
      a.range_validity
    FROM ban.address a
    WHERE a.range_validity @> as_of
      AND (a."isActive" IS DISTINCT FROM false)

    UNION ALL

    SELECT
      h.id,
      h."districtID" AS district_id,
      h."mainCommonToponymID" AS main_ct_id,
      h."secondaryCommonToponymIDs" AS secondary_ct_ids,
      to_jsonb(h) AS row_json,
      1 AS prio,
      h.range_validity
    FROM ban.address_h h
    WHERE h.range_validity @> as_of
      AND (h."isActive" IS DISTINCT FROM false)
  ),
  picked AS (
    SELECT DISTINCT ON (id)
      id, district_id, main_ct_id, secondary_ct_ids, row_json
    FROM candidates
    ORDER BY id, prio ASC, upper(range_validity) DESC NULLS LAST
  )
  SELECT
    'address'::text AS type,
    CONCAT('ADDRESS', ':::', p.id)::text AS nodeKey,
    p.row_json AS data
  FROM picked p
  WHERE (ids IS NULL OR p.id = ANY(ids))
    AND (district_ids IS NULL OR p.district_id = ANY(district_ids))
    AND (
      departements IS NULL
      OR p.district_id IN (SELECT id FROM dept_districts)
    )
    AND (
      common_toponym_ids IS NULL
      OR p.main_ct_id = ANY(common_toponym_ids)
      OR (p.secondary_ct_ids && common_toponym_ids)
    );
$$;

-- ----------
-- -- TEST --
-- ----------

-- SELECT *
-- FROM ban.snapshot_district(
--   '2025-10-06T00:00:00Z',
--   NULL,        -- ARRAY[uuid] -- ids
--   ARRAY['31']  -- ARRAY[text] -- departements
-- );

-- SELECT *
-- FROM ban.snapshot_common_toponym(
--   '2025-10-06T00:00:00Z',
--   NULL,        -- ARRAY[uuid] -- ids
--   NULL,        -- ARRAY[uuid] -- district_ids
--   ARRAY['31']  -- ARRAY[text] -- departements
-- );

-- SELECT *
-- FROM ban.snapshot_address(
--   '2025-10-06T00:00:00Z',
--   NULL,        -- ARRAY[uuid] -- ids
--   NULL,        -- ARRAY[uuid] -- district_ids
--   NULL,        -- ARRAY[uuid] -- common_toponym_ids
--   ARRAY['31']  -- ARRAY[text] -- departements
-- );
