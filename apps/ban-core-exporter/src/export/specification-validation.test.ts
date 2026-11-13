import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const spec = path.resolve(process.cwd(), 'specifications/ban-diff/v0.4');
const fixtures = path.join(spec, 'fixtures');
const read = (name: string) => JSON.parse(readFileSync(path.join(spec, 'schemas', name), 'utf8'));
const lines = (file: string) => readFileSync(path.join(fixtures, file), 'utf8').trim().split(/\r?\n/).map(line => JSON.parse(line));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validators = () => {
  const ajv = new Ajv2020({ strict: false, formats: {
    'date-time': (v: string) => Number.isFinite(Date.parse(v)),
    uuid: (v: string) => uuidPattern.test(v),
  } });
  ajv.addSchema(read('ban-standard-definitions-v0.4.schema.json'));
  return { ajv, full: ajv.compile(read('ban-standard-full-v0.4.schema.json')),
    diff: ajv.compile(read('ban-standard-diff-v0.4.schema.json')) };
};
const streamValidator = (file: string) => spawnSync(process.execPath,
  [path.join(spec, 'scripts/validate-ban-ndjson.mjs'), path.join(fixtures, file)], { encoding: 'utf8' });
const cases = (type: 'address' | 'toponym') => {
  const { full, diff } = validators();
  const original = lines('ban-standard-full-v0.4.ndjson').find(row => row.type === type);
  const row = structuredClone(original);
  return [
    { name: 'full', row, states: [row.data], validate: full },
    ...['created', 'updated', 'disabled'].map(event => {
      const states = [structuredClone(original.data)];
      if (event === 'updated') states.push(structuredClone(original.data));
      if (event === 'disabled') states[0].status = 'disabled';
      return { name: event, row: { type, event, data: states }, states, validate: diff };
    }),
  ];
};

describe('BAN Standard v0.4 specification artifacts', () => {
  it.each(['ban-standard-full-v0.4.ndjson', 'ban-standard-diff-v0.4.ndjson',
    'ban-standard-created-disabled-v0.4.ndjson',
    ...['step-0_full-start', 'step-1_diff-first', 'step-2_full-middle', 'step-3_diff-second', 'step-4_full-end']
      .map(step => 'administrative/' + step + '.ban-standard.ndjson'),
  ])('validates each line and the complete stream of %s without the implementation', file => {
    const { full, diff, ajv } = validators();
    const rows = lines(file);
    const validate = rows[0].meta.exportType === 'diff' ? diff : full;
    for (const row of rows) expect(validate(row), ajv.errorsText(validate.errors)).toBe(true);
    const result = streamValidator(file);
    expect(result.status, result.stderr).toBe(0);
  });

  it.each(['ban-standard-diff-disabled-active.ndjson', 'ban-standard-diff-updated-single-state.ndjson',
    'ban-standard-full-address-mismatch.ndjson', 'ban-standard-diff-invalid-period.ndjson',
  ])('rejects invalid stream %s', file => expect(streamValidator('invalid/' + file).status).not.toBe(0));

  it('rejects an invalid format identifier in FULL/DIFF metadata', () => {
    const { full, diff } = validators();
    for (const [kind, validate] of [['full', full], ['diff', diff]] as const) {
      const start = structuredClone(lines('ban-standard-' + kind + '-v0.4.ndjson')[0]);
      start.meta.format = 'unsupported';
      expect(validate(start)).toBe(false);
    }
  });

  it('accepts absent numbers, zero and positive integers, rejects negative/non-integer values in every state', () => {
    for (const { name, row, states, validate } of cases('address')) {
      for (const number of [undefined, 0, 1, 42]) {
        for (const state of states) {
          if (number === undefined) delete state.number;
          else state.number = number;
        }
        expect(validate(row), name).toBe(true);
      }
      for (const state of states) for (const number of [-1, -42, 0.5, '0', null]) {
        state.number = number;
        expect(validate(row), name + ': ' + number).toBe(false);
        state.number = 42;
      }
    }
  });

  it('allows null historical toponym geometry but requires a two-dimensional populated Point', () => {
    for (const { name, row, states, validate } of cases('toponym')) {
      for (const geometry of [null, { type: 'Point', coordinates: [-4.5, 47] }]) {
        for (const state of states) state.geometry = structuredClone(geometry);
        expect(validate(row), name).toBe(true);
      }
      for (const state of states) for (const geometry of [undefined, {}, { type: 'LineString', coordinates: [2, 48] },
        ...[[], [2], [2, 48, 0], [181, 47], [2, 91], ['2', 48], null].map(coordinates => ({ type: 'Point', coordinates }))]) {
        if (geometry === undefined) delete state.geometry;
        else state.geometry = geometry;
        expect(validate(row), name + ': ' + JSON.stringify(geometry)).toBe(false);
        state.geometry = { type: 'Point', coordinates: [-4.5, 47] };
      }
    }
  });

  it('requires populated two-dimensional address positions in FULL and every DIFF state', () => {
    for (const { name, row, states, validate } of cases('address')) {
      expect(validate(row), name).toBe(true);
      for (const state of states) {
        const geometry = state.positions[0].geometry;
        for (const invalid of [null, ...[[], [2], [2, 48, 0]].map(coordinates => ({ type: 'Point', coordinates }))]) {
          state.positions[0].geometry = invalid;
          expect(validate(row), name).toBe(false);
        }
        state.positions[0].geometry = geometry;
        const original = state.positions;
        state.positions = [];
        expect(validate(row)).toBe(false);
        state.positions = original;
      }
    }
  });

  it('allows empty address labels only, not absent/null/empty-valued label arrays', () => {
    const { full, diff } = validators();
    const rows = lines('ban-standard-full-v0.4.ndjson');
    const address = structuredClone(rows.find(row => row.type === 'address'));
    address.data.labels = [];
    expect(full(address)).toBe(true);
    delete address.data.labels;
    expect(full(address)).toBe(false);
    for (const invalid of [null, [{ value: '', isoCode: 'fra' }]]) {
      address.data.labels = invalid;
      expect(full(address)).toBe(false);
    }
    for (const type of ['district', 'toponym']) {
      const row = structuredClone(rows.find(row => row.type === type));
      row.data.labels = [];
      expect(full(row)).toBe(false);
    }
    for (const row of lines('ban-standard-diff-v0.4.ndjson').slice(1, -1)) {
      for (const state of row.data) state.labels = [];
      expect(diff(row)).toBe(true);
    }
  });

  it('documents every property occurrence, including references and identical French names', () => {
    let count = 0;
    const visit = (value: any) => {
      if (!value || typeof value !== 'object') return;
      for (const [key, property] of Object.entries(value.properties ?? {}) as [string, any][]) {
        expect(property.description, key).toContain('Équivalent conseillé pour un Standard-FR-CNIG :');
        expect(property.description, key).toContain('Correspondance conceptuelle CNIG :');
        if (['type', 'note', 'format', 'count', 'created', 'updated', 'disabled', 'positions', 'source', 'insee', 'interop', 'nodeKey'].includes(key)) {
          expect(property.description, key).toContain('Équivalent conseillé pour un Standard-FR-CNIG : ' + key + '.');
        }
        if (key === 'coordinates') expect(property.description).toContain('Équivalent conseillé pour un Standard-FR-CNIG : coordonnees.');
        count++;
      }
      for (const child of Object.values(value)) if (typeof child === 'object') visit(child);
    };
    for (const kind of ['definitions', 'full', 'diff']) visit(read('ban-standard-' + kind + '-v0.4.schema.json'));
    expect(count).toBe(133);
  });
});
