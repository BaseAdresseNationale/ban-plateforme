import { Bal, BalVersion } from '@ban/types';
import { digestIDsFromBalAddr } from './index.js';
import { numberForTopo as IS_TOPO_NB } from '../bal-converter.config.js';
import { MessageCatalog } from '../../../utils/status-catalog.js';
const validator = async (
  districtIDsFromDB: string[],
  bal: Bal,
  version: BalVersion,
  { cog }: { cog: string }
) => {
  let balAdresseUseBanId = 0
  let balAddressDoNotUseBanId = 0
  const districtIDsExtracted: string[] = [];

  for (const balAdresse of bal) {
    // Check presence and format of BanIDs
    const { districtID, mainTopoID, addressID } = digestIDsFromBalAddr(
      balAdresse,
      version
    );

    // If at least one of the IDs is present, it means that the BAL address is using BanID
    if (districtID || mainTopoID || addressID) {
      if (!districtID) {
        throw new Error(MessageCatalog.ERROR.MISSING_DISTRICT_ID.template(districtID || 'unknown', cog, balAdresse));
      }
      if (!mainTopoID) {
        throw new Error(MessageCatalog.ERROR.MISSING_MAIN_TOPO_ID.template(districtID, cog, balAdresse));
      }
      if (balAdresse.numero !== Number(IS_TOPO_NB) && !addressID) {
        throw new Error(MessageCatalog.ERROR.MISSING_ADDRESS_ID.template(districtID, cog, balAdresse));
      }

      balAdresseUseBanId++
      if (!districtIDsExtracted.includes(districtID)) {
        districtIDsExtracted.push(districtID);
      }
    } else {
      balAddressDoNotUseBanId++;
    }
  }

  if (balAdresseUseBanId === bal.length) {
    // Check district IDs consistency
    if (!districtIDsExtracted.every(districtIDExtracted => districtIDsFromDB.includes(districtIDExtracted))) {
      const unauthorizedDistrictIDs = districtIDsExtracted.filter(districtIDExtracted => !districtIDsFromDB.includes(districtIDExtracted));
      throw new Error(MessageCatalog.ERROR.MISSING_RIGHTS.template(unauthorizedDistrictIDs));
    }
    return true;
  } else if (balAddressDoNotUseBanId === bal.length) {
    return false;
  } else {
    throw new Error(MessageCatalog.ERROR.MIXED_ID_USAGE.template(cog));
  }
};

export default validator;
