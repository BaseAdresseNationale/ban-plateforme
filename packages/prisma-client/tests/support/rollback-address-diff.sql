-- Explicit opt-in only, on a reviewed target database. Never applied automatically.
CREATE OR REPLACE FUNCTION ban.diff_address(t_from timestamp with time zone, t_to timestamp with time zone, ids uuid[] DEFAULT NULL::uuid[], common_toponym_ids uuid[] DEFAULT NULL::uuid[], district_ids uuid[] DEFAULT NULL::uuid[], departements text[] DEFAULT NULL::text[])
 RETURNS TABLE(event text, type text, nodekey text, datas jsonb[])
 LANGUAGE sql
 STABLE
AS $function$
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
$function$
;
