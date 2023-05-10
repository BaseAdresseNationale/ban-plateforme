import {checkDataFormat, dataValidationReportFrom, checkIdsIsUniq, checkIdsIsVacant, checkIdsIsAvailable, checkDataShema, checkIdsShema} from '../helper.js'
import {getDistricts} from './models.js'
import {banDistrictSchema, banDistrictID} from './schema.js'

const getExistingDistrictIDs = async districtIDs => {
  const existingDistricts = await getDistricts(districtIDs)
  return existingDistricts.map(ditrict => ditrict.id)
}

export const checkDistrictsIDsRequest = async (districtIDs, actionType, defaultReturn = true) => {
  let report = checkDataFormat(
    `The request require an Array of district IDs but receive ${typeof districtIDs}`,
    'No district ID send to job',
    districtIDs
  ) || await checkIdsShema('Invalid IDs format', districtIDs, banDistrictID)

  if (!report) {
    switch (actionType) {
      case 'insert':
        report = (
          checkIdsIsUniq('Shared IDs in request', districtIDs)
          || await checkIdsIsVacant('Unavailable IDs', districtIDs, getExistingDistrictIDs)
        )
        break
      case 'update':
        report = (
          checkIdsIsUniq('Shared IDs in request', districtIDs)
          || await checkIdsIsAvailable('Some unknown IDs', districtIDs, getExistingDistrictIDs)
        )
        break
      case 'delete':
        report = (
          checkIdsIsUniq('Shared IDs in request', districtIDs)
          || await checkIdsIsAvailable('Some unknown IDs', districtIDs, getExistingDistrictIDs)
        )
        break
      default:
        report = dataValidationReportFrom(false, 'Unknown action type', {actionType, districtIDs})
    }
  }

  return report || (defaultReturn && dataValidationReportFrom(true)) || null
}

export const checkDistrictsRequest = async (districts, actionType) => {
  let report

  switch (actionType) {
    case 'insert':
    case 'update':
      report = checkDataFormat(
        `The request require an Array of district but receive ${typeof districts}`,
        'No district send to job',
        districts
      )
        || await checkDistrictsIDsRequest(districts.map(district => district.id), actionType, false)
        || await checkDataShema('Invalid format', districts, banDistrictSchema)
        || dataValidationReportFrom(true)
      break
    default:
      report = dataValidationReportFrom(false, 'Unknown action type', {actionType, districts})
  }

  return report
}
