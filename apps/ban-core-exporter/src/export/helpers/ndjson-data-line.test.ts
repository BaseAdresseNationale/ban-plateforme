import { Ajv2020 } from 'ajv/dist/2020.js';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { getBanStandardStartLine, getDiffObjLine, getSnapshotObjLine } from './ndjson-data-line.js';
import { banStandardFormatters } from './ban-standard-formatters.js';
import type { DataType, RawEntity } from '../types.js';

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

  it.each([null, undefined])('formats a created ban-standard toponym without a before-state (%s)', before => {
    expect(getDiffObjLine({
      event: 'created', type: 'toponym', nodeKey: `COMMON_TOPONYM:::${id}`,
      datas: before === undefined ? [toponym] : [toponym, before],
    }, banStandardFormatters)).toMatchObject({
      event: 'created', type: 'toponym',
      data: [{ id, geometry: { type: 'Point', coordinates: [2.35, 48.85] } }],
    });
  });

  it('keeps created ban-standard events with exactly one valid after-state', () => {
    const result = getDiffObjLine({ event: 'created', type: 'toponym', datas: [toponym, null] }, banStandardFormatters);
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

  it('preserves both ban-standard states for an updated toponym', () => {
    const before = { ...toponym, labels: [{ isoCode: 'fra', value: 'Ancien nom' }] };
    expect(getDiffObjLine({ event: 'updated', type: 'toponym', datas: [toponym, before] }, banStandardFormatters)).toMatchObject({
      event: 'updated', data: [
        { labels: [{ value: 'Rue des Lilas' }] },
        { labels: [{ value: 'Ancien nom' }] },
      ],
    });
  });

  it('still omits an updated event whose converted states are identical', () => {
    expect(getDiffObjLine({ event: 'updated', type: 'toponym', datas: [toponym, { ...toponym }] }, banStandardFormatters)).toBeNull();
  });

  it('filters empty translations in both states without creating a false update', () => {
    const after = { ...toponym, labels: [...toponym.labels, { isoCode: 'eus', value: '' }] };
    expect(getDiffObjLine({ event: 'updated', type: 'toponym', datas: [after, toponym] }, banStandardFormatters)).toBeNull();
    expect(getDiffObjLine({ event: 'created', type: 'toponym', datas: [after, null] }, banStandardFormatters)).toMatchObject({
      data: [{ labels: [{ isoCode: 'fra', value: 'Rue des Lilas' }] }],
    });
  });

  it('emits the disabled after-state in the v0.4 data array', () => {
    expect(getDiffObjLine({
      event: 'disabled',
      type: 'district',
      nodeKey: `DISTRICT:::${id}`,
      datas: [district(false), district(true)],
    }, banStandardFormatters)).toMatchObject({
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
    }, banStandardFormatters)).toMatchObject({
      event: 'updated',
      data: [{ status: 'disabled' }, { status: 'active' }],
    });
  });
});

describe('v0.4 effective request metadata', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const from = '2026-01-01T00:00:00.123456Z';
  const to = '2026-01-01T00:00:00.123457Z';
  const directory = path.resolve('specifications/ban-diff/v0.4/schemas');
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

describe('technical-only DIFF changes', () => {
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
});
