import {getCommonToponyms} from './common-toponym/models.js'
import {getDistricts} from './district/models.js'

export const dataValidationReportFrom = (isValid, message, data) => ({
  isValid,
  ...(message || data
    ? {
      report: {
        message,
        data,
      },
    }
    : {}),
})

export const checkDataFormat = (arrayError, emptyError, data) =>
  checkDataIsArray(arrayError, data)
  || checkDataIsNotEmptyArray(emptyError, data)

export const checkDataIsArray = (err, data) => {
  if (!Array.isArray(data)) {
    return dataValidationReportFrom(false, err)
  }
}

export const checkDataIsNotEmptyArray = (err, data) => {
  if (data.length === 0) {
    return dataValidationReportFrom(false, err)
  }
}

export const checkIdsIsUniq = (err = 'Shared IDs in request', IDs) => {
  const uniqIDs = [...new Set(IDs)]
  if (uniqIDs.length !== IDs.length) {
    const sharedIDs = Object.entries(
      IDs.reduce((acc, id) => ({...acc, [id]: (acc?.[id] ?? 0) + 1}), {})
    )
      .filter(([, nb]) => nb > 1)
      .map(([id]) => id)
    return dataValidationReportFrom(false, err, sharedIDs)
  }
}

export const checkIdsIsVacant = async (err = 'Unavailable IDs', IDs, getExistingIDs) => {
  const existingIDs = await getExistingIDs(IDs)
  if (existingIDs.length > 0) {
    return dataValidationReportFrom(false, err, existingIDs)
  }
}

export const checkIdsIsAvailable = async (err = 'Some unknown IDs', IDs, getExistingIDs) => {
  const unduplicateIDs = [...new Set(IDs)]
  const existingIDs = await getExistingIDs(unduplicateIDs)
  if (existingIDs.length !== unduplicateIDs.length) {
    return dataValidationReportFrom(false, err, unduplicateIDs.filter(id => !existingIDs.includes(id)))
  }
}

const idSchemaValidation = async (id, schema) => {
  try {
    await schema.validate(id, {abortEarly: false})
  } catch (error) {
    return dataValidationReportFrom(false, `Invalid ID format (id: ${id})`, error.errors)
  }

  return dataValidationReportFrom(true)
}

export const checkIdsShema = async (err = 'Invalid IDs format', ids, schema) => {
  const idsValidationPromises = ids.map(id => idSchemaValidation(id, schema))
  const idsValidation = await Promise.all(idsValidationPromises)
  const invalidIds = idsValidation.filter(({isValid}) => !isValid)
  if (invalidIds.length > 0) {
    return dataValidationReportFrom(false, err, invalidIds)
  }
}

const dataSchemaValidation = async (data, schema) => {
  try {
    await schema.validate(data, {strict: true, abortEarly: false})
  } catch (error) {
    return dataValidationReportFrom(false, `Invalid data format (id: ${data.id})`, error.errors)
  }

  return dataValidationReportFrom(true)
}

export const checkDataShema = async (err = 'Invalid data format', dataArr, schema) => {
  const dataArrValidationPromises = dataArr.map(data => dataSchemaValidation(data, schema))
  const dataArrValidation = await Promise.all(dataArrValidationPromises)
  const invalidDataArr = dataArrValidation.filter(({isValid}) => !isValid)
  if (invalidDataArr.length > 0) {
    return dataValidationReportFrom(false, err, invalidDataArr)
  }
}

export const checkIfCommonToponymsExist = async commonToponymIDs => {
  const uniqCommonToponymIDs = [...new Set(commonToponymIDs)]
  const existingCommonToponyms = await getCommonToponyms(uniqCommonToponymIDs)
  if (uniqCommonToponymIDs.length !== existingCommonToponyms.length) {
    const existingCommonToponymIDSet = new Set(existingCommonToponyms.map(({id}) => id))
    const nonExistingCommonToponymIDs = uniqCommonToponymIDs.filter(id => !existingCommonToponymIDSet.has(id))
    return dataValidationReportFrom(false, 'Some common toponyms do not exist', nonExistingCommonToponymIDs)
  }
}

export const checkIfDistrictsExist = async districtIDs => {
  const uniqDistrictIDs = [...new Set(districtIDs)]
  const existingDistricts = await getDistricts(uniqDistrictIDs)
  if (uniqDistrictIDs.length !== existingDistricts.length) {
    const existingDistrictIDs = new Set(existingDistricts.map(({id}) => id))
    const nonExistingCommonToponymIDs = uniqDistrictIDs.filter(id => !existingDistrictIDs.has(id))
    return dataValidationReportFrom(false, 'Some districts do not exist', nonExistingCommonToponymIDs)
  }
}

export const addOrUpdateJob = async (queue, jobId, data, delay) => {
  try {
    const existingJob = await queue.getJob(jobId)

    if (existingJob) {
      await existingJob.remove()
    }

    await queue.add(data, {
      jobId,
      delay,
      removeOnComplete: true,
      removeOnFail: true
    })
  } catch (error) {
    console.error(error)
  }
}

export const formatObjectWithDefaults = (inputObject, defaultValues) => {
  const formattedObject = {...inputObject}
  for (const key in defaultValues) {
    // Check if the key is missing in the inputObject
    if (!(key in formattedObject)) {
      // If the key is missing, add it with the default value
      formattedObject[key] = defaultValues[key]
    }
  }

  return formattedObject
}
