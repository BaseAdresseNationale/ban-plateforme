import rascal from 'rascal';
import { MongoClient } from 'mongodb';
import pg from 'pg';

import { env } from '@ban/config';

import logger from './tools/logger.js';

import { getBanObjectsFromBalRows } from './helper.js';

const rabbitConfig = {
  hostname: env.RABBIT.host,
  port: Number(env.RABBIT.port),
  user: env.RABBIT.user,
  password: env.RABBIT.password,
};

const DEFAULT_ISO_CODE = 'fra'; // Default ISO code for labels

const config = {
  vhosts: {
    '/': {
      connection: {
        protocol: 'amqp',
        ...rabbitConfig,
      },
      exchanges: [
        { name: 'bal.events', type: 'topic' as const }
      ],
      queues: [
        { name: 'writer.in', assert: true }
      ],
      bindings: [
        {
          source: 'bal.events',
          destination: 'writer.in',
          bindingKey: 'bal.ready'
        }
      ]
    }
  },
  subscriptions: {
    balReady: {
      queue: 'writer.in'
    }
  }
};

const { Pool } = pg;

const mongoUrl =
  env.MONGO.username && env.MONGO.password
    ? `mongodb+srv://${env.MONGO.username}:${env.MONGO.password}@${env.MONGO.host}?replicaSet=replicaset&tls=true&authSource=admin&readPreference=primary`
    : `mongodb://${env.MONGO.host}:${env.MONGO.port}`;
logger.info(`[ban-writer] Mongo URL: ${mongoUrl}`);
const mongoDbName = env.MONGO.db;
const pgConfig = {
  host: env.PG.host,
  port: env.PG.port,
  user: env.PG.user,
  password: env.PG.password,
  database: env.PG.db,
};

async function main() {
  const mongoClient = new MongoClient(mongoUrl);
  await mongoClient.connect();
  const mongoDb = mongoClient.db(mongoDbName);

  const mongoCollectionDistricts = mongoDb.collection('districts');
  const mongoCollectionCommonToponyms = mongoDb.collection('commonToponyms');
  const mongoCollectionAddresses = mongoDb.collection('addresses');

  const pgPool = new Pool(pgConfig); // TODO: Implement real value for PG

  const broker = await rascal.BrokerAsPromised.create(config);
  const subscription = await broker.subscribe('balReady');

  subscription.on('message', async (_message: any, content: any, ackOrNack: () => void) => {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;

      const hasAllIds = parsed.rows.every(
        (row: any) =>
          row.id_ban_commune && row.id_ban_toponyme && row.id_ban_adresse
      );

      if (hasAllIds) {
        // Écriture PostgreSQL simulée (à remplacer par du vrai SQL)
        logger.info(`[writer] Enregistrement PostgreSQL de ${parsed.rows.length} lignes`);
      } else {
        logger.info(`[writer] Données incomplètes pour PostgreSQL, passage MongoDB`);
      }

      // MongoDB
      const banObjects = getBanObjectsFromBalRows(parsed.rows, DEFAULT_ISO_CODE);

      // Delete existing documents in MongoDB
      logger.info(`[writer] Suppression des documents existants pour BAL ${parsed.id}`);
      const parsedDistrictsIds = Object.keys(banObjects.districts);
      await Promise.all([
        mongoCollectionAddresses.deleteMany({ districtID: { $in: parsedDistrictsIds } }),
        mongoCollectionCommonToponyms.deleteMany({ districtID: { $in: parsedDistrictsIds } }),
        mongoCollectionDistricts.deleteMany({ id: { $in: parsedDistrictsIds } }),
      ]);
      logger.info(`[writer] Documents existants pour BAL ${parsed.id} contenant le(s) district(s) ${parsedDistrictsIds.join(', ')} supprimé(s)`);

      // Enregistrement MongoDB
      const currentTimestamp = new Date().toISOString();
      logger.info(`[writer] Enregistrement MongoDB de BAL ${parsed.id} avec ${Object.keys(banObjects.districts).length} districts, ${Object.keys(banObjects.commonToponyms).length} toponymes et ${Object.keys(banObjects.addresses).length} adresses`);
      await Promise.all([
        // Injection des districts
        mongoCollectionDistricts.insertMany(
          Object.values(banObjects?.districts).map(doc => ({
            ...doc,
            storedAt: currentTimestamp,
          })),
        ),
        // Injection des toponymes
        mongoCollectionCommonToponyms.insertMany(
          Object.values(banObjects?.commonToponyms).map(doc => ({
            ...doc,
            storedAt: currentTimestamp,
          })),
        ),
        // Injection des adresses
        mongoCollectionAddresses.insertMany(
          Object.values(banObjects?.addresses).map(doc => ({
            ...doc,
            storedAt: currentTimestamp,
          })),
        ),
      ]);
      logger.info(`[writer] BAL ${parsed.id} enregistrée en MongoDB`);

      ackOrNack();
    } catch (err) {
      logger.error('[writer] erreur de traitement message :', err);
      ackOrNack();
    }
  });

  logger.log('[writer] En écoute sur bal.ready...');
}

main();
