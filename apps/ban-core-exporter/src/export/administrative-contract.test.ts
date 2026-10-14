import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { buildAdministrativeStreams } from './test-support/administrative-streams.js';
import { scenarioIds } from './test-support/administrative-scenario.js';
import type { RawEntity } from './types.js';
const spec = path.resolve(process.cwd(), 'specifications/ban-diff/v0.4');
const fixtures = path.join(spec, 'fixtures/administrative');
const readFixture = (name: string): RawEntity[] => readFileSync(path.join(fixtures, `${name}.ban-standard.ndjson`), 'utf8')
  .trim().split('\n').map(line => JSON.parse(line));
const body = (rows: RawEntity[]) => rows.slice(1, -1);
const stateOf = (row: RawEntity) => row.data;
const idOf = (_type: string, state: RawEntity): string => state.id;
const keyOf = (type: string, state: RawEntity) => `${type}:${idOf(type, state)}`;
const active = (state: RawEntity) => state.status === 'active';
const fromFull = (rows: RawEntity[]) => new Map(body(rows).map(row => [keyOf(row.type, stateOf(row)), structuredClone(stateOf(row))]));
// Test consumer is independent of the production comparison projection.
const businessState = (state: RawEntity) => {
  const copy = structuredClone(state);
  delete copy.updatedAt;
  const meta = copy.meta;
  if (meta?.interop) {
    delete meta.interop.banComputedKey;
    if (!Object.keys(meta.interop).length)
      delete meta.interop;
  }
  return copy;
};
const activeView = (registry: Map<string, RawEntity>, businessOnly = false) => Object.fromEntries([...registry].filter(([, state]) => active(state)).map(([key, state]) => [key, businessOnly ? businessState(state) : state]));
const checkActiveReferences = (registry: Map<string, RawEntity>) => {
  const requireActive = (key: string) => {
    if (!registry.has(key) || !active(registry.get(key)!))
      throw new Error(`Unresolved active reference: ${key}`);
  };
  for (const [key, state] of registry) {
    if (!active(state) || key.startsWith('district:'))
      continue;
    requireActive(`district:${state.districtID}`);
    if (key.startsWith('address:')) {
      requireActive(`toponym:${state.mainToponymID}`);
      for (const id of state.secondaryToponymIDs)
        requireActive(`toponym:${id}`);
    }
  }
};
const applyDiff = (registry: Map<string, RawEntity>, rows: RawEntity[]) => {
  for (const row of body(rows)) {
    const [after, before] = stateOf(row);
    const event = row.event;
    const key = keyOf(row.type, after);
    if (event === 'created' && registry.has(key))
      throw new Error(`Reused UUID: ${key}`);
    if (event !== 'created' && !registry.has(key))
      throw new Error(`Missing before object: ${key}`);
    if (event === 'updated') {
      if (key !== keyOf(row.type, before))
        throw new Error('Before/after UUID mismatch');
      expect(before).toEqual(registry.get(key));
    }
    registry.set(key, structuredClone(after));
    checkActiveReferences(registry);
  }
};
describe('fictional administrative changes and consecutive DIFFs', () => {
  const metaKey = 'meta';
  const read = (name: string) => JSON.parse(readFileSync(path.join(spec, 'schemas', name), 'utf8'));
  const ajv = new Ajv2020({ strict: false, formats: {
      'date-time': (value: string) => Number.isFinite(Date.parse(value)),
      uuid: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
    } });
  ajv.addSchema(read(`ban-standard-definitions-v0.4.schema.json`));
  it(`reproduces all five versioned streams using the production serializer and validates their schemas and counters`, async () => {
    const produced = await buildAdministrativeStreams();
    const validateFull = ajv.compile(read(`ban-standard-full-v0.4.schema.json`));
    const validateDiff = ajv.compile(read(`ban-standard-diff-v0.4.schema.json`));
    for (const [name, rows] of Object.entries(produced)) {
      expect(rows).toEqual(readFixture(name));
      const validate = name.includes('_full-') ? validateFull : validateDiff;
      for (const row of rows)
        expect(validate(row), ajv.errorsText(validate.errors)).toBe(true);
      const result = spawnSync(process.execPath, [path.join(spec, 'scripts/validate-ban-ndjson.mjs'),
        path.join(fixtures, `${name}.ban-standard.ndjson`)], { encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
    }
  });
  it(`applies the fusion and both consecutive windows to recover the active FULLs`, () => {
    const start = readFixture('step-0_full-start'), middle = readFixture('step-2_full-middle'), end = readFixture('step-4_full-end');
    const first = readFixture('step-1_diff-first'), second = readFixture('step-3_diff-second');
    const request = (rows: RawEntity[]) => rows[0][metaKey]['request'];
    expect(request(first)['to']).toBe(request(second)['from']);
    expect(request(first)['from']).toBe(request(start)['at']);
    expect(request(first)['to']).toBe(request(middle)['at']);
    expect(request(second)['to']).toBe(request(end)['at']);
    const registry = fromFull(start);
    checkActiveReferences(registry);
    applyDiff(registry, first);
    expect(activeView(registry)).toEqual(activeView(fromFull(middle)));
    for (const id of [scenarioIds.north, scenarioIds.south])
      expect(active(registry.get(`district:${id}`)!)).toBe(false);
    applyDiff(registry, second);
    expect(activeView(registry, true)).toEqual(activeView(fromFull(end), true));
    expect(Object.keys(activeView(registry))).toHaveLength(7);
    expect(active(registry.get(`address:${scenarioIds.firstAddress}`)!)).toBe(false);
    expect(active(registry.get(`address:${scenarioIds.transientAddress}`)!)).toBe(false);
    for (const row of body(second))
      expect([scenarioIds.north, scenarioIds.south]).not.toContain(idOf(row.type, stateOf(row)[0]));
    // Technical-only values may differ without breaking the active business view.
    expect(registry.get(`address:${scenarioIds.secondAddress}`)).not.toEqual(fromFull(end).get(`address:${scenarioIds.secondAddress}`));
  });
  it(`does not publish a recalculated key alone and retains a created-disabled trace`, () => {
    const second = readFixture('step-3_diff-second');
    const ids = body(second).map(row => idOf(row.type, stateOf(row)[0]));
    expect(ids).not.toContain(scenarioIds.secondAddress);
    const trace = body(second).find(row => idOf(row.type, stateOf(row)[0]) === scenarioIds.transientAddress)!;
    expect(trace.event ?? trace.evenement).toBe('created');
    expect(stateOf(trace)).toHaveLength(1);
    expect(active(stateOf(trace)[0])).toBe(false);
    expect(body(readFixture('step-4_full-end')).map(row => idOf(row.type, stateOf(row)))).not.toContain(scenarioIds.transientAddress);
    const counts = second.at(-1)![metaKey]['stats'];
    expect(counts['address']).toEqual({ count: 4, created: 2, updated: 1, disabled: 1 });
  });
  it(`rejects reversed windows, a duplicate creation and mismatched before/after IDs in the test consumer`, () => {
    const first = readFixture('step-1_diff-first'), second = readFixture('step-3_diff-second');
    expect(() => applyDiff(fromFull(readFixture('step-0_full-start')), second)).toThrow('Unresolved active reference');
    const registry = fromFull(readFixture('step-0_full-start'));
    applyDiff(registry, first);
    expect(() => applyDiff(registry, first)).toThrow('Reused UUID');
    const invalid = structuredClone(first);
    const updated = body(invalid).find(row => (row.event ?? row.evenement) === 'updated')!;
    stateOf(updated)[1]['id'] = scenarioIds.transientAddress;
    expect(() => applyDiff(fromFull(readFixture('step-0_full-start')), invalid)).toThrow('Before/after UUID mismatch');
  });
});
