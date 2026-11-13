-- Résoudre les COG aux deux bornes une fois par requête départementale.
-- Les sélections par UUID gardent la résolution ciblée.
BEGIN;

CREATE OR REPLACE FUNCTION ban.diff_common_toponym_ndjson(
  t_from timestamptz, t_to timestamptz, ids uuid[] DEFAULT NULL,
  district_ids uuid[] DEFAULT NULL, departements text[] DEFAULT NULL
)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH cogs_before AS MATERIALIZED (
    SELECT jsonb_object_agg(d.data->>'id', d.data->'meta'->'insee'->>'cog') AS codes
    FROM ban.snapshot_district(t_from, NULL, NULL) d
    WHERE ids IS NULL
  ), cogs_after AS MATERIALIZED (
    SELECT jsonb_object_agg(d.data->>'id', d.data->'meta'->'insee'->>'cog') AS codes
    FROM ban.snapshot_district(t_to, NULL, NULL) d
    WHERE ids IS NULL
  )
  SELECT (row_to_json(e)::jsonb || jsonb_build_object(
    'meta', ban.merge_export_line_meta(e.datas[1], e.datas[2],
      CASE WHEN ids IS NOT NULL THEN ban.snapshot_district_cog(
        CASE WHEN e.event = 'disabled' THEN t_from ELSE t_to END,
        (COALESCE(e.datas[1]->>'districtID', e.datas[2]->>'districtID'))::uuid
      ) ELSE (CASE WHEN e.event = 'disabled' THEN b.codes ELSE a.codes END)
        ->> COALESCE(e.datas[1]->>'districtID', e.datas[2]->>'districtID') END
    )
  ))::text
  FROM ban.diff_common_toponym(t_from, t_to, ids, district_ids, departements) e
  CROSS JOIN cogs_before b CROSS JOIN cogs_after a;
$$;

CREATE OR REPLACE FUNCTION ban.diff_address_ndjson(
  t_from timestamptz, t_to timestamptz, ids uuid[] DEFAULT NULL,
  common_toponym_ids uuid[] DEFAULT NULL, district_ids uuid[] DEFAULT NULL,
  departements text[] DEFAULT NULL
)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH cogs_before AS MATERIALIZED (
    SELECT jsonb_object_agg(d.data->>'id', d.data->'meta'->'insee'->>'cog') AS codes
    FROM ban.snapshot_district(t_from, NULL, NULL) d
    WHERE ids IS NULL
  ), cogs_after AS MATERIALIZED (
    SELECT jsonb_object_agg(d.data->>'id', d.data->'meta'->'insee'->>'cog') AS codes
    FROM ban.snapshot_district(t_to, NULL, NULL) d
    WHERE ids IS NULL
  )
  SELECT (row_to_json(e)::jsonb || jsonb_build_object(
    'meta', ban.merge_export_line_meta(e.datas[1], e.datas[2],
      CASE WHEN ids IS NOT NULL THEN ban.snapshot_district_cog(
        CASE WHEN e.event = 'disabled' THEN t_from ELSE t_to END,
        (COALESCE(e.datas[1]->>'districtID', e.datas[2]->>'districtID'))::uuid
      ) ELSE (CASE WHEN e.event = 'disabled' THEN b.codes ELSE a.codes END)
        ->> COALESCE(e.datas[1]->>'districtID', e.datas[2]->>'districtID') END
    )
  ))::text
  FROM ban.diff_address(t_from, t_to, ids, common_toponym_ids, district_ids, departements) e
  CROSS JOIN cogs_before b CROSS JOIN cogs_after a;
$$;

COMMIT;
