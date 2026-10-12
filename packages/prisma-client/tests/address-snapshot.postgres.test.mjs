import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { sql, jsonLines } from './postgres-test-helpers.mjs';
import { syntheticIds as ids, rows } from './support/synthetic-fixture.mjs';

const migration = fs.readFileSync(new URL('../prisma/migrations/0008_optimize_address_snapshot_filters/migration.sql', import.meta.url), 'utf8');
const original = fs.readFileSync(new URL('./support/rollback-address-snapshot.sql', import.meta.url), 'utf8');
const baseline = fs.readFileSync(new URL('../prisma/migrations/0006_normalize_export_filter_arguments/migration.sql', import.meta.url), 'utf8');
const target = 'ban_export_validation_tmp';
const skip = process.env.RUN_BAN_POSTGRES_TESTS !== '1';
const body = definition => definition.match(/AS\s+\$\$([\s\S]*?)\$\$/)[1].replace(/\s+/g, ' ').trim();
const uuidArray = values => values === null ? 'NULL::uuid[]' : `ARRAY[${values.map(v => `'${v}'`).join(',')}]::uuid[]`;
const departments = values => values === null ? 'NULL::text[]' : `ARRAY[${values.map(v => `'${v}'`).join(',')}]::text[]`;
const filters = {
  all: [null, null, null, null], department: [null, null, null, ['96']],
  ids: [[ids.created, ids.updated], null, null, ['96']], district: [null, null, [ids.district], null],
  main: [null, [ids.toponym], null, ['96']], secondary: [null, [ids.secondary], null, ['96']],
  absent: [[ids.absent], null, null, ['96']], absentDepartment: [null, null, null, ['99']],
  emptyIds: [[], null, null, ['96']], emptyDepartments: [null, null, null, []],
  multipleDepartments: [null, null, null, ['96', '99', '96']],
  incompatibleDistrict: [null, null, [ids.absent], ['96']],
  emptyToponyms: [null, [], null, ['96']], emptyDistricts: [null, null, [], ['96']],
};
const dates = {
  beforeCreation: '2025-12-31T23:59:59.999999Z', historical: '2026-01-15T00:00:00Z',
  boundaryBefore: '2026-02-28T23:59:59.999999Z', boundaryExact: '2026-03-01T00:00:00Z',
  boundaryAfter: '2026-03-01T00:00:00.000001Z', current: '2026-04-01T00:00:00Z',
};
const call = (fn, at, filter) => `ban.${fn}('${at}'::timestamptz,${filter.slice(0, 3).map(uuidArray).join(',')},${departments(filter[3])})`;
const read = expression => `SELECT COALESCE(json_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::json) FROM ${expression} r;`;
const inspect = `SELECT json_build_object('definition',pg_get_functiondef('ban.snapshot_address(timestamptz,uuid[],uuid[],uuid[],text[])'::regprocedure),
  'owner',(SELECT proowner FROM pg_proc WHERE oid='ban.snapshot_address(timestamptz,uuid[],uuid[],uuid[],text[])'::regprocedure),
  'acl',(SELECT proacl FROM pg_proc WHERE oid='ban.snapshot_address(timestamptz,uuid[],uuid[],uuid[],text[])'::regprocedure),
  'wrapper',pg_get_functiondef('ban.snapshot_address_ndjson(timestamptz,uuid[],uuid[],uuid[],text[])'::regprocedure),
  'disabled',(SELECT count(*) FROM pg_trigger WHERE tgname='test_historisation' AND tgenabled<>'O'),
  'invalid',(SELECT count(*) FROM pg_constraint WHERE connamespace='ban'::regnamespace AND NOT convalidated),
  'address_count',(SELECT count(*) FROM ban.address),'history_count',(SELECT count(*) FROM ban.address_h));`;

test('rollback reference matches 0006 and migration only replaces snapshot_address', () => {
  assert.equal(body(original), body(baseline));
  assert.equal((migration.match(/CREATE OR REPLACE FUNCTION/g) ?? []).length, 1);
  assert.ok(!/\b(DROP|ALTER|INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(migration.replace(/--[^\n]*/g, '')));
});

for (const [dateName, at] of Object.entries(dates)) for (const [filterName, filter] of Object.entries(filters)) {
  test(`${dateName}/${filterName}: exact snapshot and NDJSON equivalence`, { skip }, () => {
    const select = read(call('snapshot_address', at, filter)) + read(call('snapshot_address_ndjson', at, filter));
    const result = jsonLines(sql(target, `BEGIN; ${original}\n${select}\n${migration}\n${select}\nROLLBACK;`));
    assert.equal(result.length, 4); assert.deepEqual(result[2], result[0]); assert.deepEqual(result[3], result[1]);
    if (dateName === 'beforeCreation' || filterName.startsWith('absent') || filterName.startsWith('empty') || filterName === 'incompatibleDistrict') {
      assert.equal(result[2].length, 0);
    }
    if (filterName === 'department' && dateName === 'current') {
      assert.equal(result[2].length, 3);
      assert.ok(!result[2].some(r => r.data.id === ids.disabled));
      assert.equal(result[2].find(r => r.data.id === ids.updated).data.number, 55);
    }
    if (filterName === 'department' && dateName === 'historical') {
      assert.equal(result[2].length, 3);
      assert.equal(result[2].find(r => r.data.id === ids.updated).data.number, 5);
    }
  });
}

test('department/toponym preselection must not resurrect a lower-priority historical version', { skip }, () => {
  const otherDistrict = '11111111-1111-4111-8111-000000000201';
  const otherToponym = '11111111-1111-4111-8111-000000000202';
  const moved = '11111111-1111-4111-8111-000000000203';
  const returned = '11111111-1111-4111-8111-000000000204';
  const changedToponym = '11111111-1111-4111-8111-000000000205';
  const district = { ...rows.district[0], id: otherDistrict, meta: { insee: { cog: '97001' } } };
  const top = { ...rows.common_toponym[0], id: otherToponym, districtID: otherDistrict };
  const address = (id, districtID, toponym) => ({ ...rows.address[3], id, districtID, mainCommonToponymID: toponym, secondaryCommonToponymIDs: [] });
  const current = [address(moved, otherDistrict, otherToponym), address(returned, ids.district, ids.toponym), address(changedToponym, ids.district, ids.secondary)];
  const history = [address(moved, ids.district, ids.toponym), address(returned, otherDistrict, otherToponym), address(changedToponym, ids.district, ids.toponym)];
  // Cross-table overlaps are deliberately valid here: the history exclusion
  // only applies within address_h. The existing live-before-history rule matters.
  const insert = (table, values) => `INSERT INTO ban.${table} SELECT * FROM jsonb_populate_recordset(NULL::ban.${table}, $data$${JSON.stringify(values)}$data$::jsonb);`;
  const setup = ['district', 'common_toponym', 'address'].map(t => `ALTER TABLE ban.${t} DISABLE TRIGGER test_historisation;`).join('\n')
    + insert('district', [district]) + insert('common_toponym', [top]) + insert('address', current) + insert('address_h', history)
    + ['district', 'common_toponym', 'address'].map(t => `ALTER TABLE ban.${t} ENABLE TRIGGER test_historisation;`).join('\n');
  const selection = [read(call('snapshot_address', dates.current, [null, null, null, ['96']])),
    read(call('snapshot_address', dates.current, [null, [ids.toponym], null, ['96']])),
    read(call('snapshot_address_ndjson', dates.current, [null, null, null, ['96']]))].join('\n');
  const result = jsonLines(sql(target, `BEGIN; ${setup} ${original} ${selection} ${migration} ${selection} SET CONSTRAINTS ALL IMMEDIATE; ROLLBACK;`));
  assert.equal(result.length, 6);
  for (let i = 0; i < 3; i++) assert.deepEqual(result[i + 3], result[i]);
  assert.ok(!result[3].some(r => r.data.id === moved));
  assert.ok(result[3].some(r => r.data.id === returned));
  assert.ok(!result[4].some(r => r.data.id === changedToponym));
});

test('owner/ACL, wrapper and data remain unchanged; rollback restores definition', { skip }, () => {
  const [before, upgraded, restored] = jsonLines(sql(target, `BEGIN; ${original} ${inspect} ${migration} ${inspect} ${original} ${inspect} ROLLBACK;`));
  assert.deepEqual(restored, before);
  const { definition: oldDefinition, ...oldState } = before;
  const { definition: newDefinition, ...newState } = upgraded;
  assert.notEqual(newDefinition, oldDefinition); assert.deepEqual(newState, oldState);
  assert.equal(restored.disabled, 0); assert.equal(restored.invalid, 0);
  assert.equal(restored.address_count, 4); assert.equal(restored.history_count, 2);
});

test('nullable active flag, suffix and empty labels retain their exact values', { skip }, () => {
  const nullableId = '11111111-1111-4111-8111-000000000206';
  const nullable = { ...rows.address[3], id: nullableId, isActive: null, suffix: null, labels: [] };
  const setup = `ALTER TABLE ban.address DISABLE TRIGGER test_historisation;
    INSERT INTO ban.address SELECT * FROM jsonb_populate_record(NULL::ban.address, $data$${JSON.stringify(nullable)}$data$::jsonb);
    ALTER TABLE ban.address ENABLE TRIGGER test_historisation;`;
  const filter = [[nullableId], null, null, ['96']];
  const select = read(call('snapshot_address', dates.current, filter)) + read(call('snapshot_address_ndjson', dates.current, filter));
  const result = jsonLines(sql(target, `BEGIN; ${setup} ${original} ${select} ${migration} ${select} ROLLBACK;`));
  assert.deepEqual(result[2], result[0]); assert.deepEqual(result[3], result[1]);
  assert.equal(result[2].length, 1); assert.equal(result[2][0].data.isActive, null);
  assert.equal(result[2][0].data.suffix, null); assert.deepEqual(result[2][0].data.labels, []);
});
