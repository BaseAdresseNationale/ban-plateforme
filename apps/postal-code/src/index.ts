import rascal from 'rascal';
import { env } from '@ban/config';

const rabbitConfig = {
  hostname: env.RABBIT.host,
  port: Number(env.RABBIT.port),
  user: env.RABBIT.user,
  password: env.RABBIT.password,
};

const exchangeName = 'bal.events';
const queueName = 'postal-code.in';
const bindingKey = 'bal.enrich';
const routingKey = 'bal.enriched.postal-code';
const subscriberName = 'balToPostalCode';
const publicationName = 'postalCoded';


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
      routingKey
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
        rows: content.rows.map((row: any, index: number) => ({
          ...row,
          ban_enrich_code_postal: "61450"
        }))
      };

      await broker.publish(publicationName, JSON.stringify(enriched), {
        options: { contentType: 'application/json' }
      });

      console.log(`[postal-code] Message publié sur "${exchangeName}" avec la clé de routage "${routingKey}" et la clé de publication "${publicationName}"`);
      ackOrNack();
    });

    console.log('[postal-code] En écoute...');
  } catch (err) {
    console.error('[postal-code] Erreur:', err);
    process.exit(1);
  }
}

main();
