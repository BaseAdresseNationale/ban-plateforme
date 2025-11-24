import type {
  BalAdresse,
  BalVersion,
} from '@ban/types';
import type { Config } from '@ban/types';
import type { BanAddress, Position } from '@ban/types';

import getLabels, { DEFAULT_ISO_LANG } from '../../../utils/getLabels.js';
import { numberForTopo as IS_TOPO_NB } from '../bal-converter.config.js';
import { convertBalPositionTypeToBanPositionType } from './index.js';
import digestIDsFromBalAddr from './digest-ids-from-bal-addr.js';

const DEFAULT_BAN_ADDR_POSITION = 'other';

const balAddrToBanAddr = (
  balAdresse: BalAdresse,
  oldBanAddress?: BanAddress,
  balVersion?: BalVersion,
  districtConfig?: Config,
): BanAddress | undefined => {
  const { addressID, mainTopoID, secondaryTopoIDs, districtID } =
    digestIDsFromBalAddr(balAdresse, balVersion);
  const addrNumber = balAdresse.numero ?? oldBanAddress?.number;
  const positionType = convertBalPositionTypeToBanPositionType(
    balAdresse.position
  );
  const suffix = balAdresse.suffixe;
  const defaultBalLang = districtConfig?.defaultBalLang || DEFAULT_ISO_LANG;
  const labels = balAdresse.lieudit_complement_nom
    ? getLabels(
      balAdresse,
      'lieudit_complement_nom',
      defaultBalLang
    )
    : undefined;

  const balMeta = {
    ...(balAdresse.commune_deleguee_insee
      ? { codeAncienneCommune: balAdresse.commune_deleguee_insee }
      : {}),
    ...(balAdresse.commune_deleguee_nom
      ? { nomAncienneCommune: balAdresse.commune_deleguee_nom }
      : {}),
    ...(balAdresse.cle_interop ? { cleInterop: balAdresse.cle_interop } : {}),
  };
  const meta = {
    ...(balAdresse.cad_parcelles && balAdresse.cad_parcelles.length > 0
      ? { cadastre: { ids: balAdresse.cad_parcelles } }
      : {}),
    ...(Object.keys(balMeta).length ? { bal: balMeta } : {}),
  };

  const banAddress =
    addrNumber !== undefined && addrNumber !== Number(IS_TOPO_NB)
      ? {
        ...(oldBanAddress || {}),
        id: addressID,
        districtID,
        mainCommonToponymID: mainTopoID,
        secondaryCommonToponymIDs: secondaryTopoIDs,
        number: addrNumber,
        positions: [
          // Previous positions
          ...(oldBanAddress?.positions || []),
          {
            type: positionType || DEFAULT_BAN_ADDR_POSITION,
            geometry: {
              type: 'Point',
              coordinates: [balAdresse.long, balAdresse.lat],
            },
          },
        ] as Position[],
        certified: balAdresse.certification_commune,
        updateDate: balAdresse.date_der_maj,
        ...(labels
          ? {
            labels: Object.entries(labels).map(([isoCode, value]) => ({
              isoCode,
              value: value as string,
            })),
          }
          : {}),
        ...(suffix ? { suffix } : {}),
        ...(Object.keys(meta).length ? { meta } : {}),
      }
      : undefined;

  return banAddress;
};

export default balAddrToBanAddr;
