import {bddCommonToponymMock} from './common-toponym-data-mock.js'

export async function getCommonToponyms(commonToponymIDs) {
  return bddCommonToponymMock.filter(({id}) => commonToponymIDs.includes(id))
}
