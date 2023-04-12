import {getAddresses} from './models.js'
import {banAddressSchema} from './schema.js'

const dataValidationReportFrom = (isValid, message, data) => ({
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
  const existingIDs = await getExistingIDs(adresseIDs)
  if (existingIDs.length !== adresseIDs.length) {
    return dataValidationReportFrom(false, err, adresseIDs.filter(id => !existingIDs.includes(id)))
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

const checkAddressesShema = async (err = 'Invalid format', addresses) => {
  const addressesValidationPromises = addresses.map(address => banAddressValidation(address))
  const addressesValidation = await Promise.all(addressesValidationPromises)
  const invalidAddresses = addressesValidation.filter(({isValid}) => !isValid)
  if (invalidAddresses.length > 0) {
    return dataValidationReportFrom(false, err, invalidAddresses)
  }
}

export const checkAddressesRequest = async (addresses, actionType) => {
  const adresseIDs = addresses.map(address => address.id)
  let report = (
    checkDataIsArray(`The request require an Array of address but receive ${typeof addresses}`, addresses)
    || checkDataIsNotEmptyArray('No address send to job', addresses)
  )

  if (!report) {
    switch (actionType) {
      case 'insert':
        report = (
          await checkIdsIsVacant('Unavailable IDs', adresseIDs)
          || await checkAddressesShema('Invalid format', addresses)
          || checkIdsIsUniq('Shared IDs in request', adresseIDs)
          || dataValidationReportFrom(true)
        )
        break
      case 'update':
        report = (
          await checkAddressesShema('Invalid format', addresses)
          || checkIdsIsUniq('Shared IDs in request', adresseIDs)
          || await checkIdsIsAvailable('Some unknow IDs', adresseIDs)
          || dataValidationReportFrom(true)
        )
        break
      default:
        report = dataValidationReportFrom(false, 'Unknown action type', {actionType, addresses})
    }
  }

  return report
}
