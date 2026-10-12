import { describe, expect, it } from 'vitest';

import { banStandardFormatters, toBanStandardEntity } from './ban-standard-formatters.js';
import { getDiffObjLine, getSnapshotObjLine } from './ndjson-data-line.js';

const id = '11111111-1111-4111-8111-111111111111';
const header = { type: 'address' as const, meta: { insee: { cog: '75056' } } };
const address = {
  id, districtID: id, mainCommonToponymID: id, secondaryCommonToponymIDs: [],
  labels: [], certified: true, positions: [{ type: 'entrance', geometry: { type: 'Point', coordinates: [2.35, 48.85] } }],
  isActive: true, updateDate: '2026-01-15T00:00:00Z',
  meta: { bal: { dateRevision: '2026-01-14T00:00:00Z' } },
};
const toponym = { ...address, labels: [{ isoCode: 'fra', value: 'Rue des Lilas' }], geometry: null };

describe('ban-standard business serialization', () => {
  it.each(['district', 'toponym', 'address'] as const)('uses the envelope INSEE fallback for %s', type => {
    const entity = type === 'address' ? address : toponym;
    expect(toBanStandardEntity({ ...header, type }, entity).meta.insee.cog).toBe('75056');
    expect(toBanStandardEntity({ ...header, type }, { ...entity, meta: { insee: { cog: '31001' } } }).meta.insee.cog).toBe('31001');
  });

  it.each([undefined, null, ''])('omits absent/empty suffix %s without mutating the input', suffix => {
    const entity = { ...address, suffix };
    expect(toBanStandardEntity(header, entity)).not.toHaveProperty('suffix');
    expect(entity.suffix).toBe(suffix);
  });
  it.each(['bis', 'ter', 'A'])('preserves suffix %s', suffix => {
    expect(toBanStandardEntity(header, { ...address, suffix }).suffix).toBe(suffix);
  });

  it('filters empty translations, preserves populated languages and their order', () => {
    const labels = [{ isoCode: 'eus', value: '' }, { isoCode: 'fra', value: 'Maison' },
      { isoCode: 'hyl', value: null }, { isoCode: 'eng', value: 'House' }, { isoCode: 'bre' }];
    const entity = { ...address, labels };
    const before = structuredClone(entity);
    expect(toBanStandardEntity(header, entity).labels).toEqual([labels[1], labels[3]]);
    expect(entity).toEqual(before);
  });
  it.each([undefined, null, [], [{ isoCode: 'fra', value: '' }], [{ isoCode: 'fra', value: null }], [{ isoCode: 'fra' }]]
    .map(labels => ({ labels })))('keeps an address without populated labels ($labels)', ({ labels }) => {
    expect(toBanStandardEntity(header, { ...address, labels }).labels).toEqual([]);
  });
  it.each(['district', 'toponym'] as const)('still rejects missing populated labels on %s', type => {
    expect(() => toBanStandardEntity({ ...header, type }, { ...toponym, labels: [] })).toThrow('No populated label');
  });

  it('preserves null geometry without dropping or mutating a toponym', () => {
    const input = structuredClone(toponym);
    const row = getSnapshotObjLine({ ...header, type: 'toponym', data: input }, banStandardFormatters);
    expect(row).toMatchObject({ type: 'toponym', data: { id, geometry: null } });
    expect(input).toEqual(toponym);
  });
  it.each(['created', 'disabled', 'updated'] as const)('preserves null toponym geometry in all %s states', event => {
    const before = { ...toponym, labels: [{ isoCode: 'fra', value: 'Ancien nom' }] };
    const row = getDiffObjLine({ ...header, type: 'toponym', event, datas: [toponym, before] }, banStandardFormatters);
    expect(row?.data).toHaveLength(event === 'updated' ? 2 : 1);
    expect(row?.data.every(state => state?.geometry === null)).toBe(true);
  });
  it('preserves an explicitly populated Point without changing coordinates', () => {
    const geometry = { type: 'Point', coordinates: [2.35, 48.85] };
    expect(toBanStandardEntity({ ...header, type: 'toponym' }, { ...toponym, geometry }).geometry).toEqual(geometry);
  });

  it('preserves disabled normalized status, but prioritizes explicit database activity', () => {
    const normalized = toBanStandardEntity(header, { ...address, isActive: false });
    expect(normalized).not.toHaveProperty('isActive');
    expect(toBanStandardEntity(header, normalized).status).toBe('disabled');
    expect(toBanStandardEntity(header, { ...address, isActive: true, status: 'disabled' }).status).toBe('active');
    expect(toBanStandardEntity(header, { ...address, isActive: false, status: 'active' }).status).toBe('disabled');
  });
});

describe('explicit first integration date, never a BAL revision fallback', () => {
  it.each([undefined, null])('exports null for an unknown first integration (%s), even with a BAL revision', integratedAt => {
    const entity = { ...address, integratedAt };
    const before = structuredClone(entity);
    expect(toBanStandardEntity(header, entity).integratedAt).toBeNull();
    expect(entity).toEqual(before);
    expect(getSnapshotObjLine({ ...header, data: entity })?.data.integratedAt).toBeNull();
  });

  it('preserves the explicitly supplied date in preference to a later revision', () => {
    const integratedAt = '2025-01-01T00:00:00.123456Z';
    const entity = { ...address, integratedAt };
    const result = toBanStandardEntity(header, entity);
    expect(result.integratedAt).toBe(integratedAt);
    expect(toBanStandardEntity(header, result).integratedAt).toBe(integratedAt);
  });

  it('does not invent an integration-date difference from BAL revisions alone', () => {
    const after = { ...address, meta: { bal: { dateRevision: '2026-02-01T00:00:00Z' } } };
    expect(getDiffObjLine({ ...header, event: 'updated', datas: [after, address] })).toBeNull();
  });

  it('preserves known/unknown first integration in both updated states and emits a real correction', () => {
    const after = { ...address, integratedAt: '2025-01-01T00:00:00.123456Z' };
    const row = getDiffObjLine({ ...header, event: 'updated', datas: [after, address] });
    expect(row?.data.map(state => state?.integratedAt)).toEqual([after.integratedAt, null]);
  });
  it.each(['created', 'disabled'] as const)('uses no revision fallback in a %s after-state', event => {
    const row = getDiffObjLine({ ...header, event, datas: [{ ...address, isActive: event !== 'disabled' }, null] });
    expect(row?.data).toHaveLength(1);
    expect(row?.data[0]?.integratedAt).toBeNull();
  });
});
