import digestIDsFromBalAddr from './digest-ids-from-bal-addr.js';
import { numberForTopo as IS_TOPO_NB } from './bal-converter.config.js';

import type { Bal, BalVersion } from '@ban/types';

const validator = async (
  districtIDs: string[],
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
        throw new Error(
          `**Missing districtID** \nBAL from district ID : \`${districtID}\` (cog : \`${cog}\`) \nBAL address line detail : \n\`\`\`JSON\n${JSON.stringify(balAdresse, null, 2)}\n\`\`\``
        );
      }

      if (!mainTopoID) {
        throw new Error(
          `**Missing mainTopoID** \nBAL from district ID : \`${districtID}\` (cog : \`${cog}\`) \nBAL address line detail : \n\`\`\`JSON\n${JSON.stringify(balAdresse, null, 2)}\n\`\`\``
        );
      }

      if (balAdresse.numero !== Number(IS_TOPO_NB) && !addressID) {
        throw new Error(
          `**Missing addressID** \nBAL from district ID : \`${districtID}\` (cog : \`${cog}\`) \nBAL address line detail : \n\`\`\`JSON\n${JSON.stringify(balAdresse, null, 2)}\n\`\`\``
        );
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
    if (!districtIDsExtracted.every(districtIDExtracted => districtIDs.includes(districtIDExtracted))) {
      const unauthorizedDistrictIDs = districtIDsExtracted.filter(districtIDExtracted => !districtIDs.includes(districtIDExtracted));
      throw new Error(`**Missing rights** \ndistrictIDs ${unauthorizedDistrictIDs} are not part of the authorized districts to be updated`);
    }
    return true;
  } else if (balAddressDoNotUseBanId === bal.length) {
    return false;
  } else {
    throw new Error(`**Missing IDs** \nBAL : \`${cog}\` \nSome BAL address lines are using BanIDs and some are not`);
  }
};

export default validator;
