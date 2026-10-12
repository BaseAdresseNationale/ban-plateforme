import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { getDiffObjLine } from './helpers/ndjson-data-line.js';
import { banStandardFormatters } from './helpers/ban-standard-formatters.js';
const spec = path.resolve(process.cwd(), 'specifications/ban-diff/v0.4');
const read = (name: string) => JSON.parse(readFileSync(path.join(spec, 'schemas', name), 'utf8'));
const full = readFileSync(path.join(spec, 'fixtures/ban-standard-full-v0.4.ndjson'), 'utf8')
  .trim().split('\n').map(line => JSON.parse(line));
const validator = path.join(spec, 'scripts/validate-ban-ndjson.mjs');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function streamCheck(lines: object[]) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'ban-created-disabled-'));
  try {
    const file = path.join(directory, 'stream.ndjson');
    writeFileSync(file, lines.map(line => JSON.stringify(line)).join('\n') + '\n');
    return spawnSync(process.execPath, [validator, file], { encoding: 'utf8' });
  }
  finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
describe('created with a disabled final state', () => {
  for (const type of ['district', 'toponym', 'address'] as const) {
    it(`serializes and validates consolidated ${type}, without adding an active object`, () => {
      const state = { ...structuredClone(full.find(row => row.type === type).data), isActive: false };
      if (type === 'address')
        state.labels = [];
      const original = structuredClone(state);
      const row = getDiffObjLine({ event: 'created', type, datas: [state, null] }, banStandardFormatters) as Record<string, any>;
      const dataKey = 'data', statusKey = 'status';
      const eventKey = 'event', idKey = 'id';
      expect(row[eventKey]).toBe('created');
      expect(row[dataKey]).toHaveLength(1);
      expect(row[dataKey][0][statusKey]).toBe('disabled');
      expect(row[dataKey][0]).not.toHaveProperty('isActive');
      if (type === 'address')
        expect(row[dataKey][0]['labels']).toEqual([]);
      expect(state).toEqual(original);
      const ajv = new Ajv2020({ strict: false, formats: {
          'date-time': (value: string) => Number.isFinite(Date.parse(value)),
          uuid: (value: string) => uuidPattern.test(value),
        } });
      ajv.addSchema(read(`ban-standard-definitions-v0.4.schema.json`));
      const schema = ajv.compile(read(`ban-standard-diff-v0.4.schema.json`));
      expect(schema(row), ajv.errorsText(schema.errors)).toBe(true);
      const meta = 'meta';
      const request = (from: string, to: string) => ({ dataTypes: [row.type], departments: ['96'], from, to });
      const start = (from: string, to: string) => ({ [meta]: {
          note: 'stream-start', ['formatVersion']: '0.4',
          ['exportType']: 'diff', format: 'ban-standard',
          ['request']: request(from, to),
        } });
      const end = (count: number) => ({ [meta]: {
          note: 'stream-end', ['generatedAt']: '2026-10-01T00:00:00Z',
          ['stats']: { [row.type]: { count, created: count, updated: 0, disabled: 0 } },
        } });
      const opening = start('2026-09-01T00:00:00Z', '2026-09-29T00:00:00Z');
      const result = streamCheck([opening, row, end(1)]);
      expect(result.status, result.stderr).toBe(0);
      // A subsequent period with no change is valid without repeating the trace.
      const next = streamCheck([start('2026-09-29T00:00:00Z', '2026-10-01T00:00:00Z'), end(0)]);
      expect(next.status, next.stderr).toBe(0);
      const active = new Map<string, object>(), traces = new Map<string, object>();
      const after = row[dataKey][0];
      traces.set(after[idKey], after);
      if (after[statusKey] === 'active')
        active.set(after[idKey], after);
      else
        active.delete(after[idKey]);
      expect([...active.values()]).toEqual([]); // Same active view as a FULL without this object.
      expect(traces.has(after[idKey])).toBe(true);
      const fullSchema = ajv.compile(read(`ban-standard-full-v0.4.schema.json`));
      expect(fullSchema({ type: row.type, [dataKey]: after })).toBe(false);
      const fullStream = readFileSync(path.join(spec, 'fixtures', `ban-standard-full-v0.4.ndjson`), 'utf8')
        .trim().split('\n').map(line => JSON.parse(line));
      fullStream.find(line => line.type === row.type)[dataKey] = after;
      expect(streamCheck(fullStream).status).not.toBe(0);
      for (const status of [undefined, null, 'unknown']) {
        const invalid = structuredClone(row);
        if (status === undefined)
          delete invalid[dataKey][0][statusKey];
        else
          invalid[dataKey][0][statusKey] = status;
        expect(schema(invalid)).toBe(false);
        expect(streamCheck([opening, invalid, end(1)]).status).not.toBe(0);
      }
      const disabledActive = structuredClone(row);
      disabledActive[eventKey] = 'disabled';
      disabledActive[dataKey][0][statusKey] = 'active';
      expect(schema(disabledActive)).toBe(false);
      const disabledEnd: Record<string, any> = end(0);
      disabledEnd[meta]['stats'][row.type] = { count: 1, created: 0, updated: 0, disabled: 1 };
      expect(streamCheck([opening, disabledActive, disabledEnd]).status).not.toBe(0);
      expect(streamCheck([opening, row, row, end(2)]).status).not.toBe(0);
      const duplicateState = structuredClone(row);
      duplicateState[dataKey].push(after);
      expect(schema(duplicateState)).toBe(false);
      expect(streamCheck([opening, duplicateState, end(1)]).status).not.toBe(0);
    });
  }
});
