import { logger } from '@ban/tools';
import type { z } from 'zod';

import { getPrismaClient } from '../db/prisma.js';
import { banPgAddressSchema } from './address.model.js';

type PrismaClient = ReturnType<typeof getPrismaClient>;

// TODO : Clean this TEMPORARY FIX ? :
type BanPgAddress = z.infer<typeof banPgAddressSchema>;
type BanPgAddressWithNumber = BanPgAddress & { number: number };
type BanAddress = {
  id: string;
  mainCommonToponymID: string;
  secondaryCommonToponymIDs: string[];
  districtID: string;
  // Other address fields...
  mainCommonToponym?: string;
  secondaryCommonToponyms?: string[];
  district?: string;
}

const banAddressToBanPgAddress = ({mainCommonToponym, secondaryCommonToponyms, district, ...addressRaw}: Partial<BanAddress>): BanPgAddressWithNumber => {
  const parsedAddress = banPgAddressSchema.parse(addressRaw);
  return {
    ...parsedAddress,
    number: parsedAddress.number ?? 0,
  };
}

export const writeAddressesInPgDb = async (prismaClient: PrismaClient, banObjects: BanObjects): Promise<BanPgAddress[]> => {
  const addresses = Object.values(banObjects.addresses);

  // Insert addresses
  logger.info('🏠 Inserting addresses…');
  const asyncInsertAddresses = addresses.map(async ({...addressRaw}) => {
    const address = banAddressToBanPgAddress(addressRaw);
    logger.verbose('🏠 Inserting address', address.id, '…');
    const newAddress = await prismaClient.address.upsert({
      where: { id: address.id as string },
      update: address,
      create: address,
    });

    logger.verbose('✅ Address created:', address.id, '…');
    logger.dir(newAddress, { depth: null });
    return newAddress as unknown as BanPgAddress;
  });

  logger.info('🏠 >>> Addresses written in PG DB');
  return Promise.all(asyncInsertAddresses);
}

export const readAddressFromPgDb = async (prismaClient: PrismaClient, id: string): Promise<BanPgAddress | null> => {
  logger.info(`🏠 Reading address with ID ${id} from PG DB…`);
  try {
    const address = await prismaClient.address.findUnique({
      where: { id },
    });
    logger.info(`🏠 >>> Address with ID ${id} read from PG DB`, address);
    return address as unknown as BanPgAddress | null;
  } catch (error) {
    const { message, cause } = error as Error;
    logger.error(`Can not read address with ID ${id} from PG DB:`, (cause as Error)?.message ?? message);
    return null;
  }
}
