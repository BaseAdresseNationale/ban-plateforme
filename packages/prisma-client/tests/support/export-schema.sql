-- Minimal export test structure; no production data. Run only on a new authorized test DB.
DO $$ BEGIN IF current_database() NOT IN ('ban_export_validation_tmp','ban_fixture_validation_tmp') THEN RAISE EXCEPTION 'Protected test target'; END IF; END $$;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA ban;
CREATE TABLE ban.district (
  "id" uuid NOT NULL,
  "labels" jsonb[],
  "updateDate" timestamp with time zone,
  "config" jsonb,
  "meta" jsonb,
  "range_validity" tstzrange NOT NULL,
  "isActive" boolean,
  PRIMARY KEY(id)
);
CREATE TABLE ban.common_toponym (
  "id" uuid NOT NULL,
  "districtID" uuid,
  "labels" jsonb[],
  "geometry" jsonb,
  "updateDate" timestamp with time zone,
  "meta" jsonb,
  "range_validity" tstzrange NOT NULL,
  "isActive" boolean,
  PRIMARY KEY(id)
);
CREATE TABLE ban.address (
  "id" uuid NOT NULL,
  "mainCommonToponymID" uuid,
  "secondaryCommonToponymIDs" uuid[],
  "districtID" uuid,
  "number" integer,
  "suffix" character varying(255),
  "labels" jsonb[],
  "certified" boolean,
  "positions" jsonb[],
  "updateDate" timestamp with time zone,
  "meta" jsonb,
  "range_validity" tstzrange NOT NULL,
  "isActive" boolean,
  PRIMARY KEY(id)
);
CREATE TABLE ban.district_h (
  "id" uuid NOT NULL,
  "labels" jsonb[],
  "updateDate" timestamp with time zone,
  "config" jsonb,
  "meta" jsonb,
  "range_validity" tstzrange NOT NULL,
  "isActive" boolean,
  EXCLUDE USING gist (id WITH =, range_validity WITH &&)
);
CREATE TABLE ban.common_toponym_h (
  "id" uuid NOT NULL,
  "districtID" uuid,
  "labels" jsonb[],
  "geometry" jsonb,
  "updateDate" timestamp with time zone,
  "meta" jsonb,
  "range_validity" tstzrange NOT NULL,
  "isActive" boolean,
  EXCLUDE USING gist (id WITH =, range_validity WITH &&)
);
CREATE TABLE ban.address_h (
  "id" uuid NOT NULL,
  "mainCommonToponymID" uuid,
  "secondaryCommonToponymIDs" uuid[],
  "districtID" uuid,
  "number" integer,
  "suffix" character varying(255),
  "labels" jsonb[],
  "certified" boolean,
  "positions" jsonb[],
  "updateDate" timestamp with time zone,
  "meta" jsonb,
  "range_validity" tstzrange NOT NULL,
  "isActive" boolean,
  EXCLUDE USING gist (id WITH =, range_validity WITH &&)
);
ALTER TABLE ban.district_h ADD FOREIGN KEY(id) REFERENCES ban.district(id);
ALTER TABLE ban.common_toponym_h ADD FOREIGN KEY(id) REFERENCES ban.common_toponym(id);
ALTER TABLE ban.address_h ADD FOREIGN KEY(id) REFERENCES ban.address(id);
ALTER TABLE ban.common_toponym ADD FOREIGN KEY ("districtID") REFERENCES ban.district(id);
ALTER TABLE ban.address ADD FOREIGN KEY ("districtID") REFERENCES ban.district(id);
ALTER TABLE ban.address ADD FOREIGN KEY ("mainCommonToponymID") REFERENCES ban.common_toponym(id);
CREATE OR REPLACE FUNCTION public.historisation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
        
            BEGIN
                IF (TG_OP = 'INSERT') THEN
                    NEW.range_validity =  tstzrange(current_timestamp::timestamp,NULL);
                    RETURN NEW;
                ELSEIF (TG_OP = 'UPDATE') THEN
                    --s'il n'y a pas de changement, pas d'update et pas d'action dans l'historique, on interrompt l'action du trigger--
                    IF NEW IS NOT DISTINCT FROM OLD THEN
                        RAISE NOTICE  'table %s: id=%  objet sans modification, aucune opération réalisée!', TG_TABLE_NAME,OLD.ID; 
                        RETURN NULL;
                    END IF;
                    -- le changement d'id ne doit pas arriver, au cas où, on renvoie une exception
                    IF NEW.ID IS DISTINCT FROM OLD.ID  THEN
                        RAISE EXCEPTION 'table %s: update sur le champ id de l''objet %s non valide',TG_TABLE_NAME, OLD.ID USING ERRCODE = '09000';
                    END IF;
                    -- le changement du champ range_validity n'est pas autorisé à ce niveau et ne doit être réalisé que par le trigger, on renvoie une exception
                    IF NEW.range_validity IS DISTINCT FROM OLD.range_validity OR upper(NEW.range_validity) IS NOT NULL  THEN
                        RAISE EXCEPTION 'table %s: opération update sur le champ range_validity (valeur upper=%) de l''objet %s non autorisé',TG_TABLE_NAME,NEW.range_validity, OLD.ID USING ERRCODE = '09000';
                    END IF;
                    OLD.range_validity = tstzrange(lower(OLD.range_validity),current_timestamp);
                    NEW.range_validity = tstzrange(current_timestamp,NULL);
              
                    EXECUTE format('INSERT INTO '|| TG_TABLE_SCHEMA  ||'.' || TG_TABLE_NAME || '_h VALUES ($1.*)') USING OLD;
                    RETURN NEW;
                ELSE
                    RETURN NEW;
                END IF;
            END
        $function$
;
CREATE TRIGGER test_historisation BEFORE INSERT OR UPDATE ON ban.district FOR EACH ROW EXECUTE FUNCTION public.historisation();
CREATE TRIGGER test_historisation BEFORE INSERT OR UPDATE ON ban.common_toponym FOR EACH ROW EXECUTE FUNCTION public.historisation();
CREATE TRIGGER test_historisation BEFORE INSERT OR UPDATE ON ban.address FOR EACH ROW EXECUTE FUNCTION public.historisation();
CREATE OR REPLACE FUNCTION ban.dept_code_from_cog(cog text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN left(cog, 2) IN ('97','98') THEN left(cog, 3)
    ELSE left(cog, 2)
  END
$function$
;
CREATE OR REPLACE FUNCTION ban.export_line_meta(data jsonb, district_cog text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'ban', NULLIF(
      jsonb_strip_nulls(jsonb_build_object(
        'targetKeys', data->'meta'->'ban'->'targetKeys',
        'DEPRECATED_cleInteropBAN', COALESCE(
          data->'meta'->'ban'->'DEPRECATED_cleInteropBAN',
          data->'meta'->'ban'->'cleInteropBAN'
        )
      )),
      '{}'::jsonb
    ),
    'insee', NULLIF(
      jsonb_strip_nulls(jsonb_build_object(
        'cog', COALESCE(district_cog, data->'meta'->'insee'->>'cog')
      )),
      '{}'::jsonb
    )
  ));
$function$
;
CREATE OR REPLACE FUNCTION ban.merge_export_line_meta(first_data jsonb, second_data jsonb, district_cog text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'ban', NULLIF(
      jsonb_strip_nulls(jsonb_build_object(
        'targetKeys', COALESCE(
          first_data->'meta'->'ban'->'targetKeys',
          second_data->'meta'->'ban'->'targetKeys'
        ),
        'DEPRECATED_cleInteropBAN', COALESCE(
          first_data->'meta'->'ban'->'DEPRECATED_cleInteropBAN',
          first_data->'meta'->'ban'->'cleInteropBAN',
          second_data->'meta'->'ban'->'DEPRECATED_cleInteropBAN',
          second_data->'meta'->'ban'->'cleInteropBAN'
        )
      )),
      '{}'::jsonb
    ),
    'insee', NULLIF(
      jsonb_strip_nulls(jsonb_build_object(
        'cog', COALESCE(
          district_cog,
          first_data->'meta'->'insee'->>'cog',
          second_data->'meta'->'insee'->>'cog'
        )
      )),
      '{}'::jsonb
    )
  ));
$function$
;
CREATE OR REPLACE FUNCTION ban._snapshot_district_ids(as_of timestamp with time zone, departements text[])
 RETURNS TABLE(id uuid)
 LANGUAGE sql
 STABLE
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION ban.snapshot_district(as_of timestamp with time zone DEFAULT now(), ids uuid[] DEFAULT NULL::uuid[], departements text[] DEFAULT NULL::text[])
 RETURNS TABLE(type text, nodekey text, data jsonb)
 LANGUAGE sql
 STABLE
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION ban.snapshot_district_cog(as_of timestamp with time zone, district_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT sd.data->'meta'->'insee'->>'cog'
  FROM ban.snapshot_district(as_of, ARRAY[district_id], NULL) sd
  LIMIT 1;
$function$
;
CREATE OR REPLACE FUNCTION ban.snapshot_common_toponym(as_of timestamp with time zone DEFAULT now(), ids uuid[] DEFAULT NULL::uuid[], district_ids uuid[] DEFAULT NULL::uuid[], departements text[] DEFAULT NULL::text[])
 RETURNS TABLE(type text, nodekey text, data jsonb)
 LANGUAGE sql
 STABLE
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION ban.snapshot_address(as_of timestamp with time zone DEFAULT now(), ids uuid[] DEFAULT NULL::uuid[], common_toponym_ids uuid[] DEFAULT NULL::uuid[], district_ids uuid[] DEFAULT NULL::uuid[], departements text[] DEFAULT NULL::text[])
 RETURNS TABLE(type text, nodekey text, data jsonb)
 LANGUAGE sql
 STABLE
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION ban.diff_district(t_from timestamp with time zone, t_to timestamp with time zone, ids uuid[] DEFAULT NULL::uuid[], departements text[] DEFAULT NULL::text[])
 RETURNS TABLE(event text, type text, nodekey text, datas jsonb[])
 LANGUAGE sql
 STABLE
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION ban.diff_common_toponym(t_from timestamp with time zone, t_to timestamp with time zone, ids uuid[] DEFAULT NULL::uuid[], district_ids uuid[] DEFAULT NULL::uuid[], departements text[] DEFAULT NULL::text[])
 RETURNS TABLE(event text, type text, nodekey text, datas jsonb[])
 LANGUAGE sql
AS $function$
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
$function$
;
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
CREATE OR REPLACE FUNCTION ban.snapshot_district_ndjson(as_of timestamp with time zone DEFAULT now(), ids uuid[] DEFAULT NULL::uuid[], departements text[] DEFAULT NULL::text[])
 RETURNS SETOF text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT jsonb_build_object(
    'type', t.type,
    'nodeKey', t.nodeKey,
    'data', t.data,
    'meta', ban.export_line_meta(t.data)
  )::text
  FROM ban.snapshot_district(as_of, ids, departements) t;
$function$
;
CREATE OR REPLACE FUNCTION ban.snapshot_common_toponym_ndjson(as_of timestamp with time zone DEFAULT now(), ids uuid[] DEFAULT NULL::uuid[], district_ids uuid[] DEFAULT NULL::uuid[], departements text[] DEFAULT NULL::text[])
 RETURNS SETOF text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT jsonb_build_object(
    'type', t.type,
    'nodeKey', t.nodeKey,
    'data', t.data,
    'meta', ban.export_line_meta(
      t.data,
      ban.snapshot_district_cog(as_of, (t.data->>'districtID')::uuid)
    )
  )::text
  FROM ban.snapshot_common_toponym(as_of, ids, district_ids, departements) t;
$function$
;
CREATE OR REPLACE FUNCTION ban.snapshot_address_ndjson(as_of timestamp with time zone DEFAULT now(), ids uuid[] DEFAULT NULL::uuid[], common_toponym_ids uuid[] DEFAULT NULL::uuid[], district_ids uuid[] DEFAULT NULL::uuid[], departements text[] DEFAULT NULL::text[])
 RETURNS SETOF text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT jsonb_build_object(
    'type', t.type, 'nodeKey', t.nodeKey, 'data', t.data,
    'meta', ban.export_line_meta(t.data, ban.snapshot_district_cog(as_of, (t.data->>'districtID')::uuid))
  )::text
  FROM ban.snapshot_address(as_of, ids, common_toponym_ids, district_ids, departements) t;
$function$
;
CREATE OR REPLACE FUNCTION ban.diff_district_ndjson(t_from timestamp with time zone, t_to timestamp with time zone, ids uuid[] DEFAULT NULL::uuid[], departements text[] DEFAULT NULL::text[])
 RETURNS SETOF text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT (
    row_to_json(d)::jsonb
    || jsonb_build_object('meta', ban.merge_export_line_meta(d.datas[1], d.datas[2]))
  )::text
  FROM ban.diff_district(t_from, t_to, ids, departements) d;
$function$
;
CREATE OR REPLACE FUNCTION ban.diff_common_toponym_ndjson(t_from timestamp with time zone, t_to timestamp with time zone, ids uuid[] DEFAULT NULL::uuid[], district_ids uuid[] DEFAULT NULL::uuid[], departements text[] DEFAULT NULL::text[])
 RETURNS SETOF text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT (
    row_to_json(ct)::jsonb
    || jsonb_build_object(
      'meta',
      ban.merge_export_line_meta(
        ct.datas[1],
        ct.datas[2],
        ban.snapshot_district_cog(
          CASE WHEN ct.event = 'disabled' THEN t_from ELSE t_to END,
          (COALESCE(ct.datas[1]->>'districtID', ct.datas[2]->>'districtID'))::uuid
        )
      )
    )
  )::text
  FROM ban.diff_common_toponym(t_from, t_to, ids, district_ids, departements) ct;
$function$
;
CREATE OR REPLACE FUNCTION ban.diff_address_ndjson(t_from timestamp with time zone, t_to timestamp with time zone, ids uuid[] DEFAULT NULL::uuid[], common_toponym_ids uuid[] DEFAULT NULL::uuid[], district_ids uuid[] DEFAULT NULL::uuid[], departements text[] DEFAULT NULL::text[])
 RETURNS SETOF text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT (row_to_json(a)::jsonb || jsonb_build_object(
    'meta', ban.merge_export_line_meta(
      a.datas[1], a.datas[2],
      ban.snapshot_district_cog(CASE WHEN a.event = 'disabled' THEN t_from ELSE t_to END,
        (COALESCE(a.datas[1]->>'districtID', a.datas[2]->>'districtID'))::uuid)
    )
  ))::text
  FROM ban.diff_address(t_from, t_to, ids, common_toponym_ids, district_ids, departements) a;
$function$
;
CREATE INDEX address_lower_range_idx ON ban.address USING btree (lower(range_validity));
CREATE INDEX common_toponym_lower_range_idx ON ban.common_toponym USING btree (lower(range_validity));
CREATE INDEX district_lower_range_idx ON ban.district USING btree (lower(range_validity));
CREATE INDEX address_district_lower_range_idx ON ban.address USING btree ("districtID", lower(range_validity));
CREATE INDEX common_toponym_district_lower_range_idx ON ban.common_toponym USING btree ("districtID", lower(range_validity));
CREATE INDEX address_h_district_id_idx ON ban.address_h USING btree ("districtID");
CREATE INDEX address_h_main_common_toponym_id_idx ON ban.address_h USING btree ("mainCommonToponymID");
CREATE INDEX common_toponym_h_district_id_idx ON ban.common_toponym_h USING btree ("districtID");
CREATE INDEX address_h_district_range_gist ON ban.address_h USING gist ("districtID", range_validity);
CREATE INDEX address_h_mainct_range_gist ON ban.address_h USING gist ("mainCommonToponymID", range_validity);
CREATE INDEX common_toponym_h_district_range_gist ON ban.common_toponym_h USING gist ("districtID", range_validity);
CREATE INDEX address_secondary_common_toponym_ids_gin ON ban.address USING gin ("secondaryCommonToponymIDs");
CREATE INDEX address_h_secondary_common_toponym_ids_gin ON ban.address_h USING gin ("secondaryCommonToponymIDs");
CREATE INDEX district_cog_idx ON ban.district USING btree ((((meta -> 'insee'::text) ->> 'cog'::text)));
CREATE INDEX district_dept_code_idx ON ban.district USING btree ((
CASE
    WHEN ("left"(((meta -> 'insee'::text) ->> 'cog'::text), 2) = ANY (ARRAY['97'::text, '98'::text])) THEN "left"(((meta -> 'insee'::text) ->> 'cog'::text), 3)
    ELSE "left"(((meta -> 'insee'::text) ->> 'cog'::text), 2)
END));
