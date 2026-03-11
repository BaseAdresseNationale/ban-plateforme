import { getPrismaClient } from '@ban/prisma-client'

type PrismaClientInstance = ReturnType<typeof getPrismaClient>;

class Ban {
  private readonly prismaClient: unknown;

  constructor(prismaClient?: unknown) {
    this.prismaClient = prismaClient ?? getPrismaClient();
  }

  protected get prisma(): PrismaClientInstance {
    return this.prismaClient as PrismaClientInstance;
  }

  // Sample method to demonstrate how to use the Prisma client within the Ban class
  async findDistrictByCode(code: string) {
    return this.prisma.district.findFirst({ where: { meta: { path: ['insee', 'cog'], equals: code } } });
  }
}

export { getPrismaClient };
export default Ban;

// -------------------------
// FOR RECOVERY & INTERNAL USE ONLY (not to be confused with the public API of the package, which is what we want to export in @ban/api)
// -------------------------

export type { MongoCollections } from './recovery/api-mongo-ban.js';
export { writeInMongoDb } from './recovery/api-mongo-ban.js';
export { writeInPgDb, getFromPgDb } from './recovery/api-pg-ban.js';
