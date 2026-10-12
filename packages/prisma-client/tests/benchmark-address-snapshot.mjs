// Read-only experiment: execute the proposed SELECT, never CREATE FUNCTION.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const [fixturePath, output] = process.argv.slice(2);
if (process.env.RUN_BAN_POSTGRES_TESTS !== '1' || !fixturePath || !output || fs.existsSync(output)) {
  throw new Error('Opt-in, department 96 fixture JSON and new result file required');
}
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
assert.equal(fixture.department, '96');
const target = 'ban_restore_validation';
const signature = 'ban.snapshot_address(timestamptz,uuid[],uuid[],uuid[],text[])';
const migration = fs.readFileSync(new URL('../prisma/migrations/0008_optimize_address_snapshot_filters/migration.sql', import.meta.url), 'utf8');
const reference = fs.readFileSync(new URL('./support/rollback-address-snapshot.sql', import.meta.url), 'utf8');
const body = value => value.match(/AS\s+\$\$([\s\S]*?)\$\$/)[1];
const normalize = value => value.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const uuidArray = values => values === null ? 'NULL::uuid[]' : `ARRAY[${values.map(literal).join(',')}]::uuid[]`;
function read(query) {
  const result = spawnSync('docker', ['exec', '-i', 'ban_postgres', 'psql', '--username=ban_user',
    `--dbname=${target}`, '--no-psqlrc', '--set=ON_ERROR_STOP=1', '--quiet', '--tuples-only', '--no-align', '--file=-'], {
    input: `BEGIN READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL statement_timeout='30s';
    DO $$ BEGIN IF current_database()<>'${target}' THEN RAISE EXCEPTION 'Wrong candidate'; END IF; END $$;
    ${query}\n;\nROLLBACK;`, encoding: 'utf8', timeout: 45000, maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Candidate query failed');
  return JSON.parse(result.stdout.trim());
}
const inspect = `SELECT json_build_object('db',current_database(),'role',current_user,
  'definition',pg_get_functiondef('${signature}'::regprocedure),
  'source',(SELECT prosrc FROM pg_proc WHERE oid='${signature}'::regprocedure),
  'functions',(SELECT json_agg(json_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'owner',p.proowner,'acl',p.proacl) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='ban'::regnamespace),
  'migrations',(SELECT json_agg(json_build_object('name',migration_name,'checksum',checksum,'finished',finished_at IS NOT NULL,'rolled_back',rolled_back_at IS NOT NULL) ORDER BY migration_name) FROM ban._prisma_migrations));`;
const before = read(inspect);
assert.equal(before.db, target); assert.equal(before.role, 'ban_user');
assert.equal(before.functions.length, 17); assert.equal(before.migrations.length, 8);
assert.ok(before.migrations.every(m => m.finished && !m.rolled_back));
assert.ok(!before.migrations.some(m => m.name.startsWith('0008')));
assert.equal(normalize(before.source), normalize(body(reference)), 'Candidate baseline differs: review before benchmarking');
const ids = fixture.tables.address.map(row => row.id);
const districtIds = fixture.tables.district.map(row => row.id);
const timeline = read(`SELECT json_build_object('before',(min(v)-interval '1 microsecond')::text,
  'historical',(min(v)+(max(v)-min(v))/2)::text) FROM (
  SELECT lower(range_validity) v FROM ban.district WHERE id=ANY(${uuidArray(districtIds)}) UNION ALL
  SELECT lower(range_validity) FROM ban.district_h WHERE id=ANY(${uuidArray(districtIds)})
) bounds;`);
const boundary = read(`SELECT json_build_object('before',(upper(range_validity)-interval '1 microsecond')::text,
  'exact',upper(range_validity)::text,'after',(upper(range_validity)+interval '1 microsecond')::text)
  FROM ban.address_h WHERE id=${literal(ids[0])}::uuid AND NOT upper_inf(range_validity)
  ORDER BY upper(range_validity) LIMIT 1;`);
const dates = { beforeCreation: timeline.before, historical: timeline.historical,
  boundaryBefore: boundary.before, boundaryExact: boundary.exact, boundaryAfter: boundary.after, current: fixture.exported_at };
const sort = rows => [...rows].sort((a, b) => a.id.localeCompare(b.id));
const report = { target, readonly: true, startedAt: new Date().toISOString(),
  installed: false, nationalPerformanceNotQualified: true, results: [] };
try {
  for (const [dateName, at] of Object.entries(dates)) {
    const expected = read(`SELECT COALESCE(json_agg(to_jsonb(r)), '[]'::json) FROM (
      SELECT * FROM ban.address WHERE id=ANY(${uuidArray(ids)}) UNION ALL
      SELECT * FROM ban.address_h WHERE id=ANY(${uuidArray(ids)})
    ) r WHERE range_validity @> ${literal(at)}::timestamptz AND ("isActive" IS DISTINCT FROM false);`);
    for (const [filterName, selection] of Object.entries({ departmentOnly: null, departmentAndIds: ids })) {
      const parameters = { as_of: `${literal(at)}::timestamptz`, ids: uuidArray(selection),
        common_toponym_ids: 'NULL::uuid[]', district_ids: 'NULL::uuid[]', departements: "ARRAY['96']::text[]" };
      const inline = definition => body(definition).replace(/\b(as_of|ids|common_toponym_ids|district_ids|departements)\b/g,
        key => `(${parameters[key]})`).trim().replace(/;$/, '');
      const query = inline(migration), originalQuery = inline(reference);
      const oldPlan = read('EXPLAIN (FORMAT JSON) ' + originalQuery)[0];
      report.pendingCase = { dateName, filterName, optimizedPlan: read('EXPLAIN (FORMAT JSON) ' + query)[0] };
      const execution = read('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + query)[0];
      const actual = read(`SELECT COALESCE(json_agg(to_jsonb(r)),'[]'::json) FROM (${query}) r(type,nodekey,data);`);
      assert.deepEqual(sort(actual.map(row => row.data)), sort(expected));
      // The installed function is only executed with bounded explicit UUIDs.
      const installed = read(`SELECT COALESCE(json_agg(to_jsonb(r)),'[]'::json) FROM ban.snapshot_address(
        ${literal(at)}::timestamptz,${uuidArray(ids)},NULL::uuid[],NULL::uuid[],ARRAY['96']::text[]) r;`);
      assert.deepEqual(sort(actual.map(row => row.data)), sort(installed.map(row => row.data)));
      const result = { dateName, filterName, count: actual.length, exactComparison: true,
        executionMs: execution['Execution Time'], planningMs: execution['Planning Time'],
        originalCost: oldPlan.Plan['Total Cost'], optimizedCost: execution.Plan['Total Cost'],
        originalPlan: oldPlan.Plan, optimizedPlan: execution.Plan };
      report.results.push(result);
      delete report.pendingCase;
      console.log(JSON.stringify({ dateName, filterName, count: result.count, executionMs: result.executionMs }));
    }
  }
} catch (error) {
  report.error = error.message; process.exitCode = 1; console.error(error.message);
} finally {
  const after = read(inspect);
  report.candidateCatalogUnchanged = JSON.stringify(after) === JSON.stringify(before);
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  assert.deepEqual(after, before, 'Candidate function/registry changed during read-only experiment');
}
