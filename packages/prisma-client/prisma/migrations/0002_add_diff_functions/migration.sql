-- =========================================================
-- 0) Helpers (dept code)
-- =========================================================
CREATE OR REPLACE FUNCTION ban.dept_code_from_cog(cog text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN left(cog, 2) IN ('97','98') THEN left(cog, 3)
    ELSE left(cog, 2)
  END
$$;

-- =========================================================
-- 1) DIFF DISTRICT
-- =========================================================
CREATE OR REPLACE FUNCTION ban.diff_district(
  t_from timestamptz,
  t_to   timestamptz,
  ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
-- RETURNS TABLE (
--   id uuid,
--   event text,
--   before_row jsonb,
--   after_row jsonb
-- )
RETURNS TABLE (
  event text,
  type text,
  nodeKey text,
  datas jsonb[]
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
WITH
params AS (
  SELECT
    t_from,
    t_to,
    tstzrange(t_from, t_to, '[)') AS win,
    ids,
    departements
),

target_ids AS (
  SELECT d.id
  FROM ban.district d
  CROSS JOIN params p
  WHERE
    (p.ids IS NULL OR d.id = ANY(p.ids))
    AND (
      p.departements IS NULL
      OR ban.dept_code_from_cog(d.meta->'insee'->>'cog') = ANY(p.departements)
    )
),

changed_ids AS (
  -- Historique
  SELECT DISTINCT h.id
  FROM ban.district_h h
  JOIN params p ON TRUE
  JOIN target_ids t ON t.id = h.id
  WHERE h.range_validity && p.win

  UNION

  -- Courant
  SELECT DISTINCT d.id
  FROM ban.district d
  JOIN params p ON TRUE
  JOIN target_ids t ON t.id = d.id
  WHERE lower(d.range_validity) >= p.t_from
    AND lower(d.range_validity) <  p.t_to
),

snap AS (
  SELECT
    c.id,
    b.before_row,
    a.after_row,
    (b.before_row - 'range_validity') AS before_cmp,
    (a.after_row  - 'range_validity') AS after_cmp
  FROM changed_ids c
  CROSS JOIN params p

  LEFT JOIN LATERAL (
    SELECT to_jsonb(x) AS before_row
    FROM (
      SELECT * FROM ban.district
      WHERE id = c.id AND range_validity @> p.t_from
      UNION ALL
      SELECT * FROM ban.district_h
      WHERE id = c.id AND range_validity @> p.t_from
      LIMIT 1
    ) x
  ) b ON TRUE

  LEFT JOIN LATERAL (
    SELECT to_jsonb(x) AS after_row
    FROM (
      SELECT * FROM ban.district
      WHERE id = c.id AND range_validity @> p.t_to
      UNION ALL
      SELECT * FROM ban.district_h
      WHERE id = c.id AND range_validity @> p.t_to
      LIMIT 1
    ) x
  ) a ON TRUE
)

SELECT
--   id,
  CASE
    WHEN before_row IS NULL AND after_row IS NOT NULL THEN 'created'
    WHEN (before_row->>'isActive')::boolean = true
     AND (after_row ->>'isActive')::boolean = false THEN 'disabled'
    WHEN before_row IS NOT NULL AND after_row IS NOT NULL
     AND before_cmp IS DISTINCT FROM after_cmp THEN 'updated'
    ELSE NULL
  END AS event,
--   before_row,
--   after_row

  -- CASE
  --   WHEN before_row IS NULL AND after_row IS NOT NULL THEN 'created'
  --   WHEN (before_row->>'isActive')::boolean = true
  --    AND (after_row ->>'isActive')::boolean = false THEN 'disabled'
  --   WHEN before_row IS NOT NULL AND after_row IS NOT NULL
  --    AND before_cmp IS DISTINCT FROM after_cmp THEN 'updated'
  --   ELSE NULL
  -- END AS event,
  'district' AS type,
  CONCAT('DISTRICT', ':::', id) AS nodeKey,
  ARRAY[after_row, before_row] AS datas
FROM snap
WHERE
  (before_row IS NULL AND after_row IS NOT NULL)
  OR ((before_row->>'isActive')::boolean = true AND (after_row->>'isActive')::boolean = false)
  OR (before_row IS NOT NULL AND after_row IS NOT NULL AND before_cmp IS DISTINCT FROM after_cmp);
$$;

-- =========================================================
-- 2) DIFF COMMON TOPONYM
-- =========================================================
CREATE OR REPLACE FUNCTION ban.diff_common_toponym(
  t_from timestamptz,
  t_to   timestamptz,
  ids uuid[] DEFAULT NULL,
  district_ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
RETURNS TABLE (
  event text,
  type text,
  nodeKey text,
  datas jsonb[]
)
LANGUAGE sql
SECURITY INVOKER
AS $$
WITH
params AS (
  SELECT
    t_from,
    t_to,
    tstzrange(t_from, t_to, '[)') AS win,

    ids,          -- ex: ARRAY['...','...']::uuid[]
    district_ids, -- ex: ARRAY['...','...']::uuid[]
    departements  -- ex: ARRAY['31','64']::text[]
),

district_filter AS (
  SELECT d.id
  FROM ban.district d, params p
  WHERE p.departements IS NULL
     OR ban.dept_code_from_cog(d.meta->'insee'->>'cog') = ANY(p.departements)
),

target_districts AS (
  SELECT unnest(p.district_ids) AS id
  FROM params p
  WHERE p.district_ids IS NOT NULL

  UNION

  SELECT df.id
  FROM params p
  JOIN district_filter df ON p.district_ids IS NULL AND p.departements IS NOT NULL
),

changed_ids AS (
  -- Historique (common_toponym_h)
  SELECT DISTINCT h.id
  FROM params p
  JOIN target_districts td ON TRUE
  JOIN ban.common_toponym_h h
    ON h."districtID" = td.id
   AND h.range_validity && p.win
  WHERE (p.ids IS NULL OR h.id = ANY(p.ids))

  UNION

  -- Courant (common_toponym)
  SELECT DISTINCT ct.id
  FROM params p
  JOIN target_districts td ON TRUE
  JOIN ban.common_toponym ct
    ON ct."districtID" = td.id
   AND lower(ct.range_validity) >= p.t_from
   AND lower(ct.range_validity) <  p.t_to
  WHERE (p.ids IS NULL OR ct.id = ANY(p.ids))
),

snap AS (
  SELECT
    c.id,
    b.before_row,
    a.after_row,
    (b.before_row - 'range_validity') AS before_cmp,
    (a.after_row  - 'range_validity') AS after_cmp
  FROM changed_ids c
  CROSS JOIN params p

  LEFT JOIN LATERAL (
    SELECT to_jsonb(x) AS before_row
    FROM (
      SELECT * FROM ban.common_toponym
      WHERE id = c.id AND range_validity @> p.t_from
      UNION ALL
      SELECT * FROM ban.common_toponym_h
      WHERE id = c.id AND range_validity @> p.t_from
      LIMIT 1
    ) x
  ) b ON TRUE

  LEFT JOIN LATERAL (
    SELECT to_jsonb(x) AS after_row
    FROM (
      SELECT * FROM ban.common_toponym
      WHERE id = c.id AND range_validity @> p.t_to
      UNION ALL
      SELECT * FROM ban.common_toponym_h
      WHERE id = c.id AND range_validity @> p.t_to
      LIMIT 1
    ) x
  ) a ON TRUE
)

SELECT
  -- id,
  -- CASE
  --   WHEN before_row IS NULL AND after_row IS NOT NULL THEN 'created'
  --   WHEN (before_row->>'isActive')::boolean = true
  --    AND (after_row ->>'isActive')::boolean = false THEN 'disabled'
  --   WHEN before_row IS NOT NULL AND after_row IS NOT NULL
  --    AND before_cmp IS DISTINCT FROM after_cmp THEN 'updated'
  --   ELSE NULL
  -- END AS event,
  -- before_row,
  -- after_row
  CASE
    WHEN before_row IS NULL AND after_row IS NOT NULL THEN 'created'
    WHEN (before_row->>'isActive')::boolean = true
     AND (after_row ->>'isActive')::boolean = false THEN 'disabled'
    WHEN before_row IS NOT NULL AND after_row IS NOT NULL
     AND before_cmp IS DISTINCT FROM after_cmp THEN 'updated'
    ELSE NULL
  END AS event,
  'toponym' AS type,
  CONCAT('TOPONYM', ':::', id) AS nodeKey,
  ARRAY[after_row, before_row] AS datas
FROM snap
WHERE
  (before_row IS NULL AND after_row IS NOT NULL)
  OR ((before_row->>'isActive')::boolean = true AND (after_row->>'isActive')::boolean = false)
  OR (before_row IS NOT NULL AND after_row IS NOT NULL AND before_cmp IS DISTINCT FROM after_cmp);
$$;

-- =========================================================
-- 3) DIFF ADDRESS
-- =========================================================
-- OK 🚀 / ADDRESS --
CREATE OR REPLACE FUNCTION ban.diff_address(
  t_from timestamptz,
  t_to   timestamptz,
  ids uuid[] DEFAULT NULL,
  common_toponym_ids uuid[] DEFAULT NULL,
  district_ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
RETURNS TABLE (
  event text,
  type text,
  nodeKey text,
  datas jsonb[]
)
LANGUAGE sql
STABLE
AS $$
WITH
params AS (
  SELECT
    -- Fenêtre diff
    t_from,
    t_to,
    tstzrange(t_from, t_to, '[)') AS win,

    -- Filtres optionnels
    ids,                -- ex: ARRAY['...','...']::uuid[]
    district_ids,       -- ex: ARRAY['...','...']::uuid[]
    common_toponym_ids, -- ex: ARRAY['...','...']::uuid[]
    departements        -- ex: ARRAY['31','64']::text[]
),

district_filter AS (
  -- districts correspondant aux départements demandés
  SELECT d.id
  FROM ban.district d, params p
  WHERE p.departements IS NULL
     OR ban.dept_code_from_cog(d.meta->'insee'->>'cog') = ANY(p.departements)
),

changed_ids AS (
  -- =========================
  -- HISTORIQUE (address_h)
  -- =========================
  SELECT DISTINCT h.id
  FROM ban.address_h h, params p
  WHERE h.range_validity && p.win
    AND (p.ids IS NULL OR h.id = ANY(p.ids))
    AND (p.district_ids IS NULL OR h."districtID" = ANY(p.district_ids))
    AND (p.departements IS NULL OR h."districtID" IN (SELECT id FROM district_filter))
    AND (
      p.common_toponym_ids IS NULL
      OR h."mainCommonToponymID" = ANY(p.common_toponym_ids)
      OR EXISTS (
        SELECT 1
        FROM unnest(p.common_toponym_ids) ct
        WHERE ct = ANY(h."secondaryCommonToponymIDs")
      )
    )

  UNION

  -- =========================
  -- COURANT (address)
  -- =========================
  SELECT DISTINCT a.id
  FROM ban.address a, params p
  WHERE lower(a.range_validity) >= p.t_from
    AND lower(a.range_validity) <  p.t_to
    AND (p.ids IS NULL OR a.id = ANY(p.ids))
    AND (p.district_ids IS NULL OR a."districtID" = ANY(p.district_ids))
    AND (p.departements IS NULL OR a."districtID" IN (SELECT id FROM district_filter))
    AND (
      p.common_toponym_ids IS NULL
      OR a."mainCommonToponymID" = ANY(p.common_toponym_ids)
      OR EXISTS (
        SELECT 1
        FROM unnest(p.common_toponym_ids) ct
        WHERE ct = ANY(a."secondaryCommonToponymIDs")
      )
    )
),

snap AS (
  SELECT
    c.id,
    b.before_row,
    a.after_row,
    (b.before_row - 'range_validity') AS before_cmp,
    (a.after_row  - 'range_validity') AS after_cmp,
    (a.after_row->>'districtID')::uuid AS district_id,
    (a.after_row->>'mainCommonToponymID')::uuid AS main_common_toponym_id,
    (a.after_row->>'number')::integer AS address_number,
    (a.after_row->>'suffix')::text AS address_suffix
  FROM changed_ids c
  CROSS JOIN params p

  LEFT JOIN LATERAL (
    SELECT to_jsonb(x) AS before_row
    FROM (
      SELECT * FROM ban.address
      WHERE id = c.id AND range_validity @> p.t_from
      UNION ALL
      SELECT * FROM ban.address_h
      WHERE id = c.id AND range_validity @> p.t_from
      LIMIT 1
    ) x
  ) b ON TRUE

  LEFT JOIN LATERAL (
    SELECT to_jsonb(x) AS after_row
    FROM (
      SELECT * FROM ban.address
      WHERE id = c.id AND range_validity @> p.t_to
      UNION ALL
      SELECT * FROM ban.address_h
      WHERE id = c.id AND range_validity @> p.t_to
      LIMIT 1
    ) x
  ) a ON TRUE
)

SELECT
  CASE
    WHEN before_row IS NULL AND after_row IS NOT NULL THEN 'created'
    WHEN (before_row->>'isActive')::boolean = true
     AND (after_row ->>'isActive')::boolean = false THEN 'disabled'
    WHEN before_row IS NOT NULL AND after_row IS NOT NULL
     AND before_cmp IS DISTINCT FROM after_cmp THEN 'updated'
    ELSE NULL
  END AS event,
  'address' AS type,
  CONCAT('ADDRESS', ':::', id) AS nodeKey,
  ARRAY[after_row, before_row] AS datas
FROM snap
WHERE
  (before_row IS NULL AND after_row IS NOT NULL)
  OR ((before_row->>'isActive')::boolean = true AND (after_row->>'isActive')::boolean = false)
  OR (before_row IS NOT NULL AND after_row IS NOT NULL AND before_cmp IS DISTINCT FROM after_cmp)
ORDER BY
  event,
  type,
  district_id,
  main_common_toponym_id,
  address_number,
  address_suffix;
$$;

-- ----------
-- -- TEST --
-- ----------

-- SELECT *
-- FROM ban.diff_district(
--   '2025-10-06T00:00:00Z'::timestamptz,
--   '2025-10-12T00:00:00Z'::timestamptz,
--   NULL,         -- ids
--   ARRAY['31']   -- departements
-- );

-- SELECT *
-- FROM ban.diff_common_toponym(
--   '2025-10-06T00:00:00Z'::timestamptz,
--   '2025-10-12T00:00:00Z'::timestamptz,
--   NULL,
--   NULL,
--   ARRAY['31']
-- );

-- SELECT *
-- FROM ban.diff_address(
--   '2025-10-06T00:00:00Z'::timestamptz,
--   '2025-10-12T00:00:00Z'::timestamptz,
--   NULL,
--   NULL,
--   NULL,
--   ARRAY['31']
-- );
