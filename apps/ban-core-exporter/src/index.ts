import rascal from 'rascal';

import { logger } from '@ban/tools';

import { rabbitmqConfig, subscriptions } from './rabbitmq.config.js';

type DataExportType = 'ban' | 'diff';

type ExportRequestedMessage = {
  token: string;
  exportType: DataExportType;
  params: Record<string, unknown>;
};

const isExportRequestedMessage = (content: unknown): content is ExportRequestedMessage => {
  if (!content || typeof content !== 'object') {
    return false;
  }

  const message = content as Partial<ExportRequestedMessage>;

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

      logger.info('[ban-core-exporter] Demande d\'export reçue', {
        token: content.token,
        exportType: content.exportType,
      });

      // La generation du fichier et les publications completed/failed seront ajoutees dans les prochains commits.
      ackOrNack();
    });

    logger.info('[ban-core-exporter] En ecoute...');
  } catch (error) {
    logger.error('[ban-core-exporter] Erreur:', error);
    process.exit(1);
  }
}

main();
