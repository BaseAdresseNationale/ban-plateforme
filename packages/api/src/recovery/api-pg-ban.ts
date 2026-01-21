import { getPrismaClient } from '../db/prisma.js';
import { writeDistrictsInPgDb } from './district.js';
import { writeCommonToponymsInPgDb } from './commonToponym.js';
import { writeAddressesInPgDb } from './address.js';

type PrismaClient = ReturnType<typeof getPrismaClient>;

export const writeInPgDb = async (prismaClient: PrismaClient, banObjects: BanObjects): Promise<void> => {
  await writeDistrictsInPgDb(prismaClient, banObjects);
  await writeCommonToponymsInPgDb(prismaClient, banObjects);
  await writeAddressesInPgDb(prismaClient, banObjects);
}

export const getFromPgDb = async (prismaClient: PrismaClient): Promise<void> => {
  // To be implemented
}
