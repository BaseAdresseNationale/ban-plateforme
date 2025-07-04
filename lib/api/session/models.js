import {v4 as uuidv4} from 'uuid'
import {Session} from '../../util/sequelize.js'

export const addSession = async session => {
  try {
    const now = new Date()
    const {created} = await Session.findOrCreate({
      where: session,
      defaults: {
        id: uuidv4(),
        ...session,
        createdAt: now,
        updatedAt: now
      }
    })

    return created
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
