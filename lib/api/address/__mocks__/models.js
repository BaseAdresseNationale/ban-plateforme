import {bddMock} from './data-mock.js'

export async function getAddresses(addressIDs) {
  return bddMock.filter(({id}) => addressIDs.includes(id))
}
