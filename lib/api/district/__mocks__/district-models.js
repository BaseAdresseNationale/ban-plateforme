import {bddDistrictMock} from './district-data-mock.js'

export async function getDistricts(districtIDs) {
  return bddDistrictMock.filter(({id}) => districtIDs.includes(id))
}

export async function getDistrictsFromCogList(districtCOGs) {
  return bddDistrictMock
    .map(district => [district.meta.insee.cog, district])
    .filter(([cog]) => districtCOGs.includes(cog))
    .map(([, district]) => district)
}
