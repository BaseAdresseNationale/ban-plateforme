import rascal, { BrokerConfig, ConnectionAttributes } from 'rascal';

import { env } from '@ban/config';

import { getDistrictIDs } from './services/bal.js';


import { getBalAssembly, getRevisionData } from "./helpers/dump-api/index.js";
import validator from './helpers/validator.js';
import getBalVersion from './helpers/get-bal-version.js';
import csvBalToJsonBal from './helpers/csv-bal-to-json-bal.js';

const FIND_OR_CREATE_AUTHORIZED = true;

const rabbitConfig: ConnectionAttributes = {
  hostname: env.RABBIT.host,
  port: Number(env.RABBIT.port),
  user: env.RABBIT.user,
  password: env.RABBIT.password,
};

const config: BrokerConfig = {
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
        let cog;
        let dataBal;
        let source;
        const {type} = content;

        console.log(`[bal-parser] Nouveau message BAL reçu (type: ${type}) :`, content);

        if(
          type === 'application/json'
          && typeof content.payload === 'object'
          && content?.payload?.cog
        ) {
          cog = content.payload.cog;

          // Get BAL text data from dump-api
          const { revision, balTextData } = await getRevisionData(cog);
          dataBal = balTextData;
          console.log(`[bal-parser] Récupéré la BAL COG ${cog} (révision ${revision}) depuis dump-api`, typeof dataBal);
        } else if(type === 'text/csv') {
          dataBal = content.payload;
          console.log(`[bal-parser] BAL CSV reçue via CSV message`, typeof dataBal);
        } else {
          dataBal = await getBalAssembly(cog);
          source = 'assemblage'
          // throw new Error('Type de contenu non supporté. Veuillez fournir du CSV ou un JSON avec un champ "cog".');
        }

        // Convert csv to json
        const parsedRows = await csvBalToJsonBal(dataBal);
        
        // Detect BAL version
        const version = getBalVersion(parsedRows);
        
        console.log('[bal-parser] BAL parsée avec', parsedRows.length, 'lignes');
        
        // Get BAL text data from dump-api
        // const { revision, balTextData: balCsvData } = await getRevisionData(cog);

        // @todo: manage multiple cogs
        // const cog = parsedRows[0].commune_insee;
        
        cog = parsedRows[0].commune_insee;
        let districtIDs;
        const shouldThrowError = !FIND_OR_CREATE_AUTHORIZED;
        districtIDs = await getDistrictIDs(cog, shouldThrowError);

        if (FIND_OR_CREATE_AUTHORIZED && !districtIDs) {
          districtIDs = [...(new Set(parsedRows.map(({ id_ban_commune }) => id_ban_commune)))]
          
          //@todo: create districtIDs in database
          console.log('[bal-parser] todo: create districtIDs in database.')
        }
        
        let useBanId = false;
        useBanId = await validator(districtIDs || [], parsedRows, version, { cog });

        await broker.publish('balParsed', {
          id: content.id,
          meta: {
            useBanId,
            ...(source ? { source } : {}) // add source only if defined
          },
          rows: parsedRows
        });
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
