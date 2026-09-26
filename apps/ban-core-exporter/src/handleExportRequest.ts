import type { BrokerAsPromised } from 'rascal';

import { logger } from '@ban/tools';

import { generateLocalExportFile } from './export/generate.js';
import { storeExportFile } from './export/storage.js';
import {
  markExportError,
  markExportProcessing,
  markExportSuccess,
} from './export/status.js';
import type { DataExportRequestMessage } from './export/types.js';
import { publications } from './rabbitmq.config.js';

type Broker = Awaited<ReturnType<typeof BrokerAsPromised.create>>;

export const handleExportRequest = async (
  broker: Broker,
  content: DataExportRequestMessage
) => {
  try {
    await markExportProcessing(content.token);
    const { filePath, stats } = await generateLocalExportFile(
      content.token,
      content.exportType,
      content.params
    );
    const output = await storeExportFile({
      token: content.token,
      exportType: content.exportType,
      params: content.params,
      filePath,
    });
    const report: Record<string, unknown> = {
      ...stats,
      output,
    };
    const count = typeof report.count === 'number' ? report.count : 0;

    await markExportSuccess(content.token, report, count);
    await broker.publish(publications.exportCompleted, {
      token: content.token,
      exportType: content.exportType,
      status: 'success',
      report,
    });
    logger.info('[ban-core-exporter] Fichier export genere', {
      token: content.token,
      exportType: content.exportType,
      filePath,
      output,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await markExportError(content.token, error, {
      exportType: content.exportType,
      params: content.params,
    });
    await broker.publish(publications.exportFailed, {
      token: content.token,
      exportType: content.exportType,
      status: 'error',
      error: errorMessage,
    });

    logger.error('[ban-core-exporter] Erreur generation export:', error);
    throw error;
  }
};
