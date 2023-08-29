import {checkDataFormat, dataValidationReportFrom, checkIdsIsUniq, checkIdsIsVacant, checkIdsIsAvailable, checkDataShema, checkIdsShema, checkIfCommonToponymsExist, checkIfDistrictsExist} from '../helper.js'
import {banID} from '../schema.js'
import {getAddresses, getAllAddressIDsFromDistrict, getAllAddressIDsOutsideDistrict} from './models.js'
import {banAddressSchema} from './schema.js'

const getExistingAddressIDs = async addressIDs => {
  const existingAddresses = await getAddresses(addressIDs)
  return existingAddresses.map(addresses => addresses.id)
}

export const checkAddressesIDsRequest = async (addressIDs, actionType, defaultReturn = true) => {
  let report = checkDataFormat(
    `The request require an Array of address IDs but receive ${typeof addressIDs}`,
    'No address ID send to job',
    addressIDs
  ) || await checkIdsShema('Invalid IDs format', addressIDs, banID)

  if (!report) {
    switch (actionType) {
      case 'insert':
        report = (
          checkIdsIsUniq('Shared IDs in request', addressIDs)
          || await checkIdsIsVacant('Unavailable IDs', addressIDs, getExistingAddressIDs)
        )
        break
      case 'update':
        report = (
          checkIdsIsUniq('Shared IDs in request', addressIDs)
          || await checkIdsIsAvailable('Some unknown IDs', addressIDs, getExistingAddressIDs)
        )
        break
      case 'delete':
        report = (
          checkIdsIsUniq('Shared IDs in request', addressIDs)
          || await checkIdsIsAvailable('Some unknown IDs', addressIDs, getExistingAddressIDs)
        )
        break
      default:
        report = dataValidationReportFrom(false, 'Unknown action type', {actionType, addressIDs})
    }
  }

  return report || (defaultReturn && dataValidationReportFrom(true)) || null
}

export const checkAddressesRequest = async (addresses, actionType) => {
  let report

  switch (actionType) {
    case 'insert':
    case 'update':
      report = checkDataFormat(
        `The request require an Array of address but receive ${typeof addresses}`,
        'No address send to job',
        addresses
      )
        || await checkAddressesIDsRequest(addresses.map(address => address.id), actionType, false)
        || await checkDataShema('Invalid format', addresses, banAddressSchema)
        || await checkIfCommonToponymsExist(addresses.reduce((acc, {mainCommonToponymID, secondaryCommonToponymIDs}) => {
          const ids = [mainCommonToponymID]
          if (secondaryCommonToponymIDs) {
            ids.push(...secondaryCommonToponymIDs)
          }

          return [...acc, ...ids]
        }, []))
        || await checkIfDistrictsExist(addresses.map(({districtID}) => districtID))
        || dataValidationReportFrom(true)
      break
    default:
      report = dataValidationReportFrom(false, 'Unknown action type', {actionType, addresses})
  }

  return report
}

export const getDeltaReport = async (addressIDs, districtID) => {
  const allAddressIDsFromCommune = await getAllAddressIDsFromDistrict(districtID)
  const allAddressIDsFromDistrictSet = new Set(allAddressIDsFromCommune)
  const addressIDsSet = new Set(addressIDs)

  let idsToCreate = []
  const idsToUpdate = []
  const idsToDelete = []

  for (const id of addressIDs) {
    if (allAddressIDsFromDistrictSet.has(id)) {
      idsToUpdate.push(id)
    } else {
      idsToCreate.push(id)
    }
  }

  for (const id of allAddressIDsFromCommune) {
    if (!addressIDsSet.has(id)) {
      idsToDelete.push(id)
    }
  }

  const idsUnauthorized = await getAllAddressIDsOutsideDistrict(idsToCreate, districtID)
  const idsUnauthorizedSet = new Set(idsUnauthorized)
  if (idsUnauthorized.length > 0) {
    idsToCreate = idsToCreate.filter(id => !idsUnauthorizedSet.has(id))
  }

  return {idsToCreate, idsToUpdate, idsToDelete, idsUnauthorized}
}
