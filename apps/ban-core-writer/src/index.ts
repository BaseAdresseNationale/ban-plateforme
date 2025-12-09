import rascal from 'rascal';
import { MongoClient } from 'mongodb';

import { env } from '@ban/config';

import logger from './tools/logger.js';
import prismaPg from './db/prisma.js';
import { writeInMongoDb } from './api/api-mongo-ban.js';
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

const mongoUrl =
  env.MONGO.username && env.MONGO.password
    ? `mongodb+srv://${env.MONGO.username}:${env.MONGO.password}@${env.MONGO.host}?replicaSet=replicaset&tls=true&authSource=admin&readPreference=primary`
    : `mongodb://${env.MONGO.host}:${env.MONGO.port}`;
logger.info(`[ban-writer] Mongo URL: ${mongoUrl}`);
const mongoDbName = env.MONGO.db;

async function main() {
  const mongoClient = new MongoClient(mongoUrl);
  await mongoClient.connect();
  const mongoDb = mongoClient.db(mongoDbName);

  const mongoCollections = {
    districts: mongoDb.collection('districts'),
    commonToponyms: mongoDb.collection('commonToponyms'),
    addresses: mongoDb.collection('addresses'),
  };

  const broker = await rascal.BrokerAsPromised.create(config);
  const subscription = await broker.subscribe('balReady');

  subscription.on('message', async (_message: any, content: any, ackOrNack: () => void) => {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;

      // Extraction des objets BAN depuis les lignes BAL
      const banObjects = getBanObjectsFromBalRows(parsed.rows, DEFAULT_ISO_CODE);

      // Check si tous les IDs requis sont présents - TODO: améliorer cette logique et la passer dans ID-Fix/Ban-Parser
      const isWithIds = parsed.rows.every(
        (row: any) =>
          row.id_ban_commune && row.id_ban_toponyme && row.id_ban_adresse
      );

      // Ecriture PostgreSQL si les objets ont tous les IDs requis
      if (isWithIds) {
        // PostgreSQL
        logger.info(`[writer] SIMULATION : Enregistrement PostgreSQL de BAL ${parsed.id} avec ${parsed.rows.length} lignes`);
      } else {
        logger.info(`[writer] Données incomplètes pour PostgreSQL, passage direct à MongoDB`);
      }

      logger.info(`[writer] Enregistrement MongoDB de BAL ${parsed.id}`);
      await writeInMongoDb(mongoCollections, banObjects, parsed.id);

      ackOrNack();
    } catch (err) {
      logger.error('[writer] erreur de traitement message :', err);
      ackOrNack();
    }
  });

  logger.log('[writer] En écoute sur bal.ready...');
}

main();
