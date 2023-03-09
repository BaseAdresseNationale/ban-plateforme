const {getAddresses} = require('./models')

const isUuidV4 = id => {
  const uuidV4Regexp = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
  return uuidV4Regexp.test(id)
}

const report = (isValid, message, data) => ({
  isValid,
  ...(message || data ? {
    report: {
      message,
      data,
    }
  } : {}),
})

const isBanAddress = address =>
  // TODO: Update this
  typeof address === 'object'

const getExistingIDs = async adresseIDs => {
  const existingAddresses = await getAddresses(adresseIDs)
  return existingAddresses.map(addresses => addresses.id)
}

const checkAddresses = async (type, addresses) => {
  if (type === 'insert') {
    // Check if IDs are already existing
    const adresseIDs = addresses.map(address => address.id)

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

    const existingIDs = await getExistingIDs(adresseIDs)
    if (existingIDs.length > 0) {
      return report(false, 'Unavailable IDs', existingIDs)
    }

    // Check if IDs are uuid_v4
    const invalidIDs = adresseIDs.filter(
      addressID => !isUuidV4(addressID)
    )
    if (invalidIDs.length > 0) {
      return report(false, 'Invalid IDs', invalidIDs)
    }

    // Check address schema
    const invalidAddresses = addresses.filter(
      addressID => !isBanAddress(addressID)
    )
    if (invalidAddresses.length > 0) {
      return report(false, 'Invalid data', invalidAddresses)
    }
  }

  return report(true)
}

module.exports = {checkAddresses}
