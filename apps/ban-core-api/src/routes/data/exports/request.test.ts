import type { Request } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getBanExportRequestParams,
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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses BAN export request parameters', () => {
    const result = getBanExportRequestParams(
      createRequest(
        { dep: '33' },
        { at: '2026-01-01', format: 'raw', dataTypes: 'district,address' }
      ),
      requestConfig
    );

    expect(result).toEqual({
      ok: true,
      params: {
        at: '2026-01-01T00:00:00.000Z',
        format: 'raw',
        address_ids: null,
        common_toponym_ids: null,
        district_ids: null,
        departements: ['33'],
        dataTypes: ['district', 'address'],
      },
    });
  });

  it('uses the current date for BAN export requests without snapshot date', () => {
    const result = getBanExportRequestParams(
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
        { from: '2026-01-01', to: '2026-01-31', format: 'ban', dataTypes: 'district,toponym' }
      ),
      requestConfig
    );

    expect(result).toEqual({
      ok: true,
      params: {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T00:00:00.000Z',
        format: 'ban',
        address_ids: null,
        common_toponym_ids: null,
        district_ids: null,
        departements: ['33'],
        dataTypes: ['district', 'toponym'],
      },
    });
  });

  it('rejects invalid export formats', () => {
    const result = getDiffExportRequestParams(
      createRequest(
        { dep: '33' },
        { from: '2026-01-01', to: '2026-01-31', format: 'xml' }
      ),
      requestConfig
    );

    expect(result).toEqual({
      ok: false,
      status: 400,
      message: "Invalid 'format' value: xml (available values: raw, ban, standard-fr, standard-fr-int)",
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
});
