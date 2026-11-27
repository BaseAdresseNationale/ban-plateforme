import {BAN_SESSION_HEADER, isLegacySessionModeEnabled} from '../api/session/config.js'
import {findActiveSession} from '../api/session/models.js'
import {analyticsErrorMiddleware} from './analytics.js'
import {proConnectMiddleware} from './pro-connect.js'

const rejectRequest = ({req, res, status, message}) => {
  analyticsErrorMiddleware({req, error: message})
  res.status(status).json({error: message})
}

// An invalid header never falls back to the old mode: identifyLegacy runs only when the header is absent.
const createSessionMiddleware = identifyLegacy => async (req, res, next) => {
  try {
    const sessionId = req.get(BAN_SESSION_HEADER)

    if (!sessionId) {
      if (isLegacySessionModeEnabled()) {
        await identifyLegacy(req, res, next)
        return
      }

      rejectRequest({req, res, status: 401, message: 'Session requise'})
      return
    }

    const session = await findActiveSession(sessionId)
    if (!session) {
      rejectRequest({req, res, status: 401, message: 'Session inconnue, expirée ou inactive'})
      return
    }

    req.sessionID = session.id
    req.userID = session.sub
    req.sessionSiret = session.siret
    req.sessionEmail = session.email
    next()
  } catch (error) {
    console.error(`Session middleware error: ${error.message}`)
    analyticsErrorMiddleware({req, error})
    res.status(500).json({
      error: 'Internal Server Error',
    })
  }
}

// Only a non-empty string may reach a Sequelize filter: an array would widen it to an IN, an object would make Sequelize throw.
const getRequesterId = value => (typeof value === 'string' && value.trim() !== '' ? value : null)

// Old mode of the alerts: the owner is the createdBy sent by the caller, possibly missing; each route keeps its own check.
const identifyAlertsRequester = (req, _res, next) => {
  req.userID = getRequesterId(req.body?.createdBy) ?? getRequesterId(req.query.createdBy)
  req.sessionEmail = req.body?.createdByEmail
  next()
}

export const sessionMiddleware = createSessionMiddleware(proConnectMiddleware)

export const alertsSessionMiddleware = createSessionMiddleware(identifyAlertsRequester)
