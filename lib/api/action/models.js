import {v4 as uuidv4} from 'uuid'
import {Action} from '../../util/sequelize.js'

export const addAction = async action => {
  try {
    const now = new Date()
    const newAction = {
      id: uuidv4(),
      ...action,
      createdAt: now,
      updatedAt: now
    }
    await Action.create(newAction)
  } catch (error) {
    console.error('Error in addAction:', error)
    throw error
  }
}
