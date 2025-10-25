import type { BrokerConfig, ConnectionAttributes } from 'rascal';

import rascal from 'rascal';

import { env } from '@ban/config';
import { getDistrictIDs, getRevisionData } from '@ban/shared-lib';

import validator from './helpers/validator.js';
import getBalVersion from './helpers/get-bal-version.js';
import csvBalToJsonBal from './helpers/csv-bal-to-json-bal.js';

const AUTO_CREATE_DISTRICT = true; // Auto create district if not found

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
        let source; // TODO: Get source from API
        let mandataire;
        const {type, payload} = content;

        console.log(
          `[bal-parser] Nouveau message BAL reçu (type: ${type}) :`,
          typeof content !== 'string'
            ? JSON.stringify(content, null, 2)
            : content,
        );

        switch (type) {
          case 'application/json':
            if (typeof payload === 'object' && payload.cog) {
              cog = payload.cog;
              const revisionData = await getRevisionData(cog);
              if (revisionData) {
                // Récupération réussie des données de révision depuis une BAL
                const { revision, balTextData } = revisionData;
                dataBal = balTextData;
                source = 'bal';
                mandataire = revision.client || {};
                console.log(`[bal-parser]  BAL récupéré depuis depuis API-Depot pour le cog ${cog} via message de type [${type}]`);
              } else {
                // Aucune révision trouvée pour le COG. Erreur.
                throw new Error(`Aucune révision trouvée pour le COG ${cog}`);
              }
            } else {
              throw new Error('JSON payload must contain a "cog" field.');
            }
            break;
          case 'text/csv':
          default:
            if(typeof payload !== 'string') {
              throw new Error(`Payload must be a string for type [${type || 'DEFAULT'}]`);
            }
            dataBal = payload;
            console.log(`[bal-parser] BAL reçue en CSV via message de type [${type || 'DEFAULT'}]`, typeof payload);
            break;
        }

        // Convert csv to json
        const parsedRows = await csvBalToJsonBal(dataBal);

        // Detect BAL version
        const version = getBalVersion(parsedRows);

        console.log('[bal-parser] BAL parsée avec', parsedRows.length, 'lignes');

        if(!cog) {
          cog = parsedRows[0].commune_insee; // TODO: manage multiple cogs
        }

        let districtIDs;
        const shouldThrowError = !AUTO_CREATE_DISTRICT;
        districtIDs = await getDistrictIDs(cog, shouldThrowError);

        if (AUTO_CREATE_DISTRICT && !districtIDs) {
          districtIDs = [...(new Set(parsedRows.map(({ id_ban_commune }) => id_ban_commune)))]
          console.log('[bal-parser] Création automatique des districts pour les COGs trouvés dans la BAL :', districtIDs);
        }

        let useBanId = false;
        useBanId = await validator(districtIDs || [], parsedRows, version, { cog });

        await broker.publish('balParsed', {
          id: content.id,
          meta: {
            useBanId,
            ...(source ? { source } : {}), // add source only if defined
            ...(mandataire ? { mandataire } : {}), // add mandataire only if defined
          },
          rows: parsedRows
        });
        ackOrNack();
      } catch (err) {
        console.error('[bal-parser] Erreur:', err);
        ackOrNack(err as Error);
      }
    });

    console.log('[bal-parser] En écoute...', AUTO_CREATE_DISTRICT ? ' (Auto création des districts activée)' : '');
  } catch (err) {
    console.error('[bal-parser] Erreur:', err);
    process.exit(1);
  }
}

main();
