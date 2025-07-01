import {v4 as uuidv4} from 'uuid'
import {Session} from '../../util/sequelize.js'

export const addSession = async session => {
  try {
    const now = new Date()
    const resultSession = await Session.findOne({
      where: session,
      order: [['createdAt', 'DESC']]
    })

    // If no session found, create a new one
    if (resultSession === null) {
      const newSession = {
        id: uuidv4(), // Generate a new UUID for the session
        ...session,
        createdAt: now,
        updatedAt: now
      }
      const createdSession = await Session.create(newSession)
      return createdSession
    }

    return resultSession
  } catch (error) {
    console.error('Error in addSession:', error)
    throw error
  }
}

export const getSession = async session => {
  try {
    const resultSession = await Session.findOne({
      where: session,
      order: [['createdAt', 'DESC']]
    })
    return resultSession
  } catch (error) {
    console.error('Error in getSession:', error)
    throw error
  }
}
