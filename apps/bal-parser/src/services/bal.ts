import { getDistrictFromCOG } from './cog.js';
import { BanDistrict } from '@ban/ban-types.js';

const getDistrictIDsFromDB = async (cog: string) => {

  const districts: BanDistrict[] = await getDistrictFromCOG(cog);
  if (!districts.length) {
    throw new Error(`No district found with cog ${cog}`);
  }
  
  const districtIDsFromDB = districts.map((district) => district.id);

  return districtIDsFromDB
}

export {
  getDistrictIDsFromDB,
}