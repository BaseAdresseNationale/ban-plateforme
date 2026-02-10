import {getSession} from '../api/session/models.js'
import {banSessionSchema} from '../api/session/schema.js'
import {analyticsErrorMiddleware} from './analytics.js'

export const checkSessionFromRequest = async (body, params = {}) => {
  try {
    const {districtID, codeCommune, siren, certificateType, config, ...data} = body

    const res = await banSessionSchema.isValid(data)
    if (!res) {
      return {
        error: 400,
        message: 'Format de données de session invalide'
      }
    }

    const session = await getSession(data)
    if (!session) {
      return {
        error: 401,
        message: 'Authentication required'
      }
    }

    const expWithOffset = new Date((Number(session.exp) * 1000) + (6 * 60 * 60 * 1000)).getTime()
    if (!session.exp || expWithOffset < Date.now()) {
      return {
        error: 401,
        message: 'Session expired'
      }
    }

    return {session}
  } catch (error) {
    throw new Error(`Error checking session from request: ${error.message}`)
  }
}

export const proConnectMiddleware = async (req, res, next) => {
  try {
    const {session, error, message} = await checkSessionFromRequest(req.body, req.params)

    if (error) {
      analyticsErrorMiddleware({req, error: message})
      res.status(error).json({
        error: message,
      })
      return
    }

    if (session) {
      req.sessionID = session.id
      req.userID = session.sub
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
