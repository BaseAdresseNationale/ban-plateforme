import rascal from 'rascal';

import { env } from '@ban/config';

const rabbitConfig = {
  hostname: env.RABBIT.host,
  port: Number(env.RABBIT.port),
  user: env.RABBIT.user,
  password: env.RABBIT.password,
};

const exchangeName = 'bal.events';
const queueName = 'old-district.in';
const bindingKey = 'bal.enrich';
const routingKey = 'bal.enriched.old-district';
const subscriberName = 'balToOldDistrict';
const publicationName = 'withOldDistrict';

const config = {
  vhosts: {
    '/': {
      connection: {
        protocol: 'amqp',
        ...rabbitConfig,
      },
      exchanges: [
        { name: exchangeName, type: 'topic' as const }
      ],
      queues: [
        { name: queueName, assert: true }
      ],
      bindings: [
        {
          source: exchangeName,
          destination: queueName,
          bindingKey
        }
      ]
    }
  },
  subscriptions: {
    [subscriberName]: {
      queue: queueName
    }
  },
  publications: {
    [publicationName]: {
      exchange: exchangeName,
      routingKey: routingKey
    }
  }
};


async function main() {
  try {
    const broker = await rascal.BrokerAsPromised.create(config);

    const subscription = await broker.subscribe(subscriberName);

    subscription.on('message', async (message: any, content: any, ackOrNack: () => void) => {

      const enriched = {
        ...content,
        rows: content.rows.map((row: any) => ({
          ...row,
        }))
      };

      await broker.publish(publicationName, JSON.stringify(enriched), {
        options: { contentType: 'application/json' }
      });

      console.log(`[beautifier] Message publié sur "${exchangeName}" avec la clé de routage "${routingKey}" et la clé de publication "${publicationName}"`);
      ackOrNack();
    });

    console.log('[old-district] En écoute...');
  } catch (err) {
    console.error('[old-district] Erreur:', err);
    process.exit(1);
  }
}

main();
