import {getSession} from '../api/session/models.js'
import {analyticsErrorMiddleware} from './analytics.js'

export const checkSessionFromRequest = async body => {
  const {districtID, siren, ...data} = body
  const session = await getSession(data)
  if (!session) {
    return {
      error: 401,
      message: 'Authentication required'
    }
  }

  // 6 hours session offset
  const expWithOffset = new Date(Number(session.exp) * 1000).getTime() + (6 * 60 * 60 * 1000)
  if (!session.exp || expWithOffset > new Date().now()) {
    return {
      error: 401,
      message: 'Session expired'
    }
  }

  return {session}
}

export const proConnectMiddleware = async (req, res, next) => {
  try {
    const {session, error, message} = await checkSessionFromRequest(req.body)

    if (error) {
      analyticsErrorMiddleware({req, error: message})
      res.status(error).json({
        error: message,
      })
    }

    if (session) {
      req.sessionID = session.dataValues.id
    }

    next()
  } catch (error) {
    console.error('AUTH ERROR !', error)
    analyticsErrorMiddleware({req, error})
    res.status(500).json({
      error: 'Internal Server Error',
    })
  }
}

export default proConnectMiddleware
