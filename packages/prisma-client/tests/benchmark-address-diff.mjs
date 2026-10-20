// Read-only SELECT experiment on the candidate. Does not install any function.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

if (process.env.RUN_BAN_POSTGRES_TESTS !== '1' || !process.argv[2]) throw new Error('Explicit opt-in and fixture JSON required');
const fixture = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert.equal(fixture.department, '96');
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
function read(query) {
  const result = spawnSync('docker', ['exec', '-i', 'ban_postgres', 'psql', '--username=ban_user',
    '--dbname=ban_restore_validation', '--no-psqlrc', '--set=ON_ERROR_STOP=1', '--quiet', '--tuples-only', '--no-align', '--file=-'], {
    input: `BEGIN READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL statement_timeout='30s';
    DO $$ BEGIN IF current_database()<>'ban_restore_validation' THEN RAISE EXCEPTION 'Wrong candidate'; END IF; END $$;
    ${query}\nROLLBACK;`, encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Candidate query failed');
  return [JSON.parse(result.stdout.trim())];
}
const original = read("SELECT to_json(prosrc) FROM pg_proc WHERE oid='ban.diff_address(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[])'::regprocedure;")[0];
assert.ok(!original.includes('params AS NOT MATERIALIZED'), 'Candidate already optimized: review benchmark baseline');
const optimized = original.replace('params AS (', 'params AS NOT MATERIALIZED (')
  .replaceAll('IN (SELECT id FROM district_filter)', '= ANY(ARRAY(SELECT id FROM district_filter))');
const uuidArray = list => list == null ? 'NULL::uuid[]' : `ARRAY[${list.map(literal).join(',')}]::uuid[]`;
const ids = fixture.tables.address.map(row => row.id);
const periods = {
  creation: ['2026-03-24 16:16:17.320969+00', fixture.exported_at],
  transition: ['2026-03-24 19:21:06.25208+00', '2026-03-24 19:21:06.252082+00'],
  stable: [fixture.exported_at, '2026-10-09 09:13:49.841835+00'],
};
const filters = { department96: null, departmentAndIds: ids };
const results = [];
const sort = rows => rows.sort((a, b) => a.id.localeCompare(b.id));
const withoutRange = row => { if (!row) return row; const { range_validity, ...rest } = row; return rest; };
for (const [periodName, [from, to]] of Object.entries(periods)) for (const [filterName, selection] of Object.entries(filters)) {
  const parameters = `params AS ${'NOT MATERIALIZED '}(
    SELECT ${literal(from)}::timestamptz t_from,${literal(to)}::timestamptz t_to,
    tstzrange(${literal(from)}::timestamptz,${literal(to)}::timestamptz,'[)') win,
    ${uuidArray(selection)} ids,NULL::uuid[] common_toponym_ids,NULL::uuid[] district_ids,ARRAY['96']::text[] departements),\n`;
  const start = optimized.indexOf('params AS NOT MATERIALIZED ('), end = optimized.indexOf('district_filter AS (');
  assert.ok(start >= 0 && end > start);
  const query = optimized.slice(0, start) + parameters + optimized.slice(end);
  const oldQuery = original.slice(0, original.indexOf('params AS ('))
    + parameters.replace('NOT MATERIALIZED ', '') + original.slice(original.indexOf('district_filter AS ('));
  const oldPlan = read('EXPLAIN (FORMAT JSON) ' + oldQuery)[0][0].Plan;
  const execution = read('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ' + query)[0][0];
  const actual = read(`SELECT COALESCE(json_agg(to_jsonb(r)),'[]'::json) FROM (${query.trim().replace(/;$/, '')}) r;`)[0];
  const state = date => read(`SELECT COALESCE(json_agg(to_jsonb(r)),'[]'::json) FROM
    (SELECT * FROM ban.address WHERE id=ANY(${uuidArray(ids)}) UNION ALL
    SELECT * FROM ban.address_h WHERE id=ANY(${uuidArray(ids)})) r WHERE range_validity @> ${literal(date)}::timestamptz;`)[0];
  const before = new Map(state(from).map(r => [r.id, r])), after = new Map(state(to).map(r => [r.id, r]));
  const expected = [];
  for (const id of ids) {
    const b = before.get(id) ?? null, a = after.get(id) ?? null;
    const event = !b && a ? 'created' : b?.isActive === true && a?.isActive === false ? 'disabled'
      : b && a && JSON.stringify(withoutRange(b)) !== JSON.stringify(withoutRange(a)) ? 'updated' : null;
    if (event) expected.push({ id, event, datas: [a, b] });
  }
  assert.deepEqual(sort(actual.map(r => ({ id: (r.datas[0] ?? r.datas[1]).id, event: r.event, datas: r.datas }))), sort(expected));
  const result = { periodName, filterName, count: actual.length, exactComparison: true,
    executionMs: execution['Execution Time'], planningMs: execution['Planning Time'],
    originalCost: oldPlan['Total Cost'], optimizedCost: execution.Plan['Total Cost'] };
  results.push(result); console.log(JSON.stringify(result));
}
assert.equal(read("SELECT to_json(prosrc) FROM pg_proc WHERE oid='ban.diff_address(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[])'::regprocedure;")[0], original);
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify({ target: 'ban_restore_validation', readonly: true,
  functionUnchanged: true, nationalPerformanceNotQualified: true, results }, null, 2) + '\n', { flag: 'wx' });
