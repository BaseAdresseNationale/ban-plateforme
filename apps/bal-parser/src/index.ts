import rascal from 'rascal';

import parseBalForBan from './parseBalForBan.js';
import { publications, rabbitmqConfig, subscriptions } from './rabbitmq.config.js';

type BalUploadedMessage = {
  id: string;
  payload: string;
  filename?: string;
};

function assertBalUploadedMessage(content: unknown): asserts content is BalUploadedMessage {
  if (!content || typeof content !== 'object') {
    throw new Error('Invalid bal.uploaded message: expected an object');
  }

  const message = content as Record<string, unknown>;

  if (typeof message.id !== 'string' || message.id.length === 0) {
    throw new Error('Invalid bal.uploaded message: missing id');
  }

  if (typeof message.payload !== 'string' || message.payload.length === 0) {
    throw new Error('Invalid bal.uploaded message: missing CSV payload');
  }

  if (typeof message.filename !== 'undefined' && typeof message.filename !== 'string') {
    throw new Error('Invalid bal.uploaded message: filename must be a string');
  }
}

async function main() {
  try {
    const broker = await rascal.BrokerAsPromised.create(rabbitmqConfig);
    const subscription = await broker.subscribe(subscriptions.balUploaded);
    subscription.on('message', async (message, content, ackOrNack) => {
      try {
        assertBalUploadedMessage(content);
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
