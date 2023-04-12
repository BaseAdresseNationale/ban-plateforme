import {getAddresses} from './models.js'
import {banAddressSchema, banID} from './schema.js'

export const dataValidationReportFrom = (isValid, message, data) => ({
  isValid,
  ...(message || data ? {
    report: {
      message,
      data,
    }
  } : {}),
})

const getExistingIDs = async adresseIDs => {
  const existingAddresses = await getAddresses(adresseIDs)
  return existingAddresses.map(addresses => addresses.id)
}

const banAddressValidation = async address => {
  try {
    await banAddressSchema.validate(address, {abortEarly: false})
  } catch (error) {
    return dataValidationReportFrom(false, `Invalid address format (id: ${address.id})`, error.errors)
  }

  return dataValidationReportFrom(true)
}

const banAddressIdValidation = async addressID => {
  try {
    await banID.validate(addressID, {abortEarly: false})
  } catch (error) {
    return dataValidationReportFrom(false, `Invalid ID format (id: ${addressID})`, error.errors)
  }

  return dataValidationReportFrom(true)
}

const checkDataIsArray = (err, data) => {
  if (!Array.isArray(data)) {
    return dataValidationReportFrom(false, err)
  }
}

const checkDataIsNotEmptyArray = (err, data) => {
  if (data.length === 0) {
    return dataValidationReportFrom(false, err)
  }
}

const checkIdsIsVacant = async (err = 'Unavailable IDs', adresseIDs) => {
  const existingIDs = await getExistingIDs(adresseIDs)
  if (existingIDs.length > 0) {
    return dataValidationReportFrom(false, err, existingIDs)
  }
}

const checkIdsIsAvailable = async (err = 'Some unknown IDs', adresseIDs) => {
  const unduplicateAdresseIDs = [...new Set(adresseIDs)]
  const existingIDs = await getExistingIDs(unduplicateAdresseIDs)
  if (existingIDs.length !== unduplicateAdresseIDs.length) {
    return dataValidationReportFrom(false, err, unduplicateAdresseIDs.filter(id => !existingIDs.includes(id)))
  }
}

const checkIdsIsUniq = (err = 'Shared IDs in request', adresseIDs) => {
  const uniqAdresseIDs = [...new Set(adresseIDs)]
  if (uniqAdresseIDs.length !== adresseIDs.length) {
    const sharedIDs = Object.entries(adresseIDs.reduce((acc, id) => ({...acc, [id]: (acc?.[id] ?? 0) + 1}), {}))
      .filter(([, nb]) => nb > 1)
      .map(([id]) => id)
    return dataValidationReportFrom(false, err, sharedIDs)
  }
}

const checkAddressesShema = async (err = 'Invalid addresses format', addresses) => {
  const addressesValidationPromises = addresses.map(address => banAddressValidation(address))
  const addressesValidation = await Promise.all(addressesValidationPromises)
  const invalidAddresses = addressesValidation.filter(({isValid}) => !isValid)
  if (invalidAddresses.length > 0) {
    return dataValidationReportFrom(false, err, invalidAddresses)
  }
}

const checkAddressesIdsShema = async (err = 'Invalid IDs format', adresseIDs) => {
  const addressIdsValidationPromises = adresseIDs.map(id => banAddressIdValidation(id))
  const addressIdsValidation = await Promise.all(addressIdsValidationPromises)
  const invalidAddressIds = addressIdsValidation.filter(({isValid}) => !isValid)
  if (invalidAddressIds.length > 0) {
    return dataValidationReportFrom(false, err, invalidAddressIds)
  }
}

const checkDataFormat = (arrayError, emptyError, data) => (
  checkDataIsArray(arrayError, data)
  || checkDataIsNotEmptyArray(emptyError, data)
)

export const checkAddressesIDsRequest = async (adresseIDs, actionType, defaultReturn = true) => {
  let report = checkDataFormat(
    `The request require an Array of address IDs but receive ${typeof adresseIDs}`,
    'No address ID send to job',
    adresseIDs
  ) || await checkAddressesIdsShema('Invalid IDs format', adresseIDs)

  if (!report) {
    switch (actionType) {
      case 'insert':
        report = (
          checkIdsIsUniq('Shared IDs in request', adresseIDs)
          || await checkIdsIsVacant('Unavailable IDs', adresseIDs)
          || dataValidationReportFrom(true)
        )
        break
      case 'update':
        report = (
          checkIdsIsUniq('Shared IDs in request', adresseIDs)
          || await checkIdsIsAvailable('Some unknown IDs', adresseIDs)
          || dataValidationReportFrom(true)

        )
        break
      case 'delete':
        report = (
          checkIdsIsUniq('Shared IDs in request', adresseIDs)
          || await checkIdsIsAvailable('Some unknown IDs', adresseIDs)
          || dataValidationReportFrom(true)
        )
        break
      default:
        report = dataValidationReportFrom(false, 'Unknown action type', {actionType, adresseIDs})
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
        || await checkAddressesShema('Invalid format', addresses)
        || dataValidationReportFrom(true)
      break
    default:
      report = dataValidationReportFrom(false, 'Unknown action type', {actionType, addresses})
  }

  return report
}
