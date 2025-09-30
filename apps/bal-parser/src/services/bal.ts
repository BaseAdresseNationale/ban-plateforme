import { getDistrictFromCOG } from './cog.js';
import { BanDistrict } from '@ban/ban-types.js';
import { getRevisionData } from "../helpers/dump-api/index.js";
import validator from '../helpers/validator.js';
import csvBalToJsonBal from '../helpers/csv-bal-to-json-bal.js';
import getBalVersion from '../helpers/get-bal-version.js';
const getDistrictIDsFromDB = async (cog: string) => {

  const districts: BanDistrict[] = await getDistrictFromCOG(cog);
  if (!districts.length) {
    throw new Error(`No district found with cog ${cog}`);
  }
  
  const districtIDsFromDB = districts.map((district) => district.id);

  return districtIDsFromDB
}

const getBalDataAndCheckIntegrity = async (rows: any) => {
  
  const res = await Promise.all(rows.map(async (row:any)=>{
    await new Promise(resolve => setTimeout(resolve, 3000));
    // console.log('row=', JSON.stringify(row));

    // Get BAL text data from dump-api
    const { revision, balTextData: balCsvData } = await getRevisionData(row.commune_insee);

    // Convert csv to json
    const bal = csvBalToJsonBal(balCsvData);
  
    // Detect BAL version
    const version = getBalVersion(bal);

    const districtIDsFromDB = await getDistrictIDsFromDB(row.commune_insee);

    let useBanId = false;
    useBanId = await validator(districtIDsFromDB, bal, version, { cog: row.commune_insee });
    
    return useBanId;
  }));
  return res;
};

export {
    getBalDataAndCheckIntegrity,
    getDistrictIDsFromDB,
}