import logger from '../tools/logger.js';

interface MongoCollections {
  districts: import('mongodb').Collection;
  commonToponyms: import('mongodb').Collection;
  addresses: import('mongodb').Collection;
}


export const writeInMongoDb = async (mongoCollections: MongoCollections, banObjects: BanObjects, balId: string = 'Unknown BAL'): Promise<void> => {
  const {
    districts,
    commonToponyms,
    addresses,
  } = mongoCollections;

  // Delete existing documents in MongoDB
  logger.info(`[writer][MongoDB] Suppression des documents existants pour BAL ${balId}`);
  const parsedDistrictsIds: string[] = Object.keys(banObjects.districts);
  await Promise.all([
    addresses.deleteMany({ districtID: { $in: parsedDistrictsIds } }),
    commonToponyms.deleteMany({ districtID: { $in: parsedDistrictsIds } }),
    districts.deleteMany({ id: { $in: parsedDistrictsIds } }),
  ]);
  logger.info(`[writer][MongoDB] Documents existants pour BAL ${balId} contenant le(s) district(s) ${parsedDistrictsIds.join(', ')} supprimé(s)`);

  // Save documents to MongoDB
  const currentTimestamp: string = new Date().toISOString();
  logger.info(`[writer][MongoDB] Enregistrement MongoDB de BAL ${balId} avec ${Object.keys(banObjects.districts).length} districts, ${Object.keys(banObjects.commonToponyms).length} toponymes et ${Object.keys(banObjects.addresses).length} adresses`);
  await Promise.all([
    // Inserting districts
    districts.insertMany(
      Object.values(banObjects?.districts).map((doc: Record<string, any>) => ({
        ...doc,
        storedAt: currentTimestamp,
      })),
    ),
    // Inserting toponyms
    commonToponyms.insertMany(
      Object.values(banObjects?.commonToponyms).map((doc: Record<string, any>) => ({
        ...doc,
        storedAt: currentTimestamp,
      })),
    ),
    // Inserting addresses
    addresses.insertMany(
      Object.values(banObjects?.addresses).map((doc: Record<string, any>) => ({
        ...doc,
        storedAt: currentTimestamp,
      })),
    ),
  ]);
  logger.info(`[writer][MongoDB] BAL ${balId} enregistrée en MongoDB`);
};
