-- [DISTRICT-ADMIN-01] Référence administrative indépendante des objets et exports BAN.
BEGIN;
CREATE SCHEMA district_admin;
CREATE TABLE district_admin.context (
  district_id uuid PRIMARY KEY REFERENCES ban.district(id) ON DELETE RESTRICT,
  source_cog varchar(5) NOT NULL
    CHECK (source_cog ~ '^(?:[0-9]{5}|2[AB][0-9]{3})$'),
  reference jsonb NOT NULL CHECK (jsonb_typeof(reference) = 'object'),
  context jsonb NOT NULL CHECK (jsonb_typeof(context) = 'object'
    AND context->>'code' IS NOT NULL AND context->>'code' = source_cog),
  content_hash varchar(64) NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE district_admin.context IS
  'Contexte de référence géré par ban-district-admin ; jamais une correction du COG BAN.';
-- Le service ne reçoit aucun droit UPDATE sur les objets BAN. Cette fonction
-- ne fait que lire/verrouiller un district existant dans la transaction appelante.
CREATE FUNCTION district_admin.lock_district(district_uuid uuid)
RETURNS TABLE(cog text, active boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT d.meta->'insee'->>'cog', d."isActive"
  FROM ban.district AS d WHERE d.id = district_uuid FOR UPDATE OF d;
$function$;
REVOKE ALL ON FUNCTION district_admin.lock_district(uuid) FROM PUBLIC;
COMMIT;
