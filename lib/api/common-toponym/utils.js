import {checkDataFormat, dataValidationReportFrom, checkIdsIsUniq, checkIdsIsVacant, checkIdsIsAvailable, checkDataShema, checkIdsShema, checkIfDistrictsExist} from '../helper.js'
import {banID} from '../schema.js'
import {getCogFromDistrictID, isAuthorizedCog} from '../district/models.js'
import {getCommonToponymsByFilters} from './models.js'
import {banCommonToponymSchema} from './schema.js'

const getExistingCommonToponymIDs = async commonToponymIDs => {
  const existingCommonToponyms = await getCommonToponymsByFilters({id: commonToponymIDs}, ['id'])
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

// For identifying a department based on the COG (official geographic code):
// For metropolitan France, use the first 2 characters,
// and for overseas departments (DOM-TOM), use the first 3 characters.
const getDepartmentSliceLength = districtID => districtID > '95' ? 3 : 2

export const getDeltaReport = async (commonToponymIDsWithHash, districtID) => {
  const idsToCreate = []
  const idsToUpdate = []
  const idsToDelete = []
  const idsUnauthorized = []

  // Get all existing common toponyms inside and outside the district from db
  const commonToponymIDs = commonToponymIDsWithHash.map(({id}) => id)
  const existingCommonToponyms = await getCommonToponymsByFilters({id: commonToponymIDs}, ['id', 'meta', 'isActive', 'districtID'])
  const existingCommonToponymsMap = new Map(existingCommonToponyms.map(({id, meta, isActive, districtID}) => [id, {hash: meta?.idfix?.hash, isActive, districtID}]))
  const currentCog = await getCogFromDistrictID(districtID)
  const isCurrentCogAuthorized = await isAuthorizedCog(currentCog)
  for (const {id, hash} of commonToponymIDsWithHash) {
    if (existingCommonToponymsMap.has(id)) {
      const existingCommonToponymDistrictID = existingCommonToponymsMap.get(id).districtID

      // eslint-disable-next-line no-negated-condition
      if (existingCommonToponymDistrictID !== districtID) {
        // eslint-disable-next-line no-await-in-loop
        const existingCog = await getCogFromDistrictID(existingCommonToponymDistrictID)
        // Departement check

        // Vérifier si les DEUX COG sont autorisés
        // eslint-disable-next-line no-await-in-loop
        const isExistingCogAuthorized = await isAuthorizedCog(existingCog)

        // Vérifier s'ils sont dans le même département
        const sliceLength = getDepartmentSliceLength(currentCog)
        const isSameDepartment = currentCog.slice(0, sliceLength) === existingCog.slice(0, sliceLength)

        // Les DEUX COG doivent être autorisés ET dans le même département
        if (isCurrentCogAuthorized && isExistingCogAuthorized && isSameDepartment) {
          idsToUpdate.push(id)
        } else {
          idsUnauthorized.push(id)
          console.log(`Warning: Common toponym with ID ${id} belongs to a different district (current: ${currentCog}, existing: ${existingCog}). This addition will be ignored as it already exists elsewhere.`)
        }
      } else {
      // The common toponym is already existing in the db
        const existingCommonToponymIsActive = existingCommonToponymsMap.get(id).isActive
        const existingCommonToponymHash = existingCommonToponymsMap.get(id).hash
        // If the common toponym has a different hash we need to update it
        // If the common toponym is not active, it means that we need to reactivate it (even if the hash is the same)

        if (existingCommonToponymHash !== hash || !existingCommonToponymIsActive) {
          idsToUpdate.push(id)
        }
      }
    } else {
      // The common toponym is not existing in the db
      idsToCreate.push(id)
    }
  }

  // Get all common toponyms that are part of the district from the db
  const allCommonToponymsFromDistrict = await getCommonToponymsByFilters({districtID}, ['id', 'meta', 'isActive'])
  const allCommonToponymsFromDistrictMap = new Map(allCommonToponymsFromDistrict.map(({id, meta, isActive}) => [id, {hash: meta?.idfix?.hash, isActive}]))
  const commonToponymIDsWithHashMap = new Map(commonToponymIDsWithHash.map(({id, hash}) => [id, hash]))
  for (const id of allCommonToponymsFromDistrictMap.keys()) {
    // If a common toponym is in the district but not in the request, we need to delete it (only if not active)
    const commonToponymFromDistrictIsActive = allCommonToponymsFromDistrictMap.get(id).isActive
    if (!commonToponymIDsWithHashMap.has(id) && commonToponymFromDistrictIsActive) {
      idsToDelete.push(id)
    }
  }

  return {idsToCreate, idsToUpdate, idsToDelete, idsUnauthorized}
}

export const formatCommonToponym = commonToponym => {
  const {range_validity: rangeValidity, ...commonToponymRest} = commonToponym
  const lastRecordDate = rangeValidity[0].value
  return {...commonToponymRest, lastRecordDate}
}
