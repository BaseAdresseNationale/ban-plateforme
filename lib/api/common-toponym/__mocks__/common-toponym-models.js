import {bddCommonToponymMock} from './common-toponym-data-mock.js'

export async function getCommonToponyms(commonToponymIDs) {
  return bddCommonToponymMock.filter(commonToponym => commonToponymIDs.includes(commonToponym.id))
}

export async function getCommonToponymsByFilters(filters, attributes) {
  return bddCommonToponymMock.filter(commonToponym => {
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        if (!value.includes(commonToponym[key])) {
          return false
        }
      } else if (commonToponym[key] !== value) {
        return false
      }
    }

    return true
  }).map(commonToponym => (
    attributes ? Object.fromEntries(attributes.map(attribute => [attribute, commonToponym[attribute]])) : commonToponym
  ))
}

export async function getCommonToponymsForDeltaReport(filters, extraAttributes = []) {
  return bddCommonToponymMock.filter(commonToponym => {
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        if (!value.includes(commonToponym[key])) {
          return false
        }
      } else if (commonToponym[key] !== value) {
        return false
      }
    }

    return true
  }).map(commonToponym => {
    const row = {
      id: commonToponym.id,
      isActive: commonToponym.isActive,
      hash: commonToponym.meta?.idfix?.hash,
    }

    for (const attribute of extraAttributes) {
      row[attribute] = commonToponym[attribute]
    }

    return row
  })
}
