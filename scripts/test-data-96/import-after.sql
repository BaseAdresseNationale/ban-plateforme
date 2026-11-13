
-- Staging temporaire : types PostgreSQL contrôlés avant les écritures métier.
DO $$
DECLARE
  p jsonb := (SELECT payload FROM fixture_payload);
  tbl text;
  actual_columns jsonb;
  bad boolean;
BEGIN
  IF p->>'format' <> 'ban-fixture-96-v1' OR p->>'department' <> '96'
     OR p->'format' IS NULL OR p->'department' IS NULL THEN
    RAISE EXCEPTION 'Format de jeu refusé';
  END IF;
  IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p->'tables') k)
      IS DISTINCT FROM ARRAY['address','address_h','common_toponym','common_toponym_h','district','district_h']::text[] THEN
    RAISE EXCEPTION 'Périmètre des tables invalide';
  END IF;
  IF p->'excluded_dependencies' IS DISTINCT FROM '{"actions":0,"certificates":0}'::jsonb THEN
    RAISE EXCEPTION 'Dépendances exclues non examinées';
  END IF;
  FOREACH tbl IN ARRAY ARRAY['district','district_h','common_toponym','common_toponym_h','address','address_h'] LOOP
    SELECT jsonb_agg(jsonb_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod)) ORDER BY a.attnum)
      INTO actual_columns
      FROM pg_attribute a
      WHERE a.attrelid = to_regclass(format('ban.%I', tbl)) AND a.attnum > 0 AND NOT a.attisdropped;
    IF actual_columns IS NULL OR actual_columns IS DISTINCT FROM p->'schema'->tbl THEN
      RAISE EXCEPTION 'Structure incompatible : ban.%', tbl;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass(format('ban.%I',tbl))
        AND attnum > 0 AND NOT attisdropped AND (attgenerated <> '' OR attidentity <> '')) THEN
      RAISE EXCEPTION 'Colonnes générées/identités non prises en charge : %', tbl;
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p->'tables'->tbl) r
      WHERE (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(r) k)
        IS DISTINCT FROM (SELECT array_agg(c->>'name' ORDER BY c->>'name') FROM jsonb_array_elements(actual_columns) c)
    ) INTO bad;
    IF bad THEN RAISE EXCEPTION 'Clés JSON incompatibles : %', tbl; END IF;
    EXECUTE format('CREATE TEMP TABLE fixture_stage_%I (LIKE ban.%I) ON COMMIT DROP', tbl, tbl);
    EXECUTE format('INSERT INTO fixture_stage_%I SELECT * FROM jsonb_populate_recordset(NULL::ban.%I, $1)', tbl, tbl)
      USING p->'tables'->tbl;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM fixture_stage_district) THEN RAISE EXCEPTION 'Jeu vide'; END IF;
  IF EXISTS (SELECT 1 FROM (
      SELECT meta FROM fixture_stage_district UNION ALL SELECT meta FROM fixture_stage_district_h
    ) d WHERE left(meta->'insee'->>'cog',2) IS DISTINCT FROM '96'
      OR (meta->'insee'->>'mainId' IS NOT NULL AND NOT EXISTS
        (SELECT 1 FROM fixture_stage_district x WHERE x.id::text = d.meta->'insee'->>'mainId'))) THEN
    RAISE EXCEPTION 'Commune ou référence mainId hors périmètre';
  END IF;
  IF EXISTS (SELECT 1 FROM (
      SELECT "districtID" FROM fixture_stage_common_toponym UNION ALL SELECT "districtID" FROM fixture_stage_common_toponym_h
      UNION ALL SELECT "districtID" FROM fixture_stage_address UNION ALL SELECT "districtID" FROM fixture_stage_address_h
    ) r WHERE NOT EXISTS (SELECT 1 FROM fixture_stage_district d WHERE d.id = r."districtID")) THEN
    RAISE EXCEPTION 'Référence de commune extérieure au jeu';
  END IF;
  IF EXISTS (SELECT 1 FROM (
      SELECT "mainCommonToponymID" AS id FROM fixture_stage_address
      UNION ALL SELECT "mainCommonToponymID" FROM fixture_stage_address_h
      UNION ALL SELECT unnest("secondaryCommonToponymIDs") FROM fixture_stage_address
      UNION ALL SELECT unnest("secondaryCommonToponymIDs") FROM fixture_stage_address_h
    ) r WHERE r.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM fixture_stage_common_toponym t WHERE t.id = r.id)) THEN
    RAISE EXCEPTION 'Référence de toponyme extérieure au jeu';
  END IF;
END $$;

CREATE TEMP TABLE fixture_offset (delta interval NOT NULL) ON COMMIT DROP;
DO $$
DECLARE
  tbl text;
  latest timestamptz;
  table_latest timestamptz;
  anchor text := current_setting('ban_fixture.anchor');
  offset_value interval;
BEGIN
  IF anchor = '' THEN
    offset_value := current_setting('ban_fixture.shift')::numeric * interval '1 second';
  ELSE
    IF NOT isfinite(anchor::timestamptz) THEN RAISE EXCEPTION 'Ancre temporelle infinie refusée'; END IF;
    FOREACH tbl IN ARRAY ARRAY['district','district_h','common_toponym','common_toponym_h','address','address_h'] LOOP
      EXECUTE format('SELECT max(v) FROM fixture_stage_%I s CROSS JOIN LATERAL
        (VALUES (s."updateDate"), (lower(s.range_validity)), (upper(s.range_validity))) t(v)
        WHERE isfinite(v)', tbl) INTO table_latest;
      latest := greatest(latest, table_latest);
    END LOOP;
    IF latest IS NULL THEN RAISE EXCEPTION 'Aucune date finie pour calculer le décalage'; END IF;
    offset_value := anchor::timestamptz - latest;
  END IF;
  INSERT INTO fixture_offset VALUES (offset_value);
  FOREACH tbl IN ARRAY ARRAY['district','district_h','common_toponym','common_toponym_h','address','address_h'] LOOP
    EXECUTE format('UPDATE fixture_stage_%I SET "updateDate" = "updateDate" + $1,
      range_validity = CASE WHEN isempty(range_validity) THEN range_validity ELSE
        tstzrange(lower(range_validity) + $1, upper(range_validity) + $1,
          (CASE WHEN lower_inc(range_validity) THEN ''['' ELSE ''('' END) ||
          (CASE WHEN upper_inc(range_validity) THEN '']'' ELSE '')'' END)) END', tbl)
      USING offset_value;
  END LOOP;
  RAISE NOTICE 'Décalage uniforme appliqué aux dates typées et périodes : %', offset_value;
END $$;

-- Verrous courts : empêchent les écritures concurrentes, pas les SELECT simples.
LOCK TABLE ban.district, ban.district_h, ban.common_toponym, ban.common_toponym_h,
  ban.address, ban.address_h IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE fixture_triggers ON COMMIT DROP AS
SELECT c.relname AS table_name, t.tgname AS trigger_name, t.tgenabled AS original_state,
       p.proname, n.nspname AS function_schema
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE t.tgrelid IN ('ban.district'::regclass,'ban.district_h'::regclass,
  'ban.common_toponym'::regclass,'ban.common_toponym_h'::regclass,'ban.address'::regclass,'ban.address_h'::regclass)
  AND NOT t.tgisinternal;

DO $$
DECLARE
  tbl text;
  conflict boolean;
  tr record;
BEGIN
  IF (SELECT count(*) FROM fixture_triggers) <> 3
     OR EXISTS (SELECT 1 FROM fixture_triggers WHERE proname <> 'historisation' OR function_schema <> 'public'
        OR table_name NOT IN ('district','common_toponym','address'))
     OR (SELECT count(DISTINCT table_name) FROM fixture_triggers) <> 3 THEN
    RAISE EXCEPTION 'Triggers inattendus : relecture nécessaire avant import';
  END IF;
  IF EXISTS (SELECT 1 FROM ban.district WHERE left(meta->'insee'->>'cog',2) = '96')
     OR EXISTS (SELECT 1 FROM ban.district_h WHERE left(meta->'insee'->>'cog',2) = '96') THEN
    RAISE EXCEPTION 'Département 96 déjà présent : aucun remplacement automatique';
  END IF;
  FOREACH tbl IN ARRAY ARRAY['district','district_h','common_toponym','common_toponym_h','address','address_h'] LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM ban.%I t JOIN fixture_stage_%I s USING(id))', tbl, tbl) INTO conflict;
    IF conflict THEN RAISE EXCEPTION 'UUID déjà présent dans ban.% : import annulé', tbl; END IF;
  END LOOP;
  FOR tr IN SELECT * FROM fixture_triggers LOOP
    RAISE NOTICE 'Cible % : %', current_database(),
      format('ALTER TABLE ban.%I DISABLE TRIGGER %I', tr.table_name, tr.trigger_name);
    EXECUTE format('ALTER TABLE ban.%I DISABLE TRIGGER %I', tr.table_name, tr.trigger_name);
  END LOOP;
  -- Les clés étrangères, CHECK et exclusions GiST ne sont jamais désactivées.
  FOREACH tbl IN ARRAY ARRAY['district','common_toponym','address','district_h','common_toponym_h','address_h'] LOOP
    EXECUTE format('INSERT INTO ban.%I SELECT * FROM fixture_stage_%I', tbl, tbl);
  END LOOP;
  FOR tr IN SELECT * FROM fixture_triggers LOOP
    EXECUTE format('ALTER TABLE ban.%I %s TRIGGER %I', tr.table_name,
      CASE tr.original_state WHEN 'O' THEN 'ENABLE' WHEN 'R' THEN 'ENABLE REPLICA'
        WHEN 'A' THEN 'ENABLE ALWAYS' WHEN 'D' THEN 'DISABLE' END, tr.trigger_name);
  END LOOP;
END $$;

-- Toute différence avant COMMIT provoque l'annulation de la transaction.
DO $$
DECLARE tbl text; different boolean;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['district','district_h','common_toponym','common_toponym_h','address','address_h'] LOOP
    EXECUTE format('SELECT EXISTS (
      (SELECT to_jsonb(s) FROM fixture_stage_%I s EXCEPT ALL
       SELECT to_jsonb(t) FROM ban.%I t WHERE id IN (SELECT id FROM fixture_stage_%I))
      UNION ALL
      (SELECT to_jsonb(t) FROM ban.%I t WHERE id IN (SELECT id FROM fixture_stage_%I) EXCEPT ALL
       SELECT to_jsonb(s) FROM fixture_stage_%I s))', tbl,tbl,tbl,tbl,tbl,tbl) INTO different;
    IF different THEN RAISE EXCEPTION 'Données importées différentes : %', tbl; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM fixture_triggers s JOIN pg_trigger t
      ON t.tgrelid = to_regclass(format('ban.%I',s.table_name)) AND t.tgname = s.trigger_name
      WHERE t.tgenabled <> s.original_state) THEN
    RAISE EXCEPTION 'État des triggers non rétabli';
  END IF;
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT key AS table_name, jsonb_array_length(value) AS imported_rows
FROM fixture_payload CROSS JOIN LATERAL jsonb_each(payload->'tables') ORDER BY key;
COMMIT;
