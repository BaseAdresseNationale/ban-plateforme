import type { Request } from 'express';
import { normalizeExportSelection } from '@ban/tools';

import {
  VALID_DATA_TYPES,
  dateStringToPgTimestamptz,
} from '../helpers/index.js';

import type { DataExportRequestParams } from './enqueue.js';

type RequestConfig = Record<string, unknown>;
type CommonExportRequestParams = Omit<DataExportRequestParams, 'at' | 'from' | 'to'>;

type ExportRequestParamsResult =
  | { ok: true; params: DataExportRequestParams }
  | { ok: false; status: 400; message: string };

type CommonExportRequestParamsResult =
  | { ok: true; params: CommonExportRequestParams }
  | { ok: false; status: 400; message: string };

const ISO_8601_DATE_MESSAGE = 'Expected an ISO 8601 date or date-time (e.g. 2026-01-01 or 2026-01-01T12:00:00Z).';

const QUERY_PARAMETERS = {
  full: ['deps', 'dataTypes', 'at'],
  diff: ['deps', 'dataTypes', 'from', 'to'],
};

const validateSelection = (type: 'full' | 'diff', params: DataExportRequestParams): ExportRequestParamsResult => {
  try { return { ok: true, params: normalizeExportSelection(type, params) }; }
  catch (error) { return { ok: false, status: 400, message: error instanceof Error ? error.message : 'Invalid export selection' }; }
};

const getDepartements = (req: Request) => String(req.params.dep || req.query.deps || '')
  .split(',')
  .filter(Boolean)
  .map(dep => dep.trim());

const getDataTypes = (queryDataTypes: string | undefined, requestConfig: RequestConfig) => {
  if (!queryDataTypes) {
    return Object.keys(requestConfig);
  }

  return queryDataTypes
    .split(',')
    .map(item => item.trim())
    .filter(item => VALID_DATA_TYPES.includes(item));
};

const getCommonExportRequestParams = (
  req: Request,
  requestConfig: RequestConfig,
  exportType: 'full' | 'diff'
): CommonExportRequestParamsResult => {
  const unsupportedParameter = Object.keys(req.query)
    .find(name => !QUERY_PARAMETERS[exportType].includes(name));
  if (unsupportedParameter !== undefined) {
    return {
      ok: false,
      status: 400,
      message: `Unsupported query parameter: ${unsupportedParameter}`,
    };
  }

  const departements = getDepartements(req);
  const queryDataTypes = req.query.dataTypes ? String(req.query.dataTypes) : undefined;

  if (departements.length === 0) {
    return { ok: false, status: 400, message: 'The `deps` parameter is required.' };
  }

  if (queryDataTypes) {
    const requestedDataTypes = queryDataTypes.split(',').map(item => item.trim());
    if (requestedDataTypes.some(dataType => !VALID_DATA_TYPES.includes(dataType))) {
      return {
        ok: false,
        status: 400,
        message: `Invalid 'dataTypes' value: ${queryDataTypes} (available values: ${VALID_DATA_TYPES.join(', ')})`,
      };
    }
  }

  return {
    ok: true,
    params: {
      address_ids: null,
      common_toponym_ids: null,
      district_ids: null,
      departements,
      dataTypes: getDataTypes(queryDataTypes, requestConfig),
    },
  };
};

export const getFullExportRequestParams = (
  req: Request,
  requestConfig: RequestConfig
): ExportRequestParamsResult => {
  const commonParams = getCommonExportRequestParams(req, requestConfig, 'full');

  if (!commonParams.ok) {
    return commonParams;
  }

  const at = dateStringToPgTimestamptz(
    typeof req.query.at === 'string' ? req.query.at : new Date().toISOString()
  );

  if (at === 'Invalid date') {
    return { ok: false, status: 400, message: `Invalid date format for 'at' parameter. ${ISO_8601_DATE_MESSAGE}` };
  }

  return validateSelection('full', { ...commonParams.params, at });
};

export const getDiffExportRequestParams = (
  req: Request,
  requestConfig: RequestConfig
): ExportRequestParamsResult => {
  const commonParams = getCommonExportRequestParams(req, requestConfig, 'diff');

  if (!commonParams.ok) {
    return commonParams;
  }

  const from = dateStringToPgTimestamptz(req.query.from as string | undefined);
  if (!from) {
    return { ok: false, status: 400, message: 'The `from` parameter is required.' };
  }

  if (from === 'Invalid date') {
    return { ok: false, status: 400, message: `Invalid date format for 'from' parameter. ${ISO_8601_DATE_MESSAGE}` };
  }

  const to = dateStringToPgTimestamptz(
    typeof req.query.to === 'string' ? req.query.to : new Date().toISOString()
  );

  if (to === 'Invalid date') {
    return { ok: false, status: 400, message: `Invalid date format for 'to' parameter. ${ISO_8601_DATE_MESSAGE}` };
  }

  return validateSelection('diff', { ...commonParams.params, from, to });
};
