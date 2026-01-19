import { logger } from '@ban/tools';

import {
  type Prisma,
  type PrismaClient,
} from '../db/prisma.js';
import { banPgAddressSchema } from './address.model.js';

const banAddressToBanPgAddress = ({mainCommonToponym, secondaryCommonToponyms, district, ...addressRaw}: Partial<BanAddress>): BanPgAddress => {
  const parsedAddress = banPgAddressSchema.parse(addressRaw);
  return parsedAddress;
}

export const writeAddressesInPgDb = async (prismaClient: PrismaClient, banObjects: BanObjects): Promise<BanPgAddress[]> => {
  const addresses = Object.values(banObjects.addresses);

  // Insert addresses
  logger.info('🏠 Inserting addresses…');
  const asyncInsertAddresses = addresses.map(async ({...addressRaw}) => {
    const address = banAddressToBanPgAddress(addressRaw);
    logger.verbose('🏠 Inserting address', address.id, '…');
    const newAddress = await prismaClient.address.upsert({
      where: { id: address.id },
      update: address as unknown as Prisma.addressUpdateInput,
      create: address as unknown as Prisma.addressCreateInput,
    });

    logger.verbose('✅ Address created:', address.id, '…');
    logger.dir(newAddress, { depth: null });
    return newAddress as unknown as BanPgAddress;
  });

  logger.info('🏠 >>> Addresses written in PG DB');
  return Promise.all(asyncInsertAddresses);
}
