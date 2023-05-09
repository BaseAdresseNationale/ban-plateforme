import {checkDataFormat, dataValidationReportFrom, checkIdsIsUniq, checkIdsIsVacant, checkIdsIsAvailable, checkDataShema, checkIdsShema} from '../helper.js'
import {getAddresses, getAllAddressIDsFromCommune, getAllAddressIDsOutsideCommune} from './models.js'
import {banAddressSchema, banID} from './schema.js'

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
        || dataValidationReportFrom(true)
      break
    default:
      report = dataValidationReportFrom(false, 'Unknown action type', {actionType, addresses})
  }

  return report
}

export const getDeltaReport = async (addressIDs, districtID) => {
  const allAddressIDsFromCommune = await getAllAddressIDsFromCommune(districtID)

  let idsToCreate = addressIDs.filter(id => !allAddressIDsFromCommune.includes(id))
  const idsToUpdate = addressIDs.filter(id => allAddressIDsFromCommune.includes(id))
  const idsToDelete = allAddressIDsFromCommune.filter(id => !addressIDs.includes(id))

  const idsUnauthorized = await getAllAddressIDsOutsideCommune(idsToCreate, districtID)
  if (idsUnauthorized.length > 0) {
    idsToCreate = idsToCreate.filter(id => !idsUnauthorized.includes(id))
  }

  return {idsToCreate, idsToUpdate, idsToDelete, idsUnauthorized}
}
