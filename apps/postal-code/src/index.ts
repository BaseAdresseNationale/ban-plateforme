import rascal from 'rascal';
import { env } from '@ban/config';
import {init, Datanova, PostalArea } from './util/sequelize.js'
import { Op, fn, col, where, Model, Attributes  } from 'sequelize';

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
 
// Connection to postgres
await init()
export const getMultidistributed = async (districtCog: any) => Datanova.findOne({
  where: {inseeCom: districtCog},
  raw: true
})

async function main() {
  try {
    const broker = await rascal.BrokerAsPromised.create(config);

    const subscription = await broker.subscribe(subscriberName);

    subscription.on('message', async (message: any, content: any, ackOrNack: () => void) => {

      const codePostaux = await Promise.all(content.rows.map(async (row: any) => {

        const inseeCom : string = row.commune_insee
        const cpFromInseeCom : Attributes<Model> = await getMultidistributed(inseeCom)

        // Code postal non multi-distribué
        if (cpFromInseeCom?.postalCodes?.lenght <= 1){
          return {
            code_postal: cpFromInseeCom.postalCodes[0]
          }
        }
        // Code postal multi-distribué  
        else {
          const xCoord = row.x
          const yCoord = row.y
          const cpFromLatLong = await PostalArea.findOne({
              attributes: ['postalCode'],
              where: {
                inseeCom: inseeCom,
                [Op.and]: where(
                  fn(
                    'ST_Contains',
                    col('geometry'),
                    fn(
                      'ST_SetSRID',
                      fn('ST_MakePoint', xCoord, yCoord),
                      2154
                    )
                  ),
                  true
                )
              }
            });
          return {
            code_postal: cpFromLatLong?.dataValues.postalCode
          }
        }
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
