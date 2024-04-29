import {checkDataFormat, dataValidationReportFrom, checkIdsIsUniq, checkIdsIsVacant, checkIdsIsAvailable, checkDataShema, checkIdsShema, checkIfCommonToponymsExist, checkIfDistrictsExist} from '../helper.js'
import {banID} from '../schema.js'
import {getAddressesByFilters} from './models.js'
import {banAddressSchema} from './schema.js'

const getExistingAddressIDs = async addressIDs => {
  const existingAddresses = await getAddressesByFilters({id: addressIDs}, ['id'])
  return existingAddresses.map(address => address.id)
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
      case 'patch':
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
    case 'patch':
      report = checkDataFormat(
        `The request require an Array of address but receive ${typeof addresses}`,
        'No address send to job',
        addresses
      )
        || await checkAddressesIDsRequest(addresses.map(address => address.id), actionType, false)
        || await checkDataShema('Invalid format', addresses, banAddressSchema, {isPatch: actionType === 'patch'})
        || await checkIfCommonToponymsExist(addresses.reduce((acc, {mainCommonToponymID, secondaryCommonToponymIDs}) => {
          const ids = mainCommonToponymID ? [mainCommonToponymID] : []
          if (secondaryCommonToponymIDs) {
            ids.push(...secondaryCommonToponymIDs)
          }

          return [...acc, ...ids]
        }, []))
        || await checkIfDistrictsExist(addresses.reduce((acc, {districtID}) => {
          if (districtID) {
            return [...acc, districtID]
          }

          return acc
        }, []))
        || dataValidationReportFrom(true)
      break
    default:
      report = dataValidationReportFrom(false, 'Unknown action type', {actionType, addresses})
  }

  return report
}

export const getDeltaReport = async (addressIDsWithHash, districtID) => {
  const idsToCreate = []
  const idsToUpdate = []
  const idsToDelete = []

  // Get all existing addresses inside and outside the district from db
  const addressIDs = addressIDsWithHash.map(({id}) => id)
  const existingAddresses = await getAddressesByFilters({id: addressIDs}, ['id', 'meta', 'isActive'])
  const existingAddressesMap = new Map(existingAddresses.map(({id, meta, isActive}) => [id, {hash: meta?.idfix?.hash, isActive}]))

  for (const {id, hash} of addressIDsWithHash) {
    if (existingAddressesMap.has(id)) {
      // The address is already existing in the db
      const existingAddressIsActive = existingAddressesMap.get(id).isActive
      const existingAddressHash = existingAddressesMap.get(id).hash
      // If the address has a different hash we need to update it
      // If the address is not active, it means that we need to reactivate it (even if the hash is the same)
      if (existingAddressHash !== hash || !existingAddressIsActive) {
        idsToUpdate.push(id)
      }
    } else {
      // The address is not existing in the db
      idsToCreate.push(id)
    }
  }

  // Get all addresses that are part of the district from the db
  const allAddressesFromDistrict = await getAddressesByFilters({districtID}, ['id', 'meta', 'isActive'])
  const allAddressesFromDistrictMap = new Map(allAddressesFromDistrict.map(({id, meta, isActive}) => [id, {hash: meta?.idfix?.hash, isActive}]))
  const addressIDsWithHashMap = new Map(addressIDsWithHash.map(({id, hash}) => [id, hash]))
  for (const id of allAddressesFromDistrictMap.keys()) {
    // If a address is in the district but not in the request, we need to delete it (only if not active)
    const addressFromDistrictIsActive = allAddressesFromDistrictMap.get(id).isActive
    if (!addressIDsWithHashMap.has(id) && addressFromDistrictIsActive) {
      idsToDelete.push(id)
    }
  }

  return {idsToCreate, idsToUpdate, idsToDelete}
}

export const formatAddress = address => {
  const {range_validity: rangeValidity, ...addressRest} = address
  const lastRecordDate = rangeValidity[0].value
  return {...addressRest, lastRecordDate}
}
