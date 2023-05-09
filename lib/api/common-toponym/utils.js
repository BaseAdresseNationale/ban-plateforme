import {checkDataFormat, dataValidationReportFrom, checkIdsIsUniq, checkIdsIsVacant, checkIdsIsAvailable, checkDataShema, checkIdsShema} from '../helper.js'
import {getCommonToponyms, getAllCommonToponymIDsFromCommune, getAllCommonToponymIDsOutsideCommune} from './models.js'
import {banCommonToponymSchema, banCommonToponymID} from './schema.js'

const getExistingCommonToponymIDs = async commonToponymIDs => {
  const existingCommonToponyms = await getCommonToponyms(commonToponymIDs)
  return existingCommonToponyms.map(commonToponym => commonToponym.id)
}

export const checkCommonToponymsIDsRequest = async (commonToponymIDs, actionType, defaultReturn = true) => {
  let report = checkDataFormat(
    `The request require an Array of common toponym IDs but receive ${typeof commonToponymIDs}`,
    'No common toponym ID send to job',
    commonToponymIDs
  ) || await checkIdsShema('Invalid IDs format', commonToponymIDs, banCommonToponymID)

  if (!report) {
    switch (actionType) {
      case 'insert':
        report = (
          checkIdsIsUniq('Shared IDs in request', commonToponymIDs)
          || await checkIdsIsVacant('Unavailable IDs', commonToponymIDs, getExistingCommonToponymIDs)
        )
        break
      case 'update':
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
      report = checkDataFormat(
        `The request require an Array of common toponym but receive ${typeof commonToponyms}`,
        'No common toponym send to job',
        commonToponyms
      )
        || await checkCommonToponymsIDsRequest(commonToponyms.map(commonToponym => commonToponym.id), actionType, false)
        || await checkDataShema('Invalid common toponym format', commonToponyms, banCommonToponymSchema)
        || dataValidationReportFrom(true)
      break
    default:
      report = dataValidationReportFrom(false, 'Unknown action type', {actionType, commonToponyms})
  }

  return report
}

export const getDeltaReport = async (commonToponymIDs, codeCommune) => {
  const allCommonToponymIDsFromCommune = await getAllCommonToponymIDsFromCommune(codeCommune)

  let idsToCreate = commonToponymIDs.filter(id => !allCommonToponymIDsFromCommune.includes(id))
  const idsToUpdate = commonToponymIDs.filter(id => allCommonToponymIDsFromCommune.includes(id))
  const idsToDelete = allCommonToponymIDsFromCommune.filter(id => !commonToponymIDs.includes(id))

  const idsUnauthorized = await getAllCommonToponymIDsOutsideCommune(idsToCreate, codeCommune)
  if (idsUnauthorized.length > 0) {
    idsToCreate = idsToCreate.filter(id => !idsUnauthorized.includes(id))
  }

  return {idsToCreate, idsToUpdate, idsToDelete, idsUnauthorized}
}
