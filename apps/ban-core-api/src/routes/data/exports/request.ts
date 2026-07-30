import type { Request } from 'express';

import {
  VALID_DATA_TYPES,
  VALID_FORMATS,
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

const getDepartements = (req: Request) => String(req.params.dep || req.query.deps || '')
  .split(',')
  .filter(Boolean)
  .map(dep => dep.trim());

const getFormat = (queryFormat: string | null) => {
  if (!queryFormat) {
    return 'raw';
  }

  return VALID_FORMATS.includes(queryFormat) ? queryFormat : undefined;
};

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
  requestConfig: RequestConfig
): CommonExportRequestParamsResult => {
  const departements = getDepartements(req);
  const queryFormat = String(typeof req.query.format === 'string' ? req.query.format : 'raw');
  const queryDataTypes = req.query.dataTypes ? String(req.query.dataTypes) : undefined;

  if (departements.length === 0) {
    return { ok: false, status: 400, message: 'The `deps` parameter is required.' };
  }

  const format = getFormat(queryFormat);
  if (!format) {
    return {
      ok: false,
      status: 400,
      message: `Invalid 'format' value: ${queryFormat} (available values: ${VALID_FORMATS.join(', ')})`,
    };
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
      format,
      address_ids: null,
      common_toponym_ids: null,
      district_ids: null,
      departements,
      dataTypes: getDataTypes(queryDataTypes, requestConfig),
    },
  };
};

export const getBanExportRequestParams = (
  req: Request,
  requestConfig: RequestConfig
): ExportRequestParamsResult => {
  const commonParams = getCommonExportRequestParams(req, requestConfig);

  if (!commonParams.ok) {
    return commonParams;
  }

  const at = dateStringToPgTimestamptz(
    typeof req.query.at === 'string' ? req.query.at : new Date().toISOString()
  );

  if (at === 'Invalid date') {
    return { ok: false, status: 400, message: "Invalid date format for 'at' parameter. Expected ISO 8601 format (YYYY-MM-DD)." };
  }

  return {
    ok: true,
    params: {
      ...commonParams.params,
      at,
    },
  };
};

export const getDiffExportRequestParams = (
  req: Request,
  requestConfig: RequestConfig
): ExportRequestParamsResult => {
  const commonParams = getCommonExportRequestParams(req, requestConfig);

  if (!commonParams.ok) {
    return commonParams;
  }

  const from = dateStringToPgTimestamptz(req.query.from as string | undefined);
  if (!from) {
    return { ok: false, status: 400, message: 'The `from` parameter is required.' };
  }

  if (from === 'Invalid date') {
    return { ok: false, status: 400, message: "Invalid date format for 'from' parameter. Expected ISO 8601 format (YYYY-MM-DD)." };
  }

  const to = dateStringToPgTimestamptz(
    typeof req.query.to === 'string' ? req.query.to : new Date().toISOString()
  );

  if (to === 'Invalid date') {
    return { ok: false, status: 400, message: "Invalid date format for 'to' parameter. Expected ISO 8601 format (YYYY-MM-DD)." };
  }

  return {
    ok: true,
    params: {
      ...commonParams.params,
      from,
      to,
    },
  };
};
