import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { sql, jsonLines } from './postgres-test-helpers.mjs';
import { syntheticIds as ids } from './support/synthetic-fixture.mjs';

const migration = fs.readFileSync(new URL('../prisma/migrations/0007_optimize_address_diff_filters/migration.sql', import.meta.url), 'utf8');
const original = fs.readFileSync(new URL('./support/rollback-address-diff.sql', import.meta.url), 'utf8');
const target = 'ban_export_validation_tmp';
const uuidArray = values => values === null ? 'NULL::uuid[]' : `ARRAY[${values.map(v => `'${v}'`).join(',')}]::uuid[]`;
const departments = values => values === null ? 'NULL::text[]' : `ARRAY[${values.map(v => `'${v}'`).join(',')}]::text[]`;
const filters = {
  department: [null, null, null, ['96']], all: [null, null, null, null],
  ids: [[ids.created, ids.updated], null, null, ['96']], district: [null, null, [ids.district], null],
  main: [null, [ids.toponym], null, ['96']], secondary: [null, [ids.secondary], null, ['96']],
  absent: [[ids.absent], null, null, ['96']], absentDepartment: [null, null, null, ['99']],
};
const periods = {
  creation: ['2025-12-31T00:00:00Z', '2026-04-01T00:00:00Z'],
  changes: ['2026-01-15T00:00:00Z', '2026-04-01T00:00:00Z'],
  transition: ['2026-02-28T23:59:59.999999Z', '2026-03-01T00:00:00.000001Z'],
  stable: ['2026-04-01T00:00:00Z', '2026-04-02T00:00:00Z'],
};
const call = (fn, period, filter) => `ban.${fn}('${period[0]}'::timestamptz,'${period[1]}'::timestamptz,${filter.slice(0,3).map(uuidArray).join(',')},${departments(filter[3])})`;
const read = call => `SELECT COALESCE(json_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::json) FROM ${call} r;`;

for (const [periodName, period] of Object.entries(periods)) for (const [filterName, filter] of Object.entries(filters)) {
  test(`${periodName}/${filterName}: exact function and NDJSON equivalence`, { skip: process.env.RUN_BAN_POSTGRES_TESTS !== '1' }, () => {
    const select = read(call('diff_address', period, filter)) + read(call('diff_address_ndjson', period, filter));
    const result = jsonLines(sql(target, `BEGIN; ${original}\n${select}\n${migration}\n${select}\nROLLBACK;`));
    assert.equal(result.length, 4); assert.deepEqual(result[2], result[0]); assert.deepEqual(result[3], result[1]);
    if (filterName === 'department' && periodName === 'changes') {
      assert.deepEqual(result[2].map(r => r.event).sort(), ['created', 'disabled', 'updated']);
      const update = result[2].find(r => r.event === 'updated');
      assert.equal(update.datas[0].number, 55); assert.equal(update.datas[1].number, 5);
    }
    if (periodName === 'stable' || filterName.startsWith('absent')) assert.equal(result[2].length, 0);
  });
}

test('rollback restores original definition and triggers/constraints remain valid', { skip: process.env.RUN_BAN_POSTGRES_TESTS !== '1' }, () => {
  const inspect = `SELECT json_build_object('definition',pg_get_functiondef('ban.diff_address(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[])'::regprocedure),
    'disabled',(SELECT count(*) FROM pg_trigger WHERE tgname='test_historisation' AND tgenabled<>'O'),
    'invalid',(SELECT count(*) FROM pg_constraint WHERE connamespace='ban'::regnamespace AND NOT convalidated));`;
  const [before, after] = jsonLines(sql(target, `BEGIN; ${original} ${inspect} ${migration} ${original} ${inspect} ROLLBACK;`));
  assert.deepEqual(after, before); assert.equal(after.disabled, 0); assert.equal(after.invalid, 0);
});
