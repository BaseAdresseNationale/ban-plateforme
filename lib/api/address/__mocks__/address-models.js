import {bddAddressMock} from './address-data-mock.js'

export async function getAddresses(addressIDs) {
  return bddAddressMock.filter(({id}) => addressIDs.includes(id))
}

export async function getAllAddressIDsFromCommune(codeCommune) {
  return bddAddressMock.filter(({codeCommune: codeCommuneAddress}) => codeCommuneAddress === codeCommune).map(({id}) => id)
}

export async function getAllAddressIDsOutsideCommune(addressIDs, codeCommune) {
  return bddAddressMock.filter(({id, codeCommune: codeCommuneAddress}) => addressIDs.includes(id) && codeCommuneAddress !== codeCommune).map(({id}) => id)
}
