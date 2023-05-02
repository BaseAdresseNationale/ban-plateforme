import {getCommonToponyms, getAllCommonToponymIDsFromCommune, getAllCommonToponymIDsOutsideCommune} from './models.js'
import {banCommonToponymSchema} from './schema.js'

const report = (isValid, message, data) => ({
  isValid,
  ...(message || data ? {
    report: {
      message,
      data,
    }
  } : {}),
})

const getExistingIDs = async commonToponymID => {
  const existingCommonToponyms = await getCommonToponyms(commonToponymID)
  return existingCommonToponyms.map(commonToponyms => commonToponyms.id)
}

const banCommonToponymValidation = async commonToponym => {
  try {
    await banCommonToponymSchema.validate(commonToponym, {abortEarly: false})
  } catch (error) {
    return report(false, `Invalid commonToponym format (id: ${commonToponym.id})`, error.errors)
  }

  return report(true)
}

export const checkCommonToponymsRequest = async (commonToponyms, type) => {
  const commonToponymIDs = commonToponyms.map(commonToponym => commonToponym.id)

  if (commonToponymIDs.length === 0) {
    return report(false, 'No commonToponym send to job')
  }

  if (type === 'insert') {
    // Check if IDs are already existing in BDD
    const existingIDs = await getExistingIDs(commonToponymIDs)
    if (existingIDs.length > 0) {
      return report(false, 'Unavailable IDs', existingIDs)
    }
  }

  if (type === 'insert' || type === 'update') {
  // Check commonToponym schema
    const commonToponymsValidationPromises = commonToponyms.map(commonToponym => banCommonToponymValidation(commonToponym))
    const commonToponymsValidation = await Promise.all(commonToponymsValidationPromises)
    const invalidCommonToponyms = commonToponymsValidation.filter(({isValid}) => !isValid)
    if (invalidCommonToponyms.length > 0) {
      return report(false, 'Invalid format', invalidCommonToponyms)
    }

    // Check if IDs are uniq in the request
    const uniqCommonToponymIDs = [...new Set(commonToponymIDs)]
    if (uniqCommonToponymIDs.length !== commonToponymIDs.length) {
      const sharedIDs = Object.entries(
        commonToponyms.reduce((acc, commonToponym) => {
          const key = commonToponym.id
          return {
            ...acc,
            [key]: [
              ...acc[key] || [],
              commonToponym
            ]
          }
        }, {})
      ).reduce((acc, [key, values]) => (values.length > 1) ? [...acc, key] : acc, [])
      return report(false, 'Shared IDs in request', sharedIDs)
    }
  }

  if (type === 'update') {
    // Check if IDs are already existing in BDD
    const existingIDs = await getExistingIDs(commonToponymIDs)
    if (existingIDs.length !== commonToponymIDs.length) {
      return report(false, 'Some unknown IDs', commonToponymIDs.filter(id => !existingIDs.includes(id)))
    }
  }

  return report(true)
}

export const getDeltaReport = async (commonToponymIDs, codeCommune) => {
  const allCommonToponymIDsFromCommune = await getAllCommonToponymIDsFromCommune(codeCommune)

  const idsToCreate = commonToponymIDs.filter(id => !allCommonToponymIDsFromCommune.includes(id))
  const idsToUpdate = commonToponymIDs.filter(id => allCommonToponymIDsFromCommune.includes(id))
  const idsToDelete = allCommonToponymIDsFromCommune.filter(id => !commonToponymIDs.includes(id))

  const idsUnauthorized = await getAllCommonToponymIDsOutsideCommune(idsToCreate, codeCommune)

  return {idsToCreate, idsToUpdate, idsToDelete, idsUnauthorized}
}
