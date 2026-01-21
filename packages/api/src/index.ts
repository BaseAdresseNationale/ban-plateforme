import getPrismaClient from './db/prisma.js';

class Ban {
  // TODO: add CRUD methods for each entity (district, address, common toponym, etc.) that will use the prismaPg client to write in the PG DB
  constructor() {
  }
};

export { getPrismaClient };
export default Ban;

// -------------------------
// FOR RECOVERY & INTERNAL USE ONLY (not to be confused with the public API of the package, which is what we want to export in @ban/api)
// -------------------------

export type { MongoCollections } from './recovery/api-mongo-ban.js';
export { writeInMongoDb } from './recovery/api-mongo-ban.js';
export { writeInPgDb, getFromPgDb } from './recovery/api-pg-ban.js';
