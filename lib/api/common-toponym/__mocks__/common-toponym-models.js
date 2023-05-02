import {bddCommonToponymMock} from './common-toponym-data-mock.js'

export async function getCommonToponyms(commonToponymIDs) {
  return bddCommonToponymMock.filter(({id}) => commonToponymIDs.includes(id))
}

export async function getAllCommonToponymIDsFromCommune(codeCommune) {
  return bddCommonToponymMock.filter(({codeCommune: codeCommuneCommonToponym}) => codeCommuneCommonToponym === codeCommune).map(({id}) => id)
}

export async function getAllCommonToponymIDsOutsideCommune(commonToponymIDs, codeCommune) {
  return bddCommonToponymMock.filter(({id, codeCommune: codeCommuneCommonToponym}) => commonToponymIDs.includes(id) && codeCommuneCommonToponym !== codeCommune).map(({id}) => id)
}
