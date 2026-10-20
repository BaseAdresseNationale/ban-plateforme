import { describe, expect, it } from 'vitest';
import { normalizeExportDate, normalizeExportSelection } from '@ban/tools';

const id = '11111111-1111-4111-8111-111111111111';
const params = { dataTypes: ['address'], departements: ['96'], at: '2026-01-01T00:00:00.123456Z' };
describe('shared selection validation', () => {
  it('deduplicates IDs without mutating the request and resolves absent filters', () => {
    const raw = { ...params, address_ids: [id, id.toUpperCase()] };
    const effective = normalizeExportSelection('full', raw);
    expect(effective.address_ids).toEqual([id]);
    expect(raw.address_ids).toHaveLength(2);
    expect(effective.district_ids).toBeNull();
    expect(effective.at).toBe(params.at);
  });
  it('accepts individual and combined limits exactly', () => {
    expect(normalizeExportSelection('full', { ...params, address_ids: Array(1000).fill(id), district_ids: Array(1000).fill(id) }).address_ids).toEqual([id]);
  });
  it('checks received counts before deduplication', () => {
    expect(() => normalizeExportSelection('full', { ...params, address_ids: Array(1001).fill(id) })).toThrow('1000');
    expect(() => normalizeExportSelection('full', { ...params, address_ids: Array(1000).fill(id), district_ids: Array(1000).fill(id), common_toponym_ids: [id] })).toThrow('2000');
  });
  it.each([[], ['bad'], 'bad', [null], [42]])('rejects empty or malformed UUID selections (%j)', address_ids => {
    expect(() => normalizeExportSelection('full', { ...params, address_ids })).toThrow();
  });
  it('rejects unknown parameters and malformed other selectors', () => {
    for (const extra of [{ secret: 'x' }, { departements: ['invalid'] }, { departements: Array(201).fill('96') }, { dataTypes: ['unknown'] }]) {
      expect(() => normalizeExportSelection('full', { ...params, ...extra })).toThrow();
    }
  });
  it.each([null, []])('rejects a malformed request object (%j)', input => {
    expect(() => normalizeExportSelection('full', input)).toThrow('Export parameters must be an object');
  });
  it('preserves microseconds and converts offsets without rounding', () => {
    expect(normalizeExportDate('2026-01-01 01:00:00.123456+01')).toBe(params.at);
    expect(normalizeExportDate('2026-01-01')).toBe('2026-01-01T00:00:00.000Z');
    expect(normalizeExportSelection('diff', { ...params, at: undefined, from: params.at, to: '2026-01-01T00:00:00.123457Z' }).from).toBe(params.at);
  });
  it.each(['2026-02-30', '2026-01-01T25:00:00Z', '2026-01-01T00:00:00.1234567Z', 'invalid'])('rejects invalid dates %s', date => {
    expect(() => normalizeExportDate(date)).toThrow();
  });
  it('rejects empty/reversed diff windows and incompatible snapshot arguments', () => {
    expect(() => normalizeExportSelection('diff', { ...params, at: undefined, from: params.at, to: params.at })).toThrow('from < to');
    expect(() => normalizeExportSelection('full', { ...params, from: params.at })).toThrow();
  });
});
