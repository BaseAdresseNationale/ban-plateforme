import type { Bal } from '@ban/types';

const getBalVersion = (bal: Bal) => {
  const { id_ban_commune: districtID } = bal[0];

  // If column id_ban_commune is defined in BAL csv, the BAL is using version 1.4
  // If not, we consider that the BAL is using version 1.3
  if (districtID) {
    return '1.4';
  }

  return '1.3';
};

export default getBalVersion;
