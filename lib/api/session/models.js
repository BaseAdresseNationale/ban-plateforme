import {v4 as uuidv4} from 'uuid'
import {Session} from '../../util/sequelize.js'

export const addSession = async session => {
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
}

export const getSession = async session => {
  const resultSession = await Session.findOne({
    where: session,
    order: [['createdAt', 'DESC']]
  })
  return resultSession
}
