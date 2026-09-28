import type { BrokerAsPromised } from 'rascal';

import { logger } from '@ban/tools';

import type { DataExportRequestMessage } from './export/types.js';
import { handleExportRequest } from './handleExportRequest.js';

type Broker = Awaited<ReturnType<typeof BrokerAsPromised.create>>;
type AckOrNack = (error?: Error) => void;

const isExportRequestedMessage = (content: unknown): content is DataExportRequestMessage => {
  if (!content || typeof content !== 'object') {
    return false;
  }

  const message = content as Partial<DataExportRequestMessage>;

  return (
    typeof message.token === 'string'
    && (message.exportType === 'ban' || message.exportType === 'diff')
    && !!message.params
    && typeof message.params === 'object'
  );
};

export const handleExportRequestedMessage = async (
  broker: Broker,
  content: unknown,
  ackOrNack: AckOrNack
) => {
  if (!isExportRequestedMessage(content)) {
    logger.error('[ban-core-exporter] Message invalide:', content);
    ackOrNack();
    return;
  }

  logger.info('[ban-core-exporter] Demande d\'export recue', {
    token: content.token,
    exportType: content.exportType,
  });

  try {
    await handleExportRequest(broker, content);
    ackOrNack();
  } catch (error) {
    ackOrNack(error as Error);
  }
};
