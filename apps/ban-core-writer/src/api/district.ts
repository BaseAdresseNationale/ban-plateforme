import { logger } from '@ban/tools';

import {
    type Prisma,
    type PrismaClient,
} from '../db/prisma.js';
import {
    banPgDistrictSchema,
    type BanPgDistrict,
} from './district.model.js';

const banDistrictToBanPgDistrict = ({...districtRaw}: Partial<BanDistrict>): BanPgDistrict => {
    const parsedDistrict = banPgDistrictSchema.parse(districtRaw);
    logger.verbose('Parsed district for PG:');
    logger.dir(parsedDistrict, { depth: null });
    return parsedDistrict;
}

export const writeDistrictsInPgDb = async (prismaClient: PrismaClient, banObjects: BanObjects): Promise<BanPgDistrict[]> => {
  const districts = Object.values(banObjects.districts);

  // Insert districts
  logger.info('🏘️ Inserting district…')
  const asyncInsertDistrict = districts.map(async ({...districtRaw}) => {
    const district = banDistrictToBanPgDistrict(districtRaw);
    logger.verbose('🏘️ Inserting district', district.id, '…');
    logger.dir(district, { depth: null });
    const newDistrict = prismaClient.district.upsert({
      where: { id: district.id },
      update: district as unknown as Prisma.districtUpdateInput,
      create: district as unknown as Prisma.districtCreateInput,
    }).then((result) => result as unknown as BanPgDistrict);

    logger.verbose('✅ District created:', district.id, '…');
    logger.dir(newDistrict, { depth: null });
    return newDistrict;
  })

  logger.info('🏙️ >>> Districts written in PG DB');
  return Promise.all(asyncInsertDistrict)
}
