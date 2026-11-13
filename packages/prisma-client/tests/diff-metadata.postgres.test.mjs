import assert from 'node:assert/strict';
import test from 'node:test';
import {sql, jsonLines} from './postgres-test-helpers.mjs';
import {literal, textArray, catalogQuery} from './snapshot-generation-helpers.mjs';
import {rows, syntheticIds as ids} from './support/synthetic-fixture.mjs';
import {oldSql, newSql, prerequisites, names} from './diff-metadata-helpers.mjs';

const skip = process.env.RUN_BAN_POSTGRES_TESTS !== '1';
const target = 'ban_export_validation_tmp';
const periods = {
  empty: ['2025-12-01T00:00:00Z', '2025-12-31T00:00:00Z'],
  createdDisabled: ['2025-12-31T00:00:00Z', '2026-04-01T00:00:00Z'],
  changes: ['2026-01-15T00:00:00Z', '2026-04-01T00:00:00Z'],
  boundary: ['2026-02-28T23:59:59.999999Z', '2026-03-01T00:00:00.000001Z'],
  stable: ['2026-04-01T00:00:00Z', '2026-04-08T00:00:00Z'],
};
const filters = {
  all: [null, null, null, null], department: [null, null, null, ['96']],
  ids: [[ids.created, ids.updated, ids.disabled, ids.toponym], null, null, ['96']],
  duplicateIds: [[ids.updated, ids.updated, ids.toponym, null], null, null, null],
  district: [null, null, [ids.district], null],
  missing: [[ids.absent], null, null, ['96']],
  missingDepartment: [null, null, null, ['99']],
  emptyIds: [[], null, null, ['96']], emptyDistricts: [null, null, [], null],
  emptyDepartments: [null, null, null, []],
};
const uuidArray = values => values === null ? 'NULL::uuid[]'
  : `ARRAY[${values.map(v => v === null ? 'NULL' : literal(v)).join(',')}]::uuid[]`;
function selection(type, period, filter) {
  const [from, to] = period, [selected, toponyms, districts, departments] = filter;
  const args = [uuidArray(selected), ...(type === 'address' ? [uuidArray(toponyms)] : []), uuidArray(districts), textArray(departments)];
  return `SELECT coalesce(jsonb_agg(line::jsonb ORDER BY line::jsonb::text),'[]') FROM ban.diff_${type}_ndjson('${from}','${to}',${args}) t(line);`;
}
function compare(query, setup = '', database = target) {
  const [before, after] = jsonLines(sql(database, `BEGIN; ${prerequisites} ${oldSql} ${setup} ${query} ${newSql} ${query} SET CONSTRAINTS ALL IMMEDIATE; ROLLBACK;`));
  assert.deepEqual(after, before); return after;
}
function setup(statements) {
  return ['district', 'common_toponym', 'address'].map(t => `ALTER TABLE ban.${t} DISABLE TRIGGER test_historisation;`).join('\n')
    + statements + ['district', 'common_toponym', 'address'].map(t => `ALTER TABLE ban.${t} ENABLE TRIGGER test_historisation;`).join('\n');
}
const insert = (table, values) => `INSERT INTO ban.${table} SELECT * FROM jsonb_populate_recordset(NULL::ban.${table},$data$${JSON.stringify(values)}$data$::jsonb);`;

for (const type of ['address', 'common_toponym']) for (const [periodName, period] of Object.entries(periods)) {
  for (const [filterName, filter] of Object.entries(filters)) test(`${type}: ${periodName}/${filterName} preserves complete NDJSON objects`, {skip}, () => {
    const lines = compare(selection(type, period, filter));
    if (periodName === 'empty' || periodName === 'stable' || /^(missing|empty)/.test(filterName)) assert.equal(lines.length, 0);
    if (type === 'address' && periodName === 'changes' && ['all', 'department', 'district'].includes(filterName)) {
      assert.deepEqual(lines.map(l => l.event).sort(), ['created', 'disabled', 'updated']);
      assert.ok(lines.every(l => l.meta.insee.cog === '96001'));
    }
  });
}

for (const field of ['main', 'secondary', 'empty']) test(`address ${field} toponym selector remains equivalent`, {skip}, () => {
  const selected = field === 'main' ? [ids.toponym] : field === 'secondary' ? [ids.secondary] : [];
  const lines = compare(selection('address', periods.changes, [null, selected, null, ['96']]));
  assert.equal(lines.length, field === 'empty' ? 0 : 3);
});

test('historical COG uses the start bound for disabled and the end bound for other events', {skip}, () => {
  const historical = {...rows.district[0], range_validity: '[2026-01-01,2026-03-01)'};
  const fixture = setup(insert('district_h', [historical])
    + insert('common_toponym_h', rows.common_toponym.map(row => ({...row, range_validity: '[2026-01-01,2026-03-01)'})))
    + insert('common_toponym', [{...rows.common_toponym[0], id: '11111111-1111-4111-8111-000000000311', range_validity: '[2026-02-01,)'}])
    + `UPDATE ban.district SET range_validity='[2026-03-01,)'::tstzrange,meta='{"insee":{"cog":"97101"}}' WHERE id='${ids.district}';
       UPDATE ban.common_toponym SET range_validity='[2026-03-01,)'::tstzrange,labels=ARRAY['{"isoCode":"fra","value":"Renamed"}'::jsonb] WHERE id='${ids.toponym}';
       UPDATE ban.common_toponym SET range_validity='[2026-03-01,)'::tstzrange,"isActive"=false WHERE id='${ids.secondary}';`);
  for (const type of ['address', 'common_toponym']) {
    const lines = compare(selection(type, periods.changes, filters.district), fixture);
    assert.deepEqual(lines.map(l => l.event).sort(), ['created', 'disabled', 'updated']);
    for (const line of lines) assert.equal(line.meta.insee.cog, line.event === 'disabled' ? '96001' : '97101');
  }
});

test('parent priority and COG resolution remain independent of department and district selectors', {skip}, () => {
  const historical = {...rows.district[0], meta: {insee: {cog: '96099'}}};
  const fixture = setup(insert('district_h', [historical]) + `UPDATE ban.district SET meta='{"insee":{"cog":"95001"}}' WHERE id='${ids.district}';`);
  for (const type of ['address', 'common_toponym']) {
    const lines = compare(selection(type, periods.createdDisabled, [null, null, [ids.district], ['95', '96']]), fixture);
    assert.ok(lines.length > 0);assert.ok(lines.every(l => l.meta.insee.cog === '95001'));
  }
});

test('inactive and unknown parents preserve the original metadata fallback', {skip}, () => {
  const fixture = setup(`UPDATE ban.district SET "isActive"=false WHERE id='${ids.district}';`
    + insert('address', [{...rows.address[0], id: '11111111-1111-4111-8111-000000000310', districtID: null, meta: {insee: {cog: 'fallback'}, ban: {cleInteropBAN: 'synthetic'}}}]));
  const lines = compare(selection('address', periods.createdDisabled, filters.all), fixture);
  assert.equal(lines.find(l => l.datas[0].districtID === null).meta.insee.cog, 'fallback');
  assert.ok(lines.filter(l => l.datas[0].districtID).every(l => l.meta.insee.cog === '96001'));
});

test('a three-digit DROM department keeps its COG and complete selection', {skip}, () => {
  const fixture = setup(`UPDATE ban.district SET meta='{"insee":{"cog":"97101"}}' WHERE id='${ids.district}';`);
  for (const type of ['address', 'common_toponym']) {
    const lines = compare(selection(type, periods.createdDisabled, [null, null, null, ['971']]), fixture);
    assert.equal(lines.length, type === 'address' ? 4 : 2);
    assert.ok(lines.every(l => l.meta.insee.cog === '97101'));
  }
});

test('moved children resolve the after district even outside the requested parent selection', {skip}, () => {
  const other = '11111111-1111-4111-8111-000000000312';
  const fixture = setup(insert('district', [{...rows.district[0], id: other, range_validity: '[2026-03-01,)', meta: {insee: {cog: '97101'}}}])
    + insert('district_h', [{...rows.district[0], id: other, range_validity: '[2026-01-01,2026-03-01)', meta: {insee: {cog: '95001'}}}])
    + insert('common_toponym_h', rows.common_toponym.map(row => ({...row, range_validity: '[2026-01-01,2026-03-01)'})))
    + `UPDATE ban.address SET "districtID"='${other}' WHERE id=ANY(ARRAY['${ids.updated}','${ids.disabled}']::uuid[]);
       UPDATE ban.common_toponym SET "districtID"='${other}',range_validity='[2026-03-01,)'::tstzrange;
       UPDATE ban.common_toponym SET "isActive"=false WHERE id='${ids.secondary}';`);
  for (const type of ['address', 'common_toponym']) {
    const lines = compare(selection(type, periods.changes, filters.district), fixture);
    const updated = lines.find(l => l.event === 'updated'), disabled = lines.find(l => l.event === 'disabled');
    assert.equal(updated.meta.insee.cog, '97101');assert.equal(disabled.meta.insee.cog, '95001');
  }
});

test('an invalid period remains a SQL error in both wrappers', {skip}, () => {
  const checks = ['address', 'common_toponym'].map(type => {
    const call = selection(type, ['2026-04-01', '2026-01-01'], filters.department);
    return `DO $check$ BEGIN BEGIN ${call.replace(/^SELECT /, 'PERFORM ')}
      RAISE EXCEPTION 'Invalid period accepted'; EXCEPTION WHEN data_exception THEN NULL; END; END $check$;`;
  }).join('\n');
  sql(target, `BEGIN; ${prerequisites} ${oldSql} ${checks} ${newSql} ${checks} ROLLBACK;`);
});

test('explicit UUID selections do not execute an unbounded district snapshot', {skip}, () => {
  // The stub rejects a global scan, but serves the point helper used by explicit IDs.
  const stub = `CREATE OR REPLACE FUNCTION ban.snapshot_district(as_of timestamptz DEFAULT now(),ids uuid[] DEFAULT NULL,departements text[] DEFAULT NULL)
    RETURNS TABLE(type text,nodekey text,data jsonb) LANGUAGE plpgsql STABLE AS $stub$
    BEGIN IF ids IS NULL THEN RAISE EXCEPTION 'Unexpected unbounded snapshot'; END IF;
    RETURN QUERY SELECT 'district'::text,'DISTRICT'::text,jsonb_build_object('id',ids[1],'meta',jsonb_build_object('insee',jsonb_build_object('cog','96001')));
    END $stub$;`;
  for (const type of ['address', 'common_toponym']) compare(selection(type, periods.createdDisabled, filters.ids), stub);
});

test('data, signatures, owners, ACL, other functions and schema objects survive replacement and rollback', {skip}, () => {
  const data = `SELECT jsonb_agg(to_jsonb(a) ORDER BY to_jsonb(a)::text) FROM (SELECT * FROM ban.address UNION ALL SELECT * FROM ban.address_h) a;`;
  const [before, dataBefore, after, dataAfter, restored] = jsonLines(sql(target,
    `BEGIN; ${prerequisites} ${oldSql} ${catalogQuery} ${data} ${newSql} ${catalogQuery} ${data} ${oldSql} ${catalogQuery} ROLLBACK;`));
  assert.deepEqual(dataAfter, dataBefore);assert.deepEqual(restored, before);
  for (const old of before.functions) {
    const current = after.functions.find(f => f.signature === old.signature);
    const {definition, source, ...contract} = old, {definition: nextDefinition, source: nextSource, ...nextContract} = current;
    assert.deepEqual(nextContract, contract);
    if (!names.includes(old.signature.split('(')[0].slice(4))) assert.deepEqual(current, old);
  }
  const {functions: beforeFunctions, ...beforeSchema} = before, {functions: afterFunctions, ...afterSchema} = after;
  assert.deepEqual(afterSchema, beforeSchema);
});

test('both wrappers remain empty on an empty database', {skip}, () => {
  for (const type of ['address', 'common_toponym']) assert.deepEqual(compare(selection(type, periods.changes, filters.all), '', 'ban_fixture_validation_tmp'), []);
});
