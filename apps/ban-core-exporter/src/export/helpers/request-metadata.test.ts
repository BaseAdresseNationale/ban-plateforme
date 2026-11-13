import { Ajv2020 } from 'ajv/dist/2020.js';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getBanStandardStartLine } from './ndjson-data-line.js';
const id = '11111111-1111-4111-8111-111111111111';
const from = '2026-01-01T00:00:00.123456Z';
const to = '2026-01-01T00:00:00.123457Z';
const directory = path.resolve('specifications/ban-diff/v0.4/schemas');
describe('v0.4 effective request metadata', () => {
  for (const type of ['full', 'diff']) {
    const start = getBanStandardStartLine;
    const ajv = new Ajv2020({ strict: false, formats: {
        uuid: (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v),
        'date-time': (v: string) => Number.isFinite(Date.parse(v)),
      } });
    const read = (name: string) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
    ajv.addSchema(read(`ban-standard-definitions-v0.4.schema.json`));
    const validate = ajv.compile(read(`ban-standard-${type}-v0.4.schema.json`));
    const make = (filters = false) => JSON.parse(start(type, {
      departements: ['96'], at: from, from, to,
      ...(filters ? { address_ids: [id], common_toponym_ids: [id], district_ids: [id] } : {}),
    }, ['address']));
    it.each([false, true])(`${type} validates request with filters=%s`, filters => {
      const row = make(filters);
      expect(validate(row), ajv.errorsText(validate.errors)).toBe(true);
      const meta = row['meta'];
      const request = meta['request'];
      expect(request[(type === 'full' ? 'at' : 'from')]).toBe(from);
      expect(meta).not.toHaveProperty('departments');
      expect(request['addressIds']).toEqual(filters ? [id] : undefined);
    });
    it(`${type} rejects invalid UUIDs and unknown properties`, () => {
      const row = make(true);
      const request = row['meta']['request'];
      request['addressIds'] = ['not-a-uuid'];
      expect(validate(row)).toBe(false);
      request['addressIds'] = [id];
      request.secret = 'not-allowed';
      expect(validate(row)).toBe(false);
      delete request.secret;
      delete row['meta']['request'];
      expect(validate(row)).toBe(false);
    });
  }
});
