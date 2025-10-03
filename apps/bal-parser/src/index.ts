import rascal from 'rascal';

import { env } from '@ban/config';


import { getDistrictIDsFromDB } from './services/bal.js';
import { RabbitConfig } from './types/rabbitConfig.js';
import { AMQPConfig } from './types/AMQPConfig.js';

import { getRevisionData } from "./helpers/dump-api/index.js";
import validator from './helpers/validator.js';
import getBalVersion from './helpers/get-bal-version.js';
import csvBalToJsonBal from './helpers/csv-bal-to-json-bal.js';

const rabbitConfig: RabbitConfig = {
  hostname: env.RABBIT.host,
  port: Number(env.RABBIT.port),
  user: env.RABBIT.user,
  password: env.RABBIT.password,
};

const config: AMQPConfig = {
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
    subscription.on('message', async (message:any, content:any, ackOrNack) => {
      try {
        
        // Convert csv to json
        const dataBal = content.payload;
        const parsedRows = await csvBalToJsonBal(dataBal);
        
        // Detect BAL version
        const version = getBalVersion(parsedRows);
        
        console.log('[bal-parser] BAL parsée avec', parsedRows.length, 'lignes');
        
        // Get BAL text data from dump-api
        // const { revision, balTextData: balCsvData } = await getRevisionData(cog);

        // @todo: manage multiple cogs
        const cog = parsedRows[0].commune_insee;
        const districtIDsFromDB = await getDistrictIDsFromDB(cog);

        let useBanId = false;
        useBanId = await validator(districtIDsFromDB, parsedRows, version, { cog });

        await broker.publish('balParsed', { id: content.id, meta: { useBanId }, rows: parsedRows });
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
