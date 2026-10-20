import { logger } from '@ban/tools';
import { getPrismaClient } from '@ban/prisma-client'
import type { BanObjects } from '../api/ban-generic.shema.js';

import {
    banPgDistrictSchema,
    type BanPgDistrict,
} from './district.model.js';

type PrismaClient = ReturnType<typeof getPrismaClient>;

const banDistrictToBanPgDistrict = ({...districtRaw}: Partial<BanDistrict>): BanPgDistrict => {
    const parsedDistrict = banPgDistrictSchema.parse(districtRaw);
    logger.verbose('Parsed district for PG:');
    logger.dir(parsedDistrict, { depth: null });

    const normalizedDistrict: BanPgDistrict = {
        ...parsedDistrict,
        config: {
            ...parsedDistrict.config,
            defaultBalLang: parsedDistrict.config?.defaultBalLang === 'fra' ? 'fra' : undefined,
        },
    };

    return normalizedDistrict;
}

export const writeDistrictsInPgDb = async (prismaClient: PrismaClient, banObjects: BanObjects): Promise<BanPgDistrict[]> => {
  const districts = Object.values(banObjects.districts);

  // Insert districts
  logger.info('🏘️ Inserting district…')
  const asyncInsertDistrict = districts.map(async ({...districtRaw}) => {
    const district = banDistrictToBanPgDistrict(districtRaw);
    logger.verbose('🏘️ Inserting district', district.id, '…');
    logger.dir(district, { depth: null });
    const newDistrict = await prismaClient.district.upsert({
      where: { id: district.id },
      update: district,
      create: district,
    });

    logger.verbose('✅ District created:', district.id, '…');
    logger.dir(newDistrict, { depth: null });
    return newDistrict as unknown as BanPgDistrict;
  })

  logger.info('🏙️ >>> Districts written in PG DB');
  return Promise.all(asyncInsertDistrict)
}
