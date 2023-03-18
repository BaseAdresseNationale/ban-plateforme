import {getAddresses} from './models.js'
import {banAddressSchema} from './schema.js'

const report = (isValid, message, data) => ({
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
    return report(false, `Invalid address format (id: ${address.id})`, error.errors)
  }

  return report(true)
}

export const checkAddressesRequest = async (addresses, type) => {
  const adresseIDs = addresses.map(address => address.id)

  if (adresseIDs.length === 0) {
    return report(false, 'No address send to job')
  }

  if (type === 'insert') {
    // Check if IDs are already existing in BDD
    const existingIDs = await getExistingIDs(adresseIDs)
    if (existingIDs.length > 0) {
      return report(false, 'Unavailable IDs', existingIDs)
    }
  }

  if (type === 'insert' || type === 'update') {
  // Check address schema
    const addressesValidationPromises = addresses.map(address => banAddressValidation(address))
    const addressesValidation = await Promise.all(addressesValidationPromises)
    const invalidAddresses = addressesValidation.filter(({isValid}) => !isValid)
    if (invalidAddresses.length > 0) {
      return report(false, 'Invalid format', invalidAddresses)
    }

    // Check if IDs are uniq in the request
    const uniqAdresseIDs = [...new Set(adresseIDs)]
    if (uniqAdresseIDs.length !== adresseIDs.length) {
      const sharedIDs = Object.entries(
        addresses.reduce((acc, addr) => {
          const key = addr.id
          return {
            ...acc,
            [key]: [
              ...acc[key] || [],
              addr
            ]
          }
        }, {})
      ).reduce((acc, [key, values]) => (values.length > 1) ? [...acc, key] : acc, [])
      return report(false, 'Shared IDs in request', sharedIDs)
    }
  }

  if (type === 'update' || type === 'delete') {
    // Check if IDs are already existing in BDD
    const existingIDs = await getExistingIDs(adresseIDs)
    if (existingIDs.length !== adresseIDs.length) {
      return report(false, 'Some unknown IDs', adresseIDs.filter(id => !existingIDs.includes(id)))
    }
  }

  return report(true)
}