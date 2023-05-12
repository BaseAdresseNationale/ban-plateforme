import {bddDistrictMock} from './district-data-mock.js'

export async function getDistricts(districtIDs) {
  return bddDistrictMock.filter(({id}) => districtIDs.includes(id))
}
