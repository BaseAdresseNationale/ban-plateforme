import rascal from 'rascal';

import { env } from '@ban/config';

import parseBalForBan from './parseBalForBan.js';

const rabbitConfig = {
  hostname: env.RABBIT.host,
  port: Number(env.RABBIT.port),
  user: env.RABBIT.user,
  password: env.RABBIT.password,
};

const config = {
  vhosts: {
    '/': {
      connection: {
        protocol: 'amqp',
        ...rabbitConfig,
      },
      exchanges: [{ name: 'bal.events', type: 'topic' as const }],
      queues: [{ name: 'parser.in', assert: true }],
      bindings: [
        { source: 'bal.events', destination: 'parser.in', bindingKey: 'bal.uploaded' }
      ]
    }
  },
  subscriptions: {
    balUploaded: { queue: 'parser.in' }
  },
  publications: {
    balParsed: {
      exchange: 'bal.events',
      routingKey: 'bal.parsed'
    }
  }
};

async function main() {
  try {
    const broker = await rascal.BrokerAsPromised.create(config);
    const subscription = await broker.subscribe('balUploaded');
    subscription.on('message', async (message, content, ackOrNack) => {
      try {
        const parsedRows = await parseBalForBan(content.payload);
        console.log('[bal-parser] BAL parsée avec', parsedRows.length, 'lignes');
        await broker.publish('balParsed', { id: content.id, rows: parsedRows });
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
