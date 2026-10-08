import { describe, expect, it, vi } from 'vitest';

import { getDiffObjLine } from './ndjson-data-line.js';
import { rawFormatters } from './raw-formatters.js';
import { standardFrFormatters } from './standard-fr-formatters.js';

const id = '11111111-1111-4111-8111-111111111111';

const district = (isActive: boolean) => ({
  id,
  labels: [{ isoCode: 'fra', value: 'Bordeaux' }],
  isActive,
  updateDate: '2026-01-15T00:00:00.000Z',
  meta: { insee: { cog: '33063' }, source: 'bal' },
});

describe('getDiffObjLine', () => {
  const toponym = {
    id,
    districtID: '22222222-2222-4222-8222-222222222222',
    labels: [{ isoCode: 'fra', value: 'Rue des Lilas' }],
    geometry: { type: 'Point', coordinates: [2.35, 48.85] },
    isActive: true,
    updateDate: '2026-01-15T00:00:00.000Z',
    meta: { insee: { cog: '33063' } },
  };

  it.each([null, undefined])('formats a created Standard FR toponym without a before-state (%s)', before => {
    expect(getDiffObjLine({
      event: 'created', type: 'toponym', nodeKey: `COMMON_TOPONYM:::${id}`,
      datas: before === undefined ? [toponym] : [toponym, before],
    }, standardFrFormatters)).toMatchObject({
      evenement: 'created', type: 'odonyme',
      donnees: [{ idOdonyme: id, geometrie: { type: 'Point', coordonnees: [2.35, 48.85] } }],
    });
  });

  it('keeps created Raw events with exactly one valid after-state', () => {
    const result = getDiffObjLine({ event: 'created', type: 'toponym', datas: [toponym, null] }, rawFormatters);
    expect(result).toMatchObject({ event: 'created', type: 'toponym', data: [{ id, status: 'active' }] });
    expect(result && 'data' in result ? result.data : undefined).toHaveLength(1);
  });

  it('does not convert the unused before-state for a disabled event', () => {
    const converter = vi.fn((_header, raw) => raw);
    const formater = vi.fn((_header, raw) => raw);
    const after = district(false);
    getDiffObjLine({ event: 'disabled', type: 'district', datas: [after, district(true)] }, { district: { converter, formater } });
    expect(converter).toHaveBeenCalledTimes(1);
    expect(converter.mock.calls[0][1]).toBe(after);
    expect(formater).toHaveBeenCalledTimes(1);
  });

  it('preserves both Standard FR states for an updated toponym', () => {
    const before = { ...toponym, labels: [{ isoCode: 'fra', value: 'Ancien nom' }] };
    expect(getDiffObjLine({ event: 'updated', type: 'toponym', datas: [toponym, before] }, standardFrFormatters)).toMatchObject({
      evenement: 'updated', donnees: [
        { libelles: [{ valeur: 'Rue des Lilas' }] },
        { libelles: [{ valeur: 'Ancien nom' }] },
      ],
    });
  });

  it('still omits an updated event whose converted states are identical', () => {
    expect(getDiffObjLine({ event: 'updated', type: 'toponym', datas: [toponym, { ...toponym }] }, standardFrFormatters)).toBeNull();
  });

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
