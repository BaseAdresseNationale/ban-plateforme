import {v4 as uuidv4} from 'uuid'
import {idsInDataBase} from './models.js'

export const getUuids = length => {
  const ids = new Set()
  while (ids.size !== length) {
    ids.add(uuidv4())
  }

  return [...ids]
}

export const uncollidUuids = async ids => {
  const bddIds = await idsInDataBase(ids)
  const filteredIds = ids.filter(id => !bddIds.includes(id))
  if (filteredIds.length !== ids.length) {
    const filteredIdsSet = new Set(filteredIds)
    while (filteredIdsSet.size !== ids.length) {
      filteredIdsSet.add(uuidv4())
    }

    return uncollidUuids([...filteredIdsSet])
  }

  return ids
}
