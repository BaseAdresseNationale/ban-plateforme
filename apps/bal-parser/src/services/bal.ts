import { getDistrictFromCOG } from './cog.js';
import { BanDistrict } from '@ban/types';

export async function getDistrictIDsFromDB(cog: string, throwError: boolean = false): Promise<string[] | null> {
  const districts: BanDistrict[] = await getDistrictFromCOG(cog);

  if (!districts.length) {
    if (throwError) {
      throw new Error(`No district found with cog ${cog}`);
    } else {
      return null;
    }
  }

  const districtIDsFromDB = districts.map((district) => district.id);

  return districtIDsFromDB;
}
