import type { Request } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getFullExportRequestParams,
  getDiffExportRequestParams,
} from './request.js';

const requestConfig = {
  district: {},
  toponym: {},
  address: {},
};

const createRequest = (params: Request['params'], query: Request['query']) => ({
  params,
  query,
}) as Request;

describe('data export request parsing', () => {
  it('names any unsupported query parameter for FULL and DIFF without echoing its value', () => {
    for (const parse of [getFullExportRequestParams, getDiffExportRequestParams]) {
      const dates = parse === getFullExportRequestParams ? { at: '2026-05-04' } : { from: '2026-05-04' };
      for (const name of ['unexpected', 'dataType', 'format', 'address_ids', 'common_toponym_ids', 'district_ids']) {
        expect(parse(createRequest({ dep: '31' }, { dataTypes: 'address', ...dates, [name]: 'private-value' }), requestConfig))
          .toEqual({ ok: false, status: 400, message: `Unsupported query parameter: ${name}` });
      }
    }
  });

  it.each(['from', 'to'])('rejects the DIFF parameter %s on a FULL request', name => {
    expect(getFullExportRequestParams(createRequest({ dep: '31' }, { [name]: '2026-05-04' }), requestConfig))
      .toEqual({ ok: false, status: 400, message: `Unsupported query parameter: ${name}` });
  });

  it('rejects the FULL parameter at on a DIFF request', () => {
    expect(getDiffExportRequestParams(createRequest({ dep: '31' }, { from: '2026-05-04', at: '2026-05-11' }), requestConfig))
      .toEqual({ ok: false, status: 400, message: 'Unsupported query parameter: at' });
  });

  it('preserves the department fallback and gives precedence to the path department', () => {
    for (const parse of [getFullExportRequestParams, getDiffExportRequestParams]) {
      const dates = parse === getFullExportRequestParams ? { at: '2026-05-04' } : { from: '2026-05-04' };
      expect(parse(createRequest({}, { deps: '96', dataTypes: 'address', ...dates }), requestConfig))
        .toMatchObject({ ok: true, params: { departements: ['96'], dataTypes: ['address'] } });
      expect(parse(createRequest({ dep: '31' }, { deps: '96', dataTypes: 'address', ...dates }), requestConfig))
        .toMatchObject({ ok: true, params: { departements: ['31'], dataTypes: ['address'] } });
    }
  });

  it('preserves microseconds through HTTP request parsing', () => {
    const result = getDiffExportRequestParams({ params: { dep: '96' }, query: {
      from: '2026-01-01T00:00:00.123456Z', to: '2026-01-01T00:00:00.123457Z',
    } } as any, { address: {} });
    expect(result).toMatchObject({ ok: true, params: {
      from: '2026-01-01T00:00:00.123456Z', to: '2026-01-01T00:00:00.123457Z',
      address_ids: null, district_ids: null, common_toponym_ids: null,
    } });
  });
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses FULL export request parameters', () => {
    const result = getFullExportRequestParams(
      createRequest(
        { dep: '33' },
        { at: '2026-01-01', dataTypes: 'district,address' }
      ),
      requestConfig
    );

    expect(result).toEqual({
      ok: true,
      params: {
        at: '2026-01-01T00:00:00.000Z',
        address_ids: null,
        common_toponym_ids: null,
        district_ids: null,
        departements: ['33'],
        dataTypes: ['district', 'address'],
      },
    });
  });

  it('parses ISO 8601 date-times for FULL and differential export requests', () => {
    const fullResult = getFullExportRequestParams(
      createRequest({ dep: '33' }, { at: '2026-01-01T12:00:00Z' }),
      requestConfig
    );
    const diffResult = getDiffExportRequestParams(
      createRequest(
        { dep: '33' },
        { from: '2026-01-01T12:00:00Z', to: '2026-01-31T12:00:00Z' }
      ),
      requestConfig
    );

    expect(fullResult).toMatchObject({
      ok: true,
      params: { at: '2026-01-01T12:00:00.000Z' },
    });
    expect(diffResult).toMatchObject({
      ok: true,
      params: {
        from: '2026-01-01T12:00:00.000Z',
        to: '2026-01-31T12:00:00.000Z',
      },
    });
  });

  it('uses the current date for FULL export requests without snapshot date', () => {
    const result = getFullExportRequestParams(
      createRequest({ dep: '33' }, {}),
      requestConfig
    );

    expect(result).toMatchObject({
      ok: true,
      params: {
        at: '2026-07-30T12:00:00.000Z',
      },
    });
  });

  it('parses differential export request parameters', () => {
    const result = getDiffExportRequestParams(
      createRequest(
        { dep: '33' },
        { from: '2026-01-01', to: '2026-01-31', dataTypes: 'district,toponym' }
      ),
      requestConfig
    );

    expect(result).toEqual({
      ok: true,
      params: {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T00:00:00.000Z',
        address_ids: null,
        common_toponym_ids: null,
        district_ids: null,
        departements: ['33'],
        dataTypes: ['district', 'toponym'],
      },
    });
  });

  it('uses the current date for differential export requests without end date', () => {
    const result = getDiffExportRequestParams(
      createRequest(
        { dep: '33' },
        { from: '2026-01-01' }
      ),
      requestConfig
    );

    expect(result).toMatchObject({
      ok: true,
      params: {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-07-30T12:00:00.000Z',
      },
    });
  });

  it('explains that dates and date-times are accepted for invalid date parameters', () => {
    const expectedMessage = 'Expected an ISO 8601 date or date-time (e.g. 2026-01-01 or 2026-01-01T12:00:00Z).';
    const invalidAt = getFullExportRequestParams(
      createRequest({ dep: '33' }, { at: 'invalid' }),
      requestConfig
    );
    const invalidFrom = getDiffExportRequestParams(
      createRequest({ dep: '33' }, { from: 'invalid' }),
      requestConfig
    );
    const invalidTo = getDiffExportRequestParams(
      createRequest({ dep: '33' }, { from: '2026-01-01', to: 'invalid' }),
      requestConfig
    );

    expect(invalidAt).toMatchObject({
      ok: false,
      status: 400,
      message: `Invalid date format for 'at' parameter. ${expectedMessage}`,
    });
    expect(invalidFrom).toMatchObject({
      ok: false,
      status: 400,
      message: `Invalid date format for 'from' parameter. ${expectedMessage}`,
    });
    expect(invalidTo).toMatchObject({
      ok: false,
      status: 400,
      message: `Invalid date format for 'to' parameter. ${expectedMessage}`,
    });
  });
});
