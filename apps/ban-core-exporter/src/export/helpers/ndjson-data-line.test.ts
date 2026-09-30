import { describe, expect, it } from 'vitest';

import { getDiffObjLine } from './ndjson-data-line.js';
import { rawFormatters } from './raw-formatters.js';

const id = '11111111-1111-4111-8111-111111111111';

const district = (isActive: boolean) => ({
  id,
  labels: [{ isoCode: 'fra', value: 'Bordeaux' }],
  isActive,
  updateDate: '2026-01-15T00:00:00.000Z',
  meta: { insee: { cog: '33063' }, source: 'bal' },
});

describe('getDiffObjLine', () => {
  it('emits the disabled after-state in the v0.4 data array', () => {
    expect(getDiffObjLine({
      event: 'disabled',
      type: 'district',
      nodeKey: `DISTRICT:::${id}`,
      datas: [district(false), district(true)],
    }, rawFormatters)).toMatchObject({
      event: 'disabled',
      type: 'district',
      nodeKey: `DISTRICT:::${id}`,
      data: [{ id, status: 'disabled' }],
    });
  });

  it('keeps updated states in after, before order under data', () => {
    expect(getDiffObjLine({
      event: 'updated',
      type: 'district',
      nodeKey: `DISTRICT:::${id}`,
      datas: [district(false), district(true)],
    }, rawFormatters)).toMatchObject({
      event: 'updated',
      data: [{ status: 'disabled' }, { status: 'active' }],
    });
  });
});
