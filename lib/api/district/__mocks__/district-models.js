import {bddDistrictMock} from './district-data-mock.js'

export async function getDistricts(districtIDs) {
  return bddDistrictMock.filter(({id}) => districtIDs.includes(id))
}

export async function getDistrictsFromCog(cog) {
  return bddDistrictMock.filter(district => district.meta?.insee?.cog === cog || district.meta?.insee?.mainCog === cog)
}

export async function getCogFromDistrictID(districtID) {
  const district = bddDistrictMock.find(({id}) => id === districtID)
  return district ? district.meta?.insee?.cog : null
}

export async function isAuthorizedCog(_cog) {
  return false
}

export async function addAuthorizedCogs(cogs) {
  return {
    insertedCount: cogs.length,
    alreadyExist: 0,
    duplicatesInRequest: 0
  }
}

export async function removeAuthorizedCogs(cogs) {
  return {
    deletedCount: cogs.length,
    notFound: 0,
    duplicatesInRequest: 0
  }
}

export async function getAllAuthorizedCogs() {
  return []
}
