import { env } from '@ban/config';
import { logger } from '@ban/tools';
import postalCodeRoutes from './routes/index.js';
import getPostalCode from './routes/postal-code-long-lat/model.js';
import express from 'express';
import rascal from 'rascal';

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
    const app = express();
    const port = env.PC.port || 3001;

    app.use(express.json({limit: '20mb'}))

    app.get('/', (req, res) => {
      res.send('Welcome to the Postal Code Service');
    });
    
    app.use('/postal-code', postalCodeRoutes);
    
    app.listen(port, () => {
        logger.log(`[postal-code] Server is listening on port ${port}`)
    })
    

    const broker = await rascal.BrokerAsPromised.create(config);

    const subscription = await broker.subscribe(subscriberName);

    subscription.on('message', async (message: any, content: any, ackOrNack: () => void) => {

      const codePostaux = await Promise.all(content.rows.map(async (row: any) => {
        const codePostal = await getPostalCode.getPostalCode(row.x?.toString(), row.y?.toString(), row.inseeCom?.toString())
        return codePostal
      }));

      const enriched = {
        ...content,
        rows: content.rows.map((row: any, index: number) => ({
          ...row,
          ban_enrich_code_postal: codePostaux[index]?.code_postal
        }))
      };

      await broker.publish(publicationName, JSON.stringify(enriched), {
        options: { contentType: 'application/json' }
      });

      logger.log(`[postal-code] Message publié sur "${exchangeName}" avec la clé de routage "${routingKey}" et la clé de publication "${publicationName}"`);
      ackOrNack();
    });

    logger.log('[postal-code] En écoute...');
  } catch (err) {
    logger.error('[postal-code] Erreur:', err);
    process.exit(1);
  }
}

main();
