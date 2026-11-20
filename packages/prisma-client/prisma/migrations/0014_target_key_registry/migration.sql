-- [TARGET-KEY-01] Code allocations only. No BAN reference or business data import.
BEGIN;
CREATE SCHEMA target_key;

CREATE TABLE target_key.commune (
  cog text PRIMARY KEY CHECK (cog ~ '^([0-9]{5}|2[AB][0-9]{3})$'),
  initialized boolean NOT NULL DEFAULT false,
  source text,
  normalization_version integer NOT NULL DEFAULT 1 CHECK (normalization_version = 1),
  CHECK (NOT initialized OR (source IS NOT NULL AND length(source) > 0))
);

CREATE TABLE target_key.code (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cog text NOT NULL REFERENCES target_key.commune(cog),
  code text NOT NULL CHECK (code ~ '^[a-zA-Z0-9]{1,32}$'),
  origin text NOT NULL CHECK (origin IN ('preserved', 'generated')),
  UNIQUE (cog, id)
);
CREATE UNIQUE INDEX target_key_code_unique ON target_key.code(cog, lower(code));

CREATE TABLE target_key.alias (
  cog text NOT NULL,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 512),
  code_id bigint NOT NULL,
  PRIMARY KEY (cog, label, code_id),
  FOREIGN KEY (cog, code_id) REFERENCES target_key.code(cog, id)
);

CREATE TABLE target_key.binding (
  cog text NOT NULL,
  toponym_id uuid NOT NULL,
  code_id bigint NOT NULL,
  PRIMARY KEY (cog, toponym_id),
  FOREIGN KEY (cog, code_id) REFERENCES target_key.code(cog, id)
);

CREATE TABLE target_key.request (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128),
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  assignments jsonb CHECK (assignments IS NULL OR jsonb_typeof(assignments) = 'object')
);
COMMIT;
