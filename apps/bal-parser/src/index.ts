import rascal from 'rascal';

import parseBalForBan from './parseBalForBan.js';
import { publications, rabbitmqConfig, subscriptions } from './rabbitmq.config.js';

async function main() {
  try {
    const broker = await rascal.BrokerAsPromised.create(rabbitmqConfig);
    const subscription = await broker.subscribe(subscriptions.balUploaded);
    subscription.on('message', async (message, content, ackOrNack) => {
      try {
        const parsedRows = await parseBalForBan(content.payload);
        console.log('[bal-parser] BAL parsée avec', parsedRows.length, 'lignes');
        await broker.publish(publications.balParsed, { id: content.id, rows: parsedRows });
        ackOrNack();
      } catch (err) {
        console.error('[bal-parser] Erreur:', err);
        ackOrNack(err as Error);
      }
    });

    console.log('[bal-parser] En écoute...');
  } catch (err) {
    console.error('[bal-parser] Erreur:', err);
    process.exit(1);
  }
}

main();
