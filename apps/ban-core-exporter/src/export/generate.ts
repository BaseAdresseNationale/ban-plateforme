import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { finished } from 'node:stream/promises';

import Cursor from 'pg-cursor';

import { pool as pgPool } from '@ban/prisma-client';
import { logger } from '@ban/tools';

import { banRequestConfigs } from './ban/ban-config.js';
import { diffRequestConfigs } from './diff/diff-config.js';
import {
  banToStandardFr,
  banToStandardFrInt,
  DiffOrderBuffer,
  closeCursor,
  getDiffObjLine,
  getMetaLine,
  getRawEndLine,
  getRawStartLine,
  getStandardFrEndLine,
  getStandardFrStartLine,
  getQueryParams,
  getSnapshotObjLine,
  rawFormatters,
  standardFrFormatters,
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

const getExportOutputDir = () => path.resolve(
  process.env.EXPORT_OUTPUT_DIR || path.join(process.cwd(), 'tmp/exports')
);

const exportConfigByType = {
  ban: {
    requestConfigs: banRequestConfigs,
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

const getExportFilePath = (
  token: string,
  exportType: DataExportType,
  format: string
) => path.join(getExportOutputDir(), `${token}.${exportType}.${format}.ndjson`);

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
}: {
  output: NodeJS.WritableStream;
  exportType: DataExportType;
  params: DataExportParams;
}) => {
  const { requestConfigs, formatter } = exportConfigByType[exportType];
  const dataTypes = getRequestedDataTypes(params.dataTypes, requestConfigs);
  const statsByDataType: Record<string, Record<string, number>> = {};
  const diffBuffer = exportType === 'diff' ? new DiffOrderBuffer() : null;
  const client = await pgPool.connect();
  let activeCursor: Cursor | null = null;

  try {
    output.write(params.format === 'raw' ? getRawStartLine(exportType, params, dataTypes)
      : params.format === 'standard-fr' ? getStandardFrStartLine(exportType, params, dataTypes)
        : getMetaLine('stream-start', { exportType, ...params, dataTypes }));

    for (const dataType of dataTypes) {
      const { request, params: queryParamNames, dataName } = requestConfigs[dataType];

      logger.info(`[ban-core-exporter] Prepared request for ${exportType}/${dataType}`, { queryParamNames });

      activeCursor = client.query(new Cursor(request, getQueryParams(queryParamNames, params)));

      const stats = await streamCursorData({
        cursor: activeCursor,
        fetchSize: FETCH_SIZE,
        dataName,
        format: params.format,
        output: diffBuffer ?? output,
        banFormatter: formatter,
        converters: {
          raw: rawFormatters,
          'standard-fr': standardFrFormatters,
          'standard-fr-int': banToStandardFrInt,
        },
      });

      statsByDataType[dataType] = exportType === 'diff'
        ? { count: stats.count, created: stats.created ?? 0, updated: stats.updated ?? 0, disabled: stats.disabled ?? 0 }
        : stats;

      await closeCursor(activeCursor);
      activeCursor = null;

      logger.info(`[ban-core-exporter] Completed export for ${exportType}/${dataType}`, stats);
    }

    if (diffBuffer) await diffBuffer.flush(output);

    output.write(params.format === 'raw' ? getRawEndLine(statsByDataType)
      : params.format === 'standard-fr' ? getStandardFrEndLine(statsByDataType)
        : getMetaLine('stream-end', { exportType, ...params, dataTypes, stats: statsByDataType }));

    return statsByDataType;
  } finally {
    await closeCursor(activeCursor);
    client.release();
  }
};

const getTotalCount = (statsByDataType: Record<string, Record<string, number>>) => {
  return Object.values(statsByDataType).reduce(
    (total, stats) => total + (stats.count || 0),
    0
  );
};

export const generateLocalExportFile = async (
  token: string,
  exportType: DataExportType,
  params: DataExportParams
): Promise<ExportFileResult> => {
  await mkdir(getExportOutputDir(), { recursive: true });

  const filePath = getExportFilePath(token, exportType, params.format);
  const output = createWriteStream(filePath, { encoding: 'utf8' });

  try {
    const stats = await writeExportFile({
      output,
      exportType,
      params,
    });

    output.end();
    await finished(output);

    return {
      filePath,
      stats: {
        output: {
          storage: 'local',
          path: filePath,
        },
        params,
        stats,
        count: getTotalCount(stats),
      },
    };
  } catch (error) {
    output.destroy();
    throw error;
  }
};
