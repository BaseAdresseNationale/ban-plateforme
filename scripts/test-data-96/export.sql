-- Lecture seule : aucun objet créé et aucune donnée modifiée dans la source.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL timezone = 'UTC';
SET LOCAL statement_timeout = '120s';
SET LOCAL "ban_fixture.source" = :'SOURCE_DATABASE';
DO $$
BEGIN
  IF current_database() <> current_setting('ban_fixture.source') THEN
    RAISE EXCEPTION 'Base source inattendue';
  END IF;
END $$;

WITH
d_ids AS MATERIALIZED (
  SELECT id FROM ban.district WHERE left(meta->'insee'->>'cog', 2) = '96'
  UNION
  SELECT id FROM ban.district_h WHERE left(meta->'insee'->>'cog', 2) = '96'
),
t_ids AS MATERIALIZED (
  SELECT id FROM ban.common_toponym WHERE "districtID" IN (SELECT id FROM d_ids)
  UNION
  SELECT id FROM ban.common_toponym_h WHERE "districtID" IN (SELECT id FROM d_ids)
),
a_ids AS MATERIALIZED (
  SELECT id FROM ban.address WHERE "districtID" IN (SELECT id FROM d_ids)
  UNION
  SELECT id FROM ban.address_h WHERE "districtID" IN (SELECT id FROM d_ids)
),
rows AS (
  SELECT 'district' AS name, to_jsonb(r) AS data FROM ban.district r WHERE id IN (SELECT id FROM d_ids)
  UNION ALL SELECT 'district_h', to_jsonb(r) FROM ban.district_h r WHERE id IN (SELECT id FROM d_ids)
  UNION ALL SELECT 'common_toponym', to_jsonb(r) FROM ban.common_toponym r WHERE id IN (SELECT id FROM t_ids)
  UNION ALL SELECT 'common_toponym_h', to_jsonb(r) FROM ban.common_toponym_h r WHERE id IN (SELECT id FROM t_ids)
  UNION ALL SELECT 'address', to_jsonb(r) FROM ban.address r WHERE id IN (SELECT id FROM a_ids)
  UNION ALL SELECT 'address_h', to_jsonb(r) FROM ban.address_h r WHERE id IN (SELECT id FROM a_ids)
),
tables AS (
  SELECT unnest(ARRAY['district', 'district_h', 'common_toponym', 'common_toponym_h', 'address', 'address_h']) AS name
),
columns AS (
  SELECT c.relname AS name,
    jsonb_agg(jsonb_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod)) ORDER BY a.attnum) AS definition
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'ban' AND c.relname IN (SELECT name FROM tables)
    AND a.attnum > 0 AND NOT a.attisdropped
    AND a.attgenerated = '' AND a.attidentity = ''
  GROUP BY c.relname
)
SELECT jsonb_build_object(
  'format', 'ban-fixture-96-v1',
  'source_database', current_database(),
  'exported_at', transaction_timestamp(),
  'department', '96',
  'schema', (SELECT jsonb_object_agg(name, definition) FROM columns),
  'tables', (SELECT jsonb_object_agg(t.name,
    COALESCE((SELECT jsonb_agg(data ORDER BY data->>'id', data->>'range_validity') FROM rows r WHERE r.name = t.name), '[]'::jsonb)) FROM tables t),
  'excluded_dependencies', jsonb_build_object(
    'actions', (SELECT count(*) FROM ban.action WHERE "districtID" IN (SELECT id FROM d_ids)),
    'certificates', (SELECT count(*) FROM ban.certificate WHERE address_id IN (SELECT id FROM a_ids))
  )
);
COMMIT;
