import type { BalAdresse, BalVersion } from '@ban/types';

import digestIDsFromBalUIDs from './digest-ids-from-bal-uids.js';

const digestIDsFromBalAddr = (
  balAdresse: BalAdresse,
  version: BalVersion = '1.3'
) => {
  switch (version) {
    case '1.3': {
      const { uid_adresse: ids } = balAdresse;
      return digestIDsFromBalUIDs(ids);
    }
    case '1.4':
      return {
        addressID: balAdresse.id_ban_adresse,
        mainTopoID: balAdresse.id_ban_toponyme,
        districtID: balAdresse.id_ban_commune,
      };
    default: {
      const { uid_adresse: ids } = balAdresse;
      return digestIDsFromBalUIDs(ids);
    }
  }
};

export default digestIDsFromBalAddr;
