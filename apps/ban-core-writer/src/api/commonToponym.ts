import {
    type Prisma,
    type PrismaClient,
} from '../db/prisma.js';
import logger from '../tools/logger.js';
import { banPgCommonToponymSchema } from './commonToponym.model.js';

const banCommonToponymToBanPgCommonToponym = (commonToponymRaw: Partial<BanCommonToponym>): BanPgCommonToponym => {
    const parsedCommonToponym = banPgCommonToponymSchema.parse(commonToponymRaw);
    logger.verbose('Parsed common toponym for PG:');
    logger.dir(parsedCommonToponym, { depth: null });
    return parsedCommonToponym;
}

export const writeCommonToponymsInPgDb = async (prismaClient: PrismaClient, banObjects: BanObjects): Promise<BanPgCommonToponym[]> => {
  const commonToponyms = Object.values(banObjects.commonToponyms);

  // Insert common toponyms
  logger.info('📍 Inserting common toponyms…');
  const asyncInsertCommonToponyms = commonToponyms.map(async ({legalityDate, ...commonToponymRaw}) => {
    const commonToponym = banCommonToponymToBanPgCommonToponym(commonToponymRaw);
    logger.verbose('📍 Inserting common toponym', commonToponym.id, '…');
    const newCommonToponym = await prismaClient.common_toponym.upsert({
      where: { id: commonToponym.id },
      update: commonToponym as unknown as Prisma.common_toponymUpdateInput,
      create: commonToponym as unknown as Prisma.common_toponymCreateInput,
    }).then((result) => result as unknown as BanPgCommonToponym);

    logger.verbose('✅ Common toponym created:', commonToponym.id, '…');
    logger.dir(newCommonToponym, { depth: null });
    return newCommonToponym;
  });

  logger.info('📍 >>> Common toponyms written in PG DB');
  return Promise.all(asyncInsertCommonToponyms);
}
