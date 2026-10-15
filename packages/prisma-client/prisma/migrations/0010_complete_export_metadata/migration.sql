-- Métadonnées des trois enveloppes restantes. Les fonctions optimisées par
-- 0007/0008/0009 et les filtres d'adresses de 0006 restent inchangés.
BEGIN;

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
$function$;

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
$function$;

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
$function$;

COMMIT;
