import type { Bal, BalAdresse } from '@ban/types';

import { v4 as uuidv4 } from 'uuid';

import digestIDsFromBalUIDs from './digest-ids-from-bal-uids.js';
import {
  idsIdentifierIndex,
  numberForTopo as IS_TOPO_NB,
} from '../bal-converter.config.js';

const isTopo = (addrNumber: number | undefined) =>
  !addrNumber || addrNumber === 99999;

const sortBalJSONlegacy = (
  balJSONlegacy: Bal
): (BalAdresse & { index: number })[] =>
  balJSONlegacy
    .map((balAddr, index) => ({ ...balAddr, index }))
    .sort((a, b) => {
      const { uid_adresse: aBanID = '', numero: aAddrNumber } = a;
      const { uid_adresse: bBanID = '', numero: bAddrNumber } = b;

      if (isTopo(aAddrNumber) && !isTopo(bAddrNumber)) return -1;
      if (!isTopo(aAddrNumber) && isTopo(bAddrNumber)) return 1;
      if (isTopo(aAddrNumber) === isTopo(bAddrNumber)) {
        if (aBanID && !bBanID) return -1;
        if (!aBanID && bBanID) return 1;
        if (aBanID.length > bBanID.length) return -1;
        if (aBanID.length < bBanID.length) return 1;
      }
      return 0;
    });

const reOrderBalJSON = (balJSON: (BalAdresse & { index: number })[]): Bal =>
  [...balJSON]
    .sort(({ index: aIndex }, { index: bIndex }) => {
      return aIndex - bIndex;
    })
    .map(({ index, ...balAddr }) => balAddr);

const balJSONlegacy2balJSON = (balJSONlegacy: Bal): Bal => {
  const idsAddrMapping = new Map<string, string>();
  const idMainTopoMapping = new Map<string, string>();
  const idsDistrictMapping = new Map<string, string>();

  return reOrderBalJSON(
    sortBalJSONlegacy(balJSONlegacy).map(
      (balAdresseLegacy: BalAdresse & { index: number }) => {
        const {
          uid_adresse: uidAdresseLegacy,
          commune_insee: inseeCode,
          commune_nom: districtName,
          voie_nom: mainTopoName,
          numero: addrNumber,
          suffixe,
        } = balAdresseLegacy;

        const {
          districtID: rawDistrictID,
          addressID: rawAddressID,
          mainTopoID: rawMainTopoID,
        } = digestIDsFromBalUIDs(uidAdresseLegacy || '');

        // eslint-disable-next-line no-unused-vars
        const getdistrictID = (inseeCode: string, districtName: string) =>
          uuidv4(); // TODO: Implement API // (inseeCode: string, districtName: string) => district.getId(insseeCode, districtName.toLowerCase())
        const districtKey = `${districtName}`;

        if (!idsDistrictMapping.has(districtKey))
          idsDistrictMapping.set(
            districtKey,
            rawDistrictID || getdistrictID(inseeCode, districtName)
          );

        const mainTopoKey = `${mainTopoName}${districtKey}`;
        if (!idMainTopoMapping.has(mainTopoKey))
          idMainTopoMapping.set(mainTopoKey, rawMainTopoID || uuidv4());

        const addrKey = `${addrNumber}${suffixe}${mainTopoKey}${districtKey}`;
        if (!idsAddrMapping.has(addrKey))
          idsAddrMapping.set(addrKey, rawAddressID || uuidv4());

        const idAdresse =
          addrNumber &&
          addrNumber !== Number(IS_TOPO_NB) &&
          idsAddrMapping.get(addrKey);
        const idVoie = idMainTopoMapping.get(mainTopoKey);
        const idCommune = idsDistrictMapping.get(districtKey);

        const districtID =
          idCommune && `${idsIdentifierIndex.districtID}${idCommune}`;
        const banID =
          idAdresse && `${idsIdentifierIndex.addressID}${idAdresse}`;
        const mainTopoID =
          idVoie && `${idsIdentifierIndex.mainTopoID}${idVoie}`;
        const formatedBanIDs =
          `${districtID || ''} ${banID || ''} ${mainTopoID || ''}`
            .replaceAll(/\s+/g, ' ')
            .trim() || undefined;

        return {
          ...balAdresseLegacy,
          uid_adresse: formatedBanIDs,
        };
      }
    )
  );
};

export default balJSONlegacy2balJSON;
