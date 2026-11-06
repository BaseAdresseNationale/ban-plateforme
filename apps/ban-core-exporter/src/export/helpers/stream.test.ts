import { describe, expect, it } from 'vitest';
import { streamCursorData } from './stream.js';
import { getDiffObjLine } from './ndjson-data-line.js';
import { banStandardFormatters } from './ban-standard-formatters.js';
import type { DataType, RawEntity } from '../types.js';

describe('streamCursorData', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const oldDate = '2026-04-06T00:00:00Z';
  const newDate = '2026-04-07T00:00:00Z';
  const entity = (type: DataType): RawEntity => ({
    id, labels: [{ isoCode: 'fra', value: 'Libellé fictif' }],
    isActive: true, updateDate: oldDate,
    meta: { insee: { cog: '96001' }, source: 'bal', interop: { banComputedKey: 'ancienne' } },
    ...(type === 'district' ? { config: { logo: 'avant' } } : {
      districtID: id,
      ...(type === 'toponym' ? { geometry: null } : {
        mainToponymID: id, secondaryToponymIDs: [], certified: false,
        positions: [{ type: 'entrance', geometry: { type: 'Point', coordinates: [2, 48] } }], postalCodes: [],
      }),
    }),
  });
  it(`district: counts emitted rows only after excluding a technical candidate`, async () => {
    const before = entity('district');
    const technical = structuredClone(before);
    technical.meta.interop.banComputedKey = 'nouvelle';
    technical.updateDate = newDate;
    const business = structuredClone(technical);
    business.labels[0].value = 'Changement métier';
    const rows = [technical, business].map(after => ({ candidate: JSON.stringify({
        type: 'district', event: 'updated', datas: [after, before],
      }) }));
    const cursor = { read: (_size: number, callback: (error: Error | null, batch: typeof rows) => void) => {
        const batch = rows.splice(0);
        callback(null, batch);
      } };
    const lines: string[] = [];
    const stats = await streamCursorData({
      cursor: cursor as Parameters<typeof streamCursorData>[0]['cursor'], fetchSize: 500,
      dataName: 'candidate', banFormatter: getDiffObjLine,
      output: { write: line => { lines.push(line); return true; } },
    });
    expect(stats).toEqual({ count: 1, updated: 1 });
    expect(lines).toHaveLength(1);
  });
});
