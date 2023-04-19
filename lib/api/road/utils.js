import {getRoads} from './models.js'
import {banRoadSchema} from './schema.js'

const report = (isValid, message, data) => ({
  isValid,
  ...(message || data ? {
    report: {
      message,
      data,
    }
  } : {}),
})

const getExistingIDs = async roadID => {
  const existingRoads = await getRoads(roadID)
  return existingRoads.map(roads => roads.id)
}

const banRoadValidation = async road => {
  try {
    await banRoadSchema.validate(road, {abortEarly: false})
  } catch (error) {
    return report(false, `Invalid road format (id: ${road.id})`, error.errors)
  }

  return report(true)
}

export const checkRoads = async (roads, type) => {
  const roadIDs = roads.map(road => road.id)

  if (roadIDs.length === 0) {
    return report(false, 'No road send to job')
  }

  if (type === 'insert') {
    // Check if IDs are already existing in BDD
    const existingIDs = await getExistingIDs(roadIDs)
    if (existingIDs.length > 0) {
      return report(false, 'Unavailable IDs', existingIDs)
    }
  }

  if (type === 'insert' || type === 'update') {
  // Check road schema
    const roadsValidationPromises = roads.map(road => banRoadValidation(road))
    const roadsValidation = await Promise.all(roadsValidationPromises)
    const invalidRoads = roadsValidation.filter(({isValid}) => !isValid)
    if (invalidRoads.length > 0) {
      return report(false, 'Invalid format', invalidRoads)
    }

    // Check if IDs are uniq in the request
    const uniqRoadIDs = [...new Set(roadIDs)]
    if (uniqRoadIDs.length !== roadIDs.length) {
      const sharedIDs = Object.entries(
        roads.reduce((acc, road) => {
          const key = road.id
          return {
            ...acc,
            [key]: [
              ...acc[key] || [],
              road
            ]
          }
        }, {})
      ).reduce((acc, [key, values]) => (values.length > 1) ? [...acc, key] : acc, [])
      return report(false, 'Shared IDs in request', sharedIDs)
    }
  }

  if (type === 'update') {
    // Check if IDs are already existing in BDD
    const existingIDs = await getExistingIDs(roadIDs)
    if (existingIDs.length !== roadIDs.length) {
      return report(false, 'Some unknown IDs', roadIDs.filter(id => !existingIDs.includes(id)))
    }
  }

  return report(true)
}

