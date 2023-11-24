import {bddCommonToponymMock} from './common-toponym-data-mock.js'

export async function getCommonToponyms(commonToponymIDs) {
  return bddCommonToponymMock.filter(({id}) => commonToponymIDs.includes(id))
}

export async function getAllCommonToponymIDsWithHashFromDistrict(districtID) {
  return bddCommonToponymMock.filter(({districtID: districtIDCommonToponym}) => districtIDCommonToponym === districtID).map(({id}) => id)
}

export async function getAllCommonToponymIDsOutsideDistrict(commonToponymIDs, districtID) {
  return bddCommonToponymMock.filter(({id, districtID: districtIDCommonToponym}) => commonToponymIDs.includes(id) && districtIDCommonToponym !== districtID).map(({id}) => id)
}
