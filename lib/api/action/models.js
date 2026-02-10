import {v4 as uuidv4} from 'uuid'
import {Action} from '../../util/sequelize.js'

export const addAction = async action => {
  const now = new Date()
  const newAction = {
    id: uuidv4(),
    ...action,
    createdAt: now,
    updatedAt: now
  }
  const result = await Action.create(newAction)
  return result
}
