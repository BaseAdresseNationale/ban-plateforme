import {bddAddressMock} from './address-data-mock.js'

export async function getAddresses(addressIDs) {
  return bddAddressMock.filter(({id}) => addressIDs.includes(id))
}
