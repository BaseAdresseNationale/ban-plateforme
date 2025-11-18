import { idsIdentifierIndex } from '../../bal-converter.config.js';

export const addrID = 'aaaaaaaa-0000-4aaa-9000-1234567890aa';
export const mainTopoID = 'bbbbbbbb-0000-4aaa-9000-1234567890bb';
export const secondaryTopoIDs = [
  'cccccccc-0000-4aaa-9000-1234567890cc',
  'cccccccc-1111-4aaa-9000-1234567890dd',
  'cccccccc-2222-4aaa-9000-1234567890ee',
];
export const districtID = 'dddddddd-0000-4aaa-9000-1234567890ff';

const {
  addressID: addressIDKey,
  mainTopoID: mainTopoIDKey,
  secondaryTopoIDs: secondaryTopoIDsKey,
  districtID: districtIDKey,
} = idsIdentifierIndex;

export const idSampleWithAddressId = `${addressIDKey}${addrID}`;
export const idSampleWithMainTopoId = `${mainTopoIDKey}${mainTopoID}`;
export const idSampleWithSecondaryTopoId = `${secondaryTopoIDsKey}${secondaryTopoIDs.join(
  '|'
)}`;
export const idSampleWithDistrictId = `${districtIDKey}${districtID}`;

export const idSampleWithAddressIdAndMainTopoId = `${idSampleWithAddressId} ${idSampleWithMainTopoId}`;
export const idSampleWithAddressIdAndSecondaryTopoId = `${idSampleWithAddressId} ${idSampleWithSecondaryTopoId}`;
export const idSampleWithMainTopoIdAndDistrictId = `${idSampleWithMainTopoId} ${idSampleWithDistrictId}`;
export const idSampleWithAllIds = `${idSampleWithAddressId} ${idSampleWithMainTopoId} ${idSampleWithSecondaryTopoId} ${idSampleWithDistrictId}`;
