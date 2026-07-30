import rascal from 'rascal';

import { logger } from '@ban/tools';

import type { DataExportRequestMessage } from './export/types.js';
import { handleExportRequest } from './handleExportRequest.js';
import { rabbitmqConfig, subscriptions } from './rabbitmq.config.js';

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

async function main() {
  try {
    const broker = await rascal.BrokerAsPromised.create(rabbitmqConfig);
    const subscription = await broker.subscribe(subscriptions.exportRequested);

    subscription.on('message', async (_message: unknown, content: unknown, ackOrNack: (error?: Error) => void) => {
      if (!isExportRequestedMessage(content)) {
        const error = new Error('Invalid export request message');
        logger.error('[ban-core-exporter] Message invalide:', content);
        ackOrNack(error);
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
    });

    logger.info('[ban-core-exporter] En ecoute...');
  } catch (error) {
    logger.error('[ban-core-exporter] Erreur:', error);
    process.exit(1);
  }
}

main();
