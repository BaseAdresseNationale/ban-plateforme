\set ON_ERROR_STOP on
\if :{?TARGET_DATABASE}
\else
  \set TARGET_DATABASE '__UNSET__'
\endif
\if :{?SHIFT_SECONDS}
\else
  \set SHIFT_SECONDS '0'
\endif
\if :{?ANCHOR_TIMESTAMP}
\else
  \set ANCHOR_TIMESTAMP ''
\endif
BEGIN;
SET LOCAL timezone = 'UTC';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL "ban_fixture.target" = :'TARGET_DATABASE';
SET LOCAL "ban_fixture.shift" = :'SHIFT_SECONDS';
SET LOCAL "ban_fixture.anchor" = :'ANCHOR_TIMESTAMP';
DO $$
BEGIN
  IF current_database() IN ('ban', 'postgres', 'template0', 'template1')
     OR current_database() <> current_setting('ban_fixture.target')
     OR current_setting('ban_fixture.target') = '__UNSET__' THEN
    RAISE EXCEPTION 'Base cible absente, protégée ou différente de la cible annoncée';
  END IF;
  IF current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'session_replication_role doit rester origin';
  END IF;
  IF current_setting('ban_fixture.shift') !~ '^-?[0-9]+([.][0-9]{1,6})?$' THEN
    RAISE EXCEPTION 'SHIFT_SECONDS doit être un nombre fini (6 décimales maximum)';
  END IF;
  IF current_setting('ban_fixture.anchor') <> '' AND current_setting('ban_fixture.shift')::numeric <> 0 THEN
    RAISE EXCEPTION 'Choisir SHIFT_SECONDS ou ANCHOR_TIMESTAMP, pas les deux';
  END IF;
END $$;
CREATE TEMP TABLE fixture_payload (payload jsonb NOT NULL) ON COMMIT DROP;
