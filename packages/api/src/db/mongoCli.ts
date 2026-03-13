import { MongoClient } from 'mongodb';
import { env } from '@ban/config';

const mongoUrl =
  env.MONGO.username && env.MONGO.password
    ? `mongodb+srv://${env.MONGO.username}:${env.MONGO.password}@${env.MONGO.host}?replicaSet=replicaset&tls=true&authSource=admin&readPreference=primary`
    : `mongodb://${env.MONGO.host}:${env.MONGO.port}`;
// logger.info(`[ban-writer] Mongo URL: ${mongoUrl}`);
const mongoDbName = env.MONGO.db;

const mongoClient = new MongoClient(mongoUrl);
await mongoClient.connect();
export const mongoDb = mongoClient.db(mongoDbName);

export const mongoCollections = {
districts: mongoDb.collection('districts'),
commonToponyms: mongoDb.collection('commonToponyms'),
addresses: mongoDb.collection('addresses'),
};

export default mongoDb;