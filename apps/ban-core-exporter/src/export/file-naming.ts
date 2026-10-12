import { BAN_EXPORT_FORMAT } from '@ban/tools';

import type { DataExportParams, DataExportType } from './types.js';

// Explicit timezone: neither the worker's timezone nor the generation date
// should change the name or the S3 reference month.
const parisDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  timeZoneName: 'longOffset',
});

const getParisParts = (value: string | null | undefined) => {
  if (!value || !Number.isFinite(Date.parse(value))) {
    throw new Error('A valid reference date is required to name an export');
  }
  const parts = Object.fromEntries(parisDate.formatToParts(new Date(value))
    .map(part => [part.type, part.value]));
  // Preserve PostgreSQL microseconds, which JavaScript Date truncates.
  const fraction = (value.match(/\.(\d{1,6})(?:Z|[+-]\d{2}(?::?\d{2})?)$/)?.[1] ?? '')
    .replace(/0+$/, '');
  return { date: `${parts.year}-${parts.month}-${parts.day}`, fraction,
    hour: parts.hour, minute: parts.minute, second: parts.second, timeZoneName: parts.timeZoneName };
};

const getDateLabel = (value: string | null | undefined) => {
  const parts = getParisParts(value);
  if (parts.hour === '00' && parts.minute === '00' && parts.second === '00' && !parts.fraction) {
    return parts.date;
  }
  // Offset disambiguates the repeated hour when daylight saving time ends.
  const offset = parts.timeZoneName.replace('GMT', '').replace(':', '') || '+0000';
  return `${parts.date}T${parts.hour}-${parts.minute}-${parts.second}${parts.fraction ? `-${parts.fraction}` : ''}${offset}`;
};

const getScopeLabel = (params: DataExportParams) => {
  if (params.departements.some(code => !/^(?:\d{2,3}|2[AB])$/.test(code))) {
    throw new Error('Invalid department code for export filename');
  }
  // Do not describe an UUID-filtered subset as a full departmental export.
  if ([params.address_ids, params.common_toponym_ids, params.district_ids].some(ids => ids?.length)) {
    return 'selection';
  }
  const departments = [...new Set(params.departements)];
  if (departments.length === 1) return `dep-${departments[0]}`;
  return departments.length === 0 ? 'france' : 'selection';
};

/** Parameters have already been validated/normalised by the export generator. */
export const getExportFileName = (token: string, exportType: DataExportType, params: DataExportParams) => {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(token)) throw new Error('Invalid export token for filename');
  const dates = exportType === 'full'
    ? getDateLabel(params.at)
    : `${getDateLabel(params.from)}_${getDateLabel(params.to)}`;
  return `${exportType}--${getScopeLabel(params)}--${dates}--${token}.${BAN_EXPORT_FORMAT}.ndjson`;
};

/** DIFF uses its upper bound, not its creation date or lower bound. */
export const getExportReferenceMonth = (exportType: DataExportType, params: DataExportParams) =>
  getParisParts(exportType === 'full' ? params.at : params.to).date.slice(0, 7);
