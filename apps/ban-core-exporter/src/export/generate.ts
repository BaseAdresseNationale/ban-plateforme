import type { Writable } from 'node:stream';

import Cursor from 'pg-cursor';

import { pool as pgPool } from '@ban/prisma-client';
import { logger, normalizeExportSelection } from '@ban/tools';

import { fullRequestConfigs } from './full/full-config.js';
import { diffRequestConfigs } from './diff/diff-config.js';
import { getExportStorageConfig, streamExport } from './storage.js';
import { writeChunk } from './helpers/write-chunk.js';
import {
  DiffOrderBuffer,
  closeCursor,
  getDiffObjLine,
  getBanStandardEndLine,
  getBanStandardStartLine,
  getQueryParams,
  getSnapshotObjLine,
  streamCursorData,
} from './helpers/index.js';
import type {
  BanFormatter,
  DataExportParams,
  DataExportType,
  DataType,
  ExportFileResult,
  ExportRequestConfigs,
} from './types.js';

const FETCH_SIZE = 500;

const exportConfigByType = {
  full: {
    requestConfigs: fullRequestConfigs,
    formatter: getSnapshotObjLine,
  },
  diff: {
    requestConfigs: diffRequestConfigs,
    formatter: getDiffObjLine,
  },
} satisfies Record<DataExportType, {
  requestConfigs: ExportRequestConfigs;
  formatter: BanFormatter;
}>;

const getRequestedDataTypes = (
  requestedDataTypes: string[],
  requestConfigs: ExportRequestConfigs
) => {
  const allowedDataTypes = Object.keys(requestConfigs) as DataType[];
  const dataTypes = requestedDataTypes.length > 0
    ? requestedDataTypes.filter((dataType): dataType is DataType => allowedDataTypes.includes(dataType as DataType))
    : allowedDataTypes;

  return dataTypes.length > 0 ? dataTypes : allowedDataTypes;
};

const writeExportFile = async ({
  output,
  exportType,
  params,
  signal,
}: {
  output: Writable;
  exportType: DataExportType;
  params: DataExportParams;
  signal: AbortSignal;
}) => {
  const { requestConfigs, formatter } = exportConfigByType[exportType];
  const dataTypes = getRequestedDataTypes(params.dataTypes, requestConfigs);
  const statsByDataType: Record<string, Record<string, number>> = {};
  const diffBuffer = exportType === 'diff' ? new DiffOrderBuffer() : null;
  const client = await pgPool.connect();
  let activeCursor: Cursor | null = null;
  let released = false;
  // Discard this dedicated connection to interrupt an in-flight SQL read on failure.
  const abort = () => { released = true; client.release(true); };
  signal.addEventListener('abort', abort, { once: true });

  try {
    if (signal.aborted) { abort(); signal.throwIfAborted(); }
    await writeChunk(output, getBanStandardStartLine(exportType, params, dataTypes), signal);

    for (const dataType of dataTypes) {
      signal.throwIfAborted();
      const { request, params: queryParamNames, dataName } = requestConfigs[dataType];

      logger.info(`[ban-core-exporter] Prepared request for ${exportType}/${dataType}`, { queryParamNames });

      activeCursor = client.query(new Cursor(request, getQueryParams(queryParamNames, params)));

      const stats = await streamCursorData({
        cursor: activeCursor,
        fetchSize: FETCH_SIZE,
        dataName,
        output: diffBuffer ?? output,
        banFormatter: formatter,
        signal,
      });

      statsByDataType[dataType] = exportType === 'diff'
        ? { count: stats.count, created: stats.created ?? 0, updated: stats.updated ?? 0, disabled: stats.disabled ?? 0 }
        : stats;

      await closeCursor(activeCursor);
      activeCursor = null;

      logger.info(`[ban-core-exporter] Completed export for ${exportType}/${dataType}`, stats);
    }

    if (diffBuffer) await diffBuffer.flush(output, signal);

    await writeChunk(output, getBanStandardEndLine(statsByDataType), signal);

    return statsByDataType;
  } finally {
    signal.removeEventListener('abort', abort);
    if (!released) {
      await closeCursor(activeCursor);
      client.release();
    }
  }
};

const getTotalCount = (statsByDataType: Record<string, Record<string, number>>) => {
  return Object.values(statsByDataType).reduce(
    (total, stats) => total + (stats.count || 0),
    0
  );
};

export const generateExport = async (
  token: string,
  exportType: DataExportType,
  params: DataExportParams,
  config = getExportStorageConfig()
) => {
  params = normalizeExportSelection(exportType, params);
  const { value: stats, output } = await streamExport({ token, exportType, params },
    (output, signal) => writeExportFile({ output, signal, exportType, params }), config);
  return { output, stats: { params, stats, count: getTotalCount(stats) } };
};

/** Explicit local destination for fixture tools and development checks. */
export const generateLocalExportFile = async (
  token: string, exportType: DataExportType, params: DataExportParams
): Promise<ExportFileResult> => {
  const { output, stats } = await generateExport(token, exportType, params, { storage: 'local' });
  if (output.storage !== 'local') throw new Error('Expected a local export');
  return { filePath: output.path, stats: { ...stats, output } };
};
