import { describe, expect, it } from 'vitest';

import { normalizeExportSelection } from '@ban/tools';

import { getExportFileName, getExportReferenceMonth } from './file-naming.js';
import type { DataExportParams } from './types.js';

const params: DataExportParams = {
   dataTypes: ['district', 'toponym', 'address'], departements: ['31'],
  address_ids: null, common_toponym_ids: null, district_ids: null,
  at: '2026-05-31T22:00:00.000Z',
};
const diffParams: DataExportParams = {
  ...params, at: undefined, from: '2026-05-03T22:00:00Z', to: '2026-05-10T22:00:00Z',
};

describe('export filenames and reference month', () => {
  it('names a snapshot at midnight Paris on the following UTC calendar day', () => {
    expect(getExportFileName('job_1-Ab', 'full', params)).toBe('full--dep-31--2026-06-01--job_1-Ab.ban-standard.ndjson');
    expect(getExportReferenceMonth('full', params)).toBe('2026-06');
  });

  it('names a successive weekly DIFF from both Paris bounds', () => {
    expect(getExportFileName('job', 'diff', diffParams)).toBe('diff--dep-31--2026-05-04_2026-05-11--job.ban-standard.ndjson');
    expect(getExportReferenceMonth('diff', diffParams)).toBe('2026-05');
  });

  it('files a month-crossing DIFF under its upper bound, including an exclusive bound', () => {
    expect(getExportReferenceMonth('diff', { ...diffParams, from: '2026-05-25T00:00:00+02:00', to: '2026-06-01T00:00:00+02:00' })).toBe('2026-06');
  });

  it.each(['2A', '2B', '971', '96'])('retains department code %s', code => {
    expect(getExportFileName('job', 'full', { ...params, departements: [code] })).toBe(`full--dep-${code}--2026-06-01--job.ban-standard.ndjson`);
  });

  it('treats duplicate departments as one scope', () => {
    expect(getExportFileName('job', 'full', { ...params, departements: ['31', '31'] })).toContain('--dep-31--');
  });

  it('uses a bounded selection label for multiple departments and internal UUID filters', () => {
    for (const selection of [
      { departements: ['31', '32'] },
      { address_ids: ['11111111-1111-4111-8111-111111111111'] },
      { common_toponym_ids: ['11111111-1111-4111-8111-111111111111'] },
      { district_ids: ['11111111-1111-4111-8111-111111111111'] },
    ]) expect(getExportFileName('job', 'full', { ...params, ...selection })).toContain('--selection--');
    expect(getExportFileName('job', 'full', { ...params, departements: [] })).toContain('--france--');
  });

  it('disambiguates identical requests by their job token', () => {
    expect(getExportFileName('one', 'full', params)).not.toBe(getExportFileName('two', 'full', params));
  });

  it('retains time, offset and PostgreSQL microseconds away from midnight', () => {
    const precise = normalizeExportSelection('full', { ...params, at: '2026-06-01T00:00:00.000001+02:00' });
    expect(getExportFileName('job', 'full', precise)).toBe('full--dep-31--2026-06-01T00-00-00-000001+0200--job.ban-standard.ndjson');
    expect(getExportFileName('job', 'full', { ...params, at: '2026-06-01T12:34:56.123456Z' }))
      .toBe('full--dep-31--2026-06-01T14-34-56-123456+0200--job.ban-standard.ndjson');
  });

  it('distinguishes the repeated hour at the end of daylight saving time', () => {
    expect(getExportFileName('job', 'full', { ...params, at: '2026-10-25T00:30:00Z' }))
      .toBe('full--dep-31--2026-10-25T02-30-00+0200--job.ban-standard.ndjson');
    expect(getExportFileName('job', 'full', { ...params, at: '2026-10-25T01:30:00Z' }))
      .toBe('full--dep-31--2026-10-25T02-30-00+0100--job.ban-standard.ndjson');
  });

  it('handles winter midnight and the spring time change', () => {
    expect(getExportFileName('job', 'full', { ...params, at: '2025-12-31T23:00:00Z' }))
      .toBe('full--dep-31--2026-01-01--job.ban-standard.ndjson');
    expect(getExportFileName('job', 'full', { ...params, at: '2026-03-29T01:30:00Z' }))
      .toBe('full--dep-31--2026-03-29T03-30-00+0200--job.ban-standard.ndjson');
  });

  it.each(['../outside', 'a/b', 'a\\b', '.', '', 'x'.repeat(129)])('rejects unsafe token %s', token => {
    expect(() => getExportFileName(token, 'full', params)).toThrow('Invalid export token');
  });

  it('rejects unsafe department components and missing reference dates', () => {
    expect(() => getExportFileName('job', 'full', { ...params, departements: ['../31'] })).toThrow('Invalid department');
    expect(() => getExportFileName('job', 'full', { ...params, at: undefined })).toThrow('reference date');
    expect(() => getExportReferenceMonth('diff', { ...diffParams, to: 'invalid' })).toThrow('reference date');
  });
});
