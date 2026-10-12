import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { sql, jsonLines } from './postgres-test-helpers.mjs';
import { functionDefinitions, normalizeSql, uuidArray, textArray, catalogQuery, signatures } from './snapshot-generation-helpers.mjs';
import { syntheticIds as ids, rows } from './support/synthetic-fixture.mjs';

const migration = fs.readFileSync(new URL('../prisma/migrations/0009_optimize_snapshot_generation/migration.sql', import.meta.url), 'utf8');
const rollback = fs.readFileSync(new URL('./support/rollback-snapshot-generation.sql', import.meta.url), 'utf8');
const oldFunctions = functionDefinitions(rollback), newFunctions = functionDefinitions(migration);
const oldSql = [...oldFunctions.values()].map(fn => fn.sql).join('\n');
const newSql = [...newFunctions.values()].map(fn => fn.sql).join('\n');
const addressBaseline = fs.readFileSync(new URL('../prisma/migrations/0008_optimize_address_snapshot_filters/migration.sql', import.meta.url), 'utf8');
const schema = fs.readFileSync(new URL('./support/export-schema.sql', import.meta.url), 'utf8');
const target = 'ban_export_validation_tmp';
const emptyTarget = 'ban_fixture_validation_tmp';
const skip = process.env.RUN_BAN_POSTGRES_TESTS !== '1';
const dates = {
  beforeCreation: '2025-12-31T23:59:59.999999Z', historical: '2026-01-15T00:00:00Z',
  boundaryBefore: '2026-02-28T23:59:59.999999Z', boundaryExact: '2026-03-01T00:00:00Z',
  boundaryAfter: '2026-03-01T00:00:00.000001Z', current: '2026-04-01T00:00:00Z',
};
const topFilters = {
  all: [null, null, null], department: [null, null, ['96']],
  ids: [[ids.toponym, ids.secondary], null, ['96']], duplicateIds: [[ids.toponym, ids.toponym], null, ['96']],
  district: [null, [ids.district], null], absent: [[ids.absent], null, ['96']],
  absentDepartment: [null, null, ['99']], emptyIds: [[], null, ['96']],
  emptyDepartments: [null, null, []], emptyDistricts: [null, [], null],
  multipleDepartments: [null, null, ['96', '99', '96']], incompatibleDistrict: [null, [ids.absent], ['96']],
};
const addressFilters = {
  all: [null, null, null, null], department: [null, null, null, ['96']],
  ids: [[ids.created, ids.updated], null, null, ['96']], district: [null, null, [ids.district], null],
  main: [null, [ids.toponym], null, ['96']], secondary: [null, [ids.secondary], null, ['96']],
  absent: [[ids.absent], null, null, ['96']], absentDepartment: [null, null, null, ['99']],
  emptyIds: [[], null, null, ['96']], emptyDepartments: [null, null, null, []],
  emptyToponyms: [null, [], null, ['96']], emptyDistricts: [null, null, [], ['96']],
  multipleDepartments: [null, null, null, ['96', '99', '96']], incompatibleDistrict: [null, null, [ids.absent], ['96']],
};
const call = (fn, at, filter) => `ban.${fn}('${at}'::timestamptz,${filter.slice(0, -1).map(uuidArray)},${textArray(filter.at(-1))})`;
const read = expression => `SELECT COALESCE(json_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::json) FROM ${expression} r;`;
const baseline = addressBaseline + '\n' + oldSql;
const compare = (selection, setup = '', database = target) => jsonLines(sql(database,
  `BEGIN; ${baseline}\n${setup}\n${selection}\n${newSql}\n${selection}\nSET CONSTRAINTS ALL IMMEDIATE; ROLLBACK;`));
const insert = (table, values) => `INSERT INTO ban.${table} SELECT * FROM jsonb_populate_recordset(NULL::ban.${table}, $data$${JSON.stringify(values)}$data$::jsonb);`;
const fixtureSetup = (values, extra = '') => ['district', 'common_toponym', 'address']
  .map(table => `ALTER TABLE ban.${table} DISABLE TRIGGER test_historisation;`).join('\n')
  + Object.entries(values).map(([table, records]) => insert(table, records)).join('\n') + extra
  + ['district', 'common_toponym', 'address'].map(table => `ALTER TABLE ban.${table} ENABLE TRIGGER test_historisation;`).join('\n');

test('atomic migration only replaces three functions; rollback matches the pre-0009 definitions', () => {
  assert.ok(!/\b(DROP|ALTER|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE|CREATE INDEX)\b/i.test(migration.replace(/--[^\n]*/g, '')));
  for (const [name, fn] of oldFunctions) {
    const reference = schema.match(new RegExp(`CREATE OR REPLACE FUNCTION ban\\.${name}\\([\\s\\S]*?AS \\$function\\$([\\s\\S]*?)\\$function\\$`));
    assert.ok(reference, name); assert.equal(normalizeSql(fn.body), normalizeSql(reference[1]), name);
  }
});

for (const [dateName, at] of Object.entries(dates)) {
  for (const [filterName, filter] of Object.entries(topFilters)) {
    test(`toponym ${dateName}/${filterName}: table and NDJSON equivalence`, { skip }, () => {
      const selected = read(call('snapshot_common_toponym', at, filter)) + read(call('snapshot_common_toponym_ndjson', at, filter));
      const [oldTable, oldLines, newTable, newLines] = compare(selected);
      assert.deepEqual(newTable, oldTable); assert.deepEqual(newLines, oldLines);
      if (dateName === 'beforeCreation' || /^(absent|empty|incompatible)/.test(filterName)) assert.equal(newTable.length, 0);
      if (filterName === 'department' && dateName !== 'beforeCreation') assert.equal(newTable.length, 2);
    });
  }
  for (const [filterName, filter] of Object.entries(addressFilters)) {
    test(`address ${dateName}/${filterName}: cached COG NDJSON equivalence`, { skip }, () => {
      const [before, after] = compare(read(call('snapshot_address_ndjson', at, filter)));
      assert.deepEqual(after, before);
      if (dateName === 'beforeCreation' || /^(absent|empty|incompatible)/.test(filterName)) assert.equal(after.length, 0);
      if (filterName === 'department' && dateName === 'current') assert.equal(after.length, 3);
    });
  }
}

test('toponym department preselection does not resurrect a lower-priority historical version', { skip }, () => {
  const otherDistrict = '11111111-1111-4111-8111-000000000301';
  const moved = '11111111-1111-4111-8111-000000000302';
  const returned = '11111111-1111-4111-8111-000000000303';
  const top = (id, districtID) => ({ ...rows.common_toponym[0], id, districtID });
  const setup = fixtureSetup({
    district: [{ ...rows.district[0], id: otherDistrict, meta: { insee: { cog: '97001' } } }],
    common_toponym: [top(moved, otherDistrict), top(returned, ids.district)],
    common_toponym_h: [top(moved, ids.district), top(returned, otherDistrict)],
  });
  const selection = read(call('snapshot_common_toponym', dates.current, topFilters.department))
    + read(call('snapshot_common_toponym_ndjson', dates.current, topFilters.department));
  const [oldTable, oldLines, newTable, newLines] = compare(selection, setup);
  assert.deepEqual(newTable, oldTable); assert.deepEqual(newLines, oldLines);
  assert.ok(!newTable.some(row => row.data.id === moved));
  assert.ok(newTable.some(row => row.data.id === returned));
});

test('cached COG selection is independent of the department filter and keeps parent priority', { skip }, () => {
  const history = { ...rows.district[0], meta: { insee: { cog: '96099' } } };
  const setup = fixtureSetup({ district_h: [history] }, `UPDATE ban.district SET meta='{"insee":{"cog":"97001"}}'::jsonb WHERE id='${ids.district}';`);
  const selection = read(call('snapshot_address_ndjson', dates.current, addressFilters.department))
    + read(call('snapshot_common_toponym_ndjson', dates.current, topFilters.department));
  const [oldAddresses, oldToponyms, newAddresses, newToponyms] = compare(selection, setup);
  assert.deepEqual(newAddresses, oldAddresses); assert.deepEqual(newToponyms, oldToponyms);
  for (const row of [...newAddresses, ...newToponyms]) assert.equal(JSON.parse(row).meta.insee.cog, '97001');
  assert.equal(newAddresses.length, 3); assert.equal(newToponyms.length, 2);
});

test('historical parent COG is used at the requested timestamp, not the current COG', { skip }, () => {
  const history = { ...rows.district[0], range_validity: '["2026-01-01T00:00:00Z","2026-03-01T00:00:00Z")' };
  const setup = fixtureSetup({ district_h: [history] }, `UPDATE ban.district SET range_validity='[2026-03-01,)'::tstzrange,
    meta='{"insee":{"cog":"96002"}}'::jsonb WHERE id='${ids.district}';`);
  for (const [at, cog] of [[dates.historical, '96001'], [dates.current, '96002']]) {
    const [before, after] = compare(read(call('snapshot_address_ndjson', at, addressFilters.department)), setup);
    assert.deepEqual(after, before);
    for (const row of after) assert.equal(JSON.parse(row).meta.insee.cog, cog);
  }
});

test('inactive or null parents preserve metadata fallback, nullable flags and empty optional labels', { skip }, () => {
  const nullableId = '11111111-1111-4111-8111-000000000304';
  const nullable = { ...rows.address[3], id: nullableId, districtID: null, isActive: null, suffix: null,
    labels: [], meta: { insee: { cog: '96077' }, ban: { cleInteropBAN: 'legacy-test', targetKeys: ['test'] } } };
  const setup = fixtureSetup({ address: [nullable] }, `UPDATE ban.district SET "isActive"=false WHERE id='${ids.district}';`);
  const selection = read(call('snapshot_address_ndjson', dates.current, addressFilters.all))
    + read(call('snapshot_common_toponym_ndjson', dates.current, topFilters.all));
  const [oldAddresses, oldToponyms, newAddresses, newToponyms] = compare(selection, setup);
  assert.deepEqual(newAddresses, oldAddresses); assert.deepEqual(newToponyms, oldToponyms);
  const exported = newAddresses.map(row => JSON.parse(row)).find(row => row.data.id === nullableId);
  assert.equal(exported.meta.insee.cog, '96077'); assert.equal(exported.meta.ban.DEPRECATED_cleInteropBAN, 'legacy-test');
  assert.equal(exported.data.isActive, null); assert.equal(exported.data.suffix, null); assert.deepEqual(exported.data.labels, []);
});

test('nullable and inactive toponyms keep the same eligibility in both wrapper paths', { skip }, () => {
  const nullableId = '11111111-1111-4111-8111-000000000305';
  const inactiveId = '11111111-1111-4111-8111-000000000306';
  const setup = fixtureSetup({ common_toponym: [
    { ...rows.common_toponym[0], id: nullableId, isActive: null, geometry: null },
    { ...rows.common_toponym[0], id: inactiveId, isActive: false },
  ] });
  for (const filter of [topFilters.department, [[nullableId, inactiveId], null, ['96']]]) {
    const [before, after] = compare(read(call('snapshot_common_toponym_ndjson', dates.current, filter)), setup);
    assert.deepEqual(after, before);
    const payloads = after.map(line => JSON.parse(line).data);
    assert.ok(!payloads.some(row => row.id === inactiveId));
    assert.equal(payloads.find(row => row.id === nullableId).isActive, null);
    assert.equal(payloads.find(row => row.id === nullableId).geometry, null);
  }
});

test('owners, ACL, signatures, other functions, indexes, constraints and fixture data survive migration and rollback', { skip }, () => {
  const data = `SELECT json_build_object('tables',json_build_array(
    (SELECT json_agg(to_jsonb(d) ORDER BY id) FROM ban.district d),
    (SELECT json_agg(to_jsonb(d) ORDER BY id) FROM ban.district_h d),
    (SELECT json_agg(to_jsonb(t) ORDER BY id) FROM ban.common_toponym t),
    (SELECT json_agg(to_jsonb(t) ORDER BY id) FROM ban.common_toponym_h t),
    (SELECT json_agg(to_jsonb(a) ORDER BY id) FROM ban.address a),
    (SELECT json_agg(to_jsonb(a) ORDER BY id) FROM ban.address_h a)));`;
  const [before, beforeData, upgraded, afterData, restored, restoredData] = jsonLines(sql(target,
    `BEGIN; ${baseline} ${catalogQuery} ${data} ${newSql} ${catalogQuery} ${data} ${oldSql} ${catalogQuery} ${data} ROLLBACK;`));
  assert.deepEqual(afterData, beforeData); assert.deepEqual(restoredData, beforeData);
  // CREATE OR REPLACE keeps the function OIDs and privileges but canonicalizes its SQL source.
  assert.deepEqual(restored, before);
  const changingNames = signatures.map(signature => signature.split('(')[0]);
  for (let i = 0; i < before.functions.length; i++) {
    const old = before.functions[i], current = upgraded.functions[i];
    const { definition, source, ...contract } = old;
    const { definition: newDefinition, source: newSource, ...newContract } = current;
    assert.deepEqual(newContract, contract);
    if (changingNames.includes(old.signature.split('(')[0])) assert.notEqual(newSource, source);
    else assert.deepEqual(current, old);
  }
  const { functions: ignoredBefore, ...catalogBefore } = before;
  const { functions: ignoredAfter, ...catalogAfter } = upgraded;
  assert.deepEqual(catalogAfter, catalogBefore);
});

test('empty database returns no rows for cached wrappers and toponym selection', { skip }, () => {
  const selection = read(call('snapshot_common_toponym', dates.current, topFilters.department))
    + read(call('snapshot_common_toponym_ndjson', dates.current, topFilters.all))
    + read(call('snapshot_address_ndjson', dates.current, addressFilters.all));
  const results = compare(selection, '', emptyTarget);
  assert.equal(results.length, 6);
  for (const result of results) assert.deepEqual(result, []);
});
