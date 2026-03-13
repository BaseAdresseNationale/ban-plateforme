-- =========================================================
-- NDJSON wrappers for snapshot functions
-- Each line: {"type": "...", "nodeKey": "...", "data": {...}}
-- =========================================================

-- -----------------------------------------------
-- DISTRICT
-- -----------------------------------------------

DROP FUNCTION IF EXISTS ban.snapshot_district_ndjson(timestamptz, uuid[], text[]);
CREATE OR REPLACE FUNCTION ban.snapshot_district_ndjson(
  as_of timestamptz DEFAULT now(),
  ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT jsonb_build_object(
    'type', t.type,
    'nodeKey', t.nodeKey,
    'data', t.data
  )::text
  FROM ban.snapshot_district(as_of, ids, departements) t;
$$;

-- -----------------------------------------------
-- COMMON_TOPONYM
-- -----------------------------------------------

DROP FUNCTION IF EXISTS ban.snapshot_common_toponym_ndjson(timestamptz, uuid[], uuid[], text[]);
CREATE OR REPLACE FUNCTION ban.snapshot_common_toponym_ndjson(
  as_of timestamptz DEFAULT now(),
  ids uuid[] DEFAULT NULL,
  district_ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT jsonb_build_object(
    'type', t.type,
    'nodeKey', t.nodeKey,
    'data', t.data
  )::text
  FROM ban.snapshot_common_toponym(as_of, ids, district_ids, departements) t;
$$;

-- -----------------------------------------------
-- ADDRESS
-- -----------------------------------------------

DROP FUNCTION IF EXISTS ban.snapshot_address_ndjson(timestamptz, uuid[], uuid[], uuid[], text[]);
CREATE OR REPLACE FUNCTION ban.snapshot_address_ndjson(
  as_of timestamptz DEFAULT now(),
  ids uuid[] DEFAULT NULL,
  district_ids uuid[] DEFAULT NULL,
  common_toponym_ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT jsonb_build_object(
    'type', t.type,
    'nodeKey', t.nodeKey,
    'data', t.data
  )::text
  FROM ban.snapshot_address(as_of, ids, district_ids, common_toponym_ids, departements) t;
$$;

-- ----------
-- -- TEST --
-- ----------

-- SELECT *
-- FROM ban.snapshot_district_ndjson(
--   '2025-10-06T00:00:00Z',
--   NULL,        -- ARRAY[uuid] -- ids
--   ARRAY['31']  -- ARRAY[text] -- departements
-- );

-- SELECT *
-- FROM ban.snapshot_common_toponym_ndjson(
--   '2025-10-06T00:00:00Z',
--   NULL,      -- ARRAY[uuid] -- ids
--   NULL,      -- ARRAY[uuid] -- district_ids
--   ARRAY['31']  -- ARRAY[text] -- departements
-- );

-- SELECT *
-- FROM ban.snapshot_address_ndjson(
--   '2025-10-06T00:00:00Z',
--   NULL,        -- ARRAY[uuid] -- ids
--   NULL,        -- ARRAY[uuid] -- district_ids
--   NULL,        -- ARRAY[uuid] -- common_toponym_ids
--   ARRAY['31']  -- ARRAY[text] -- departements
-- );
