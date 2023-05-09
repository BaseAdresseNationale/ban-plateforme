import {bddAddressMock} from './address-data-mock.js'

export async function getAddresses(addressIDs) {
  return bddAddressMock.filter(({id}) => addressIDs.includes(id))
}

export async function getAllAddressIDsFromCommune(districtID) {
  return bddAddressMock.filter(({districtID: districtIDAddress}) => districtIDAddress === districtID).map(({id}) => id)
}

export async function getAllAddressIDsOutsideCommune(addressIDs, districtID) {
  return bddAddressMock.filter(({id, districtID: districtIDAddress}) => addressIDs.includes(id) && districtIDAddress !== districtID).map(({id}) => id)
}
