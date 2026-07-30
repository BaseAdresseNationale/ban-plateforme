import rascal from 'rascal';

import { logger } from '@ban/tools';

import { handleExportRequestedMessage } from './export-request-message.js';
import { rabbitmqConfig, subscriptions } from './rabbitmq.config.js';

async function main() {
  try {
    const broker = await rascal.BrokerAsPromised.create(rabbitmqConfig);
    const subscription = await broker.subscribe(subscriptions.exportRequested);

    subscription.on('message', async (_message: unknown, content: unknown, ackOrNack: (error?: Error) => void) => {
      await handleExportRequestedMessage(broker, content, ackOrNack);
    });

    logger.info('[ban-core-exporter] En ecoute...');
  } catch (error) {
    logger.error('[ban-core-exporter] Erreur:', error);
    process.exit(1);
  }
}

main();
