import {checkDataFormat, dataValidationReportFrom, checkIdsIsUniq, checkIdsIsVacant, checkIdsIsAvailable, checkDataShema, checkIdsShema, checkIfDistrictsExist} from '../helper.js'
import {banID} from '../schema.js'
import {getCommonToponyms, getAllCommonToponymIDsWithHashFromDistrict, getAllCommonToponymIDsOutsideDistrict} from './models.js'
import {banCommonToponymSchema} from './schema.js'

const getExistingCommonToponymIDs = async commonToponymIDs => {
  const existingCommonToponyms = await getCommonToponyms(commonToponymIDs)
  return existingCommonToponyms.map(commonToponym => commonToponym.id)
}

export const checkCommonToponymsIDsRequest = async (commonToponymIDs, actionType, defaultReturn = true) => {
  let report = checkDataFormat(
    `The request require an Array of common toponym IDs but receive ${typeof commonToponymIDs}`,
    'No common toponym ID send to job',
    commonToponymIDs
  ) || await checkIdsShema('Invalid IDs format', commonToponymIDs, banID)

  if (!report) {
    switch (actionType) {
      case 'insert':
        report = (
          checkIdsIsUniq('Shared IDs in request', commonToponymIDs)
          || await checkIdsIsVacant('Unavailable IDs', commonToponymIDs, getExistingCommonToponymIDs)
        )
        break
      case 'update':
      case 'patch':
        report = (
          checkIdsIsUniq('Shared IDs in request', commonToponymIDs)
          || await checkIdsIsAvailable('Some unknown IDs', commonToponymIDs, getExistingCommonToponymIDs)
        )
        break
      case 'delete':
        report = (
          checkIdsIsUniq('Shared IDs in request', commonToponymIDs)
          || await checkIdsIsAvailable('Some unknown IDs', commonToponymIDs, getExistingCommonToponymIDs)
        )
        break
      default:
        report = dataValidationReportFrom(false, 'Unknown action type', {actionType, commonToponymIDs})
    }
  }

  return report || (defaultReturn && dataValidationReportFrom(true)) || null
}

export const checkCommonToponymsRequest = async (commonToponyms, actionType) => {
  let report

  switch (actionType) {
    case 'insert':
    case 'update':
    case 'patch':
      report = checkDataFormat(
        `The request require an Array of common toponym but receive ${typeof commonToponyms}`,
        'No common toponym send to job',
        commonToponyms
      )
        || await checkCommonToponymsIDsRequest(commonToponyms.map(commonToponym => commonToponym.id), actionType, false)
        || await checkDataShema('Invalid common toponym format', commonToponyms, banCommonToponymSchema, {isPatch: actionType === 'patch'})
        || await checkIfDistrictsExist(commonToponyms.reduce((acc, {districtID}) => {
          if (districtID) {
            return [...acc, districtID]
          }

          return acc
        }, []))
        || dataValidationReportFrom(true)
      break
    default:
      report = dataValidationReportFrom(false, 'Unknown action type', {actionType, commonToponyms})
  }

  return report
}

export const getDeltaReport = async (commonToponymIDsWithHash, districtID) => {
  const commonToponymIDsWithHashMap = new Map(commonToponymIDsWithHash.map(({id, hash}) => [id, hash]))
  const allCommonToponymIDsWithHashFromDistrict = await getAllCommonToponymIDsWithHashFromDistrict(districtID)
  const allCommonToponymIDsWithHashFromDistrictMap = new Map(allCommonToponymIDsWithHashFromDistrict.map(({id, hash}) => [id, hash]))

  let idsToCreate = []
  const idsToUpdate = []
  const idsToDelete = []

  for (const [id, hash] of commonToponymIDsWithHashMap) {
    if (allCommonToponymIDsWithHashFromDistrictMap.has(id)) {
      if (allCommonToponymIDsWithHashFromDistrictMap.get(id) !== hash) {
        idsToUpdate.push(id)
      }
    } else {
      idsToCreate.push(id)
    }
  }

  for (const id of allCommonToponymIDsWithHashFromDistrictMap.keys()) {
    if (!commonToponymIDsWithHashMap.has(id)) {
      idsToDelete.push(id)
    }
  }

  const idsUnauthorized = await getAllCommonToponymIDsOutsideDistrict(idsToCreate, districtID)
  const idsUnauthorizedSet = new Set(idsUnauthorized)
  if (idsUnauthorized.length > 0) {
    idsToCreate = idsToCreate.filter(id => !idsUnauthorizedSet.has(id))
  }

  return {idsToCreate, idsToUpdate, idsToDelete, idsUnauthorized}
}

export const formatCommonToponym = commonToponym => commonToponym
