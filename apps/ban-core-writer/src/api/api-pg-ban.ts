import type { PrismaClient } from '../db/prisma.js';

import {
  writeDistrictsInPgDb,
} from './district.js';
import {
  writeCommonToponymsInPgDb,
} from './commonToponym.js';
import {
  writeAddressesInPgDb,
} from './address.js';

export const writeInPgDb = async (prismaClient: PrismaClient, banObjects: BanObjects): Promise<void> => {
  await writeDistrictsInPgDb(prismaClient, banObjects);
  await writeCommonToponymsInPgDb(prismaClient, banObjects);
  await writeAddressesInPgDb(prismaClient, banObjects);
}
