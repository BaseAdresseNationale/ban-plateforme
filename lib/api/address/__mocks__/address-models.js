import {bddAddressMock} from './address-data-mock.js'

export async function getAddressesByFilters(filters, attributes) {
  return bddAddressMock.filter(address => {
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        if (!value.includes(address[key])) {
          return false
        }
      } else if (address[key] !== value) {
        return false
      }
    }

    return true
  }).map(address => (
    attributes ? Object.fromEntries(attributes.map(attribute => [attribute, address[attribute]])) : address
  ))
}

export async function getAddressesForDeltaReport(filters, extraAttributes = []) {
  return bddAddressMock.filter(address => {
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        if (!value.includes(address[key])) {
          return false
        }
      } else if (address[key] !== value) {
        return false
      }
    }

    return true
  }).map(address => {
    const row = {
      id: address.id,
      isActive: address.isActive,
      hash: address.meta?.idfix?.hash,
    }

    for (const attribute of extraAttributes) {
      row[attribute] = address[attribute]
    }

    return row
  })
}
