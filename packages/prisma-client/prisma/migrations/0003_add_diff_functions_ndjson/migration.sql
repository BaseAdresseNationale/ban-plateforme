-- ===============================================
-- NDJSON wrappers for diff functions
-- ===============================================

-- -----------------------------------------------
-- DISTRICT
-- -----------------------------------------------

CREATE OR REPLACE FUNCTION ban.diff_district_ndjson(
  t_from timestamptz,
  t_to   timestamptz,
  ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT row_to_json(d)::text
  FROM ban.diff_district(t_from, t_to, ids, departements) d;
$$;


-- -----------------------------------------------
-- COMMON_TOPONYM
-- -----------------------------------------------

CREATE OR REPLACE FUNCTION ban.diff_common_toponym_ndjson(
  t_from timestamptz,
  t_to   timestamptz,
  ids uuid[] DEFAULT NULL,
  district_ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT row_to_json(ct)::text
  FROM ban.diff_common_toponym(t_from, t_to, ids, district_ids, departements) ct;
$$;


-- -----------------------------------------------
-- ADDRESS
-- -----------------------------------------------

CREATE OR REPLACE FUNCTION ban.diff_address_ndjson(
  t_from timestamptz,
  t_to   timestamptz,
  ids uuid[] DEFAULT NULL,
  common_toponym_ids uuid[] DEFAULT NULL,
  district_ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL

)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT row_to_json(a)::text
  FROM ban.diff_address(
    t_from,
    t_to,
    ids,
    district_ids,
    common_toponym_ids,
    departements
  ) a;
$$;

-- ----------
-- -- TEST --
-- ----------

-- SELECT *
-- FROM ban.diff_district_ndjson(
--   '2025-10-06T00:00:00Z',
--   '2025-10-12T00:00:00Z',
--   NULL,        -- ARRAY[uuid] -- ids
--   ARRAY['31']  -- ARRAY[text] -- departements
-- );

-- SELECT *
-- FROM ban.diff_common_toponym_ndjson(
--   '2025-10-06T00:00:00Z',
--   '2025-10-12T00:00:00Z',
--   NULL,      -- ARRAY[uuid] -- ids
--   NULL,      -- ARRAY[uuid] -- district_ids
--   ARRAY['31']  -- ARRAY[text] -- departements
-- );

-- SELECT *
-- FROM ban.diff_address_ndjson(
--   '2025-10-06T00:00:00Z',
--   '2025-10-12T00:00:00Z',
--   NULL,        -- ARRAY[uuid] -- ids
--   NULL,        -- ARRAY[uuid] -- common_toponym_ids
--   NULL,        -- ARRAY[uuid] -- district_ids
--   ARRAY['31']  -- ARRAY[text] -- departements
-- );
