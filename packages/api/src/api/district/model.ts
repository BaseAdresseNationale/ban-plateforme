// import { prisma } from '../../db/prisma.js';
import { normalize } from 'path';
import { getPrismaClient } from '../../db/prisma.js';

import { banPgDistrictSchema } from '../district/schema.js';

export { exportNdjson } from '@ban/prisma-client'


const logger = {
  ...console,
  verbose: (...args: unknown[]) => console.log(...args),
};

// type Prisma = typeof import('@prisma/client');
// type PrismaClient = typeof prisma;
type PrismaClient = ReturnType<typeof getPrismaClient>;

// -------------------------------------------------------
/// HELPERS
/// -------------------------------------------------------

// // Helper to check if a value is a non-null object
// const isObject = (value: unknown): value is Record<string, unknown> => {
//   return typeof value === 'object' && value !== null && !Array.isArray(value);
// }

// Helper to convert BanDistrict to BanPgDistrict
const banDistrictToBanPgDistrict = ({...districtRaw}: Partial<BanDistrict>): BanPgDistrict => {
    const parsedDistrict = banPgDistrictSchema.parse(districtRaw);
    logger.verbose('Parsed district for PG:');
    logger.dir(parsedDistrict, { depth: null });
    return parsedDistrict;
}

// // Helper to extract COG from district meta
// // const getDistrictCog = (meta: Prisma.JsonValue | undefined): string | null => {
// const getDistrictCog = (meta: Prisma | undefined): string | null => {
//   if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
//     return null;
//   }

//   const insee = (meta as { insee?: unknown }).insee;
//   if (!insee || typeof insee !== 'object' || Array.isArray(insee)) {
//     return null;
//   }

//   const cog = (insee as { cog?: unknown }).cog;
//   return typeof cog === 'string' ? cog : null;
// }

/// -------------------------------------------------------
/// READ/WRITE/UPDATE DISTRICTS FROM PG DB
/// -------------------------------------------------------

// const getDistrict = districtID => District.findByPk(districtID, {raw: true})
const getDistrict = async (prismaClient: PrismaClient, districtID: string): Promise<BanPgDistrict | null> => {
  logger.info(`🏘️ Reading district with ID ${districtID} from PG DB…`);
  try {
    const district = await prismaClient.district.findUnique({
      where: { id: districtID },
    });
    logger.info(`🏘️ >>> findUnique :: District with ID ${districtID} read from PG DB`, "\n", district, "\n \n");

    // // ------------------

    // const districtWithValidity = await prismaClient.district.findUniqueWithValidity(
    //   districtID,
    //   { normalize: true }
    // );
    // logger.info(`🏘️ >>> districtWithValidity :: District with ID ${districtID} read from PG DB`, "\n", districtWithValidity, "\n \n");

    // // const districtHistoryManyWithValidity = await prismaClient.history.district.findManyWithValidity(
    // //   { where: { id: districtID, normalize: true } },
    // // );
    // // logger.info(`🏘️ >>> districtHistoryManyWithValidity :: District with ID ${districtID} read from PG DB`, "\n", districtHistoryManyWithValidity, "\n \n");

    // const districtTimelineDiff = await prismaClient.timeline.district.diff(
    //   districtID,
    //   '2025-01-01',
    //   '2025-11-30',
    //   { 
    //     includeSnapshots: true,
    //     normalize: true,
    //    }
    // );
    // logger.info(`🏘️ >>> districtTimelineDiff :: District with ID ${districtID} read from PG DB`, "\n", districtTimelineDiff, "\n \n");

    // // const district_B: BanPgDistrict[] = await prismaClient.$queryRaw`
    // //   SELECT *, "range_validity"::text FROM "ban"."district" LIMIT 1
    // // `;
    // // logger.info(`🏘️ >>> District B with ID ${districtID} read from PG DB`, "\n", district_B, "\n \n");

    // // const district = district_B[0];
    // // const district = district_A;

    // // ------------------

    // ------------------

    const from = '2025-10-06T00:00:00.000Z'
    const to   = '2025-10-12T00:00:00.000Z'
    // const geo = { kind: 'commune', cog: '64102' } as const // Bayonne
    // const geo = { kind: 'departement', dep: '64' } as const // Pyrénées-Atlantiques
    const geo = { kind: 'departement', dep: '31' } as const // Pyrénées-Atlantiques

    const stream = prismaClient.timeline.exportNdjson({
      from,
      to,
      // geo: { kind: 'departement', dep: '64' },
      geo,
      types: ['districts', 'toponyms', 'addresses'], // optionnel, défaut = all
      take: 500,
      progressEvery: 500,
      skip: 0,
      normalize: true,
      includeChanges: false, // si true => ajoute `changes` sur updated
      ignorePaths: ['updatedAtPrecise', /^validity(\.|$)/],
    })

    // stream.on('data', (chunk: Buffer) => {
    //   logger.verbose('Received chunk from timeline export stream:');
    //   logger.verbose(chunk.toString());
    // })

    void (async () => {
      for await (const chunk of stream) {
        logger.verbose('🎁 Received chunk from timeline export stream:');
        logger.verbose(JSON.parse(chunk.toString()));
      }
    })();


    // const res = await prismaClient.timeline.address.diffWindow({
    //   from,
    //   to,
    //   geo,
    //   take: 50,
    //   skip: 0,
    //   normalize: true,
    //   diff: {
    //     includeSnapshots: false,
    //     ignorePaths: [
    //       'updatedAtPrecise',
    //       /^validity(\.|$)/,
    //     ],
    //   },
    // })

    // console.log({
    //   total: res.total,
    //   ids: res.ids,
    //   firstDiff: res.diffs?.[0],
    // })

    // ------------------

    // const res2 = await prismaClient.timeline.common_toponym.diffWindow({
    //   from,
    //   to,
    //   geo,
    //   take: 25,
    //   normalize: true,
    // })

    // console.log({
    //   total: res2.total,
    //   ids: res2.ids,
    //   firstDiff: res2.diffs?.[0],
    // })

    // ------------------

    logger.info(`🏘️ >>> District with ID ${districtID} read from PG DB`, "\n", district, "\n \n");
    return district as unknown as BanPgDistrict | null;
  } catch (error) {
    const { message, cause } = error as Error;
    logger.error(`Can not read district with ID ${districtID} from PG DB:`, (cause as Error)?.message ?? message);
    return null;
  }
}

// const getDistricts = districtIDs => District.findAll({where: {id: districtIDs}, raw: true})
const getDistricts = async (prismaClient: PrismaClient, districtIDs: string[]): Promise<BanPgDistrict[]> => {
  logger.info(`🏘️ Reading districts with IDs ${districtIDs.join(', ')} from PG DB…`);
  try {
    const districts = await prismaClient.district.findMany({
      where: { id: { in: districtIDs } },
    });
    logger.info(`🏘️ >>> Districts with IDs ${districtIDs.join(', ')} read from PG DB`, districts);
    return districts as unknown as BanPgDistrict[];
  } catch (error) {
    const { message, cause } = error as Error;
    logger.error(`Can not read districts with IDs ${districtIDs.join(', ')} from PG DB:`, (cause as Error)?.message ?? message);
    return [];
  }
}

// const getDistrictsFromCog = cog => District.findAll({where: {
//   [Op.or]: [
//     {meta: {insee: {cog}}},
//     {meta: {insee: {mainCog: cog}}},
//   ]
// }, order: [
//   ['isActive', 'DESC'],
//   [Sequelize.literal('(meta#>>\'{insee, isMain}\')::BOOLEAN'), 'DESC'],
//   [Sequelize.literal('labels[1]#>>\'{value}\''), 'ASC']
// ], raw: true})
const getDistrictsFromCog = async (prismaClient: PrismaClient, cog: string): Promise<BanPgDistrict[]> => {
  logger.info(`🏘️ Reading districts with COG ${cog} from PG DB…`);
  try {
    const districtsUnsorted = await prismaClient.district.findMany({
      where: {
        OR: [
          { meta: { path: ['insee', 'cog'], equals: cog } },
          { meta: { path: ['insee', 'mainCog'], equals: cog } },
        ],
      },
      orderBy: [
        { isActive: 'desc' },
        // Note: Sorting by nested JSON fields (meta.insee.isMain) is not supported by Prisma's type-safe API
        // Consider using raw query if this sorting is critical
        // { meta: { insee: { isMain: 'desc' } } },
        // { labels: { value: 'asc' } }, // Note: This may need adjustment based on actual schema
      ],
    });
    logger.info(`🏘️ >>> Districts with COG ${cog} read from PG DB`, districtsUnsorted);

    // Manual sorting to replicate the original logic
    const districtsParsed = districtsUnsorted.map(district => banDistrictToBanPgDistrict(district as unknown as BanDistrict));
    const districts = districtsParsed.sort((a: BanPgDistrict, b: BanPgDistrict) => {
      // First by isActive
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      // Then by meta.insee.isMain
      const aIsMain = a.meta?.insee?.isMain ? 1 : 0;
      const bIsMain = b.meta?.insee?.isMain ? 1 : 0;
      if (aIsMain !== bIsMain) {
        return bIsMain - aIsMain; // Descending
      }
      // Finally by first label value alphabetically
      const aLabel = (a.labels as Label[])?.[0]?.value || '';
      const bLabel = (b.labels as Label[])?.[0]?.value || '';
      return aLabel.localeCompare(bLabel);
    });
    // / Final log after sorting
    logger.info(`🏘️ >>> Districts with COG ${cog} sorted`, districts);

    return districts as unknown as BanPgDistrict[];
  } catch (error) {
    const { message, cause } = error as Error;
    logger.error(`Can not read districts with COG ${cog} from PG DB:`, (cause as Error)?.message ?? message);
    return [];
  }
}

// // const getDistrictsFromCogs = (cogs = []) => District.findAll({where: {meta: {insee: {cog: {[Op.in]: cogs}}}}, raw: true})
// const getDistrictsFromCogs = async (prismaClient: PrismaClient, cogs: string[]): Promise<BanPgDistrict[]> => {
//   logger.info(`🏘️ Reading districts with COGs ${cogs.join(', ')} from PG DB…`);
//   try {
//     const districts = await prismaClient.district.findMany({
//       where: {
//         OR: cogs.map((cog) => ({
//           meta: { path: ['insee', 'cog'], equals: cog },
//         })),
//       },
//     });
//     logger.info(`🏘️ >>> Districts with COGs ${cogs.join(', ')} read from PG DB`, districts);
//     return districts as unknown as BanPgDistrict[];
//   } catch (error) {
//     const { message, cause } = error as Error;
//     logger.error(`Can not read districts with COGs ${cogs.join(', ')} from PG DB:`, (cause as Error)?.message ?? message);
//     return [];
//   }
// }

// // const setDistricts = districts => District.bulkCreate(districts)
// const setDistricts = async (prismaClient: PrismaClient, districts: Partial<BanDistrict>[]): Promise<BanPgDistrict[]> => {
//   logger.info(`🏘️ Inserting multiple districts into PG DB…`);
//   try {
//     const districtsCreated = await prismaClient.district.createMany({
//       // data: districts as unknown as Prisma.districtCreateManyInput[],
//       data: districts.map(district => banDistrictToBanPgDistrict(district)),
//       skipDuplicates: true,
//     });
//     logger.info(`🏘️ >>> Multiple districts inserted into PG DB`, districtsCreated);
//     return districtsCreated as unknown as BanPgDistrict[];
//   } catch (error) {
//     const { message, cause } = error as Error;
//     logger.error(`Can not insert multiple districts into PG DB:`, (cause as Error)?.message ?? message);
//     return [];
//   }
// }

// // const getCogFromDistrictID = async districtID => {
// //   const district = await District.findByPk(districtID, {raw: true})
// //   return district ? district.meta?.insee?.cog : null
// // }
// const getCogFromDistrictID = async (prismaClient: PrismaClient, districtID: string): Promise<string | null> => {
//   logger.info(`🏘️ Reading COG from district ID ${districtID} in PG DB…`);
//   try {
//     const district = await prismaClient.district.findUnique({
//       where: { id: districtID },
//     });
//     const cog = getDistrictCog(district?.meta as Prisma | undefined);
//     logger.info(`🏘️ >>> COG from district ID ${districtID} read from PG DB:`, cog);
//     return cog;
//   } catch (error) {
//     const { message, cause } = error as Error;
//     logger.error(`Can not read COG from district ID ${districtID} in PG DB:`, (cause as Error)?.message ?? message);
//     return null;
//   }
// }

// // const updateDistricts = districts => {
// //   const promises = districts.map(district => District.update({...district, isActive: true}, {where: {id: district.id}}))
// //   return Promise.all(promises)
// // }
// const updateDistricts = async (prismaClient: PrismaClient, districts: Partial<BanDistrict>[]): Promise<BanPgDistrict[]> => {
//   logger.info(`🏘️ Updating multiple districts in PG DB…`);
//   try {
//     const updatePromises = districts.map(async (district) => {
//       const updatedDistrict = await prismaClient.district.update({
//         where: { id: district.id! },
//         data: { ...district, isActive: true } as unknown as typeof district,
//       });
//       return updatedDistrict as unknown as BanPgDistrict;
//     });
//     const updatedDistricts = await Promise.all(updatePromises);
//     logger.info(`🏘️ >>> Multiple districts updated in PG DB`, updatedDistricts);
//     return updatedDistricts;
//   } catch (error) {
//     const { message, cause } = error as Error;
//     logger.error(`Can not update multiple districts in PG DB:`, (cause as Error)?.message ?? message);
//     return [];
//   }
// }

// // const patchDistricts = async districts => {
// //   const bulkOperations = districts.map(async district => {
// //     // Separate meta from the rest of the object to process the update separately
// //     const {meta, ...districtRest} = district
// //     const districtID = district.id
// //     const districtDB = await District.findByPk(districtID)
// //     districtDB.set({...districtRest, isActive: true})
// //     districtDB.meta = {...districtDB.meta, ...meta}
// //     return districtDB.save()
// //   })
// //   return Promise.all(bulkOperations)
// // }
// const patchDistricts = async (prismaClient: PrismaClient, districts: Partial<BanDistrict>[]): Promise<BanPgDistrict[]> => {
//   logger.info(`🏘️ Patching multiple districts in PG DB…`);
//   try {
//     const patchPromises = districts.map(async (district) => {
//       const districtID = district.id!;
//       // Fetch existing district
//       const existingDistrict = await prismaClient.district.findUnique({
//         where: { id: districtID },
//       });
//       if (!existingDistrict) {
//         throw new Error(`District with ID ${districtID} not found for patching.`);
//       }
//       // Merge meta separately
//       const existingMeta = isObject(existingDistrict.meta) ? existingDistrict.meta : {};
//       const incomingMeta = isObject(district.meta) ? district.meta : {};
//       const updatedMeta = {
//         ...existingMeta,
//         ...incomingMeta,
//       };
//       const updatedDistrict = await prismaClient.district.update({
//         where: { id: districtID },
//         data: {
//           ...district,
//           isActive: true,
//           meta: updatedMeta,
//         } as unknown as typeof district,
//         // } as unknown as Prisma.districtUpdateInput,
//       });
//       return updatedDistrict as unknown as BanPgDistrict;
//     });
//     const patchedDistricts = await Promise.all(patchPromises);
//     logger.info(`🏘️ >>> Multiple districts patched in PG DB`, patchedDistricts);
//     return patchedDistricts;
//   } catch (error) {
//     const { message, cause } = error as Error;
//     logger.error(`Can not patch multiple districts in PG DB:`, (cause as Error)?.message ?? message);
//     return [];
//   }
// }

// // const deleteDistrict = districtID => District.update({isActive: false}, {where: {id: districtID}})
// const deleteDistrict = async (prismaClient: PrismaClient, districtID: string): Promise<void> => {
//   logger.info(`🏘️ Deleting district with ID ${districtID} in PG DB…`);
//   try {
//     await prismaClient.district.update({
//       where: { id: districtID },
//       data: { isActive: false },
//     });
//     logger.info(`🏘️ >>> District with ID ${districtID} deleted in PG DB`);
//   } catch (error) {
//     const { message, cause } = error as Error;
//     logger.error(`Can not delete district with ID ${districtID} in PG DB:`, (cause as Error)?.message ?? message);
//   }
// }

// // const deleteDistricts = districtIDs => District.update({isActive: false}, {where: {id: districtIDs}})
// const deleteDistricts = async (prismaClient: PrismaClient, districtIDs: string[]): Promise<void> => {
//   logger.info(`🏘️ Deleting districts with IDs ${districtIDs.join(', ')} in PG DB…`);
//   try {
//     await prismaClient.district.updateMany({
//       where: { id: { in: districtIDs } },
//       data: { isActive: false },
//     });
//     logger.info(`🏘️ >>> Districts with IDs ${districtIDs.join(', ')} deleted in PG DB`);
//   } catch (error) {
//     const { message, cause } = error as Error;
//     logger.error(`Can not delete districts with IDs ${districtIDs.join(', ')} in PG DB:`, (cause as Error)?.message ?? message);
//   }
// }

export class District {
  constructor(private prismaClient: ReturnType<typeof getPrismaClient>) {}

  public async getDistrict(districtID: string): Promise<BanPgDistrict | null> {
    return getDistrict(this.prismaClient, districtID);
  }

  public async getDistricts(districtIDs: string[]): Promise<BanPgDistrict[]> {
    return getDistricts(this.prismaClient, districtIDs);
  }

  public async getDistrictsFromCog(cog: string): Promise<BanPgDistrict[]> {
    return getDistrictsFromCog(this.prismaClient, cog);
  }
}
