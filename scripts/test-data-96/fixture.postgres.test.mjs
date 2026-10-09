import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { render, TABLES } from './fixture.mjs';
import { sql, jsonLines } from '../../packages/prisma-client/tests/postgres-test-helpers.mjs';
import { rows } from '../../packages/prisma-client/tests/support/synthetic-fixture.mjs';

const target = 'ban_fixture_validation_tmp';
const enabled = process.env.RUN_BAN_POSTGRES_TESTS === '1';
let payload;
if (enabled) {
  if (process.env.FIXTURE_JSON) payload = JSON.parse(fs.readFileSync(process.env.FIXTURE_JSON, 'utf8'));
  else {
    const [schema] = jsonLines(sql(target, `SELECT jsonb_object_agg(name, columns) FROM (
      SELECT c.relname AS name, jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod)) ORDER BY a.attnum) AS columns
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='ban' AND c.relname IN ('${TABLES.join("','")}') AND a.attnum>0 AND NOT a.attisdropped GROUP BY c.relname) s;`, { readonly: true }));
    payload = { format: 'ban-fixture-96-v1', department: '96', schema, tables: structuredClone(rows), excluded_dependencies: { actions: 0, certificates: 0 } };
    // Non-zero microseconds expose accidental millisecond rounding.
    for (const table of TABLES) for (const row of payload.tables[table]) {
      row.updateDate = row.updateDate.replace('00Z', '00.123456Z');
      row.range_validity = row.range_validity.replaceAll('00Z', '00.123456Z');
    }
  }
}
const variables = extra => ({ TARGET_DATABASE: target, ...extra });
const final = /SELECT key AS table_name,[\s\S]*?ORDER BY key;\s*COMMIT;\s*$/;
const state = () => jsonLines(sql(target, `SELECT json_build_object(
  'counts',json_build_array(${TABLES.map(t => `(SELECT count(*) FROM ban.${t})`).join(',')}),
  'triggers',(SELECT json_agg(tgenabled ORDER BY tgname,tgrelid) FROM pg_trigger WHERE tgname='test_historisation'),
  'invalid',(SELECT count(*) FROM pg_constraint WHERE connamespace='ban'::regnamespace AND NOT convalidated));`, { readonly: true }))[0];
const independentCheck = expectedDelta => `
DO $verify$
DECLARE tbl text; delta interval := ${expectedDelta}; bad boolean;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['${TABLES.join("','")}'] LOOP
    EXECUTE format('SELECT EXISTS ((SELECT to_jsonb(t) FROM ban.%I t EXCEPT ALL
      SELECT to_jsonb(o) || jsonb_build_object(''updateDate'',o."updateDate"+$2,''range_validity'',
        CASE WHEN isempty(o.range_validity) THEN o.range_validity ELSE tstzrange(lower(o.range_validity)+$2,upper(o.range_validity)+$2,
          (CASE WHEN lower_inc(o.range_validity) THEN ''['' ELSE ''('' END)||(CASE WHEN upper_inc(o.range_validity) THEN '']'' ELSE '')'' END)) END)
      FROM jsonb_populate_recordset(NULL::ban.%I,$1) o) UNION ALL
      (SELECT to_jsonb(o) || jsonb_build_object(''updateDate'',o."updateDate"+$2,''range_validity'',
        CASE WHEN isempty(o.range_validity) THEN o.range_validity ELSE tstzrange(lower(o.range_validity)+$2,upper(o.range_validity)+$2,
          (CASE WHEN lower_inc(o.range_validity) THEN ''['' ELSE ''('' END)||(CASE WHEN upper_inc(o.range_validity) THEN '']'' ELSE '')'' END)) END)
      FROM jsonb_populate_recordset(NULL::ban.%I,$1) o EXCEPT ALL SELECT to_jsonb(t) FROM ban.%I t))',tbl,tbl,tbl,tbl)
      INTO bad USING (SELECT payload->'tables'->tbl FROM fixture_payload),delta;
    IF bad THEN RAISE EXCEPTION 'Independent comparison failed: %',tbl; END IF;
  END LOOP;
END $verify$;
SELECT json_build_object('counts',json_build_array(${TABLES.map(t => `(SELECT count(*) FROM ban.${t})`).join(',')}));
ROLLBACK;`;
const latest = `(SELECT max(v) FROM (${TABLES.map(t => `SELECT v FROM fixture_payload p CROSS JOIN LATERAL jsonb_populate_recordset(NULL::ban.${t},p.payload->'tables'->'${t}') r CROSS JOIN LATERAL (VALUES (r."updateDate"),(lower(r.range_validity)),(upper(r.range_validity))) dates(v) WHERE isfinite(v)`).join(' UNION ALL ')}) dates)`;

for (const [name, settings, delta] of [
  ['original dates', {}, "interval '0 seconds'"],
  ['positive shift with microseconds', { SHIFT_SECONDS: '86400.000001' }, "interval '86400.000001 seconds'"],
  ['negative shift', { SHIFT_SECONDS: '-3600.000001' }, "interval '-3600.000001 seconds'"],
  ['anchor', { ANCHOR_TIMESTAMP: '2027-01-15T12:00:00.123456Z' }, `'2027-01-15T12:00:00.123456Z'::timestamptz - ${latest}`],
]) test(name, { skip: !enabled }, () => {
  const before = state();
  assert.deepEqual(before.counts, TABLES.map(() => 0), 'Use a new, empty isolated fixture test database');
  const result = sql(target, render(payload).replace(final, independentCheck(delta)), { variables: variables(settings) });
  assert.deepEqual(jsonLines(result)[0].counts, TABLES.map(t => payload.tables[t].length));
  assert.deepEqual(state(), before, 'Successful import checks are rolled back to preserve an empty test database');
});

test('failure after disabling all three triggers rolls back data and trigger state', { skip: !enabled }, () => {
  const before = state();
  const query = render(payload).replace('-- Les clés étrangères, CHECK et exclusions GiST ne sont jamais désactivées.', "RAISE EXCEPTION 'Injected failure after trigger disable';");
  const result = sql(target, query, { variables: variables({}), failure: true });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Injected failure after trigger disable/);
  assert.equal((result.stderr.match(/DISABLE TRIGGER/g) ?? []).length, 3);
  assert.deepEqual(state(), before);
});

test('duplicate department refuses import and rolls back', { skip: !enabled }, () => {
  const before = state();
  const query = render(payload).replace('-- Verrous courts', 'INSERT INTO ban.district SELECT * FROM fixture_stage_district;\n-- Verrous courts');
  const result = sql(target, query, { variables: variables({}), failure: true });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Département 96 déjà présent/); assert.deepEqual(state(), before);
});

test('mutually exclusive date modes fail without changes', { skip: !enabled }, () => {
  const before = state();
  const result = sql(target, render(payload), { variables: variables({ SHIFT_SECONDS: '1', ANCHOR_TIMESTAMP: '2027-01-01Z' }), failure: true });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /pas les deux/); assert.deepEqual(state(), before);
});
