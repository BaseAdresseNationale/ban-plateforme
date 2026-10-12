import { describe, expect, it } from 'vitest';
import { getDiffObjLine, getSnapshotObjLine } from './ndjson-data-line.js';
import { banStandardFormatters } from './ban-standard-formatters.js';
import { streamCursorData } from './stream.js';
import type { DataType, RawEntity } from '../types.js';
const id = '11111111-1111-4111-8111-111111111111';
const oldDate = '2026-04-06T00:00:00Z';
const newDate = '2026-04-07T00:00:00Z';
const configs = banStandardFormatters;
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
describe('technical-only DIFF changes', () => {
  for (const type of ['district', 'toponym', 'address'] as const) {
    it(`${type}: excludes a computed-key-only change, with or without a timestamp change`, () => {
      const before = entity(type);
      const after = structuredClone(before);
      after.meta.interop.banComputedKey = 'nouvelle';
      const original = structuredClone([after, before]);
      expect(getDiffObjLine({ type, event: 'updated', datas: [after, before] }, configs)).toBeNull();
      expect([after, before]).toEqual(original);
      after.updateDate = newDate;
      expect(getDiffObjLine({ type, event: 'updated', datas: [after, before] }, configs)).toBeNull();
    });
    it(`${type}: excludes the appearance/disappearance of the computed key and empty interop container`, () => {
      const before = entity(type);
      const after = structuredClone(before);
      delete after.meta.interop;
      expect(getDiffObjLine({ type, event: 'updated', datas: [after, before] }, configs)).toBeNull();
      expect(getDiffObjLine({ type, event: 'updated', datas: [before, after] }, configs)).toBeNull();
      after.meta.interop = {};
      expect(getDiffObjLine({ type, event: 'updated', datas: [after, before] }, configs)).toBeNull();
    });
    it(`${type}: applies the same exclusion to the legacy input key path`, () => {
      const before = entity(type);
      delete before.meta.interop;
      before.meta.ban = { cleInteropBAN: 'ancienne' };
      const after = structuredClone(before);
      after.meta.ban.cleInteropBAN = 'nouvelle';
      after.updateDate = newDate;
      expect(getDiffObjLine({ type, event: 'updated', datas: [after, before] }, configs)).toBeNull();
    });
    it(`${type}: preserves a simultaneous label change and both unmodified payloads`, () => {
      const before = entity(type);
      const after = structuredClone(before);
      after.labels[0].value = 'Nouveau libellé';
      after.meta.interop.banComputedKey = 'nouvelle';
      after.updateDate = newDate;
      const result = getDiffObjLine({ type, event: 'updated', datas: [after, before] }, configs) as RawEntity | null;
      const bodyKey = 'data';
      expect(result).not.toBeNull();
      expect(result?.[bodyKey]).toEqual([after, before].map(data => (getSnapshotObjLine({ type, data }, configs) as RawEntity)?.[bodyKey]));
      expect(after.meta.interop.banComputedKey).toBe('nouvelle');
      expect(before.meta.interop.banComputedKey).toBe('ancienne');
    });
    it(`${type}: retains other metadata and integration-date corrections`, () => {
      const before = entity(type);
      for (const edit of [
        (after: RawEntity) => { after.meta.source = 'assemblage'; },
        (after: RawEntity) => { after.meta.interop.balProvidedKey = 'clé fournie'; },
        (after: RawEntity) => { after.meta.interop.legacyCsvId = 'identifiant historique'; },
        (after: RawEntity) => { after.integratedAt = newDate; },
        (after: RawEntity) => { after.isActive = false; },
      ]) {
        const after = structuredClone(before);
        edit(after);
        expect(getDiffObjLine({ type, event: 'updated', datas: [after, before] }, configs)).not.toBeNull();
      }
    });
    it(`${type}: never filters created/disabled events or strips keys from FULL`, () => {
      const before = entity(type);
      for (const event of ['created', 'disabled'] as const) {
        const after = { ...before, isActive: event !== 'disabled' };
        expect(getDiffObjLine({ type, event, datas: [after, null] }, configs)).not.toBeNull();
      }
      const full = getSnapshotObjLine({ type, data: before }, configs) as RawEntity;
      const state = full?.['data'];
      expect(state.meta.interop.banComputedKey).toBe('ancienne');
    });
    it(`${type}: keeps business geometry, references and address attributes`, () => {
      const before = entity(type);
      const edits: ((after: RawEntity) => void)[] = [
        after => { after.meta.insee.cog = '96002'; },
        after => { after.historicalDistrictID = '22222222-2222-4222-8222-222222222222'; },
      ];
      if (type === 'toponym')
        edits.push(after => { after.geometry = { type: 'Point', coordinates: [2, 48] }; }, after => { after.districtID = '22222222-2222-4222-8222-222222222222'; });
      if (type === 'address')
        edits.push(after => { after.number = 0; }, after => { after.suffix = 'bis'; }, after => { after.certified = true; }, after => { after.postalCodes = ['96000']; }, after => { after.positions[0].geometry.coordinates = [3, 48]; }, after => { after.mainToponymID = '22222222-2222-4222-8222-222222222222'; });
      for (const edit of edits) {
        const after = structuredClone(before);
        after.meta.interop.banComputedKey = 'nouvelle';
        after.updateDate = newDate;
        edit(after);
        expect(getDiffObjLine({ type, event: 'updated', datas: [after, before] }, configs)).not.toBeNull();
      }
    });
  }
  it(`district: excludes a configuration change with a changed timestamp, but keeps a simultaneous business change`, () => {
    const before = entity('district');
    const after = structuredClone(before);
    after.config = { logo: 'après', certificate: 'nouveau' };
    after.updateDate = newDate;
    expect(getDiffObjLine({ type: 'district', event: 'updated', datas: [after, before] }, configs)).toBeNull();
    after.labels[0].value = 'Commune renommée';
    expect(getDiffObjLine({ type: 'district', event: 'updated', datas: [after, before] }, configs)).not.toBeNull();
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
      output: { write: line => { lines.push(line); return true; }, once: () => { } },
    });
    expect(stats).toEqual({ count: 1, updated: 1 });
    expect(lines).toHaveLength(1);
  });
});
