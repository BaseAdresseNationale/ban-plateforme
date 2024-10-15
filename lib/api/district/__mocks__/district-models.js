import {bddDistrictMock} from './district-data-mock.js'

export async function getDistricts(districtIDs) {
  return bddDistrictMock.filter(({id}) => districtIDs.includes(id))
}

export async function getCogFromDistrictID(districtID) {
  const district = bddDistrictMock.find(({id}) => id === districtID)
  return district ? district.meta?.insee?.cog : null
}
