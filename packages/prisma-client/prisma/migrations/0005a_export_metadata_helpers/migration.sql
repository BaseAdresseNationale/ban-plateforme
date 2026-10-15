-- Dépendances de 0006 : les snapshots de 0004 sont déjà installés.
-- Compatible avec un registre existant : conserve signatures et contrats.
BEGIN;

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
$function$;

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
$function$;

CREATE OR REPLACE FUNCTION ban.snapshot_district_cog(as_of timestamp with time zone, district_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT sd.data->'meta'->'insee'->>'cog'
  FROM ban.snapshot_district(as_of, ARRAY[district_id], NULL) sd
  LIMIT 1;
$function$;

COMMIT;
