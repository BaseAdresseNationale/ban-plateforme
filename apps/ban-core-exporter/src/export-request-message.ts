import type { BrokerAsPromised } from 'rascal';

import { logger, normalizeExportSelection } from '@ban/tools';

import type { DataExportRequestMessage } from './export/types.js';
import { handleExportRequest } from './handleExportRequest.js';
import { markExportError } from './export/status.js';

type Broker = Awaited<ReturnType<typeof BrokerAsPromised.create>>;
type AckOrNack = (error?: Error) => void;

const isExportRequestedMessage = (content: unknown): content is DataExportRequestMessage => {
  if (!content || typeof content !== 'object') {
    return false;
  }

  const message = content as Partial<DataExportRequestMessage>;

  return (
    typeof message.token === 'string'
    && (message.exportType === 'full' || message.exportType === 'diff')
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

  let normalized: DataExportRequestMessage;
  try {
    normalized = { ...content, params: normalizeExportSelection(content.exportType, content.params) };
  } catch (error) {
    logger.error('[ban-core-exporter] Parametres invalides:', error instanceof Error ? error.message : 'invalid selection');
    try { await markExportError(content.token, error); }
    catch (statusError) { logger.error('[ban-core-exporter] Impossible de notifier le refus:', statusError); }
    ackOrNack(); // Permanent validation error: do not requeue an invalid request.
    return;
  }

  logger.info('[ban-core-exporter] Demande d\'export recue', {
    token: content.token,
    exportType: content.exportType,
  });

  try {
    await handleExportRequest(broker, normalized);
    ackOrNack();
  } catch (error) {
    ackOrNack(error as Error);
  }
};
