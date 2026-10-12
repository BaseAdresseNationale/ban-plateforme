import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { finished } from 'node:stream/promises';

import Cursor from 'pg-cursor';

import { pool as pgPool } from '@ban/prisma-client';
import { logger } from '@ban/tools';

import { fullRequestConfigs } from './full/full-config.js';
import { diffRequestConfigs } from './diff/diff-config.js';
import { getExportOutputDir } from './output-directory.js';
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
    output.write(getBanStandardStartLine(exportType, params, dataTypes));

    for (const dataType of dataTypes) {
      const { request, params: queryParamNames, dataName } = requestConfigs[dataType];

      logger.info(`[ban-core-exporter] Prepared request for ${exportType}/${dataType}`, { queryParamNames });

      activeCursor = client.query(new Cursor(request, getQueryParams(queryParamNames, params)));

      const stats = await streamCursorData({
        cursor: activeCursor,
        fetchSize: FETCH_SIZE,
        dataName,
        output: diffBuffer ?? output,
        banFormatter: formatter,
      });

      statsByDataType[dataType] = exportType === 'diff'
        ? { count: stats.count, created: stats.created ?? 0, updated: stats.updated ?? 0, disabled: stats.disabled ?? 0 }
        : stats;

      await closeCursor(activeCursor);
      activeCursor = null;

      logger.info(`[ban-core-exporter] Completed export for ${exportType}/${dataType}`, stats);
    }

    if (diffBuffer) await diffBuffer.flush(output);

    output.write(getBanStandardEndLine(statsByDataType));

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

  const completion = finished(output);
  void completion.catch(() => undefined);

  try {
    const stats = await writeExportFile({
      output,
      exportType,
      params,
    });

    output.end();
    await completion;

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
    await completion.catch(() => undefined);
    throw error;
  }
};
